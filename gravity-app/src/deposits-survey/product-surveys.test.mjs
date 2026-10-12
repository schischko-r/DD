import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {productSurveyProfiles} from './product-surveys.js';
import {getBacklogAnalyzed, getSections, hasAnswer, inlineQuestions, needsComment, needsEvidence, needsProof, needsReason, visibleQuestions} from './questions.js';
import {buildSurveyResult} from './result.js';
import {enabledTeams, teams} from './teams.js';

const report = JSON.parse(readFileSync(new URL('../../public/report-data.json', import.meta.url), 'utf8'));
const products = report.products.filter(team => team.type === 'Продукт');
const route = answers => getSections(answers).flatMap(section =>
  visibleQuestions(section, getBacklogAnalyzed(answers), answers));

function completeAnswers(team) {
  const answers = {name: 'Тест', product: team.id, unit: team.unit};
  for (const question of getSections(answers).flatMap(section => section.questions).flatMap(q => [q, ...inlineQuestions(q)])) {
    if (question.id === 'name' || question.id === 'product') continue;
    if (question.type === 'numeric') answers[question.id] = '1000';
    else if (question.type === 'multi') {
      const option = question.options.includes('Затрудняюсь ответить')
        ? 'Затрудняюсь ответить'
        : question.options.includes('Не настроены дополнительные механики')
          ? 'Не настроены дополнительные механики'
          : question.options[0];
      answers[question.id] = [option];
    } else if (question.type === 'radio') {
      answers[question.id] = question.options.includes('Нет') ? 'Нет' : question.options[0];
    } else answers[question.id] = 'Тест';
  }
  for (const question of route(answers).flatMap(q => [q, ...inlineQuestions(q)])) {
    if (needsComment(question, answers)) answers[question.commentId] = 'Описание механики';
    if (needsReason(question, answers)) answers[question.reasonId] = 'Не подходит для продукта';
    if (needsEvidence(question, answers)) answers[question.inlineEvidence.formatId] = 'excel';
    if (needsProof(question, answers)) answers[question.inlineProof.id] = 'Описание подтверждения';
  }
  return answers;
}

test('every enabled product profile matches its DDI metric snapshot', () => {
  assert.equal(products.length, 67);
  assert.deepEqual(new Set(enabledTeams.map(team => team.id)), new Set(products.map(team => team.id)));
  assert.deepEqual(new Set(Object.keys(productSurveyProfiles)), new Set(products.map(team => team.id)));
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
        assert.ok(questions.some(question => question.id === id),
          `${team.name}: applicable knowledge ${id} asked even at maximum`);
      }
    }
    assert.ok(questions.length > 6, `${team.name}: substantive route`);
    for (const question of questions) assert.equal(hasAnswer(question, answers), true,
      `${team.name}: ${question.id} is answerable`);
    const result = buildSurveyResult(answers, getBacklogAnalyzed(answers), '2026-10-12T00:00:00Z');
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
      assert.equal(metric.source, 'ddi_baseline', `${team.name}: ${code} remains baseline`);
      assert.ok(metric.baselineValue < metric.maxValue, `${team.name}: ${code} is an actual gap`);
    }
    assert.equal(result.answers.product, team.id);
  }
});

