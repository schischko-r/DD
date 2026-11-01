const TARGET = 'general.navigator_reporting_knowledge';
const MAU = ['general.mau_produkta', 'general.mau_u_vashego_kanala'];
const MARKET = 'general.obъem_celevogo_rynka_v_rossii';
const SATELLITES = 'general.znanie_produktov_sputnikov';
const MAJOR = 'general.kol_vo_major_klientov';

const applicable = metric => metric && metric.is_applicabble_flg !== false && metric.max_value > 0;
export function isDirectNavigatorOverride(product, metric) {
  const proof = metric?.source;
  return product.period === 'III кв. 2026' && metric?.code === TARGET && applicable(metric)
    && proof?.origin === 'userConfirmedDirectNavigatorAssessment' && proof.confirmedBy === 'user'
    && proof.period === product.period && proof.teamId === String(product.id).replace(/::empty::.*/, '')
    && proof.teamName === product.name && proof.unit === product.unit && proof.type === product.type
    && [0, 0.5, 1].includes(proof.rawValue) && metric.value === proof.rawValue * metric.max_value;
}
export function isInvestKopilkaNavigatorOverride(product, metric) {
  return String(product.id).replace(/::empty::.*/, '') === '181a8be0-a6c1-5590-819c-b49ae1c80081¦ИнвестКопилка'
    && product.name === 'ИнвестКопилка' && product.unit === 'УБ' && product.type === 'Продукт'
    && product.period === 'III кв. 2026'
    && metric?.code === TARGET && applicable(metric)
    && metric.source?.origin === 'userConfirmedInvestKopilkaNavigator20261030'
    && metric.source?.confirmedBy === 'user' && metric.source?.rawValue === 0.5
    && metric.source?.period === 'III кв. 2026'
    && metric.source?.teamId === '181a8be0-a6c1-5590-819c-b49ae1c80081¦ИнвестКопилка'
    && metric.value === 0.5 * metric.max_value;
}
const known = metric => !applicable(metric) || !Number.isFinite(metric.value)
  || metric.value < 0 || metric.value > metric.max_value ? null : metric.value === metric.max_value;

export function navigatorKnowledgeFraction(metrics) {
  if (known(metrics.find(metric => metric.code === MAJOR)) === true) return 1;
  const mau = MAU.map(code => metrics.find(metric => metric.code === code)).filter(applicable);
  const market = metrics.find(metric => metric.code === MARKET);
  // A missing/non-applicable prerequisite is not an answer that the team does not know it.
  if (!mau.length || !applicable(market)) return undefined;
  const knowsMau = mau.some(metric => known(metric) === true) ? true
    : mau.every(metric => known(metric) === false) ? false : null;
  const knowsMarket = known(market);
  if (knowsMau === false || knowsMarket === false) return 0;
  if (knowsMau === null || knowsMarket === null) return null;
  const satellites = metrics.find(metric => metric.code === SATELLITES);
  if (!applicable(satellites)) return undefined;
  const knowsSatellites = known(satellites);
  return knowsSatellites === null ? null : knowsSatellites ? 1 : 0.5;
}

export function applyNavigatorKnowledge(products, period) {
  if (period !== 'III кв. 2026') return products;
  return products.map(product => {
    const metrics = product.metrics.flatMap(block => block.metrics);
    const target = metrics.find(metric => metric.code === TARGET);
    const knowsMajor = known(metrics.find(metric => metric.code === MAJOR)) === true;
    if (isDirectNavigatorOverride(product, target) || (!knowsMajor && isInvestKopilkaNavigatorOverride(product, target))) return product;
    const fraction = navigatorKnowledgeFraction(metrics);
    if (!applicable(target) || fraction === undefined) return product;
    const value = fraction === null ? null : fraction * target.max_value;
    if (target.value === value) return product;
    return {...product, metrics: product.metrics.map(block => ({...block,
      metrics: block.metrics.map(metric => metric.code !== TARGET ? metric : {
        ...metric, value,
        source: {origin: knowsMajor ? 'userConfirmedMajorNavigatorRule' : 'userConfirmedNavigatorKnowledgeHierarchy',
          confirmedBy: 'user', date: knowsMajor ? '2026-10-31' : '2026-10-30', period,
          rawValue: fraction,
          rule: knowsMajor ? 'По последнему указанию пользователя: если полностью знают количество Major-клиентов, знание отчётности в Навигаторе = 100%. Имеет приоритет над прежними условиями.'
            : 'Не знают MAU или рынок России — 0; знают MAU и рынок, но не спутники — 0.5; знают все три — 1. Пропуск ответа не равен незнанию.',
          inputs: metrics.filter(entry => [...MAU, MARKET, SATELLITES, MAJOR].includes(entry.code)).map(entry => ({
            code: entry.code, value: entry.value, maxValue: entry.max_value, applicable: entry.is_applicabble_flg !== false,
          })),
          previousAssessmentSource: metric.source || null},
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map(item => ({...item,
          value, max_value: metric.max_value, gap: value === null ? null : metric.max_value - value,
        }))} : {}),
      }),
    }))};
  });
}
