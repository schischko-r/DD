import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {otherTeamProfiles} from './other-team-profiles.js';
import {otherTeamSections} from './other-team-questions.js';
import {enabledTeams} from './teams.js';
import {correctTypos, getSections, visibleQuestions, getBacklogAnalyzed, inlineQuestions, hasAnswer, needsProof, needsEvidence, needsComment, needsReason, showsOptionalComment} from './questions.js';
import {buildSurveyResult} from './result.js';
import {metricSourceEvidence} from './metric-source.js';
import {previousBacklogs} from '../deposits-survey/previous-backlogs.js';

const report = JSON.parse(readFileSync(new URL('../../public/report-data.json', import.meta.url), 'utf8'));
const others = report.products.filter(team => team.type !== 'Продукт');
const UNKNOWN = 'Затрудняюсь ответить';
const rawText = '  Описание команды\nДополнительная строка  ';
const rawLinks = '  example.ru/report?value=1  \nhttps://example.com/second\n';
const route = answers => getSections(answers).flatMap(section => visibleQuestions(section, getBacklogAnalyzed(answers), answers));
const catalogue = answers => getSections(answers).flatMap(section => section.questions);
const numericCatalogue = answers => catalogue(answers).flatMap(q=>[q,...(q.inlineQuestions||[])]).filter(q=>q.type==='numeric');

function fill(question, answers) {
  if (question.id === 'name' || question.id === 'product' || question.type === 'info') return;
  if (question.type==='metricGroup') {if(question.optionalCommentId) answers[question.optionalCommentId]=rawText; const proof=question.inlineProof; if(proof) {answers[proof.id]='Дашборд в Навигаторе'; answers[`${proof.id}Link`]=rawLinks;} for(const child of inlineQuestions(question,answers)) fill(child,answers); return;}
  if (!(question.id in answers)) {
    if (question.type === 'numeric') answers[question.id] = answers[`${question.id}Unknown`] ? '' : question.allowDecimal ? '120,5' : '120';
    else if (question.type === 'links') {answers[question.id] = rawLinks; answers[`${question.id}Format`] = 'link';}
    else if (question.type === 'radio') answers[question.id] = question.options.find(option => option.startsWith('Да')) || question.options[0];
    else if (question.type === 'multi') answers[question.id] = [question.options.find(option => !/Свой вариант|Что-то ещ[её]|^Другое$/.test(option) && option !== UNKNOWN && !question.knownOptions?.includes(option)) || question.options[0]];
    else answers[question.id] = rawText;
  }
  if (needsComment(question, answers)) answers[question.commentId] = rawText;
  if (needsReason(question, answers)) answers[question.reasonId] = rawText;
  if (showsOptionalComment(question, answers)) answers[question.optionalCommentId] = rawText;
  if ((Array.isArray(answers[question.id]) ? answers[question.id] : [answers[question.id]]).some(option => /Свой вариант|Что-то ещ[её]|^Другое$/.test(String(option)))) answers[`${question.id}Other`] = rawText;
  if (needsProof(question, answers)) {
    const proof = question.inlineProof;
    if (proof.kind === 'metricSource') {answers[proof.id] = 'Дашборд в Навигаторе'; answers[`${proof.id}Link`] = rawLinks;}
    else answers[proof.id] = proof.kind === 'backlog' ? 'jira.sberbank.ru/browse/DA-123' : rawText;
  }
  if (needsEvidence(question, answers)) {
    const evidence = question.inlineEvidence;
    if (evidence.previousLinks?.length) answers[`${evidence.id}Correction`] = 'edit';
    answers[evidence.formatId] = evidence.formats?.[0]?.value || 'link';
    answers[evidence.id] = rawLinks;
  }
  if (question.backlogTypeQuestion) fill(question.backlogTypeQuestion, answers);
  if (question.id === 'discovery' && question.options.some(option => /%/.test(option))) {
    answers.discoveryBacklogType = 'Собственный бэклог в Jira/SberTrack';
    answers.backlog = '  jira.sberbank.ru/browse/DA-123  \n';
  }
  for (const child of inlineQuestions(question, answers)) fill(child, answers);
}
function completed(team, overrides = {}) {
  const answers = {name: rawText, product: team.id, unit: team.unit, ...overrides};
  for (let i = 0; i < 3; i++) for (const question of route(answers)) fill(question, answers);
  return answers;
}

test('all 16 channels and segments are enabled with their exact DDI baselines', () => {
  assert.equal(others.length, 16);
  assert.equal(Object.keys(otherTeamProfiles).length, 16);
  assert.deepEqual(new Set(others.map(team => team.id)), new Set(Object.keys(otherTeamProfiles)));
  const sheets = new Set();
  for (const team of others) {
    assert.ok(enabledTeams.some(item => item.id === team.id), team.name);
    const profile = otherTeamProfiles[team.id];
    sheets.add(profile.sheet);
    assert.equal(profile.period, team.period);
    assert.deepEqual(profile.metrics, team.metrics.flatMap(block => block.metrics || []).map(metric => ({code: metric.code, name: metric.name, value: metric.value, max_value: metric.max_value, dd_calculation_flg: metric.dd_calculation_flg, is_applicabble_flg: metric.is_applicabble_flg, excluded_from_index: metric.excluded_from_index})), team.name);
  }
  assert.deepEqual(sheets, new Set(['Сегменты', 'Каналы Phigital', 'Каналы Digital', 'Data', 'Кампейнинг']));
});

test('all other team routes finish and preserve raw inputs, links, source metadata and baseline scores', () => {
  for (const team of others) {
    const answers = completed(team);
    for (const q of route(answers)) assert.equal(hasAnswer(q, answers), true, `${team.name}: ${q.id}`);
    const result = buildSurveyResult(answers, getBacklogAnalyzed(answers), '2026-10-14T00:00:00Z');
    assert.equal(result.respondent.name, rawText);
    assert.equal(result.team.id, team.id);
    assert.equal(result.result.baselinePeriod, team.period);
    assert.equal(result.result.metrics.length, otherTeamProfiles[team.id].metrics.length);
    assert.ok(result.result.points <= result.result.maxPoints, team.name);
    for (const metric of result.result.metrics) {
      const baseline = otherTeamProfiles[team.id].metrics.find(item => item.code === metric.code);
      assert.equal(metric.baselineValue, baseline.value, `${team.name}: ${metric.code}`);
      assert.equal(metric.maxValue, baseline.max_value);
      if (metric.source === 'ddi_baseline') assert.equal(metric.value, baseline.value);
    }
    const active = route(answers).flatMap(q => [q, ...inlineQuestions(q, answers)]);
    for (const q of active) {
      if (!['info','metricGroup'].includes(q.type)) assert.ok(q.id in result.answers, `${team.name}: missing ${q.id}`);
      if (showsOptionalComment(q, answers)) assert.equal(result.answers[q.optionalCommentId], rawText);
      if (needsEvidence(q, answers)) assert.equal(result.answers[q.inlineEvidence.id], rawLinks);
      if (needsProof(q, answers) && q.inlineProof.kind === 'metricSource') {
        assert.equal(result.answers[`${q.inlineProof.id}Link`], rawLinks);
        assert.equal(result.questionSources[q.inlineProof.id].sheet, q.sheet);
      }
    }

  }
});

test('numeric metrics require two independent answers and preserve unknowns and optional comments', () => {
  for (const team of others) for (const q of numericCatalogue({product: team.id})) {
    const closedPeriod=['campaignTriggerShare','campaignDeliveredShare','campaignT2m','campaignSuccessfulPilotShare','campaignCrPerformance','campaignNpvPerformance','campaignCltvPerformance'].includes(q.id);
    assert.equal(q.hint, ['channelCalls','channelFcr','outgoingTraffic','salesCr'].includes(q.id) ? 'Введите число за последний квартал' : closedPeriod ? 'Введите число за последний закрытый период' : 'Введите число за последний доступный период');
    assert.ok(q.unit, `${team.name}: ${q.id} unit`);
    if(q.skipMetricSource) {assert.ok(q.sharedSourceId); assert.equal(q.inlineProof,undefined); continue;}
    assert.equal(q.inlineProof?.kind, 'metricSource');
    if(q.optionalMetric) {assert.equal(hasAnswer(q,{}),true,'Optional platform may remain empty'); continue;}
    assert.equal(hasAnswer(q, {[q.id]: '120'}), false);
    assert.equal(hasAnswer(q, {[`${q.id}Unknown`]: true}), false);
    const unknown = {[`${q.id}Unknown`]: true, [q.inlineProof.id]: UNKNOWN};
    if(q.hideUnknown) {assert.equal(hasAnswer(q,unknown),false,'Stale Unknown cannot bypass numeric knowledge'); continue;}
    assert.equal(hasAnswer(q, unknown), true);
    assert.equal(hasAnswer(q, {...unknown, [q.id]: '120'}), false);
    const answers = completed(team, unknown);
    const result = buildSurveyResult(answers);
    assert.equal(result.answers[q.id], null);
    assert.equal(result.answers[`${q.id}Unknown`], true);
    assert.equal(result.answers[q.optionalCommentId], rawText);
  }
});

test('goal forecasts, factor analysis and links are conditional on the same monitoring answer', () => {
  for (const team of others) {
    const answers = completed(team);
    const goals = catalogue(answers).find(q => q.id === 'goalsMonitoring');
    assert.ok(goals, team.name);
    assert.equal(inlineQuestions(goals, answers).length, 3);
    for (const child of inlineQuestions(goals, answers)) {
      const missing = {...answers}; delete missing[child.id];
      assert.equal(hasAnswer(goals, missing), false, `${team.name}: ${child.id}`);
    }
    const negative = {...answers, goalsMonitoring: 'Нет'};
    assert.equal(hasAnswer(goals, negative), true);
    const result = buildSurveyResult(negative);
    for (const id of ['goalsForecast', 'goalsFactorAnalysis', 'goalsDashboards', 'goalsDashboardsFormat']) {
      assert.ok(!(id in result.answers)); assert.ok(!(id in result.questionSources));
    }
  }
});

test('reporting options respect previous existence and No hides completeness while quarterly analysis remains', () => {
  for (const team of others) {
    const answers = completed(team);
    for (const q of catalogue(answers).filter(q => q.id.endsWith('Configured'))) {
      const metric = otherTeamProfiles[team.id].metrics.find(item => item.code === q.metricCode);
      assert.ok(metric, `${team.name}: ${q.id} code`);
      assert.ok(!q.options.some(option => option.startsWith('Не релевантно')));
      assert.equal(q.options.includes('Нет'), Number(metric.value) === 0);
      if (Number(metric.value) > 0) assert.match(q.title, /^С какой регулярностью/);
      else {
        const negative = {...answers, [q.id]: 'Нет'};
        const prefix = q.id.replace(/Configured$/, '');
        assert.ok(!route(negative).some(item => item.id === `${prefix}Includes` && !item.benchmarkOnly));
        const analysis = catalogue(answers).find(item => item.id === `${prefix}Analysis`);
        if (analysis) assert.ok(route(negative).some(item => item.id === analysis.id));
        const result = buildSurveyResult(negative);
        if (catalogue(answers).some(item => item.id === `${prefix}Includes` && !item.benchmarkOnly)) assert.ok(!(`${prefix}Includes` in result.answers));
      }
    }
  }
});

test('Discovery is not suppressed solely by a full score without an accepted Jira/SberTrack backlog', () => {
  for (const team of others) {
    const profile = otherTeamProfiles[team.id];
    const metric = profile.metrics.find(item => item.code === 'hyp.discovery_40_backlog');
    const applicable = metric && metric.is_applicabble_flg !== false && !metric.excluded_from_index && Number(metric.dd_calculation_flg) !== 0 && metric.max_value > 0;
    assert.equal(catalogue({product: team.id}).some(q => q.id === 'discovery'), Boolean(applicable && !previousBacklogs[team.id] && !['Молодежь','Рабочий возраст','Top Affluent','Персональная рекомендация','Единый личный кабинет (ЕЛК)'].includes(team.name)), team.name);
  }
});

test('other team questions use their own worksheet and never invent product history or non-applicable Cross-sell', () => {
  for (const team of others) {
    const profile = otherTeamProfiles[team.id];
    const all = catalogue({product: team.id}).flatMap(q => [q, ...inlineQuestions(q)]);
    for (const q of all) {
      if (['name', 'product'].includes(q.id)) continue;
      assert.ok(!/вашего продукта|вашему продукту|вашем продукте/.test(q.title), `${team.name}: ${q.title}`);

      if (q.row !== null) assert.equal(q.sheet, profile.sheet, `${team.name}: ${q.id} worksheet`);
    }
    const cross = profile.metrics.filter(m => /cross_sell|crosssell/i.test(m.code));
    if (!cross.some(m => m.is_applicabble_flg !== false && !m.excluded_from_index && Number(m.dd_calculation_flg) !== 0 && Number(m.value) < Number(m.max_value))) assert.ok(!all.some(q => q.id === 'crossSellAfter'), team.name);
  }
});

test('segment churn model explains client risk and retention handoff without changing product or channel routes', async () => {
  const {getSections: productCatalogue} = await import('../deposits-survey/questions.js');
  const productModel = productCatalogue({product: '7fdb5658-795c-54e1-bc4a-0de761a9f33f¦Вклады+НС'}).flatMap(section => section.questions).find(q => q.id === 'churnModel');
  assert.match(productModel.hint, /факторная модель/);
  assert.match(productModel.hint, /клиент перестанет пользоваться продуктом/);
  for (const team of others) {
    const model = catalogue({product: team.id}).find(q => q.id === 'churnModel');
    if (team.type !== 'Сегмент') {
      assert.equal(model, undefined, team.name);
      continue;
    }
    assert.ok(model, team.name);
    assert.match(model.hint, /ML-модель/);
    assert.match(model.hint, /вероятность оттока клиента в ближайшие X дней/);
    assert.match(model.hint, /списки или витрины клиентов с высоким риском оттока/);
    assert.match(model.hint, /кампейнинг или менеджеру/);
    assert.match(model.hint, /мер удержания/);
    assert.doesNotMatch(model.hint, /перестанет пользоваться продуктом|снижение активности/);
    assert.deepEqual(model.inlineEvidence, productModel.inlineEvidence);
    assert.equal(hasAnswer(model, {churnModel: 'Да'}), false);
    assert.equal(hasAnswer(model, {churnModel: 'Да', churnModelReportFormat: 'link', churnModelReport: rawLinks}), true);
    const negative = completed(team, {churnModel: 'Нет', churnModelReportFormat: 'link', churnModelReport: rawLinks});
    assert.equal(needsEvidence(model, negative), false);
    const result = buildSurveyResult(negative, getBacklogAnalyzed(negative));
    assert.equal(result.answers.churnModel, 'Нет');
    for (const id of ['churnModelReport', 'churnModelReportFormat']) {
      assert.ok(!(id in result.answers));
      assert.ok(!(id in result.questionSources));
    }
  }
});

