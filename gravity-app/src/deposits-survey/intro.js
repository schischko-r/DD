import {getBacklogAnalyzed, getSections, visibleQuestions, inlineQuestions, knownMechanics} from './questions.js';
import {productSurveyProfiles} from './survey-profiles.js';

const surveyLabels = {
  marketRussia: 'Объём целевого рынка в России', marketSber: 'Объём целевого рынка в Сбере',
  clients: 'Клиенты с продуктом', mau: 'MAU продукта', dau: 'DAU продукта', yau: 'YAU продукта', dauMau: 'DAU/MAU',
  satellite: 'Знание продуктов-спутников', monitoring: 'Знание отчётности в Навигаторе',
  qualityTools: 'Контроль качества данных (ККД)',
  attractConfigured: 'Отчетность и аналитика по привлечению', attractIncludes: 'Отчетность и аналитика по привлечению',
  attractAnalysis: 'Отчетность и аналитика по привлечению', churnConfigured: 'Отчетность и аналитика по оттоку',
  churnIncludes: 'Отчетность и аналитика по оттоку', churnAnalysis: 'Отчетность и аналитика по оттоку',
  usageConfigured: 'Отчётность по воронке использования', usageIncludes: 'Полнота отчёта по использованию',
  usageAnalysis: 'Анализ воронки использования',
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
const applicable = metric => metric && metric.is_applicabble_flg !== false && !metric.excluded_from_index
  && Number(metric.dd_calculation_flg) !== 0 && Number(metric.max_value) > 0;

const digitalSections = {
  attract: {id: 'funnels', title: 'Воронки'},
  goals: {id: 'goals', title: 'Цели'},
  mehaniki: {id: 'mechanics', title: 'Продуктовые механики'},
  hyp: {id: 'research', title: 'Исследования'},
  cx: {id: 'cx', title: 'Клиентский опыт'},
};

function groupItems(entries) {
  const groups = new Map();
  const seen = new Set();
  for (const {id, title, label} of entries) {
    if (seen.has(label)) continue;
    seen.add(label);
    if (!groups.has(id)) groups.set(id, {id, title, metrics: []});
    groups.get(id).metrics.push(label);
  }
  return [...groups.values()];
}

export function getIntroSummary(product) {
  const profile = productSurveyProfiles[product];
  if (!profile) return null;
  const answers = {product};
  const sections = getSections(answers).filter(section => section.id !== 'intro'
    && visibleQuestions(section, getBacklogAnalyzed(answers), answers).length);
  const questions = sections.flatMap(section => visibleQuestions(section, getBacklogAnalyzed(answers), answers)
    .flatMap(q => [q, ...inlineQuestions(q), ...(q.benchmark ? [q.benchmark] : [])])
    .map(q => ({...q, summarySection: {id: section.id, title: section.title}}))).filter(q => q.type !== 'info');
  const labelsForQuestion = question => {
    if (question.benchmarkOnly || question.actionOnly) return [];
    if (['marketRussia', 'marketSber', 'clients', 'mau', 'dau', 'yau', 'dauMau', 'satellite', 'monitoring'].includes(question.id)) {
      return ['Знание ключевых метрик'];
    }
    if (question.id === 'upsell') return (question.commentWhen || []).filter(option => !knownMechanics(question, answers).includes(option)).map(option => ({
      'Удержание клиентов': 'Механики удержания клиентов', 'Возврат клиентов': 'Механики возврата клиентов',
      'Допродажи (upsell)': 'Механики допродаж (Upsell)',
    }[option]));
    return surveyLabels[question.id] ? [surveyLabels[question.id]] : [];
  };
  const surveyEntries = questions.flatMap(question => labelsForQuestion(question)
    .map(label => ({...(['mechanics', 'crossSell'].includes(question.summarySection.id) ? {id: 'mechanics', title: 'Продуктовые механики'}
      : ['attract', 'churn', 'usage'].includes(question.summarySection.id) ? {id: 'funnels', title: 'Воронки'}
      : question.summarySection), label})));
  const survey = [...new Set(surveyEntries.map(entry => entry.label))];
  const digitalEntries = digitalCodes.flatMap(code => {
    const metric = profile.metrics.find(item => item.code === code && applicable(item));
    return metric ? [{...digitalSections[code.split('.')[0]],
      label: code === 'mehaniki.cross_sell' ? 'Cross-sell во время оформления продукта (LossHunter)' : metric.name}] : [];
  });
  if (getBacklogAnalyzed({product}) && profile.metrics.some(metric => metric.code === 'hyp.discovery_40_backlog' && applicable(metric))) {
    digitalEntries.push({...digitalSections.hyp, label: 'Discovery — бэклог Jira/SberTrack по ранее приложенной ссылке'});
  }
  const digital = digitalEntries.map(entry => entry.label);
  return {sectionCount: sections.length, survey, digital,
    surveyGroups: groupItems(surveyEntries), digitalGroups: groupItems(digitalEntries)};
}

export function sectionCountText(count) {
  const remainder = count % 100;
  const word = remainder >= 11 && remainder <= 14 ? 'разделов'
    : count % 10 === 1 ? 'раздел' : count % 10 >= 2 && count % 10 <= 4 ? 'раздела' : 'разделов';
  return `${count} ${word}`;
}
