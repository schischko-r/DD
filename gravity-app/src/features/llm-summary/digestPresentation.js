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