test('scoring applicability preserves positive-max mechanics despite historical non-relevant comments', async () => {
  const {getPreviousHistory} = await import('./previous-history.js');
  for (const team of others) {
    const profile = otherTeamProfiles[team.id];
    const raw = otherTeamSections(profile).flatMap(s => s.questions).find(q => q.id === 'otherMechanics');
    const current = catalogue({product: team.id}).find(q => q.id === 'otherMechanics');
    if (team.name === 'Дети') {assert.equal(current, undefined, 'Explicit Children exception hides mechanics screen'); continue;}
    const rawMonitoring = otherTeamSections(profile).flatMap(s => s.questions).some(q => q.id === 'mechanicsMonitoring');
    assert.equal(catalogue({product: team.id}).some(q => q.id === 'mechanicsMonitoring'), rawMonitoring, `${team.name}: monitoring unchanged`);
    assert.equal(Boolean(current), Boolean(raw), `${team.name}: scoring decides mechanics presence`);
    if (raw) {
      assert.deepEqual(current.optionMetricCodes, Object.fromEntries(Object.entries(raw.optionMetricCodes).map(([option, code]) => [correctTypos(option), code])), `${team.name}: history cannot override applicability`);
      for (const code of Object.values(current.optionMetricCodes)) {
        const metric = profile.metrics.find(metric => metric.code === code);
        assert.ok(metric.max_value > 0, `${team.name}: ${code} positive maximum`);
      }
    }
  }

});

test('Children mechanics screen and all stale subordinate answers stay out of route and current export', () => {
  const team = others.find(team => team.name === 'Дети');
  const original = otherTeamSections({...otherTeamProfiles[team.id], name: 'Молодежь'}).flatMap(section => section.questions).find(q => q.id === 'otherMechanics');
  const fields = [original, ...inlineQuestions(original)];
  const stale = {otherMechanics: original.options.filter(option => original.optionMetricCodes[option]), otherMechanicsOther: 'Старое пояснение', otherMechanicsComment: 'Старый комментарий', mechanicsMonitoring: 'Старые метрики мониторинга'};
  for (const field of fields.slice(1)) {
    stale[field.id] = field.options ? [field.options[0]] : 'Старый ответ';
    stale[`${field.id}Other`] = 'Старое пояснение';
  }
  const answers = completed(team, stale);
  const questions = catalogue(answers).flatMap(q => [q, ...inlineQuestions(q)]);
  for (const field of fields) assert.ok(!questions.some(q => q.id === field.id), field.id);
  assert.ok(!questions.some(q => q.id === 'mechanicsMonitoring'), 'Children monitoring question is excluded');
  assert.ok(questions.some(q => q.id === 'churnModel'), 'Independent churn model stays available');
  const result = buildSurveyResult(answers, getBacklogAnalyzed(answers));
  for (const id of Object.keys(stale)) {
    assert.ok(!(id in result.answers), id);
    assert.ok(!(id in result.questionSources), id);
    assert.ok(!(id in result.questionRows), id);
  }
  for (const code of [...Object.values(original.optionMetricCodes), 'mehaniki.monitoring_mehanik']) {
    const baseline = otherTeamProfiles[team.id].metrics.find(metric => metric.code === code);
    const metric = result.result.metrics.find(metric => metric.code === code);
    assert.equal(metric.value, baseline.value, code);
    assert.equal(metric.maxValue, baseline.max_value, code);
    assert.equal(metric.source, 'ddi_baseline', code);
  }
});

test('monitoring hides only an explicit absence without confirmed mechanics and restores for other answers', async () => {
  const {shouldShowMechanicsMonitoring} = await import('./questions.js');
  const {getPreviousHistory} = await import('./previous-history.js');
  const absent = {otherMechanics: ['Не настроены дополнительные механики']};
  for (const team of others) {
    const profile = otherTeamProfiles[team.id];
    const existing = catalogue({product: team.id});
    const actual = existing.find(q => q.id === 'otherMechanics');
    const mechanics = {id: 'otherMechanics', optionMetricCodes: {'Удержание клиентов': 'mehaniki.uderzhanie_klientov'}, knownOptions: []};
    const emptyProfile = {...profile, metrics: [{code: 'mehaniki.uderzhanie_klientov', value: 0, max_value: 1, dd_calculation_flg: 1}]};
    assert.equal(shouldShowMechanicsMonitoring(emptyProfile, {mechanics: []}, [mechanics], absent), false, `${team.name}: explicit absence`);
    for (const answer of [undefined, [], [UNKNOWN], ['Удержание клиентов'], ['Что-то еще? Напишите']]) {
      assert.equal(shouldShowMechanicsMonitoring(emptyProfile, {mechanics: []}, [mechanics], {otherMechanics: answer}), true, `${team.name}: ambiguous or positive answer`);
    }
    assert.equal(shouldShowMechanicsMonitoring(emptyProfile, {mechanics: ['Удержание клиентов']}, [mechanics], absent), true);
    assert.equal(shouldShowMechanicsMonitoring(emptyProfile, {}, [{...mechanics, knownOptions: ['Удержание клиентов']}], absent), true);
    assert.equal(shouldShowMechanicsMonitoring({...emptyProfile, metrics: [{...emptyProfile.metrics[0], value: 0.5}]}, {}, [mechanics], absent), true);
    for (const own of [undefined, UNKNOWN, 'Да']) assert.equal(shouldShowMechanicsMonitoring(emptyProfile, {}, [mechanics, {id: 'otherOwnMechanics'}], {...absent, otherOwnMechanics: own}), true);
    assert.equal(shouldShowMechanicsMonitoring(emptyProfile, {}, [mechanics, {id: 'otherOwnMechanics'}], {...absent, otherOwnMechanics: 'Нет'}), false);
    assert.equal(shouldShowMechanicsMonitoring(emptyProfile, {}, [mechanics, {id: 'crossSellAfter'}], {...absent, crossSellAfter: 'Да'}), true);
    if (team.name === 'Дети') assert.ok(!existing.some(q => q.id === 'mechanicsMonitoring'));
    else if (actual) assert.equal(shouldShowMechanicsMonitoring(profile, getPreviousHistory(team.id), existing, absent), true, `${team.name}: prior mechanics make absence additional only`);
  }
});

test('hidden monitoring ignores stale answers, preserves baseline and returns when a mechanic is selected', async () => {
  const {getPreviousHistory} = await import('./previous-history.js');
  const team = others.find(team => team.name === 'Колл-центр');
  const profile = otherTeamProfiles[team.id];
  const history = getPreviousHistory(team.id);
  const originalMetrics = profile.metrics;
  const originalMechanics = history.mechanics;
  try {
    profile.metrics = originalMetrics.map(metric => metric.code.startsWith('mehaniki.') ? {...metric, value: 0, ...(metric.code === 'mehaniki.monitoring_mehanik' ? {max_value: 0.25, is_applicabble_flg: true, dd_calculation_flg: 1, excluded_from_index: false} : {})} : metric);
    if (!profile.metrics.some(metric => metric.code === 'mehaniki.monitoring_mehanik')) profile.metrics.push({code: 'mehaniki.monitoring_mehanik', name: 'Мониторинг механик', value: 0, max_value: 0.25, is_applicabble_flg: true, dd_calculation_flg: 1});
    history.mechanics = [];
    const negative = completed(team, {otherMechanics: ['Не настроены дополнительные механики'], otherOwnMechanics: 'Нет', mechanicsMonitoring: 'Старый мониторинг'});
    assert.ok(!catalogue(negative).some(q => q.id === 'mechanicsMonitoring'));
    const result = buildSurveyResult(negative, getBacklogAnalyzed(negative));
    for (const object of [result.answers, result.questionSources, result.questionRows]) assert.ok(!('mechanicsMonitoring' in object));
    const metric = result.result.metrics.find(metric => metric.code === 'mehaniki.monitoring_mehanik');
    assert.equal(metric.value, 0); assert.equal(metric.baselineValue, 0); assert.equal(metric.source, 'ddi_baseline');
    const q = catalogue(negative).find(q => q.id === 'otherMechanics');
    const positive = completed(team, {...negative, otherMechanics: [Object.keys(q.optionMetricCodes)[0]]});
    assert.ok(catalogue(positive).some(q => q.id === 'mechanicsMonitoring'));
    assert.equal(buildSurveyResult(positive, getBacklogAnalyzed(positive)).answers.mechanicsMonitoring, 'Старый мониторинг');
    const unknown = completed(team, {...negative, otherMechanics: [UNKNOWN]});
    assert.ok(catalogue(unknown).some(q => q.id === 'mechanicsMonitoring'));
  } finally {
    profile.metrics = originalMetrics;
    history.mechanics = originalMechanics;
  }
});

test('quarterly action pool exports raw evidence and synthetic action metadata only when selected', () => {
  for (const team of others) for (const q of catalogue({product: team.id}).filter(q => q.action)) {
    const evidence = q.action.inlineEvidence;
    const positive = completed(team, {[q.id]: [q.actionOption], [evidence.formatId]: 'jira', [evidence.id]: rawLinks});
    // fill() uses the first accepted evidence format; all links remain exactly as entered.
    positive[evidence.formatId] = 'jira'; positive[evidence.id] = rawLinks;
    assert.equal(hasAnswer(q, positive), true);
    const result = buildSurveyResult(positive);
    assert.equal(result.answers[q.action.id], 'Да');
    assert.equal(result.answers[evidence.id], rawLinks);
    assert.equal(result.questionSources[evidence.id].sheet, otherTeamProfiles[team.id].sheet);
    const negative = completed(team, {...positive, [q.id]: [q.options.includes(UNKNOWN) ? UNKNOWN : 'Не проводился']});
    const hidden = (() => {try {return buildSurveyResult(negative);} catch (error) {throw new Error(`${team.name}: ${q.id}: ${route(negative).filter(item => !hasAnswer(item, negative)).map(item => item.id).join(', ')}: ${error.message}`);}})();
    assert.equal(hidden.answers[q.action.id], 'Нет');
    assert.ok(!(evidence.id in hidden.answers)); assert.ok(!(evidence.formatId in hidden.answers));
  }
});

test('all metric source branches export active raw fields and exclude hidden links and comments', () => {
  for (const team of others) {
    const q = numericCatalogue({product: team.id})[0];
    if (!q) continue;
    const proof = q.inlineProof;
    assert.equal(proof.kind, 'metricSource');
    for (const [source, format] of [['Дашборд в Навигаторе', undefined], ['Собственная отчетность', 'link'], ['Собственная отчетность', 'excel'], ['Собственная отчетность', 'unavailable'], ['Свой вариант ответа', undefined], ['Запрос у аналитиков', undefined], [UNKNOWN, undefined]]) {
      const answers = completed(team);
      Object.assign(answers, {[proof.id]: source, [`${proof.id}Link`]: rawLinks, [`${proof.id}Format`]: format, [`${proof.id}Other`]: rawText, [`${proof.id}LinkComment`]: rawText});
      const result = buildSurveyResult(answers);
      assert.equal(result.answers[proof.id], source);
      const linkActive = source === 'Дашборд в Навигаторе' || source === 'Собственная отчетность' && format === 'link';
      assert.equal(`${proof.id}Link` in result.answers, linkActive, `${team.name}: ${source}/${format}`);
      if (linkActive) assert.equal(result.answers[`${proof.id}Link`], rawLinks);
      assert.equal(`${proof.id}Other` in result.answers, source === 'Свой вариант ответа');
      if (source === 'Свой вариант ответа') assert.equal(result.answers[`${proof.id}Other`], rawText);
      assert.equal(`${proof.id}LinkComment` in result.answers, source === 'Собственная отчетность' && format === 'unavailable');
      if (source === 'Собственная отчетность' && format === 'unavailable') assert.equal(result.answers[`${proof.id}LinkComment`], rawText);
    }
  }
});


test('Digital UH Score appears in the digital-source summary only where applicable', async () => {
  const {getIntroSummary} = await import('./intro.js');
  for (const team of others) {
    const metric = otherTeamProfiles[team.id].metrics.find(m => m.code === 'cx.uh_score');
    const applicable = Boolean(metric && metric.is_applicabble_flg !== false && !metric.excluded_from_index && metric.dd_calculation_flg && metric.max_value > 0);
    const summary = getIntroSummary(team.id);
    assert.equal(summary.digital.includes(metric?.name || '__missing__'), applicable, team.name);
  }
});

test('Excel evidence is neutral and never adds a mail instruction', async () => {
  const {metricSourceEvidence} = await import('./metric-source.js');
  for (const team of others) {
    const base = completed(team);
    const numeric = numericCatalogue(base)[0];
    if (!numeric) continue;
    const id = numeric.inlineProof.id;
    const a = {...base, [id]: 'Собственная отчетность', [`${id}Format`]: 'excel'};
    assert.equal(metricSourceEvidence(numeric.inlineProof, a), 'Собственная отчетность: Отчет в формате Excel');
    assert.doesNotMatch(JSON.stringify(buildSurveyResult(a)), /направить по почте|Адреса и тема письма/);
  }
});

test('removed campaign reporting and stale sources are absent from the current survey result', () => {
  const team=others.find(t=>t.name==='Персональная рекомендация');
  const base=completed(team);
  assert.ok(!catalogue(base).some(q=>q.id==='campaignReporting'));
  const result=buildSurveyResult({...base,campaignReporting:['% доставленных коммуникаций'],campaignReport:'stale.ru',campaignReportFormat:'link',campaignReportCorrection:'edit'});
  for(const key of ['campaignReporting','campaignReport','campaignReportFormat','campaignReportCorrection']) {
    assert.ok(!(key in result.answers));assert.ok(!(key in result.questionSources));
  }
});

