import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {buildSurveyResult} from './result.js';
import {scoringBaseline} from './scoring-baseline.js';
import {enabledTeam, enabledTeams, filterTeamOption, teamGroups, teams} from './teams.js';
import {correctTypos, getSections, hasAnswer, hasEvidence, indicatesPresence, knownMechanics, needsComment, needsEvidence, needsProof, questionOptions, sections, toggleOption, visibleQuestions} from './questions.js';

test('team selector contains the final index catalog and enables deposits and call center', () => {
  assert.equal(teams.length, 83);
  assert.equal(teamGroups.length, 8);
  assert.deepEqual(teamGroups.map(g => g.label), ['CBP', 'CX', 'Data', 'DB', 'DP', 'PC', 'ДомКлик', 'УБ']);
  for (const group of teamGroups) for (const option of group.options) assert.equal(teams.find(team => team.id === option.value).unit, group.label);
  assert.equal(teamGroups.flatMap(g => g.options).filter(o => !o.disabled).length, 2);
  assert.deepEqual(enabledTeams.map(team => team.name), ['Вклады+НС', 'Колл-центр']);
  assert.equal(enabledTeam.name, 'Вклады+НС');
  assert.equal(enabledTeam.unit, 'CBP');
  assert.ok(!sections.flatMap(s => s.questions).some(q => q.id === 'unit'));
  assert.deepEqual(teamGroups.map(g => g.label), teamGroups.map(g => g.label).sort((a,b) => new Intl.Collator('en', {sensitivity: 'base', numeric: true}).compare(a, b)));
  for (const group of teamGroups) assert.deepEqual(group.options.map(o => o.content), group.options.map(o => o.content).sort((a,b) => new Intl.Collator('en', {sensitivity: 'base', numeric: true}).compare(a, b)));
});

test('team search accepts Cyrillic, Latin transliteration and existing English names', () => {
  const option = name => teamGroups.flatMap(group => group.options).find(item => item.content === name);
  for (const team of teams) assert.equal(filterTeamOption(option(team.name), ''), true);
  for (const [name, search] of [
    ['Вклады+НС', 'вклады'], ['Вклады+НС', 'vklady'], ['Вклады+НС', 'VkLaDy'],
    ['Колл-центр', 'колл'], ['Колл-центр', 'koll-centr'],
    ['ОСАГО', 'osago'], ['ОСАГО', 'ОСАГО'],
    ['Top Affluent', 'top affluent'], ['SberID', 'SBERID'],
  ]) assert.equal(filterTeamOption(option(name), search), true, `${search} finds ${name}`);
  assert.equal(filterTeamOption(option('Вклады+НС'), 'unknown-team-name'), false);
});

test('TAM, SAM, clients and MAU require digits', () => {
  const numeric = sections.flatMap(s => s.questions).filter(q => q.type === 'numeric');
  assert.deepEqual(numeric.map(q => q.id), ['marketRussia', 'marketSber', 'clients', 'mau']);
  for (const q of numeric) {
    for (const value of ['', 'abc', '1e3', '-1', '1.5', '12 000']) assert.equal(hasAnswer(q, {[q.id]: value}), false);
    for (const value of ['0', '12000']) assert.equal(hasAnswer(q, {[q.id]: value}), true);
  }
});

test('mechanics relevance, multiple selection and conditional mandatory comment', () => {
  const q = sections.flatMap(s => s.questions).find(q => q.id === 'upsell');
  const positive = ['Удержание клиентов', 'Возврат клиентов', 'Допродажи (upsell)'];
  assert.equal(q.type, 'multi');
  assert.equal(q.options[3], 'Не настроены дополнительные механики');
  assert.equal(q.title, 'Какие продуктовые механики были настроены по вашему продукту?');
  assert.deepEqual(questionOptions(q, {product: enabledTeam.id}), q.options);
  assert.deepEqual(knownMechanics(q, {product: enabledTeam.id}), positive.slice(0, 2));
  assert.equal(hasAnswer(q, {product: enabledTeam.id, upsell: [positive[0]]}), false);
  assert.equal(needsComment(q, {product: enabledTeam.id, upsell: [positive[0]]}), false);
  assert.equal(needsComment(q, {product: enabledTeam.id, upsell: [positive[2]]}), true);
  const otherTeam = teams.find(t => t.id !== enabledTeam.id);
  assert.deepEqual(questionOptions(q, {product: otherTeam.id}), q.options);
  const combined = toggleOption([positive[0]], positive[1]);
  assert.deepEqual(combined, positive.slice(0, 2));
  assert.equal(needsComment(q, {upsell: combined}), true);
  assert.equal(hasAnswer(q, {upsell: combined}), false);
  assert.equal(hasAnswer(q, {upsell: combined, mechanics: '   '}), false);
  assert.equal(hasAnswer(q, {upsell: combined, mechanics: 'Описание'}), true);
  for (const negative of q.options.slice(3)) {
    assert.deepEqual(toggleOption(combined, negative), [negative]);
    assert.deepEqual(toggleOption([negative], positive[2]), [positive[2]]);
    assert.equal(needsComment(q, {upsell: [negative]}), false);
    assert.equal(hasAnswer(q, {upsell: [negative]}), true);
  }
});

function completedAnswers() {
  const answers = {product: enabledTeam.id, unit: enabledTeam.unit};
  for (const q of sections.flatMap(s => s.questions)) {
    if (q.id === 'product') continue;
    if (q.type === 'numeric') answers[q.id] = '1000';
    else if (q.type === 'multi') answers[q.id] = q.id === 'upsell' ? ['Допродажи (upsell)'] : [q.options[0]];
    else if (q.type === 'radio') answers[q.id] = q.options[0];
    else answers[q.id] = 'Описание';
  }
  answers.attractReportFormat = 'link';
  answers.attractReport = 'https://example.test/attract-report';
  answers.churnReportFormat = 'link';
  answers.churnReport = 'https://example.test/churn-report';
  return answers;
}

