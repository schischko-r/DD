import {previousBacklogs, hasBacklogLinks, isBacklogUrl} from './previous-backlogs.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {productSurveyProfiles} from './survey-profiles.js';
import {assignFunnelEvidence, getBacklogAnalyzed, getSections, hasAnswer, inlineQuestions, knownMechanics, needsComment, needsEvidence, needsProof, needsReason, visibleQuestions} from './questions.js';
import {buildSurveyResult} from './result.js';
import {enabledTeams, teams} from './teams.js';

const report = JSON.parse(readFileSync(new URL('../../public/report-data.json', import.meta.url), 'utf8'));
const products = report.products.filter(team => team.type === 'Продукт');
const route = answers => getSections(answers).flatMap(section =>
  visibleQuestions(section, getBacklogAnalyzed(answers), answers));

test('all products answer about churn models and export only active confirmation', () => {
  for (const team of enabledTeams) {
    const answers = completeAnswers(team);
    const churn = getSections(answers).find(s => s.id === 'churn');
    const model = churn.questions.find(q => q.id === 'churnModel');
    assert.ok(model, team.name);
    assert.deepEqual(model.options, ['Да', 'Нет', 'Не релевантно для моего продукта', 'Затрудняюсь ответить']);
    const includesIndex = churn.questions.findIndex(q => q.id === 'churnIncludes');
    if (includesIndex >= 0) assert.equal(churn.questions.indexOf(model), includesIndex + 1);
    assert.equal(hasAnswer(model, {}), false);
    assert.equal(hasAnswer(model, {churnModel: 'Да'}), false);
    const {id, formatId} = model.inlineEvidence;
    const positive = {...answers, churnModel: 'Да', [formatId]: 'link', [id]: 'https://example.test/model'};
    assert.equal(hasAnswer(model, {...positive, [id]: 'invalid'}), false);
    const linked = buildSurveyResult(positive);
    assert.equal(linked.answers[id], 'https://example.test/model');
    assert.equal(linked.answers[formatId], 'link');
    const excel = buildSurveyResult({...positive, [formatId]: 'excel'});
    assert.equal(excel.answers[formatId], 'excel');
    assert.ok(!(id in excel.answers));
    for (const negative of ['Нет', 'Не релевантно для моего продукта', 'Затрудняюсь ответить']) {
      const result = buildSurveyResult({...positive, churnModel: negative});
      assert.equal(result.answers.churnModel, negative);
      for (const field of [id, formatId]) {
        assert.ok(!(field in result.answers));
        assert.ok(!(field in result.questionSources));
      }
      assert.deepEqual(result.result.metrics, buildSurveyResult(answers).result.metrics);
    }
  }
});

test('benchmarks are checkbox options and do not restore excluded completeness', () => {
  for (const team of enabledTeams) {
    assert.ok(!getSections({product: team.id}).some(s => s.id === 'benchmarks'));
    for (const parent of getSections({product: team.id}).flatMap(s => s.questions)) {
      if (!parent.benchmark) continue;
      assert.ok(parent.options.includes('Бенчмарки'));
      assert.ok(!inlineQuestions(parent).some(q => q.id.startsWith('benchmarks')));
      if (parent.benchmarkOnly) {
        assert.deepEqual(parent.options, ['Бенчмарки', 'Затрудняюсь ответить']);
        assert.equal(parent.inlineEvidence, undefined);
      }
    }
  }
});

function completeAnswers(team) {
  const answers = {name: 'Тест', product: team.id, unit: team.unit, alertsComment: 'Настроены оповещения по ключевым метрикам'};
  for (const question of getSections(answers).flatMap(section => section.questions).flatMap(q => [q, ...inlineQuestions(q)])) {
    if (question.id === 'name' || question.id === 'product') continue;
    if (question.type === 'links') answers[question.id] = 'https://example.test/kpi';
    else if (question.type === 'numeric') answers[question.id] = '1000';
    else if (question.type === 'multi') {
      const option = question.options.includes('Затрудняюсь ответить')
        ? 'Затрудняюсь ответить'
        : question.options.includes('Не настроены дополнительные механики')
          ? 'Не настроены дополнительные механики'
          : question.options[0];
      answers[question.id] = [option];
    } else if (question.type === 'radio') {
      answers[question.id] = question.id === 'goalsMonitoring' ? question.options[0] : question.id.endsWith('Configured') ? 'Затрудняюсь ответить' : question.options.includes('Нет') ? 'Нет' : question.options[0];
    } else answers[question.id] = 'Тест';
  }
  for (const question of route(answers).flatMap(q => [q, ...inlineQuestions(q)])) {
    if (needsComment(question, answers)) answers[question.commentId] = 'Описание механики';
    if (needsReason(question, answers)) answers[question.reasonId] = 'Не подходит для продукта';
    if (needsEvidence(question, answers)) answers[question.inlineEvidence.formatId] = 'excel';
    if (needsProof(question, answers)) answers[question.inlineProof.id] = question.inlineProof.kind === 'metricSource' ? 'Затрудняюсь ответить' : question.inlineProof.kind === 'backlog' ? 'https://jira.sberbank.ru/browse/DA-1' : 'Описание подтверждения';
  }
  return answers;
}

test('every enabled product profile matches its DDI metric snapshot', () => {
  assert.equal(products.length, 67);
  assert.ok(enabledTeams.every(team => productSurveyProfiles[team.id]));
  assert.deepEqual(new Set(Object.values(productSurveyProfiles).filter(profile => !profile.fullSurvey).map(profile => profile.teamId)), new Set(products.map(team => team.id)));
  for (const source of products) {
    const profile = productSurveyProfiles[source.id];
    assert.equal(profile.teamId, source.id);
    assert.equal(profile.period, source.period);
    const expected = source.metrics.flatMap(block => block.metrics || []).map(metric => ({
      code: metric.code, name: metric.name, value: metric.value,
      max_value: metric.max_value, dd_calculation_flg: metric.dd_calculation_flg,
      is_applicabble_flg: metric.is_applicabble_flg,
      excluded_from_index: metric.excluded_from_index,
    }));
    assert.deepEqual(profile.metrics, expected, `${source.name}: metric snapshot`);
  }
  for (const team of teams.filter(team => !productSurveyProfiles[team.id])) {
    assert.ok(!enabledTeams.some(enabled => enabled.id === team.id), `${team.name}: nonproduct stays disabled`);
  }
});