test('neutral Excel adapter does not rewrite user-supplied words in other evidence branches', async () => {
  const {metricSourceEvidence} = await import('./metric-source.js');
  const proof = {id:'source'};
  const input = 'Дашборд — направить по почте';
  assert.equal(metricSourceEvidence(proof,{source:'Дашборд в Навигаторе',sourceLink:input}), `Дашборд в Навигаторе: ${input}`);
  assert.match(metricSourceEvidence(proof,{source:'Собственная отчетность',sourceFormat:'unavailable',sourceLinkComment:input}), /Дашборд — направить по почте/);
});


test('all seven segments use their age or income source rows and distinct mechanics', () => {
  const incomeNames = ['МВС', 'PB', 'Top Affluent'];
  const ageNames = ['Дети', 'Зрелость', 'Молодежь', 'Рабочий возраст'];
  const profiles = Object.values(otherTeamProfiles).filter(profile => profile.type === 'Сегмент');
  assert.deepEqual(new Set(profiles.map(profile => profile.name)), new Set([...incomeNames, ...ageNames]));
  const numericRows = {activeClients: [21,45], majorClients: [25,49], nonFinancialClients: [29,53], salaryClients: [33,33], payrollShare: [37,37], payrollVolume: [41,41], clientIncome: [57,57]};
  for (const profile of profiles) {
    const income = incomeNames.includes(profile.name);
    for (const q of numericCatalogue({product: profile.teamId})) {
      assert.ok(numericRows[q.id], `${profile.name}: known numeric ${q.id}`);
      assert.equal(q.row, numericRows[q.id][income ? 1 : 0]+(q.inlineNumericChild?3:0), `${profile.name}: ${q.id} source`);
      if (['salaryClients','payrollShare','payrollVolume'].includes(q.id)) assert.equal(profile.name, 'Рабочий возраст');
      if (q.id === 'clientIncome') assert.equal(income, true);
    }
    // Force all existing mechanics below maximum to exercise branches normally hidden by prior full scores.
    const synthetic = {...profile, metrics: profile.metrics.map(metric => metric.code.startsWith('mehaniki.') ? {...metric, value: 0} : metric)};
    // Inconsistent extra baseline flags must not leak income-only or working-age-only questions.
    for (const code of ['mehaniki.vozvrat_klientov','mehaniki.povyshenie_urovnya_klienta','general.kol_vo_poluchateley_zp','general.dolya_rynka_fot','general.obъem_zachisleniy_fot','general.sredniy_dohoda_na_klienta']) {
      const existing = synthetic.metrics.findIndex(metric => metric.code === code);
      const forced = {code, name: code, value: 0, max_value: 1, is_applicabble_flg: true, dd_calculation_flg: 1, excluded_from_index: false};
      if (existing >= 0) synthetic.metrics[existing] = forced;
      else synthetic.metrics.push(forced);
    }
    const syntheticNumbers = otherTeamSections(synthetic).flatMap(section => section.questions).flatMap(q=>[q,...inlineQuestions(q)]).filter(q => q.type === 'numeric');
    for (const id of ['salaryClients','payrollShare','payrollVolume']) assert.equal(syntheticNumbers.some(q => q.id === id), profile.name === 'Рабочий возраст', `${profile.name}: no working-age-only leak`);
    assert.equal(syntheticNumbers.some(q => q.id === 'clientIncome'), income, `${profile.name}: no income-only leak`);
    const mechanics = otherTeamSections(synthetic).flatMap(section => section.questions).find(q => q.id === 'otherMechanics');
    if (profile.name === 'Дети') {assert.equal(mechanics, undefined, 'Explicit exception applies even to synthetic mechanic gaps'); continue;}
    assert.ok(mechanics, profile.name);
    assert.equal(mechanics.row, income ? 137 : 131);
    if (!income) {
      assert.ok(!mechanics.options.some(option => /Возврат|Миграци/.test(option)), profile.name);
      assert.ok(!mechanics.inlineQuestions.some(q => /возврат|миграци/i.test(q.title)));
    }
    const children = mechanics.inlineQuestions;
    const retention = children.find(q => q.whenOption?.option === 'Удержание клиентов' && q.id !== 'segmentRetentionBasis');
    assert.ok(retention, `${profile.name}: retention available after clearing previous score`);
    assert.equal(retention.row, income ? 165 : 160);
    assert.match(retention.options.join('\n'), /Персональный оффер/);
    assert.equal(retention.options.some(option => /Бесшовный переход/.test(option)), !income);
    assert.equal(retention.options.some(option => /Мягкое.*удержание/.test(option)), income);
    const acquisition = children.find(q => q.whenOption?.option === 'Привлечение клиентов');
    assert.ok(acquisition, profile.name);
    const privateAcquisition = ['PB','Top Affluent'].includes(profile.name);
    assert.equal(acquisition.row, privateAcquisition ? 152 : 159);
    assert.equal(acquisition.type, privateAcquisition ? 'multi' : 'text');
    const comeback = children.find(q => q.whenOption?.option === 'Возврат клиентов');
    if (income && mechanics.options.includes('Возврат клиентов')) {
      assert.ok(comeback, profile.name);
      assert.equal(comeback.row,176);
      assert.match(comeback.options.join('\n'), /Мягкое касание/);
      assert.match(comeback.options.join('\n'), /Персональный оффер/);
    }
  }
});

// Numeric marks read independently from Книга1(3).xlsx / свод_сегменты, rows 79:84 and 94:99.
const historicalSegmentMarks = {
  'Дети': {attract:[79,80,83], churn:[94,96,97], mechanics:['Персонализации клиентского опыта','Привлечение клиентов']},
  'Молодежь': {attract:[80,81,82,84], churn:[], mechanics:['Персонализации клиентского опыта','Удержание клиентов']},
  'Рабочий возраст': {attract:[79,80,81,82,84], churn:[94,95,96,97], mechanics:['Персонализации клиентского опыта','Привлечение клиентов','Удержание клиентов']},
  'Зрелость': {attract:[], churn:[], mechanics:['Удержание клиентов','Реагирования на жизненные события']},
  'Top Affluent': {attract:[81,82,83], churn:[], mechanics:['Привлечение клиентов','Удержание клиентов','Миграции вверх (повышения уровня)','Реагирования на жизненные события']},
  'PB': {attract:[81,82,83,84], churn:[96,97,99], mechanics:['Персонализации клиентского опыта','Привлечение клиентов','Удержание клиентов','Миграции вверх (повышения уровня)','Реагирования на жизненные события']},
  'МВС': {attract:[81,82,83,84], churn:[], mechanics:['Привлечение клиентов','Удержание клиентов','Миграции вверх (повышения уровня)','Реагирования на жизненные события']},
};
const historicalSegmentLabels = {
  79:'Источники привлечения (самоходы, внешние привлечения, кампейнинг, кросс-перетоки)',80:'Пошаговая воронка (CJM клиентский путь)',81:'CR (% конверсии)',82:'Объёмы',83:'Механики привлечения',84:'Сегментный/когортный разрез',
  94:'Предоттоковые клиенты',95:'Пошаговая воронка',96:'% оттока',97:'Объёмы',98:'Когортный retention',99:'Кампании',
};
const historicalSegmentReportLinks = {
  'Рабочий возраст':{attract:['https://navigator.sigma.sbrf.ru/gdash/1000001388'],churn:['https://navigator.sigma.sbrf.ru/gdash/1000001388','https://navigator.sigma.sbrf.ru/gdash/1000006592#eyJ3aWRnZXRzIjp7IjEwMDA1MjYyNTQiOnsibW9kaWZpZWRSb3dzIjp7IjUiOjAsIjkiOjB9fX19']},
  'Top Affluent':{attract:['https://navigator.sigma.sbrf.ru/gdash/1000000135/1000046561']},
  'PB':{churn:['https://navigator.sigma.sbrf.ru/gdash/1000000301/1000003047?segment=PB']},
  'МВС':{attract:['https://confluence.sberbank.ru/pages/viewpage.action?pageId=6699321962']},
};

test('segment funnel history uses only its own numeric marks and exports confirmed elements separately', () => {
  for (const team of others.filter(t => t.type === 'Сегмент')) {
    const answers = completed(team);
    const result = buildSurveyResult(answers,getBacklogAnalyzed(answers));
    for (const direction of ['attract','churn']) {
      const q = catalogue(answers).find(q => q.id === `${direction}Includes` && !q.benchmarkOnly);
      if (!q) continue;
      const expected = historicalSegmentMarks[team.name][direction].map(row => historicalSegmentLabels[row]);
      assert.deepEqual(q.previousOptions || [],expected,`${team.name}: ${direction} source marks`);
      for (const option of expected) assert.ok(q.options.includes(option));
      if(expected.length) {
        assert.deepEqual(result.previousFunnelElements[q.id],expected);
        for(const option of expected) assert.ok(result.answers[q.id].includes(option),`${team.name}: ${option} preserved`);
        const noNewChoice={...answers,[q.id]:[]};
        assert.equal(hasAnswer(q,noNewChoice),true,`${team.name}: prior elements suffice after valid source`);
      }
    }
    if(team.name==='PB') {
      const q=catalogue(answers).find(q=>q.id==='attractIncludes');
      assert.ok(!q.previousOptions.includes(historicalSegmentLabels[79]),'Partial textual description is not a numeric mark');
    }
  }
});

test('segment report history keeps actual URLs editable and never turns descriptions into URLs', () => {
  for(const team of others.filter(t=>t.type==='Сегмент')) {
    const answers=completed(team);
    const reports=catalogue(answers).filter(q=>['attractReport','churnReport'].includes(q.inlineEvidence?.id));
    for(const q of reports) {
      const direction=q.id.startsWith('attract')?'attract':q.id.startsWith('churn')?'churn':null;
      if(!direction)continue;
      const expected=historicalSegmentReportLinks[team.name]?.[direction] || [];
      const evidence=q.inlineEvidence;
      assert.deepEqual(evidence.previousLinks || [],expected,`${team.name}: ${direction} actual URL`);
      if(!expected.length)continue;
      const keep={...answers,[`${evidence.id}Correction`]:'keep',[evidence.id]:'not-a-link'};
      assert.equal(hasAnswer(q,keep),true);
      const kept=buildSurveyResult(keep,getBacklogAnalyzed(keep));
      assert.equal(kept.answers[evidence.id],expected.join('\n'));
      assert.equal(kept.answers[`${evidence.id}Correction`],'keep');
      const edit={...answers,[`${evidence.id}Correction`]:'edit',[evidence.formatId]:'link',[evidence.id]:rawLinks};
      assert.equal(hasAnswer(q,edit),true);
      const edited=buildSurveyResult(edit,getBacklogAnalyzed(edit));
      assert.equal(edited.answers[evidence.id],rawLinks);
      assert.equal(edited.answers[`${evidence.id}Correction`],'edit');
      assert.ok(edited.previousAnswers,`${team.name}: raw historical source retained`);
      assert.ok(JSON.stringify(edited.previousAnswers).includes(expected[0]),`${team.name}: original URL remains in history after edit`);
    }
  }
});

test('supplementary workbook links retain exact fragments, source cells and accepted backlog behavior', async () => {
  const {supplementarySegmentLinks} = await import('./supplementary-segment-links.js');
  const {previousSegments} = await import('./previous-segments.js');
  const {getPreviousHistory} = await import('./previous-history.js');
  for (const team of others.filter(team => team.type === 'Сегмент')) {
    const original = previousSegments[team.id];
    const history = getPreviousHistory(team.id);
    const sources = supplementarySegmentLinks[team.id];
    assert.equal(history.rawAnswers, original.rawAnswers);
    assert.equal(history.knownSubanswers, original.knownSubanswers);
    assert.equal(history.source, original.source);
    if (!sources) {assert.equal(history, original); continue;}
    assert.deepEqual(history.supplementalSources, sources);
    const answers = completed(team);
    const result = buildSurveyResult(answers, getBacklogAnalyzed(answers));
    assert.deepEqual(result.previousAnswers.supplementalSources, sources);
    if (!sources.some(source => source.target === 'backlog') && !original.acceptedBacklogLinks.length) {
      assert.equal(getBacklogAnalyzed(answers), false, `${team.name}: report links cannot suppress Discovery`);
      assert.ok(catalogue(answers).some(q => q.id === 'discovery'));
    }
    for (const source of sources) {
      assert.equal(source.file, 'Расчет_СХ_чек_проверка релевантности.xlsx');
      assert.ok(source.sheet && source.cell);
      if (source.target === 'backlog') {
        assert.ok(history.acceptedBacklogLinks.includes(source.url));
        assert.equal(history.acceptedBacklogLinks.filter(url => url === source.url).length, 1);
        assert.equal(getBacklogAnalyzed(answers), true);
        for (const id of ['discovery', 'discoveryBacklogType', 'backlog']) assert.ok(!(id in result.answers));
        const code = 'hyp.discovery_40_backlog';
        const baseline = otherTeamProfiles[team.id].metrics.find(metric => metric.code === code);
        const metric = result.result.metrics.find(metric => metric.code === code);
        if (baseline) {assert.equal(metric.value, baseline.value); assert.equal(metric.source, 'ddi_baseline');}
        continue;
      }
      const q = catalogue(answers).find(q => q.inlineEvidence?.id === source.target);
      assert.ok(q, `${team.name}: ${source.target} present`);
      assert.ok(q.inlineEvidence.previousLinks.includes(source.url));
      assert.equal(q.inlineEvidence.previousLinks.filter(url => url === source.url).length, 1);
      const keep = {...answers, [`${source.target}Correction`]: 'keep', [source.target]: 'stale invalid'};
      assert.equal(hasAnswer(q, keep), true);
      const kept = buildSurveyResult(keep, getBacklogAnalyzed(keep));
      assert.equal(kept.answers[source.target], q.inlineEvidence.previousLinks.join('\n'));
      assert.equal(kept.answers[`${source.target}Correction`], 'keep');
      const edited = {...answers, [`${source.target}Correction`]: 'edit', [q.inlineEvidence.formatId]: 'link', [source.target]: rawLinks};
      assert.equal(buildSurveyResult(edited, getBacklogAnalyzed(edited)).answers[source.target], rawLinks);
    }
  }
  const working = others.find(team => team.name === 'Рабочий возраст');
  const hashSource = supplementarySegmentLinks[working.id].find(source => source.cell === 'F86');
  assert.equal(hashSource.sheet, 'Рабочий возраст (2)');
  assert.equal(hashSource.url, historicalSegmentReportLinks['Рабочий возраст'].churn[1]);
});

