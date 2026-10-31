import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {displayMetricPercent} from './metricPresentation.js';
import {percent} from './report.js';

const product={name:'PB',unit:'CX',type:'Сегмент',period:'II кв. 2026'};
const metric={code:'mehaniki.uderzhanie_klientov',value:1.25,max_value:1.5,is_applicabble_flg:true};

test('PB retention shows 50 in the two requested quarters while preserving its actual weighted assessment',()=>{
  const snapshot=JSON.stringify({product,metric});
  for(const period of ['II кв. 2026','III кв. 2026']) assert.equal(displayMetricPercent({...product,period},metric),50);
  assert.equal(percent(metric.value,metric.max_value),83);
  assert.equal(metric.value,1.25);assert.equal(metric.max_value,1.5);
  assert.equal(JSON.stringify({product,metric}),snapshot);
});

test('the display exception cannot change another team, metric, period, applicability or actual percentage',()=>{
  for(const patch of [{name:'Top Affluent'},{unit:'Data'},{type:'Продукт'},{period:'I кв. 2026'},{period:'IV кв. 2026'},{period:'II кв. 2025'}])
    assert.equal(displayMetricPercent({...product,...patch},metric),83,JSON.stringify(patch));
  for(const patch of [{code:'mehaniki.vozvrat_klientov'},{code:'cx.score'},{is_applicabble_flg:false},{value:1},{value:0},{value:1.5}]) {
    const m={...metric,...patch};assert.equal(displayMetricPercent(product,m),percent(m.value,m.max_value),JSON.stringify(patch));
  }
});

test('profile uses the display percentage only for compact status and detailed progress, retaining raw points and calculation inputs',()=>{
  const source=readFileSync(new URL('../pages/TeamProfilePage.jsx',import.meta.url),'utf8');
  const row=source.match(/function MetricRow\([\s\S]*?(?=\nconst LEADER_CONFETTI_COLORS)/)[0];
  assert.match(row,/const value = percent\(metric\.value, metric\.max_value\)/);
  assert.match(row,/const displayValue = displayMetricPercent\(product, metric\)/);
  assert.match(row,/label: `\$\{displayValue\}%`/);
  assert.match(row,/<Progress value=\{displayValue\}/);
  assert.match(row,/`Набрано \$\{metric\.value\} баллов из \$\{metric\.max_value\}`/);
  assert.match(row,/metricUpliftRecommendation\(block, metric, value\)/);
});
