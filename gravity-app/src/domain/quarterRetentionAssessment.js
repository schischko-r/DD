import {isDdIndexMetric} from './report.js';

const benchmarkCodes = new Set(['attract.benchmarks', 'churn.benchmarks',
  'voronka_vhoda_v_kanal.nalichie_benchmarkov', 'voronka_prodazh.nalichie_benchmarkov',
  'voronka_ispolьzovaniya.nalichie_benchmarkov']);
const segmentMechanicsCodes = new Set(['mehaniki.reagirovanie_na_zhiznennye_sobytiya',
  'mehaniki.uderzhanie_klientov', 'mehaniki.povyshenie_urovnya_klienta', 'mehaniki.privlechenie_klientov']);
const same = (a, b) => a.id === String(b.id).replace(/::empty::.*/, '')
  && ['name', 'unit', 'type'].every(key => a[key] === b[key]);

export function applyQuarterRetentionAssessments(products, period, overlays, baselineProducts) {
  if (period !== 'III кв. 2026') return products;
  const facts = overlays.filter(item => item.scope === 'user-confirmed-q2-retention' && item.period === period)
    .flatMap(item => item.products || []);
  return products.map(product => {
    const teams = facts.filter(team => same(team, product));
    const metricFacts = Object.assign({}, ...teams.map(team => team.metrics));
    const prior = baselineProducts.find(team => team.period === 'II кв. 2026' && same(team, product));
    if (!teams.length || !prior) return product;
    const metrics = product.metrics.map(block => ({...block, metrics: block.metrics.map(metric => {
      if (metric.source?.correction?.origin === 'userConfirmedQ3ScoreCorrection'
        && metric.source.correction.confirmedBy === 'user'
        && metric.source.correction.period === period) return metric;
      // A later explicit zero overrides the older full-score carry for this team.
      if (product.name === 'Оплата улыбкой' && product.unit === 'DB' && product.type === 'Продукт'
        && String(product.id).replace(/::empty::.*/, '') === '11a243e6-5b73-56ad-8ac7-203e0d744062¦Оплата улыбкой'
        && ['general.klienty_s_produktom', 'general.mau_produkta'].includes(metric.code)
        && metric.source?.origin === 'userConfirmedSmileMarketsZero20261030'
        && metric.source?.confirmedBy === 'user' && metric.source?.period === period
        && metric.source?.rawValue === 0 && metric.value === 0) return metric;
      const fact = metricFacts[metric.code];
      const old = prior.metrics.flatMap(block => block.metrics).find(item => item.code === metric.code);
      const applicable = item => item && item.is_applicabble_flg !== false && Number(item.max_value) > 0;
      if (!fact || !applicable(old) || !applicable(metric) || old.max_value !== metric.max_value
        || !Number.isFinite(old.value) || old.value < 0 || old.value > old.max_value) return metric;
      const segmentMechanicsFloor = fact.source?.policy === 'segmentMechanicsNonDecreasing'
        && prior.unit === 'CX' && prior.type === 'Сегмент' && block.code === 'mehaniki'
        && segmentMechanicsCodes.has(metric.code) && [0, 0.5, 0.75, 1].includes(fact.source.proposedRawValue)
        && fact.rawValue === Math.max(old.value / old.max_value, fact.source.proposedRawValue);
      if (fact.source?.origin !== 'userConfirmedQuarterRetention' || fact.source?.confirmedBy !== 'user'
        || fact.source?.fromPeriod !== prior.period || fact.source?.sourceValue !== old.value
        || fact.source?.sourceMaxValue !== old.max_value
        || (!segmentMechanicsFloor && fact.rawValue !== old.value / old.max_value)) return metric;
      const pbMechanic = fact.source.policy === 'pbAllMechanics'
        && prior.name === 'PB' && prior.type === 'Сегмент' && block.code === 'mehaniki';
      const fullBenchmark = fact.source.policy === 'fullBenchmarks'
        && benchmarkCodes.has(metric.code) && old.value === old.max_value;
      const fullProductKnowledge = fact.source.policy === 'fullProductKnowledge'
        && ['general.klienty_s_produktom', 'general.mau_produkta'].includes(metric.code)
        && old.value === old.max_value;
      const campaigningCriterion = fact.source.policy === 'campaigningFullCriteria'
        && prior.name === 'Персональная рекомендация' && prior.unit === 'Data' && prior.type === 'Канал'
        && ['modeli_i_ai_proniknovenie.stimulirovanie_klienta', 'modeli_i_ai_proniknovenie.obuchayuschie_mehaniki',
          'dannye.promyshlenye_dannye'].includes(metric.code) && old.value === old.max_value;
      if (!pbMechanic && !fullBenchmark && !fullProductKnowledge && !campaigningCriterion && !segmentMechanicsFloor) return metric;
      const value = segmentMechanicsFloor ? Math.max(old.value, fact.source.proposedRawValue * metric.max_value) : old.value;
      return {...metric, value, previousValue: old.value, previousMaxValue: old.max_value, previousPeriod: prior.period,
        source: {...fact.source, sourceValue: old.value, sourceMaxValue: old.max_value},
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map(item => ({
          ...item, value, max_value: metric.max_value, gap: metric.max_value - value,
        }))} : {})};
    })}));
    return {...product, metrics, indexMaxPoints: metrics.flatMap(block => block.metrics)
      .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)};
  });
}
