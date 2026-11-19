import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {otelloTeam, otelloTeams, otelloTeamGroups} from './otello.js';
import {getSurveyProfile, productSurveyProfiles} from './survey-profiles.js';
import {teams} from './teams.js';
import {getIntroSummary} from './intro.js';
import {getBacklogAnalyzed, getSections, hasAnswer, inlineQuestions, knownMechanics,
  needsComment, needsEvidence, needsProof, needsReason, visibleQuestions} from './questions.js';
import {buildSurveyResult} from './result.js';

const completedAt = '2026-11-10T12:00:00.000Z';
const researchExample = '  Исследование клиентского пути в III квартале\nВторая строка с выводами  ';
const catalogue = answers => getSections(answers).flatMap(section => section.questions);
const route = answers => getSections(answers).flatMap(section =>
  visibleQuestions(section, getBacklogAnalyzed(answers), answers));
const fields = answers => route(answers).flatMap(question => [question, ...inlineQuestions(question, answers)]);
const question = id => catalogue({product: otelloTeam.id}).find(item => item.id === id);
const result = answers => buildSurveyResult(answers, false, completedAt, otelloTeams);

function completeAnswers(team = otelloTeam) {
  const answers = {name: '  Тест Отелло\n', product: team.id, unit: team.unit};
  for (const q of catalogue(answers).flatMap(parent => [parent, ...inlineQuestions(parent)])) {
    if (['name', 'product'].includes(q.id)) continue;
    if (q.type === 'numeric') answers[q.id] = '1000';
    else if (q.type === 'links') answers[q.id] = 'https://example.test/goals';
    else if (q.type === 'multi') answers[q.id] = [q.options.includes('Затрудняюсь ответить')
      ? 'Затрудняюсь ответить' : q.options[0]];
    else if (q.type === 'radio') answers[q.id] = q.id === 'goalsMonitoring' || q.id === 'discovery'
      ? q.options[0] : q.options.includes('Нет') ? 'Нет' : q.options[0];
    else answers[q.id] = q.id === 'lastResearch' ? researchExample : '  Текст ответа\n';
  }
  for (const q of fields(answers)) {
    if (needsComment(q, answers)) answers[q.commentId] = '  Описание механик\n';
    if (needsReason(q, answers)) answers[q.reasonId] = 'Причина';
    if (needsEvidence(q, answers)) answers[q.inlineEvidence.formatId] = 'excel';
    if (needsProof(q, answers)) answers[q.inlineProof.id] = q.inlineProof.kind === 'metricSource'
      ? 'Запрос у аналитиков' : q.inlineProof.kind === 'backlog'
        ? 'jira.sberbank.ru/browse/OTELLO-1' : 'Описание источника';
  }
  return answers;
}

test('Otello has its own empty profile without changing the general team catalogue', () => {
  assert.deepEqual(otelloTeams, [otelloTeam]);
  assert.equal(otelloTeam.name, 'Отелло');
  assert.equal(otelloTeam.unit, 'Data', 'Use the unit explicitly confirmed by the user');
  assert.deepEqual(otelloTeam.mechanicScores, {});
  assert.equal(otelloTeamGroups.flatMap(group => group.options).length, 1);
  assert.deepEqual(otelloTeamGroups.map(group => group.label), ['Data']);
  assert.equal(otelloTeamGroups.flatMap(group => group.options)[0].value, otelloTeam.id);
  assert.equal(teams.length, 64);
  assert.ok(!teams.some(team => team.id === otelloTeam.id || team.name === 'Отелло'));
  assert.equal(Object.values(productSurveyProfiles).filter(profile => profile.fullSurvey).length, 6);
  const profile = getSurveyProfile(otelloTeam.id);
  assert.equal(profile.fullSurvey, true);
  assert.equal(profile.period, null);
  assert.equal(profile.backlogAnalyzed, false);
  assert.ok(profile.metrics.length > 0);
  assert.ok(profile.metrics.every(metric => metric.value === null));
  assert.equal(getBacklogAnalyzed({product: otelloTeam.id}), false);
});

