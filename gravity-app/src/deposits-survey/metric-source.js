export const httpLinkValues = value => String(value ?? '').split(/\r?\n/).map(link => link.trim()).filter(Boolean);
export function toHttpUrl(value) {
  const link = String(value ?? '').trim();
  if (!link || /\s/.test(link)) return null;
  const hasScheme = /^[a-z][a-z0-9+-]*:/i.test(link);
  try {
    const url = new URL(hasScheme ? link : `https://${link}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]+)$/i.test(url.hostname)) return null;
    return hasScheme ? link : `https://${link}`;
  } catch {return null;}
}

export function hasHttpLinks(value) {
  const links = httpLinkValues(value);
  return links.length > 0 && links.every(link => Boolean(toHttpUrl(link)));
}

export function hasDashboardSources(value) {
  const entries = httpLinkValues(value);
  return entries.length > 0 && entries.every(entry =>
    /^(?:https?|ftp|javascript|data|vbscript):/i.test(entry) ? hasHttpLinks(entry) : Boolean(entry));
}

export const metricSourceOptions = ['Дашборд в Навигаторе', 'Собственная отчетность', 'Запрос у аналитиков', 'Свой вариант ответа', 'Затрудняюсь ответить'];

export function metricSourceFields(proof, answers) {
  const id = proof.id;
  const source = answers[id];
  const fields = {[id]: source};
  if (source === metricSourceOptions[0]) fields[`${id}Link`] = String(answers[`${id}Link`] ?? '');
  if (source === metricSourceOptions[1]) {
    fields[`${id}Format`] = answers[`${id}Format`];
    if (answers[`${id}Format`] === 'link') fields[`${id}Link`] = String(answers[`${id}Link`] ?? '');
    if (answers[`${id}Format`] === 'unavailable' && String(answers[`${id}LinkComment`] || '').trim()) fields[`${id}LinkComment`] = String(answers[`${id}LinkComment`]);
  }
  if (source === metricSourceOptions[3]) fields[`${id}Other`] = answers[`${id}Other`];
  return fields;
}

export function hasMetricSource(proof, answers) {
  const id = proof.id;
  const source = answers[id];
  if (!metricSourceOptions.includes(source)) return false;
  if (source === metricSourceOptions[3]) return Boolean(String(answers[`${id}Other`] || '').trim());
  if (source === metricSourceOptions[0]) return hasDashboardSources(answers[`${id}Link`]);
  if (source === metricSourceOptions[1] && ['excel', 'unavailable'].includes(answers[`${id}Format`])) return true;
  if (source === metricSourceOptions[1]) {
    if (answers[`${id}Format`] !== 'link') return false;
    return hasHttpLinks(answers[`${id}Link`]);
  }
  return true;
}

export function metricSourceEvidence(proof, answers) {
  const fields = metricSourceFields(proof, answers);
  const id = proof.id;
  const details = fields[`${id}Link`] || fields[`${id}Other`]
    || (fields[`${id}Format`] === 'excel' ? 'Отчет в формате Excel'
      : fields[`${id}Format`] === 'unavailable' ? `Не могу предоставить ссылку${fields[`${id}LinkComment`] ? `. Комментарий: ${fields[`${id}LinkComment`]}` : ''}` : '');
  return [fields[id], details].filter(Boolean).join(': ');
}
