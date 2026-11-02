import {isDdIndexMetric} from './report.js';

const PERIOD = 'III кв. 2026';
const FILE = 'Копия DDI_II_III_2026 УБ(1).xlsx';
const allowedCodes = new Set(['attract.nastroena_otchetnostь', 'attract.initiatives_list', 'churn.nastroena_otchetnostь',
  'churn.deviation_actions', 'mehaniki.vozvrat_klientov', 'general.navigator_reporting_knowledge',
  'attract.funnel_analysis', 'mehaniki.uderzhanie_klientov', 'attract.chernoviki_v_sbol_70', 'churn.benchmarks',
  'cx.score', 'mehaniki.doprodazhi_up_sell', 'attract.nalichie_uspeshnyh_biznes_zapuskov',
  'churn.report_completeness', 'churn.funnel_analysis', 'attract.report_completeness', 'attract.regulyarnostь',
  'alerts.business_metrics', 'attract.benchmarks', 'mehaniki.cross_sell.during', 'mehaniki.cross_sell.after']);
const sameTeam = (a, b) => a.id === String(b.id).replace(/::empty::.*/, '')
  && ['name', 'unit', 'type'].every(key => a[key] === b[key]);
const confirmed = fact => fact?.source?.confirmedBy === 'user' && fact.source.period === PERIOD
  && fact.source.file === FILE && fact.source.sheet === 'Метрики' && fact.source.column === 'F'
  && fact.source.sourceUnit === 'УБ' && /^F\d+$/.test(fact.source.cell || '');
const recommendations = (metric, value, maximum) => metric.recommendation_items ? {
  recommendation_items: metric.recommendation_items.map(item => ({...item, value, max_value: maximum,
    gap: value === null ? 0 : Math.max(0, maximum - value)})),
} : {};

export function applyUbWorkbookCorrections(products, period, overlays = []) {
  if (period !== PERIOD) return products;
  const assessments = (Array.isArray(overlays) ? overlays : [overlays]).filter(item => item?.scope === 'ub-workbook-corrections'
    && item.period === period && item.unit === 'УБ' && item.source?.file === FILE && item.source.column === 'F');
  if (!assessments.length) return products;
  return products.map(product => {
    if (product.unit !== 'УБ') return product;
    const records = assessments.flatMap(item => item.products || []).filter(team => sameTeam(team, product));
    if (records.length !== 1) return product;
    const facts = records[0].metrics;
    let changed = false;
    const metrics = product.metrics.map(block => ({...block, metrics: block.metrics.map(metric => {
      const fact = allowedCodes.has(metric.code) ? facts[metric.code] : null;
      if (confirmed(fact)) {
        if (metric.source?.origin === 'userConfirmedQ3ScoreCorrection'
          && metric.source.confirmedBy === 'user' && metric.source.correction?.confirmedBy === 'user'
          && metric.source.correction.period === period) return metric;
        if (['attract.campaign_launches', 'attract.nalichie_self_service', 'attract.nalichie_uspeshnyh_biznes_zapuskov'].includes(metric.code)
          && metric.source?.origin === 'userConfirmedCampaignPresence20261102'
          && metric.source.confirmedBy === 'user' && metric.source.period === period
          && metric.source.sourceName === product.name && metric.source.metricCode === metric.code
          && metric.source.rawValue === 1 && metric.value === metric.max_value) return metric;
        if (fact.applicable === false) {
          if (metric.value === null && metric.max_value === 0 && metric.is_applicabble_flg === false
            && metric.source?.cell === fact.source.cell && metric.source?.origin === fact.source.origin) return metric;
          changed = true;
          const {previousValue, previousMaxValue, previousPeriod, ...rubric} = metric;
          return {...rubric, value: null, max_value: 0, is_applicabble_flg: false, excluded_from_index: true,
            source: {...fact.source, previousAssessmentValue: metric.value, previousAssessmentSource: metric.source || null},
            ...recommendations(metric, null, 0)};
        }
        if ([0, 0.5, 1].includes(fact.rawValue) && metric.is_applicabble_flg !== false && metric.max_value > 0) {
          const value = fact.rawValue * metric.max_value;
          if (metric.value === value && metric.source?.cell === fact.source.cell
            && metric.source?.origin === fact.source.origin) return metric;
          changed = true;
          return {...metric, value, source: {...fact.source, rawValue: fact.rawValue,
            previousAssessmentValue: metric.value, previousAssessmentSource: metric.source || null},
            ...recommendations(metric, value, metric.max_value)};
        }
      }
      if (metric.code !== 'mehaniki.cross_sell' || metric.is_applicabble_flg === false || !(metric.max_value > 0)) return metric;
      const components = {...metric.crossSellComponents};
      let componentChanged = false;
      for (const component of ['during', 'after']) {
        const part = facts[`mehaniki.cross_sell.${component}`];
        if (!confirmed(part) || ![0, 0.5, 1].includes(part.rawValue)) continue;
        if (components[component]?.rawValue === part.rawValue && components[component]?.source?.cell === part.source.cell
          && components[component]?.source?.origin === part.source.origin) continue;
        componentChanged = changed = true;
        components[component] = {...components[component], value: part.rawValue * metric.max_value / 2,
          rawValue: part.rawValue, applicable: true, source: part.source};
      }
      if (!componentChanged) return metric;
      const applicable = Object.values(components).filter(part => part?.applicable !== false);
      const value = applicable.length === 2 && applicable.every(part => Number.isFinite(part.value))
        ? Math.min(metric.max_value, applicable.reduce((sum, part) => sum + part.value, 0))
        : components.after?.applicable === false && Number.isFinite(components.during?.value)
          ? components.during.value : null;
      return {...metric, value, crossSellComponents: components,
        source: {origin: 'userConfirmedUbWorkbookCrossSellSum', confirmedBy: 'user', period,
          file: FILE, previousAssessmentSource: metric.source || null},
        ...recommendations(metric, value, metric.max_value)};
    })}));
    return changed ? {...product, metrics, indexMaxPoints: metrics.flatMap(block => block.metrics)
      .filter(isDdIndexMetric).reduce((sum, metric) => sum + metric.max_value, 0)} : product;
  });
}
