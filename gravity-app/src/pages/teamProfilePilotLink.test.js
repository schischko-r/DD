import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');

test('pilot campaign AI link uses a standalone label', () => {
  assert.match(profileSource, /'пилотным кампаниям': 'Пилотные кампании'/);
  assert.match(profileSource, /metricAiInsight\('пилотным кампаниям', openPilotAiRecommendation\)/);
});