test('segment Discovery skips only three accepted historical Jira/SberTrack backlogs', () => {
  for(const team of others.filter(t=>t.type==='Сегмент')) {
    const accepted=['Молодежь','Рабочий возраст','Top Affluent'].includes(team.name);
    assert.equal(getBacklogAnalyzed({product:team.id}),accepted,team.name);
    assert.equal(route({product:team.id}).some(q=>q.id==='discovery'),!accepted,team.name);
    const answers=completed(team);
    const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
    assert.ok(result.previousAnswers,team.name);
    assert.ok(JSON.stringify(result.previousAnswers).includes('свод_сегменты'));
    if(accepted) for(const id of ['discovery','discoveryBacklogType','backlog']) assert.ok(!(id in result.answers),`${team.name}: skipped ${id}`);
  }
});

test('segment confirmed mechanics use their own prior selections without repeating their subordinate questions', () => {
  for(const team of others.filter(t=>t.type==='Сегмент')) {
    const answers=completed(team);
    const q=catalogue(answers).find(q=>q.id==='otherMechanics');
    if(!q)continue;
    const expected=historicalSegmentMarks[team.name].mechanics;
    for(const option of expected) {
      assert.ok(q.knownOptions.includes(option),`${team.name}: confirmed ${option}`);
      assert.ok(!q.inlineQuestions.some(child=>child.whenOption?.option===option),`${team.name}: no repeated ${option} subquestion`);
    }
    const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
    for(const option of expected)assert.ok(result.previousMechanics.includes(option),`${team.name}: ${option} JSON history`);
    assert.ok(result.previousAnswers,`${team.name}: raw history metadata`);
  }
});

test('segment history retains workbook cells, comments and accepted backlog provenance for all seven teams', async () => {
  const {previousSegments}=await import('./previous-segments.js');
  const {getPreviousHistory}=await import('./previous-history.js');
  const expectedColumns={'Дети':['I','J','K'],'Молодежь':['N','O','P'],'Рабочий возраст':['S','T','U'],'Зрелость':['X','Y','Z'],'Top Affluent':['AC','AD','AE'],'PB':['AH','AI','AJ'],'МВС':['AM','AN','AO']};
  const acceptedBacklogs={
    'Молодежь':'https://jira.sberbank.ru/secure/RapidBoard.jspa?rapidView=41166&projectKey=SDRSA',
    'Рабочий возраст':'https://sbertrack.sberbank.ru/swtr/units/all?space=NLTKRBCHVZRST',
    'Top Affluent':'https://sbertrack.sberbank.ru/swtr/board/b5380d96-6b2a-4846-9a42-ac7e877607cf?space=PSDA&tenant=default&spaces=%5B%7B%22label%22%3A%22Premium_Solutions_DA%22%2C%22value%22%3A%22PSDA%22%7D%5D',
  };
  assert.equal(Object.keys(previousSegments).length,7);
  for(const team of others.filter(t=>t.type==='Сегмент')) {
    const history=previousSegments[team.id];
    const [answerColumn,markColumn,processedColumn]=expectedColumns[team.name];
    assert.equal(history.source.file,'Книга1(3).xlsx');
    assert.equal(history.source.sheet,'свод_сегменты');
    assert.equal(history.source.answerColumn,answerColumn);
    assert.equal(history.source.markColumn,markColumn);
    assert.equal(history.source.processedColumn,processedColumn);
    assert.deepEqual(history.acceptedBacklogLinks,acceptedBacklogs[team.name]?[acceptedBacklogs[team.name]]:[]);
    for(const direction of ['attract','churn']) assert.deepEqual((history.funnelElements[`${direction}Includes`] || []).map(correctTypos), historicalSegmentMarks[team.name][direction].map(row=>historicalSegmentLabels[row]));
    assert.ok(history.rawAnswers['206']);
    const backlogCells=history.rawAnswers['206'].sourceCells;
    assert.ok(backlogCells.some(cell=>cell.answer.cell===`${answerColumn}206`));
    assert.ok(Object.values(history.rawAnswers).flatMap(value=>value.sourceCells).every(cell=>cell.row>=25),'Historical respondent names are excluded');
    const exported=buildSurveyResult(completed(team),getBacklogAnalyzed({product:team.id}));
    assert.deepEqual(exported.previousAnswers,getPreviousHistory(team.id),`${team.name}: supplemented history survives export`);
    assert.deepEqual(exported.previousAnswers.rawAnswers,history.rawAnswers,`${team.name}: complete original cell provenance survives export`);
  }
  const child=previousSegments[others.find(t=>t.name==='Дети').id];
  assert.ok(JSON.stringify(child.rawAnswers['206']).includes('Изменила так как нет бэклога'));
  const pb=previousSegments[others.find(t=>t.name==='PB').id];
  assert.ok(JSON.stringify(pb.rawAnswers).includes('Данные по источникам привлечения частично реализованы'));
});

test('copyediting is idempotent and keeps every conditional option reference aligned with the UI', () => {
  let checked=0;
  for(const team of others) {
    const all=catalogue({product:team.id}).flatMap(q=>[q,...inlineQuestions(q),...(q.action?[q.action]:[]),...(q.benchmark?[q.benchmark]:[])]);
    const byId=new Map(all.map(q=>[q.id,q]));
    for(const q of all) {
      for(const label of [q.title,...(q.options||[]),...(q.knownOptions||[]),...(q.previousOptions||[])]) {
        assert.equal(correctTypos(correctTypos(label)),correctTypos(label),`${team.name}: idempotent ${q.id}`);
        assert.equal(label,correctTypos(label),`${team.name}: normalized UI ${q.id}`);
        checked++;
      }
      if(q.whenOption) assert.ok(byId.get(q.whenOption.id)?.options.includes(q.whenOption.option),`${team.name}: conditional ${q.id} points to a visible option`);
      for(const option of [...(q.commentWhen||[]),...(q.knownOptions||[]),...Object.keys(q.optionMetricCodes||{})]) assert.ok(q.options.includes(option),`${team.name}: ${q.id} metadata matches UI ${option}`);
      if(q.actionOption) assert.ok(q.options.includes(q.actionOption),`${team.name}: ${q.id} action remains selectable`);
    }
  }
  assert.ok(checked>500,'All other-team question labels and options covered');
});

test('copyediting never rewrites respondent text, raw URLs or the historical workbook payload', async () => {
  const {previousSegments}=await import('./previous-segments.js');
  const {getPreviousHistory}=await import('./previous-history.js');
  const historyBefore=JSON.stringify(previousSegments);
  const userText='  механника каммуникация эксклюзивнуя ТОР 3 Сегментный/ кагортный разрез\nНе исправлять ввод  ';
  const userLinks='  example.ru/кагортный?note=каммуникация&title=эксклюзивнуя  \nhttps://example.com/механника?value=ТОР_3\n';
  for(const team of others) {
    const answers=completed(team);
    const q=numericCatalogue(answers)[0];
    answers.name=userText;
    if(q) answers[q.optionalCommentId]=userText;
    if(q) {answers[q.inlineProof.id]='Дашборд в Навигаторе';answers[`${q.inlineProof.id}Link`]=userLinks;}
    const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
    assert.equal(result.respondent.name,userText);
    if(q) assert.equal(result.answers[q.optionalCommentId],userText);
    if(q) assert.equal(result.answers[`${q.inlineProof.id}Link`],userLinks);
    if(team.type==='Сегмент') {
      assert.deepEqual(result.previousAnswers,getPreviousHistory(team.id),`${team.name}: supplemented text and URLs remain exact`);
      assert.deepEqual(result.previousAnswers.rawAnswers,previousSegments[team.id].rawAnswers,`${team.name}: original cells remain exact`);
    }
  }
  assert.equal(JSON.stringify(previousSegments),historyBefore,'Rendering and export never mutate raw source history');
});

test('selected radio and checkbox answers serialize with exactly the visible edited labels', () => {
  let scenarios=0;
  for(const team of others) {
    const base=completed(team);
    for(const q of route(base).filter(q=>['radio','multi'].includes(q.type))) {
      for(const option of q.options) {
        if(q.knownOptions?.includes(option)) continue;
        const answers=completed(team,{[q.id]:q.type==='multi'?[option]:option});
        if(!hasAnswer(q,answers)) continue;
        const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
        assert.ok(q.id in result.answers,`${team.name}: ${q.id} remains active`);
        if(q.type==='multi') assert.ok(result.answers[q.id].includes(option),`${team.name}: visible checkbox text retained`);
        else assert.equal(result.answers[q.id],option,`${team.name}: visible radio text retained`);
        scenarios++;
      }
    }
  }
  assert.ok(scenarios>250,'All teams exercise exported radio and checkbox labels');
});


test('copyediting corrects agreed spelling, spacing and casing without changing answer meanings', () => {
  for(const [original,edited] of [
    ['  На чем основана механника удержания?  ','На чем основана механика удержания?'],
    ['Информационная каммуникация','Информационная коммуникация'],
    ['эксклюзивнуя аналитика,доступнуя только Private-клиентам','эксклюзивная аналитика, доступная только Private-клиентам'],
    ['Предотточные клиенты','Предоттоковые клиенты'],
    ['Сегментный/ кагортный разрез','Сегментный/когортный разрез'],
    ['Анализ CJM(клиентский путь)','Анализ CJM (клиентский путь)'],
    ['Продукты драйверы притока','Продукты-драйверы притока'],
    ['ТОР 3 фактора и причины','ТОП-3 фактора и причины'],
    ['Напимер,настроены спец.предложения и тд','Например, настроены спецпредложения и т. д.'],
  ]) {
    assert.equal(correctTypos(original),edited);
    assert.equal(correctTypos(edited),edited,'Edited spelling stays stable');
  }
});

test('legacy static answer labels normalize to the edited UI value while raw comments remain literal', () => {
  let scenarios=0;
  for(const team of others) {
    const base=completed(team);
    for(const [oldLabel,newLabel] of [['Анализ CJM(клиентский путь)','Анализ CJM (клиентский путь)'],['Предотточные клиенты','Предоттоковые клиенты'],['Продукты драйверы притока','Продукты-драйверы притока']]) {
      const q=route(base).find(q=>q.type==='multi' && q.options.includes(newLabel));
      if(!q)continue;
      const answers={...base,[q.id]:[oldLabel]};
      const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
      assert.ok(result.answers[q.id].includes(newLabel),`${team.name}: ${oldLabel} exported as ${newLabel}`);
      assert.ok(!result.answers[q.id].includes(oldLabel));
      assert.deepEqual(answers[q.id],[oldLabel],'Export does not mutate caller state');
      scenarios++;
    }
  }
  assert.ok(scenarios>=10,'Several channel and segment routes exercise real corrected variants');
});

test('copyediting preserves decimal commas, metric thresholds and numeric units', () => {
  for(const label of ['Оценка исследований >=7,5; частично 0,5','Изменение CLTV — 12,25 млрд руб.','Доля FCR — 90,5%','DAU/MAU — 0,75']) {
    assert.equal(correctTypos(label),label,'Punctuation cleanup cannot change numeric meaning');
    assert.equal(correctTypos(correctTypos(label)),label,'Decimal punctuation remains idempotent');
  }
});


