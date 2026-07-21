import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const dashboardSource = readFileSync(new URL('./DashboardPage.jsx', import.meta.url), 'utf8');

test('Summary labels every average index as B2C', () => {
  const b2cLabels = dashboardSource.match(/>Средний Data-Driven Index B2C</g) || [];

  assert.equal(b2cLabels.length, 2);
  assert.doesNotMatch(dashboardSource, />Средний Data-Driven Index</);
});
