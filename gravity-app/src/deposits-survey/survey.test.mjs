import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {buildSurveyResult} from './result.js';
import {scoringBaseline} from './scoring-baseline.js';
import {productSurveyProfiles} from './product-surveys.js';
import {previousFunnels, clickstreamOnlyAttraction, previousReportLinks} from './previous-funnels.js';
import {CHANNEL_SURVEYS_ENABLED, enabledTeam, enabledTeams, filterTeamOption, teamGroups, teams} from './teams.js';
import {correctTypos, getSections, hasAnswer, hasEvidence, indicatesPresence, inlineQuestions, knownMechanics, needsComment, needsEvidence, needsProof, questionOptions, sections, toggleOption, visibleQuestions} from './questions.js';

test('team selector keeps the final index catalog and enables every product team', () => {
  assert.equal(teams.length, 83);
  assert.equal(teamGroups.length, 8);
  assert.deepEqual(teamGroups.map(g => g.label), ['CBP', 'CX', 'Data', 'DB', 'DP', 'PC', 'ДомКлик', 'УБ']);
  for (const group of teamGroups) for (const option of group.options) assert.equal(teams.find(team => team.id === option.value).unit, group.label);
  assert.equal(teamGroups.flatMap(g => g.options).filter(o => !o.disabled).length, 67);
  assert.deepEqual(new Set(enabledTeams.map(team => team.id)), new Set(Object.keys(productSurveyProfiles)));
  assert.equal(CHANNEL_SURVEYS_ENABLED, false);
  assert.equal(teamGroups.flatMap(group => group.options).find(option => option.content === 'Колл-центр').disabled, true);
  assert.equal(enabledTeam.name, 'Вклады+НС');
  assert.equal(enabledTeam.unit, 'CBP');
  assert.ok(!sections.flatMap(s => s.questions).some(q => q.id === 'unit'));
  assert.deepEqual(teamGroups.map(g => g.label), teamGroups.map(g => g.label).sort((a,b) => new Intl.Collator('en', {sensitivity: 'base', numeric: true}).compare(a, b)));
  for (const group of teamGroups) assert.deepEqual(group.options.map(o => o.content), group.options.map(o => o.content).sort((a,b) => new Intl.Collator('en', {sensitivity: 'base', numeric: true}).compare(a, b)));
});