// Independently read actual Книга1(3).xlsx channel sheets, numeric comment-column marks only.
const historicalChannelGolden = {
  "Чат": {
    "sheet": "свод_каналы (2)",
    "funnelElements": {
      "entryIncludes": [
        "Пошаговая воронка ",
        "% автоматизации",
        "% закрытых обращений",
        "CSAT"
      ],
      "salesIncludes": []
    },
    "reportLinks": {
      "entryReport": [
        "https://navigator.sigma.sbrf.ru/gdash/1000004111/1000036478?mobile_os=All&calendar_start=2026-01-01&factor_type=ЕЛЧ%20(без%20Навыков%20Заботы)&is_limited=2&calendar_end=2026-06-30&period_name=2&switch_charts_elch=ЕЛЧ%20(с%20Welcome)%7C%7C%7CЕЛЧ%20(Без%20Welcome)&switch_top_number=6&vSearch=gta"
      ],
      "salesReport": []
    },
    "mechanics": [
      "Автоматизации (автоклассификация обращений, распределения очередей / сплитов /лидов)"
    ]
  },
  "Колл-центр": {
    "sheet": "свод_каналы (2)",
    "funnelElements": {
      "entryIncludes": [
        "% автоматизации",
        "% отложенных обращений",
        "% закрытых обращений",
        "CSAT",
        "FCR"
      ],
      "salesIncludes": []
    },
    "reportLinks": {
      "entryReport": [
        "https://navigator.sigma.sbrf.ru/gdash/1000000219",
        "https://navigator.sigma.sbrf.ru/gdash/1000000111",
        "https://navigator.sigma.sbrf.ru/gdash/1000000319",
        "https://navigator.sigma.sbrf.ru/gdash/1000001679",
        "https://navigator.sigma.sbrf.ru/gdash/1000003084"
      ],
      "salesReport": []
    },
    "mechanics": [
      "Автоматизации (автоклассификация обращений, распределения очередей / сплитов /лидов)",
      "Информирования клиента о статусе обращения",
      "Персонализация скриптов",
      "Контроля качества речи"
    ]
  },
  "Телемаркетинг": {
    "sheet": "свод_каналы (2)",
    "funnelElements": {
      "entryIncludes": [],
      "salesIncludes": [
        "Пошаговая воронка ",
        "CR в целевон действие (конверсия)",
        "% не дозвонов",
        "% отказов",
        "Объемы",
        "CSAT"
      ]
    },
    "reportLinks": {
      "entryReport": [],
      "salesReport": [
        "https://navigator.sigma.sbrf.ru/gdash/1000000877"
      ]
    },
    "mechanics": [
      "Автоматизации (распределения очередей / сплитов /лидов)",
      "Наилучшего времени звонка",
      "Персонализация скриптов",
      "Контроля качества речи"
    ]
  },
  "СберKids": {
    "sheet": "свод_каналы",
    "funnelElements": {
      "attractIncludes": [
        "Каналы привлечения",
        "Сегментный/ кагортный разрез"
      ],
      "onboardingIncludes": [],
      "churnIncludes": [
        "Определение предотточных клиентов",
        "Сегментный/когортный разрез"
      ]
    },
    "reportLinks": {
      "attractReport": [
        "https://navigator.sigma.sbrf.ru/gdash/1000002729/1000029287?dtDate=20260531&nDynamicTypeID=3&sSet=3&tab_1=1&plat=ios&version=3.x%7C%7C%7C4.x%7C%7C%7C5.0.0%7C%7C%7C5.1.0%7C%7C%7C5.2.0%7C%7C%7C5.4.0"
      ],
      "onboardingReport": [],
      "churnReport": [
        "https://navigator.sigma.sbrf.ru/gdash/1000002729/1000029287?dtDate=20260531&nDynamicTypeID=3&sSet=3&tab_1=1&plat=ios&version=3.x%7C%7C%7C4.x%7C%7C%7C5.0.0%7C%7C%7C5.1.0%7C%7C%7C5.2.0%7C%7C%7C5.4.0"
      ]
    },
    "mechanics": [
      "Персонализация интерфейса, контента и рекомендаций",
      "Стимулирование клиента (геймификация, пуши, побуждающие рассылки и тд)",
      "Обучающие механики (подсказки, пошаговое знакомство и тд)"
    ]
  },
  "СберИнвестор": {
    "sheet": "свод_каналы",
    "funnelElements": {
      "attractIncludes": [
        "Каналы привлечения",
        "Пошаговая воронка ",
        "CR и CTR",
        "Количество целевых действий"
      ],
      "onboardingIncludes": [
        "Пошаговая воронка ",
        "Количество (доля) клиентов с целевым действием"
      ],
      "churnIncludes": [
        "Сегментный/когортный разрез",
        "% оттока"
      ]
    },
    "reportLinks": {
      "attractReport": [],
      "onboardingReport": [],
      "churnReport": []
    },
    "mechanics": [
      "Удержание клиентов",
      "Возврат клиентов",
      "Персонализация интерфейса, контента и рекомендаций",
      "Стимулирование клиента (геймификация, пуши, побуждающие рассылки и тд)"
    ]
  },
  "СБОЛ": {
    "sheet": "свод_каналы",
    "funnelElements": {
      "attractIncludes": [
        "Каналы привлечения",
        "Пошаговая воронка ",
        "CR и CTR",
        "Объёмы коммуникаций",
        "Количество целевых действий"
      ],
      "onboardingIncludes": [
        "Количество входов"
      ],
      "churnIncludes": [
        "Определение предотточных клиентов",
        "Сегментный/когортный разрез",
        "% оттока"
      ]
    },
    "reportLinks": {
      "attractReport": [],
      "onboardingReport": [],
      "churnReport": [
        "https://navigator.sigma.sbrf.ru/gdash/1000000188/1000031583?tab_1=2&sPlatform=Web"
      ]
    },
    "mechanics": [
      "Удержание клиентов",
      "Возврат клиентов",
      "Персонализация интерфейса, контента и рекомендаций",
      "Стимулирование клиента (геймификация, пуши, побуждающие рассылки и тд)",
      "Обучающие механики (подсказки, пошаговое знакомство и тд)"
    ]
  },
  "Уведомления": {
    "sheet": "свод_каналы",
    "funnelElements": {
      "attractIncludes": [
        "Каналы привлечения",
        "Сегментный/ кагортный разрез"
      ],
      "onboardingIncludes": [
        "Количество (доля) клиентов с целевым действием"
      ],
      "churnIncludes": [
        "Сегментный/когортный разрез",
        "Когортный retention"
      ]
    },
    "reportLinks": {
      "attractReport": [],
      "onboardingReport": [],
      "churnReport": []
    },
    "mechanics": [
      "Удержание клиентов",
      "Персонализация интерфейса, контента и рекомендаций",
      "Обучающие механики (подсказки, пошаговое знакомство и тд)"
    ]
  }
};


test('all nine sourced channel histories use their own worksheets and keep ELK in its separate source', async () => {
  const {previousChannels}=await import('./previous-channels.js');
  const {getPreviousHistory}=await import('./previous-history.js');
  assert.equal(Object.keys(previousChannels).length,8);
  for(const team of others.filter(t=>t.type==='Канал')) {
    const history=getPreviousHistory(team.id);
    const elk=team.name==='Единый личный кабинет (ЕЛК)';
    if(elk) {
      assert.ok(history);
      assert.equal(history.source.file,'Книга1(4).xlsx');
      const result=buildSurveyResult(completed(team),getBacklogAnalyzed({product:team.id}));
      assert.deepEqual(result.previousAnswers,history);
      continue;
    }
    assert.ok(history,team.name);
    const base=completed(team);
    const result=buildSurveyResult(base,getBacklogAnalyzed(base));
    assert.deepEqual(result.previousAnswers,history,`${team.name}: all raw history exported separately`);
    assert.ok(Object.values(history.rawAnswers).flatMap(q=>q.sourceCells).every(cell=>cell.row>7),'Respondent name rows are excluded');
    if(team.name==='Персональная рекомендация')continue;
    const golden=historicalChannelGolden[team.name];
    assert.equal(history.source.sheet,golden.sheet);
    for(const [id,labels] of Object.entries(golden.funnelElements)) {
      assert.deepEqual((history.funnelElements[id]||[]).map(correctTypos),labels.map(correctTypos),`${team.name}: ${id} numeric marks`);
      const q=catalogue(base).find(q=>q.id===id && !q.benchmarkOnly);
      if(!q)continue;
      assert.deepEqual(q.previousOptions||[],labels.map(correctTypos),`${team.name}: green ${id}`);
      if(labels.length) for(const label of labels.map(correctTypos)) assert.ok(result.previousFunnelElements[id].includes(label));
    }
    for(const option of golden.mechanics.map(correctTypos)) assert.ok(result.previousMechanics.includes(option),`${team.name}: confirmed ${option}`);
    for(const q of catalogue(base).filter(q=>q.id.endsWith('Analysis'))) {
      assert.ok(!q.previousOptions?.length,`${team.name}: quarterly analysis must be answered anew`);
      assert.equal(hasAnswer(q,{product:team.id}),false,`${team.name}: no previous analysis prefill`);
    }
  }
});

test('channel historical reports preserve actual deduplicated URLs, allow edits and reject numeric placeholders', async () => {
  const {previousChannels}=await import('./previous-channels.js');
  for(const [name,golden] of Object.entries(historicalChannelGolden)) {
    const team=others.find(t=>t.name===name);
    const history=previousChannels[team.id];
    assert.deepEqual(Object.fromEntries(Object.entries(history.reportLinks).filter(([,links])=>links.length)),Object.fromEntries(Object.entries(golden.reportLinks).filter(([,links])=>links.length)),`${name}: raw report URL extraction`);
    const answers=completed(team);
    for(const q of catalogue(answers).filter(q=>q.inlineEvidence && Object.keys(golden.reportLinks).includes(q.inlineEvidence.id))) {
      const evidence=q.inlineEvidence;
      const expected=golden.reportLinks[evidence.id];
      assert.deepEqual(evidence.previousLinks||[],expected,`${name}: ${evidence.id} usable history`);
      if(!expected.length)continue;
      const keep={...answers,[`${evidence.id}Correction`]:'keep',[evidence.id]:'stale invalid link'};
      const result=buildSurveyResult(keep,getBacklogAnalyzed(keep));
      assert.equal(result.answers[evidence.id],expected.join('\n'));
      const edit={...answers,[`${evidence.id}Correction`]:'edit',[evidence.id]:rawLinks,[evidence.formatId]:'link'};
      const edited=buildSurveyResult(edit,getBacklogAnalyzed(edit));
      assert.equal(edited.answers[evidence.id],rawLinks);
      assert.deepEqual(edited.previousAnswers,history,'Editing current report does not rewrite original cells');
    }
    if(name==='СберИнвестор') {
      assert.deepEqual(history.reportLinks.onboardingReport||[],[]);
      assert.deepEqual(history.reportLinks.churnReport||[],[]);
    }
  }
});

test('accepted campaign and ELK Jira backlogs suppress channel Discovery while other domains never do', async () => {
  const {getPreviousHistory}=await import('./previous-history.js');
  for(const team of others.filter(t=>t.type==='Канал')) {
    const accepted=['Персональная рекомендация','Единый личный кабинет (ЕЛК)'].includes(team.name);
    assert.equal(getBacklogAnalyzed({product:team.id}),accepted,team.name);
    const history=getPreviousHistory(team.id);
    if(team.name==='Персональная рекомендация') assert.deepEqual(history.acceptedBacklogLinks,['https://jira.sberbank.ru/secure/RapidBoard.jspa?rapidView=40123&projectKey=INSIGHT#']);
    else if(!accepted)assert.deepEqual(history.acceptedBacklogLinks,[]);
    const metric=otherTeamProfiles[team.id].metrics.find(m=>m.code==='hyp.discovery_40_backlog');
    const applicable=metric && metric.is_applicabble_flg!==false && !metric.excluded_from_index && Number(metric.dd_calculation_flg)!==0 && metric.max_value>0;
    assert.equal(catalogue({product:team.id}).some(q=>q.id==='discovery'),Boolean(applicable&&!accepted));
  }
});

