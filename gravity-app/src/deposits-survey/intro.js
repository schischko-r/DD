import {getBacklogAnalyzed, getSections, visibleQuestions, inlineQuestions} from './questions.js';
import {productSurveyProfiles} from './product-surveys.js';

const surveyLabels = {
  marketRussia: 'Объём целевого рынка в России', marketSber: 'Объём целевого рынка в Сбере',
  clients: 'Клиенты с продуктом', mau: 'MAU продукта', dau: 'DAU продукта', yau: 'YAU продукта', dauMau: 'DAU/MAU',
  satellite: 'Знание продуктов-спутников', monitoring: 'Знание отчётности в Навигаторе',
  qualityTools: 'Контроль качества данных (ККД)',
  attractConfigured: 'Отчетность и аналитика по привлечению', attractIncludes: 'Отчетность и аналитика по привлечению',
  attractAnalysis: 'Отчетность и аналитика по привлечению', churnConfigured: 'Отчетность и аналитика по оттоку',
  churnIncludes: 'Отчетность и аналитика по оттоку', churnAnalysis: 'Отчетность и аналитика по оттоку',
  usageConfigured: 'Отчётность по воронке использования', usageIncludes: 'Полнота отчёта по использованию',
  usageAnalysis: 'Анализ воронки использования', benchmarksAttract: 'Бенчмарки', benchmarksChurn: 'Бенчмарки',
  alerts: 'Настройка алертов', systemAlerts: 'Настройка алертов', uxAlerts: 'Оповещения по проблемам UX/UI',
  mechanicsMonitoring: 'Мониторинг эффективности механик', crossSellAfter: 'Cross-sell после оформления продукта',
  discovery: 'Discovery: доля исследований в бэклоге',
};

const digitalCodes = [
  'attract.campaign_launches', 'attract.chernoviki_v_sbol_70', 'attract.nalichie_self_service',
  'attract.nalichie_uspeshnyh_biznes_zapuskov', 'goals.monitored', 'goals.factor_analysis_l1_l2', 'goals.forecast',
  'mehaniki.cross_sell',
  'hyp.ab_tests', 'hyp.datadriven_rating_7_5', 'hyp.extra_initiatives', 'cx.score',
];
const mechanicLabels = {
  'mehaniki.uderzhanie_klientov': 'Механики удержания клиентов',
  'mehaniki.vozvrat_klientov': 'Механики возврата клиентов',
  'mehaniki.doprodazhi_up_sell': 'Механики допродаж (Upsell)',
};
const applicable = metric => metric && metric.is_applicabble_flg !== false && !metric.excluded_from_index
  && Number(metric.dd_calculation_flg) !== 0 && Number(metric.max_value) > 0;

export function getIntroSummary(product) {
  const profile = productSurveyProfiles[product];
  if (!profile) return null;
  const answers = {product};
  const sections = getSections(answers).filter(section => section.id !== 'intro'
    && visibleQuestions(section, getBacklogAnalyzed(answers), answers).length);
  const questions = sections.flatMap(section => visibleQuestions(section, getBacklogAnalyzed(answers), answers)).flatMap(q => [q, ...inlineQuestions(q), ...(q.benchmark ? [q.benchmark] : [])]).filter(q => q.type !== 'info');
  const survey = questions.flatMap(question => {
    if (question.benchmarkOnly || question.actionOnly) return [];
    if (['marketRussia', 'marketSber', 'clients', 'mau', 'dau', 'yau', 'dauMau', 'satellite', 'monitoring'].includes(question.id)) {
      return ['Знание ключевых метрик'];
    }
    if (question.id === 'upsell') return profile.metrics.filter(metric => mechanicLabels[metric.code]
      && applicable(metric) && Number(metric.value) < Number(metric.max_value)).map(metric => mechanicLabels[metric.code]);
    return surveyLabels[question.id] ? [surveyLabels[question.id]] : [];
  });
  const digital = digitalCodes.flatMap(code => {
    const metric = profile.metrics.find(item => item.code === code && applicable(item));
    return metric ? [code === 'mehaniki.cross_sell' ? 'Cross-sell во время оформления продукта (LossHunter)' : metric.name] : [];
  });
  if (profile.backlogAnalyzed && profile.metrics.some(metric => metric.code === 'hyp.discovery_40_backlog' && applicable(metric))) {
    digital.push('Discovery — проанализированный бэклог Jira/Сбертрек');
  }
  return {sectionCount: sections.length, survey: [...new Set(survey)], digital};
}

export function sectionCountText(count) {
  const remainder = count % 100;
  const word = remainder >= 11 && remainder <= 14 ? 'разделов'
    : count % 10 === 1 ? 'раздел' : count % 10 >= 2 && count % 10 <= 4 ? 'раздела' : 'разделов';
  return `${count} ${word}`;
}