test('all product routes can complete and preserve their own baseline', () => {
  for (const team of enabledTeams) {
    const answers = completeAnswers(team);
    const questions = route(answers);
    const knowledge = {
      marketRussia: 'general.obъem_celevogo_rynka_v_rossii',
      marketSber: 'general.obъem_celevogo_rynka_v_sbere',
      clients: 'general.klienty_s_produktom', mau: 'general.mau_produkta',
      satellite: 'general.znanie_produktov_sputnikov', dau: 'general.dau_produkta',
      yau: 'general.yau_produkta', dauMau: 'general.dau_mau',
      monitoring: 'general.navigator_reporting_knowledge',
    };
    for (const [id, code] of Object.entries(knowledge)) {
      const metric = productSurveyProfiles[team.id].metrics.find(item => item.code === code);
      if (metric && metric.is_applicabble_flg && !metric.excluded_from_index &&
        Number(metric.dd_calculation_flg) !== 0 && metric.max_value > 0) {
        const completed = ['marketRussia', 'marketSber', 'satellite'].includes(id) && Number(metric.value) / Number(metric.max_value) === 1;
        assert.equal(questions.some(question => question.id === id), id === 'monitoring' ? false : !completed,
          `${team.name}: knowledge ${id} respects completed prior answer`);
      }
    }
    assert.ok(questions.length > 6, `${team.name}: substantive route`);
    for (const question of questions) assert.equal(hasAnswer(question, answers), true,
      `${team.name}: ${question.id} is answerable`);
    for (const id of ['marketRussia', 'marketSber', 'satellite']) {
      if (!questions.some(q => q.id === id)) {
        answers[id] = '999';
        answers[id + 'Source'] = 'Старое значение';
        answers[id + 'SourceLink'] = 'https://stale.test';
      }
    }
    const result = buildSurveyResult(answers, getBacklogAnalyzed(answers), '2026-10-12T00:00:00Z');
    for (const id of ['marketRussia', 'marketSber', 'satellite']) {
      if (!questions.some(q => q.id === id)) {
        for (const field of [id, id + 'Source', id + 'SourceLink']) {
          assert.ok(!(field in result.answers));
          assert.ok(!(field in result.questionSources));
        }
        const metric = productSurveyProfiles[team.id].metrics.find(m => m.code === knowledge[id]);
        if (metric) assert.equal(result.result.metrics.find(m => m.code === knowledge[id]).value, metric.value);
      }
    }

    const baseline = productSurveyProfiles[team.id];
    assert.deepEqual(result.team, {id: team.id, name: team.name, unit: team.unit});
    assert.equal(result.surveyId, team.name === 'Вклады+НС'
      ? 'ddi-deposits-ns' : `ddi-product-${team.id.split('¦')[0]}`);
    assert.equal(result.result.baselinePeriod, baseline.period);
    assert.equal(result.result.metrics.length, baseline.metrics.length, `${team.name}: metric count`);
    for (const metric of result.result.metrics) {
      const original = baseline.metrics.find(item => item.code === metric.code);
      assert.equal(metric.baselineValue, original.value, `${team.name}: ${metric.code} baseline`);
      assert.equal(metric.maxValue, original.max_value, `${team.name}: ${metric.code} maximum`);
      if (metric.source === 'ddi_baseline') assert.equal(metric.value, original.value,
        `${team.name}: ${metric.code} unchanged`);
    }
    assert.ok(result.result.points <= result.result.maxPoints, `${team.name}: valid score`);
    for (const code of result.result.unscoredGapMetricCodes) {
      const metric = result.result.metrics.find(item => item.code === code);
      assert.ok(metric, `${team.name}: unscored gap exists`);
      assert.equal(metric.source, baseline.fullSurvey ? 'no_previous_answer' : 'ddi_baseline', `${team.name}: ${code} remains baseline`);
      assert.ok(metric.baselineValue < metric.maxValue, `${team.name}: ${code} is an actual gap`);
    }
    assert.equal(result.answers.product, team.id);
  }
});

test('known mechanics, backlog and completed metric gaps vary by product', () => {
  const byName = name => enabledTeams.find(team => team.name === name);
  const deposits = byName('Вклады+НС');
  const bPif = byName('БПИФ');
  const backlog = byName('Объект Авто');
  assert.ok(deposits && bPif && backlog);
  assert.equal(getBacklogAnalyzed({product: deposits.id}), false);
  assert.equal(getBacklogAnalyzed({product: backlog.id}), true);
  assert.ok(route(completeAnswers(deposits)).some(question => question.id === 'discovery'));
  assert.ok(!route(completeAnswers(backlog)).some(question => question.id === 'discovery'));
  assert.notDeepEqual(route(completeAnswers(deposits)).map(question => question.id),
    route(completeAnswers(bPif)).map(question => question.id));
  assert.ok(!route(completeAnswers(bPif)).some(question => question.id === 'attractConfigured'),
    'Maximum attraction reporting score omits the question');
  assert.ok(route(completeAnswers(byName('Брокерский счет')))
    .some(question => question.id === 'attractConfigured'),
  'Incomplete attraction reporting score asks the sourced question');
  for (const team of enabledTeams) assert.ok(!route(completeAnswers(team))
    .some(question => question.id === 'goalsReporting'),
  `${team.name}: digitally traced goals stay outside the survey`);
  assert.notDeepEqual(buildSurveyResult(completeAnswers(deposits)).previousMechanics,
    buildSurveyResult(completeAnswers(bPif)).previousMechanics);
});

test('reporting choices and conditional completeness follow previous scores for every product', () => {
  const formats = ['Да, автоматическая (monthly/weekly)', 'Да, по запросу', 'Нет', 'Затрудняюсь ответить'];
  for (const team of enabledTeams) {
    const base = completeAnswers(team);
    const questions = getSections(base).flatMap(s => s.questions);
    for (const [configuredId, includesId, analysisId, code] of [
      ['attractConfigured', 'attractIncludes', 'attractAnalysis', 'attract.nastroena_otchetnostь'],
      ['churnConfigured', 'churnIncludes', 'churnAnalysis', 'churn.nastroena_otchetnostь'],
      ['usageConfigured', 'usageIncludes', 'usageAnalysis', 'attract.nastroena_otchetnostь'],
    ]) {
      const q = questions.find(q => q.id === configuredId);
      if (!q) continue;
      const metric = productSurveyProfiles[team.id].metrics.find(m => m.code === code);
      const previousPositive = Number(metric.value) > 0;
      assert.deepEqual(q.options, formats.filter(v => v !== 'Нет' || !previousPositive), `${team.name}: ${configuredId}`);
      if (previousPositive) {
        const direction = {attractConfigured: 'привлечения', churnConfigured: 'оттока', usageConfigured: 'использования'}[configuredId];
        assert.equal(q.title, `С какой регулярностью настроен мониторинг по воронке ${direction}?`);
      } else assert.ok(q.title.startsWith('Настроена ли регулярная отчётность'));
      assert.equal(q.reasonId, undefined);
      assert.equal(hasAnswer(q, {...base, [configuredId]: 'Не релевантно для моего продукта'}), false);
      if (previousPositive) assert.equal(hasAnswer(q, {...base, [configuredId]: 'Нет'}), false);
      for (const [choice, fraction] of [[formats[0], 1], [formats[1], 0.5]]) {
        const answers = {...base, [configuredId]: choice};
        if (q.inlineEvidence) answers[q.inlineEvidence.formatId] = 'excel';
        const result = buildSurveyResult(answers);
        assert.equal(result.result.metrics.find(m => m.code === code).value, metric.max_value * fraction);
      }
      const includes = questions.find(q => q.id === includesId && !q.benchmarkOnly);
      if (!includes || previousPositive) continue;
      const no = {...base, [configuredId]: 'Нет', [includesId]: [includes.options[0]]};
      if (includes.inlineEvidence) {
        no[includes.inlineEvidence.id] = 'https://example.test/stale';
        no[includes.inlineEvidence.formatId] = 'link';
      }
      assert.ok(!route(no).some(q => q.id === includesId));
      if (questions.some(q => q.id === analysisId)) assert.ok(route(no).some(q => q.id === analysisId));
      const result = buildSurveyResult(no);
      assert.ok(!(includesId in result.answers));
      assert.ok(!(includesId in result.questionSources));
      if (includes.inlineEvidence) assert.ok(!(includes.inlineEvidence.id in result.answers));
      assert.ok(route({...no, [configuredId]: formats[1]}).some(q => q.id === includesId));
      assert.ok(route({...no, [configuredId]: 'Затрудняюсь ответить'}).some(q => q.id === includesId));
    }
  }
});

