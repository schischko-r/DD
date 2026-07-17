import assert from 'node:assert/strict';
import test from 'node:test';
import {extractReportLinkCatalog, isAllowedExternalUrl, materializeReportLinks, normalizeLinkScope, resolveStaticLink, upsertLinkRule} from './linkRules.js';

const fixture = () => ({
  products: [
    {id: 'p1', type: 'Продукт', metrics: [{code: 'general', actions: [{label: 'Отчет', url: 'https://old.test'}], metrics: [{code: 'general.m1', button: {label: 'Metric', link: 'https://metric.test'}}]}]},
    {id: 'p2', type: 'Продукт', metrics: [{code: 'general', actions: [{label: 'Отчет', url: 'https://old.test'}], metrics: [{code: 'general.m1', button: {label: 'Metric', link: 'https://metric.test'}}]}]},
    {id: 's1', type: 'Сегмент', metrics: [{code: 'general', actions: [{label: 'Отчет', url: 'https://segment.test'}], metrics: []}]},
  ],
});

test('external link validation allows only supported protocols', () => {
  assert.equal(isAllowedExternalUrl('https://example.test/a'), true);
  assert.equal(isAllowedExternalUrl('http://example.test'), true);
  assert.equal(isAllowedExternalUrl('mailto:test@example.test'), true);
  assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedExternalUrl('#section'), false);
});

test('catalog discovers block and metric links with stable placements', () => {
  const links = extractReportLinkCatalog(fixture(), ['p1']);
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((item) => item.placement.metricCode), ['', 'general.m1']);
  assert.ok(links.every((item) => item.scope.values[0] === 'p1'));
});

test('edited report rule applies by type without mutating source', () => {
  const source = fixture();
  const baseline = extractReportLinkCatalog(source, ['p1'])[0];
  const rule = {...baseline, origin: 'override', edited: true, scope: {kind: 'types', values: ['Продукт']}, label: 'Новый отчет', url: 'https://new.test'};
  const result = materializeReportLinks(source, [rule]);
  assert.equal(source.products[0].metrics[0].actions[0].url, 'https://old.test');
  assert.equal(result.products[0].metrics[0].actions[0].url, 'https://new.test');
  assert.equal(result.products[1].metrics[0].actions[0].url, 'https://new.test');
  assert.equal(result.products[2].metrics[0].actions[0].url, 'https://segment.test');
});

test('report links inherit all → type → team with replace and hide', () => {
  const source = fixture();
  const placement = extractReportLinkCatalog(source, ['p1'])[0].placement;
  const rules = [
    {id: 'all', origin: 'override', edited: true, effect: 'upsert', placement, scope: {kind: 'all', values: []}, label: 'All', url: 'https://all.test'},
    {id: 'type', origin: 'override', edited: true, effect: 'upsert', placement, scope: {kind: 'types', values: ['Продукт']}, label: 'Type', url: 'https://type.test'},
    {id: 'team', origin: 'override', edited: true, effect: 'hide', placement, scope: {kind: 'teams', values: ['p1']}, label: 'Hidden', url: ''},
  ];

  const result = materializeReportLinks(source, rules);
  assert.equal(result.products[0].metrics[0].actions[0].url, '');
  assert.equal(result.products[1].metrics[0].actions[0].url, 'https://type.test');
  assert.equal(result.products[2].metrics[0].actions[0].url, 'https://all.test');
});

test('static link rules honor type and team specificity', () => {
  const rules = [
    {placement: {kind: 'ui', key: 'team.idea'}, scope: {kind: 'all'}, label: 'All', url: 'https://all.test'},
    {placement: {kind: 'ui', key: 'team.idea'}, scope: {kind: 'types', values: ['Продукт']}, label: 'Type', url: 'https://type.test'},
    {placement: {kind: 'ui', key: 'team.idea'}, scope: {kind: 'teams', values: ['p1']}, effect: 'hide'},
  ];
  assert.equal(resolveStaticLink(rules, 'team.idea', {id: 'p2', type: 'Продукт'}).url, 'https://type.test');
  assert.equal(resolveStaticLink(rules, 'team.idea', {id: 'p1', type: 'Продукт'}), null);
});

test('upsert normalizes UI scopes and rejects unsafe URLs', () => {
  const rule = upsertLinkRule([], {placement: {kind: 'ui', key: 'x'}, scope: {mode: 'current'}, label: 'X', url: 'https://x.test'}, 'p1')[0];
  assert.deepEqual(rule.scope, {kind: 'teams', values: ['p1']});
  assert.deepEqual(normalizeLinkScope({mode: 'types', types: ['Канал']}), {kind: 'types', values: ['Канал']});
  assert.throws(() => upsertLinkRule([], {placement: {kind: 'ui', key: 'x'}, label: 'X', url: 'data:text/html,x'}));
});

test('report link traversal rejects prototype paths and never creates missing fields', () => {
  const source = fixture();
  const malicious = [{
    id: 'malicious',
    effect: 'upsert',
    edited: true,
    placement: {
      kind: 'report',
      blockCode: 'main',
      metricCode: 'main.score',
      path: ['__proto__'],
      urlField: 'url',
    },
    scope: {kind: 'all', values: []},
    label: 'X',
    url: 'https://safe.example',
  }];

  const result = materializeReportLinks(source, malicious);
  assert.equal(Object.prototype.url, undefined);
  assert.deepEqual(result, source);

  assert.throws(() => upsertLinkRule([], malicious[0]), /позиция ссылки/);
});

test('report rules update only link fields that already exist', () => {
  const source = {
    products: [{
      id: 'p1',
      type: 'Продукт',
      metrics: [{code: 'general', actions: [{url: 'https://old.test'}], metrics: []}],
    }],
  };
  const rules = [{
    id: 'existing-url-only',
    effect: 'upsert',
    edited: true,
    placement: {
      kind: 'report',
      blockCode: 'general',
      path: ['actions', 0],
      urlField: 'url',
      labelField: 'label',
    },
    scope: {kind: 'all', values: []},
    label: 'Не создавать подпись',
    url: 'https://new.test',
  }];

  const target = materializeReportLinks(source, rules).products[0].metrics[0].actions[0];
  assert.deepEqual(target, {url: 'https://new.test'});
  assert.deepEqual(source.products[0].metrics[0].actions[0], {url: 'https://old.test'});
});
