export function digestTheme(light) {
  if (light === 'red') return 'danger';
  if (light === 'yellow') return 'warning';
  if (light === 'green') return 'success';
  return 'normal';
}

export function digestStatus(light) {
  if (light === 'red') return 'Требует внимания';
  if (light === 'yellow') return 'Наблюдать';
  if (light === 'green') return 'Стабильно';
  return 'Нет оценки';
}

export function readableDigestRule(value) {
  const rule = String(value || '').trim();
  if (!rule) return '';
  return rule
    .replace(/Зел\.?:/gi, 'Зелёный сигнал —')
    .replace(/Красн\.?:/gi, 'Красный сигнал —')
    .replace(/Жёлт\.?:/gi, 'Жёлтый сигнал —')
    .replace(/\s*\|\s*/g, '. ')
    .replace(/\.$/, '') + '.';
}

export function worstDigestLight(items) {
  const order = ['red', 'yellow', 'green', 'gray'];
  return order.find((light) => items.some((item) => (item.traffic_light || 'gray') === light)) || 'gray';
}

export function hasAvailableRecommendations(items) {
  return (items || []).some((item) => !item.llm_placeholder);
}

export function hasManualValidationWarning(items) {
  return (items || []).some((item) => item.requires_manual_validation === true);
}

export function crossSellMarketPresentation(item) {
  const market = item?.crosssell_market;
  if (!market || typeof market !== 'object' || Array.isArray(market)) return null;
  const candidatesNew = market.candidates_new == null ? null : Number(market.candidates_new);
  const candidates = (Array.isArray(item.crosssell_candidates) ? item.crosssell_candidates : [])
    .filter((candidate) => candidate && typeof candidate === 'object')
    .map((candidate) => ({
      key: String(candidate.key || '').trim(),
      from: String(candidate.from || '').trim(),
      to: String(candidate.to || '').trim(),
      why: String(candidate.why || '').trim(),
      status: String(candidate.status || '').trim(),
      statusLabel: String(candidate.status_label || candidate.status || '').trim(),
    }));
  const sources = (Array.isArray(item.crosssell_sources) ? item.crosssell_sources : [])
    .filter((source) => source && typeof source === 'object')
    .map((source) => ({
      publisher: String(source.publisher || '').trim(),
      url: String(source.url || '').trim(),
    }));
  return {
    candidatesNew: candidatesNew != null && Number.isFinite(candidatesNew) ? candidatesNew : null,
    waitCount: candidates.filter((candidate) => candidate.status === 'wait').length,
    candidates,
    sources,
  };
}

export function recommendationSkillLink(block, items) {
  const skillKeys = new Set(
    (items || []).map((item) => String(item.skill_key || '').trim()).filter(Boolean),
  );
  if (skillKeys.size === 0) return '';

  const tools = (block?.tools || []).flatMap((tool) => [tool, ...(tool.buttons || [])]);
  const matchedTool = tools.find((tool) =>
    skillKeys.has(String(tool.ai_tool_key || '').trim()) && tool.button?.link,
  );
  return matchedTool?.button?.link || '';
}