test('disabled channel cannot produce a survey result or expose its questions', () => {
  const channel = teams.find(team => team.name === 'Колл-центр');
  assert.ok(channel, 'Channel remains in the team catalog for future use');
  assert.ok(!enabledTeams.some(team => team.id === channel.id));
  const ids = getSections({product: channel.id}).flatMap(section => section.questions).map(question => question.id);
  assert.ok(!ids.some(id => id.startsWith('cc')), 'Disabled channel never exposes channel questions');
  assert.throws(() => buildSurveyResult({...completedAnswers(), product: channel.id, unit: channel.unit}), /Unsupported survey team/);
  const html = readFileSync(new URL('../../dist-deposits-survey/deposits-survey.html', import.meta.url), 'utf8');
  for (const marker of ['ccCalls', 'ccFcr', 'ccEntryIncludes', 'Каналы Phigital']) {
    assert.ok(!html.includes(marker), `Compiled product HTML omits channel-specific data: ${marker}`);
  }
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
  for (const q of getSections(answers).flatMap(s => s.questions).flatMap(q => [q, ...inlineQuestions(q)])) {
    if (q.id === 'product') continue;
    if (q.type === 'numeric') answers[q.id] = '1000';
    else if (q.type === 'multi') answers[q.id] = q.id === 'upsell' ? ['Допродажи (upsell)'] : [q.options[0], ...(q.benchmark ? ['Бенчмарки'] : [])];
    else if (q.type === 'radio') answers[q.id] = q.options[0];
    else answers[q.id] = 'Описание';
  }
  for (const q of getSections(answers).flatMap(s => s.questions).flatMap(q => [q, ...inlineQuestions(q)])) {
    if (q.inlineProof) answers[q.inlineProof.id] = q.inlineProof.kind === 'metricSource' ? 'Затрудняюсь ответить' : 'Описание';
    if (q.inlineEvidence) answers[q.inlineEvidence.formatId] = 'excel';
    if (q.action) answers[q.action.inlineEvidence.formatId] = 'excel';
  }
  answers.attractReportFormat = 'link';
  answers.attractReport = 'https://example.test/attract-report';
  answers.churnReportFormat = 'link';
  answers.churnReport = 'https://example.test/churn-report';
  return answers;
}

test('key metric source choices validate details for zero and exclude stale hidden fields', () => {
  for (const team of enabledTeams) {
    const metrics = getSections({product: team.id}).find(section => section.id === 'metrics');
    assert.ok(!visibleQuestions(metrics, false, {}).some(q => q.id === 'monitoring'));
    for (const question of metrics.questions.filter(q => q.id !== 'monitoring')) {
      if (question.id === 'satellite') {
        assert.equal(question.inlineProof, undefined);
        assert.equal(hasAnswer(question, {satellite: 'Продукт-спутник'}), true);
        continue;
      }
      const value = question.type === 'numeric' ? '0' : 'Продукт';
      const id = question.inlineProof.id;
      const base = {[question.id]: value};
      assert.equal(hasAnswer(question, base), false);
      assert.equal(hasAnswer(question, {...base, [id]: 'Старый свободный текст'}), false);
      for (const source of ['Дашборд в Навигаторе', 'Собственная отчетность']) {
        const answers = {...base, [id]: source, [`${id}Format`]: 'link'};
        assert.equal(hasAnswer(question, answers), false);
        for (const link of ['not-url', 'javascript:alert(1)', 'ftp://example.test/file']) {
          assert.equal(hasAnswer(question, {...answers, [`${id}Link`]: link}), false);
        }
        assert.equal(hasAnswer(question, {...answers, [`${id}Link`]: 'https://example.test/report'}), true);
      }
      assert.equal(hasAnswer(question, {...base, [id]: 'Собственная отчетность', [`${id}Format`]: 'excel'}), true);
      assert.equal(hasAnswer(question, {...base, [id]: 'Свой вариант ответа', [`${id}Other`]: '   '}), false);
      assert.equal(hasAnswer(question, {...base, [id]: 'Свой вариант ответа', [`${id}Other`]: 'Наш источник'}), true);
      for (const source of ['Запрос у аналитиков', 'Затрудняюсь ответить']) assert.equal(hasAnswer(question, {...base, [id]: source}), true);
    }
  }
  const answers = {...completedAnswers(), marketRussia: '0', marketRussiaSource: 'Свой вариант ответа', marketRussiaSourceOther: 'Комментарий о TAM',
    marketRussiaSourceLink: 'https://stale.test', marketRussiaSourceFormat: 'excel',
    mauSource: 'Собственная отчетность', mauSourceFormat: 'link', mauSourceLink: 'https://example.test/report',
    dauSource: 'Старое значение от другой команды', monitoring: ['Старый ответ']};
  const result = buildSurveyResult(answers);
  assert.equal(result.answers.marketRussiaSourceOther, 'Комментарий о TAM');
  assert.equal(result.answers.mauSourceLink, 'https://example.test/report');
  for (const id of ['monitoring', 'dauSource', 'marketRussiaSourceLink', 'marketRussiaSourceFormat']) {
    for (const field of ['answers', 'questionRows', 'questionSources']) assert.ok(!(id in result[field]));
  }
  assert.equal(result.result.metrics.find(metric => metric.code === 'general.obъem_celevogo_rynka_v_rossii').evidence, 'Свой вариант ответа: Комментарий о TAM');
  assert.equal(result.result.metrics.find(metric => metric.code === 'general.mau_produkta').evidence, 'Собственная отчетность: https://example.test/report');
  for (const source of ['Запрос у аналитиков', 'Затрудняюсь ответить']) {
    const changed = buildSurveyResult({...answers, marketRussiaSource: source});
    assert.ok(!('marketRussiaSourceOther' in changed.answers));
    assert.equal(changed.result.metrics.find(metric => metric.code === 'general.obъem_celevogo_rynka_v_rossii').evidence, source);
  }
});

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
  assert.equal(result.result.metrics.find(m => m.code === 'general.navigator_reporting_knowledge').source, 'ddi_baseline');
  assert.ok(!('monitoring' in result.answers), 'Old monitoring answers are not exported');
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
  const expected = [3, 4, 15, 17, 19, 21, 23, 24, 38, 49, 61, 72, 80, 80, 88, 91, 96, 100, null, null, 115, 122, 123, 131];
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

test('full Navigator coverage is exclusive in every available survey', () => {
  for (const question of enabledTeams.map(team => getSections({product: team.id})
    .flatMap(section => section.questions).find(item => ['monitoring', 'ccMonitoring'].includes(item.id)))) {
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
  const answers = {...completedAnswers(), attractReportCorrection: 'edit'};
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

test('attraction and churn benchmark proofs stay inline and independent', () => {
  const section = sections.find(s => s.id === 'benchmarks');
  assert.equal(section.questions.find(q => q.id === 'benchmarksAttract').title, 'Есть ли бенчмарки по метрикам воронок привлечения?');
  assert.equal(section.questions.find(q => q.id === 'benchmarksChurn').title, 'Есть ли бенчмарки по метрикам воронок оттока?');
  const ids = answers => visibleQuestions(section, false, answers).map(q => q.id);
  assert.deepEqual(ids({benchmarksAttract: 'Нет', benchmarksChurn: 'Нет'}), ['benchmarksAttract', 'benchmarksChurn']);
  assert.deepEqual(ids({benchmarksAttract: 'Затрудняюсь ответить', benchmarksChurn: 'Нет'}), ['benchmarksAttract', 'benchmarksChurn']);
  assert.deepEqual(ids({benchmarksAttract: 'Да', benchmarksChurn: 'Нет'}), ['benchmarksAttract', 'benchmarksChurn']);
  assert.deepEqual(ids({benchmarksAttract: 'Нет', benchmarksChurn: 'Да'}), ['benchmarksAttract', 'benchmarksChurn']);
});

test('inline attraction benchmark proof validates content and preserves evidence metadata and scoring', () => {
  const questions = sections.find(s => s.id === 'benchmarks').questions;
  const parent = questions.find(q => q.id === 'benchmarksAttract');
  assert.deepEqual(parent.inlineProof, {id: 'benchmarkAttractProof', row: 83, title: 'Опишите, какие бенчмарки используются', placeholder: 'Введите описание'});
  assert.equal(questions.find(q => q.id === 'benchmarkAttractProof').inlineOnly, true);
  assert.equal(questions.find(q => q.id === 'benchmarkChurnProof').inlineOnly, true);
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
    const result = buildSurveyResult({...completedAnswers(), attractIncludes: ['Затрудняюсь ответить'], benchmarksAttract: negative, benchmarkAttractProof: 'stale'});
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
    const staff = absent === 'Нет собственных аналитиков' ? 'Штаб: клиентская аналитика, Иванов Иван Иванович' : undefined;
    assert.equal(hasAnswer(parent, {discovery: absent, discoveryStaff: staff}), true);
    if (staff) {
      assert.equal(hasAnswer(parent, {discovery: absent}), true);
      assert.equal(hasAnswer(parent, {discovery: absent, discoveryStaff: '   '}), true);
    }
    const result = buildSurveyResult({...completedAnswers(), discovery: absent, discoveryStaff: staff || 'stale', backlog: 'stale'});
    assert.equal(result.answers.discoveryStaff, staff);
    assert.ok(!('backlog' in result.answers));
    assert.equal(result.result.metrics.find(metric => metric.code === 'hyp.discovery_40_backlog').evidence, null);
  }
});

test('exclusive answers cannot contradict selected analysis or funnel elements', () => {
  assert.deepEqual(toggleOption(['Объёмы'], 'Затрудняюсь ответить'), ['Затрудняюсь ответить']);
  assert.deepEqual(toggleOption(['Не проводился'], 'Анализ кампаний'), ['Анализ кампаний']);
  assert.deepEqual(toggleOption(['Объёмы'], 'Объёмы'), []);
});

test('deposit funnel history is first, fixed, scoped and counted once with new answers', () => {
  const answers = completedAnswers();
  const route = getSections(answers).flatMap(section => section.questions);
  const attract = route.find(q => q.id === 'attractIncludes');
  const churn = route.find(q => q.id === 'churnIncludes');
  assert.deepEqual(attract.previousOptions, [attract.options[1], attract.options[2], attract.options[3]]);
  assert.deepEqual(churn.previousOptions, [churn.options[2], churn.options[3]]);
  assert.ok(questionOptions(attract).every(option => !attract.previousOptions.includes(option)));
  assert.ok(questionOptions(attract).includes(attract.options[0]));
  assert.ok(questionOptions(attract).includes(attract.options[4]));
  assert.equal(attract.previousClickstreamUrl, 'https://clickstream.sberbank.ru/frontend/sbol/reports/funnels/34601');
  assert.deepEqual(questionOptions(churn).slice(0, 2), churn.previousOptions);
  const existingOnly = {...answers, attractIncludes: [], churnIncludes: []};
  assert.equal(hasAnswer(attract, existingOnly), true);
  assert.equal(hasAnswer(churn, existingOnly), true);
  assert.equal(hasAnswer(attract, {...existingOnly, attractReport: '', attractReportCorrection: 'edit'}), false);
  const result = buildSurveyResult(existingOnly);
  assert.deepEqual(result.previousFunnelElements, {attractIncludes: attract.previousOptions, churnIncludes: churn.previousOptions});
  assert.deepEqual(result.answers.attractIncludes, attract.previousOptions);
  assert.deepEqual(result.answers.churnIncludes, churn.previousOptions);
  const kept = buildSurveyResult({...existingOnly, attractReport: 'https://stale.test', attractReportFormat: 'excel'});
  assert.equal(kept.answers.attractReport, attract.inlineEvidence.previousLinks.join('\n'));
  assert.equal(kept.answers.attractReportFormat, 'link');
  assert.equal(kept.answers.attractReportCorrection, 'keep');
  assert.deepEqual(result.previousMechanics, ['Удержание клиентов', 'Возврат клиентов']);
  const expanded = buildSurveyResult({...existingOnly, attractIncludes: [attract.options[0], attract.options[2]]});
  assert.deepEqual(expanded.answers.attractIncludes, [...attract.previousOptions, attract.options[0]]);
  assert.equal(expanded.result.metrics.find(m => m.code === 'attract.report_completeness').value, Math.round(0.5 * 4 / 7 * 10000) / 10000);
  for (const team of enabledTeams.filter(team => team.id !== enabledTeam.id)) {
    for (const q of getSections({product: team.id}).flatMap(section => section.questions)) {
      if (q.type === 'info' || q.benchmarkOnly) continue;
      const clickstream = q.id === 'attractIncludes' && clickstreamOnlyAttraction[team.id];
      const indices = [...new Set([...(previousFunnels[team.id]?.[q.id] || []), ...(clickstream ? [2] : [])])]
        .sort((a, b) => a - b).filter(index => !(clickstream && [0, 4].includes(index)));
      assert.deepEqual(q.previousOptions || [], indices.map(index => q.options[index]), team.name);
    }
  }
  const pos = enabledTeams.find(team => team.name === 'POS-кредиты');
  const posQuestion = getSections({product: pos.id}).flatMap(s => s.questions).find(q => q.id === 'attractIncludes');
  assert.deepEqual(posQuestion.previousOptions, [1, 2, 3, 6].map(index => posQuestion.options[index]));
  assert.equal(Object.keys(previousFunnels).length, 65);
  assert.equal(Object.keys(clickstreamOnlyAttraction).length, 10);
  assert.equal(Object.values(previousReportLinks).filter(links => links.attractReport).length, 34);
  assert.equal(Object.values(previousReportLinks).filter(links => links.churnReport).length, 16);
  const posLinks = previousReportLinks[pos.id].attractReport;
  assert.deepEqual(posLinks, ['https://navigator.sigma.sbrf.ru/gdash/1000001039', 'https://clickstream.sberbank.ru/frontend/sbol/reports/funnels/41110']);
  const insurance = enabledTeams.find(team => team.name === 'ДСЖ КК');
  const configured = getSections({product: insurance.id}).flatMap(s => s.questions).find(q => q.id === 'churnConfigured');
  assert.deepEqual(configured.inlineEvidence.previousLinks, ['https://navigator.sigma.sbrf.ru/gdash/1000000766']);
  assert.equal(hasEvidence(attract, {attractIncludes: [], attractReportCorrection: 'edit', attractReportFormat: 'link', attractReport: 'https://one.test\nhttps://two.test'}), true);
  assert.equal(hasEvidence(attract, {attractIncludes: [], attractReportCorrection: 'edit', attractReportFormat: 'link', attractReport: 'https://one.test\ninvalid'}), false);
  for (const name of ['ДСЖ КК', 'Брокерский счет', 'POS-кредиты']) {
    const team = enabledTeams.find(team => team.name === name);
    const q = getSections({product: team.id}).flatMap(s => s.questions).find(q => q.id === 'attractIncludes');
    assert.equal(q?.previousClickstreamUrl, undefined, `${name}: mixed or absent reports retain the normal question`);
  }
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
      const filter = doc.querySelector('input[placeholder="Поиск команды"]');
      assert.ok(filter, 'Team search remains available');
      await write(filter, 'koll-centr');
      const channelOption = [...doc.querySelectorAll('[role="option"]')].find(option => option.textContent.trim() === 'Колл-центр');
      assert.ok(channelOption, 'Disabled channel remains visible in search');
      assert.equal(channelOption.getAttribute('aria-disabled'), 'true');
      channelOption.click(); await pause();
      assert.equal([...doc.querySelectorAll('button')].find(button => button.textContent.includes('Далее')).disabled, true, 'Clicking disabled channel cannot answer mandatory team question');
      assert.equal(doc.querySelector('.survey-single-question').dataset.questionId, 'cover');
      await write(filter, 'Вклады');
      const option = [...doc.querySelectorAll('[role="option"], .g-select-list__option, .g-list__item')].find(n => n.textContent.trim() === 'Вклады+НС'); assert.ok(option, `Select option rendered: ${[...doc.querySelectorAll('[role]')].map(n => n.getAttribute('role')).join(',')}`); option.click(); await pause();
    } else if (doc.querySelector('.survey-answer > .survey-radio input, .survey-answer > .survey-options input')) {
      doc.querySelector('.survey-answer > .survey-radio input:not(:disabled), .survey-answer > .survey-options input:not(:disabled)').click(); await pause();
      if (['attractIncludes', 'churnIncludes'].includes(doc.querySelector('.survey-single-question').dataset.questionId)) {
        const direction = doc.querySelector('.survey-single-question').dataset.questionId === 'churnIncludes' ? 'churn' : 'attract';
        const noun = direction === 'churn' ? 'оттока' : 'привлечения';
        const existing = doc.querySelectorAll('.survey-known-funnel');
        assert.equal(existing.length, direction === 'churn' ? 2 : 0);
        if (direction === 'churn') assert.ok(doc.querySelector('.survey-options').firstElementChild.classList.contains('survey-known-funnel'));
        else {
          const banner = doc.querySelector('.survey-clickstream-history');
          assert.ok(banner);
          assert.equal(banner.querySelector('a').href, 'https://clickstream.sberbank.ru/frontend/sbol/reports/funnels/34601');
          assert.equal(banner.querySelectorAll('li').length, 3);
          assert.match(banner.textContent, /CR \(% конверсии\)/);
          assert.doesNotMatch(banner.textContent, /Источники привлечения|Механики привлечения/);
          assert.equal(doc.querySelector('h1').textContent, 'Укажите, что еще включает воронка привлечения?');
        }
        for (const item of existing) {
          assert.equal(item.querySelector('input').checked, true);
          assert.equal(item.querySelector('input').disabled, true);
          assert.match(item.textContent, /Уже имеются/);
        }
        const evidence = doc.querySelector('.survey-inline-evidence');
        assert.ok(evidence, 'Positive funnel answer reveals inline evidence');
        assert.equal(evidence.getAttribute('aria-label'), `Подтверждение воронки ${noun}`);
        assert.match(evidence.querySelector('h2').textContent, new RegExp(`воронку ${noun}`));
        if (direction === 'attract') {
          assert.ok(evidence.classList.contains('survey-previous-evidence'));
          assert.equal(evidence.querySelector('ol a').href, 'https://clickstream.sberbank.ru/frontend/sbol/reports/funnels/34601');
          assert.match(evidence.textContent, /При необходимости скорректируйте/);
          assert.ok(evidence.querySelector('textarea') === null);
          assert.ok(evidence.querySelector('input[type=radio]') === null);
          const keep = [...evidence.querySelectorAll('button')].find(button => button.textContent === 'Не требуется корректировки');
          assert.equal(keep.getAttribute('aria-pressed'), 'true');
          [...evidence.querySelectorAll('button')].find(button => button.textContent === 'Скорректировать').click();
          await pause();
          assert.equal(evidence.querySelector('textarea').value, 'https://clickstream.sberbank.ru/frontend/sbol/reports/funnels/34601');
        }
        assert.equal(evidence.querySelector('.survey-excel-notice'), null);
        evidence.querySelector('input[value="excel"]').click(); await pause();
        const notice = evidence.querySelector('.survey-excel-notice');
        assert.equal(notice.textContent, 'Для учета в оценке просим направить по почте нам. В противном случае ответ не будет принят.');
        assert.equal(notice.querySelector('a').getAttribute('href'), 'mailto:MYCherkova@sberbank.ru,RGShishko@sberbank.ru,ASAntandze@sberbank.ru');
        assert.equal(notice.parentElement, evidence);
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, false);
        evidence.querySelector('input[type="radio"]').click(); await pause();
        assert.equal(evidence.querySelector('.survey-excel-notice'), null, 'Switching to a link hides the Excel notice');
        const link = doc.querySelector('.survey-inline-evidence input[type="url"], .survey-inline-evidence textarea');
        assert.ok(link, 'Link format reveals URL field');
        await write(link, 'not-a-link');
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
        await write(link, `https://example.test/${direction}-report`);
      }
      if (['attractAnalysis', 'churnAnalysis'].includes(doc.querySelector('.survey-single-question').dataset.questionId)) {
        const action = [...doc.querySelectorAll('.survey-answer > .survey-options .g-checkbox')]
          .find(node => node.textContent.includes('Зафиксирован пул мероприятий'));
        assert.ok(action, 'Actions are an analysis checkbox');
        action.querySelector('input').click(); await pause();
        const proof = doc.querySelector('.survey-inline-question textarea');
        assert.ok(proof, 'Selected actions reveal the current quarter description');
        await write(proof, 'Задачи текущего квартала');
        const evidence = doc.querySelector('.survey-inline-question .survey-inline-evidence');
        assert.ok(evidence, 'Actions retain their own confirmation');
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
        evidence.querySelector('input[value="excel"]').click(); await pause();
        assert.ok(evidence.querySelector('.survey-excel-notice'));
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, false);
        action.querySelector('input').click(); await pause();
        assert.ok(!doc.querySelector('.survey-inline-question textarea'));
      }
      if (doc.querySelector('.survey-single-question').dataset.questionId === 'discovery') {
        const proof = doc.querySelector('textarea');
        assert.ok(proof, 'Positive Discovery answer reveals inline backlog evidence');
        assert.equal(proof.id, 'backlog');
        assert.ok(doc.activeElement === proof, 'New backlog field receives focus');
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
        await write(proof, 'https://example.test/backlog');
        doc.querySelector('input[value="Нет собственных аналитиков"]').click(); await pause();
        assert.ok(!doc.querySelector('#backlog'));
        const staff = doc.querySelector('.survey-inline-question textarea');
        assert.ok(staff);
        assert.match(staff.closest('.survey-inline-question').textContent, /Если функцию аналитики выполняет Штаб/);
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, false);
        await write(staff, 'Штаб: клиентская аналитика, Иванов Иван Иванович');
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, false);
        doc.querySelector('input[value="Больше 80%"]').click(); await pause();
        assert.ok(!doc.querySelector('#discoveryStaff'));
        assert.equal(doc.querySelector('textarea').value, 'https://example.test/backlog');
      }
      if (doc.querySelector('.survey-single-question').dataset.questionId === 'upsell') {
        const known = doc.querySelectorAll('.survey-known-mechanic input[type="checkbox"]');
        assert.equal(known.length, 2);
        for (const input of known) {assert.equal(input.disabled, true); assert.equal(input.checked, true);}
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true, 'Mechanics requires its comment');
        assert.ok(doc.activeElement === doc.querySelector('textarea'));
        await write(doc.querySelector('textarea'), 'Описание механики');
      }
      if (doc.querySelector('.survey-single-question').dataset.questionId === 'support') {
        assert.equal(doc.querySelectorAll('.survey-option-group').length, 6);
        const other = [...doc.querySelectorAll('.g-checkbox')].find(n => n.textContent.trim() === 'Другое');
        other.querySelector('input').click(); await pause();
        assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
        assert.ok(doc.activeElement === doc.querySelector('textarea'));
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
    const benchmark = [...doc.querySelectorAll('.survey-answer > .survey-options .g-checkbox')].find(node => node.textContent.trim() === 'Бенчмарки');
    if (benchmark) {
      benchmark.querySelector('input').click(); await pause();
      const proof = doc.querySelector('#benchmarkAttractProof, #benchmarkChurnProof');
      assert.ok(proof, 'Benchmark checkbox reveals its description on the same screen');
      await write(proof, proof.id.includes('Churn') ? 'Бенчмарки рынка оттока' : 'Бенчмарки рынка привлечения');
    }
    const sourceRadio = doc.querySelector('.survey-inline-question input[value="Дашборд в Навигаторе"]');
    if (sourceRadio) {
      assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true, 'Metric value requires its source');
      if (doc.querySelector('.survey-single-question').dataset.questionId === 'marketRussia') {
        const choose = async value => {doc.querySelector(`.survey-inline-question input[value="${value}"]`).click(); await pause();};
        const nextDisabled = () => [...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled;
        await choose('Собственная отчетность');
        assert.equal(nextDisabled(), true);
        doc.querySelector('.survey-evidence-options input[value="excel"]').click(); await pause();
        assert.equal(nextDisabled(), false);
        assert.equal(doc.querySelector('.survey-excel-notice a').getAttribute('href'), 'mailto:MYCherkova@sberbank.ru,RGShishko@sberbank.ru,ASAntandze@sberbank.ru');
        await choose('Запрос у аналитиков');
        assert.ok(doc.querySelector('.survey-inline-evidence') === null, 'Analyst request has no orange wrapper');
        assert.ok(doc.querySelector('.survey-other-answer') === null, 'Analyst request needs no follow-up');
        assert.ok(doc.querySelector('.survey-excel-notice') === null);
        assert.equal(nextDisabled(), false);
        await choose('Свой вариант ответа');
        assert.ok(doc.querySelector('.survey-excel-notice') === null);
        assert.equal(nextDisabled(), true);
        await write(doc.querySelector('textarea'), 'Свой источник');
        assert.equal(nextDisabled(), false);
        await choose('Затрудняюсь ответить');
        assert.ok(doc.querySelector('textarea') === null);
        assert.equal(nextDisabled(), false);
      }
      sourceRadio.click(); await pause();
      const link = doc.querySelector('input[type="url"]');
      await write(link, 'invalid-link');
      assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
      await write(link, 'https://example.test/key-metric');
    }
  };
  try {
    await pause();
    const doc = dom.window.document;
    assert.equal(doc.querySelector('h1').textContent, 'Добрый день!');
    assert.match(doc.body.textContent, /Data Driven 3Q26/);
    assert.match(doc.body.textContent, /учтены предыдущие ответы и цифровые следы/);
    assert.ok(doc.activeElement === doc.querySelector('h1'), 'Cover starts with its heading focused');
    assert.ok(doc.querySelector('.survey-source-table') === null, 'No invented team summary before selection');
    assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true);
    doc.querySelector('form').dispatchEvent(new dom.window.Event('submit', {bubbles: true, cancelable: true}));
    await pause();
    assert.match(doc.querySelector('[role="alert"]').textContent, /Введите ответ/);
    await write(doc.querySelector('input'), 'Тестовый ответ');
    assert.equal([...doc.querySelectorAll('button')].find(b => b.textContent.includes('Далее')).disabled, true, 'Name alone cannot bypass team selection');
    await fillCurrent();
    assert.equal(doc.querySelectorAll('.survey-source-table th').length, 2);
    assert.match(doc.querySelector('.survey-cover-count').textContent, /В опросе участвует \d+ раздел/);
    assert.match(doc.querySelector('.survey-source-table td:first-child').textContent, /Cross-sell после оформления/);
    assert.match(doc.querySelector('.survey-source-table td:last-child').textContent, /Cross-sell во время оформления/);
    assert.match(doc.querySelector('.survey-source-table td:first-child').textContent, /Знание ключевых метрик/);
    assert.doesNotMatch(doc.querySelector('.survey-source-table td:first-child').textContent, /Объём целевого рынка|MAU продукта/);
    assert.match(doc.querySelector('.survey-source-table td:last-child').textContent, /A\/B-тесты/);
    assert.match(doc.querySelector('.survey-source-table td:last-child').textContent, /Оценка исследований/);
    assert.match(doc.querySelector('.survey-source-table td:last-child').textContent, /CX Score/);
    await click('Далее');
    const progressLabel = doc.querySelector('.survey-progress-label');
    assert.match(progressLabel.textContent, /Шаг 2 из/);
    const items = [...doc.querySelectorAll('nav.survey-progress-steps button')];
    assert.equal(items.length, Number(progressLabel.textContent.match(/из (\d+)/)[1]));
    assert.notEqual(items[0].getAttribute('aria-disabled'), 'true');
    assert.equal(items[2].getAttribute('aria-disabled'), 'true');
    items[2].click(); await pause();
    assert.equal(doc.querySelector('.survey-single-question').dataset.questionId, 'marketRussia', 'Future click cannot bypass required answers');
    items[2].focus(); await pause();
    assert.equal(doc.querySelector('.survey-progress-hint').textContent, items[2].getAttribute('aria-label'));
    items[0].click(); await pause();
    assert.equal(doc.querySelector('.survey-single-question').dataset.questionId, 'cover');
    assert.equal(doc.querySelector('input').value, 'Тестовый ответ', 'Returning to title preserves the name');
    await click('Далее');
    let screenCount = 1;
    while (dom.window.document.querySelector('form')) {
      assert.equal(dom.window.document.querySelectorAll('.survey-single-question').length, 1);
      assert.ok(screenCount < 35, 'Flow terminates');
      const editable = dom.window.document.querySelector('textarea, input:not([type="radio"]):not([type="checkbox"])');
      if (editable && !editable.closest('.survey-inline-evidence') && !dom.window.document.querySelector('.g-select')) assert.ok(dom.window.document.activeElement === editable, 'New text question focuses its answer automatically');
      const currentTitle = dom.window.document.querySelector('h1').textContent;
      const currentId = dom.window.document.querySelector('.survey-single-question').dataset.questionId;
      if (currentId === 'marketRussia') {
        assert.equal(doc.querySelector('.survey-section-number').textContent, 'Раздел 1');
        assert.equal(doc.querySelector('.survey-section-intro h2').textContent, 'Ключевые метрики');
        assert.ok(doc.querySelector('.survey-section-intro p').textContent.length > 0);
        assert.equal(doc.querySelector('.survey-eyebrow').textContent, 'Раздел 1');
      }
      if (currentId === 'mau') assert.ok(doc.querySelector('.survey-section-intro') === null, 'Section introduction is not repeated');
      if (currentId === 'product') {
        const select = dom.window.document.querySelector('[role="combobox"]');
        assert.equal(select.getAttribute('aria-expanded'), 'false', 'Team dropdown starts closed');
        assert.notEqual(dom.window.document.activeElement, select, 'Team dropdown is not automatically focused');
        assert.equal(dom.window.document.querySelector('[role="listbox"]'), null);
      }
      if (currentId === 'crossSellInfo') {
        assert.match(dom.window.document.querySelector('.survey-info-copy').textContent, /по цифровым следам с платформы LossHunter/);
        assert.equal(dom.window.document.querySelector('.survey-single-question input, .survey-single-question textarea'), null);
      } else if (currentId === 'attractDeviationsCompleted') {
        for (const control of dom.window.document.querySelectorAll('.survey-single-question textarea')) await write(control, 'Результат мероприятия');
        dom.window.document.querySelector('.survey-evidence-options input[type="radio"][value="excel"]').click();
        await pause();
      } else {
        await fillCurrent();
        if (currentId === 'crossSellAfter') await write(dom.window.document.querySelector('textarea'), 'Продукт для Cross-sell');
        if (['attractDeviations', 'deviations'].includes(currentId)) {
          await write(dom.window.document.querySelector('textarea'), 'Задачи квартала');
          assert.match(dom.window.document.querySelector('.survey-inline-question h2').textContent, /за текущий квартал/);
          dom.window.document.querySelector('.survey-evidence-options input[value="excel"]').click(); await pause();
        }
      }
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
    assert.equal(screenCount, 17, 'Metric sources are inline; separate monitoring step is removed');
    assert.match(dom.window.document.querySelector('h1').textContent, /Проверьте ответы/);
    assert.equal(dom.window.document.querySelectorAll('.review-answer').length, 17);
    const reviewItems = [...dom.window.document.querySelectorAll('.survey-progress-step')];
    assert.equal(reviewItems.length, 17);
    assert.ok(reviewItems.every(item => item.getAttribute('aria-disabled') !== 'true'), 'Review permits editing any question');
    const evidenceLinks = [...dom.window.document.querySelectorAll('.review-inline-evidence a')].map(link => link.href);
    assert.deepEqual(evidenceLinks, ['https://example.test/attract-report', 'https://example.test/churn-report']);
    assert.doesNotMatch(dom.window.document.body.textContent, /Не заполнено/);
    assert.doesNotMatch(dom.window.document.body.textContent, /Бэклог продукта уже проанализирован/);
    const editAnswer = async title => {
      const row = [...dom.window.document.querySelectorAll('.review-answer')].find(n => [...n.querySelectorAll('b')].some(b => b.textContent === title));
      assert.ok(row, 'Review answer found');
      row.querySelector('button').click(); await pause();
    };
    assert.match(dom.window.document.body.textContent, /https:\/\/example\.test\/backlog/);
    const benchmarkTitle = 'Укажите, что еще включает воронка привлечения?';
    const benchmarkReview = () => [...dom.window.document.querySelectorAll('.review-answer')].find(row => [...row.querySelectorAll('b')].some(b => b.textContent === benchmarkTitle));
    assert.match(benchmarkReview().textContent, /Бенчмарки рынка привлечения/);
    await editAnswer(benchmarkTitle);
    assert.equal(dom.window.document.querySelector('#benchmarkAttractProof').value, 'Бенчмарки рынка привлечения');
    const negativeBenchmark = [...dom.window.document.querySelectorAll('.g-checkbox')].find(node => node.textContent.trim() === 'Бенчмарки');
    negativeBenchmark.querySelector('input').click(); await pause();
    assert.ok(dom.window.document.querySelector('#benchmarkAttractProof') === null, 'Negative benchmark answer hides description');
    await click('Сохранить и вернуться');
    assert.doesNotMatch(benchmarkReview().textContent, /Бенчмарки рынка привлечения/);
    await editAnswer(benchmarkTitle);
    const positiveBenchmark = [...dom.window.document.querySelectorAll('.g-checkbox')].find(node => node.textContent.trim() === 'Бенчмарки');
    positiveBenchmark.querySelector('input').click(); await pause();
    assert.equal(dom.window.document.querySelector('#benchmarkAttractProof').value, 'Бенчмарки рынка привлечения', 'Changing answer preserves entered proof for later editing');
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
    const crossSellCard = dom.window.document.querySelector('.finish-crosssell');
    assert.match(crossSellCard.textContent, /Не забудьте посмотреть статус Cross-sell по ссылке/);
    const crossSellLink = crossSellCard.querySelector('a');
    assert.equal(crossSellLink.href, 'https://losshunter.ru/showcase/crosssell/#screen=pult');
    assert.equal(crossSellLink.target, '_blank');
    assert.equal(payload.answers.crossSellInfo, undefined);
    assert.equal(payload.questionSources.crossSellInfo, undefined);
    assert.equal(dom.window.document.querySelectorAll('.finish-stats strong').length, 3);
    await click('Вернуться к ответам');
    assert.equal(dom.window.DDI_SURVEY_RESULT_JSON, null, 'Returning to review invalidates the exported result');
    assert.match(dom.window.document.querySelector('h1').textContent, /Проверьте ответы/);
    assert.deepEqual(errors, []);
    assert.equal(dom.window.localStorage.length, 0);
    assert.equal(dom.window.sessionStorage.length, 0);
  } finally {dom.window.close();}
});

