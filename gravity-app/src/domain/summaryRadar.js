import {completeBlockPercent, radarBlockPercent} from './report.js';

const QUARTERS = ['I', 'II', 'III', 'IV'];

export function previousQuarterPeriod(period) {
  const match = String(period || '').match(/^(I|II|III|IV) кв\. (\d{4})$/);
  if (!match) return null;
  const index = QUARTERS.indexOf(match[1]);
  return index ? `${QUARTERS[index - 1]} кв. ${match[2]}` : `IV кв. ${Number(match[2]) - 1}`;
}

function blockAverage(products, code) {
  const values = products.map(product => {
    const block = product.metrics?.find(block => block.code === code);
    return product.isPlaceholder ? completeBlockPercent(block) : radarBlockPercent(block || {metrics: []});
  }).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export function buildSummaryRadarData(products, period, unit, blocks) {
  const current = products.filter(product => !period || product.period === period);
  const previousPeriod = previousQuarterPeriod(period);
  const previous = products.filter(product => product.period === previousPeriod && (!unit || product.unit === unit));
  const points = blocks.map(block => ({...block, b2c: blockAverage(current, block.code),
    unit: blockAverage(current.filter(product => !unit || product.unit === unit), block.code),
    previous: blockAverage(previous, block.code),
  }));
  return {points, previousPeriod, hasPrevious: points.some(point => Number.isFinite(point.previous))};
}

export function isSummaryAntiTopMetricHidden(metric, period) {
  return period === 'III кв. 2026' && metric.code === 'mehaniki.gibkoe_izmenenie_usloviy_produkta';
}
