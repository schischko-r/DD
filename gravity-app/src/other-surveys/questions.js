import {sections as productSections, getSections as productCatalogue, correctTypos, knownMechanics, indicatesPresence} from '../deposits-survey/questions.js';
import {otherTeamProfiles} from './other-team-profiles.js';
import {otherTeamSections, otherMetricApplicable} from './other-team-questions.js';
import {surveyTeamKind} from './teams.js';
import {applySegmentApplicability, segmentApplicability} from './segment-applicability.js';
import {hasMetricSource} from './metric-source.js';
import {getPreviousHistory} from './previous-history.js';
export {correctTypos, evidenceResponse, formatNumericAnswer, isOptionSelected, knownMechanics, showsOptionalComment, needsComment, needsReason, normalizeNumericAnswer, questionOptions, visibleQuestions, indicatesPresence} from '../deposits-survey/questions.js';
import {toggleOption as commonToggle} from '../deposits-survey/questions.js';
import {needsProof as commonNeedsProof, allowsMissingMetric as commonAllowsMissingMetric, inlineQuestions as commonInlineQuestions, hasAnswer as commonHasAnswer, hasEvidence as commonHasEvidence, needsEvidence as commonNeedsEvidence} from '../deposits-survey/questions.js';
const declinesReport = (q, a) => q.reportMonitoring && (a[q.id] === 'Нет' || Array.isArray(a[q.id]) && a[q.id].includes('Нет'));
const evidenceApplies = (q, a) => !q.inlineEvidence?.whenOption || (Array.isArray(a[q.id]) && a[q.id].includes(q.inlineEvidence.whenOption));
export const needsEvidence = (q, a = {}) => evidenceApplies(q, a) && !declinesReport(q, a) && commonNeedsEvidence(q, a);
export const hasEvidence = (q, a = {}) => !evidenceApplies(q, a) || declinesReport(q, a) || commonHasEvidence(q, a);
export const allowsMissingMetric = (q, a) => !q.hideUnknown && commonAllowsMissingMetric(q, a);
const emptyOptionalMetric = (q, a) => q.optionalMetric && !String(a[q.id] ?? '').trim() && a[`${q.id}Unknown`] !== true;
export function inlineQuestions(q, a) {
  if (q.type !== 'metricGroup') return commonInlineQuestions(q, a);
  if (!a) return q.inlineQuestions || [];
  return (q.inlineQuestions || []).filter(child => !emptyOptionalMetric(child, a));
}
export const needsProof = (q, a = {}) => !emptyOptionalMetric(q, a) && commonNeedsProof(q, a);
export function hasAnswer(q, a) {
  if (q.type === 'metricGroup') {
    return (q.inlineQuestions || []).every(child => hasAnswer(child, a))
      && (!q.inlineProof || hasMetricSource(q.inlineProof, a));
  }
  if (emptyOptionalMetric(q, a)) return true;
  const children = inlineQuestions(q, a);
  if (children.some(child => !hasAnswer(child, a))) return false;
  const strictValues = {...a};
  for (const field of [q, ...children]) if (field.hideUnknown) strictValues[`${field.id}Unknown`] = false;
  return commonHasAnswer(declinesReport(q, a) || !evidenceApplies(q, a) ? {...q, inlineEvidence: undefined} : q, strictValues);
}

