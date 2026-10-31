import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navigatorKnowledgeFraction, applyNavigatorKnowledge, isInvestKopilkaNavigatorOverride} from './navigatorKnowledge.js';
import {buildDdiPeriodProducts, buildDdiCohortProducts} from './quarterProfiles.js';
import {mergeSalaryCohorts} from './salaryCohortAverage.js';
import {applyReportingFormatAssessments} from './reportingRegularity.js';

const metric = (code, value, max_value = 1) => ({code, value, max_value, is_applicabble_flg: true});
const inputs = (mau, market, satellite) => [metric('general.mau_produkta', mau, 0.2),
  metric('general.obъem_celevogo_rynka_v_rossii', market, 0.2),
  metric('general.znanie_produktov_sputnikov', satellite, 0.2)];

test('all eight knowledge combinations follow MAU/market gates and the satellite half score', () => {
  for (const mau of [0, 1]) for (const market of [0, 1]) for (const satellite of [0, 1]) {
    assert.equal(navigatorKnowledgeFraction(inputs(mau * 0.2, market * 0.2, satellite * 0.2)),
      !mau || !market ? 0 : satellite ? 1 : 0.5);
  }
});

test('unknowns remain unknown, absent prerequisites are not zero, and platform MAU cannot replace total MAU', () => {
  assert.equal(navigatorKnowledgeFraction(inputs(null, 0.2, 0.2)), null);
  assert.equal(navigatorKnowledgeFraction(inputs(0.2, 0.2, null)), null);
  assert.equal(navigatorKnowledgeFraction(inputs(0, null, null)), 0);
  assert.equal(navigatorKnowledgeFraction(inputs(0.1, 0.2, 0.2)), 0);
  const missing = inputs(0.2, 0.2, 0.2).slice(1);
  assert.equal(navigatorKnowledgeFraction([...missing, metric('general.mau_ios', 1)]), undefined);
});

test('weighted target, recommendations, Q2, immutability and idempotence are preserved', () => {
  const target = {...metric('general.navigator_reporting_knowledge', 0.5, 0.5),
    recommendation_items: [{value: 0.5, max_value: 0.5, gap: 0}]};
  const product = {metrics: [{metrics: [...inputs(0.2, 0.2, 0), target]}]};
  const before = JSON.stringify(product);
  const result = applyNavigatorKnowledge([product], 'III кв. 2026');
  const actual = result[0].metrics[0].metrics.at(-1);
  assert.equal(actual.value, 0.25);
  assert.equal(actual.recommendation_items[0].gap, 0.25);
  assert.deepEqual(applyNavigatorKnowledge(result, 'III кв. 2026'), result);
  assert.deepEqual(applyNavigatorKnowledge([product], 'II кв. 2026'), [product]);
  assert.equal(JSON.stringify(product), before);
});

test('current application pipeline uses final knowledge inputs and VZR drafts are zero', () => {
  const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
  const source = read('../../public/report-data.json').products;
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
  const salary = read('../data/salary-products-q3-2026.json');
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const prior = applyReportingFormatAssessments(mergeSalaryCohorts(buildDdiCohortProducts(source, 'III кв. 2026', overlays, salary, reporting, actions), 'III кв. 2026', salary, source), 'III кв. 2026', overlays);
  const result = buildDdiPeriodProducts(source, 'III кв. 2026', overlays, salary, reporting, actions);
  for (let i = 0; i < result.length; i++) {
    const old = prior[i].metrics.flatMap(b => b.metrics);
    for (const m of result[i].metrics.flatMap(b => b.metrics)) {
      const original = old.find(entry => entry.code === m.code);
      if (m.code !== 'general.navigator_reporting_knowledge') assert.deepEqual(m, original);
      else {
        assert.equal(m.max_value, original.max_value);
        assert.equal(m.is_applicabble_flg, original.is_applicabble_flg);
      }
    }
  }
  const vzr = result.find(p => p.name === 'ВЗР').metrics.flatMap(b => b.metrics);
  assert.equal(vzr.find(m => m.code === 'attract.chernoviki_v_sbol_70').value, 0);
  assert.equal(result.find(p => p.name === 'Брокерский счет').metrics.flatMap(b => b.metrics)
    .find(m => m.code === 'general.navigator_reporting_knowledge').value, 0);
  assert.deepEqual(buildDdiPeriodProducts(source, 'II кв. 2026', overlays, salary, reporting, actions), source);
});


test('the explicit InvestKopilka half-score exception is limited to its exact Q3 identity and confirmed fact',()=>{
  const id='181a8be0-a6c1-5590-819c-b49ae1c80081¦ИнвестКопилка';
  const target={...metric('general.navigator_reporting_knowledge',.25,.5),source:{origin:'userConfirmedInvestKopilkaNavigator20261030',confirmedBy:'user',rawValue:.5,period:'III кв. 2026',teamId:id}};
  const product={id:id+'::empty::III кв. 2026',name:'ИнвестКопилка',unit:'УБ',type:'Продукт',period:'III кв. 2026',metrics:[{code:'general',metrics:[...inputs(.2,.2,.2),target]}]};
  const snapshot=JSON.stringify(product);
  assert.equal(isInvestKopilkaNavigatorOverride(product,target),true);
  assert.deepEqual(applyNavigatorKnowledge([product],'III кв. 2026'),[product]);
  for(const patch of [{id:'another'},{name:'Другая команда'},{unit:'DB'},{type:'Канал'},{period:'II кв. 2026'}])assert.equal(isInvestKopilkaNavigatorOverride({...product,...patch},target),false,JSON.stringify(patch));
  for(const patch of [{code:'general.mau_produkta'},{value:.5},{value:0},{is_applicabble_flg:false},{max_value:0}])assert.equal(isInvestKopilkaNavigatorOverride(product,{...target,...patch}),false,JSON.stringify(patch));
  for(const patch of [{origin:'other'},{confirmedBy:'other'},{rawValue:1},{period:'II кв. 2026'},{teamId:'another'}]){
    const m={...target,source:{...target.source,...patch}};assert.equal(isInvestKopilkaNavigatorOverride(product,m),false,JSON.stringify(patch));
    const q={...product,metrics:[{...product.metrics[0],metrics:[...inputs(.2,.2,.2),m]}]};
    assert.equal(applyNavigatorKnowledge([q],'III кв. 2026')[0].metrics[0].metrics.at(-1).value,.5,'Unconfirmed facts cannot bypass the hierarchy');
  }
  assert.deepEqual(applyNavigatorKnowledge([product],'II кв. 2026'),[product]);
  assert.equal(JSON.stringify(product),snapshot);
});