test('Data products use their own knowledge and funnel questions', () => {
  const byName = name => enabledTeams.find(team => team.name === name);
  const sber = getSections({product: byName('SberID').id}).flatMap(section => section.questions);
  const mail = getSections({product: byName('Почта, Диск, Календарь').id})
    .flatMap(section => section.questions);
  for (const [questions, expected] of [
    [sber, ['dau', 'dauMau', 'monitoring', 'qualityTools', 'usageIncludes', 'uxAlerts']],
    [mail, ['dau', 'yau', 'dauMau', 'monitoring', 'qualityTools', 'usageConfigured',
      'usageIncludes', 'usageAnalysis', 'churnConfigured', 'churnIncludes', 'churnAnalysis']],
  ]) {
    for (const id of expected) assert.ok(questions.some(question => question.id === id), `${id} is sourced`);
    for (const id of ['attractIncludes', 'attractAnalysis']) {
      assert.ok(!questions.some(question => question.id === id), `${id} from deposits is excluded`);
    }
  }
  for (const [id, row] of [['dau', 23], ['dauMau', 27], ['monitoring', 29],
    ['qualityTools', 35], ['usageIncludes', 57], ['uxAlerts', 147]]) {
    const question = sber.find(item => item.id === id);
    assert.equal(question.sheet, 'Data');
    assert.equal(question.row, row);
  }
  assert.equal(sber.find(question => question.id === 'dau').adaptedFrom, 'Какое DAU у вашего канала?');
  assert.equal(sber.find(question => question.id === 'dau').title, 'Какое DAU у вашего продукта?');
  for (const [id, row] of [['yau', 25], ['usageConfigured', 53], ['usageAnalysis', 115],
    ['churnConfigured', 85], ['churnIncludes', 89], ['churnAnalysis', 128]]) {
    const question = mail.find(item => item.id === id);
    assert.equal(question.sheet, 'Data');
    assert.equal(question.row, row);
  }
  const sberResult = buildSurveyResult(completeAnswers(byName('SberID')));
  assert.deepEqual(sberResult.questionSources.dau, {
    sheet: 'Data', row: 23, adaptedFrom: 'Какое DAU у вашего канала?', accuracyReview: true,
  });
  assert.deepEqual(sberResult.questionSources.usageIncludes, {sheet: 'Data', row: 57});
  const mailResult = buildSurveyResult(completeAnswers(byName('Почта, Диск, Календарь')));
  assert.deepEqual(mailResult.questionSources.yau, {sheet: 'Data', row: 25});
  assert.deepEqual(mailResult.questionSources.churnIncludes, {
    sheet: 'Data', row: 89,
    adaptedFrom: 'Что включает воронка оттока (анализа снижения активности в канале)?',
    accuracyReview: true,
  });
  const configured = mail.find(q => q.id === 'usageConfigured');
  assert.deepEqual(configured.options, ['Да, автоматическая (monthly/weekly)', 'Да, по запросу', 'Затрудняюсь ответить']);
  assert.equal(hasAnswer(configured, {usageConfigured: 'Нет'}), false);

});

for (const targetName of ['БПИФ', 'Почта, Диск, Календарь']) test(`autonomous page completes ${targetName} and clears the previous team answers`, async () => {
  const target = enabledTeams.find(team => team.name === targetName);
  const html = readFileSync(new URL('../../dist-deposits-survey/deposits-survey.html', import.meta.url), 'utf8');
  const script = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
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
  const pause = () => new Promise(resolve => setTimeout(resolve, 30));
  const currentId = () => doc.querySelector('.survey-single-question')?.dataset.questionId;
  const button = label => [...doc.querySelectorAll('.survey-actions button')].find(item => item.textContent.includes(label));
  const write = async (control, value) => {
    const prototype = control.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, value);
    control.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
    await pause();
  };
  const next = async () => {assert.equal(button('Далее').getAttribute('aria-disabled') === 'true', false, `${currentId()}: next enabled`); button('Далее').click(); await pause();};
  const selectTeam = async name => {
    doc.querySelector('[role="combobox"]').click(); await pause();
    const option = [...doc.querySelectorAll('[role="option"], .g-select-list__option, .g-list__item')]
      .find(item => item.textContent.trim() === name);
    assert.ok(option, `${name} is selectable`);
    option.click(); await pause();
  };
  try {
    await pause();
    await write(doc.querySelector('.survey-single-question input'), 'Тест');
    await selectTeam('Вклады+НС'); await next();
    await write(doc.querySelector('.survey-single-question input'), '777');
    button('Назад').click(); await pause();
    assert.equal(currentId(), 'cover');
    await selectTeam(target.name); await next();
    assert.equal(currentId(), route({product: target.id}).find(q => q.id !== 'name' && q.id !== 'product').id);
    assert.equal(doc.querySelector('.survey-single-question input').value, '', 'Deposit answer was cleared');

    const questions = getSections({product: target.id}).flatMap(section => section.questions);
    let count = 0;
    while (doc.querySelector('.survey-single-question')) {
      assert.ok(count++ < 45, 'Product questionnaire terminates');
      const id = currentId();
      const question = questions.find(item => item.id === id);
      assert.ok(question, `Question ${id} belongs to selected product`);
      if (question.type === 'info') {
        if (id === 'crossSellInfo') assert.match(doc.querySelector('.survey-info-copy').textContent, /Cross-sell/);
      } else if (question.type === 'numeric') {
        if (id === 'marketSber') {
          const detail = doc.querySelector('.survey-metric-detail');
          assert.equal(detail.textContent, 'Количество клиентов в Сбере, которых продукт реально может охватить с учетом текущей бизнес-модели.');
          assert.ok(detail.compareDocumentPosition(doc.querySelector('.question-hint')) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
        }
        await write(doc.querySelector('.survey-single-question input'), '1000');
      }
      else if (question.type === 'multi') {
        const option = id === 'usageIncludes' ? question.options[0]
          : question.options.includes('Затрудняюсь ответить') ? 'Затрудняюсь ответить'
          : question.options.includes('Не настроены дополнительные механики') ? 'Не настроены дополнительные механики'
            : question.options[0];
        const checkbox = [...doc.querySelectorAll('.survey-single-question .g-checkbox')]
          .find(item => item.textContent.trim() === option);
        assert.ok(checkbox, `${id}: ${option} available`);
        checkbox.querySelector('input').click(); await pause();
      } else if (question.type === 'links') {
        await write(doc.querySelector('.survey-link-fields input'), 'https://example.test/kpi');
      } else if (question.type === 'radio') {
        const option = question.options.includes('Нет') ? 'Нет' : question.options[0];
        const radio = [...doc.querySelectorAll('.survey-single-question .g-radio')]
          .find(item => item.textContent.trim() === option);
        assert.ok(radio, `${id}: ${option} available`);
        radio.querySelector('input').click(); await pause();

      } else {
        const control = doc.querySelector('.survey-single-question textarea, .survey-single-question input');
        await write(control, 'Тест');
      }
      for (const field of inlineQuestions(question)) {
        const block = [...doc.querySelectorAll('.survey-inline-question')].find(item => item.getAttribute('aria-label') === field.title);
        if (!block && field.when) continue;
        if (field.type === 'links') {
          await write(block.querySelector('.survey-link-fields input'), 'https://example.test/kpi');
        } else if (field.type === 'radio') {
          [...block.querySelectorAll('.g-radio')].find(node => node.textContent.trim() === 'Нет').querySelector('input').click(); await pause();
        } else await write(block.querySelector('textarea'), 'Результаты и причины');
      }
      const evidence = doc.querySelector('.survey-inline-evidence');
      if (evidence?.querySelector('input[type="radio"]')) {
        if (id === 'usageIncludes') assert.equal(evidence.querySelector('h2').textContent, 'Пожалуйста, приложите ссылки');
        assert.equal(evidence.querySelector('.survey-excel-notice'), null);
        evidence.querySelectorAll('input[type="radio"]')[1].click(); await pause();
        assert.match(evidence.querySelector('.survey-excel-notice').textContent, /^Пожалуйста, направьте отчетность нам по почте, чтобы мы могли учесть её при оценке\./);
        assert.equal(evidence.querySelector('.survey-excel-notice a').getAttribute('href'), `mailto:MYCherkova@sberbank.ru,RGShishko@sberbank.ru,ASAntandze@sberbank.ru?subject=${encodeURIComponent(`3Q_DDI - ${target.name} - Источники`)}`);
      } else if (evidence?.querySelector('textarea')) await write(evidence.querySelector('textarea'), question.inlineProof?.kind === 'backlog' ? 'https://jira.sberbank.ru/browse/DA-1' : 'Описание подтверждения');
      const comment = doc.querySelector('.survey-mechanics-comment textarea');
      if (comment) await write(comment, 'Описание механики');
      if (question.inlineProof?.kind === 'metricSource') {
        doc.querySelector('.survey-inline-question input[value="Запрос у аналитиков"]').click(); await pause();
        assert.equal(doc.querySelector('.survey-excel-notice'), null);
      }
      await next();
    }
    assert.match(doc.querySelector('h1').textContent, /Проверьте ответы/);
    button('Завершить опрос').click(); await pause();
    const payload = JSON.parse(dom.window.DDI_SURVEY_RESULT_JSON);
    assert.deepEqual(payload.team, {id: target.id, name: target.name, unit: target.unit});
    assert.equal(payload.answers.clients, '1000');
    assert.equal(payload.answers.churnConfiguredReason, undefined);
    assert.equal(payload.result.baselinePeriod, productSurveyProfiles[target.id].period);
    assert.equal(payload.result.metrics.length, productSurveyProfiles[target.id].metrics.length);
    assert.deepEqual(errors, []);
  } finally {dom.window.close();}
});

