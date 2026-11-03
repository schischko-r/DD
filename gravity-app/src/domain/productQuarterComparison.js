import {completeProductPercent, isDdIndexMetricForPeriod, previousQuarterIndexDelta} from './report.js';
import {GOALS_FINAL_COUNTERPARTS} from './goalsFinalScores.js';
import {metricActualGrowth} from './teamProfileSelection.js';

const roundTenth = (value) => Math.round(value * 10) / 10 || 0;
const indexedMetrics = (block, period) => (block?.metrics || []).filter((metric) => isDdIndexMetricForPeriod(metric, period));
const sum = (metrics, field) => metrics.reduce((total, metric) => total + Number(metric[field]), 0);

// Block contributions compare each quarter's own index rubric. Criterion growth remains
// a separate comparable-score measurement; changes in applicability are never measured zeros.
export function buildProductQuarterComparison(product, baselineProducts = [], baselineRows = []) {
  const currentScore = completeProductPercent(product);
  const cardDelta = previousQuarterIndexDelta(product, currentScore, baselineProducts, baselineRows);
  if (!cardDelta) return null;
  const previous = baselineProducts.find((candidate) => candidate.period === cardDelta.previousPeriod
    && candidate.id === String(product.id || '').replace(/::empty::.*/, '')
    && ['name', 'unit', 'type'].every((key) => candidate[key] === product[key]));
  const previousScore = completeProductPercent(previous);
  if (previousScore === null || previousScore !== cardDelta.previousScore) return null;
  const currentMetrics = product.metrics.flatMap((block) => indexedMetrics(block, product.period));
  const previousMetrics = previous.metrics.flatMap((block) => indexedMetrics(block, previous.period));
  const currentTotalMaxPoints = sum(currentMetrics, 'max_value');
  const previousTotalMaxPoints = sum(previousMetrics, 'max_value');
  if (![currentTotalMaxPoints, previousTotalMaxPoints].every((maximum) => Number.isFinite(maximum) && maximum > 0)
    || [...currentMetrics, ...previousMetrics].some((metric) => !Number.isFinite(metric.max_value) || metric.max_value <= 0)) return null;
  const metricGrowthByCode = {};
  const codes = [...new Set([...product.metrics, ...previous.metrics].map((block) => block.code))];
  const blocks = codes.map((code) => {
    const currentBlock = product.metrics.find((block) => block.code === code);
    const previousBlock = previous.metrics.find((block) => block.code === code);
    const current = indexedMetrics(currentBlock, product.period);
    const prior = indexedMetrics(previousBlock, previous.period);
    let scoreChangeIndexPctDelta = 0;
    for (const metric of current) {
      const baselineCode = code === 'goals'
        ? Object.keys(GOALS_FINAL_COUNTERPARTS).find((base) => GOALS_FINAL_COUNTERPARTS[base] === metric.code) || metric.code
        : metric.code;
      const baselineMetric = prior.find((candidate) => candidate.code === baselineCode);
      if (!baselineMetric || baselineMetric.max_value !== metric.max_value) continue;
      const growth = metricActualGrowth({...metric, previousValue: baselineMetric.value,
        previousMaxValue: baselineMetric.max_value, previousPeriod: previous.period}, currentTotalMaxPoints, product.period);
      if (!growth) continue;
      metricGrowthByCode[metric.code] = growth;
      scoreChangeIndexPctDelta += growth.indexPctDelta;
    }
    const currentPoints = sum(current, 'value');
    const previousPoints = sum(prior, 'value');
    const currentContributionPct = currentPoints / currentTotalMaxPoints * 100;
    const previousContributionPct = previousPoints / previousTotalMaxPoints * 100;
    const rawIndexPctDelta = currentContributionPct - previousContributionPct;
    return {code, name: currentBlock?.name || previousBlock?.name || code,
      currentPoints, previousPoints, currentMaxPoints: sum(current, 'max_value'), previousMaxPoints: sum(prior, 'max_value'),
      currentContributionPct, previousContributionPct, rawIndexPctDelta, indexPctDelta: roundTenth(rawIndexPctDelta),
      scoreChangeIndexPctDelta, applicabilityIndexPctDelta: rawIndexPctDelta - scoreChangeIndexPctDelta};
  });
  // Keep criterion and block values literal. The visible reconciliation states rounding
  // separately instead of distributing it into individual blocks or rescaling growth.
  const blockIndexPctDelta = blocks.reduce((total, block) => total + Math.round(block.indexPctDelta * 10), 0) / 10;
  return {currentPeriod: product.period, previousPeriod: previous.period, currentScore,
    previousScore: cardDelta.previousScore, indexPctDelta: cardDelta.value,
    rawIndexPctDelta: sum(currentMetrics, 'value') / currentTotalMaxPoints * 100
      - sum(previousMetrics, 'value') / previousTotalMaxPoints * 100,
    blockIndexPctDelta, roundingAdjustment: roundTenth(cardDelta.value - blockIndexPctDelta),
    currentTotalMaxPoints, previousTotalMaxPoints, blocks, metricGrowthByCode};
}
