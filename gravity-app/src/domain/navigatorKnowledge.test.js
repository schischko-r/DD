import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navigatorKnowledgeFraction, applyNavigatorKnowledge, isInvestKopilkaNavigatorOverride, isDirectNavigatorOverride} from './navigatorKnowledge.js';
import {buildDdiPeriodProducts} from './quarterProfiles.js';

const metric = (code, value, max_value = 1) => ({code, value, max_value, is_applicabble_flg: true});
const inputs = (mau, market, satellite) => [metric('general.mau_produkta', mau, 0.2),
  metric('general.obъem_celevogo_rynka_v_rossii', market, 0.2),
  metric('general.znanie_produktov_sputnikov', satellite, 0.2)];

test('all eight knowledge combinations follow MAU/market gates and the satellite half score', () => {
  for (const mau of [0, 1]) for (const market of [0, 1]) for (const satellite of [0, 1]) {
    assert.equal(navigatorKnowledgeFraction(inputs(mau * 0.2, market * 0.2, satellite * 0.2)),
      !mau ? 0 : !market ? 0.5 : satellite ? 1 : 0.5);
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

test('known Major clients remain usable without applicable MAU but cannot override an explicit unknown MAU', () => {
  const code = 'general.kol_vo_major_klientov';
  assert.equal(navigatorKnowledgeFraction([metric(code, 0.3, 0.3)]), 1);
  assert.equal(navigatorKnowledgeFraction([...inputs(0, 0, 0), metric(code, 0.3, 0.3)]), 0);
  assert.equal(navigatorKnowledgeFraction([...inputs(0.2, 0, 0), metric(code, 0.3, 0.3)]), 0.5);
  for (const major of [metric(code, null, 0.3), metric(code, 0, 0.3), metric(code, 0.15, 0.3),
    {...metric(code, 0.3, 0.3), is_applicabble_flg: false}, metric(code, 0, 0)]) {
    assert.equal(navigatorKnowledgeFraction([...inputs(0.2, 0.2, 0), major]), 0.5);
  }
  const product = {period: 'III кв. 2026', metrics: [{metrics: [metric(code, 0.3, 0.3),
    {...metric('general.navigator_reporting_knowledge', null, 0.5), recommendation_items: [{value: null, max_value: 0.5, gap: null}]}]}]};
  const result = applyNavigatorKnowledge([product], product.period);
  const target = result[0].metrics[0].metrics.at(-1);
  assert.equal(target.value, 0.5);
  assert.equal(target.recommendation_items[0].gap, 0);
  assert.equal(target.source.origin, 'userConfirmedMajorNavigatorRule');
  assert.deepEqual(applyNavigatorKnowledge(result, product.period), result);
  assert.deepEqual(applyNavigatorKnowledge([product], 'II кв. 2026'), [product]);
  assert.equal(product.metrics[0].metrics.at(-1).value, null);
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

test('full Navigator reporting knowledge is capped at 50% when any known key metric has an error', () => {
  const target = metric('general.navigator_reporting_knowledge', 0.5, 0.5);
  const product = {period: 'III кв. 2026', metrics: [{metrics: [...inputs(0.2, 0.2, 0.2),
    metric('general.obъem_celevogo_rynka_v_sbere', 0, 0.2), target]}]};
  const result = applyNavigatorKnowledge([product], 'III кв. 2026')[0];
  const assessed = result.metrics[0].metrics.find(item => item.code === target.code);
  assert.equal(assessed.value, 0.25);
  assert.equal(assessed.source.origin, 'userConfirmedKeyMetricsAccuracyCap');
  assert.deepEqual(assessed.source.errorMetricCodes, ['general.obъem_celevogo_rynka_v_sbere']);
  assert.deepEqual(applyNavigatorKnowledge([result], 'III кв. 2026'), [result]);
  const missing = {...product, metrics: [{metrics: [...inputs(0.2, 0.2, 0.2),
    metric('general.obъem_celevogo_rynka_v_sbere', null, 0.2), target]}]};
  assert.equal(applyNavigatorKnowledge([missing], 'III кв. 2026')[0].metrics[0].metrics
    .find(item => item.code === target.code).value, 0.5);
});

test('current profiles keep final Excel priority while the derived Navigator rule changes no other metrics', () => {
  const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
  const source = read('../../public/report-data.json').products;
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(key => read(`../data/${imports.get(key.trim())}`));
  const salary = read('../data/salary-products-q3-2026.json');
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const result = buildDdiPeriodProducts(source, 'III кв. 2026', overlays, salary, reporting, actions);
  const derived = applyNavigatorKnowledge(result, 'III кв. 2026');
  for (let i = 0; i < result.length; i++) {
    for (const m of result[i].metrics.flatMap(b => b.metrics)) {
      const recalculated = derived[i].metrics.flatMap(b => b.metrics).find(entry => entry.code === m.code);
      if (m.code !== 'general.navigator_reporting_knowledge') assert.deepEqual(recalculated, m);
      else assert.equal(recalculated.max_value, m.max_value);
    }
  }
  const secondaryNavigator = result.find(p => p.name === 'Сделка вторичка').metrics.flatMap(b => b.metrics)
    .find(m => m.code === 'general.navigator_reporting_knowledge');
  assert.equal(secondaryNavigator.value, secondaryNavigator.max_value);
  const vzr = result.find(p => p.name === 'ВЗР').metrics.flatMap(b => b.metrics);
  assert.equal(vzr.find(m => m.code === 'attract.chernoviki_v_sbol_70').value, 0.5, 'Explicit Excel F299 wins');
  const broker = result.find(p => p.name === 'Брокерский счет').metrics.flatMap(b => b.metrics)
    .find(m => m.code === 'general.navigator_reporting_knowledge');
  assert.equal(broker.value / broker.max_value, 0.5, 'Explicit Excel F237 wins');
  assert.equal(broker.source.cell, 'F237');
  for (const [name, expected] of [['Брокерский счет', 0], ['Дебетовая карта', 0], ['ВЗР', 0],
    ['Трансграничный эквайринг', 0.5], ['SberPay NFC', 0.5]]) {
    const navigator = derived.find(p => p.name === name).metrics.flatMap(b => b.metrics)
      .find(m => m.code === 'general.navigator_reporting_knowledge');
    assert.equal(navigator.value / navigator.max_value, expected,
      `${name}: zero for unknown MAU, half for known MAU and unknown market, before final Excel priority`);
  }
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
  const withMajor = {...product, metrics: [{...product.metrics[0], metrics: [...product.metrics[0].metrics,
    metric('general.kol_vo_major_klientov', 0.3, 0.3)]}]};
  assert.equal(applyNavigatorKnowledge([withMajor], 'III кв. 2026')[0].metrics[0].metrics.find(m => m.code === target.code).value, 0.5);
  assert.equal(JSON.stringify(product),snapshot);
});

test('a direct confirmed CFA Navigator score overrides the hierarchy only for its exact team, period and metric', () => {
  const config = JSON.parse(readFileSync(new URL('../data/cfa-navigator-user-q3-2026.json', import.meta.url)));
  const team = config.products[0];
  const code = 'general.navigator_reporting_knowledge';
  const target = {...metric(code, 0.5, 0.5), source: team.metrics[code].source};
  const product = {...team, id: `${team.id}::empty::${config.period}`, period: config.period,
    metrics: [{code: 'general', metrics: [...inputs(0, 0, 0), target]}]};
  const snapshot = JSON.stringify(product);
  assert.equal(isDirectNavigatorOverride(product, target), true);
  const assessed = applyNavigatorKnowledge([product], config.period)[0];
  assert.equal(assessed.metrics[0].metrics.at(-1).value, 0,
    'An explicit zero MAU gives zero before final Excel overrides');
  assert.equal(assessed.metrics[0].metrics.at(-1).source.origin, 'userConfirmedNavigatorKnowledgeHierarchy');
  assert.deepEqual(applyNavigatorKnowledge([assessed], config.period), [assessed]);
  for (const patch of [{id: 'other'}, {name: 'other'}, {unit: 'DB'}, {type: 'Канал'}, {period: 'II кв. 2026'}]) {
    assert.equal(isDirectNavigatorOverride({...product, ...patch}, target), false);
  }
  for (const patch of [{confirmedBy: 'other'}, {teamId: 'other'}, {teamName: 'other'}, {unit: 'DB'},
    {type: 'Канал'}, {period: 'II кв. 2026'}, {rawValue: 2}, {origin: 'other'}]) {
    const invalid = {...target, source: {...target.source, ...patch}};
    assert.equal(isDirectNavigatorOverride(product, invalid), false);
    const candidate = {...product, metrics: [{code: 'general', metrics: [...inputs(0, 0, 0), invalid]}]};
    assert.equal(applyNavigatorKnowledge([candidate], config.period)[0].metrics[0].metrics.at(-1).value, 0);
  }
  assert.equal(isDirectNavigatorOverride(product, {...target, value: 0.25}), false);
  assert.equal(isDirectNavigatorOverride(product, {...target, is_applicabble_flg: false}), false);
  assert.deepEqual(applyNavigatorKnowledge([product], 'II кв. 2026'), [product]);
  assert.equal(JSON.stringify(product), snapshot);
});
