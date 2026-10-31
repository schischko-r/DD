import test from 'node:test';
import assert from 'node:assert/strict';
import {previousQuarterIndexDelta} from './report.js';
const old={id:'team',name:'BNPL',unit:'CBP',type:'Продукт',period:'II кв. 2026'};
const current={...old,id:'team::empty::III кв. 2026',period:'III кв. 2026'};
const rows=[{name:'BNPL',unit:'CBP',type:'продукт',score:54}];
test('overall delta compares the displayed current index with the same team published Q2 index',()=>{
  assert.deepEqual(previousQuarterIndexDelta(current,46,[old],rows),{value:-8,previousScore:54,previousPeriod:'II кв. 2026'});
  assert.equal(previousQuarterIndexDelta(current,64,[old],rows).value,10);
  assert.equal(previousQuarterIndexDelta(current,54,[old],rows).value,0);
});
test('missing, invalid, ambiguous and different-identity prior indices never produce a delta',()=>{
  for(const score of [null,undefined,NaN,-1,101])assert.equal(previousQuarterIndexDelta(current,score,[old],rows),null);
  assert.equal(previousQuarterIndexDelta(old,46,[old],rows),null);
  assert.equal(previousQuarterIndexDelta({...current,name:'Зарплатный продукт #B2C'},46,[old],rows),null);
  assert.equal(previousQuarterIndexDelta(current,46,[],rows),null);
  assert.equal(previousQuarterIndexDelta(current,46,[old],[...rows,...rows]),null);
  assert.equal(previousQuarterIndexDelta(current,46,[{...old,type:'Канал'}],rows),null);
});