test('quarterly actions ignore previous maximum scores and keep attraction and churn separate', () => {
  for (const team of enabledTeams) {
    const actions = getSections({product: team.id}).find(section => section.id === 'actions')?.questions || [];
    for (const [code, id] of [['attract.initiatives_list', 'attractDeviations'], ['churn.deviation_actions', 'deviations']]) {
      const metric = productSurveyProfiles[team.id].metrics.find(item => item.code === code);
      const applicable = Boolean(metric && metric.is_applicabble_flg !== false && !metric.excluded_from_index && Number(metric.dd_calculation_flg) !== 0 && metric.max_value > 0);
      const parent = getSections({product: team.id}).flatMap(s => s.questions).find(q => q.action?.id === id);
      assert.equal(Boolean(parent), applicable, `${team.name}: ${id} merged if applicable`);
      assert.ok(!actions.some(q => q.id === id));
      if (parent) assert.ok(parent.options.includes(parent.actionOption));
      assert.equal(actions.some(q => q.id === `${id}Completed`), false,
        `${team.name}: retrospective is removed`);
    }
  }
});

test('action pools require Jira, Confluence or other confirmation; stale examples are excluded', () => {
  const team = enabledTeams.find(item => item.name === 'БПИФ');
  const answers = completeAnswers(team);
  for (const actionId of ['attractDeviations', 'deviations']) {
    const question = route(answers).find(q => q.action?.id === actionId);
    const proofId = actionId === 'deviations' ? 'deviationExample' : 'attractDeviationExample';
    assert.equal(question.inlineProof, undefined);
    const selected = {...answers, [question.id]: [question.actionOption], [proofId]: 'Задачи квартала',
      ...(question.inlineEvidence ? {[question.inlineEvidence.formatId]: 'excel'} : {}),
      [question.action.inlineEvidence.formatId]: 'other', [question.action.inlineEvidence.id]: 'Подтверждение мероприятий'};
    assert.equal(hasAnswer(question, {...selected, [proofId]: '   '}), true);
    const positive = buildSurveyResult(selected);
    assert.equal(positive.answers[actionId], 'Да');
    assert.equal(positive.answers[proofId], undefined);
    const evidence = question.action.inlineEvidence;
    assert.equal(hasAnswer(question, {...selected, [evidence.formatId]: ''}), false);
    assert.equal(hasAnswer(question, {...selected, [evidence.formatId]: 'jira', [evidence.id]: 'invalid'}), false);
    const linked = buildSurveyResult({...selected, [evidence.formatId]: 'jira', [evidence.id]: 'https://example.test/current'});
    assert.equal(linked.answers[evidence.id], 'https://example.test/current');
    assert.deepEqual(evidence.formats.map(option => option.value), ['jira', 'confluence', 'other']);
    for (const format of ['jira', 'confluence']) {
      assert.equal(hasAnswer(question, {...selected, [evidence.formatId]: format, [evidence.id]: 'invalid'}), false);
      const exported = buildSurveyResult({...selected, [evidence.formatId]: format, [evidence.id]: 'https://example.test/task'});
      assert.equal(exported.answers[evidence.formatId], format);
      assert.equal(exported.answers[evidence.id], 'https://example.test/task');
    }
    assert.equal(hasAnswer(question, {...selected, [evidence.id]: '   '}), false);
    assert.equal(hasAnswer(question, {...selected, [evidence.formatId]: 'excel'}), false);
    const analysisCode = actionId === 'deviations' ? 'churn.funnel_analysis' : 'attract.funnel_analysis';
    assert.equal(positive.result.metrics.find(m => m.code === analysisCode)?.value,
      buildSurveyResult(answers).result.metrics.find(m => m.code === analysisCode)?.value);
    const allIndex = question.options.indexOf('Все перечисленное выше');
    if (allIndex >= 0) {
      assert.ok(question.options.indexOf(question.actionOption) < allIndex);
      const all = {...selected, [question.id]: ['Все перечисленное выше']};
      assert.equal(hasAnswer(question, {...all, [proofId]: ''}), true);
      assert.equal(hasAnswer(question, {...all, [evidence.formatId]: ''}), false);
      const result = buildSurveyResult(all);
      assert.equal(result.answers[actionId], 'Да');
      assert.equal(result.answers[proofId], undefined);
      assert.equal(result.answers[evidence.formatId], 'other');
    }
    const result = buildSurveyResult({...selected, [question.id]: ['Затрудняюсь ответить']});
    assert.equal(result.answers[actionId], 'Нет');
    assert.ok(!(proofId in result.answers));
    assert.ok(!(proofId in result.questionSources));
    assert.ok(!(question.action.inlineEvidence.id in result.answers));
    assert.ok(!(question.action.inlineEvidence.formatId in result.answers));
  }
});