test('removed campaign reporting preserves its raw history and keeps quarterly analysis', async () => {
  const team=others.find(t=>t.name==='Персональная рекомендация');
  const answers=completed(team);
  assert.ok(!catalogue(answers).some(q=>q.id==='campaignReporting'));
  const analysis=catalogue(answers).find(q=>q.id==='campaignAnalysis');
  assert.ok(analysis.options.includes('% триггерных коммуникаций'));
  assert.ok(!analysis.previousOptions?.length);
  assert.equal(hasAnswer(analysis,{product:team.id}),false);
  const {previousChannels}=await import('./previous-channels.js');
  const history=previousChannels[team.id];
  assert.equal(history.source.sheet,'Кампейнинг');
  assert.equal(history.source.answerColumn,'E');
  assert.equal(history.source.markColumn,'G');
  assert.equal(history.source.commentColumn,'F');
  assert.equal(history.source.processedColumn,'H');
  const indicatorCell=history.rawAnswers['64'].sourceCells.find(cell=>cell.row===64);
  assert.equal(indicatorCell.mark.cell,'G64');
  assert.equal(indicatorCell.mark.value,1);
  assert.equal(indicatorCell.comment.cell,'F64');
  assert.match(indicatorCell.comment.value,/^https:\/\/navigator/);
  const backlogCell=history.rawAnswers['100'].sourceCells.find(cell=>cell.row===100).answer;
  assert.match(backlogCell.value,/#$/);
  assert.ok(!backlogCell.hyperlink.endsWith('#'),'Original Excel hyperlink target survives alongside display URL');
  assert.ok(JSON.stringify(history.rawAnswers).includes('RCOPER-806'),'Historical action URL retained as history only');
});

test('explicit worksheet units retain million-call, percent and billion-ruble scales with decimal input', () => {
  const sourceUnits={channelCalls:'млн обращений',outgoingTraffic:'млн обращений',channelFcr:'%',salesCr:'%',channelPenetration:'%',channelDauMau:'%',payrollShare:'%',campaignNpv:'млрд руб.',campaignCltv:'млрд руб.',campaignOr:'%',campaignCtr:'%',campaignCr:'%',campaignDeviationMatrix:'%',campaignAutomaticAlerts:'%',campaignCrPerformance:'%',campaignNpvPerformance:'%',campaignCltvPerformance:'%'};
  let covered=0;
  for(const team of others) for(const q of numericCatalogue({product:team.id})) {
    if(!sourceUnits[q.id])continue;
    assert.equal(q.unit,sourceUnits[q.id],`${team.name}: ${q.id} matches source scale`);
    assert.equal(q.allowDecimal,true,`${team.name}: ${q.id} allows fractions in displayed unit`);
    const a={[q.id]:'0,25',[q.inlineProof.id]:'Затрудняюсь ответить'};
    assert.equal(hasAnswer(q,a),true);
    covered++;
  }
  assert.ok(covered>=8,'Explicit source units covered across remaining segment, ELK and campaign metrics');
});

test('other-team numeric answers retain entered values without automatic unit conversion in JSON', () => {
  let covered=0;
  for(const team of others) {
    const base=completed(team);
    for(const q of numericCatalogue(base)) {
      const fraction=q.allowDecimal?'0,021615':'21615';
      const source=q.inlineProof || catalogue(base).find(parent=>parent.inlineQuestions?.some(child=>child.id===q.id))?.inlineProof;
      const answers={...base,[q.id]:fraction,[`${q.id}Unknown`]:false,[source.id]:'Затрудняюсь ответить'};
      assert.equal(hasAnswer(q,answers),true,`${team.name}: ${q.id}`);
      const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
      assert.equal(result.answers[q.id],fraction,`${team.name}: ${q.unit} is a label, not an implicit multiplier`);
      assert.equal(answers[q.id],fraction,'Export does not mutate input');
      if(/млн|млрд|руб|%/.test(q.unit)) assert.equal(q.allowDecimal,true,`${team.name}: scaled, money and percent values allow fractions`);
      if(q.unit==='клиентов' || q.unit==='человек') {
        assert.equal(Boolean(q.allowDecimal),false);
        assert.equal(hasAnswer(q,{...answers,[q.id]:'1,5'}),false,'Absolute people counts require integers');
      }
      covered++;
    }
  }
  assert.equal(covered,others.reduce((count,team)=>count+numericCatalogue(completed(team)).length,0),'Every currently displayed numeric control included');
});

test('product numeric units and exported values use the same displayed scale without hidden conversion', async () => {
  const {getSections:productSections,getBacklogAnalyzed:productBacklog,visibleQuestions:productVisible}=await import('../deposits-survey/questions.js');
  const {enabledTeams:products}=await import('../deposits-survey/teams.js');
  const {buildSurveyResult:productResult}=await import('../deposits-survey/result.js');
  let covered=0;
  for(const team of products) {
    const answers={name:'Проверка единиц',product:team.id,unit:team.unit};
    const routeProduct=()=>productSections(answers).flatMap(section=>productVisible(section,productBacklog(answers),answers));
    for(let i=0;i<3;i++) for(const q of routeProduct()) {
      if(q.id==='name'||q.id==='product')continue;
      if(!(q.id in answers) && q.type==='multi') answers[q.id]=[q.options.includes('Затрудняюсь ответить')?'Затрудняюсь ответить':q.options.includes('Не настроены дополнительные механики')?'Не настроены дополнительные механики':q.options[0]];
      if(!(q.id in answers) && q.type==='radio') answers[q.id]=q.options.includes('Нет')?'Нет':q.options.includes('Затрудняюсь ответить')?'Затрудняюсь ответить':q.options[0];
      fill(q,answers);
    }
    for(const q of routeProduct().filter(q=>q.type==='numeric')) {
      const value=q.allowDecimal?'0,021615':'21615';
      const current={...answers,[q.id]:value,[`${q.id}Unknown`]:false,[q.inlineProof.id]:'Затрудняюсь ответить'};
      const result=productResult(current,productBacklog(current));
      assert.equal(result.answers[q.id],value,`${team.name}: ${q.id} raw number uses ${q.unit}`);
      if(/млн|млрд|руб|%/.test(q.unit)) assert.equal(q.allowDecimal,true);
      if(q.unit==='клиентов'||q.unit==='человек') {
        assert.equal(Boolean(q.allowDecimal),false);
        assert.equal(hasAnswer(q,{...current,[q.id]:'1,5'}),false);
      }
      covered++;
    }
  }
  assert.ok(covered>100,'All product teams contribute numeric controls');
});

test('removed campaign indicators leave no current values or sources and preserve history and scores', async () => {
  const {previousChannels}=await import('./previous-channels.js');
  const team=others.find(t=>t.name==='Персональная рекомендация');
  const base=completed(team);
  const ids=['campaignTriggerShare','campaignDeliveredShare','campaignT2m','campaignSuccessfulPilotShare'];
  assert.ok(!getSections(base).some(section=>section.id==='campaignIndicators'));
  assert.ok(!catalogue(base).some(q=>ids.includes(q.id)));
  assert.ok(catalogue(base).some(q=>q.id==='campaignAnalysis'));
  const before=buildSurveyResult(base,getBacklogAnalyzed(base));
  const stale={...base};
  for(const id of ids)Object.assign(stale,{[id]:'99',[`${id}Unknown`]:true,[`${id}Comment`]:'old',[`${id}Source`]:'Дашборд в Навигаторе',[`${id}SourceLink`]:'stale.ru'});
  const after=buildSurveyResult(stale,getBacklogAnalyzed(stale));
  for(const record of [after.answers,after.questionRows,after.questionSources])for(const key of Object.keys(record))assert.ok(!ids.some(id=>key.startsWith(id)));
  assert.deepEqual(after.result.metrics,before.result.metrics);
  assert.deepEqual(after.previousAnswers,previousChannels[team.id]);
});

test('all segment metric knowledge choices drive conditional values, required sources, scoring and clean JSON', async () => {
  const knowledgeOptions=['Знаю значение, могу быстро найти в отчетности','Знаю что за метрика, но актуального значения нет под рукой','Практически не работаю с этой метрикой напрямую'];
  const {previousSegments}=await import('./previous-segments.js');
  let metrics=0;
  for(const team of others.filter(t=>t.type==='Сегмент')) {
    const base=completed(team);
    const parents=catalogue(base).filter(q=>q.scoreKind==='segmentKnowledge');
    assert.ok(parents.length>=2,`${team.name}: knowledge questions restored`);
    for(const parent of parents) {
      assert.equal(parent.type,'radio');
      assert.deepEqual(parent.options,knowledgeOptions);
      assert.ok(!/[()]/.test(parent.title),'Static explanations in parentheses removed from question');
      assert.match(parent.title,/Насколько/);
      const child=inlineQuestions(parent).find(q=>q.id===parent.knowledgeValueId);
      assert.ok(child,`${team.name}: original numeric identifier retained`);
      assert.equal(parent.id,`${child.id}Knowledge`);
      assert.equal(child.type,'numeric');
      assert.equal(child.row,parent.row+3);
      assert.equal(child.hideUnknown,false);
      assert.equal(child.scoreKind,'preserve');
      assert.equal(child.metricCode,undefined);
      assert.deepEqual(child.whenOption,{id:parent.id,option:knowledgeOptions[0]});
      assert.equal(child.inlineProof.kind,'metricSource');
      const value=child.allowDecimal?'0,021615':'21615';
      const noValue={...base,[parent.id]:knowledgeOptions[0],[child.id]:'',[`${child.id}Unknown`]:false,[child.inlineProof.id]:'Затрудняюсь ответить'};
      assert.equal(hasAnswer(parent,noValue),false,'First choice requires a number or explicit Unknown');
      const unknownValue={...noValue,[`${child.id}Unknown`]:true};
      assert.equal(hasAnswer(parent,unknownValue),true);
      const unknownResult=buildSurveyResult(unknownValue,getBacklogAnalyzed(unknownValue));
      assert.equal(unknownResult.answers[child.id],null);
      assert.equal(unknownResult.answers[`${child.id}Unknown`],true);
      assert.equal(unknownResult.result.metrics.find(m=>m.code===parent.metricCode).value,0);
      const noSource={...base,[parent.id]:knowledgeOptions[0],[child.id]:value,[`${child.id}Unknown`]:false,[child.inlineProof.id]:''};
      assert.equal(hasAnswer(parent,noSource),false,'First choice requires source independently from number');
      const positive={...base,[parent.id]:knowledgeOptions[0],[child.id]:value,[`${child.id}Unknown`]:false,[child.inlineProof.id]:'Дашборд в Навигаторе',[`${child.inlineProof.id}Link`]:rawLinks,[child.optionalCommentId]:rawText};
      assert.equal(hasAnswer(parent,positive),true);
      for(const invalid of ['abc','-1','1e3','12,3,4']) assert.equal(hasAnswer(parent,{...positive,[child.id]:invalid}),false,'First choice enforces numeric syntax');
      assert.equal(hasAnswer(parent,{...positive,[`${child.id}Unknown`]:true}),false,'Number and Unknown remain mutually exclusive');
      assert.equal(hasAnswer(parent,{...positive,[child.optionalCommentId]:''}),true,'Comment stays optional');
      for(const [index,fraction] of [[0,1],[1,0.5],[2,0]]) {
        const answers={...positive,[parent.id]:knowledgeOptions[index],[`${child.id}Unknown`]:index>0};
        assert.equal(hasAnswer(parent,answers),true,`${team.name}: branch ${index+1}`);
        assert.equal(inlineQuestions(parent,answers).some(q=>q.id===child.id),index===0);
        const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
        assert.equal(result.answers[parent.id],knowledgeOptions[index]);
        const metric=result.result.metrics.find(m=>m.code===parent.metricCode);
        assert.ok(metric);
        assert.equal(metric.value,Math.round(metric.maxValue*fraction*10000)/10000,`${team.name}: knowledge scoring fraction ${fraction}`);
        assert.equal(metric.questionId,parent.id,'Knowledge choice scores the metric, not its numeric child');
        if(index===0) {
          assert.equal(result.answers[child.id],value);
          assert.equal(result.answers[`${child.inlineProof.id}Link`],rawLinks);
          assert.equal(result.answers[child.optionalCommentId],rawText);
          assert.equal(result.questionSources[child.id].row,child.row);
          assert.equal(result.questionSources[`${child.inlineProof.id}Link`].row,child.row);
        } else {
          const staleIds=[child.id,`${child.id}Unknown`,child.inlineProof.id,`${child.inlineProof.id}Link`,`${child.inlineProof.id}Format`,`${child.inlineProof.id}Other`,`${child.inlineProof.id}LinkComment`,child.optionalCommentId];
          for(const id of staleIds) {
            assert.ok(!(id in result.answers),`${team.name}: hidden ${id} absent in branch ${index+1}`);
            assert.ok(!(id in result.questionSources));
            assert.ok(!(id in result.questionRows));
          }
        }
        assert.deepEqual(result.previousAnswers.rawAnswers,previousSegments[team.id].rawAnswers);
      }
      metrics++;
    }
  }
  assert.ok(metrics>=20,'Every applicable metric across seven segments covered');
});

test('Digital UX alerts require a literal setup comment for Yes and Partial and exclude hidden comments', () => {
  let teamsChecked=0;
  for(const team of others.filter(t=>t.unit==='DP')) {
    const base=completed(team);
    const q=catalogue(base).find(q=>q.id==='uxAlerts');
    if(!q)continue;
    assert.equal(q.optionalCommentId,'uxAlertsComment');
    assert.equal(q.optionalCommentRequired,true);
    assert.equal(q.optionalCommentTitle,'Что настроено и как?');
    assert.deepEqual(q.optionalCommentWhen,['Да','Частично']);
    for(const choice of ['Да','Частично']) {
      for(const comment of ['', '  \n\t ']) {
        const answers={...base,[q.id]:choice,[q.optionalCommentId]:comment};
        assert.equal(hasAnswer(q,answers),false,`${team.name}: ${choice} requires a meaningful comment`);
        assert.throws(()=>buildSurveyResult(answers,getBacklogAnalyzed(answers)),/Incomplete survey/);
      }
      const answers={...base,[q.id]:choice,[q.optionalCommentId]:rawText};
      assert.equal(hasAnswer(q,answers),true);
      const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
      assert.equal(result.answers.uxAlerts,choice);
      assert.equal(result.answers.uxAlertsComment,rawText,'Store exactly the entered explanation');
      assert.equal(result.questionRows.uxAlertsComment,q.row);
      assert.deepEqual(result.questionSources.uxAlertsComment,{sheet:q.sheet,row:q.row});
      const otherComment=buildSurveyResult({...answers,uxAlertsComment:'Другое описание настройки'},getBacklogAnalyzed(answers));
      assert.deepEqual(result.result.metrics,otherComment.result.metrics,'Comment content does not change scoring');
    }
    for(const choice of ['Нет','Затрудняюсь ответить']) {
      const answers={...base,[q.id]:choice,[q.optionalCommentId]:rawText};
      assert.equal(hasAnswer(q,answers),true);
      assert.equal(showsOptionalComment(q,answers),false);
      const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
      assert.equal(result.answers.uxAlerts,choice);
      assert.ok(!('uxAlertsComment' in result.answers));
      assert.ok(!('uxAlertsComment' in result.questionSources));
      assert.ok(!('uxAlertsComment' in result.questionRows));
    }
    teamsChecked++;
  }
  assert.ok(teamsChecked>=2,'Applicable Digital teams covered');
});

test('ELK history exactly preserves the new workbook cells and hyperlinks without the respondent name', async () => {
  const {previousElk}=await import('./previous-elk.js');
  const team=others.find(t=>t.name==='Единый личный кабинет (ЕЛК)');
  assert.deepEqual(Object.keys(previousElk),[team.id]);
  const history=previousElk[team.id];
  assert.equal(history.source.file,'Книга1(4).xlsx');
  assert.equal(history.source.sheet,'Лист1');
  for(const [field,column] of Object.entries({answerColumn:'D',commentColumn:'E',markColumn:'F',processedColumn:'G'})) assert.equal(history.source[field],column);
  const values={};const hyperlinks={};
  for(const cell of Object.values(history.rawAnswers).flatMap(q=>q.sourceCells)) {
    assert.ok(cell.row>=20 && cell.row<=208,'Only historical response rows, no FIO row8');
    for(const field of ['answer','comment','mark','processed']) {
      const item=cell[field];
      if(item?.value!==null && item?.value!==undefined)values[item.cell]=item.value;
      if(item?.hyperlink)hyperlinks[item.cell]=item.hyperlink;
    }
  }
  const digest=object=>createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(object).sort(([a],[b])=>a.localeCompare(b,'en'))))).digest('hex');
  // Golden digests independently computed from actual Excel D20:G208 with openpyxl, not generated JS.
  assert.equal(Object.keys(values).length,258);
  assert.equal(Object.keys(hyperlinks).length,3);
  assert.equal(digest(values),'ad5f572cabcaa4ab90df330b608cab304772873c535192df1ee7ab48c8024c86');
  assert.equal(digest(hyperlinks),'9c97fb93dfa9c499c9272fd2f242428e51b4d81c7c1ca768e34232788e78b17c');
  assert.deepEqual(history.rawAnswers['192'].selectedOptions,['Меньше 20%','Нет собственных аналитиков'],'Conflicting original marks remain visible in raw history');
  assert.ok(JSON.stringify(history.rawAnswers['160']).includes('динамичнеского бейджа'),'Historical spelling stays exact');
});