test('known mechanics, backlog and completed metric gaps vary by product', () => {
  const byName = name => enabledTeams.find(team => team.name === name);
  const deposits = byName('Вклады+НС');
  const bPif = byName('БПИФ');
  const backlog = byName('ИнвестКопилка');
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

test('product not-relevant answers require the Excel reason and no funnel evidence', () => {
  for (const [teamName, id] of [['Брокерский счет', 'attractConfigured'], ['БПИФ', 'churnConfigured']]) {
    const team = enabledTeams.find(item => item.name === teamName);
    const question = getSections({product: team.id}).flatMap(section => section.questions)
      .find(item => item.id === id);
    const negative = question.options.find(option => option.startsWith('Не релевантно'));
    assert.equal(negative, 'Не релевантно для вашего продукта (в комментарии укажите, почему?)');
    assert.equal(question.reasonId, `${id}Reason`);
    assert.equal(needsEvidence(question, {[id]: negative}), false);
    assert.equal(needsReason(question, {[id]: negative}), true);
    assert.equal(hasAnswer(question, {[id]: negative}), false);
    assert.equal(hasAnswer(question, {[id]: negative, [question.reasonId]: '   '}), false);
    assert.equal(hasAnswer(question, {[id]: negative, [question.reasonId]: 'Не подходит'}), true);
    const base = completeAnswers(team);
    assert.throws(() => buildSurveyResult({...base, [id]: negative}), /Incomplete/);
    const result = buildSurveyResult({...base, [id]: negative, [question.reasonId]: 'Не подходит'});
    assert.equal(result.answers[question.reasonId], 'Не подходит');
    assert.deepEqual(result.questionSources[question.reasonId], {sheet: 'Продукты (2)', row: question.row});
    const stale = buildSurveyResult({...base, [id]: 'Нет', [question.reasonId]: 'Старое пояснение'});
    assert.ok(!(question.reasonId in stale.answers));
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
  for (const id of ['usageConfigured', 'churnConfigured']) {
    const question = mail.find(item => item.id === id);
    const negative = question.options.find(option => option.startsWith('Не релевантно'));
    assert.ok(negative);
    assert.equal(needsEvidence(question, {[id]: negative}), false,
      `${id}: product-not-relevant answer does not require evidence`);
    assert.equal(hasAnswer(question, {[id]: negative}), true);
  }
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
  const next = async () => {assert.equal(button('Далее').disabled, false, `${currentId()}: next enabled`); button('Далее').click(); await pause();};
  const selectTeam = async name => {
    doc.querySelector('[role="combobox"]').click(); await pause();
    const option = [...doc.querySelectorAll('[role="option"], .g-select-list__option, .g-list__item')]
      .find(item => item.textContent.trim() === name);
    assert.ok(option, `${name} is selectable`);
    option.click(); await pause();
  };
  try {
    await pause();
    await write(doc.querySelector('.survey-single-question input'), 'Тест'); await next();
    await selectTeam('Вклады+НС'); await next();
    await write(doc.querySelector('.survey-single-question input'), '777');
    button('Назад').click(); await pause();
    assert.equal(currentId(), 'product');
    await selectTeam(target.name); await next();
    assert.equal(currentId(), 'marketRussia');
    assert.equal(doc.querySelector('.survey-single-question input').value, '', 'Deposit answer was cleared');

    const questions = getSections({product: target.id}).flatMap(section => section.questions);
    let count = 0;
    while (doc.querySelector('.survey-single-question')) {
      assert.ok(count++ < 45, 'Product questionnaire terminates');
      const id = currentId();
      const question = questions.find(item => item.id === id);
      assert.ok(question, `Question ${id} belongs to selected product`);
      if (question.type === 'info') {
        assert.match(doc.querySelector('.survey-info-copy').textContent, /Cross-sell/);
      } else if (question.type === 'numeric') await write(doc.querySelector('.survey-single-question input'), '1000');
      else if (question.type === 'multi') {
        const option = id === 'usageIncludes' ? question.options[0]
          : question.options.includes('Затрудняюсь ответить') ? 'Затрудняюсь ответить'
          : question.options.includes('Не настроены дополнительные механики') ? 'Не настроены дополнительные механики'
            : question.options[0];
        const checkbox = [...doc.querySelectorAll('.survey-single-question .g-checkbox')]
          .find(item => item.textContent.trim() === option);
        assert.ok(checkbox, `${id}: ${option} available`);
        checkbox.querySelector('input').click(); await pause();
      } else if (question.type === 'radio') {
        const option = id === 'churnConfigured' && targetName === 'БПИФ'
          ? question.options.find(item => item.startsWith('Не релевантно'))
          : question.options.includes('Нет') ? 'Нет' : question.options[0];
        const radio = [...doc.querySelectorAll('.survey-single-question .g-radio')]
          .find(item => item.textContent.trim() === option);
        assert.ok(radio, `${id}: ${option} available`);
        radio.querySelector('input').click(); await pause();
        if (id === 'churnConfigured' && targetName === 'БПИФ') {
          const reason = doc.querySelector('.survey-other-answer textarea');
          assert.ok(reason, 'Excel not-relevant answer reveals the reason field');
          assert.equal(button('Далее').disabled, true, 'Reason is mandatory');
          await write(reason, 'Не применимо к фонду');
        }
      } else {
        const control = doc.querySelector('.survey-single-question textarea, .survey-single-question input');
        await write(control, 'Тест');
      }
      for (const field of inlineQuestions(question)) {
        const block = [...doc.querySelectorAll('.survey-inline-question')].find(item => item.getAttribute('aria-label') === field.title);
        await write(block.querySelector('textarea'), 'Результаты и причины');
      }
      const evidence = doc.querySelector('.survey-inline-evidence');
      if (evidence?.querySelector('input[type="radio"]')) {
        if (id === 'usageIncludes') assert.match(evidence.querySelector('h2').textContent, /использования/);
        assert.equal(evidence.querySelector('.survey-excel-notice'), null);
        evidence.querySelectorAll('input[type="radio"]')[1].click(); await pause();
        assert.equal(evidence.querySelector('.survey-excel-notice').textContent, 'Для учета в оценке просим направить по почте нам. В противном случае ответ не будет принят.');
        assert.equal(evidence.querySelector('.survey-excel-notice a').getAttribute('href'), 'mailto:MYCherkova@sberbank.ru');
      } else if (evidence?.querySelector('textarea')) await write(evidence.querySelector('textarea'), 'Описание подтверждения');
      const comment = doc.querySelector('.survey-mechanics-comment textarea');
      if (comment) await write(comment, 'Описание механики');
      await next();
    }
    assert.match(doc.querySelector('h1').textContent, /Проверьте ответы/);
    button('Завершить опрос').click(); await pause();
    const payload = JSON.parse(dom.window.DDI_SURVEY_RESULT_JSON);
    assert.deepEqual(payload.team, {id: target.id, name: target.name, unit: target.unit});
    assert.equal(payload.answers.marketRussia, '1000');
    if (targetName === 'БПИФ') assert.equal(payload.answers.churnConfiguredReason, 'Не применимо к фонду');
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
      assert.equal(actions.some(q => q.id === id), applicable, `${team.name}: ${id} always asked if applicable`);
      assert.equal(actions.some(q => q.id === `${id}Completed`), applicable && Number(metric?.value) === 1,
        `${team.name}: retrospective follows its own previous score`);
    }
  }
});

test('action results require descriptions and valid link or Excel; stale examples are excluded', () => {
  const team = enabledTeams.find(item => item.name === 'Вклады+НС');
  const answers = completeAnswers(team);
  const actions = getSections(answers).find(section => section.id === 'actions').questions;
  const retrospective = actions.find(q => q.id === 'attractDeviationsCompleted');
  const [success, difficulties] = inlineQuestions(retrospective);
  assert.equal(hasAnswer(retrospective, answers), true);
  for (const field of [retrospective, success, difficulties]) {
    assert.equal(hasAnswer(retrospective, {...answers, [field.id]: '   '}), false);
    assert.throws(() => buildSurveyResult({...answers, [field.id]: '   '}), /Incomplete/);
  }
  const {id, formatId} = success.inlineEvidence;
  assert.equal(hasAnswer(retrospective, {...answers, [formatId]: 'link', [id]: 'invalid'}), false);
  const linkAnswers = {...answers, [formatId]: 'link', [id]: 'https://example.test/actions'};
  assert.equal(hasAnswer(retrospective, linkAnswers), true);
  const payload = buildSurveyResult(linkAnswers);
  assert.equal(payload.answers[id], 'https://example.test/actions');
  assert.equal(payload.answers[success.id], answers[success.id]);
  assert.equal(payload.answers[difficulties.id], answers[difficulties.id]);
  const excel = buildSurveyResult({...linkAnswers, [formatId]: 'excel'});
  assert.ok(!(id in excel.answers), 'Switching to Excel removes stale URL');
  for (const actionId of ['attractDeviations', 'deviations']) {
    const question = actions.find(q => q.id === actionId);
    const proofId = question.inlineProof.id;
    const reportId = question.inlineEvidence.id;
    const formatId = question.inlineEvidence.formatId;
    assert.match(question.inlineProof.title, /за текущий квартал/);
    assert.match(question.inlineEvidence.title, /за текущий квартал/);
    assert.equal(hasAnswer(question, {...answers, [actionId]: 'Да', [proofId]: 'Задачи', [formatId]: 'link', [reportId]: 'invalid'}), false);
    const linked = buildSurveyResult({...answers, [actionId]: 'Да', [proofId]: 'Задачи', [formatId]: 'link', [reportId]: 'https://example.test/current'});
    assert.equal(linked.answers[reportId], 'https://example.test/current');
    assert.equal(linked.answers[proofId], 'Задачи');
    assert.equal(hasAnswer(question, {...answers, [actionId]: 'Да', [proofId]: '   '}), false);
    assert.throws(() => buildSurveyResult({...answers, [actionId]: 'Да', [proofId]: 'Задачи квартала'}), /Incomplete/);
    const positive = buildSurveyResult({...answers, [actionId]: 'Да', [proofId]: 'Задачи квартала', [formatId]: 'excel'});
    assert.equal(positive.answers[proofId], 'Задачи квартала');
    for (const negative of ['Нет', 'Затрудняюсь ответить']) {
      const result = buildSurveyResult({...answers, [actionId]: negative, [proofId]: 'Старые задачи', [formatId]: 'link', [reportId]: 'https://example.test/stale'});
      assert.ok(!(proofId in result.answers));
      assert.ok(!(proofId in result.questionSources));
      assert.ok(!(reportId in result.answers));
      assert.ok(!(formatId in result.answers));
    }
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
    assert.equal(question.type, 'info');
    assert.equal(hasAnswer(question, answers), true);
    const result = buildSurveyResult(answers, getBacklogAnalyzed(answers));
    for (const field of ['answers', 'questionRows', 'questionSources']) assert.ok(!('crossSellInfo' in result[field]));
  }
});


test('Cross-sell after opening follows the notice and requires a product only for Yes', () => {
  for (const team of enabledTeams) {
    const answers = completeAnswers(team);
    const crossSell = getSections(answers).find(section => section.id === 'crossSell');
    assert.deepEqual(crossSell.questions.map(q => q.id), ['crossSellInfo', 'crossSellAfter']);
    const question = crossSell.questions[1];
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
