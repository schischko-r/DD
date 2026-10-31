import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {displayProductName} from './report.js';
import {buildTeamProfileProducts, resolveTeamProfileSelection} from './teamProfileSelection.js';

test('travel insurance has the new name in both quarters without losing identity or API facts', () => {
  const products = JSON.parse(readFileSync(new URL('../../public/report-data.json', import.meta.url))).products;
  const overlay = JSON.parse(readFileSync(new URL('../data/crosssell-metrics-q3-2026.json', import.meta.url)));
  const before = JSON.stringify({products, overlay});
  const source = products.find((product) => product.name === 'ВЗР');
  assert.ok(source);
  const api = overlay.products.find((product) => product.id === source.id);
  assert.ok(api);
  assert.equal(api.metrics['mehaniki.cross_sell'].source.catalogUid, 'взр');
  for (const period of ['II кв. 2026', 'III кв. 2026']) {
    const profiles = buildTeamProfileProducts(products, period, overlay);
    const selection = resolveTeamProfileSelection(profiles, {period, unit: source.unit, selected: source});
    assert.equal(selection.product.name, source.name);
    assert.equal(displayProductName(selection.product.name), 'Страхование путешественников');
    assert.equal(selection.product.period, period);
    assert.equal(selection.product.unit, source.unit);
    const metric = selection.product.metrics.flatMap((block) => block.metrics).find((metric) => metric.code === 'mehaniki.cross_sell');
    if (period === overlay.period) {
      assert.equal(metric.source.catalogUid, 'взр');
      assert.equal(metric.value, api.metrics[metric.code].rawValue * metric.max_value);
    } else {
      assert.equal(selection.product.id, source.id);
    }
  }
  assert.equal(JSON.stringify({products, overlay}), before);
});
