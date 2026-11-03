import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const dashboardSource = readFileSync(new URL('./DashboardPage.jsx', import.meta.url), 'utf8');

test('Summary never shows an average without saying whose it is', () => {
  const b2cLabels = dashboardSource.match(/>Средний Data-Driven Index B2C</g) || [];

  assert.equal(b2cLabels.length, 1);
  assert.doesNotMatch(dashboardSource, />Средний Data-Driven Index</);
  assert.match(
    dashboardSource,
    /const profileCaption = unit \? 'Среднее по командам юнита' : 'Среднее по B2C';/,
    'the profile card says what it averages, and falls back to B2C',
  );
  assert.doesNotMatch(dashboardSource, />Среднее<|>Средний</, 'no bare average label');
});

test('Summary profile shows a quarter delta using the team-card badge style', () => {
  assert.match(dashboardSource, /const previousPeriod = previousQuarterPeriod\(period\);/);
  assert.match(dashboardSource, /const profileDelta = profileScore !== null && previousProfileScore !== null/);
  assert.match(dashboardSource, /index-quarter-delta-\$\{profileDelta > 0 \? 'positive' : profileDelta < 0 \? 'negative' : 'neutral'\}/);
  assert.match(dashboardSource, /className="index-quarter-delta-direction"/);
  assert.match(dashboardSource, /ко \{previousPeriod\}/);
});
