import test from 'node:test';
import assert from 'node:assert/strict';
import {completeProductPercent} from './report.js';
const metric=(value,max=1,extra={})=>({value,max_value:max,is_applicabble_flg:true,dd_calculation_flg:1,...extra});
test('overall index requires every applicable indexed score and keeps zeros as real scores',()=>{
  const p={metrics:[{metrics:[metric(1),metric(0)]},{metrics:[metric(.25,.5)]}]};
  assert.equal(completeProductPercent(p),50);
  for(const value of [null,undefined,NaN,-1,2])assert.equal(completeProductPercent({metrics:[{metrics:[metric(1),metric(value)]}]}),null);
  assert.equal(completeProductPercent({metrics:[]}),null);
});
test('NA and informational blanks do not block an otherwise complete product, while TBD does',()=>{
  const rows=[metric(0),metric(null,0,{is_applicabble_flg:false}),metric(null,1,{dd_calculation_flg:0}),metric(null,1,{excluded_from_index:true})];
  assert.equal(completeProductPercent({metrics:[{metrics:rows}]}),0);
  assert.equal(completeProductPercent({metrics:[{metrics:[metric(1,1,{tbd:true})]}]}),null);
});
