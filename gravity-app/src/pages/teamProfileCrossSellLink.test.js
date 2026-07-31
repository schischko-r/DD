import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');

test('cross-sell metric opens a preview instead of linking directly to LossHunter', () => {
  assert.doesNotMatch(profileSource, /#screen=pult/);
  assert.doesNotMatch(profileSource, /CROSSSELL_ANALYTICS_URL/);
  assert.match(profileSource, /crossSellPreview\(product,\s*block\)/);
  assert.match(
    profileSource,
    /aiMetricInsights\.push\(\{[^}]*title:\s*'Cross-sell'[^}]*onClick:/,
  );
  assert.doesNotMatch(
    profileSource,
    /aiMetricInsights\.push\(\{[^}]*title:\s*'Cross-sell'[^}]*href:/,
  );
});

test('cross-sell preview shows the recommendation title and canonical LossHunter action', () => {
  assert.match(
    profileSource,
    /Cross-sell: покрытие и рекомендованные действия/,
  );
  assert.match(
    profileSource,
    /<RecommendationBody item=\{[^}]*recommendation[^}]*\}/,
  );
  assert.match(
    profileSource,
    /<SemanticButton[^>]*href=\{preview\.href\}[^>]*target="_blank"[^>]*>Перейти в LossHunter/,
  );
});

test('cross-sell preview is guarded when recommendation or deeplink is unavailable', () => {
  assert.match(profileSource, /function CrossSellPreviewDialog\(\{preview, onClose\}\) \{\s*if \(!preview\) return null;/);
  assert.match(
    profileSource,
    /<CrossSellPreviewDialog preview=\{crossSellPreviewOpen\}/,
  );
});