test('all products see the Cross-sell notice after mechanics without providing an answer', () => {
  for (const team of enabledTeams) {
    const answers = completeAnswers(team);
    delete answers.crossSellInfo;
    const sections = getSections(answers);
    const index = sections.findIndex(section => section.id === 'crossSell');
    assert.ok(index > 0, `${team.name}: notice present`);
    const mechanicsIndex = sections.findIndex(section => section.id === 'mechanics');
    if (mechanicsIndex >= 0) assert.equal(index, mechanicsIndex + 1, `${team.name}: directly after mechanics`);
    const question = sections[index].questions[0];
    assert.equal(question.introInfo.type, 'info');
    assert.equal(hasAnswer(question, answers), true);
    const result = buildSurveyResult(answers, getBacklogAnalyzed(answers));
    for (const field of ['answers', 'questionRows', 'questionSources']) assert.ok(!('crossSellInfo' in result[field]));
  }
});


test('Cross-sell after opening follows the notice and requires a product only for Yes', () => {
  for (const team of enabledTeams) {
    const answers = completeAnswers(team);
    const crossSell = getSections(answers).find(section => section.id === 'crossSell');
    assert.deepEqual(crossSell.questions.map(q => q.id), ['crossSellAfter']);
    const question = crossSell.questions[0];
    const proofId = question.inlineProof.id;
    assert.equal(hasAnswer(question, {...answers, crossSellAfter: 'Да', [proofId]: '   '}), false);
    const positive = buildSurveyResult({...answers, crossSellAfter: 'Да', [proofId]: 'Кредитная карта'}, getBacklogAnalyzed(answers));
    assert.equal(positive.answers[proofId], 'Кредитная карта');
    const negative = buildSurveyResult({...answers, crossSellAfter: 'Нет', [proofId]: 'Старый продукт'}, getBacklogAnalyzed(answers));
    assert.ok(!(proofId in negative.answers));
    const unknown = buildSurveyResult({...answers, crossSellAfter: 'Затрудняюсь ответить', [proofId]: 'Старый продукт'}, getBacklogAnalyzed(answers));
    assert.ok(!(proofId in unknown.answers));
  }
});


test('attraction and churn analysis never ask for the funnel report; action evidence remains independent', () => {
  for (const team of enabledTeams) {
    const base = completeAnswers(team);
    for (const direction of ['attract', 'churn']) {
      const question = route(base).find(q => q.id === `${direction}Analysis`);
      if (!question) continue;
      assert.equal(question.inlineEvidence, undefined, team.name);
      const answer = question.options.find(option => ![question.actionOption, 'Все перечисленное выше', 'Затрудняюсь ответить'].includes(option)) || 'Затрудняюсь ответить';
      const answers = {...base, [`${direction}Includes`]: ['Затрудняюсь ответить'], [`${direction}Configured`]: 'Нет',
        [question.id]: [answer], [`${direction}Report`]: '', [`${direction}ReportFormat`]: ''};
      assert.equal(needsEvidence(question, answers), false);
      assert.equal(hasAnswer(question, answers), true, team.name);
      if (question.action) {
        const evidence = question.action.inlineEvidence;
        assert.equal(hasAnswer(question, {...answers, [question.id]: [question.actionOption], [evidence.formatId]: ''}), false);
        assert.equal(hasAnswer(question, {...answers, [question.id]: [question.actionOption], [evidence.formatId]: 'jira', [evidence.id]: 'https://jira.test/task'}), true);
      }
    }
  }
});


test('removed attraction and churn retrospectives and stale details never enter routes or export', () => {
  const fields = ['attractDeviations', 'deviations'].flatMap(prefix => ['Completed', 'Success', 'Difficulties', 'SuccessReport', 'SuccessReportFormat'].map(suffix => `${prefix}${suffix}`));
  for (const team of enabledTeams) {
    const answers = {...completeAnswers(team), ...Object.fromEntries(fields.map(id => [id, 'Старый ответ']))};
    assert.ok(!route(answers).some(q => fields.includes(q.id)));
    assert.ok(!getSections(answers).some(section => section.id === 'actions'), 'Empty separate actions section is removed');
    const result = buildSurveyResult(answers);
    for (const key of ['answers', 'questionRows', 'questionSources']) {
      for (const id of fields) assert.ok(!(id in result[key]), `${team.name}: ${key}.${id}`);
    }
  }
});


test('unknown numeric key metric exports null without inventing a number or score', () => {
  const team = enabledTeams.find(item => item.name === 'Вклады+НС');
  const answers = {...completeAnswers(team), mau: '', mauUnknown: true, mauSource: 'Затрудняюсь ответить', mauSourceLink: 'https://stale.test'};
  const result = buildSurveyResult(answers);
  assert.equal(result.answers.mau, null);
  assert.equal(result.answers.mauSource, 'Затрудняюсь ответить');
  assert.ok(!('mauSourceLink' in result.answers));
  assert.equal(result.result.metrics.find(metric => metric.code === 'general.mau_produkta').value, 0);
});


test('business alert hints cover all offered answers for every product', () => {
  for (const team of enabledTeams) {
    const questions = getSections({product: team.id}).flatMap(section => section.questions);
    for (const question of questions.filter(q => q.id === 'alerts')) {
      assert.deepEqual(Object.keys(question.optionHints), question.options.filter(option => option !== 'Затрудняюсь ответить'));
      assert.equal(question.optionHints['Затрудняюсь ответить'], undefined);
      assert.match(question.optionHints['Да'], /всем ключевым/);
      assert.match(question.optionHints['Частично'], /только для части/);
    }
    assert.ok(questions.filter(q => !['alerts', 'upsell'].includes(q.id)).every(q => !q.optionHints));
  }
});


test('attraction and churn analysis repeat every quarter even at the previous maximum', () => {
  for (const team of enabledTeams) {
    const questions = getSections({product: team.id}).flatMap(section => section.questions);
    for (const direction of ['attract', 'churn']) {
      const metric = productSurveyProfiles[team.id].metrics.find(m => m.code === `${direction}.funnel_analysis`);
      const applicable = metric && metric.is_applicabble_flg !== false && !metric.excluded_from_index
        && Number(metric.dd_calculation_flg) !== 0 && Number(metric.max_value) > 0;
      if (!applicable) continue;
      const question = questions.find(q => q.id === `${direction}Analysis`);
      assert.ok(question, `${team.name}: ${direction} analysis exists`);
      assert.ok(!question.actionOnly, `${team.name}: analysis is not reduced to actions`);
      assert.ok(question.options.includes('Все перечисленное выше'));
      assert.ok(question.options.includes('Не проводился'));
      assert.ok(question.options.filter(option => ![question.actionOption, 'Все перечисленное выше', 'Не проводился', 'Затрудняюсь ответить'].includes(option)).length >= 4);
    }
  }
  const team = enabledTeams.find(team => team.name === 'BNPL');
  const answers = {...completeAnswers(team), attractAnalysis: ['Не проводился'], churnAnalysis: ['Не проводился']};
  const result = buildSurveyResult(answers);
  for (const code of ['attract.funnel_analysis', 'churn.funnel_analysis']) {
    const metric = result.result.metrics.find(m => m.code === code);
    assert.equal(metric.baselineValue, productSurveyProfiles[team.id].metrics.find(item => item.code === code).value);
    assert.equal(metric.value, 0, 'Current quarterly answer replaces last quarter assessment');
  }
});


