import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const summarySource = readFileSync(new URL('./LlmSummary.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

test('the cross-sell popup no longer carries the market section', () => {
  assert.doesNotMatch(summarySource, /CrossSellMarket/);
  assert.doesNotMatch(summarySource, /Рынок продукта/);
  assert.doesNotMatch(summarySource, /Источники снимка/);
  assert.doesNotMatch(stylesSource, /\.crosssell-market/);
});

test('everything the popup said around it survives', () => {
  for (const line of [
    /Всего в клиентских путях найдено/,
    /кросс-селл с другими продуктами в рамках сценариев вашего продукта/,
    /кросс-селл в сценариях других продуктов с вашим продуктом/,
    /Потенциальных cross-sell связок/,
    /Связок, ожидающих вашей обратной связи/,
  ]) {
    assert.match(summarySource, line);
  }
  assert.match(summarySource, /<CrossSellNextSteps \/>/);
});

test('the market snapshot still feeds the waiting-decision count', () => {
  assert.match(
    summarySource,
    /const marketPresentation = item\.skill_key === 'cross_sell'\s*\?\s*crossSellMarketPresentation\(item, \{hideRejectedCandidates: hideRejectedCrossSellCandidates\}\)/,
    'the presentation is still built, only its section is gone',
  );
  assert.match(summarySource, /crossSellWaitingDecisionCount\(item, marketPresentation\)/);
});