test('hidden result calculates versioned provisional metrics and preserves baseline', () => {
  const answers = completedAnswers();
  answers.monitoring = ['Дашборд в Навигаторе (доступны все метрики)', 'Дашборд в Навигаторе (доступна часть метрик)'];
  for (const id of ['attractIncludes', 'churnIncludes']) answers[id] = sections.flatMap(s => s.questions).find(q => q.id === id).options.slice(0, -1);
  for (const id of ['attractAnalysis', 'churnAnalysis']) answers[id] = ['Все перечисленное выше'];
  const result = buildSurveyResult(answers, false, '2026-10-09T00:00:00Z');
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.completedAt, '2026-10-09T00:00:00Z');
  assert.equal(result.team.id, enabledTeam.id);
  assert.equal(result.team.unit, 'CBP');
  assert.deepEqual(result.questionSources.product, {source: 'ddi_team_catalog', sheet: null, row: null});
  assert.equal(result.result.requiresBackendReview, true);
  assert.ok(result.result.metrics.every(metric => typeof metric.rule === 'string' && metric.rule.length > 0));
  assert.deepEqual(result.previousMechanics, ['Удержание клиентов', 'Возврат клиентов']);
  assert.equal(result.result.metrics.find(m => m.code === 'general.navigator_reporting_knowledge').value, 0.5);
  assert.equal(result.result.metrics.find(m => m.code === 'attract.report_completeness').value, 0.5);
  assert.equal(result.result.metrics.find(m => m.code === 'churn.funnel_analysis').value, 1);
  assert.equal(result.result.metrics.find(m => m.code === 'mehaniki.uderzhanie_klientov').source, 'ddi_baseline');
  assert.equal(result.result.metrics.find(m => m.code === 'mehaniki.doprodazhi_up_sell').value, 1);
  assert.equal(result.result.metrics.find(m => m.code === 'attract.regulyarnostь').includedInIndex, false);
  for (const metric of result.result.metrics.filter(m => m.source === 'ddi_baseline')) assert.equal(metric.value, scoringBaseline.metrics.find(m => m.code === metric.code).value);
  assert.ok(result.result.points <= result.result.maxPoints);
  assert.ok(result.result.scorePct >= 0 && result.result.scorePct <= 100);
  answers.benchmarksAttract = 'Нет';
  answers.upsell = ['Не настроены дополнительные механики'];
  answers.alerts = 'Частично';
  const negative = buildSurveyResult(answers);
  assert.ok(!('benchmarkAttractProof' in negative.answers));
  assert.ok(!('mechanics' in negative.answers));
  assert.equal(negative.result.metrics.find(m => m.code === 'attract.benchmarks').value, 0);
  assert.equal(negative.result.metrics.find(m => m.code === 'alerts.business_metrics').value, 0.5);
  assert.equal(negative.result.metrics.find(m => m.code === 'mehaniki.doprodazhi_up_sell').value, 0);
  assert.throws(() => buildSurveyResult({...answers, mau: ''}), /Incomplete/);
});

test('support allows multiple choices and requires an explanation for Other', () => {
  const q = sections.flatMap(s => s.questions).find(q => q.id === 'support');
  assert.equal(q.type, 'multi');
  assert.equal(q.options.length, 9);
  assert.equal(q.optionGroups.length, 6);
  assert.deepEqual(q.optionGroups.filter(g => g.column === 1).map(g => g.title), ['Инструменты и BI', 'Автоматизация мониторинга', 'A/B и ресерч']);
  assert.deepEqual(q.optionGroups.flatMap(g => g.indices).sort((a, b) => a - b), [...Array(9).keys()]);
  assert.deepEqual(q.optionGroups.map(g => [g.title, g.column, g.gridRow]), [
    ['Аналитические ресурсы', 0, '1'], ['Инструменты и BI', 1, '1'],
    ['Данные и витрины', 0, '2 / 4'], ['Автоматизация мониторинга', 1, '2'],
    ['A/B и ресерч', 1, '3'], ['Другое', 0, '4'],
  ]);
  assert.equal(q.optionGroups.find(g => g.title === 'A/B и ресерч').alignEnd, true);
  assert.equal(new Set(q.optionGroups.flatMap(g => g.indices)).size, 9);
  assert.ok(!q.options.includes('Долгие сроки формирования витрин'));
  for (const team of enabledTeams) {
    const support = getSections({product: team.id}).flatMap(s => s.questions).find(item => item.id === 'support');
    assert.deepEqual(support.options, q.options, `${team.name}: same nine available choices`);
    assert.deepEqual(support.optionGroups.flatMap(g => g.indices).sort((a, b) => a - b), [...Array(9).keys()]);
  }
  assert.equal(q.options.at(-1), 'Другое');
  assert.equal(hasAnswer(q, {support: [q.options[0], q.options[1]]}), true);
  assert.equal(hasAnswer(q, {support: ['Долгие сроки формирования витрин']}), false);
  assert.equal(hasAnswer(q, {support: [q.options[0], 'Долгие сроки формирования витрин']}), true);
  assert.equal(hasAnswer(q, {support: ['Другое']}), false);
  assert.equal(hasAnswer(q, {support: ['Другое'], supportOther: '   '}), false);
  assert.equal(hasAnswer(q, {support: [q.options[0], 'Другое'], supportOther: 'Нужен доступ'}), true);
  const answers = completedAnswers();
  answers.support = [q.options[0], 'Другое'];
  answers.supportOther = 'Нужен доступ';
  assert.equal(buildSurveyResult(answers).answers.supportOther, 'Нужен доступ');
  answers.support = [q.options[0]];
  assert.ok(!('supportOther' in buildSurveyResult(answers).answers));
  answers.support = [q.options[0], 'Долгие сроки формирования витрин'];
  assert.deepEqual(buildSurveyResult(answers).answers.support, [q.options[0]]);
  answers.support = ['Долгие сроки формирования витрин'];
  assert.throws(() => buildSurveyResult(answers), /Incomplete/);
});

