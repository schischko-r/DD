import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyReportingFormatAssessments} from './reportingRegularity.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const config = read('../data/monthly-excel-reporting-q3-2026.json');

test('monthly Excel halves both weighted scores, preserves applicability and other answers, and is idempotent', () => {
  const team = config.products[0];
  const metrics = Object.keys(team.metrics).map(code => ({code, name: code.endsWith('regulyarnostь') ? 'Регулярность' : 'Настроена отчётность', value: 0.5, max_value: 0.5}));
  metrics.push({code: 'attract.regulyarnostь', name: 'Регулярность', value: 1, max_value: 1, dd_calculation_flg: 0});
  const fact = Object.values(team.metrics)[0];
  const assessment = {...config, products: [{...team, metrics: {...team.metrics, 'attract.regulyarnostь': fact}}]};
  const product = {...team, metrics: [{metrics}]};
  const input = JSON.stringify({product, assessment});
  const result = applyReportingFormatAssessments([product], config.period, assessment);
  assert.ok(result[0].metrics[0].metrics.every(m => m.value === m.max_value * 0.5));
  assert.equal(result[0].metrics[0].metrics.at(-1).dd_calculation_flg, 0);
  assert.deepEqual(applyReportingFormatAssessments(result, config.period, assessment), result);
  assert.deepEqual(applyReportingFormatAssessments([product], 'II кв. 2026', assessment), [product]);
  assert.equal(JSON.stringify({product, assessment}), input);
  for (const patch of [{reportFormat: 'link'}, {answer: 'Да, по запросу'}, {answer: 'Да, автоматическая (daily/weekly)'}, {answer: ''}]) {
    const changed = {...assessment, products: [{...team, metrics: Object.fromEntries(Object.entries(assessment.products[0].metrics).map(([code,f]) => [code, {...f, source: {...f.source, ...patch}}]))}]};
    assert.deepEqual(applyReportingFormatAssessments([product], config.period, changed), [product]);
  }
  const unavailable = {...product, metrics: [{metrics: metrics.map(m => ({...m, is_applicabble_flg: false}))}]};
  assert.deepEqual(applyReportingFormatAssessments([unavailable], config.period, assessment), [unavailable]);
});

test('the current application applies 17 applicable metrics, preserves the two NA metrics and leaves Q2 unchanged', () => {
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
  const source = read('../../public/report-data.json').products;
  const salary = read('../data/salary-products-q3-2026.json'), reporting = read('../data/reporting-regularity-missing-q3-2026.json'), actions = read('../data/funnel-action-missing-q3-2026.json');
  const before = buildDdiPeriodProducts(source, config.period, overlays.filter(o => o.scope !== config.scope), salary, reporting, actions);
  const after = buildDdiPeriodProducts(source, config.period, overlays, salary, reporting, actions);
  let checked = 0;
  for (let i = 0; i < after.length; i++) {
    const p = after[i], prior = before[i];
    const record = config.products.find(t => t.id === p.id.replace(/::empty::.*/, '') && ['name','unit','type'].every(key => t[key] === p[key]));
    if (!record) {assert.deepEqual(p, prior); continue;}
    assert.equal(p.indexMaxPoints, prior.indexMaxPoints);
    for (const m of p.metrics.flatMap(b => b.metrics)) {
      const old = prior.metrics.flatMap(b => b.metrics).find(metric => metric.code === m.code);
      if (!record.metrics[m.code]) {assert.deepEqual(m, old); continue;}
      if (old.is_applicabble_flg === false || !(old.max_value > 0)) {assert.deepEqual(m, old); continue;}
      checked++;
      assert.equal(m.value, 0.5 * m.max_value);
      for (const key of ['max_value','is_applicabble_flg','excluded_from_index','dd_calculation_flg']) assert.equal(m[key], old[key]);
      assert.equal(m.source.reportFormat, 'excel');
    }
  }
  assert.equal(checked, 17);
  assert.equal(config.products.length, 10);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, salary, reporting, actions), source);
});
