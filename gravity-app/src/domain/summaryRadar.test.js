import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSummaryRadarData, previousQuarterPeriod, isSummaryAntiTopMetricHidden} from './summaryRadar.js';
const product = (period, unit, value, extra = {}) => ({period, unit, metrics:[{code:'goals', metrics:[
  {code:'goals.monitored', value, max_value:1, is_applicabble_flg:true},
]}], ...extra});
const blocks = [{code:'goals',name:'Цели'}, {code:'missing',name:'Отсутствующий блок'}];

test('previous quarter is adjacent and handles the year boundary without taking an arbitrary older period', () => {
  assert.equal(previousQuarterPeriod('III кв. 2026'),'II кв. 2026');
  assert.equal(previousQuarterPeriod('I кв. 2026'),'IV кв. 2025');
  assert.equal(previousQuarterPeriod('IV кв. 2026'),'III кв. 2026');
  assert.equal(previousQuarterPeriod('not a quarter'),null);
});

test('Summary radar computes each historical cohort independently, preserves zero and scopes the previous series to the selected unit', () => {
  const products = [product('III кв. 2026','УБ',1,{isPlaceholder:true}),product('III кв. 2026','CBP',0,{isPlaceholder:true}),
    product('II кв. 2026','УБ',.5),product('II кв. 2026','УБ',1),product('II кв. 2026','CBP',0),product('I кв. 2026','УБ',0)];
  const snapshot=JSON.stringify(products);
  const all=buildSummaryRadarData(products,'III кв. 2026','',blocks);
  assert.equal(all.previousPeriod,'II кв. 2026');assert.equal(all.hasPrevious,true);
  assert.deepEqual(all.points[0],{code:'goals',name:'Цели',b2c:50,unit:50,previous:50});
  assert.equal(all.points[1].previous,null);
  const scoped=buildSummaryRadarData(products,'III кв. 2026','УБ',blocks);
  assert.deepEqual(scoped.points[0],{code:'goals',name:'Цели',b2c:50,unit:100,previous:75});
  assert.equal(JSON.stringify(products),snapshot);
});

test('absent previous-quarter data stays unavailable and an incomplete current block is not reported as a partial percentage', () => {
  const products=[product('III кв. 2026','УБ',null,{isPlaceholder:true}),product('I кв. 2026','УБ',1)];
  const result=buildSummaryRadarData(products,'III кв. 2026','',blocks);
  assert.equal(result.hasPrevious,false);assert.equal(result.points[0].previous,null);assert.equal(result.points[0].b2c,null);
});

test('only the Q3 flexible-conditions criterion is hidden from the Summary problem list', () => {
  const metric={code:'mehaniki.gibkoe_izmenenie_usloviy_produkta'};
  assert.equal(isSummaryAntiTopMetricHidden(metric,'III кв. 2026'),true);
  assert.equal(isSummaryAntiTopMetricHidden(metric,'II кв. 2026'),false);
  assert.equal(isSummaryAntiTopMetricHidden({code:'mehaniki.cross_sell'},'III кв. 2026'),false);
});