test('display corrections preserve source option values', () => {
  const original = 'Сегментный/ кагортный разрез';
  assert.equal(correctTypos(original), 'Сегментный/когортный разрез');
  assert.equal(correctTypos('Выберете ваш юнит'), 'Выберите ваш юнит');
  assert.ok(sections.flatMap(s => s.questions).some(q => q.options?.includes(original)));
});

test('questionnaire follows the approved Excel selection and backlog condition', () => {
  const expected = [3, 4, 15, 17, 19, 21, 23, 24, 38, 49, 61, 72, 80, 80, 83, 88, 91, 96, 100, 115, 122, 123, 131];
  const bothYes = {benchmarksAttract: 'Да', benchmarksChurn: 'Да', attractIncludes: ['Объёмы'], churnIncludes: ['Объёмы'], deviations: 'Да', upsell: 'Допродажи (upsell)', discovery: 'От 40 до 79%'};
  assert.deepEqual(sections.flatMap(s => visibleQuestions(s, false, bothYes).map(q => q.row)), expected);
  assert.ok(sections.every(s => s.questions.every(q => !q.optional)), 'Every question is mandatory');
  const monitoring = sections.flatMap(s => s.questions).find(q => q.id === 'monitoring');
  assert.equal(monitoring.type, 'multi');
  const combined = toggleOption([monitoring.options[0]], monitoring.options[2]);
  assert.deepEqual(combined, [monitoring.options[2]]);
  assert.deepEqual(toggleOption(combined, 'Затрудняюсь ответить'), ['Затрудняюсь ответить']);
  assert.deepEqual(toggleOption(['Затрудняюсь ответить'], monitoring.options[0]), [monitoring.options[0]]);
  assert.equal(hasAnswer(monitoring, {monitoring: ['Свой вариант ответа']}), false);
  assert.equal(hasAnswer(monitoring, {monitoring: ['Свой вариант ответа'], monitoringOther: 'Описание'}), true);
  assert.deepEqual(sections.flatMap(s => visibleQuestions(s, true, bothYes).map(q => q.row)), expected.filter(r => r !== 115 && r !== 121));
});

test('full Navigator coverage is exclusive in both surveys', () => {
  for (const question of [
    sections.flatMap(section => section.questions).find(item => item.id === 'monitoring'),
    getSections({product: enabledTeams.find(team => team.name === 'Колл-центр').id})
      .flatMap(section => section.questions).find(item => item.id === 'ccMonitoring'),
  ]) {
    const [full, partial, analysts, , , unknown] = question.options;
    assert.deepEqual(toggleOption([partial, analysts], full), [full]);
    assert.deepEqual(toggleOption([full], partial), [partial]);
    assert.deepEqual(toggleOption([full], unknown), [unknown]);
    assert.deepEqual(toggleOption([unknown], full), [full]);
    assert.deepEqual(toggleOption([full], full), []);
    assert.deepEqual(toggleOption([partial], analysts), [partial, analysts]);
  }
});

test('all confirmations require an explicit indication that something exists', () => {
  for (const value of ['Нет', 'Не проводился', 'Затрудняюсь ответить', 'Нет собственных аналитиков', '', undefined, ['Затрудняюсь ответить']]) assert.equal(indicatesPresence(value), false);
  for (const value of ['Да', 'Частично', 'Свой вариант ответа', ['Объёмы'], 'Меньше 20%']) assert.equal(indicatesPresence(value), true);
  const ids = answers => sections.flatMap(s => visibleQuestions(s, false, answers).map(q => q.id));
  const none = ids({attractIncludes: ['Затрудняюсь ответить'], attractAnalysis: ['Не проводился'], churnIncludes: ['Затрудняюсь ответить'], churnAnalysis: ['Не проводился'], deviations: 'Нет', upsell: 'Нет', discovery: 'Нет собственных аналитиков'});
  for (const id of ['attractReport', 'churnReport', 'deviationExample', 'backlog']) assert.ok(!none.includes(id));
  assert.ok(!ids({attractAnalysis: ['Все перечисленное выше']}).includes('attractReport'), 'Attraction proof stays inline');
  assert.ok(!ids({churnIncludes: ['Объёмы']}).includes('churnReport'), 'Churn proof stays inline');
  assert.ok(ids({deviations: 'Да'}).includes('deviationExample'));
  assert.ok(!ids({upsell: ['Допродажи (upsell)']}).includes('mechanics'), 'Mechanics comment stays on the same screen');
  assert.ok(!ids({discovery: 'Меньше 20%'}).includes('backlog'), 'Discovery backlog stays inline');
});

