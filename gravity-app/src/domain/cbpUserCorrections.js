import {GOALS_FINAL_COUNTERPARTS} from './goalsFinalScores.js';
import {isDdIndexMetric} from './report.js';

const PERIOD = 'III кв. 2026';
const ORIGIN = 'userConfirmedCbpCorrections20261102';
const CX_ORIGIN = 'userConfirmedCxCorrections20261102';
const allowedCodes = new Set(['goals.po_monitoring', 'goals.po_factor_analysis', 'goals.po_forecast',
  'alerts.business_metrics', 'mehaniki.vozvrat_klientov', 'mehaniki.doprodazhi_up_sell',
  'hyp.discovery_40_backlog', 'hyp.datadriven_rating_7_5', 'churn.funnel_analysis', 'cx.score',
  'attract.report_completeness', 'attract.funnel_analysis', 'churn.report_completeness',
  'churn.nastroena_otchetnostь', 'mehaniki.uderzhanie_klientov',
  'general.navigator_reporting_knowledge', 'attract.campaign_launches', 'goals.po_factor_analysis',
  'attract.nastroena_otchetnostь', 'attract.regulyarnostь', 'attract.initiatives_list',
  'churn.regulyarnostь', 'churn.deviation_actions', 'alerts.business_metrics',
  'mehaniki.personalizaciya_klientskogo_opyta', 'mehaniki.povyshenie_urovnya_klienta', 'hyp.ab_tests',
  'churn.benchmarks']);
const sameTeam = (a, b) => a.id === String(b.id).replace(/::empty::.*/, '')
  && ['name', 'unit', 'type'].every((key) => a[key] === b[key]);
const confirmed = (fact) => [ORIGIN, CX_ORIGIN].includes(fact?.source?.origin) && fact.source.confirmedBy === 'user'
  && fact.source.period === PERIOD
  && ((fact.source.sourceUnit === 'CBP' && fact.source.origin === ORIGIN)
    || (fact.source.sourceUnit === 'CX' && fact.source.origin === CX_ORIGIN))
  && Number.isInteger(fact.source.inputRow);
const numeric = (fact) => confirmed(fact) && [0, 0.25, 0.5, 0.75, 1].includes(fact.rawValue);
const recommendations = (metric, value, maximum) => metric.recommendation_items ? {
  recommendation_items: metric.recommendation_items.map((item) => ({...item, value, max_value: maximum,
    gap: value === null ? 0 : Math.max(0, maximum - value)})),
} : {};
const sourceFor = (metric, fact) => ({...fact.source,
  ...(Object.hasOwn(fact, 'rawValue') ? {rawValue: fact.rawValue} : {}),
  previousAssessmentValue: metric.value, previousAssessmentSource: metric.source || null});

export function applyCbpUserCorrections(products, period, overlays = []) {
  if (period !== PERIOD) return products;
  const assessments = (Array.isArray(overlays) ? overlays : [overlays]).filter((item) =>
    item?.period === period && ((item.scope === 'cbp-user-corrections' && item.unit === 'CBP' && item.source?.origin === ORIGIN)
      || (item.scope === 'cx-user-corrections' && item.unit === 'CX' && item.source?.origin === CX_ORIGIN))
    && item.source.confirmedBy === 'user');
  if (!assessments.length) return products;
  return products.map((product) => {
    const matchingAssessments = assessments.filter((item) => item.unit === product.unit);
    if (!matchingAssessments.length) return product;
    const teams = matchingAssessments.flatMap((item) => item.products || []).filter((team) => sameTeam(team, product));
    if (teams.length !== 1) return product;
    const facts = teams[0].metrics;
    let changed = false;
    const metrics = product.metrics.map((block) => {
      const goalUpdates = {};
      const entries = block.metrics.map((metric) => {
        const fact = allowedCodes.has(metric.code) ? facts[metric.code] : null;
        if (confirmed(fact)) {
          if (fact.applicable === false) {
            if (metric.source?.origin === fact.source.origin && metric.source.inputRow === fact.source.inputRow
              && metric.value === null && metric.max_value === 0 && metric.is_applicabble_flg === false) return metric;
            changed = true;
            const {previousValue, previousMaxValue, previousPeriod, ...rubric} = metric;
            return {...rubric, value: null, max_value: 0, is_applicabble_flg: false,
              excluded_from_index: true, dd_calculation_flg: 0, source: sourceFor(metric, fact),
              ...recommendations(metric, null, 0)};
          }
          if (numeric(fact) && metric.is_applicabble_flg !== false && metric.max_value > 0) {
            const baseGoalCode = block.code === 'goals'
              ? Object.keys(GOALS_FINAL_COUNTERPARTS).find((code) => GOALS_FINAL_COUNTERPARTS[code] === metric.code) : null;
            if (baseGoalCode) goalUpdates[baseGoalCode] = fact.rawValue;
            const value = fact.rawValue * metric.max_value;
            if (metric.value === value && metric.source?.origin === ORIGIN && metric.source.inputRow === fact.source.inputRow) return metric;
            changed = true;
            return {...metric, value, source: {...sourceFor(metric, fact), ...(baseGoalCode ? {level: 'final', selectedValue: fact.rawValue} : {})},
              ...recommendations(metric, value, metric.max_value)};
          }
        }
        if (metric.code !== 'mehaniki.cross_sell' || metric.is_applicabble_flg === false || !(metric.max_value > 0)) return metric;
        const during = facts['mehaniki.cross_sell.during'];
        if (!numeric(during)) return metric;
        const previous = metric.crossSellComponents || {};
        if (previous.during?.rawValue === during.rawValue && previous.during?.source?.origin === ORIGIN
          && previous.during.source.inputRow === during.source.inputRow) return metric;
        changed = true;
        const components = {...previous, during: {...previous.during,
          value: during.rawValue * metric.max_value / 2, rawValue: during.rawValue,
          source: sourceFor(previous.during || {}, during)}};
        const after = components.after;
        const value = after?.applicable === false ? components.during.value
          : Number.isFinite(after?.value) ? Math.min(metric.max_value, components.during.value + after.value) : null;
        return {...metric, value, crossSellComponents: components,
          source: {origin: 'userConfirmedCbpCrossSellSum20261102', confirmedBy: 'user', period,
            duringSource: components.during.source, afterSource: after?.source || null,
            previousAssessmentSource: metric.source || null}, ...recommendations(metric, value, metric.max_value)};
      });
      return {...block, metrics: entries,
        ...(Object.keys(goalUpdates).length ? {goalsFinalScores: {...block.goalsFinalScores, ...goalUpdates}} : {})};
    });
    return changed ? {...product, metrics, indexMaxPoints: metrics.flatMap((block) => block.metrics)
      .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)} : product;
  });
}
