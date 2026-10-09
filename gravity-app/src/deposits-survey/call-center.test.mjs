import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {callCenterBaseline, callCenterSections} from './call-center.js';
import {correctTypos, formatNumericAnswer, getBacklogAnalyzed, getSections, hasAnswer, knownMechanics, normalizeNumericAnswer, toggleOption, visibleQuestions} from './questions.js';
import {buildSurveyResult} from './result.js';
import {enabledTeam, enabledTeams} from './teams.js';

const callCenter = enabledTeams.find(team => team.name === 'Колл-центр');
const retention = 'Удержания клиента (при обращении по закрытию продукта клиентом)';
const route = answers => getSections(answers).flatMap(section =>
  visibleQuestions(section, getBacklogAnalyzed(answers), answers));
const ids = answers => route(answers).map(question => question.id);

function completeCallCenterAnswers() {
  const answers = {name: 'Тест', product: callCenter.id, unit: callCenter.unit};
  for (const question of route(answers)) {
    if (question.id in answers) continue;
    answers[question.id] = question.type === 'multi' ? [question.options[0]] : 'Описание';
  }
  answers.ccChannelMechanics = [retention];
  answers.ccCalls = '12,5';
  answers.ccFcr = '75,3';
  answers.ccRetentionMechanic = ['Настроен спец. сценарий по удержанию по закрытию продукта'];
  answers.ccEntryIncludes = ['Пошаговая воронка'];
  answers.ccGoalsReporting = ['Прогноз по целям'];
  for (const question of route(answers)) {
    if (question.id in answers) continue;
    answers[question.id] = question.type === 'multi' ? [question.options[0]] : 'https://example.test/report';
  }
  return answers;
}

test('call center uses its Phigital channel questions and excludes already-maximized Discovery', () => {
  assert.equal(callCenter.id, callCenterBaseline.teamId);
  assert.equal(callCenter.unit, 'PC');
  assert.deepEqual(callCenterSections.map(section => section.id),
    ['callCenterMetrics', 'callCenterGoals', 'callCenterEntry', 'callCenterMechanics']);
  assert.deepEqual(callCenterSections.flatMap(section => section.questions.map(question => question.row)),
    [17, 19, 25, 31, 39, 52, 107, 134, 138]);
  assert.deepEqual(getSections({product: callCenter.id}).at(-1).questions.map(q => [q.row, q.sheet]),
    [[147, 'Каналы Phigital'], [155, 'Каналы Phigital']]);
  assert.deepEqual(ids({product: callCenter.id}),
    ['name', 'product', 'ccCalls', 'ccFcr', 'ccMonitoring', 'ccGoalsReporting',
      'ccEntryIncludes', 'ccChannelMechanics', 'priorities', 'support']);
  assert.ok(!ids({product: callCenter.id}).some(id => ['marketRussia', 'marketSber', 'clients', 'mau', 'discovery', 'backlog'].includes(id)));
  assert.equal(getBacklogAnalyzed({product: callCenter.id}), false);
  assert.equal(getBacklogAnalyzed({product: enabledTeam.id}), false);
  assert.ok(ids({product: enabledTeam.id}).includes('marketRussia'), 'Deposits route remains available');
  for (const question of route({product: callCenter.id})) assert.equal(question.optional, undefined);
});

test('call center conditional evidence requires an affirmative parent and a real answer', () => {
  const base = {product: callCenter.id};
  assert.ok(!ids({...base, ccEntryIncludes: ['Затрудняюсь ответить']}).includes('ccEntryReport'));
  assert.ok(ids({...base, ccEntryIncludes: ['Пошаговая воронка']}).includes('ccEntryReport'));
  assert.ok(!ids({...base, ccChannelMechanics: ['Затрудняюсь ответить']}).includes('ccRetentionMechanic'));
  const positive = {...base, ccChannelMechanics: [retention]};
  assert.ok(ids(positive).includes('ccRetentionMechanic'));
  assert.ok(!ids(positive).includes('ccMechanicsMetrics'));
  const configured = {...positive, ccRetentionMechanic: ['Настроен спец. сценарий по удержанию по закрытию продукта']};
  assert.ok(ids(configured).includes('ccMechanicsMetrics'));
  assert.ok(!ids({...positive, ccRetentionMechanic: ['Затрудняюсь ответить']}).includes('ccMechanicsMetrics'));
  const proof = route({...positive, ccEntryIncludes: ['Пошаговая воронка']}).find(q => q.id === 'ccEntryReport');
  assert.equal(hasAnswer(proof, {...positive, ccEntryReport: '   '}), false);
  assert.equal(hasAnswer(proof, {...positive, ccEntryReport: 'https://example.test/report'}), true);
  const retentionProof = route(configured).find(q => q.id === 'ccMechanicsMetrics');
  assert.equal(hasAnswer(retentionProof, {...configured, ccMechanicsMetrics: ''}), false);
  const mechanics = callCenterSections.flatMap(section => section.questions).find(q => q.id === 'ccChannelMechanics');
  assert.equal(knownMechanics(mechanics, positive).length, 4);
  assert.equal(mechanics.options[0], 'Автоматизации (автоклассификация обращений, распределения очередей / сплитов /лидов)');
  assert.equal(correctTypos(mechanics.options[0]), 'Автоматизация: классификация обращений, распределение очередей, сплитов и лидов');
  assert.equal(hasAnswer(mechanics, {...base, ccChannelMechanics: mechanics.knownOptions}), false);
  assert.equal(hasAnswer(mechanics, positive), true);
  assert.equal(mechanics.dividerBefore, 'Не настроены дополнительные механики');
  for (const negative of ['Не настроены дополнительные механики',
    'Предложенные варианты неподходят для моего продукта', 'Затрудняюсь ответить']) {
    assert.deepEqual(toggleOption([retention], negative), [negative]);
    assert.deepEqual(toggleOption([negative], retention), [retention]);
    assert.equal(hasAnswer(mechanics, {...base, ccChannelMechanics: [negative]}), true);
    assert.ok(!ids({...base, ccChannelMechanics: [negative]}).includes('ccRetentionMechanic'));
    assert.ok(!ids({...base, ccChannelMechanics: [negative]}).includes('ccMechanicsMetrics'));
  }
});