test('ELK uses only confirmed funnel marks and real URLs, accepts Jira backlog and avoids invented mechanics', async () => {
  const {previousElk}=await import('./previous-elk.js');
  const {getPreviousHistory}=await import('./previous-history.js');
  const team=others.find(t=>t.name==='Единый личный кабинет (ЕЛК)');
  const history=previousElk[team.id];
  const report='https://navigator.sigma.sbrf.ru/gdash/1000002960';
  const backlog='https://jira.sberbank.ru/browse/SID-76026?jql=component%20%3D%20%22SberID_Data%26Analytic%22%20AND%20labels%20%3D%20sberid_elk';
  assert.equal(getPreviousHistory(team.id),history);
  assert.deepEqual(history.funnelElements,{usageIncludes:['CR и CTR'],churnIncludes:['Механики удержания','% оттока']});
  assert.deepEqual(history.reportLinks,{usageReport:[report],churnReport:[report]});
  assert.deepEqual(history.acceptedBacklogLinks,[backlog]);
  assert.equal(getBacklogAnalyzed({product:team.id}),true);
  assert.ok(!catalogue({product:team.id}).some(q=>q.id==='discovery'),'Accepted actual Jira URL suppresses Discovery regardless of contradictory historical marks');
  const canonical='Стимулирование клиента (геймификация, пуши, Nudging-механики)';
  assert.deepEqual(history.mechanics,[canonical],'Free-text badge detail is not a second confirmed mechanic');
  const answers=completed(team);
  const questions=catalogue(answers);
  for(const [id,previous] of Object.entries(history.funnelElements)) {
    const q=questions.find(q=>q.id===id && !q.benchmarkOnly);
    if(q)assert.deepEqual(q.previousOptions,previous.map(correctTypos));
  }
  const mechanics=questions.find(q=>q.id==='otherMechanics');
  if(mechanics) {
    assert.ok(!mechanics.knownOptions.includes(canonical));
    assert.ok(mechanics.options.includes(canonical));
    assert.ok(mechanics.knownOptions.includes('Удержание клиентов'));
    const empty={...answers,otherMechanics:[UNKNOWN],[mechanics.commentId]:rawText};
    const unselected=buildSurveyResult(empty,true);
    assert.ok(!unselected.answers.otherMechanics.includes(canonical));
    const selected={...empty,otherMechanics:[canonical],[mechanics.commentId]:''};
    assert.equal(hasAnswer(mechanics,selected),false,'New selection requires a comment');
    selected[mechanics.commentId]=rawText;
    assert.equal(hasAnswer(mechanics,selected),true);
    const updated=buildSurveyResult(selected,true);
    assert.ok(updated.answers.otherMechanics.includes(canonical));
    assert.equal(updated.answers[mechanics.commentId],rawText);
    const code='mehaniki.stimulirovanie_klienta';
    assert.equal(unselected.result.metrics.find(m=>m.code===code).value,0);
    assert.equal(updated.result.metrics.find(m=>m.code===code).value,.5);
    assert.deepEqual(updated.previousAnswers,history);
    assert.ok(!mechanics.options.some(option=>option.startsWith('Nudging механики для виджетов')));
  }
  const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
  assert.deepEqual(result.previousAnswers,history);
  assert.deepEqual(result.previousFunnelElements.usageIncludes,['CR и CTR']);
  assert.deepEqual(result.previousFunnelElements.churnIncludes,['Механики удержания','% оттока']);
  assert.ok(result.previousMechanics.includes(canonical));
  for(const q of questions.filter(q=>q.inlineEvidence?.previousLinks?.includes(report))) {
    const evidence=q.inlineEvidence;
    const keep={...answers,[`${evidence.id}Correction`]:'keep',[evidence.id]:'stale'};
    assert.equal(buildSurveyResult(keep,true).answers[evidence.id],report);
    const edited=buildSurveyResult({...answers,[`${evidence.id}Correction`]:'edit',[evidence.formatId]:'link',[evidence.id]:rawLinks},true);
    assert.equal(edited.answers[evidence.id],rawLinks);
    assert.deepEqual(edited.previousAnswers,history);
  }
  assert.deepEqual(result.result.metrics.map(metric=>[metric.code,metric.baselineValue,metric.maxValue]),otherTeamProfiles[team.id].metrics.map(metric=>[metric.code,metric.value,metric.max_value]),'Historical workbook cannot replace DDI baseline scores');
});

test('all sixteen teams now retain their own complete history separately from literal current input', async () => {
  const {getPreviousHistory}=await import('./previous-history.js');
  const before=new Map(others.map(team=>[team.id,JSON.stringify(getPreviousHistory(team.id))]));
  for(const team of others) {
    const history=getPreviousHistory(team.id);
    assert.ok(history,team.name);
    const answers=completed(team);
    const q=numericCatalogue(answers)[0];
    answers.name=rawText;
    if(q) answers[q.optionalCommentId]=rawText;
    const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
    assert.equal(result.respondent.name,rawText);
    if(q) assert.equal(result.answers[q.optionalCommentId],rawText);
    assert.equal(JSON.stringify(result.previousAnswers),before.get(team.id));
    assert.equal(JSON.stringify(history),before.get(team.id),'Review/export do not mutate source history');
  }
});


// Independent workbook digests for the 15 existing historical response ranges, excluding footer digital calculations.
const legacyHistoryCellDigests = {
  "Дети": {
    "values": 294,
    "valueDigest": "a59818098007bc1b00856b0a9f86f582002c5a08a14f3d294c05b7b511f29dee",
    "hyperlinks": 0,
    "hyperlinkDigest": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
  },
  "Молодежь": {
    "values": 297,
    "valueDigest": "c4261f7eec4e823711fb666005e4873113e3d46c943d462fb9db3266a127f079",
    "hyperlinks": 0,
    "hyperlinkDigest": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
  },
  "Рабочий возраст": {
    "values": 328,
    "valueDigest": "7e13008710f98b0bf2ab54ebc493612a97e70bec79b04198c2c1ec37b8b723a4",
    "hyperlinks": 1,
    "hyperlinkDigest": "14a669fcc5e423a6cf7bbe79aace4ee389a3b6c361bc7c23d59cb9217bdf13fb"
  },
  "Зрелость": {
    "values": 286,
    "valueDigest": "32e2fdac09724a0f3f540751734aba1034250c600f77503ac13b0a7fe1120904",
    "hyperlinks": 0,
    "hyperlinkDigest": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
  },
  "Top Affluent": {
    "values": 305,
    "valueDigest": "384038a2fe4bb6b8511569fe612af116df246b0d7075baf51a51c8975e07233d",
    "hyperlinks": 2,
    "hyperlinkDigest": "c90285d1f02fcf17ce1527c7862603553633c91bc13589e3abbb44838a5cec15"
  },
  "PB": {
    "values": 329,
    "valueDigest": "f946cf138ffd8517f7da62fa9768495bad263bfa5f6a0c01df69aaf78934f4cf",
    "hyperlinks": 1,
    "hyperlinkDigest": "0e2da026b592bc0d6f3a7df35875a12e149f5785fe360090e4b7d84c09621efd"
  },
  "МВС": {
    "values": 302,
    "valueDigest": "e07fa7bbffa9c26f207e11a209089d92a43791df217fe821bace470cdb7566f6",
    "hyperlinks": 1,
    "hyperlinkDigest": "694275d6b740ef0a4186e475256f1f6d752de20770d48ef8f12b91f663235db5"
  },
  "Чат": {
    "values": 229,
    "valueDigest": "65cead04e92b89393e61ea87d2b8ce08df621fc35c9b6b859b72d1aaab29cb75",
    "hyperlinks": 1,
    "hyperlinkDigest": "b0a688056738a236b75a9eaa7a5d35396be88e304fa7c6f11749ba43246375f2"
  },
  "Колл-центр": {
    "values": 226,
    "valueDigest": "b8b9df9d94d9c4f236e03efcd390c761f7618384c2ddab087038f7093037e7a0",
    "hyperlinks": 0,
    "hyperlinkDigest": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
  },
  "Телемаркетинг": {
    "values": 234,
    "valueDigest": "36a72f97e293f08001270cb615e821cf3805fb74927a9f26ebbbce3df300616b",
    "hyperlinks": 1,
    "hyperlinkDigest": "48843f81aa76d990bbb3d5dda0829843c6737e7fe65af76a97e8ee4a9927d60c"
  },
  "СберKids": {
    "values": 278,
    "valueDigest": "12c001bebfb2a182319cca1ee6d2e3e70c1367fccf68950efabb1780ad582a72",
    "hyperlinks": 2,
    "hyperlinkDigest": "648eaa3794bd24f2a75c3ed986af5cfd61be1db2a24dd321268315dc3baba3bf"
  },
  "СберИнвестор": {
    "values": 266,
    "valueDigest": "deefac73b34bc9e16738b6382e84fc19ef00d5755a479313b9245a826f8a5927",
    "hyperlinks": 0,
    "hyperlinkDigest": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
  },
  "СБОЛ": {
    "values": 292,
    "valueDigest": "a8b375af1713cd070e1a1d9850159dc5aaf7a6670ded35857df621b402c44206",
    "hyperlinks": 1,
    "hyperlinkDigest": "9f824dacd50e641bfbdc3b84b48302bc07e4b2436f3e8666efc93e19a2415f17"
  },
  "Уведомления": {
    "values": 280,
    "valueDigest": "5db99fa5f5705ff7b9b964eff62b9fc489b1ee27d22996f0852994ee8993bae8",
    "hyperlinks": 1,
    "hyperlinkDigest": "e269c29037b6c0fac234f7a1e571944a0838aae1c6f2847cb291823cf016a3b2"
  },
  "Персональная рекомендация": {
    "values": 209,
    "valueDigest": "24f2788144205ca43f646e5614a17fd4e34a49f1c82cd7d24c7c368cc21d9550",
    "hyperlinks": 28,
    "hyperlinkDigest": "3bef4613b0a72f563d669d2837b111a7d8719c433aa9dca11311704f27a8b2ff"
  }
};


test('new ELK integration leaves all fifteen existing workbook histories exact down to cell values and hyperlinks', async () => {
  const {getPreviousHistory}=await import('./previous-history.js');
  const digest=object=>createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(object).sort(([a],[b])=>a.localeCompare(b,'en'))))).digest('hex');
  let cells=0;let links=0;
  for(const [name,golden] of Object.entries(legacyHistoryCellDigests)) {
    const team=others.find(t=>t.name===name);
    const history=getPreviousHistory(team.id);
    assert.equal(history.source.file,'Книга1(3).xlsx');
    const values={};const hyperlinks={};
    for(const cell of Object.values(history.rawAnswers).flatMap(q=>q.sourceCells)) for(const field of ['answer','comment','mark','processed']) {
      const item=cell[field];
      if(item?.value!==null && item?.value!==undefined)values[item.cell]=item.value;
      if(item?.hyperlink)hyperlinks[item.cell]=item.hyperlink;
    }
    assert.equal(Object.keys(values).length,golden.values,name);
    assert.equal(Object.keys(hyperlinks).length,golden.hyperlinks,name);
    assert.equal(digest(values),golden.valueDigest,`${name}: actual source cell values`);
    assert.equal(digest(hyperlinks),golden.hyperlinkDigest,`${name}: actual source hyperlinks`);
    cells+=golden.values;links+=golden.hyperlinks;
  }
  assert.equal(cells,4155);
  assert.equal(links,39);
});

test('segment historical relevance notes preserve scored applicability and exact history', async () => {
  const {segmentApplicability}=await import('./segment-applicability.js');
  const {getPreviousHistory}=await import('./previous-history.js');
  const expected={
    'Дети':['mehaniki.uderzhanie_klientov','mehaniki.reagirovanie_na_zhiznennye_sobytiya'],
    'Молодежь':['mehaniki.privlechenie_klientov'],
    'Рабочий возраст':['mehaniki.reagirovanie_na_zhiznennye_sobytiya'],
    'Зрелость':['mehaniki.personalizaciya_klientskogo_opyta','mehaniki.privlechenie_klientov'],
    'Top Affluent':['mehaniki.vozvrat_klientov'],
    'PB':['mehaniki.vozvrat_klientov'],
    'МВС':['mehaniki.personalizaciya_klientskogo_opyta'],
  };
  const sourceCells={'Дети':['J164','J195'],'Молодежь':['O163'],'Рабочий возраст':['T195'],'Зрелость':['Y149','Y163'],'Top Affluent':['AD180'],'PB':['AI180'],'МВС':['AN149']};
  for(const team of others.filter(t=>t.type==='Сегмент')) {
    const baselineBefore=JSON.stringify(otherTeamProfiles[team.id]);
    const historyBefore=JSON.stringify(getPreviousHistory(team.id));
    const rule=segmentApplicability[team.id];
    assert.deepEqual(rule.excludedMetricCodes,[],'Applicable positive-max metrics override historical notes');
    assert.deepEqual(rule.evidence.map(item=>item.markCell),sourceCells[team.name]);
    for(const evidence of rule.evidence) assert.equal(evidence.mark,'не релевантно');
    const answers=completed(team);
    const questions=catalogue(answers);
    const mechanics=questions.find(q=>q.id==='otherMechanics');
    if(mechanics) {
      for(const code of expected[team.name]) assert.ok(Object.values(mechanics.optionMetricCodes).includes(code),`${team.name}: scored relevant option ${code} retained`);
      for(const option of [...(mechanics.knownOptions||[]),...(mechanics.commentWhen||[])]) assert.ok(mechanics.options.includes(option),'Conditional comment and known references remain selectable');
      for(const child of mechanics.inlineQuestions) if(child.whenOption) assert.ok(mechanics.options.includes(child.whenOption.option),'No orphaned subquestion for a removed mechanic');
    }
    if(team.name==='Дети') assert.equal(mechanics, undefined, 'Explicit Children exception hides mechanics screen');
    const result=buildSurveyResult(answers,getBacklogAnalyzed(answers));
    for(const code of expected[team.name]) {
      const metric=result.result.metrics.find(m=>m.code===code);
      if(metric) {
        const baseline=otherTeamProfiles[team.id].metrics.find(item=>item.code===code);
        assert.equal(metric.baselineValue,baseline.value,'Historical notes do not rewrite DDI baseline points');
        assert.equal(metric.maxValue,baseline.max_value);
      }
    }
    if(['Рабочий возраст','МВС'].includes(team.name)) {
      const preserved=team.name==='Рабочий возраст'?'mehaniki.privlechenie_klientov':'mehaniki.vozvrat_klientov';
      assert.ok(!rule.excludedMetricCodes.includes(preserved),'Conflicting negative annotation does not automatically remove the mechanic');
      if(mechanics) assert.ok(Object.values(mechanics.optionMetricCodes).includes(preserved));
      assert.ok(rule.reviewOnly.length);
    }
    if(['PB','Top Affluent','МВС'].includes(team.name)) assert.ok(!rule.excludedMetricCodes.includes('mehaniki.uderzhanie_klientov'),'Negative age-only retention branch cannot remove income retention');
    assert.equal(JSON.stringify(otherTeamProfiles[team.id]),baselineBefore);
    assert.equal(JSON.stringify(getPreviousHistory(team.id)),historyBefore);
    assert.deepEqual(result.previousAnswers,getPreviousHistory(team.id));
  }
});

