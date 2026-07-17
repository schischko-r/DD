import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBlock,
  applyMetricDefinition,
  changedProductCount,
  deleteEmptyBlock,
  deriveTitle,
  ensureConstructorDocument,
  moveMetric,
  parseReportJson,
  renameBlock,
  reorderBlock,
  scopeProductIds,
  serializeReport,
  updateMetricValues,
  updateTeam,
  validateReport,
} from './reportEditor.js';

const allScope = {kind: 'all', values: []};
const teamScope = (...values) => ({kind: 'teams', values});
const typeScope = (...values) => ({kind: 'types', values});

function metric({
  code,
  name = code,
  value = 0,
  max = 1,
  sort = 1,
  ...extra
}) {
  return {
    code,
    name,
    footer: `${name} footer`,
    value,
    max_value: max,
    is_applicabble_flg: true,
    excluded_from_index: false,
    dd_calculation_flg: 1,
    traffic_light: value === 0 ? 'red' : value >= max ? 'green' : 'yellow',
    recommendation_items: [],
    sort,
    ...extra,
  };
}

function rawReport() {
  return {
    unknown_root: {keep: true},
    products: [
      {
        id: 'product-1',
        name: 'Альфа',
        unit: 'U1',
        tribe: 'T1',
        type: 'Продукт',
        period: 'II кв. 2026',
        unknown_product: 'keep me',
        metrics: [
          {
            type: 'block',
            code: 'general',
            name: 'Основное',
            unknown_block: 1,
            metrics: [
              metric({
                code: 'general.score',
                name: 'Score',
                value: 2,
                max: 4,
                sort: 10,
                unknown_metric: {keep: true},
                recommendation_items: [
                  {recommendation: 'A', value: 0.5, max_value: 1, gap: 0.5, unknown: 'a'},
                  {recommendation: 'B', value: 1.5, max_value: 3, gap: 1.5, unknown: 'b'},
                ],
              }),
              metric({
                code: 'general.info',
                name: 'Info',
                value: 99,
                max: 1,
                sort: 20,
                dd_calculation_flg: 0,
              }),
            ],
          },
          {
            type: 'block',
            code: 'target',
            name: 'Target',
            metrics: [metric({
              code: 'target.excluded',
              value: 1,
              max: 1,
              sort: 8,
              excluded_from_index: true,
            })],
          },
          {type: 'block', code: 'empty', name: 'Empty', metrics: []},
        ],
      },
      {
        id: 'product-2',
        name: 'Бета',
        unit: 'U2',
        tribe: '',
        type: 'Канал',
        period: 'II кв. 2026',
        metrics: [
          {
            type: 'block',
            code: 'general',
            name: 'Основное',
            metrics: [metric({code: 'general.score', name: 'Score', value: 3, max: 4, sort: 1})],
          },
          {type: 'block', code: 'target', name: 'Target', metrics: []},
          {type: 'block', code: 'empty', name: 'Empty', metrics: []},
        ],
      },
    ],
    title: {
      custom_title: 'keep',
      rows: [
        {id: 'legacy-1', name: 'Альфа', unit: 'U1', type: 'продукт', custom_row: 'keep'},
        {id: 'legacy-2', name: 'Бета', unit: 'U2', type: 'Канал'},
      ],
    },
    ai_skill_digest: {unknown: ['preserved']},
    ai_skills_enabled: true,
  };
}

function preparedReport() {
  return ensureConstructorDocument(rawReport());
}

