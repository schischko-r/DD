import assert from 'node:assert/strict';
import test from 'node:test';
import {getIntroSummary, sectionCountText} from './intro.js';
import {productSurveyProfiles} from './product-surveys.js';
import {getBacklogAnalyzed, getSections, visibleQuestions} from './questions.js';

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
    assert.equal(summary.digital.some(label => label.startsWith('Discovery')), Boolean(profile.backlogAnalyzed && discoveryApplicable));
    if (profile.backlogAnalyzed) assert.ok(!summary.survey.some(label => label.startsWith('Discovery')));
    for (const code of ['mehaniki.uderzhanie_klientov', 'mehaniki.vozvrat_klientov', 'mehaniki.doprodazhi_up_sell']) {
      const metric = profile.metrics.find(item => item.code === code);
      if (metric?.value === metric?.max_value) {
        const word = code.includes('uderzhanie') ? 'удержания' : code.includes('vozvrat') ? 'возврата' : 'допродаж';
        assert.ok(!summary.survey.some(label => label.includes(word)), `${profile.teamId}: known mechanic stays excluded`);
      }
    }
  }
});

test('section counts use Russian plural forms', () => {
  assert.deepEqual([1, 2, 5, 11, 12, 14, 21, 22, 25].map(sectionCountText),
    ['1 раздел', '2 раздела', '5 разделов', '11 разделов', '12 разделов', '14 разделов', '21 раздел', '22 раздела', '25 разделов']);
});