test('mechanics omit the unsuitable-options answer for all products and exclude stale selections', () => {
  const removed = 'Предложенные варианты неподходят для моего продукта';
  for (const team of enabledTeams) {
    const answers = completeAnswers(team);
    const question = route(answers).find(q => q.id === 'upsell');
    if (!question) continue;
    assert.ok(question.options.every(option => !option.startsWith('Предложенные варианты')));
    assert.equal(hasAnswer(question, {...answers, upsell: [removed]}), false);
    const result = buildSurveyResult({...answers, upsell: ['Затрудняюсь ответить', removed]});
    assert.deepEqual(result.answers.upsell, ['Затрудняюсь ответить']);
  }
});


test('goals are section 2 for all products and accept multiple links or unknown', () => {
  for (const team of enabledTeams) {
    const answers = completeAnswers(team);
    const sections = getSections(answers).filter(section => section.id !== 'intro');
    assert.equal(sections[1].id, 'goals', team.name);
    assert.equal(sections[1].questions.length, 2);
    const monitoring = sections[1].questions[0];
    assert.equal(monitoring.id, 'goalsMonitoring');
    assert.deepEqual(monitoring.options, ['Да (включены все цели)', 'Частично (мониторинг не по всем целям)', 'Нет']);
    const question = inlineQuestions(monitoring)[0];
    assert.equal(hasAnswer(monitoring, {}), false);
    assert.equal(hasAnswer(monitoring, {goalsMonitoring: 'Нет'}), true);
    for (const choice of monitoring.options.slice(0, 2)) {
      assert.equal(hasAnswer(monitoring, {goalsMonitoring: choice}), false);
      const linked = buildSurveyResult({...answers, goalsMonitoring: choice});
      assert.equal(linked.answers.goalsMonitoring, choice);
      assert.ok(linked.answers.goalsDashboards);
    }
    const no = buildSurveyResult({...answers, goalsMonitoring: 'Нет', goalsDashboards: 'https://stale.test'});
    assert.equal(no.answers.goalsMonitoring, 'Нет');
    for (const field of ['goalsDashboards', 'goalsDashboardsFormat']) {
      assert.ok(!(field in no.answers));
      assert.ok(!(field in no.questionSources));
    }
    assert.equal(hasAnswer(question, {}), false);
    for (const bad of ['invalid', 'https://good.test\njavascript:alert(1)', 'ftp://example.test']) {
      assert.equal(hasAnswer(question, {[question.id]: bad}), false);
    }
    const links = 'https://example.test/kpi\nhttp://example.test/targets';
    const linked = buildSurveyResult({...answers, goalsDashboards: links});
    assert.equal(linked.answers.goalsDashboards, links);
    assert.equal(linked.answers.goalsDashboardsFormat, 'link');
    const excel = buildSurveyResult({...answers, goalsDashboards: 'https://stale.test', goalsDashboardsFormat: 'excel'});
    assert.equal(excel.answers.goalsDashboards, 'Отчетность в формате Excel');
    assert.equal(excel.answers.goalsDashboardsFormat, 'excel');
    assert.ok('goalsDashboardsFormat' in excel.questionSources);
    assert.equal(hasAnswer(question, {goalsDashboardsFormat: 'excel'}), true);
    assert.equal(hasAnswer(question, {goalsDashboardsFormat: 'unknown'}), true);
    assert.equal(hasAnswer(question, {goalsDashboardsFormat: 'invalid'}), false);
    assert.deepEqual(excel.result.metrics, linked.result.metrics);
    const unknown = buildSurveyResult({...answers, goalsDashboards: 'https://stale.test', goalsDashboardsUnknown: true});
    assert.equal(unknown.answers.goalsDashboards, 'Затрудняюсь ответить');
    assert.equal(unknown.result.metrics.length, productSurveyProfiles[team.id].metrics.length);
  }
});


test('each funnel report belongs to completeness, or regularity when completeness is absent', () => {
  const covered = new Set();
  for (const team of enabledTeams) {
    const questions = route(completeAnswers(team));
    for (const direction of ['attract', 'churn']) {
      const report = `${direction}Report`;
      const includes = questions.find(q => q.id === `${direction}Includes` && !q.benchmarkOnly);
      const configured = questions.find(q => q.id === `${direction}Configured`);
      const owners = questions.filter(q => q.inlineEvidence?.id === report);
      const expected = includes || configured;
      assert.equal(owners.length, expected ? 1 : 0, `${team.name}: ${direction} exactly one confirmation`);
      if (!expected) continue;
      assert.equal(owners[0].id, expected.id);
      covered.add(`${direction}:${Boolean(includes)}:${Boolean(configured)}`);
      const owner = owners[0];
      const positive = owner.type === 'multi' ? [owner.options[0]] : owner.options[0];
      for (const regularity of ['Нет', 'Да', 'Да, автоматическая (monthly/weekly)', 'Да, по запросу']) {
        const answers = {[`${direction}Configured`]: regularity, [owner.id]: positive};
        assert.equal(needsEvidence(owner, answers), true);
        if (configured && configured.id !== owner.id) {
          assert.equal(needsEvidence(configured, answers), false);
          assert.equal(hasAnswer(configured, {...answers, [configured.id]: configured.options[0]}), true);
        }
      }
    }
  }
  for (const direction of ['attract', 'churn']) {
    assert.ok(covered.has(`${direction}:true:true`));
    const configured = {id: `${direction}Configured`, inlineEvidence: {id: `${direction}Report`, formatId: `${direction}ReportFormat`}};
    const onlyRegularity = assignFunnelEvidence({id: direction, questions: [configured]});
    assert.equal(onlyRegularity.questions[0].inlineEvidence.id, `${direction}Report`);
    assert.equal(needsEvidence(onlyRegularity.questions[0], {[configured.id]: 'Да'}), true);
    assert.ok(covered.has(`${direction}:true:false`));
  }
});


test('only historical Jira/SberTrack links suppress Discovery for the matching product', () => {
  assert.equal(Object.keys(previousBacklogs).length, 14);
  for (const team of enabledTeams) {
    const hasPrevious = Boolean(previousBacklogs[team.id]);
    assert.equal(getBacklogAnalyzed({product: team.id}), hasPrevious, team.name);
    const metric = productSurveyProfiles[team.id].metrics.find(m => m.code === 'hyp.discovery_40_backlog');
    const applicable = metric && metric.is_applicabble_flg !== false && !metric.excluded_from_index
      && Number(metric.dd_calculation_flg) !== 0 && Number(metric.max_value) > 0;
    assert.equal(route(completeAnswers(team)).some(q => q.id === 'discovery'), Boolean(applicable && !hasPrevious), team.name);
    if (hasPrevious) assert.ok(previousBacklogs[team.id].links.every(isBacklogUrl));
  }
  const byName = name => enabledTeams.find(team => team.name === name);
  assert.equal(getBacklogAnalyzed({product: byName('ИнвестКопилка').id}), false);
  assert.ok(route(completeAnswers(byName('ИнвестКопилка'))).some(q => q.id === 'discovery'));
  assert.equal(getBacklogAnalyzed({product: byName('Пакет услуг СберПервый').id}), true);
  for (const bad of ['Описание', 'https://confluence.sberbank.ru/page', 'https://sberfriend.sberbank.ru/board',
    'https://jira.sberbank.ru.evil.test/board', 'javascript:alert(1)', 'https://jira.sberbank.ru/browse/A-1 комментарий']) {
    assert.equal(hasBacklogLinks(bad), false);
  }
  for (const value of ['https://jira.sberbank.ru/browse/A-1', 'https://jira.delta.sbrf.ru/board',
    'https://jira.sberned.ru/board', 'https://sbertrack.sberbank.ru/board']) assert.equal(hasBacklogLinks(value), true);
});


