export const httpLinkValues = value => String(value ?? '').split(/\r?\n/).map(link => link.trim()).filter(Boolean);
export function hasHttpLinks(value) {
  const links = httpLinkValues(value);
  return links.length > 0 && links.every(link => {
    if (/\s/.test(link)) return false;
    try {const url = new URL(link); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);} catch {return false;}
  });
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
  if (source === metricSourceOptions[0]) fields[`${id}Link`] = httpLinkValues(answers[`${id}Link`]).join('\n');
  if (source === metricSourceOptions[1]) {
    fields[`${id}Format`] = answers[`${id}Format`];
    if (answers[`${id}Format`] === 'link') fields[`${id}Link`] = httpLinkValues(answers[`${id}Link`]).join('\n');
    if (answers[`${id}Format`] === 'unavailable' && String(answers[`${id}LinkComment`] || '').trim()) fields[`${id}LinkComment`] = String(answers[`${id}LinkComment`]).trim();
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
    || (fields[`${id}Format`] === 'excel' ? 'Отчет в формате Excel — направить по почте'
      : fields[`${id}Format`] === 'unavailable' ? `Не могу предоставить ссылку${fields[`${id}LinkComment`] ? `. Комментарий: ${fields[`${id}LinkComment`]}` : ''}` : '');
  return [fields[id], details].filter(Boolean).join(': ');
}
