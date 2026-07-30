import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('grouped recommendations keep their target block and every unique metric code', () => {
  assert.match(
    profileSource,
    /const current = groups\.get\(key\) \|\| \{[^}]*blockCode: block\.code,[^}]*metricCodes: \[\]/,
  );
  assert.match(
    profileSource,
    /if \(!current\.metricCodes\.includes\(metric\.code\)\) current\.metricCodes\.push\(metric\.code\);/,
  );
});

test('top and dialog recommendations navigate while the summary opens the full list', () => {
  assert.match(
    profileSource,
    /className="top-recommendation recommendation-action" onClick=\{\(\) => openRecommendationDetails\(item\)\}/,
  );
  assert.match(
    profileSource,
    /className="dialog-recommendation recommendation-action" onClick=\{\(\) => openRecommendationDetails\(item, true\)\}/,
  );
  assert.match(
    profileSource,
    /className="top-recommendation top-recommendation-summary recommendation-action" onClick=\{\(\) => setRecommendationsOpen\(true\)\}/,
  );
});

test('recommendation navigation opens the target block, highlights all metrics and scrolls to the first one', () => {
  assert.match(
    profileSource,
    /const metricCodes = recommendation\.metricCodes \|\| \[\];[\s\S]*setOpen\(\(current\) => new Set\(current\)\.add\(recommendation\.blockCode\)\);/,
  );
  assert.match(profileSource, /setHighlightedMetrics\(new Set\(metricCodes\)\);/);
  assert.match(
    profileSource,
    /metricCodes[\s\S]*\.map\(\(metricCode\) => document\.getElementById\(metricDomId\(metricCode\)\)\)[\s\S]*\.find\(Boolean\);[\s\S]*firstMetric\?\.scrollIntoView\(/,
  );
  assert.match(profileSource, /window\.setTimeout\(\(\) => \{[\s\S]*setHighlightedMetrics\(new Set\(\)\);[\s\S]*\}, 1000\);/);
});

test('metric rows receive the temporary highlight class and visual treatment', () => {
  assert.match(
    profileSource,
    /highlighted \? ' metric-row-highlighted' : ''/,
  );
  assert.match(
    profileSource,
    /highlighted=\{highlightedMetrics\.has\(metric\.code\)\}/,
  );
  assert.match(stylesSource, /\.metric-row-highlighted\s*\{[^}]*animation:\s*metric-row-highlight 1s ease-out;/s);
});
