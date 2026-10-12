export const metricSourceOptions = ['Дашборд в Навигаторе', 'Собственная отчетность', 'Запрос у аналитиков', 'Свой вариант ответа', 'Затрудняюсь ответить'];

export function metricSourceFields(proof, answers) {
  const id = proof.id;
  const source = answers[id];
  const fields = {[id]: source};
  if (source === metricSourceOptions[0]) fields[`${id}Link`] = answers[`${id}Link`];
  if (source === metricSourceOptions[1]) {
    fields[`${id}Format`] = answers[`${id}Format`];
    if (answers[`${id}Format`] === 'link') fields[`${id}Link`] = answers[`${id}Link`];
  }
  if (source === metricSourceOptions[3]) fields[`${id}Other`] = answers[`${id}Other`];
  return fields;
}

export function hasMetricSource(proof, answers) {
  const id = proof.id;
  const source = answers[id];
  if (!metricSourceOptions.includes(source)) return false;
  if (source === metricSourceOptions[3]) return Boolean(String(answers[`${id}Other`] || '').trim());
  if (source === metricSourceOptions[1] && answers[`${id}Format`] === 'excel') return true;
  if (source === metricSourceOptions[0] || source === metricSourceOptions[1]) {
    if (source === metricSourceOptions[1] && answers[`${id}Format`] !== 'link') return false;
    try {
      const url = new URL(String(answers[`${id}Link`] || '').trim());
      return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
    } catch {return false;}
  }
  return true;
}

export function metricSourceEvidence(proof, answers) {
  const fields = metricSourceFields(proof, answers);
  const id = proof.id;
  const details = fields[`${id}Link`] || fields[`${id}Other`]
    || (fields[`${id}Format`] === 'excel' ? 'Отчет в формате Excel — направить по почте' : '');
  return [fields[id], details].filter(Boolean).join(': ');
}
