import test from 'node:test';
import assert from 'node:assert/strict';
import {isQ3CampaignMetricHidden} from './report.js';

test('only inapplicable campaign criteria are hidden in Q3; blanks, zeros and Q2 remain visible', () => {
  for (const code of ['attract.campaign_launches', 'attract.chernoviki_v_sbol_70',
    'attract.nalichie_self_service', 'attract.nalichie_uspeshnyh_biznes_zapuskov']) {
    for (const metric of [{code, max_value: 0}, {code, max_value: 1, is_applicabble_flg: false}]) {
      assert.equal(isQ3CampaignMetricHidden({period: 'III кв. 2026'}, metric), true);
      assert.equal(isQ3CampaignMetricHidden({period: 'II кв. 2026'}, metric), false);
    }
    for (const value of [null, 0, 0.5, 1]) {
      assert.equal(isQ3CampaignMetricHidden({period: 'III кв. 2026'}, {code, value, max_value: 1}), false);
    }
  }
  assert.equal(isQ3CampaignMetricHidden({period: 'III кв. 2026'}, {code: 'hyp.ab_tests', max_value: 0}), false);
});