for (const [direction, row] of [['attract', 56], ['churn', 79]]) {
  test(`${direction} report is required inline for positive inclusion or analysis fallback`, () => {
    const section = sections.find(section => section.id === direction);
    const includes = section.questions.find(question => question.id === `${direction}Includes`);
    const analysis = section.questions.find(question => question.id === `${direction}Analysis`);
    const reportId = `${direction}Report`, formatId = `${reportId}Format`;
    assert.deepEqual(includes.inlineEvidence, {id: reportId, formatId, row});
    assert.deepEqual(analysis.inlineEvidence, {id: reportId, formatId, row, evidenceWhenAbsent: includes.id});
    assert.equal(section.questions.find(question => question.id === reportId).inlineOnly, true);
    assert.deepEqual(visibleQuestions(section, false, {}).map(question => question.id), [includes.id, analysis.id]);
    const positive = {[includes.id]: ['Объёмы'], [analysis.id]: ['Все перечисленное выше']};
    assert.equal(needsEvidence(includes, positive), true);
    assert.equal(needsEvidence(analysis, positive), false);
    assert.equal(hasAnswer(includes, positive), false);
    for (const invalid of ['example.test/report', 'ftp://example.test/report', 'javascript:alert(1)', '   ']) {
      assert.equal(hasEvidence(includes, {...positive, [formatId]: 'link', [reportId]: invalid}), false);
    }
    for (const valid of ['https://example.test/report', 'http://example.test/report']) {
      assert.equal(hasAnswer(includes, {...positive, [formatId]: 'link', [reportId]: valid}), true);
    }
    assert.equal(hasAnswer(includes, {...positive, [formatId]: 'excel'}), true);
    assert.equal(hasAnswer(includes, {...positive, [formatId]: 'excel', [reportId]: 'stale'}), true);
    const fallback = {[includes.id]: ['Затрудняюсь ответить'], [analysis.id]: ['Все перечисленное выше']};
    assert.equal(needsEvidence(includes, fallback), false);
    assert.equal(needsEvidence(analysis, fallback), true);
    assert.equal(hasAnswer(analysis, fallback), false);
    assert.equal(hasAnswer(analysis, {...fallback, [formatId]: 'excel'}), true);
    const unknown = {[includes.id]: ['Затрудняюсь ответить'], [analysis.id]: ['Затрудняюсь ответить']};
    assert.equal(needsEvidence(includes, unknown), false);
    assert.equal(needsEvidence(analysis, unknown), false);
  });
}

test('result exports both independent proofs, rejects missing evidence and omits hidden stale links', () => {
  const answers = completedAnswers();
  const linked = buildSurveyResult(answers).answers;
  for (const [direction, row] of [['attract', 56], ['churn', 79]]) {
    const reportId = `${direction}Report`, formatId = `${reportId}Format`;
    const other = direction === 'attract' ? 'churn' : 'attract';
    assert.equal(linked[formatId], 'link');
    assert.equal(linked[reportId], `https://example.test/${direction}-report`);
    assert.throws(() => buildSurveyResult({...answers, [formatId]: undefined}), /Incomplete/);
    assert.throws(() => buildSurveyResult({...answers, [reportId]: 'not-a-url'}), /Incomplete/);
    const excel = buildSurveyResult({...answers, [formatId]: 'excel'});
    assert.equal(excel.answers[formatId], 'excel');
    assert.ok(!(reportId in excel.answers));
    assert.equal(excel.answers[`${other}Report`], answers[`${other}Report`]);
    assert.deepEqual(excel.questionSources[formatId], {sheet: 'Продукты (2)', row});
    assert.deepEqual(excel.questionSources[reportId], {sheet: 'Продукты (2)', row});
    const inactive = buildSurveyResult({...answers,
      [`${direction}Includes`]: ['Затрудняюсь ответить'], [`${direction}Analysis`]: ['Затрудняюсь ответить']});
    assert.ok(!(formatId in inactive.answers));
    assert.ok(!(reportId in inactive.answers));
    assert.equal(inactive.answers[`${other}Report`], answers[`${other}Report`]);
    const fallback = buildSurveyResult({...answers,
      [`${direction}Includes`]: ['Затрудняюсь ответить'], [`${direction}Analysis`]: ['Все перечисленное выше'], [formatId]: 'excel'});
    assert.equal(fallback.answers[formatId], 'excel');
    assert.ok(!(reportId in fallback.answers));
  }
});

test('attraction benchmark proof is inline while churn proof keeps its separate screen', () => {
  const section = sections.find(s => s.id === 'benchmarks');
  assert.equal(section.questions.find(q => q.id === 'benchmarksAttract').title, 'Есть ли бенчмарки по метрикам воронок привлечения?');
  assert.equal(section.questions.find(q => q.id === 'benchmarksChurn').title, 'Есть ли бенчмарки по метрикам воронок оттока?');
  const ids = answers => visibleQuestions(section, false, answers).map(q => q.id);
  assert.deepEqual(ids({benchmarksAttract: 'Нет', benchmarksChurn: 'Нет'}), ['benchmarksAttract', 'benchmarksChurn']);
  assert.deepEqual(ids({benchmarksAttract: 'Затрудняюсь ответить', benchmarksChurn: 'Нет'}), ['benchmarksAttract', 'benchmarksChurn']);
  assert.deepEqual(ids({benchmarksAttract: 'Да', benchmarksChurn: 'Нет'}), ['benchmarksAttract', 'benchmarksChurn']);
  assert.deepEqual(ids({benchmarksAttract: 'Нет', benchmarksChurn: 'Да'}), ['benchmarksAttract', 'benchmarksChurn', 'benchmarkChurnProof']);
});