test('call center decimal metrics normalize pasted text and require a complete number', () => {
  const questions = callCenterSections.flatMap(section => section.questions);
  for (const id of ['ccCalls', 'ccFcr']) {
    const question = questions.find(item => item.id === id);
    assert.equal(question.type, 'numeric');
    assert.equal(question.allowDecimal, true);
    assert.match(question.title, /\(Колл-центр, Чат\)/, 'Source wording is retained');
    assert.doesNotMatch(correctTypos(question.title), /\(Колл-центр, Чат\)/);
    for (const invalid of ['', 'abc', '12,', '12.5', '12 345,6']) {
      assert.equal(hasAnswer(question, {[id]: invalid}), false);
    }
    for (const valid of ['0', '12345', '12,5']) assert.equal(hasAnswer(question, {[id]: valid}), true);
  }
  assert.equal(normalizeNumericAnswer('12 абв 345.67!', true), '12345,67');
  assert.equal(formatNumericAnswer('12345,67'), '12 345,67');
  assert.equal(normalizeNumericAnswer('1.234.5', true), '1,2345');
  assert.equal(normalizeNumericAnswer('abc1234567', false), '1234567');
  assert.equal(formatNumericAnswer('1234567'), '1 234 567');
});

test('call center completion is team specific and excludes stale hidden answers', () => {
  const answers = completeCallCenterAnswers();
  for (const question of route(answers)) {
    const incomplete = {...answers, [question.id]: undefined};
    assert.equal(hasAnswer(question, incomplete), false, `${question.id} is mandatory`);
    assert.throws(() => buildSurveyResult(incomplete, false),
      question.id === 'product' ? /Unsupported survey team/ : /Incomplete/,
      `${question.id} blocks completion`);
  }
  const result = buildSurveyResult(answers, getBacklogAnalyzed(answers), '2026-10-09T00:00:00Z');
  assert.equal(result.surveyId, 'ddi-call-center');
  assert.deepEqual(result.team, {id: callCenter.id, name: 'Колл-центр', unit: 'PC'});
  assert.equal(result.result.requiresBackendReview, true);
  assert.equal(result.result.metrics.length, callCenterBaseline.metrics.length);
  assert.equal(result.result.metrics.find(metric => metric.code === 'goals.forecast').value, 1);
  assert.equal(result.result.metrics.find(metric => metric.code === 'mehaniki.uderzhaniya_klienta').value, 1);
  assert.equal(result.result.metrics.find(metric => metric.code === 'general.navigator_reporting_knowledge').value, 0.5);
  assert.equal(result.result.metrics.find(metric => metric.code === 'hyp.ab_tests').source, 'ddi_baseline');
  assert.equal(result.previousMechanics.length, 4);
  assert.deepEqual(result.questionSources.name, {sheet: 'Каналы Phigital', row: 3});
  assert.deepEqual(result.questionSources.product, {source: 'ddi_team_catalog', sheet: null, row: null});
  assert.deepEqual(result.questionSources.ccCalls, {sheet: 'Каналы Phigital', row: 17});
  assert.deepEqual(result.questionSources.priorities, {sheet: 'Каналы Phigital', row: 147});
  assert.deepEqual(result.questionSources.support, {sheet: 'Каналы Phigital', row: 155});
  assert.ok(!('marketRussia' in result.answers));
  assert.throws(() => buildSurveyResult({...answers, ccMechanicsMetrics: '   '}, true), /Incomplete/);

  const hidden = {...answers, ccEntryIncludes: ['Затрудняюсь ответить'], ccChannelMechanics: ['Затрудняюсь ответить']};
  const cleaned = buildSurveyResult(hidden, true);
  assert.ok(!('ccEntryReport' in cleaned.answers));
  assert.ok(!('ccRetentionMechanic' in cleaned.answers));
  assert.ok(!('ccMechanicsMetrics' in cleaned.answers));
  assert.equal(cleaned.result.metrics.find(metric => metric.code === 'mehaniki.uderzhaniya_klienta').value, 0);
  const unknownRetention = buildSurveyResult({...answers,
    ccRetentionMechanic: ['Затрудняюсь ответить']}, false);
  assert.ok('ccRetentionMechanic' in unknownRetention.answers);
  assert.ok(!('ccMechanicsMetrics' in unknownRetention.answers), 'Unknown retention hides its old proof');
  for (const [choice, expected] of [
    ['Дашборд в Навигаторе (доступна часть метрик)', 0.25],
    ['Затрудняюсь ответить', 0],
  ]) {
    const changed = buildSurveyResult({...answers, ccMonitoring: [choice]}, false);
    assert.equal(changed.result.metrics.find(metric => metric.code === 'general.navigator_reporting_knowledge').value, expected);
  }
});

