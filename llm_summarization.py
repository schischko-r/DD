"""LLM summarization helpers for the Data-Driven report builder.

The report builder remains the public compatibility facade. Dependencies are
passed in explicitly so this module does not import the large report core or
create a circular import.
"""

from __future__ import annotations

import asyncio
import json
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Mapping, Optional


DEFAULT_ATTRACT_SUMMARY_PROMPT = r"""
Ты старший продуктовый аналитик штаба Data-Driven Index. Подготовь короткую
управленческую сводку по AI-навыкам блока «Привлечение» для указанного
DD-продукта. Руководитель должен за 15 секунд понять: что именно изменилось,
у какого продукта или показателя, насколько и где находится основная проблема.

Входные данные:
- dd_product — название DD-продукта, для которого строится сводка;
- matched_ai_digest — только строки, сматченные с AI-digest;
- skill_name и indicator задают контекст факта;
- ai_product уточняет продукт внутри навыка;
- period задаёт период;
- comments и rule содержат факты и правила;
- traffic_light нужен только для приоритизации и итогового поля traffic_light.

Как анализировать:
1. Сначала извлеки из comments конкретные факты: показатель, направление
   изменения, точное значение, период, этап воронки, канал и причину — только
   если они присутствуют во входе.
2. Удали повторы: comments на уровне навыка могут дублировать comments его items.
   Один факт должен появиться в сводке один раз.
3. Сначала опиши наиболее существенные отклонения из red, затем yellow. Green
   упомяни максимум одной последней строкой и только с названием конкретного
   навыка или показателя.
4. Если одинаковый факт относится к нескольким AI-продуктам, объедини их в одной
   строке и перечисли продукты. Разнонаправленные факты не усредняй.
5. Сохраняй числа, знаки, проценты, единицы, MoM, названия этапов и каналов в том
   виде и смысле, в котором они даны. Не усиливай и не ослабляй формулировку.

Жёсткие требования к summary:
- 2–4 строки, разделённые символом \n; одна строка — один самостоятельный вывод;
- начинай строку с конкретного объекта: «<Навык> — <продукт/показатель>: ...»;
- первая строка — главный риск; стабильные показатели, если нужны, идут последними;
- не пиши названия цветов и не превращай traffic_light в описание динамики;
- запрещены формулировки «красная динамика», «жёлтая динамика», «зелёная
  стабильность», «наблюдается негативная динамика»;
- слова «значительно», «резко», «существенно», «стабильно» допустимы только если
  такая оценка прямо есть в comments или подтверждена приведённым числом;
- если чисел нет, конкретно перескажи доступный факт без оценочных усилителей;
- не добавляй общие вводные, заключения, ссылки и рекомендации. Действие можно
  указать только когда оно явно содержится во входных comments;
- не используй DD-метрики, индексные расчёты и любые знания вне входных данных.

Антипример запрещённого стиля:
«Красная динамика воронок. Продажи резко падают. Зелёная стабильность у
черновиков». Здесь цвета подменяют факты, нет масштаба и потерян контекст.

Поле traffic_light определи детерминированно по самому критичному доступному
статусу: red важнее yellow, yellow важнее green, при отсутствии статуса — gray.

Верни строго JSON без markdown:
{
  "traffic_light": "red|yellow|green|gray",
  "summary": "Строка 1.\nСтрока 2."
}
"""


def gigachat_is_configured(token: str, auth_url: str) -> bool:
    return bool(token and auth_url)


def make_gigachat(
    *,
    token: str,
    auth_url: str,
    scope: str,
    default_model: str,
    timeout: int,
    model: Optional[str] = None,
):
    from langchain_gigachat.chat_models.gigachat import GigaChat

    return GigaChat(
        credentials=token,
        auth_url=auth_url,
        verify_ssl_certs=False,
        scope=scope,
        model=model or default_model,
        profanity_check=False,
        timeout=timeout,
    )


def run_gigachat(func: Callable[[], Any], semaphore: Any) -> Any:
    """Run ``func`` in the existing GigaChat queue slot."""
    try:
        asyncio.get_event_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())
    with semaphore:
        return func()


def run_parallel_llm_tasks(
    tasks: list[Callable[[], Any]],
) -> list[tuple[Any, Exception | None]]:
    """Run LLM tasks in submission order with at most four active workers."""
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(task) for task in tasks]
        results = []
        for future in futures:
            try:
                results.append((future.result(), None))
            except Exception as error:
                results.append((None, error))
    return results