test('inline attraction benchmark proof validates content and preserves evidence metadata and scoring', () => {
  const questions = sections.find(s => s.id === 'benchmarks').questions;
  const parent = questions.find(q => q.id === 'benchmarksAttract');
  assert.deepEqual(parent.inlineProof, {id: 'benchmarkAttractProof', row: 83, title: 'Опишите, какие бенчмарки используются', placeholder: 'Введите описание'});
  assert.equal(questions.find(q => q.id === 'benchmarkAttractProof').inlineOnly, true);
  assert.notEqual(questions.find(q => q.id === 'benchmarkChurnProof').inlineOnly, true);
  for (const proof of [undefined, '', '   ']) {
    assert.equal(hasAnswer(parent, {benchmarksAttract: 'Да', benchmarkAttractProof: proof}), false);
    assert.throws(() => buildSurveyResult({...completedAnswers(), benchmarkAttractProof: proof}), /Incomplete/);
  }
  for (const proof of ['Отчёт по рынку', 'https://example.test/benchmark']) {
    assert.equal(hasAnswer(parent, {benchmarksAttract: 'Да', benchmarkAttractProof: proof}), true);
    const result = buildSurveyResult({...completedAnswers(), benchmarkAttractProof: proof});
    assert.equal(result.answers.benchmarkAttractProof, proof);
    assert.equal(result.questionRows.benchmarkAttractProof, 83);
    assert.deepEqual(result.questionSources.benchmarkAttractProof, {sheet: 'Продукты (2)', row: 83});
    const metric = result.result.metrics.find(metric => metric.code === 'attract.benchmarks');
    assert.equal(metric.value, metric.maxValue);
    assert.equal(metric.evidence, proof);
  }
  for (const negative of ['Нет', 'Затрудняюсь ответить']) {
    assert.equal(hasAnswer(parent, {benchmarksAttract: negative}), true);
    const result = buildSurveyResult({...completedAnswers(), benchmarksAttract: negative, benchmarkAttractProof: 'stale'});
    assert.ok(!('benchmarkAttractProof' in result.answers));
    assert.equal(result.result.metrics.find(metric => metric.code === 'attract.benchmarks').value, 0);
    assert.equal(result.result.metrics.find(metric => metric.code === 'attract.benchmarks').evidence, null);
    assert.ok('benchmarkChurnProof' in result.answers, 'Churn evidence remains independent');
  }
});

test('Discovery requires inline backlog evidence for percentages and omits stale evidence when absent', () => {
  const questions = sections.find(s => s.id === 'research').questions;
  const parent = questions.find(q => q.id === 'discovery');
  const child = questions.find(q => q.id === 'backlog');
  assert.deepEqual(parent.inlineProof, {id: 'backlog', row: 121, title: child.title, placeholder: 'Ссылка или описание'});
  assert.equal(child.inlineOnly, true);
  for (const percent of parent.options.slice(0, 4)) {
    assert.equal(needsProof(parent, {discovery: percent}), true);
    for (const proof of [undefined, '', '   ']) {
      assert.equal(hasAnswer(parent, {discovery: percent, backlog: proof}), false);
      assert.throws(() => buildSurveyResult({...completedAnswers(), discovery: percent, backlog: proof}), /Incomplete/);
    }
    const proof = 'https://example.test/backlog';
    assert.equal(hasAnswer(parent, {discovery: percent, backlog: proof}), true);
    const result = buildSurveyResult({...completedAnswers(), discovery: percent, backlog: proof});
    assert.equal(result.answers.backlog, proof);
    assert.equal(result.questionRows.backlog, 121);
    assert.deepEqual(result.questionSources.backlog, {sheet: 'Продукты (2)', row: 121});
    const metric = result.result.metrics.find(metric => metric.code === 'hyp.discovery_40_backlog');
    assert.equal(metric.evidence, proof);
    assert.equal(metric.value, parent.options.indexOf(percent) < 2 ? metric.maxValue : 0);
  }
  for (const absent of parent.options.slice(4)) {
    assert.equal(needsProof(parent, {discovery: absent}), false);
    assert.equal(hasAnswer(parent, {discovery: absent}), true);
    const result = buildSurveyResult({...completedAnswers(), discovery: absent, backlog: 'stale'});
    assert.ok(!('backlog' in result.answers));
    assert.equal(result.result.metrics.find(metric => metric.code === 'hyp.discovery_40_backlog').evidence, null);
  }
});

test('exclusive answers cannot contradict selected analysis or funnel elements', () => {
  assert.deepEqual(toggleOption(['Объёмы'], 'Затрудняюсь ответить'), ['Затрудняюсь ответить']);
  assert.deepEqual(toggleOption(['Не проводился'], 'Анализ кампаний'), ['Анализ кампаний']);
  assert.deepEqual(toggleOption(['Объёмы'], 'Объёмы'), []);
});

