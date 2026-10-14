import assert from 'node:assert/strict';
import test from 'node:test';
import {getIntroSummary, sectionCountText} from './intro.js';
import {productSurveyProfiles} from './survey-profiles.js';
import {getBacklogAnalyzed, getSections, visibleQuestions, knownMechanics} from './questions.js';

test('title uses each product route and keeps survey and digital sources separate', () => {
  assert.equal(getIntroSummary(undefined), null);
  assert.equal(getIntroSummary('unknown'), null);
  for (const profile of Object.values(productSurveyProfiles)) {
    const answers = {product: profile.teamId};
    const summary = getIntroSummary(profile.teamId);
    const sections = getSections(answers).filter(section => section.id !== 'intro'
      && visibleQuestions(section, getBacklogAnalyzed(answers), answers).length);
    assert.equal(summary.sectionCount, sections.length);
    assert.ok(summary.survey.includes('Cross-sell после оформления продукта'));
    assert.equal(new Set(summary.survey).size, summary.survey.length);
    assert.ok(!summary.survey.some(label => /Бенчмарки|Модель оттока/.test(label)));
    assert.equal(new Set(summary.digital).size, summary.digital.length);
    assert.ok(!summary.digital.some(label => /Гибкое изменение/.test(label)));
    assert.ok(summary.survey.includes('Знание ключевых метрик'));
    assert.ok(!summary.survey.some(label => /Объём целевого рынка|MAU продукта|Клиенты с продуктом|Навигатор/.test(label)));
    for (const code of ['hyp.ab_tests', 'hyp.datadriven_rating_7_5', 'hyp.extra_initiatives', 'cx.score']) {
      const metric = profile.metrics.find(item => item.code === code);
      const applicable = metric && metric.is_applicabble_flg && !metric.excluded_from_index
        && metric.dd_calculation_flg && metric.max_value > 0;
      assert.equal(Boolean(metric && summary.digital.includes(metric.name)), Boolean(applicable), `${profile.teamId}: ${code} external source`);
    }
    assert.ok(!summary.survey.some(label => /во время оформления|Прогноз по целям/.test(label)));
    const discovery = profile.metrics.find(metric => metric.code === 'hyp.discovery_40_backlog');
    const discoveryApplicable = discovery && discovery.is_applicabble_flg && !discovery.excluded_from_index
      && discovery.dd_calculation_flg && discovery.max_value > 0;
    assert.equal(summary.digital.some(label => label.startsWith('Discovery')), Boolean(getBacklogAnalyzed(answers) && discoveryApplicable));
    if (getBacklogAnalyzed(answers)) assert.ok(!summary.survey.some(label => label.startsWith('Discovery')));
    const mechanics = sections.flatMap(s => s.questions).find(q => q.id === 'upsell');
    if (mechanics) for (const option of knownMechanics(mechanics, answers)) {
      const label = {'Удержание клиентов': 'Механики удержания клиентов', 'Возврат клиентов': 'Механики возврата клиентов',
        'Допродажи (upsell)': 'Механики допродаж (Upsell)'}[option];
      assert.ok(!summary.survey.includes(label), `${profile.teamId}: known mechanic stays excluded`);
    }
  }
});

test('section counts use Russian plural forms', () => {
  assert.deepEqual([1, 2, 5, 11, 12, 14, 21, 22, 25].map(sectionCountText),
    ['1 раздел', '2 раздела', '5 разделов', '11 разделов', '12 разделов', '14 разделов', '21 раздел', '22 раздела', '25 разделов']);
});


test('all six full-survey products collect the ten standard digital metrics without historical scores', () => {
  const expected = [
    'Запуски кампаний за квартал', 'Черновики в СБОЛ >=70%', 'Наличие Self-service',
    'Наличие успешных бизнес-запусков', 'Цели выведены на мониторинг',
    'Факторный анализ - драйверы 1-2 ур.', 'Прогноз по целям',
    'Cross-sell во время оформления продукта (LossHunter)', 'Оценка исследований >=7,5',
    'Доп. инициативы сверх БП',
  ];
  const fresh = Object.values(productSurveyProfiles).filter(profile => profile.fullSurvey);
  assert.equal(fresh.length, 6);
  for (const profile of fresh) {
    const summary = getIntroSummary(profile.teamId);
    assert.deepEqual(summary.digital, expected, profile.name);
    assert.equal(summary.sectionCount, 9);
    assert.ok(profile.metrics.every(metric => metric.value === null));
    for (const label of expected) assert.ok(!summary.survey.includes(label));
    const ids = getSections({product: profile.teamId}).flatMap(section => section.questions).map(q => q.id);
    for (const id of ['marketRussia', 'marketSber', 'satellite', 'attractConfigured', 'attractIncludes',
      'attractAnalysis', 'churnConfigured', 'churnIncludes', 'churnAnalysis', 'upsell', 'discovery']) {
      assert.ok(ids.includes(id), `${profile.name}: ${id} still asked`);
    }
    assert.equal(getBacklogAnalyzed({product: profile.teamId}), false);
  }
});


test('intro groups preserve every metric and assign it to its own section', () => {
  for (const profile of Object.values(productSurveyProfiles)) {
    const summary = getIntroSummary(profile.teamId);
    for (const [groups, flat] of [[summary.surveyGroups, summary.survey], [summary.digitalGroups, summary.digital]]) {
      assert.deepEqual(new Set(groups.flatMap(g => g.metrics)), new Set(flat));
      assert.equal(groups.flatMap(g => g.metrics).length, flat.length);
      assert.ok(groups.every(g => g.id && g.title && g.metrics.length));
    }
    assert.ok(summary.surveyGroups.find(g => g.id === 'metrics').metrics.includes('Знание ключевых метрик'));
    assert.ok(!summary.surveyGroups.some(g => g.id === 'goals'));
    assert.ok(!summary.survey.includes('Дашборды с КПЭ продукта'));
    const questions = getSections({product: profile.teamId}).flatMap(s => s.questions);
    const upsell = questions.find(q => q.id === 'upsell');
    const expected = upsell ? upsell.commentWhen.filter(option => !knownMechanics(upsell, {product: profile.teamId}).includes(option)).map(option => ({
      'Удержание клиентов': 'Механики удержания клиентов', 'Возврат клиентов': 'Механики возврата клиентов',
      'Допродажи (upsell)': 'Механики допродаж (Upsell)',
    }[option])) : [];
    if (questions.some(q => q.id === 'mechanicsMonitoring')) expected.push('Мониторинг эффективности механик');
    expected.push('Cross-sell после оформления продукта');
    assert.deepEqual(summary.surveyGroups.find(g => g.id === 'mechanics').metrics, expected);
    for (const group of summary.digitalGroups) {
      if (group.id === 'mechanics') assert.deepEqual(group.metrics, ['Cross-sell во время оформления продукта (LossHunter)']);
      if (group.id === 'research') assert.ok(group.metrics.every(label => /исследований|инициативы|A\/B|Discovery/.test(label)));
      if (group.id === 'goals') assert.ok(group.metrics.every(label => /Цели|целям|Факторный/.test(label)));
    }
  }
});