test('Daily Banking split teams receive every current product question with no historical answers', () => {
  const expected = ['Зарплатный продукт', 'Пенсионный продукт', 'SberPay NFC', 'Переводы по РФ',
    'Оплата улыбкой', 'Торговый Эквайринг', 'Кредитные карты', 'Дебетовая карта', 'SberPay Ecom',
    'Платежи', 'Вжух', 'Детская карта', 'Интернет-Эквайринг', 'Сберчаевые #B2C', 'Сберчаевые #B2B',
    'Трансграничные переводы #B2C', 'Трансграничные переводы #B2B',
    'Трансграничный эквайринг #B2C', 'Трансграничный эквайринг #B2B'];
  assert.deepEqual(teams.filter(team => team.unit === 'DB').map(team => team.name).sort(), expected.sort());
  const fresh = teams.filter(team => productSurveyProfiles[team.id].fullSurvey);
  assert.equal(fresh.length, 6);
  let reference;
  for (const team of fresh) {
    const answers = completeAnswers(team);
    const questions = getSections(answers).flatMap(section => section.questions);
    const ids = questions.flatMap(q => [q, ...inlineQuestions(q)]).map(question => question.id);
    if (reference) assert.deepEqual(ids, reference); else reference = ids;
    for (const id of ['marketRussia', 'marketSber', 'satellite', 'goalsDashboards',
      'attractConfigured', 'attractIncludes', 'attractAnalysis', 'churnConfigured', 'churnIncludes',
      'churnModel', 'churnAnalysis', 'systemAlerts', 'alerts', 'upsell', 'mechanicsMonitoring',
      'crossSellAfter', 'discovery', 'support']) assert.ok(ids.includes(id), `${team.name}: ${id}`);
    for (const q of questions) {
      assert.equal(q.previousOptions, undefined);
      assert.equal(q.previousClickstreamUrl, undefined);
      assert.equal(q.inlineEvidence?.previousLinks, undefined);
      assert.deepEqual(knownMechanics(q, answers), []);
    }
    assert.equal(getBacklogAnalyzed(answers), false);
    const result = buildSurveyResult(answers);
    assert.equal(result.team.id, team.id);
    assert.equal(result.result.baselinePeriod, null);
    assert.ok(result.result.metrics.every(metric => metric.baselineValue === null));
    assert.deepEqual(result.previousMechanics, []);
    assert.deepEqual(result.previousFunnelElements, {});
    assert.deepEqual(result.previousFunnelReports, {});
    assert.ok(!ids.some(id => ['lastResearch', 'priorities', 'deviationsCompleted', 'attractDeviationsCompleted'].includes(id)));
  }
});


test('Internet acquiring has no historical churn items and shows a clearly labelled benchmark question', () => {
  const team = enabledTeams.find(team => team.name === 'Интернет-Эквайринг');
  const question = getSections({product: team.id}).flatMap(s => s.questions).find(q => q.id === 'churnIncludes');
  assert.equal(question.benchmarkOnly, true);
  assert.equal(question.title, 'Есть ли бенчмарки по воронке оттока?');
  assert.equal(question.previousOptions, undefined);
  assert.deepEqual(question.options, ['Бенчмарки', 'Затрудняюсь ответить']);
  assert.equal(question.inlineEvidence, undefined);
});


test('numeric knowledge metrics have automatic units and optional comments without changing validation or scoring', () => {
  for (const team of enabledTeams) {
    const answers = completeAnswers(team);
    const numeric = route(answers).filter(q => q.type === 'numeric');
    const withComments = {...answers};
    for (const q of numeric) {
      assert.equal(q.hint, 'Введите число за последний доступный период');
      if (q.id === 'marketSber') assert.equal(q.detail, 'Количество клиентов в Сбере, которых продукт реально может охватить с учетом текущей бизнес-модели.');
      assert.equal(q.unit, q.id === 'dauMau' ? '%' : 'клиентов');
      assert.ok(!q.title.includes('(клиентов)'));
      assert.equal(q.optionalCommentId, `${q.id}Comment`);
      assert.equal(hasAnswer(q, answers), true);
      withComments[q.optionalCommentId] = '  За последний доступный период  ';
    }
    const before = buildSurveyResult(answers);
    const after = buildSurveyResult(withComments);
    assert.deepEqual(after.result.metrics, before.result.metrics);
    for (const q of numeric) {
      assert.ok(!(q.optionalCommentId in before.answers));
      assert.equal(after.answers[q.optionalCommentId], 'За последний доступный период');
      assert.equal(after.questionRows[q.optionalCommentId], q.row);
      assert.ok(q.optionalCommentId in after.questionSources);
    }
    const hidden = {...answers, marketRussiaComment: 'Скрытый старый комментарий'};
    if (!numeric.some(q => q.id === 'marketRussia')) assert.ok(!('marketRussiaComment' in buildSurveyResult(hidden).answers));
  }
});


test('numeric value and metric source are two independently mandatory choices', () => {
  for (const team of enabledTeams) {
    const base = completeAnswers(team);
    for (const q of route(base).filter(q => q.type === 'numeric')) {
      const source = q.inlineProof.id;
      const unknown = `${q.id}Unknown`;
      const empty = {...base, [q.id]: '', [source]: '', [unknown]: false};
      assert.equal(hasAnswer(q, empty), false);
      assert.equal(hasAnswer(q, {...empty, [source]: 'Затрудняюсь ответить'}), false);
      assert.equal(hasAnswer(q, {...empty, [unknown]: true}), false);
      assert.equal(hasAnswer(q, {...empty, [q.id]: '0'}), false);
      for (const choice of ['Затрудняюсь ответить', 'Запрос у аналитиков']) {
        assert.equal(hasAnswer(q, {...empty, [unknown]: true, [source]: choice}), true);
        assert.equal(hasAnswer(q, {...empty, [q.id]: '0', [source]: choice}), true);
      }
      assert.equal(hasAnswer(q, {...empty, [unknown]: true, [q.id]: '100', [source]: 'Затрудняюсь ответить'}), false);
      const result = buildSurveyResult({...base, [q.id]: '', [unknown]: true, [source]: 'Затрудняюсь ответить'});
      assert.equal(result.answers[q.id], null);
      assert.equal(result.answers[unknown], true);
      assert.equal(result.answers[source], 'Затрудняюсь ответить');
      assert.ok(unknown in result.questionSources);
      assert.ok(!(unknown in buildSurveyResult({...base, [unknown]: false}).answers));
    }
  }
});