def llm_log_write(message: str, tqdm_module: Any = None) -> None:
    if tqdm_module is not None:
        tqdm_module.write(message)
    else:
        print(message)


def llm_log_event(
    kind: str,
    payload: dict[str, Any],
    log_write: Callable[[str], None],
) -> None:
    log_write(f"[LLM {kind}] " + json.dumps(payload, ensure_ascii=False, default=str))


def extract_json_object(
    text_value: str,
    clean_text: Callable[[Any], str],
) -> dict[str, Any] | None:
    text_value = clean_text(text_value)
    if not text_value:
        return None
    try:
        return json.loads(text_value)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text_value, flags=re.S)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def llm_summary_input(
    digests: list[dict[str, Any]],
    *,
    clean_text: Callable[[Any], str],
    skill_label_overrides: Mapping[str, str],
    skill_labels: Mapping[str, str],
) -> dict[str, Any]:
    skills = []
    for digest in digests:
        skill_key = clean_text(digest.get("skill_key"))
        skill_name = skill_label_overrides.get(skill_key, skill_labels.get(skill_key, skill_key))
        items = []
        for item in digest.get("digest_items", []):
            if not isinstance(item, dict):
                continue
            items.append(
                {
                    "indicator": clean_text(item.get("indicator") or item.get("digest_indicator")),
                    "traffic_light": clean_text(item.get("traffic_light")),
                    "ai_product": clean_text(item.get("ai_product_name") or item.get("product_label")),
                    "comments": [clean_text(value) for value in item.get("digest_texts", []) if clean_text(value)],
                    "rule": clean_text(item.get("digest_rule")),
                }
            )
        skills.append(
            {
                "skill_key": skill_key,
                "skill_name": skill_name,
                "period": clean_text(digest.get("digest_month")),
                "traffic_light": clean_text(digest.get("traffic_light")),
                "ai_products": digest.get("ai_tool_product_names", []),
                "items": items,
                "comments": digest.get("digest_texts", []),
                "rule": clean_text(digest.get("digest_rule")),
            }
        )
    return {"matched_ai_digest": skills}


def normalize_llm_summary(
    content: str,
    fallback_light: str,
    *,
    clean_text: Callable[[Any], str],
    parse_ai_light: Callable[[Any], str],
    extract_object: Callable[[str], dict[str, Any] | None],
) -> dict[str, str] | None:
    payload = extract_object(content)
    if isinstance(payload, dict):
        summary = clean_text(payload.get("summary") or payload.get("text") or payload.get("result"))
        points = payload.get("points") or payload.get("items")
        if not summary and isinstance(points, list):
            summary = "\n".join(clean_text(point) for point in points if clean_text(point))
        traffic_light = parse_ai_light(payload.get("traffic_light") or payload.get("priority")) or fallback_light
    else:
        summary = clean_text(content)
        traffic_light = fallback_light
    if not summary:
        return None
    return {"summary": summary, "traffic_light": traffic_light}


def build_llm_summary(
    product_name: str,
    block_code: str,
    digests: list[dict[str, Any]],
    log: bool,
    *,
    is_configured: Callable[[], bool],
    clean_text: Callable[[Any], str],
    worst_ai_light: Callable[[list[str]], str],
    make_summary_input: Callable[[list[dict[str, Any]]], dict[str, Any]],
    prompt_template: str,
    log_write: Callable[[str], None],
    make_client: Callable[[], Any],
    run_client: Callable[[Callable[[], Any]], Any],
    normalize_summary: Callable[[str, str], dict[str, str] | None],
) -> dict[str, str] | None:
    if not is_configured() or not digests:
        return None
    fallback_light = worst_ai_light([clean_text(digest.get("traffic_light")) for digest in digests])
    input_payload = {"dd_product": product_name, **make_summary_input(digests)}
    prompt = prompt_template.strip() + "\n\nВходные данные:\n" + json.dumps(input_payload, ensure_ascii=False, indent=2)
    if log:
        log_write("\n[LLM input] " + product_name + " / " + block_code + "\n" + json.dumps(input_payload, ensure_ascii=False, indent=2))

    response = run_client(lambda: make_client().invoke(prompt))
    content = clean_text(getattr(response, "content", response))
    summary = normalize_summary(content, fallback_light)
    if log:
        log_write("[LLM raw output] " + product_name + " / " + block_code + "\n" + content)
        log_write("[LLM parsed output] " + product_name + " / " + block_code + "\n" + json.dumps(summary or {}, ensure_ascii=False, indent=2))
    return summary