test('Otello keeps every current full-product question and has no historical options or sources', () => {
  const reference = teams.find(team => getSurveyProfile(team.id)?.fullSurvey);
  const answers = {product: otelloTeam.id};
  const sections = getSections(answers);
  assert.deepEqual(sections.map(section => section.id),
    ['intro', 'metrics', 'goals', 'attract', 'churn', 'alerts', 'mechanics', 'crossSell', 'research', 'priorities']);
  const flatten = product => catalogue({product}).flatMap(parent => [parent, ...inlineQuestions(parent)]);
  assert.deepEqual(flatten(otelloTeam.id).filter(q => q.id !== 'lastResearch').map(q => q.id),
    flatten(reference.id).map(q => q.id));
  for (const id of ['marketRussia', 'marketSber', 'clients', 'mau', 'satellite', 'monitoring',
    'goalsMonitoring', 'goalsForecast', 'goalsFactorAnalysis', 'goalsDashboards',
    'attractConfigured', 'attractIncludes', 'attractAnalysis', 'churnConfigured', 'churnIncludes',
    'churnModel', 'churnAnalysis', 'alerts', 'systemAlerts', 'upsell', 'retentionMechanism',
    'returnMechanism', 'mechanicsMonitoring', 'crossSellAfter', 'discovery', 'discoveryBacklogType',
    'backlog', 'lastResearch', 'support']) assert.ok(flatten(otelloTeam.id).some(q => q.id === id), id);
  for (const q of flatten(otelloTeam.id)) {
    assert.equal(q.previousOptions, undefined, q.id);
    assert.equal(q.previousClickstreamUrl, undefined, q.id);
    assert.equal(q.inlineEvidence?.previousLinks, undefined, q.id);
    assert.deepEqual(knownMechanics(q, answers), [], q.id);
  }
  for (const id of ['attractConfigured', 'churnConfigured']) assert.ok(question(id).options.includes('Нет'));
  assert.equal(getIntroSummary(otelloTeam.id).sectionCount, 9);
  assert.ok(getIntroSummary(otelloTeam.id).survey.some(label => label.startsWith('Discovery')));
});

test('Otello result preserves the standard variable/schema contract and has no historical score', () => {
  const answers = completeAnswers();
  assert.ok(fields(answers).every(q => hasAnswer(q, answers)), 'Fixture completes the real route');
  const payload = result(answers);
  const referenceTeam = teams.find(team => getSurveyProfile(team.id)?.fullSurvey);
  const reference = buildSurveyResult(completeAnswers(referenceTeam), false, completedAt);
  assert.deepEqual(Object.keys(payload), Object.keys(reference));
  assert.deepEqual(Object.keys(payload.answers).filter(id => id !== 'lastResearch'), Object.keys(reference.answers));
  assert.deepEqual(Object.keys(payload.result), Object.keys(reference.result));
  const {lastResearch, ...sharedQuestionRows} = payload.questionRows;
  assert.deepEqual(sharedQuestionRows, reference.questionRows);
  assert.equal(lastResearch, 122);
  assert.equal(payload.answers.lastResearch, researchExample);
  assert.deepEqual(payload.questionSources.lastResearch, {sheet: 'Продукты (2)', row: 122});
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.surveyId, 'ddi-product-full-otello');
  assert.deepEqual(payload.team, {id: otelloTeam.id, name: 'Отелло', unit: 'Data'});
  assert.equal(payload.respondent.name, answers.name, 'Free text is not trimmed');
  assert.equal(payload.result.baselinePeriod, null);
  assert.equal(payload.result.baselinePoints, null);
  assert.equal(payload.result.baselineScorePct, null);
  assert.equal(payload.result.historicalBaselineAvailable, false);
  assert.equal(payload.result.status, 'provisional_self_report');
  assert.equal(payload.result.requiresBackendReview, true);
  assert.ok(payload.result.metrics.every(metric => metric.baselineValue === null));
  assert.deepEqual(payload.previousMechanics, []);
  assert.deepEqual(payload.previousFunnelElements, {});
  assert.deepEqual(payload.previousFunnelReports, {});
  assert.ok(!Object.values(payload.questionSources).some(source => source.previousSource));
  assert.throws(() => buildSurveyResult(answers), /Unsupported survey team/,
    'The general survey does not silently accept the isolated team');
});

