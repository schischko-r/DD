export const PLAN_STATUS_LABELS = {
  met: 'План выполняется',
  missed: 'План не выполняется',
  none: 'Плана нет',
};

export function planStatus(metric) {
  if (metric?.meetsPlan === true) return 'met';
  if (metric?.meetsPlan === false) return 'missed';
  return 'none';
}

export function planStatusLabel(status) {
  return PLAN_STATUS_LABELS[status] || PLAN_STATUS_LABELS.none;
}

export const TREND_LABELS = {
  positive: 'Динамика к лучшему',
  negative: 'Динамика к худшему',
  flat: 'Без изменений',
  unknown: 'Нет данных для сравнения',
};

const numberFormat = (value, maximumFractionDigits = 1) => new Intl.NumberFormat('ru-RU', {maximumFractionDigits}).format(value);

export function trendLabel(trend) {
  return TREND_LABELS[trend] || TREND_LABELS.unknown;
}

export function trendColor(trend) {
  if (trend === 'positive') return 'positive';
  if (trend === 'negative') return 'danger';
  return 'secondary';
}

const WORKING_DAYS = 'раб.дни';

function isWorkingDays(measure) {
  return String(measure ?? '').replace(/\s+/g, '') === WORKING_DAYS;
}

export function valueUnit(measure) {
  if (measure === '%') return '%';
  return isWorkingDays(measure) ? ' дн.' : '';
}

export function deltaUnit(measure) {
  if (measure === '%') return ' п.п.';
  return isWorkingDays(measure) ? ' дн.' : '';
}

export function formatMaturityValue(value, measure) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const scaled = measure === '%' ? number * 100 : number;
  return `${numberFormat(scaled)}${valueUnit(measure)}`;
}

export function formatMaturityDelta(delta, measure) {
  if (delta === null || delta === undefined) return '—';
  const number = Number(delta);
  if (!Number.isFinite(number)) return '—';
  const scaled = measure === '%' ? Math.abs(number) * 100 : Math.abs(number);
  return `${number < 0 ? '−' : '+'}${numberFormat(scaled)}${deltaUnit(measure)}`;
}

export function findMaturityUnit(maturity, unitKey) {
  if (!unitKey) return null;
  return (maturity?.units || []).find((item) => item.key === unitKey) || null;
}

export function visibleMaturityCategories(unit) {
  return (unit?.categories || [])
    .map((category) => ({
      ...category,
      metrics: category.metrics.filter((metric) => metric.value !== null && metric.value !== undefined),
    }))
    .filter((category) => category.metrics.length > 0);
}

const PLAN_TONES = {met: 'success', missed: 'danger', none: 'default'};
const PLAN_LABEL_THEMES = {met: 'success', missed: 'danger', none: 'normal'};

export function planTone(status) {
  return PLAN_TONES[status] || PLAN_TONES.none;
}

export function planLabelTheme(status) {
  return PLAN_LABEL_THEMES[status] || PLAN_LABEL_THEMES.none;
}

export function deltaDirection(delta) {
  const number = Number(delta);
  if (delta === null || delta === undefined || !Number.isFinite(number) || number === 0) return 'flat';
  return number > 0 ? 'up' : 'down';
}
