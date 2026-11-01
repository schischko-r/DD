import {completeProductPercent, maturityLevelName} from './report.js';
import {filterTitleRowsByPeriod} from './teamProfileSelection.js';

const normalizeType = (value) => String(value || '').trim().toLocaleLowerCase('ru-RU');

export function buildSummaryPeriodData(sourceProducts, rows, profiles, period) {
  const sourceRows = filterTitleRowsByPeriod(rows, sourceProducts, period);
  return {
    products: [...sourceProducts.filter((product) => product.period !== period), ...profiles],
    rows: profiles.map((product) => {
      if (!product.isPlaceholder) return sourceRows.find((row) => row.name === product.name && row.unit === product.unit
        && (!normalizeType(row.type) || normalizeType(row.type) === normalizeType(product.type)));
      const score = completeProductPercent(product);
      return {name: product.name, unit: product.unit, type: product.type, period,
        score, group: score === null ? 'Нет данных' : maturityLevelName(score)};
    }).filter(Boolean),
  };
}