test('Otello asks for a current research example and adapts banking language only in its own UI', () => {
  const research = getSections({product: otelloTeam.id}).find(section => section.id === 'research');
  assert.deepEqual(research.questions.map(q => q.id), ['discovery', 'backlog', 'lastResearch']);
  const example = question('lastResearch');
  assert.equal(example.title, 'Приведите пример исследований, которые проводились в рамках III квартала');
  assert.equal(example.row, 122);
  for (const value of ['', '  \n ']) {
    assert.equal(hasAnswer(example, {lastResearch: value}), false);
    assert.throws(() => result({...completeAnswers(), lastResearch: value}), /Incomplete survey/);
  }
  assert.equal(hasAnswer(example, {lastResearch: researchExample}), true);
  const noAnalysts = {...completeAnswers(), discovery: 'Нет аналитиков'};
  assert.ok(route(noAnalysts).some(q => q.id === 'lastResearch'));
  assert.equal(result(noAnalysts).answers.lastResearch, researchExample);
  const reference = teams.find(team => getSurveyProfile(team.id)?.fullSurvey);
  const referenceQuestions = catalogue({product: reference.id});
  for (const id of ['attractAnalysis', 'churnAnalysis']) {
    const oldOption = referenceQuestions.find(q => q.id === id).options.find(value => value.includes('экраны в СБОЛ'));
    assert.ok(oldOption, 'General product keeps its original banking wording');
    const expected = question(id).options.find(value => value.includes('экраны (UI/UX)'));
    assert.ok(expected);
    assert.doesNotMatch(expected, /СБОЛ|физическом канале/);
    const payload = result({...completeAnswers(), [id]: [expected]});
    assert.deepEqual(payload.answers[id], [expected], 'JSON must match the visible selected option');
  }
  const summary = getIntroSummary(otelloTeam.id);
  assert.doesNotMatch(JSON.stringify(summary), /СБОЛ|инициативы сверх БП/i);
  assert.doesNotMatch(JSON.stringify(catalogue({product: otelloTeam.id})), /экраны в СБОЛ/);
  const referenceSummary = getIntroSummary(reference.id);
  assert.ok(referenceSummary.digital.some(label => /инициативы сверх БП/.test(label)));
  assert.ok(referenceSummary.digital.some(label => /СБОЛ/.test(label)));
  assert.ok(!referenceQuestions.some(q => q.id === 'lastResearch'));
  assert.deepEqual(getSurveyProfile(otelloTeam.id).metrics.map(({code, max_value}) => ({code, max_value})),
    getSurveyProfile(reference.id).metrics.map(({code, max_value}) => ({code, max_value})),
    'UI adaptations do not alter the existing metric identifiers or weights');
});

test('Otello validates independent numeric/source, required comments and hidden funnel branches', () => {
  const numeric = question('mau');
  assert.equal(hasAnswer(numeric, {mau: '0'}), false);
  assert.equal(hasAnswer(numeric, {mauSource: 'Запрос у аналитиков'}), false);
  assert.equal(hasAnswer(numeric, {mau: '0', mauSource: 'Запрос у аналитиков'}), true);
  assert.equal(hasAnswer(numeric, {mauUnknown: true, mauSource: 'Запрос у аналитиков'}), true);
  const unknown = result({...completeAnswers(), mau: '', mauUnknown: true,
    mauSource: 'Затрудняюсь ответить', mauSourceLink: 'https://stale.test'});
  assert.equal(unknown.answers.mau, null);
  assert.equal(unknown.answers.mauUnknown, true);
  assert.ok(!('mauSourceLink' in unknown.answers));
  const alerts = question('alerts');
  assert.equal(hasAnswer(alerts, {alerts: 'Да'}), false);
  assert.equal(hasAnswer(alerts, {alerts: 'Частично', alertsComment: '  '}), false);
  assert.equal(hasAnswer(alerts, {alerts: 'Да', alertsComment: 'Настроено'}), true);
  for (const direction of ['attract', 'churn']) {
    const hidden = {...completeAnswers(), [`${direction}Configured`]: 'Нет',
      [`${direction}Includes`]: ['Объёмы'], [`${direction}Report`]: 'https://stale.test',
      [`${direction}ReportFormat`]: 'link'};
    assert.ok(!route(hidden).some(q => q.id === `${direction}Includes`));
    assert.ok(route(hidden).some(q => q.id === `${direction}Analysis`));
    const payload = result(hidden);
    assert.ok(!(`${direction}Includes` in payload.answers));
    assert.ok(!(`${direction}Report` in payload.answers));
  }
});