test('all seven Digital and Phygital channels omit metric knowledge and ignore stale numeric fields', async () => {
  const {getIntroSummary}=await import('./intro.js');
  const teams=others.filter(t=>['Каналы Digital','Каналы Phigital'].includes(otherTeamProfiles[t.id].sheet));
  assert.equal(teams.length,7);
  const ids=['marketRussia','marketSber','channelMau','channelMauAndroid','channelMauIos','channelMauWeb','channelDau','channelDauAndroid','channelDauIos','channelDauWeb','channelPenetration','channelDauMau','channelCalls','channelFcr','outgoingTraffic','salesCr'];
  for(const team of teams) {
    const sections=getSections({product:team.id});
    assert.ok(!sections.some(s=>s.id==='metrics'));
    assert.ok(!getIntroSummary(team.id).surveyGroups.some(g=>g.id==='metrics'));
    assert.equal(route({product:team.id}).find(q=>!['name','product'].includes(q.id))?.id,'goalsMonitoring');
    const base=completed(team);const before=buildSurveyResult(base,getBacklogAnalyzed(base));
    const stale={...base};
    for(const id of ids)Object.assign(stale,{[id]:'999999',[`${id}Unknown`]:true,[`${id}Comment`]:rawText,[`${id}Source`]:'Дашборд в Навигаторе',[`${id}SourceLink`]:rawLinks,[`${id}SourceFormat`]:'link'});
    const after=buildSurveyResult(stale,getBacklogAnalyzed(stale));
    for(const id of Object.keys(stale).filter(k=>ids.some(id=>k===id||k.startsWith(`${id}Source`)||k===`${id}Unknown`||k===`${id}Comment`))) {
      assert.ok(!(id in after.answers),`${team.name}: ${id}`);
      assert.ok(!(id in after.questionSources));assert.ok(!(id in after.questionRows));
    }
    assert.deepEqual(after.result.metrics,before.result.metrics);
    assert.deepEqual(after.previousAnswers,before.previousAnswers);
  }
  for(const name of ['Единый личный кабинет (ЕЛК)','Персональная рекомендация']) {
    const team=others.find(t=>t.name===name);
    assert.ok(getSections({product:team.id}).some(s=>s.id==='metrics'));
    assert.ok(numericCatalogue({product:team.id}).length);
  }
});

test('ELK omits market-size questions and excludes stale values without changing baseline or history', () => {
  const team=others.find(t=>t.name==='Единый личный кабинет (ЕЛК)');
  const ids=['marketRussia','marketSber'];
  const base=completed(team);
  assert.ok(!catalogue(base).some(q=>ids.includes(q.id)));
  const before=buildSurveyResult(base,getBacklogAnalyzed(base));
  const stale={...base};
  for(const id of ids) Object.assign(stale,{[id]:'999999',[`${id}Unknown`]:true,[`${id}Comment`]:rawText,[`${id}Source`]:'Дашборд в Навигаторе',[`${id}SourceLink`]:rawLinks,[`${id}SourceFormat`]:'link',[`${id}SourceOther`]:rawText});
  const result=buildSurveyResult(stale,getBacklogAnalyzed(stale));
  for(const id of Object.keys(stale).filter(id=>ids.some(prefix=>id.startsWith(prefix)))) {
    assert.ok(!(id in result.answers),`${id}: old hidden field excluded`);
    assert.ok(!(id in result.questionSources));
    assert.ok(!(id in result.questionRows));
  }
  assert.deepEqual(result.result.metrics,before.result.metrics);
  for(const code of ['general.obъem_celevogo_rynka_v_rossii','general.obъem_celevogo_rynka_v_sbere']) {
    const metric=result.result.metrics.find(m=>m.code===code);
    if(metric){assert.equal(metric.value,metric.baselineValue);assert.equal(metric.source,'ddi_baseline');}
  }
  assert.deepEqual(result.previousAnswers,before.previousAnswers);
  for(const other of others.filter(t=>t.id!==team.id)) {
    const metrics=otherTeamProfiles[other.id].metrics;
    for(const [id,code] of [['marketRussia','general.obъem_celevogo_rynka_v_rossii'],['marketSber','general.obъem_celevogo_rynka_v_sbere']]) {
      const metric=metrics.find(m=>m.code===code);
      if(!metric || metric.is_applicabble_flg===false || metric.excluded_from_index || Number(metric.dd_calculation_flg)===0 || !(metric.max_value>0)) continue;
      assert.ok(catalogue({product:other.id}).some(q=>q.id===id),`${other.name}: existing applicable market question unchanged`);
    }
  }
});

test('ELK quality tools retain two old selections and ask KKD afresh with the same editable source', async () => {
  const {previousElk}=await import('./previous-elk.js');
  const team=others.find(t=>t.name==='Единый личный кабинет (ЕЛК)');
  const history=previousElk[team.id];
  const known=['Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе','Ручная проверка аналитиками (сверка с первичными источниками, выгрузки)','Проверка на стороне источника данных (DWH, витрины) силами data-инженеров'];
  const url='https://navigator.sigma.sbrf.ru/gdash/1000004198';
  const base=completed(team);
  const q=catalogue(base).find(q=>q.id==='qualityTools');
  assert.equal(q.sheet,'Data');assert.equal(q.row,35);
  assert.deepEqual(q.previousOptions,known.slice(1));
  assert.ok(q.options.includes(known[0]));
  assert.deepEqual(history.knownSubanswers.qualityTools.selectedOptions,known);
  assert.equal(q.evidenceAfterOptions,true);
  const proof=q.inlineEvidence;
  assert.equal(proof.id,'qualityToolsReport');
  assert.equal(proof.formatId,'qualityToolsReportFormat');
  assert.deepEqual(proof.previousLinks,[url]);
  const keep={...base,qualityTools:[]};
  delete keep.qualityToolsReportCorrection;
  delete keep.qualityToolsReportFormat;
  delete keep.qualityToolsReport;
  assert.equal(hasAnswer(q,keep),true,'Old selections and default retained URL suffice');
  assert.ok(q.options.includes(UNKNOWN));
  const uncertain={...keep,qualityTools:[UNKNOWN]};assert.equal(hasAnswer(q,uncertain),true);
  const uncertainResult=buildSurveyResult(uncertain,getBacklogAnalyzed(uncertain));
  assert.deepEqual(new Set(uncertainResult.answers.qualityTools),new Set([...known.slice(1),UNKNOWN]));
  assert.deepEqual(uncertainResult.previousAnswers,history);
  const kept=buildSurveyResult(keep,getBacklogAnalyzed(keep));
  assert.ok(!kept.answers.qualityTools.includes(UNKNOWN));
  assert.deepEqual(kept.answers.qualityTools,known.slice(1));
  assert.ok(!kept.answers.qualityTools.includes(known[0]));
  const selected=buildSurveyResult({...keep,qualityTools:[known[0]]},getBacklogAnalyzed(keep));
  assert.deepEqual(new Set(selected.answers.qualityTools),new Set(known));
  assert.deepEqual(selected.previousAnswers,history);
  assert.equal(kept.answers.qualityToolsReport,url);
  assert.equal(kept.answers.qualityToolsReportCorrection,'keep');
  const edit={...keep,qualityToolsReportCorrection:'edit',qualityToolsReportFormat:'link',qualityToolsReport:rawLinks};
  assert.equal(hasAnswer(q,{...edit,qualityToolsReport:'invalid'}),false);
  const edited=buildSurveyResult(edit,getBacklogAnalyzed(edit));
  assert.equal(edited.answers.qualityToolsReport,rawLinks);
  assert.equal(edited.answers.qualityToolsReportCorrection,'edit');
  assert.deepEqual(edited.previousAnswers,history);
  assert.deepEqual(edited.result.metrics,kept.result.metrics,'Updating a supporting URL preserves DDI scores');
  for(const other of others.filter(t=>t.id!==team.id)) {
    const tools=catalogue({product:other.id}).find(q=>q.id==='qualityTools');
    assert.ok(!tools?.previousOptions?.includes(known[1]),`${other.name}: no ELK manual-check selection copied`);
    if(other.name!=='Персональная рекомендация')assert.ok(!tools?.previousOptions?.length,`${other.name}: no campaign fallback copied`);
    assert.ok(!tools?.inlineEvidence?.previousLinks?.includes(url));
  }
});


test('campaign performance skips only metrics with their own historical dashboards', async () => {
  const {hasPerformanceDashboard}=await import('./questions.js');
  const {previousChannels}=await import('./previous-channels.js');
  const team=others.find(t=>t.name==='Персональная рекомендация');
  const history=previousChannels[team.id];
  const original=JSON.stringify(history);
  const ids=['campaignCrPerformance','campaignNpvPerformance','campaignCltvPerformance'];
  assert.ok(!getSections({product:team.id}).some(s=>s.id==='campaignPerformance'));
  for(const [index,id] of ids.entries()) {
    assert.equal(hasPerformanceDashboard({id},history),true);
    const missing=structuredClone(history); missing.rawAnswers[57+index].links=[];
    assert.equal(hasPerformanceDashboard({id},missing),false,'Another metric dashboard cannot skip this metric');
    const links=history.rawAnswers[57+index].links;
    try {
      history.rawAnswers[57+index].links=[];
      const remaining=getSections({product:team.id}).find(s=>s.id==='campaignPerformance');
      assert.deepEqual(remaining.questions.map(q=>q.id),[id]);
      assert.equal(hasAnswer(remaining.questions[0],{product:team.id}),false);
    } finally {history.rawAnswers[57+index].links=links;}
    missing.rawAnswers[57+index].links=['https://confluence.sberbank.ru/example'];
    assert.equal(hasPerformanceDashboard({id},missing),false,'A document is not a dashboard');
  }
  const base=completed(team);
  for(const id of ids){base[id]='123';base[`${id}Source`]='Дашборд в Навигаторе';base[`${id}SourceLink`]='stale.ru';}
  const result=buildSurveyResult(base,getBacklogAnalyzed(base));
  for(const id of ids) assert.ok(!Object.keys(result.answers).some(key=>key.startsWith(id)),'Hidden values and sources are not current answers');
  assert.deepEqual(result.previousAnswers,history);
  assert.equal(JSON.stringify(history),original);
});


test('campaign quality tools reuse only the two numeric comment marks without rewriting raw history or baseline', async () => {
  const {previousChannels}=await import('./previous-channels.js');
  const team=others.find(t=>t.name==='Персональная рекомендация');
  const history=previousChannels[team.id];const original=JSON.stringify(history);
  const base=completed(team);const q=catalogue(base).find(q=>q.id==='qualityTools');
  const known=['Собственная система мониторинга качества данных','Проверка на стороне источника данных (DWH, витрины) силами data-инженеров'];
  assert.deepEqual(q.previousOptions,known);assert.equal(q.scoreKind,'preserve');
  assert.ok(!q.inlineEvidence?.previousLinks?.length,'No source link is fabricated');
  const raw=history.rawAnswers[43];assert.deepEqual(raw.selectedOptions,[]);
  for(const row of [44,46]) {
    const cell=raw.sourceCells.find(c=>c.row===row);
    assert.equal(cell.comment.cell,`F${row}`);assert.equal(cell.comment.value,1);
    assert.equal(cell.mark.value,null);
  }
  const keep={...base,qualityTools:[]};assert.equal(hasAnswer(q,keep),true,'Known tools do not need to be selected again');
  const dashboard='Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе';
  const missing={...keep,qualityTools:[dashboard],qualityToolsReport:'',qualityToolsReportFormat:'link'};
  assert.equal(hasAnswer(q,missing),false,'Known tools still need their sources');
  assert.equal(hasAnswer(q,{...missing,qualityToolsReportFormat:'unknown'}),true);
  assert.equal(q.evidenceAfterOptions,true);
  assert.equal(hasAnswer(q,{...missing,qualityToolsReportFormat:'excel'}),false);
  assert.ok(!q.inlineEvidence.formats.some(option=>option.value==='excel'));
  const noLink=buildSurveyResult({...keep,qualityTools:[dashboard],qualityToolsReportFormat:'unknown',qualityToolsReport:'stale.ru'},getBacklogAnalyzed(keep));
  assert.equal(noLink.answers.qualityToolsReportFormat,'unknown');
  assert.equal(noLink.answers.qualityToolsReport,undefined);
  assert.match(q.inlineEvidence.title,/Пожалуйста, приложите ссылки/);
  assert.ok(q.options.includes(UNKNOWN));
  const uncertain={...keep,qualityTools:[UNKNOWN]};assert.equal(hasAnswer(q,uncertain),true);
  const uncertainResult=buildSurveyResult(uncertain,getBacklogAnalyzed(uncertain));
  assert.deepEqual(new Set(uncertainResult.answers.qualityTools),new Set([...known,UNKNOWN]));
  assert.deepEqual(uncertainResult.previousAnswers,history);
  const result=buildSurveyResult(keep,getBacklogAnalyzed(keep));
  assert.ok(!result.answers.qualityTools.includes(UNKNOWN));
  assert.deepEqual(result.answers.qualityTools,known);
  assert.equal(result.answers.qualityToolsReport,undefined);
  assert.equal(result.answers.qualityToolsReportFormat,undefined);
  const kkd='Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе';
  assert.ok(q.options.includes(kkd));assert.ok(!result.answers.qualityTools.includes(kkd));
  const selected=buildSurveyResult({...keep,qualityTools:[kkd]},getBacklogAnalyzed(keep));
  assert.deepEqual(new Set(selected.answers.qualityTools),new Set([...known,kkd]));
  assert.equal(selected.answers.qualityToolsReport,rawLinks);
  assert.equal(selected.answers.qualityToolsReportFormat,'link');
  const score=result.result.metrics.find(m=>m.code===q.metricCode);
  assert.equal(score.value,.25);assert.equal(score.maxValue,.5);
  assert.deepEqual(selected.result.metrics,result.result.metrics);
  assert.deepEqual(result.previousAnswers,history);assert.deepEqual(selected.previousAnswers,history);
  assert.equal(JSON.stringify(history),original);
});


test('Digital attraction funnel consistently includes registration wording without changing other teams', () => {
  for (const team of others) {
    const section=getSections({product:team.id}).find(s=>s.id==='attract');
    if(!section)continue;
    if(team.unit==='DP') {
      assert.equal(section.title,'Воронка привлечения/оформления');
      for(const q of section.questions.flatMap(q=>[q,...(q.action?[q.action]:[]),...(q.benchmark?[q.benchmark]:[])])) {
        if(/воронк[а-я]* привлечения/.test(q.title)) assert.match(q.title,/воронк[а-я]* привлечения\/оформления/);
      }
    } else assert.equal(section.title,'Воронка привлечения');
  }
});