def append_llm_summary_to_group(
    block: dict[str, Any],
    block_code: str,
    summary: dict[str, str],
    digests: list[dict[str, Any]],
    *,
    find_group_tool: Callable[[dict[str, Any], str], dict[str, Any] | None],
    unique_non_empty: Callable[[list[str]], list[str]],
    parse_ai_light: Callable[[Any], str],
    worst_ai_light: Callable[[list[str]], str],
    clean_text: Callable[[Any], str],
    ai_summary_footer: Callable[[str, list[str]], str],
    refresh_group_tool_light: Callable[[dict[str, Any]], None],
) -> bool:
    tool = find_group_tool(block, block_code)
    if not tool:
        return False
    buttons = tool.setdefault("buttons", [])
    buttons[:] = [button for button in buttons if not button.get("llm_summary")]
    latest = max(digests, key=lambda digest: digest.get("digest_display_month_sort", (0, 0, "")))
    product_names = unique_non_empty([name for digest in digests for name in digest.get("ai_tool_product_names", [])])
    traffic_light = parse_ai_light(summary.get("traffic_light")) or worst_ai_light([clean_text(digest.get("traffic_light")) for digest in digests])
    buttons.insert(0, {
        "name": "LLM-cуммаризация",
        "traffic_light": traffic_light,
        "footer": ai_summary_footer(latest.get("digest_month", ""), product_names),
        "button": {"type": "general", "label": "", "link": ""},
        "ai_digest": True,
        "llm_summary": True,
        "digest_month": latest.get("digest_month", ""),
        "digest_month_raw": latest.get("digest_month_raw", ""),
        "digest_is_stale": any(bool(digest.get("digest_is_stale")) for digest in digests),
        "digest_stale_tooltip": next((clean_text(digest.get("digest_stale_tooltip")) for digest in digests if clean_text(digest.get("digest_stale_tooltip"))), ""),
        "digest_items": [{
            "indicator": "Основные выводы",
            "traffic_light": traffic_light,
            "digest_texts": [summary["summary"]],
            "digest_rule": "",
            "digest_month": latest.get("digest_month", ""),
            "ai_product_name": ", ".join(product_names),
        }],
    })
    refresh_group_tool_light(tool)
    return True


def ensure_llm_summary_placeholder(
    block: dict[str, Any],
    block_code: str,
    *,
    find_group_tool: Callable[[dict[str, Any], str], dict[str, Any] | None],
    refresh_group_tool_light: Callable[[dict[str, Any]], None],
) -> bool:
    tool = find_group_tool(block, block_code)
    if not tool:
        return False
    buttons = tool.setdefault("buttons", [])
    if any(button.get("llm_summary") for button in buttons):
        return False
    buttons.insert(0, {
        "name": "LLM-cуммаризация",
        "traffic_light": "gray",
        "footer": "",
        "button": {"type": "general", "label": "", "link": ""},
        "ai_digest": True,
        "llm_summary": True,
        "llm_placeholder": True,
        "digest_month": "",
        "digest_month_raw": "",
        "digest_is_stale": False,
        "digest_stale_tooltip": "",
        "digest_items": [{
            "indicator": "Основные выводы",
            "traffic_light": "gray",
            "digest_texts": ["AI-рекомендации пока недоступны: для продукта нет данных в AI-digest."],
            "digest_rule": "",
            "digest_month": "",
            "ai_product_name": "",
        }],
    })
    refresh_group_tool_light(tool)
    return True


def ensure_llm_summary_visible(
    data: dict[str, Any],
    *,
    block_codes: Any,
    find_block: Callable[[dict[str, Any], str], dict[str, Any] | None],
    ensure_placeholder: Callable[[dict[str, Any], str], bool],
) -> int:
    added = 0
    for product in data.get("products", []):
        for block_code in block_codes:
            block = find_block(product, block_code)
            if block and ensure_placeholder(block, block_code):
                added += 1
    return added
