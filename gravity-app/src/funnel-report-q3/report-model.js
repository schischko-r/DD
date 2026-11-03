const LEVELS = ['Плохо', 'Посередине', 'Хорошо'];
const PERCENTILES = [0, 10, 25, 50, 75, 90, 95, 100];
const validRows = rows => rows.filter(row => Number.isFinite(row.pct));
const levelFor = pct => pct < 40 ? LEVELS[0] : pct > 80 ? LEVELS[2] : LEVELS[1];

export function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '—';
  const places = Number.isFinite(digits) ? Math.max(0, Math.min(20, Math.trunc(digits))) : 1;
  return new Intl.NumberFormat('ru-RU', {maximumFractionDigits: places}).format(value);
}

export function selectRows(dataset, code, {unit = 'all', type = 'all'} = {}) {
  return (dataset.blocks?.[code]?.rows || []).filter(row => (unit === 'all' || row.unit === unit)
    && (type === 'all' || row.type === type));
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * p / 100;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function quartileFor(pct, percentiles) {
  if (pct <= percentiles.P25) return 1;
  if (pct <= percentiles.P50) return 2;
  if (pct <= percentiles.P75) return 3;
  return 4;
}

export function summarizeRows(inputRows) {
  const rows = validRows(inputRows);
  const n = rows.length;
  const sorted = rows.map(row => row.pct).sort((a, b) => a - b);
  const share = count => n ? 100 * count / n : 0;
  const percentiles = Object.fromEntries(PERCENTILES.map(p => [`P${p}`, percentile(sorted, p)]));
  const levels = LEVELS.map(label => {
    const count = rows.filter(row => levelFor(row.pct) === label).length;
    return {label, count, share: share(count)};
  });
  const bins = Array.from({length: 10}, (_, index) => {
    const from = index * 10;
    const to = from + 10;
    const count = sorted.filter(pct => pct >= from && (index === 9 ? pct <= to : pct < to)).length;
    return {range: `${from}–${to}`, from, to, count, share: share(count)};
  });
  const cuts = [null, percentiles.P25, percentiles.P50, percentiles.P75, null];
  const quartiles = Array.from({length: 4}, (_, index) => {
    const quartile = index + 1;
    const from = cuts[index];
    const to = cuts[index + 1];
    const count = rows.filter(row => quartileFor(row.pct, percentiles) === quartile).length;
    const range = !n ? '—' : quartile === 1 ? `≤${formatNumber(to)}%`
      : quartile === 4 ? `>${formatNumber(from)}%` : `>${formatNumber(from)}–${formatNumber(to)}%`;
    return {quartile, range, count, share: share(count), from, to};
  });
  const frequencies = [...new Set(sorted)].map(pct => ({pct, count: sorted.filter(value => value === pct).length}));
  return {n, mean: n ? sorted.reduce((sum, value) => sum + value, 0) / n : null,
    percentiles, levels, bins, quartiles, frequencies, rows};
}

export function decorateRows(rows, summary = summarizeRows(rows)) {
  return validRows(rows).map(row => ({...row,
    quartile: summary.n ? quartileFor(row.pct, summary.percentiles) : null,
    cdf: summary.n ? 100 * summary.rows.filter(other => other.pct <= row.pct).length / summary.n : null,
  }));
}

function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let content = typeof value === 'number' ? String(value).replace('.', ',') : String(value);
  if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/.test(content)) content = `'${content}`;
  return `"${content.replaceAll('"', '""')}"`;
}

export function makeCsv(rows, {blockLabel = ''} = {}) {
  const headers = ['Блок', 'ID команды', 'Команда', 'Юнит', 'Тип', 'Баллы', 'Максимальный балл',
    'Выполнение, %', 'Точное выполнение, %', 'Уровень', 'Квартиль', 'Накопленная доля, %', 'II квартал 2026, %', 'III − II, п.п.', 'III − II, % к II кварталу'];
  const lines = [headers, ...rows.map(row => [blockLabel, row.id, row.team, row.unit, row.type,
    row.earned, row.max, row.pct, row.rawPct, row.status || (Number.isFinite(row.pct) ? levelFor(row.pct) : ''), row.quartile, row.cdf, row.baselinePct, row.deltaPp, row.relativeChange])];
  return `\uFEFF${lines.map(line => line.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