test('churn benchmarks require inline description for Yes and omit stale descriptions otherwise', () => {
  const parent = sections.find(s => s.id === 'benchmarks').questions.find(q => q.id === 'benchmarksChurn');
  for (const proof of [undefined, '', '   ']) {
    assert.equal(hasAnswer(parent, {benchmarksChurn: 'Да', benchmarkChurnProof: proof}), false);
    assert.throws(() => buildSurveyResult({...completedAnswers(), benchmarkChurnProof: proof}), /Incomplete/);
  }
  const positive = buildSurveyResult({...completedAnswers(), benchmarkChurnProof: 'Бенчмарки оттока'});
  assert.equal(positive.answers.benchmarkChurnProof, 'Бенчмарки оттока');
  assert.equal(positive.result.metrics.find(m => m.code === 'churn.benchmarks').evidence, 'Бенчмарки оттока');
  for (const answer of ['Нет', 'Затрудняюсь ответить']) {
    assert.equal(hasAnswer(parent, {benchmarksChurn: answer}), true);
    const result = buildSurveyResult({...completedAnswers(), churnIncludes: ['Затрудняюсь ответить'], benchmarksChurn: answer, benchmarkChurnProof: 'Старое описание'});
    assert.ok(!('benchmarkChurnProof' in result.answers));
    assert.ok(!('benchmarkChurnProof' in result.questionSources));
    assert.ok('benchmarkAttractProof' in result.answers);
  }
});
