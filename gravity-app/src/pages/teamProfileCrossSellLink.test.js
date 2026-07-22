import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');

test('cross-sell metric always links quick analytics to LossHunter', () => {
  assert.match(profileSource, /const CROSSSELL_ANALYTICS_URL = 'https:\/\/losshunter\.ru\/showcase\/crosssell\/#screen=pult';/);
  assert.match(profileSource, /if \(\/\^mehaniki\\\.cross_sell\$\/i\.test\(metric\.code\)\) aiMetricInsights\.push\(\{title: 'Cross-sell', label: 'Перейти', tone: 'info', href: CROSSSELL_ANALYTICS_URL\}\);/);
  assert.doesNotMatch(profileSource, /crossSellAiRecommendations\.length/);
});