test('single-question flow requires every answer, preserves answers and applies Discovery condition', async () => {
  const html = readFileSync(new URL('../../dist-deposits-survey/deposits-survey.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/);
  const errors = [];
  // jsdom does not execute module scripts. Run the self-contained bundle after parsing,
  // matching the browser's deferred module timing.
  const script = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)[1];
  const dom = new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/, ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(window) {
      window.scrollTo = () => {};
      window.matchMedia = () => ({matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}});
      window.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
      window.addEventListener('error', e => errors.push(e.message));
      window.fetch = () => {throw new Error('Unexpected network request');};
    },
  });
  dom.window.eval(script);
  const pause = () => new Promise(r => setTimeout(r, 40));
  const click = async text => {
    const button = [...dom.window.document.querySelectorAll('button')].find(b => b.textContent.trim().includes(text));
    assert.ok(button, `Button exists: ${text}`); button.click(); await pause();
  };
  const write = async (control, value) => {
    const prototype = control.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, value);
    control.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
    await pause();
  };
  const fillCurrent = async () => {
    const doc = dom.window.document;
    if (doc.querySelector('.g-select')) {
      doc.querySelector('[role="combobox"]').click(); await pause();
      const filter = doc.querySelector('input');
      if (filter) await write(filter, 'Вклады');
      const option = [...doc.querySelectorAll('[role="option"], .g-select-list__option, .g-list__item')].find(n => n.textContent.trim() === 'Вклады+НС'); assert.ok(option, `Select option rendered: ${[...doc.querySelectorAll('[role]')].map(n => n.getAttribute('role')).join(',')}`); option.click(); await pause();
    } else if (doc.querySelector('input[type="radio"], input[type="checkbox"]')) {
      doc.querySelector('input[type="radio"]:not(:disabled), input[type="checkbox"]:not(:disabled)').click(); await pause();
      if (['attractIncludes', 'churnIncludes'].includes(doc.querySelector('.survey-single-question').dataset.questionId)) {
        const direction = doc.querySelector('.survey-single-question').dataset.questionId === 'churnIncludes' ? 'churn' : 'attract';
        const noun = direction === 'churn' ? 'оттока' : 'привлечения';
        const evidence = doc.querySelector('.survey-inline-evidence');
        assert.ok(evidence, 'Positive funnel answer reveals inline evidence');
        assert.equal(evidence.getAttribute('aria-label'), `Подтверждение воронки ${noun}`);
        assert.match(evidence.querySelector('h2').textContent, new RegExp(`воронку ${noun}`));
        assert.match(evidence.querySelector('p').textContent, new RegExp(`воронка ${noun} формируется в Excel`));
        assert.equal(evidence.querySelector('a').getAttribute('href'), 'mailto:MYCherkova@sberbank.ru');
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
        evidence.querySelector('input[type="radio"]').click(); await pause();
        const link = doc.querySelector('.survey-inline-evidence input[type="url"]');
        assert.ok(link, 'Link format reveals URL field');
        await write(link, 'not-a-link');
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
        await write(link, `https://example.test/${direction}-report`);
      }
      if (doc.querySelector('.survey-single-question').dataset.questionId === 'benchmarksAttract') {
        const proof = doc.querySelector('textarea');
        assert.ok(proof, 'Affirmative attraction benchmark answer reveals inline description');
        assert.equal(doc.querySelector(`label[for="${proof.id}"]`).textContent, 'Опишите, какие бенчмарки используются');
        assert.equal(proof.getAttribute('placeholder'), 'Введите описание');
        assert.equal(doc.activeElement, proof, 'New benchmark description receives focus');
        const next = () => [...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее'));
        assert.equal(next().disabled, true);
        await write(proof, '   ');
        assert.equal(next().disabled, true, 'Whitespace cannot bypass mandatory description');
        await write(proof, 'Бенчмарки рынка привлечения');
      }
      if (doc.querySelector('.survey-single-question').dataset.questionId === 'discovery') {
        const proof = doc.querySelector('textarea');
        assert.ok(proof, 'Positive Discovery answer reveals inline backlog evidence');
        assert.equal(proof.id, 'backlog');
        assert.equal(doc.activeElement, proof, 'New backlog field receives focus');
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
        await write(proof, 'https://example.test/backlog');
      }
      if (doc.querySelector('.survey-single-question').dataset.questionId === 'upsell') {
        const known = doc.querySelectorAll('.survey-known-mechanic input[type="checkbox"]');
        assert.equal(known.length, 2);
        for (const input of known) {assert.equal(input.disabled, true); assert.equal(input.checked, true);}
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true, 'Mechanics requires its comment');
        assert.equal(doc.activeElement, doc.querySelector('textarea'));
        await write(doc.querySelector('textarea'), 'Описание механики');
      }
      if (doc.querySelector('.survey-single-question').dataset.questionId === 'support') {
        assert.equal(doc.querySelectorAll('.survey-option-group').length, 6);
        const other = [...doc.querySelectorAll('.g-checkbox')].find(n => n.textContent.trim() === 'Другое');
        other.querySelector('input').click(); await pause();
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
        assert.equal(doc.activeElement, doc.querySelector('textarea'));
        await write(doc.querySelector('textarea'), 'Нужны инструменты');
      }
    } else {
      const control = doc.querySelector('textarea, input');
      assert.ok(control, 'Answer field present');
      if (!control.readOnly) {
        if (control.getAttribute('inputmode') === 'numeric') {
          await write(control, 'abc');
          assert.equal(control.value, '', 'Letters cannot be entered');
          await write(control, '12 абв 345!');
          assert.equal(control.value, '12 345', 'Mixed pasted text leaves digits grouped by three');
          await write(control, '1234567');
          assert.equal(control.value, '1 234 567', 'Millions are grouped by three');
        } else await write(control, 'Тестовый ответ');
      }
    }
  };
  try {
    await pause();
    assert.match(dom.window.document.querySelector('h1').textContent, /Представьтесь/);
    assert.equal(dom.window.document.activeElement, dom.window.document.querySelector('input'), 'First answer is focused immediately');
    assert.equal(dom.window.document.querySelectorAll('.survey-single-question').length, 1);
    assert.equal([...dom.window.document.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
    dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit', {bubbles: true, cancelable: true}));
    await pause();
    assert.match(dom.window.document.querySelector('[role="alert"]').textContent, /Введите ответ/);
    assert.match(dom.window.document.querySelector('h1').textContent, /Представьтесь/);
    assert.doesNotMatch(dom.window.document.body.textContent, /Пропустить/);
    await fillCurrent();
    dom.window.document.querySelector('input').dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
    await pause();
    const progressLabel = dom.window.document.querySelector('.survey-progress-label');
    assert.match(progressLabel.textContent, /Шаг 2 из/);
    assert.equal(dom.window.document.querySelector('.survey-progress-trigger'), null);
    const steps = dom.window.document.querySelector('nav.survey-progress-steps');
    assert.ok(steps, 'Question navigation is always rendered');
    assert.equal(steps.getAttribute('aria-label'), 'Вопросы опроса');
    const items = [...steps.querySelectorAll('button.survey-progress-step')];
    assert.equal(items.length, Number(progressLabel.textContent.match(/из (\d+)/)[1]));
    assert.notEqual(items[0].getAttribute('aria-disabled'), 'true', 'Past question is available');
    assert.equal(items[1].getAttribute('aria-disabled'), 'true', 'Current question cannot be jumped to');
    assert.equal(items[2].getAttribute('aria-disabled'), 'true', 'Future question is visible and unavailable');
    items[2].click(); await pause();
    assert.equal(dom.window.document.querySelector('.survey-single-question').dataset.questionId, 'product', 'Future click cannot bypass required answers');
    items[2].focus();
    await new Promise(resolve => setTimeout(resolve, 0));
    const progressHint = dom.window.document.querySelector('.survey-progress-hint');
    assert.ok(progressHint, 'Keyboard focus reveals the lightweight tooltip without a delay');
    assert.equal(progressHint.textContent, items[2].getAttribute('aria-label'));
    items[2].dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
    await pause();
    assert.equal(dom.window.document.querySelector('.survey-single-question').dataset.questionId, 'product', 'Future keyboard activation cannot bypass required answers');
    items[0].click(); await pause();
    assert.equal(dom.window.document.querySelector('.survey-single-question').dataset.questionId, 'name');
    assert.equal(dom.window.document.querySelector('input').value, 'Тестовый ответ', 'Navigation preserves previous answer');
    const revisitedSteps = [...dom.window.document.querySelectorAll('.survey-progress-step')];
    assert.notEqual(revisitedSteps[1].getAttribute('aria-disabled'), 'true', 'Previously visited next step stays available');
    assert.equal(revisitedSteps[2].getAttribute('aria-disabled'), 'true', 'Never visited step remains unavailable');
    revisitedSteps[1].click(); await pause();
    assert.equal(dom.window.document.querySelector('.survey-single-question').dataset.questionId, 'product', 'Navigation permits returning forward to visited step');
    await click('Назад');
    assert.equal(dom.window.document.querySelector('input').value, 'Тестовый ответ');
    await click('Далее');
    let screenCount = 1;
    while (dom.window.document.querySelector('form')) {
      assert.equal(dom.window.document.querySelectorAll('.survey-single-question').length, 1);
      assert.ok(screenCount < 35, 'Flow terminates');
      const editable = dom.window.document.querySelector('textarea, input:not([type="radio"]):not([type="checkbox"])');
      if (editable && !dom.window.document.querySelector('.g-select')) assert.equal(dom.window.document.activeElement, editable, 'New text question focuses its answer automatically');
      const currentTitle = dom.window.document.querySelector('h1').textContent;
      const currentId = dom.window.document.querySelector('.survey-single-question').dataset.questionId;
      if (currentId === 'product') {
        const select = dom.window.document.querySelector('[role="combobox"]');
        assert.equal(select.getAttribute('aria-expanded'), 'false', 'Team dropdown starts closed');
        assert.notEqual(dom.window.document.activeElement, select, 'Team dropdown is not automatically focused');
        assert.equal(dom.window.document.querySelector('[role="listbox"]'), null);
      }
      if (/Есть ли бенчмарки/.test(currentTitle)) {
        const no = [...dom.window.document.querySelectorAll('.g-radio')].find(n => n.textContent.trim() === 'Нет');
        no.querySelector('input').click(); await pause();
        await click('Далее');
        assert.equal(dom.window.document.querySelector('.survey-single-question').dataset.questionId, currentId === 'benchmarksAttract' ? 'benchmarksChurn' : 'deviations');
        await click('Назад');
        assert.equal(dom.window.document.querySelector('h1').textContent, currentTitle);
      }
      await fillCurrent();
      assert.equal([...dom.window.document.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, false);
      const textarea = dom.window.document.querySelector('textarea');
      if (textarea) {
        const title = dom.window.document.querySelector('h1').textContent;
        const shiftEnter = new dom.window.KeyboardEvent('keydown', {key: 'Enter', shiftKey: true, bubbles: true, cancelable: true});
        textarea.dispatchEvent(shiftEnter); await pause();
        assert.equal(shiftEnter.defaultPrevented, false, 'Shift+Enter allows a line break');
        assert.equal(dom.window.document.querySelector('h1').textContent, title);
        const enter = new dom.window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true});
        textarea.dispatchEvent(enter); await pause();
        assert.equal(enter.defaultPrevented, true, 'Enter advances without inserting a line break');
      } else await click('Далее');
      screenCount++;
    }
    assert.equal(screenCount, 23, 'Funnel, attraction benchmark and Discovery proofs are inline; churn benchmark proof remains separate');
    assert.match(dom.window.document.querySelector('h1').textContent, /Проверьте ответы/);
    assert.equal(dom.window.document.querySelectorAll('.review-answer').length, 23);
    const reviewItems = [...dom.window.document.querySelectorAll('.survey-progress-step')];
    assert.equal(reviewItems.length, 23);
    assert.ok(reviewItems.every(item => item.getAttribute('aria-disabled') !== 'true'), 'Review permits editing any question');
    const evidenceLinks = [...dom.window.document.querySelectorAll('.review-inline-evidence a')].map(link => link.href);
    assert.deepEqual(evidenceLinks, ['https://example.test/attract-report', 'https://example.test/churn-report']);
    assert.doesNotMatch(dom.window.document.body.textContent, /Не заполнено/);
    assert.doesNotMatch(dom.window.document.body.textContent, /Бэклог продукта уже проанализирован/);
    const editAnswer = async title => {
      const row = [...dom.window.document.querySelectorAll('.review-answer')].find(n => n.querySelector('b').textContent === title);
      assert.ok(row, 'Review answer found');
      row.querySelector('button').click(); await pause();
    };
    assert.match(dom.window.document.body.textContent, /https:\/\/example\.test\/backlog/);
    const benchmarkTitle = 'Есть ли бенчмарки по метрикам воронок привлечения?';
    const benchmarkReview = () => [...dom.window.document.querySelectorAll('.review-answer')].find(row => row.querySelector('b').textContent === benchmarkTitle);
    assert.match(benchmarkReview().textContent, /Бенчмарки рынка привлечения/);
    await editAnswer(benchmarkTitle);
    assert.equal(dom.window.document.querySelector('textarea').value, 'Бенчмарки рынка привлечения');
    const negativeBenchmark = [...dom.window.document.querySelectorAll('.g-radio')].find(node => node.textContent.trim() === 'Нет');
    negativeBenchmark.querySelector('input').click(); await pause();
    assert.equal(dom.window.document.querySelector('textarea'), null, 'Negative benchmark answer hides description');
    await click('Сохранить и вернуться');
    assert.doesNotMatch(benchmarkReview().textContent, /Бенчмарки рынка привлечения/);
    await editAnswer(benchmarkTitle);
    const positiveBenchmark = [...dom.window.document.querySelectorAll('.g-radio')].find(node => node.textContent.trim() === 'Да');
    positiveBenchmark.querySelector('input').click(); await pause();
    assert.equal(dom.window.document.querySelector('textarea').value, 'Бенчмарки рынка привлечения', 'Changing answer preserves entered proof for later editing');
    await click('Сохранить и вернуться');
    const supportTitle = 'Каких инструментов или какой поддержки не хватает вам для повышения уровня data driven вашего продукта?';
    await editAnswer(supportTitle);
    assert.ok([...dom.window.document.querySelectorAll('.survey-progress-step')].every(item => item.getAttribute('aria-disabled') !== 'true'), 'Editing permits selecting any question');
    let other = [...dom.window.document.querySelectorAll('.g-checkbox')].find(n => n.textContent.trim() === 'Другое');
    other.querySelector('input').click(); await pause();
    assert.equal(dom.window.document.querySelector('textarea'), null);
    await click('Сохранить и вернуться');
    const supportReview = [...dom.window.document.querySelectorAll('.review-answer')].find(n => n.querySelector('b').textContent === supportTitle);
    assert.doesNotMatch(supportReview.textContent, /Нужны инструменты/);
    await editAnswer(supportTitle);
    other = [...dom.window.document.querySelectorAll('.g-checkbox')].find(n => n.textContent.trim() === 'Другое');
    other.querySelector('input').click(); await pause();
    assert.equal(dom.window.document.querySelector('textarea').value, 'Нужны инструменты');
    await click('Сохранить и вернуться');
    await editAnswer('Какое MAU у вашего продукта?');
    assert.equal(dom.window.document.querySelector('.survey-single-question').dataset.questionId, 'mau');
    await write(dom.window.document.querySelector('input'), '7654321');
    await click('Сохранить и вернуться');
    assert.match(dom.window.document.querySelector('h1').textContent, /Проверьте ответы/);
    assert.match(dom.window.document.body.textContent, /7 654 321/);
    await editAnswer('Представьтесь, пожалуйста');
    await write(dom.window.document.querySelector('input'), '');
    assert.equal([...dom.window.document.querySelectorAll('button')].find(b => b.textContent.includes('Сохранить и вернуться')).disabled, true);
    await write(dom.window.document.querySelector('input'), 'Изменённое имя');
    dom.window.document.querySelector('input').dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
    await pause();
    assert.match(dom.window.document.querySelector('h1').textContent, /Проверьте ответы/);
    await editAnswer('Какое MAU у вашего продукта?');
    await write(dom.window.document.querySelector('input'), '');
    await click('К проверке');
    assert.match(dom.window.document.querySelector('h1').textContent, /Проверьте ответы/);
    await click('Завершить опрос');
    assert.equal(dom.window.document.querySelector('.survey-single-question').dataset.questionId, 'mau');
    await write(dom.window.document.querySelector('input'), '7654321');
    await click('Сохранить и вернуться');
    assert.match(dom.window.document.querySelector('h1').textContent, /Проверьте ответы/);
    await click('Завершить опрос');
    assert.match(dom.window.document.body.textContent, /Вы прошли опрос на аналитической платформе/);
    const payload = JSON.parse(dom.window.DDI_SURVEY_RESULT_JSON);
    assert.equal(payload.answers.mau, '7654321');
    assert.equal(payload.respondent.name, 'Изменённое имя');
    assert.equal(payload.team.unit, 'CBP');
    assert.equal(payload.answers.supportOther, 'Нужны инструменты');
    assert.equal(payload.answers.attractReportFormat, 'link');
    assert.equal(payload.answers.attractReport, 'https://example.test/attract-report');
    assert.equal(payload.answers.benchmarkAttractProof, 'Бенчмарки рынка привлечения');
    assert.equal(payload.answers.backlog, 'https://example.test/backlog');
    assert.equal(payload.answers.churnReportFormat, 'link');
    assert.equal(payload.answers.churnReport, 'https://example.test/churn-report');
    assert.equal(payload.answers.support.length, 2);
    assert.equal(payload.result.status, 'provisional_self_report');
    assert.doesNotMatch(dom.window.document.body.textContent, /DDI_SURVEY_RESULT_JSON|JSON|provisional_self_report|scorePct/);
    assert.equal(dom.window.document.querySelectorAll('.finish-feature').length, 5);
    assert.equal(dom.window.document.querySelectorAll('.finish-stats strong').length, 3);
    await click('Вернуться к ответам');
    assert.equal(dom.window.DDI_SURVEY_RESULT_JSON, null, 'Returning to review invalidates the exported result');
    assert.match(dom.window.document.querySelector('h1').textContent, /Проверьте ответы/);
    assert.deepEqual(errors, []);
    assert.equal(dom.window.localStorage.length, 0);
    assert.equal(dom.window.sessionStorage.length, 0);
  } finally {dom.window.close();}
});