test('constructor metadata is deterministic for a legacy source and preserves unknown fields', () => {
  const first = ensureConstructorDocument(rawReport());
  const second = ensureConstructorDocument(rawReport());

  assert.equal(first.constructor.format, 'data-driven-constructor');
  assert.equal(first.constructor.version, 1);
  assert.match(first.constructor.documentId, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(first.constructor.sourceFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.constructor.documentId, second.constructor.documentId);
  assert.equal(first.constructor.sourceFingerprint, second.constructor.sourceFingerprint);
  assert.deepEqual(first.constructor.linkRules, []);
  assert.equal(first.unknown_root, first.unknown_root);
  assert.strictEqual(ensureConstructorDocument(first), first);
});

test('derived title uses product ids, exact score boundaries, and preserves row metadata', () => {
  const boundaryReport = {
    products: [39, 40, 61, 81].map((value, index) => ({
      id: `p${index}`,
      name: `Team ${index}`,
      unit: index % 2 ? 'B' : 'A',
      type: index === 0 ? 'Продукт' : 'Сегмент',
      metrics: [{code: 'main', name: 'Main', metrics: [metric({code: `m${index}`, value, max: 100})]}],
    })),
    title: {rows: [{id: 'old-row', name: 'Team 0', unit: 'A', custom: 42}], other: true},
  };

  const title = deriveTitle(boundaryReport);
  assert.deepEqual(title.rows.map(({score, group}) => ({score, group})), [
    {score: 39, group: 'Требуют внимания'},
    {score: 40, group: 'Развивающиеся'},
    {score: 61, group: 'Зрелые'},
    {score: 81, group: 'Лидеры'},
  ]);
  assert.deepEqual(title.rows.map((row) => row.product_id), ['p0', 'p1', 'p2', 'p3']);
  assert.equal(title.rows[0].id, 'old-row');
  assert.equal(title.rows[0].custom, 42);
  assert.equal(title.rows[0].type, 'продукт');
  assert.equal(title.other, true);
  assert.equal(title.avgScore, 55);
  assert.deepEqual(title.units, ['A', 'B']);
  assert.deepEqual(title.types, ['продукт', 'Сегмент']);
});

test('derived score follows Python half-even rounding at maturity edges', () => {
  const report = {
    products: [60.5, 80.5].map((value, index) => ({
      id: `round-${index}`,
      name: `Round ${index}`,
      unit: 'U',
      type: 'Продукт',
      metrics: [{code: 'main', name: 'Main', metrics: [metric({code: `round.metric-${index}`, value, max: 100})]}],
    })),
    title: {rows: []},
  };

  assert.deepEqual(deriveTitle(report).rows.map(({score, group}) => ({score, group})), [
    {score: 60, group: 'Развивающиеся'},
    {score: 80, group: 'Зрелые'},
  ]);
});

test('score ignores inapplicable, informational, and explicitly excluded metrics', () => {
  const report = rawReport();
  report.products[0].metrics[0].metrics.push(
    metric({code: 'hidden', value: 100, max: 1, is_applicabble_flg: false}),
    metric({code: 'excluded', value: 100, max: 1, excluded_from_index: true}),
  );
  assert.equal(deriveTitle(report).rows[0].score, 50);
});

test('validation reports structural, numeric, duplicate, and unsafe-link errors', () => {
  const report = preparedReport();
  const broken = structuredClone(report);
  broken.products[1].id = broken.products[0].id;
  broken.products[0].name = ' ';
  broken.products[0].metrics[0].metrics[0].value = 5;
  broken.products[0].metrics[0].metrics[1].code = 'general.score';
  broken.constructor.linkRules = [{operation: 'upsert', url: 'javascript:alert(1)'}];

  const codes = new Set(validateReport(broken).map((error) => error.code));
  assert.ok(codes.has('duplicate'));
  assert.ok(codes.has('required'));
  assert.ok(codes.has('above_maximum'));
  assert.ok(codes.has('unsafe_url'));
  assert.deepEqual(validateReport(report), []);
  const hiddenLink = structuredClone(report);
  hiddenLink.constructor.linkRules = [{
    effect: 'hide',
    placement: {kind: 'ui', key: 'team.idea'},
    scope: {kind: 'all', values: []},
  }];
  assert.deepEqual(validateReport(hiddenLink), []);
  assert.equal(validateReport(null)[0].code, 'invalid_report');
});

test('validation rejects unsafe structured actions and link-rule paths', () => {
  const unsafeAction = structuredClone(preparedReport());
  unsafeAction.products[0].metrics[0].metrics[0].button = {
    label: 'Опасная ссылка',
    link: 'javascript:alert(1)',
  };
  assert.ok(validateReport(unsafeAction).some((error) => (
    error.code === 'unsafe_url' && error.path.endsWith('.button.link')
  )));

  const unsafeRule = structuredClone(preparedReport());
  unsafeRule.constructor.linkRules = [{
    effect: 'hide',
    placement: {
      kind: 'report',
      blockCode: 'general',
      metricCode: 'general.score',
      path: ['__proto__'],
      urlField: 'url',
    },
    scope: {kind: 'all', values: []},
  }];
  assert.ok(validateReport(unsafeRule).some((error) => error.code === 'invalid_link_placement'));
});

test('team update is immutable, trims fields, and keeps the stable product id in title', () => {
  const report = preparedReport();
  const untouchedProduct = report.products[1];
  const next = updateTeam(report, 'product-1', {name: '  Новая Альфа ', unit: ' U3 ', tribe: null});

  assert.notStrictEqual(next, report);
  assert.notStrictEqual(next.products, report.products);
  assert.notStrictEqual(next.products[0], report.products[0]);
  assert.strictEqual(next.products[1], untouchedProduct);
  assert.equal(next.products[0].id, 'product-1');
  assert.equal(next.products[0].name, 'Новая Альфа');
  assert.equal(next.products[0].unit, 'U3');
  assert.equal(next.products[0].tribe, '');
  assert.equal(next.products[0].unknown_product, 'keep me');
  assert.equal(next.title.rows[0].product_id, 'product-1');
  assert.equal(next.title.rows[0].id, 'legacy-1');
  assert.equal(next.title.rows[0].custom_row, 'keep');
  assert.equal(next.title.rows[0].name, 'Новая Альфа');
  assert.strictEqual(updateTeam(report, 'missing', {name: 'X'}), report);
  assert.throws(() => updateTeam(report, 'product-1', {type: 'Сегмент'}), /Нельзя изменять/);
  assert.throws(() => updateTeam(report, 'product-1', {name: ' '}), /не может быть пустым/);
});

test('metric value update accepts decimal comma and redistributes recommendations proportionally', () => {
  const report = preparedReport();
  const untouchedProduct = report.products[1];
  const next = updateMetricValues(report, 'product-1', 'general.score', {value: '4,0', max_value: '8'});
  const updated = next.products[0].metrics[0].metrics[0];

  assert.equal(updated.value, 4);
  assert.equal(updated.max_value, 8);
  assert.equal(updated.traffic_light, 'yellow');
  assert.deepEqual(updated.recommendation_items.map(({value, max_value, gap, unknown}) => ({value, max_value, gap, unknown})), [
    {value: 1, max_value: 2, gap: 1, unknown: 'a'},
    {value: 3, max_value: 6, gap: 3, unknown: 'b'},
  ]);
  assert.equal(updated.unknown_metric.keep, true);
  assert.strictEqual(next.products[1], untouchedProduct);
  assert.equal(next.title.rows.find((row) => row.product_id === 'product-1').score, 50);

  const completed = updateMetricValues(next, 'product-1', 'general.score', {value: 8});
  assert.equal(completed.products[0].metrics[0].metrics[0].traffic_light, 'green');
  assert.equal(completed.title.rows[0].score, 100);
  assert.equal(completed.title.rows[0].group, 'Лидеры');
  assert.throws(
    () => updateMetricValues(report, 'product-1', 'general.score', {value: 5, max_value: 4}),
    /не может превышать/,
  );
  assert.throws(() => updateMetricValues(report, 'product-1', 'general.score', {value: 'not-a-number'}), /числом/);

  const informational = updateMetricValues(report, 'product-1', 'general.info', {value: 5, max_value: 1});
  assert.equal(informational.products[0].metrics[0].metrics[1].value, 5);
  assert.equal(informational.products[0].metrics[0].metrics[1].traffic_light, 'yellow');
});

test('scope resolution preserves report order and supports teams, types, and all', () => {
  const report = preparedReport();
  assert.deepEqual(scopeProductIds(report, allScope), ['product-1', 'product-2']);
  assert.deepEqual(scopeProductIds(report, teamScope('product-2', 'missing', 'product-1')), ['product-1', 'product-2']);
  assert.deepEqual(scopeProductIds(report, typeScope('продукт')), ['product-1']);
  assert.deepEqual(scopeProductIds(report, typeScope('КАНАЛ')), ['product-2']);
  assert.throws(() => scopeProductIds(report, {kind: 'units', values: []}), /Неподдерживаемый scope/);
});

test('metric definitions apply only to compatible products in scope and clone patch data', () => {
  const report = preparedReport();
  const button = {label: 'Открыть', link: 'https://example.test'};
  const next = applyMetricDefinition(
    report,
    'general.score',
    {name: ' Новый score ', footer: 'Новый footer', button},
    typeScope('Продукт'),
  );
  const first = next.products[0].metrics[0].metrics[0];
  const second = next.products[1].metrics[0].metrics[0];

  assert.equal(first.name, 'Новый score');
  assert.equal(first.footer, 'Новый footer');
  assert.deepEqual(first.button, button);
  assert.equal(second.name, 'Score');
  assert.strictEqual(next.products[1], report.products[1]);
  button.label = 'mutated later';
  assert.equal(first.button.label, 'Открыть');
  assert.throws(() => applyMetricDefinition(report, 'general.score', {dd_calculation_flg: 0}, allScope), /Нельзя/);
  assert.strictEqual(applyMetricDefinition(report, 'missing', {name: 'X'}, allScope), report);
});

test('block CRUD uses one stable generated code and deletes only empty compatible blocks', () => {
  const report = preparedReport();
  const added = addBlock(report, {name: ' Пользовательский блок ', scope: allScope});
  const code = added.products[0].metrics.at(-1).code;

  assert.equal(code, 'constructor-block-1');
  assert.equal(added.products[1].metrics.at(-1).code, code);
  assert.equal(added.products[0].metrics.at(-1).name, 'Пользовательский блок');
  assert.deepEqual(added.products[0].metrics.at(-1).metrics, []);

  const renamed = renameBlock(added, {blockCode: code, name: 'Переименован', scope: teamScope('product-1')});
  assert.equal(renamed.products[0].metrics.at(-1).name, 'Переименован');
  assert.equal(renamed.products[1].metrics.at(-1).name, 'Пользовательский блок');

  const mixed = structuredClone(renamed);
  mixed.products[1].metrics.at(-1).metrics.push(metric({code: 'custom.metric'}));
  const deleted = deleteEmptyBlock(mixed, {blockCode: code, scope: allScope});
  assert.equal(deleted.products[0].metrics.some((block) => block.code === code), false);
  assert.equal(deleted.products[1].metrics.some((block) => block.code === code), true);
  assert.throws(() => addBlock(report, {name: ' ', scope: allScope}), /не может быть пустым/);
});

test('blocks reorder only when both blocks exist in the selected product', () => {
  const report = preparedReport();
  const next = reorderBlock(report, {
    blockCode: 'general',
    targetBlockCode: 'target',
    position: 'after',
    scope: teamScope('product-1'),
  });

  assert.deepEqual(next.products[0].metrics.map((block) => block.code), ['target', 'general', 'empty']);
  assert.strictEqual(next.products[1], report.products[1]);
  assert.strictEqual(reorderBlock(report, {
    blockCode: 'general',
    targetBlockCode: 'general',
    position: 'before',
    scope: allScope,
  }), report);
  assert.throws(() => reorderBlock(report, {
    blockCode: 'general', targetBlockCode: 'target', position: 'middle', scope: allScope,
  }), /before или after/);
});

test('metrics move across and within blocks without loss and synchronize one-based sort', () => {
  const report = preparedReport();
  const moved = moveMetric(report, {
    metricCode: 'general.score',
    sourceBlockCode: 'general',
    targetBlockCode: 'target',
    targetIndex: 0,
    scope: teamScope('product-1'),
  });
  const firstProduct = moved.products[0];
  const general = firstProduct.metrics.find((block) => block.code === 'general');
  const target = firstProduct.metrics.find((block) => block.code === 'target');

  assert.deepEqual(general.metrics.map((item) => [item.code, item.sort]), [['general.info', 1]]);
  assert.deepEqual(target.metrics.map((item) => [item.code, item.sort]), [
    ['general.score', 1],
    ['target.excluded', 2],
  ]);
  assert.equal([...general.metrics, ...target.metrics].filter((item) => item.code === 'general.score').length, 1);
  assert.strictEqual(moved.products[1], report.products[1]);

  const reordered = moveMetric(moved, {
    metricCode: 'target.excluded',
    sourceBlockCode: 'target',
    targetBlockCode: 'target',
    targetIndex: 0,
    scope: teamScope('product-1'),
  });
  assert.deepEqual(
    reordered.products[0].metrics.find((block) => block.code === 'target').metrics.map((item) => [item.code, item.sort]),
    [['target.excluded', 1], ['general.score', 2]],
  );
  assert.throws(() => moveMetric(report, {
    metricCode: 'general.score', sourceBlockCode: 'general', targetBlockCode: 'target', targetIndex: -1, scope: allScope,
  }), /неотрицательным/);
});

test('serialization and parsing are repository-ready, atomic, and preserve unknown JSON fields', () => {
  const source = rawReport();
  const parsed = parseReportJson(JSON.stringify(source));
  const serialized = serializeReport(parsed);
  const roundTrip = JSON.parse(serialized);

  assert.ok(serialized.endsWith('\n'));
  assert.equal(roundTrip.unknown_root.keep, true);
  assert.equal(roundTrip.products[0].unknown_product, 'keep me');
  assert.equal(roundTrip.products[0].metrics[0].unknown_block, 1);
  assert.equal(roundTrip.products[0].metrics[0].metrics[0].unknown_metric.keep, true);
  assert.deepEqual(roundTrip.ai_skill_digest, source.ai_skill_digest);
  assert.equal(roundTrip.title.custom_title, 'keep');
  assert.equal(roundTrip.title.rows[0].custom_row, 'keep');
  assert.equal(roundTrip.title.rows[0].product_id, 'product-1');
  assert.equal(roundTrip.constructor.format, 'data-driven-constructor');

  assert.throws(() => parseReportJson('{broken'), SyntaxError);
  const incompatible = preparedReport();
  incompatible.constructor.version = 2;
  assert.throws(() => parseReportJson(JSON.stringify(incompatible)), (error) => {
    assert.equal(error.name, 'ReportValidationError');
    assert.ok(error.validationErrors.some((item) => item.code === 'unsupported_version'));
    return true;
  });
});

test('changed product count ignores title and constructor metadata and counts product changes once', () => {
  const baseline = preparedReport();
  const renamed = updateTeam(baseline, 'product-1', {name: 'Новая Альфа'});
  const both = applyMetricDefinition(baseline, 'general.score', {footer: 'Bulk'}, allScope);
  const metadataOnly = {...baseline, constructor: {...baseline.constructor, savedAt: '2030-01-01T00:00:00.000Z'}};

  assert.equal(changedProductCount(baseline, baseline), 0);
  assert.equal(changedProductCount(baseline, metadataOnly), 0);
  assert.equal(changedProductCount(baseline, renamed), 1);
  assert.equal(changedProductCount(baseline, both), 2);
});