export const CROSS_SELL_URL = 'https://losshunter.ru/showcase/crosssell/#screen=pult';
export const quarterlyAnalysisCodes = [];
export const getBacklogAnalyzed = (answers = {}) => Boolean(getPreviousHistory(answers.product)?.acceptedBacklogLinks?.length);
export function hasPerformanceDashboard(question, history) {
  const rows = {campaignCrPerformance: 57, campaignNpvPerformance: 58, campaignCltvPerformance: 59};
  if (history?.source?.sheet !== 'Кампейнинг' || !rows[question.id]) return false;
  return (history.rawAnswers?.[rows[question.id]]?.links || []).some(link =>
    /^https?:\/\/(?:navigator\.sigma\.sbrf\.ru\/gdash\/|qlik\.sigma\.sbrf\.ru\/)/i.test(link));
}
const firstProduct = '7fdb5658-795c-54e1-bc4a-0de761a9f33f¦Вклады+НС';
const commonGoals = productCatalogue({product:firstProduct}).find(s=>s.id==='goals');
const commonCrossSell = productSections.find(s=>s.id==='crossSell');
const commonModel = productCatalogue({product:firstProduct}).flatMap(s=>s.questions).find(q=>q.id==='churnModel');
const businessHints = {'Да':'По всем ключевым бизнес-метрикам автоматически приходят уведомления об отклонениях.', 'Частично':'Автоматические уведомления настроены только для части ключевых бизнес-метрик или отклонений.', 'Нет':'Автоматические уведомления об отклонениях ключевых бизнес-метрик не настроены.'};
const unit = profile => profile?.type === 'Сегмент' ? 'сегмент' : 'канал';
const withoutRoutingNotes = title => title
  .replace(/\s*\((?:только|возрастные\s*\+|доходные|Телемаркетинг|Колл-центр|Если ответ)[^)]*(?:\)|$)/gi, '')
  .replace(/\?\s*\./g, '?').trim();
