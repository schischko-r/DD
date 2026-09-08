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

const numberFormat = (value, maximumFractionDigits = 1) => new Intl.NumberFormat('ru-RU', {maximumFractionDigits}).format(value);

const WORKING_DAYS = 'раб.дни';

function isWorkingDays(measure) {
  return String(measure ?? '').replace(/\s+/g, '') === WORKING_DAYS;
}

export function valueUnit(measure) {
  if (measure === '%') return '%';
  return isWorkingDays(measure) ? ' дн.' : '';
}

export function formatMaturityValue(value, measure) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const scaled = measure === '%' ? number * 100 : number;
  return `${numberFormat(scaled)}${valueUnit(measure)}`;
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