test('Otello Discovery and mechanism details use the same conditional required branches', () => {
  const discovery = question('discovery');
  const parent = {...completeAnswers(), discovery: 'Больше 80%', discoveryBacklogType: undefined};
  assert.equal(hasAnswer(discovery, parent), false);
  const own = {...parent, discoveryBacklogType: 'Собственный бэклог в Jira/SberTrack'};
  assert.equal(hasAnswer(discovery, {...own, backlog: 'https://confluence.sberbank.ru/page'}), false);
  const rawBacklog = '  jira.sberbank.ru/browse/OTELLO-1\nhttps://sbertrack.sberbank.ru/OTELLO-2  ';
  assert.equal(hasAnswer(discovery, {...own, backlog: rawBacklog}), true);
  assert.equal(result({...own, backlog: rawBacklog}).answers.backlog, rawBacklog);
  for (const type of ['Задачи ведет Штаб в Jira/SberTrack', 'Бэклог ведется вне Jira/SberTrack']) {
    const payload = result({...own, discoveryBacklogType: type, backlog: rawBacklog,
      discoveryBacklogComment: '  Комментарий\n'});
    assert.ok(!('backlog' in payload.answers));
    assert.equal(payload.answers.discoveryBacklogComment, '  Комментарий\n');
  }
  for (const answer of ['Нет аналитиков', 'Затрудняюсь ответить']) {
    const payload = result({...own, discovery: answer, backlog: rawBacklog});
    assert.ok(!('backlog' in payload.answers));
    assert.ok(!('discoveryBacklogType' in payload.answers));
  }
  const mechanics = question('upsell');
  const selected = {...completeAnswers(), upsell: ['Удержание клиентов', 'Возврат клиентов'], mechanics: 'Описание',
    retentionMechanism: undefined, returnMechanism: undefined};
  assert.equal(hasAnswer(mechanics, selected), false);
  const described = {...selected, retentionMechanism: ['Затрудняюсь ответить'], returnMechanism: ['Создание ценности']};
  assert.equal(hasAnswer(mechanics, described), true);
  assert.deepEqual(result(described).answers.returnMechanism, ['Создание ценности']);
});

