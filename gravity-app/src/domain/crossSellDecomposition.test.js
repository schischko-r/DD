import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {crossSellAfterPurchaseResponses, crossSellAfterPurchaseStatus, hasCrossSellDecomposition} from './crossSellDecomposition.js';
import {buildTeamProfileProducts} from './teamProfileSelection.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = read('../../public/report-data.json').products;
const survey = read('../data/crosssell-after-purchase-q3-2026.json');
const crosssell = read('../data/crosssell-metrics-q3-2026.json');

test('decomposition is restricted to the Cross-sell metric in Q3', () => {
  assert.equal(hasCrossSellDecomposition({period: survey.period}, {code: 'mehaniki.cross_sell'}), true);
  assert.equal(hasCrossSellDecomposition({period: 'II кв. 2026'}, {code: 'mehaniki.cross_sell'}), false);
  assert.equal(hasCrossSellDecomposition({period: survey.period}, {code: 'mehaniki.vozvrat_klientov'}), false);
});

test('survey answers attach only to the same product and Q3 without changing metric scores', () => {
  const before = JSON.stringify({source, crosssell, survey});
  const profiles = buildTeamProfileProducts(source, survey.period, crosssell);
  for (const team of survey.products) {
    const profile = profiles.find((p) => p.name === team.name && p.unit === team.unit);
    assert.ok(profile);
    assert.deepEqual(crossSellAfterPurchaseResponses(profile, survey), team.responses);
    assert.deepEqual(crossSellAfterPurchaseResponses({...profile, unit: 'another'}, survey), []);
    assert.deepEqual(crossSellAfterPurchaseResponses({...profile, name: 'another'}, survey), []);
    assert.deepEqual(crossSellAfterPurchaseResponses({...profile, period: 'II кв. 2026'}, survey), []);
  }
  assert.equal(JSON.stringify({source, crosssell, survey}), before);
});

test('zero, missing, unknown and conflicting answers stay distinct', () => {
  assert.deepEqual(crossSellAfterPurchaseStatus([]), {label: 'Нет ответа', theme: 'normal'});
  assert.equal(crossSellAfterPurchaseStatus([{answer: 'Нет'}]).label, 'Нет');
  assert.equal(crossSellAfterPurchaseStatus([{answer: 'Затрудняюсь ответить'}]).label, 'Затрудняюсь ответить');
  assert.equal(crossSellAfterPurchaseStatus([{answer: 'Да'}, {answer: 'Да'}]).label, 'Да');
  assert.equal(crossSellAfterPurchaseStatus([{answer: 'Да'}, {answer: 'Нет'}]).label, 'Ответы различаются');
});