const contextText = (text, sheet) => String(text).replaceAll('вашему продукту', sheet === 'Сегменты' ? 'вашему сегменту' : 'вашему каналу').replaceAll('вашего продукта', sheet === 'Сегменты' ? 'вашего сегмента' : 'вашего канала').replaceAll('моего продукта', sheet === 'Сегменты' ? 'моего сегмента' : 'моего канала').replaceAll('своего продукта', sheet === 'Сегменты' ? 'своего сегмента' : 'своего канала');
const copyFields = (q, sheet) => Object.fromEntries(
  ['description','hint','placeholder','detail','optionalCommentTitle','optionalCommentPlaceholder','reasonTitle','reasonPlaceholder'].filter(key=>typeof q[key]==='string')
    .map(key=>[key,correctTypos(contextText(q[key],sheet))]),
);
const uiQuestion = (question, sheet) => {
  const q = question.type === 'numeric' ? {...question,
    hint: question.hint || 'Введите число за последний доступный период', optionalCommentId: question.skipMetricSource ? undefined : `${question.id}Comment`,
    inlineProof: question.skipMetricSource ? undefined : {id: `${question.id}Source`, kind: 'metricSource', row: question.row, sheet: question.sheet || sheet,
      appearance: 'base', always: true, autoFocus: false, title: 'Где вы смотрите этот показатель?'}} : question;
  return {...q, sheet: q.sheet || sheet,
  ...copyFields(q,q.sheet||sheet),
  title: withoutRoutingNotes(correctTypos(contextText(q.title,q.sheet||sheet))).replace(/\bPO\b|РО/g, (q.sheet || sheet) === 'Сегменты' ? 'владельца сегмента' : 'владельца канала'),
  ...(q.options ? {options:q.options.map(v=>correctTypos(contextText(v,q.sheet||sheet)))} : {}),
  ...(q.knownOptions ? {knownOptions:q.knownOptions.map(correctTypos)} : {}),
  ...(q.previousOptions ? {previousOptions:q.previousOptions.map(correctTypos)} : {}),
  ...(q.optionMetricCodes ? {optionMetricCodes:Object.fromEntries(Object.entries(q.optionMetricCodes).map(([k,v])=>[correctTypos(k),v]))} : {}),
  ...(q.commentWhen ? {commentWhen:q.commentWhen.map(correctTypos)} : {}),
  ...(q.optionalCommentWhen ? {optionalCommentWhen:q.optionalCommentWhen.map(correctTypos)} : {}),
  ...(q.reasonWhen ? {reasonWhen:correctTypos(q.reasonWhen)} : {}),
  ...(q.hideWhenAnswer ? {hideWhenAnswer:{...q.hideWhenAnswer,value:correctTypos(q.hideWhenAnswer.value)}} : {}),
  ...(q.actionOption ? {actionOption:correctTypos(q.actionOption)} : {}),
  ...(q.dividerBefore ? {dividerBefore:correctTypos(q.dividerBefore)} : {}),
  ...(q.optionHints ? {optionHints:Object.fromEntries(Object.entries(q.optionHints).map(([key,value])=>[correctTypos(key),correctTypos(value)]))} : {}),
  ...(q.whenOption ? {whenOption:{...q.whenOption,option:correctTypos(q.whenOption.option)}} : {}),
  ...(q.inlineQuestions ? {inlineQuestions:q.inlineQuestions.map(child=>uiQuestion({...child, ...(child.type === 'numeric' ? {inlineNumericChild: true} : {})},q.sheet||sheet))} : {}),
  ...(q.inlineProof ? {inlineProof:{...q.inlineProof,...copyFields(q.inlineProof,q.sheet||sheet),...(q.inlineProof.title?{title:correctTypos(contextText(q.inlineProof.title,q.sheet||sheet))}:{}),...(q.inlineProof.whenAnswer?{whenAnswer:correctTypos(q.inlineProof.whenAnswer)}:{})}} : {}),
  ...(q.inlineEvidence ? {inlineEvidence:{...q.inlineEvidence,...copyFields(q.inlineEvidence,q.sheet||sheet),...(q.inlineEvidence.title?{title:correctTypos(contextText(q.inlineEvidence.title,q.sheet||sheet))}:{})}} : {}),
  ...(q.introInfo ? {introInfo:{...q.introInfo,...copyFields(q.introInfo,q.sheet||sheet),...(q.introInfo.title?{title:correctTypos(contextText(q.introInfo.title,q.sheet||sheet))}:{})}} : {}),
  ...(q.action ? {action:uiQuestion(q.action,q.sheet||sheet)} : {}),
  ...(q.benchmark ? {benchmark:uiQuestion(q.benchmark,q.sheet||sheet)} : {}),
  };
};
function withPreviousHistory(question, history) {
  if (!history) return question;
  let q = {...question};
  const previous = history.funnelElements[q.id];
  if (!q.benchmarkOnly && previous?.length) {
    q.previousOptions = previous.map(correctTypos).filter(option => q.options?.some(value => correctTypos(value) === option)
      && !(q.id === 'campaignReporting' && ['% триггерных коммуникаций', '% доставленных коммуникаций'].includes(option)));
    if (q.reportMonitoring && q.previousOptions.length) q.options = q.options.filter(option => option !== 'Нет');
  }
  if (q.id === 'qualityTools' && q.sheet === 'Data' && history.source.sheet === 'Лист1') {
    const previous = history.knownSubanswers?.qualityTools;
    const selected = (previous?.selectedOptions || []).map(correctTypos)
      .filter(option => q.options?.some(value => correctTypos(value) === option)
        && option !== 'Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе');
    if (selected.length) {
      q.previousOptions = selected;
      q.options = q.options.filter(option => option !== 'Не используем специальные инструменты — доверяем источнику');
    }
    if (previous?.links?.length) {
      q.evidenceAfterOptions = true;
      q.inlineEvidence = {id: 'qualityToolsReport', formatId: 'qualityToolsReportFormat', row: q.row, sheet: q.sheet,
        always: true, label: 'Источники контроля качества данных', previousTitle: 'Приложенные ранее ссылки:',
        previousLinks: [...previous.links]};
    }
  }
  if (q.id === 'qualityTools' && q.sheet === 'Кампейнинг' && history.source.sheet === 'Кампейнинг') {
    q.evidenceAfterOptions = true;
    q.inlineEvidence = {id: 'qualityToolsReport', formatId: 'qualityToolsReportFormat', row: q.row, sheet: q.sheet,
      always: true, title: 'Пожалуйста, приложите ссылки на дашборды',
      whenOption: 'Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе',
      formats: [{value: 'link', label: 'Ссылки на дашборды'}, {value: 'unknown', label: 'Не могу предоставить ссылку'}],
      label: 'Источники контроля качества данных', previousTitle: 'Приложенные ранее ссылки:'};
    const previous = history.knownSubanswers?.qualityTools;
    // This question's two marks were entered in F (comments), rather than G.
    const misplaced = (previous?.sourceCells || []).filter(cell =>
      ['F44', 'F46'].includes(cell.comment?.cell) && cell.comment.value === 1).map(cell => cell.answer.value);
    const selected = [...new Set([...(previous?.selectedOptions || []), ...misplaced].map(correctTypos))]
      .filter(option => q.options?.some(value => correctTypos(value) === option));
    if (selected.length) {
      q.previousOptions = selected;
      q.options = q.options.filter(option => option !== 'Не используем специальные инструменты — доверяем источнику');
    }
  }
  const links = history.reportLinks[q.inlineEvidence?.id];
  if (links?.length) q.inlineEvidence = {...q.inlineEvidence, previousLinks: links};
  if (q.id === 'otherMechanics') {
    const historical = history.mechanics.map(correctTypos);
    q.knownOptions = [...new Set([...(q.knownOptions || []), ...Object.keys(q.optionMetricCodes).filter(option=>historical.includes(correctTypos(option)))])];
    if (q.sheet === 'Data' && history.source.sheet === 'Лист1') {
      q.knownOptions = q.knownOptions.filter(option => q.optionMetricCodes[option] !== 'mehaniki.stimulirovanie_klienta');
    }
    q.inlineQuestions = q.inlineQuestions.filter(child => !q.knownOptions.includes(child.whenOption?.option));
  }
  return q;
}
export function toggleOption(current, option) {
  if (option === 'Нет') return ['Нет'];
  return commonToggle(current.filter(v => v !== 'Нет'), option);
}
export function shouldShowCrossSellReminder(answers) {
  const p=otherTeamProfiles[answers.product], m=p?.metrics.find(m=>m.code==='mehaniki.cross_sell');
  return Boolean(otherMetricApplicable(m)&&m.value>0&&m.value<m.max_value&&answers.crossSellAfter!=='Нет');
}
export function shouldShowMechanicsMonitoring(profile, history, questions, answers = {}) {
  const mechanics = questions.find(q => q.id === 'otherMechanics');
  const selected = answers.otherMechanics;
  if (!mechanics || !Array.isArray(selected) || selected.length !== 1 || selected[0] !== 'Не настроены дополнительные механики') return true;
  const mappings = mechanics.optionMetricCodes || {};
  const historical = (history?.mechanics || []).map(correctTypos);
  if (mechanics.knownOptions?.length || Object.keys(mappings).some(option => historical.includes(correctTypos(option)))) return true;
  const configuredCodes = new Set([...Object.values(mappings), 'mehaniki.nalichie_sobstvennyh_mehanik', 'mehaniki.cross_sell']);
  if (profile.metrics.some(metric => configuredCodes.has(metric.code) && otherMetricApplicable(metric) && Number(metric.value) > 0)) return true;
  if (questions.some(q => q.id === 'crossSellAfter') && answers.crossSellAfter === 'Да') return true;
  if (questions.some(q => q.id === 'otherOwnMechanics') && answers.otherOwnMechanics !== 'Нет') return true;
  return false;
}
export function getSections(answers={}) {
  const profile=otherTeamProfiles[answers.product];
  const intro={...productSections[0],questions:productSections[0].questions.map(q=>q.id==='product'?{...q,title:`Выберите ${surveyTeamKind==='segments'?'сегмент':'канал'}`} : q)};
  if (!profile) return [intro];
  const history=getPreviousHistory(profile.teamId);
  const discovery=productSections.find(s=>s.id==='research').questions.find(q=>q.id==='discovery');
  const support=productSections.find(s=>s.id==='priorities').questions.find(q=>q.id==='support');
  let catalogue=otherTeamSections(profile,{intro,discovery,support:{id:'support',title:'Поддержка',description:'Какие инструменты и поддержка помогут команде.',questions:[{...support,title:support.title.replace('продукта',`${unit(profile)}а`)}]}});
  const metricsIndex=catalogue.findIndex(s=>s.id==='metrics');
  catalogue.splice(metricsIndex>=0?metricsIndex+1:1,0,{...commonGoals,description:`Где команда отслеживает цели своего ${profile.type==='Сегмент'?'сегмента':'канала'}.`});
  if (profile.name === 'Персональная рекомендация') {
    const alertsIndex = catalogue.findIndex(section => section.id === 'alerts');
    if (alertsIndex >= 0) {
      const [alerts] = catalogue.splice(alertsIndex, 1);
      catalogue.splice(catalogue.findIndex(section => section.id === 'goals'), 0, alerts);
    }
  }
  const cross=profile.metrics.find(m=>m.code==='mehaniki.cross_sell');
  if (otherMetricApplicable(cross)&&Number(cross.value)<cross.max_value) {
    const index=catalogue.findIndex(s=>s.id==='mechanics');
    catalogue.splice(index>=0?index+1:catalogue.findIndex(s=>s.id==='research'),0,{...commonCrossSell,questions:commonCrossSell.questions.filter(q=>q.id==='crossSellAfter').map(q=>({...q,title:`Настроена ли у вас механика Cross-sell после оформления ${profile.type==='Сегмент'?'продуктов сегмента':'продукта в канале'}?`,introInfo:{...commonCrossSell.questions[0],description:commonCrossSell.questions[0].description.replace('продукту',profile.type==='Сегмент'?'сегменту':'каналу')}}))});
  }
  const churn=catalogue.find(s=>s.id==='churn');
  if (churn && profile.type==='Сегмент') churn.questions.splice(Math.max(0,churn.questions.findIndex(q=>q.id==='churnAnalysis')),0,{...commonModel,title:'Есть ли у вас модель оттока клиентов сегмента?',hint:'Модель оттока клиентов сегмента — это ML-модель, которая оценивает вероятность оттока клиента в ближайшие X дней. На основе прогноза формируются списки или витрины клиентов с высоким риском оттока для передачи в кампейнинг или менеджеру и запуска мер удержания.'});
  if (profile.type === 'Канал') catalogue = catalogue.map(section => section.id === 'campaignPerformance'
    ? {...section, questions: section.questions.filter(question => !hasPerformanceDashboard(question, history))} : section);
  catalogue = applySegmentApplicability(catalogue, profile.teamId);
  const visibleSections = catalogue.map(section=>({...section,...copyFields(section,profile.sheet),title:correctTypos(section.title),questions:section.questions.filter(q=>!getBacklogAnalyzed(answers)||!['discovery','backlog'].includes(q.id)).map(q=>{
    if (q.type==='numeric') q={...q,hint:q.hint||'Введите число за последний доступный период',optionalCommentId:`${q.id}Comment`,inlineProof:{id:`${q.id}Source`,kind:'metricSource',row:q.row,sheet:q.sheet||profile.sheet,appearance:'base',always:true,autoFocus:false,title:'Где вы смотрите этот показатель?'}};
    if (q.id==='alerts') q={...q,optionHints:businessHints,optionalCommentId:'alertsComment',optionalCommentWhen:['Да','Частично'],optionalCommentRequired:true,optionalCommentTitle:'Что настроено и как?'};
    if (q.id==='uxAlerts') q={...q,optionalCommentId:'uxAlertsComment',optionalCommentWhen:['Да','Частично'],optionalCommentRequired:true,optionalCommentTitle:'Что настроено и как?'};
    if (q.id==='systemAlerts') q={...q,sectionDescription:'Системный сбой — это техническая проблема в работе канала: недоступность сервиса, ошибки или задержки при выполнении операций, сбои API и интеграций. Оповещения помогают команде быстро узнать о таких проблемах.'};
    if (q.id==='otherMechanics') q={...q,commentId:'otherMechanicsComment',commentWhen:Object.keys(q.optionMetricCodes||{})};
    if (q.id==='discovery') q={...q,inlineQuestions:q.inlineQuestions.map(field=>({...field,sheet:profile.sheet,row:q.row+6,inlineProof:{...field.inlineProof,sheet:profile.sheet,row:q.row+6}}))};
    q = withPreviousHistory(q,history);
    if (q.id === 'otherMechanics' && segmentApplicability[profile.teamId]?.excludedMetricCodes.length
      && Object.keys(q.optionMetricCodes || {}).every(option => (q.knownOptions || []).includes(option))) return null;
    return uiQuestion(q,profile.sheet);
  }).filter(Boolean)})).filter(s=>s.questions.length);
  if (shouldShowMechanicsMonitoring(profile, history, visibleSections.flatMap(section => section.questions), answers)) return visibleSections;
  return visibleSections.map(section => ({...section, questions: section.questions.filter(q => q.id !== 'mechanicsMonitoring')}))
    .filter(section => section.questions.length);
}
export const sections = [productSections[0]];