test('Otello standalone works offline, completes the survey, and invalidates the result on editing', async () => {
  const html = readFileSync(new URL('../../dist-otello-survey/otello-survey.html', import.meta.url), 'utf8');
  const parsed = new JSDOM(html);
  assert.equal(parsed.window.document.querySelector('script[src],link[rel="stylesheet"],iframe'), null);
  assert.ok([...parsed.window.document.querySelectorAll('img')].every(img => img.src.startsWith('data:')));
  parsed.window.close();
  const script = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)[1];
  const errors = [];
  const dom = new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/, ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'file:///otello-survey.html',
    beforeParse(window) {
      window.scrollTo = () => {};
      window.matchMedia = () => ({matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}});
      window.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
      window.fetch = () => {throw new Error('Unexpected network request');};
      window.addEventListener('error', event => errors.push(event.message));
    },
  });
  const pause = () => new Promise(resolve => setTimeout(resolve, 25));
  const doc = dom.window.document;
  const write = async (control, value) => {
    assert.ok(control, 'Expected editable field');
    const prototype = control.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, value);
    control.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
    await pause();
  };
  const click = async text => {
    const button = [...doc.querySelectorAll('button')].find(node => node.textContent.trim().includes(text));
    assert.ok(button, `Button: ${text}`); button.click(); await pause();
  };
  const choose = async (text, scope = doc.querySelector('.survey-single-question')) => {
    const label = [...scope.querySelectorAll('label')].find(node => node.textContent.trim() === text);
    assert.ok(label, `Choice: ${text}`); label.querySelector('input').click(); await pause();
  };
  try {
    dom.window.eval(script); await pause();
    assert.deepEqual(JSON.parse(JSON.stringify(dom.window.DDI_SURVEY_TEAMS)),
      [{id: otelloTeam.id, name: 'Отелло', unit: 'Data'}]);
    assert.equal(dom.window.DDI_SURVEY_RESULT_JSON, null);
    assert.doesNotMatch(doc.querySelector('.survey-intro-copy').textContent, /собрана при оценке за второй квартал/);
    await write(doc.querySelector('input[placeholder="Введите ФИО"]'), 'Тест Отелло');
    doc.querySelector('[role="combobox"]').click(); await pause();
    const options = [...doc.querySelectorAll('[role="option"]')].filter(option => option.textContent.trim() === 'Отелло');
    assert.equal(options.length, 1);
    options[0].click(); await pause();
    assert.doesNotMatch(doc.querySelector('.survey-source-table').textContent, /СБОЛ|инициативы сверх БП/i);
    await click('Далее');
    const visited = [];
    while (doc.querySelector('form')) {
      const id = doc.querySelector('.survey-single-question').dataset.questionId;
      visited.push(id); assert.ok(visited.length < 40, 'Survey reaches review');
      assert.equal(doc.querySelector('.survey-known-mechanic,.survey-known-funnel,.survey-previous-evidence'), null);
      assert.doesNotMatch(doc.querySelector('.survey-single-question').textContent, /СБОЛ/);
      if (['marketRussia', 'marketSber', 'clients', 'mau'].includes(id)) {
        await write(doc.querySelector('input[inputmode="numeric"]'), '1234567');
        assert.equal(doc.querySelector('input[inputmode="numeric"]').value, '1 234 567');
        await choose('Запрос у аналитиков');
      } else if (id === 'goalsMonitoring') {
        await choose('Да (включены все цели)');
        for (const card of doc.querySelectorAll('.survey-goals-question')) await choose('Нет', card);
        await choose('Отчетность в формате Excel');
      } else if (['attractConfigured', 'churnConfigured'].includes(id)) await choose('Да, автоматическая (monthly/weekly)');
      else if (id === 'discovery') {
        await choose('Больше 80%');
        await choose('Собственный бэклог в Jira/SberTrack');
        await write(doc.querySelector('textarea'), 'jira.sberbank.ru/browse/OTELLO-1');
      } else if (id === 'lastResearch') {
        assert.equal(visited.at(-2), 'discovery', 'Research example follows Discovery and its inline backlog');
        assert.equal(doc.querySelector('h1').textContent, 'Приведите пример исследований, которые проводились в рамках III квартала');
        await click('Далее');
        assert.match(doc.querySelector('[role="alert"]').textContent, /Заполните обязательные поля/);
        await write(doc.querySelector('textarea'), researchExample);
      } else if (['attractAnalysis', 'churnAnalysis'].includes(id)) {
        await choose(question(id).options.find(value => value.includes('экраны (UI/UX)')));
      } else if (['monitoring', 'attractIncludes', 'churnIncludes', 'upsell'].includes(id)) await choose('Затрудняюсь ответить');
      else if (['churnModel', 'systemAlerts', 'alerts', 'crossSellAfter'].includes(id)) await choose('Нет');
      else if (id === 'support') await choose('Нехватка аналитических ресурсов (DA/DS/DE)');
      else await write(doc.querySelector('textarea,input:not([type="checkbox"]):not([type="radio"])'), 'Текст ответа');
      const next = [...doc.querySelectorAll('.survey-actions button')].find(button => button.textContent.includes('Далее'));
      assert.notEqual(next.getAttribute('aria-disabled'), 'true', `Complete screen: ${id}`);
      next.click(); await pause();
    }
    for (const id of ['marketRussia', 'marketSber', 'attractIncludes', 'churnIncludes', 'discovery', 'lastResearch']) assert.ok(visited.includes(id), id);
    await click('Завершить опрос');
    const payload = JSON.parse(dom.window.DDI_SURVEY_RESULT_JSON);
    assert.equal(payload.team.name, 'Отелло');
    assert.equal(payload.result.baselinePeriod, null);
    assert.equal(payload.answers.marketRussia, '1234567');
    assert.equal(payload.answers.backlog, 'jira.sberbank.ru/browse/OTELLO-1');
    assert.equal(payload.answers.lastResearch, researchExample);
    for (const id of ['attractAnalysis', 'churnAnalysis']) {
      assert.deepEqual(payload.answers[id], [question(id).options.find(value => value.includes('экраны (UI/UX)'))]);
    }
    assert.deepEqual(payload.previousMechanics, []);
    assert.match(doc.body.textContent, /Вы прошли опрос/);
    assert.doesNotMatch(doc.body.textContent, /DDI_SURVEY_RESULT_JSON|provisional_self_report|scorePct/);
    await click('Вернуться к ответам');
    assert.equal(dom.window.DDI_SURVEY_RESULT_JSON, null);
    const row = [...doc.querySelectorAll('.review-answer')].find(node => node.querySelector('b')?.textContent === 'Представьтесь, пожалуйста');
    assert.ok(row); row.querySelector('button').click(); await pause();
    await write(doc.querySelector('input[placeholder="Введите ФИО"]'), 'Изменённое имя');
    await click('Сохранить и вернуться'); await click('Завершить опрос');
    assert.equal(JSON.parse(dom.window.DDI_SURVEY_RESULT_JSON).respondent.name, 'Изменённое имя');
    assert.deepEqual(errors, []);
  } finally {dom.window.close();}
});