test('all evidence blocks accept multiple links and export only nonempty active sources', () => {
  for (const team of enabledTeams) {
    const base = completeAnswers(team);
    for (const q of route(base).filter(q => q.type === 'numeric')) {
      const source = q.inlineProof.id;
      const links = ' https://one.test/source \n\nhttps://two.test/source\n';
      for (const choice of ['Дашборд в Навигаторе', 'Собственная отчетность']) {
        const answers = {...base, [source]: choice, [`${source}Format`]: 'link', [`${source}Link`]: links};
        assert.equal(hasAnswer(q, answers), true);
        const result = buildSurveyResult(answers);
        assert.equal(result.answers[`${source}Link`], 'https://one.test/source\nhttps://two.test/source');
        assert.equal(hasAnswer(q, {...answers, [`${source}Link`]: 'https://one.test\nhttps://'}), false);
      }
      const hidden = buildSurveyResult({...base, [source]: 'Затрудняюсь ответить', [`${source}Link`]: links});
      assert.ok(!(`${source}Link` in hidden.answers));
    }
    const q = route(base).find(q => q.id === 'churnModel');
    const {id, formatId} = q.inlineEvidence;
    const answers = {...base, churnModel: 'Да', [formatId]: 'link', [id]: 'https://one.test/model\n\nhttps://two.test/model\n'};
    assert.equal(hasAnswer(q, answers), true);
    assert.equal(buildSurveyResult(answers).answers[id], 'https://one.test/model\nhttps://two.test/model');
    assert.equal(hasAnswer(q, {...answers, [id]: 'https://one.test/model\nnot-url'}), false);
    assert.ok(!(id in buildSurveyResult({...answers, [formatId]: 'excel'}).answers));
  }
});


test('Navigator metric sources accept dashboard names and URLs while own reporting requires URLs', () => {
  for (const team of enabledTeams) {
    const base = completeAnswers(team);
    for (const q of route(base).filter(q => q.type === 'numeric')) {
      const id = q.inlineProof.id;
      const entries = '  Клиентская база продукта \n\nhttps://navigator.sigma.sbrf.ru/gdash/123\nMAU: продукт';
      const answers = {...base, [id]: 'Дашборд в Навигаторе', [`${id}Link`]: entries};
      assert.equal(hasAnswer(q, answers), true);
      assert.equal(buildSurveyResult(answers).answers[`${id}Link`], 'Клиентская база продукта\nhttps://navigator.sigma.sbrf.ru/gdash/123\nMAU: продукт');
      assert.equal(hasAnswer(q, {...answers, [`${id}Link`]: '   \n'}), false);
      assert.equal(hasAnswer(q, {...answers, [`${id}Link`]: 'Дашборд\nhttps://'}), false);
      assert.equal(hasAnswer(q, {...answers, [id]: 'Собственная отчетность', [`${id}Format`]: 'link'}), false);
    }
  }
});


test('cannot provide a link is a valid common evidence choice with an optional active comment', () => {
  for (const team of enabledTeams) {
    const base = completeAnswers(team);
    const model = route(base).find(q => q.id === 'churnModel');
    const {id, formatId} = model.inlineEvidence;
    const answers = {...base, churnModel: 'Да', [formatId]: 'unavailable', [id]: 'https://stale.test'};
    assert.equal(hasAnswer(model, answers), true);
    let result = buildSurveyResult(answers);
    assert.equal(result.answers[formatId], 'unavailable');
    assert.ok(!(id in result.answers));
    assert.ok(!(`${id}Comment` in result.answers));
    result = buildSurveyResult({...answers, [`${id}Comment`]: '  Модель во внутренней системе  '});
    assert.equal(result.answers[`${id}Comment`], 'Модель во внутренней системе');
    assert.ok(`${id}Comment` in result.questionSources);
    for (const format of ['link', 'excel']) {
      const restored = buildSurveyResult({...answers, [formatId]: format, [`${id}Comment`]: 'Старый комментарий'});
      assert.ok(!(`${id}Comment` in restored.answers));
    }
    for (const q of route(base).filter(q => q.type === 'numeric')) {
      const source = q.inlineProof.id;
      const own = {...base, [source]: 'Собственная отчетность', [`${source}Format`]: 'unavailable',
        [`${source}Link`]: 'https://stale.test', [`${source}LinkComment`]: '  Ограничен доступ  '};
      assert.equal(hasAnswer(q, own), true);
      const ownResult = buildSurveyResult(own);
      assert.equal(ownResult.answers[`${source}Format`], 'unavailable');
      assert.equal(ownResult.answers[`${source}LinkComment`], 'Ограничен доступ');
      assert.ok(!(`${source}Link` in ownResult.answers));
      assert.ok(!(`${source}LinkComment` in buildSurveyResult({...own, [source]: 'Затрудняюсь ответить'}).answers));
    }
  }
});


test('business alerts require a setup comment only for Yes and Partial', () => {
  for (const team of enabledTeams) {
    const base = completeAnswers(team);
    const question = route(base).find(q => q.id === 'alerts');
    if (!question) continue;
    assert.equal(question.optionalCommentId, 'alertsComment');
    assert.equal(question.optionalCommentTitle, 'Что настроено и как?');
    for (const answer of ['Да', 'Частично']) {
      const empty = {...base, alerts: answer, alertsComment: ''};
      assert.equal(hasAnswer(question, empty), false);
      assert.equal(hasAnswer(question, {...empty, alertsComment: '   '}), false);
      assert.throws(() => buildSurveyResult(empty), /Incomplete/);
      const before = buildSurveyResult({...empty, alertsComment: 'Описание'});
      const after = buildSurveyResult({...empty, alertsComment: '  Пороговые оповещения по email  '});
      assert.equal(after.answers.alertsComment, 'Пороговые оповещения по email');
      assert.ok('alertsComment' in after.questionSources);
      assert.deepEqual(after.result.metrics, before.result.metrics);
    }
    for (const answer of ['Нет', 'Затрудняюсь ответить']) {
      const result = buildSurveyResult({...base, alerts: answer, alertsComment: 'Старое описание'});
      for (const field of ['answers', 'questionRows', 'questionSources']) assert.ok(!('alertsComment' in result[field]));
    }
  }
});


test('forecast and factor analysis are two independent required answers on one Goals screen', () => {
  for (const team of enabledTeams) {
    const answers = completeAnswers(team);
    const goals = getSections(answers).find(s => s.id === 'goals');
    assert.deepEqual(goals.questions.map(q => q.id), ['goalsMonitoring', 'goalsForecast']);
    const forecast = goals.questions[1];
    const factor = inlineQuestions(forecast, answers)[0];
    assert.equal(factor.id, 'goalsFactorAnalysis');
    assert.deepEqual(forecast.options, ['Да, >90%', 'Частично, <90%', 'Нет']);
    assert.deepEqual(factor.options, forecast.options);
    assert.equal(hasAnswer(forecast, {goalsForecast: 'Нет'}), false);
    assert.equal(hasAnswer(forecast, {goalsFactorAnalysis: 'Нет'}), false);
    for (const forecastChoice of forecast.options) for (const factorChoice of factor.options) {
      const complete = {...answers, goalsForecast: forecastChoice, goalsFactorAnalysis: factorChoice};
      assert.equal(hasAnswer(forecast, complete), true);
      const result = buildSurveyResult(complete);
      assert.equal(result.answers.goalsForecast, forecastChoice);
      assert.equal(result.answers.goalsFactorAnalysis, factorChoice);
      assert.ok('goalsForecast' in result.questionSources);
      assert.ok('goalsFactorAnalysis' in result.questionSources);
    }
  }
});