test('entry funnel completeness counts eight standard elements and excludes custom text', () => {
  const answers = completeCallCenterAnswers();
  const question = route(answers).find(q => q.id === 'ccEntryIncludes');
  const standard = question.options.slice(0, 8);
  assert.equal(standard.length, 8);
  for (const [selected, expected] of [
    [standard, 0.5],
    [['Что-то еще? Напишите'], 0],
    [[...standard, 'Что-то еще? Напишите'], 0.5],
  ]) {
    const scenario = {...answers, ccEntryIncludes: selected, ccEntryIncludesOther: 'Свой элемент'};
    const result = buildSurveyResult(scenario, false);
    assert.equal(result.result.metrics.find(metric => metric.code === 'voronka_vhoda_v_kanal.polnota_otcheta').value, expected);
  }
});

test('switching teams clears answers from the previous team in the autonomous page', async () => {
  const html = readFileSync(new URL('../../dist-deposits-survey/deposits-survey.html', import.meta.url), 'utf8');
  const script = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'Autonomous bundle has an inline script');
  const errors = [];
  const dom = new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/, ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(window) {
      window.scrollTo = () => {};
      window.matchMedia = () => ({matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}});
      window.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
      window.addEventListener('error', event => errors.push(event.message));
    },
  });
  dom.window.eval(script);
  const doc = dom.window.document;
  const pause = () => new Promise(resolve => setTimeout(resolve, 40));
  const currentId = () => doc.querySelector('.survey-single-question')?.dataset.questionId;
  const button = label => [...doc.querySelectorAll('button')].find(item => item.textContent.includes(label));
  const setInput = async value => {
    const input = doc.querySelector('.survey-single-question input');
    assert.ok(input);
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
    await pause();
  };
  const next = async () => {button('Далее').click(); await pause();};
  const back = async () => {button('Назад').click(); await pause();};
  const selectTeam = async (name, search = name) => {
    doc.querySelector('[role="combobox"]').click(); await pause();
    const filter = doc.querySelector('.survey-team-popup input');
    if (filter) {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(filter, search);
      filter.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
      await pause();
    }
    const option = [...doc.querySelectorAll('[role="option"], .g-select-list__option, .g-list__item')]
      .find(item => item.textContent.trim() === name);
    assert.ok(option, `Team option ${name} is available`);
    option.click(); await pause();
  };
  try {
    await pause();
    assert.equal(currentId(), 'name');
    await setInput('Тест'); await next();
    assert.equal(currentId(), 'product');
    await selectTeam('Колл-центр', 'koll-centr'); await next();
    assert.equal(currentId(), 'ccCalls');
    assert.doesNotMatch(doc.querySelector('h1').textContent, /\(Колл-центр, Чат\)/);
    assert.equal(doc.querySelector('.survey-single-question input').getAttribute('inputmode'), 'decimal');
    await setInput('abc');
    assert.equal(doc.querySelector('.survey-single-question input').value, '');
    assert.equal(button('Далее').disabled, true);
    await setInput('12 абв 345.67!');
    assert.equal(doc.querySelector('.survey-single-question input').value, '12 345,67');
    assert.equal(button('Далее').disabled, false);
    await next();
    assert.equal(currentId(), 'ccFcr');
    assert.doesNotMatch(doc.querySelector('h1').textContent, /\(Колл-центр, Чат\)/);
    await back(); await back();
    await selectTeam('Вклады+НС', 'vklady'); await next();
    assert.equal(currentId(), 'marketRussia');
    assert.equal(doc.querySelector('.survey-single-question input').value, '');
    await setInput('999'); await back();
    await selectTeam('Колл-центр', 'KoLl-CeNtR'); await next();
    assert.equal(currentId(), 'ccCalls');
    assert.equal(doc.querySelector('.survey-single-question input').value, '', 'Call center answer was reset');
    assert.equal(dom.window.DDI_SURVEY_RESULT_JSON, null);
    assert.deepEqual(errors, []);
  } finally {dom.window.close();}
});
