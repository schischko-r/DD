export function scoreFor(product, rows) {
  return rows.find((row) => row.name === product.name && row.unit === product.unit)?.score ?? 0;
}

export function groupFor(product, rows) {
  return rows.find((row) => row.name === product.name && row.unit === product.unit)?.group || '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445';
}

export function percent(value, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(value) / Number(max)) * 100)));
}

export function blockPercent(block) {
  const metrics = block.metrics || [];
  const value = metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
  const max = metrics.reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
  return percent(value, max);
}

export function metricDomId(code) {
  return `dd-metric-${encodeURIComponent(String(code || ''))}`;
}

export function difficultyMeta(value) {
  if (value <= 3) return {label: '\u041b\u0435\u0433\u043a\u043e', theme: 'success'};
  if (value <= 6) return {label: '\u0421\u0440\u0435\u0434\u043d\u0435', theme: 'warning'};
  return {label: '\u0421\u043b\u043e\u0436\u043d\u043e', theme: 'danger'};
}
