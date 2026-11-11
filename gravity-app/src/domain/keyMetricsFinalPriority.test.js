import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDdiPeriodProducts} from './quarterProfiles.js';
import {applyKeyMetricsWorkbookPriority} from './keyMetricsWorkbookPriority.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const period = 'III кв. 2026';
const metrics = (product) => product.metrics.flatMap((block) => block.metrics);
const satelliteApproval = 'satellites-navigator-selected-12-2026-11-11';
const satelliteOverrideIdentities = new Map([
  ['16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО', ['ОСАГО', 'УБ', true]],
  ['11a243e6-5b73-56ad-8ac7-203e0d744062¦Оплата улыбкой', ['Оплата улыбкой', 'DB', false]],
  ['9721f391-d1a5-57d5-beb1-e0eaccbf0ed1¦Трансграничные переводы', ['Трансграничные переводы', 'DB', false]],
  ['723125c3-303d-5d2e-adc3-18460f242f63¦СберПрайм', ['СберПрайм', 'CX', false]],
  ['5b3c81af-8ad4-5fcd-84c0-729f3f44093f¦СберЧаевые', ['СберЧаевые', 'DB', false]],
  ['8cba2f54-2829-5599-9ee7-d1f288bb1f03¦ВЗР', ['ВЗР', 'УБ', false]],
  ['aa80593f-3f07-5935-96b3-2e367d6a78f4¦Платежи', ['Платежи', 'DB', false]],
  ['afe119a5-a944-5e11-90f9-e3facbd32e5c¦Кредитные карты', ['Кредитные карты', 'DB', false]],
  ['75028b72-7f89-55c1-a309-8c5b4193250a¦Трансграничный эквайринг', ['Трансграничный эквайринг', 'DB', false]],
  ['4bf2be31-ba6b-5ee2-b60d-bf62932ea0ce¦Переводы по РФ', ['Переводы по РФ', 'DB', false]],
  ['89b13e92-db89-516e-823f-1d102242bdc9¦КАСКО', ['КАСКО', 'УБ', true]],
  ['715a3090-94df-5954-b638-bb36c1ae24ae¦Личная защита Плюс', ['Личная защита Плюс', 'УБ', true]],
]);

test('workbook resolver preserves scope, identity and applicability while scaling fractional fallback', () => {
  const code = 'general.mau_produkta';
  const metric = {code, value: 0.25, max_value: 0.5, is_applicabble_flg: true};
  const prior = {id: 'team', name: 'Team', unit: 'Data', type: 'Канал', period: 'II кв. 2026',
    metrics: [{code: 'general', metrics: [metric]}]};
  const current = {...prior, id: `team::empty::${period}`, period,
    metrics: [{code: 'general', metrics: [{...metric, value: 1, max_value: 1,
      recommendation_items: [{value: 1, max_value: 1, gap: 0}]}]},
    {code: 'other', metrics: [{...metric, value: 0.1}]}]};
  const workbook = {period, scope: 'key-metrics-assessment',
    source: {file: 'Ключевые метрики Продукта Баллы.xlsx', metricCodes: [code]}, products: [], pending: []};
  const resolve = (batch = workbook, product = current) => applyKeyMetricsWorkbookPriority([product], period, [batch], [prior])[0];
  const carried = resolve();
  assert.equal(carried.metrics[0].metrics[0].value, 0.5, 'Q2 ratio scales by current rubric maximum');
  assert.deepEqual(carried.metrics[0].metrics[0].recommendation_items, [{value: 0.5, max_value: 1, gap: 0.5}]);
  assert.equal(carried.metrics[1], current.metrics[1], 'a matching code outside general is unchanged');
  const fact = {id: prior.id, name: prior.name, unit: prior.unit, type: prior.type,
    metrics: {[code]: {rawValue: 0, source: {origin: 'keyMetricsWorkbookAssessment'}}}};
  assert.equal(resolve({...workbook, products: [fact]}).metrics[0].metrics[0].value, 0, 'explicit zero overrides half-score fallback');
  assert.equal(applyKeyMetricsWorkbookPriority([current], period, [{...workbook, products: [fact]}], [])[0].metrics[0].metrics[0].value, 0, 'explicit scores apply to new teams without a Q2 baseline');
  assert.equal(applyKeyMetricsWorkbookPriority([current], period, [{...workbook, pending: [{...fact, metricCode: code, sourceRows: [2]}]}], [])[0].metrics[0].metrics[0].value, null, 'present unresolved new team pair remains unavailable');
  assert.equal(resolve({...workbook, products: [fact], pending: [{...fact, metricCode: code, sourceRows: [2]}]}).metrics[0].metrics[0].value, null, 'unresolved present pair cannot carry');
  assert.equal(resolve(workbook, {...current, unit: 'Other'}).metrics, current.metrics, 'a different team identity is untouched');
  const na = {...current, metrics: [{code: 'general', metrics: [{...metric, value: null, is_applicabble_flg: false}]}]};
  assert.equal(resolve(workbook, na).metrics[0].metrics[0], na.metrics[0].metrics[0]);
  assert.equal(applyKeyMetricsWorkbookPriority([prior], prior.period, [workbook], [prior])[0], prior);
});

test('final Q3 pipeline uses workbook scores including zeros, carries missing Q2 pairs and preserves Q2', () => {
  const source = read('../../public/report-data.json').products;
  const snapshot = JSON.stringify(source);
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)]
    .map((match) => [match[1], match[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
    .map((key) => read(`../data/${imports.get(key.trim())}`));
  const salary = read('../data/salary-products-q3-2026.json');
  const reporting = read('../data/reporting-regularity-missing-q3-2026.json');
  const actions = read('../data/funnel-action-missing-q3-2026.json');
  const build = (selectedPeriod) => buildDdiPeriodProducts(source, selectedPeriod, overlays, salary, reporting, actions);
  const workbook = overlays.find((batch) => batch.scope === 'key-metrics-assessment');
  const directKnowledge = read('../data/knowledge-user-assessments-q3-2026.json').products
    .find((product) => product.name === 'Сделка вторичка').metrics['general.navigator_reporting_knowledge'];
  assert.equal(directKnowledge.rawValue, 1);
  const codes = new Set(workbook.source.metricCodes);
  // The independently extracted workbook rows retain text and conflicting duplicates.
  const cells = new Map();
  for (const row of read('../../../outputs/key-metrics-q3-2026/key-metrics-mapping.json').sourceRows) {
    if (!row.teamId || !row.metricCode) continue;
    const key = `${row.teamId}::${row.metricCode}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(row.rawValue);
  }
  const final = build(period);
  const counts = {explicit: 0, zero: 0, blocked: 0, carry: 0, carryZero: 0, carryFraction: 0};
  const teamTypes = new Set();
  for (const product of final) {
    const originalId = String(product.id).replace(/::empty::.*/, '');
    const baseline = source.find((old) => old.id === originalId && old.period === 'II кв. 2026'
      && ['name', 'unit', 'type'].every((key) => old[key] === product[key]));
    if (!baseline) continue;
    teamTypes.add(product.type);
    for (const metric of product.metrics.filter((block) => block.code === 'general').flatMap((block) => block.metrics)) {
      const approved = overlays.find(batch => batch.scope === 'q3-score-correction')?.products
        .find(team => team.id === originalId && ['name', 'unit', 'type'].every(key => team[key] === product[key]))
        ?.metrics[metric.code];
      if (approved?.source?.approvalGroup === satelliteApproval) {
        const identity = satelliteOverrideIdentities.get(originalId);
        assert.ok(identity, 'Only the twelve literal user-selected product identities are exempt');
        assert.equal(product.name, identity[0]); assert.equal(product.unit, identity[1]);
        assert.equal(product.type, 'Продукт');
        assert.ok(metric.code === 'general.znanie_produktov_sputnikov'
          || (identity[2] && metric.code === 'general.navigator_reporting_knowledge'));
        assert.equal(approved.rawValue, 1);
        for (const proof of [approved.source, approved.source.correction]) {
          assert.equal(proof.approvalGroup, satelliteApproval);
          assert.equal(proof.origin, 'userConfirmedQ3ScoreCorrection');
          assert.equal(proof.confirmedBy, 'user'); assert.equal(proof.period, period);
          assert.equal(proof.date, '2026-11-11');
        }
        assert.equal(approved.source.correction.rawValue, 1);
        assert.equal(metric.value, metric.max_value);
        assert.equal(metric.source.approvalGroup, satelliteApproval);
        continue;
      }
      if (approved?.source?.approvalGroup === 'segment-channel-key-metrics-2026-11-11'
        && approved.source.correction?.approvalGroup === 'segment-channel-key-metrics-2026-11-11') {
        assert.ok(['Канал', 'Сегмент'].includes(product.type));
        assert.equal(approved.rawValue, 1);
        assert.equal(approved.source.origin, 'userConfirmedQ3ScoreCorrection');
        assert.equal(approved.source.confirmedBy, 'user');
        assert.equal(approved.source.period, period);
        assert.equal(approved.source.date, '2026-11-11');
        assert.equal(metric.value, metric.max_value, 'only explicitly approved knowledge pairs override workbook values');
        assert.equal(metric.source.approvalGroup, approved.source.approvalGroup);
        continue;
      }
      if (originalId === '4a1bd6b8-c295-50fd-b4c6-14d4873c6bb0¦Единый личный кабинет (ЕЛК)'
        && product.name === 'Единый личный кабинет (ЕЛК)' && product.unit === 'Data' && product.type === 'Канал'
        && metric.code === 'general.mau_u_vashego_kanala') {
        assert.equal(metric.value, metric.max_value, 'latest explicit ELK MAU score overrides workbook fallback');
        assert.equal(metric.source.origin, 'userConfirmedQ3ScoreCorrection');
        assert.equal(metric.source.date, '2026-11-11');
        assert.equal(metric.source.correction.rawValue, 1);
        continue;
      }
      if (product.name === 'Сделка вторичка' && metric.code === 'general.navigator_reporting_knowledge') {
        assert.equal(metric.value, metric.max_value, 'explicit direct Navigator score overrides workbook carry-forward');
        assert.equal(metric.source.origin, 'userConfirmedDirectNavigatorAssessment');
        continue;
      }
      if (!codes.has(metric.code) || metric.is_applicabble_flg === false || metric.max_value <= 0) continue;
      const laterCbp = overlays.find(item => item.scope === 'cbp-user-corrections')?.products
        .find(team => team.id === originalId && team.name === product.name && team.unit === product.unit)?.metrics[metric.code];
      if (laterCbp && Number.isFinite(laterCbp.rawValue)) {
        assert.equal(metric.value, laterCbp.rawValue * metric.max_value, 'later explicit CBP correction remains authoritative');
        continue;
      }
      if (product.name === 'Интернет-Эквайринг'
        && ['general.klienty_s_produktom', 'general.mau_produkta'].includes(metric.code)) {
        assert.equal(metric.value, metric.max_value, `${product.name}: ${metric.code} user correction`);
        assert.equal(metric.source.origin, 'userConfirmedQ3ScoreCorrection');
        continue;
      }
      if (product.name === 'ДСЖ ПК' && metric.code === 'general.navigator_reporting_knowledge') {
        assert.equal(metric.value, metric.max_value, 'DSZh PK uses current knowledge instead of Q2 fallback');
        assert.equal(metric.source.origin, 'userConfirmedNavigatorKnowledgeHierarchy');
        continue;
      }
      if (['БПИФ', 'ЦФА'].includes(product.name) && ['general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere'].includes(metric.code)) {
        assert.equal(metric.value, product.name === 'БПИФ' ? metric.max_value : 0);
        assert.equal(metric.source.origin, 'userConfirmedMarketHoleRecovery20261102');
        continue;
      }
      const old = metrics(baseline).find((item) => item.code === metric.code);
      assert.ok(old, `${product.name}: ${metric.code}`);
      const values = cells.get(`${baseline.id}::${metric.code}`);
      let expected;
      if (values) {
        const numeric = values.every((value) => value === 0 || value === 1) && new Set(values).size === 1;
        expected = numeric ? values[0] * metric.max_value : null;
        counts[numeric ? 'explicit' : 'blocked']++;
        if (numeric && values[0] === 0) counts.zero++;
      } else if (old.is_applicabble_flg !== false && old.max_value > 0 && Number.isFinite(old.value)
        && old.value >= 0 && old.value <= old.max_value) {
        if (product.salaryCohorts) {
          const cohortValues = Object.values(product.salaryCohorts).map((cohort) => metrics(cohort).find((item) => item.code === metric.code)?.value);
          expected = cohortValues.length === 2 && cohortValues.every(Number.isFinite) ? (cohortValues[0] + cohortValues[1]) / 2 : null;
          assert.equal(metric.value, expected, `salary absent pair averages cohort scores: ${metric.code}`);
          continue;
        }
        expected = old.value / old.max_value * metric.max_value;
        counts.carry++;
        if (old.value === 0) counts.carryZero++;
        if (old.value > 0 && old.value < old.max_value) counts.carryFraction++;
      } else continue;
      assert.equal(metric.value, expected, `${product.name}: ${metric.code}`);
      assert.equal(metric.max_value, old.max_value, `${product.name}: weight`);
      assert.equal(metric.is_applicabble_flg, old.is_applicabble_flg, `${product.name}: applicability`);
    }
  }
  for (const [kind, count] of Object.entries(counts)) assert.ok(count > 0, `${kind}: coverage`);
  assert.deepEqual([...teamTypes].sort(), ['Канал', 'Продукт', 'Сегмент'].sort());
  const mail = final.find((product) => product.name === 'Почта, Диск, Календарь');
  for (const code of ['general.klienty_s_produktom', 'general.mau_produkta', 'general.dau_produkta', 'general.dau_mau', 'general.yau_produkta']) {
    assert.equal(metrics(mail).find((metric) => metric.code === code).value, 0, code);
  }
  const salaryProduct = final.find((product) => product.salaryCohorts);
  assert.ok(salaryProduct);
  const b2b = salaryProduct.salaryCohorts.b2b;
  for (const [code, raw] of [['general.klienty_s_produktom', 1], ['general.mau_produkta', 0]]) {
    const metric = metrics(b2b).find((item) => item.code === code);
    assert.equal(metric.value, raw * metric.max_value, `salary B2B explicit workbook: ${code}`);
    assert.equal(metric.source.origin, 'keyMetricsWorkbookAssessment');
  }
  assert.deepEqual(build('II кв. 2026'), source);
  assert.equal(JSON.stringify(source), snapshot, 'source data is immutable');
});

test('latest ELK MAU confirmation survives the full Q3 pipeline and changes only its own metric', () => {
  const id = '4a1bd6b8-c295-50fd-b4c6-14d4873c6bb0¦Единый личный кабинет (ЕЛК)';
  const code = 'general.mau_u_vashego_kanala';
  const source = read('../../public/report-data.json').products;
  const sourceSnapshot = structuredClone(source);
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)]
    .map(match => [match[1], match[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',')
    .map(key => read(`../data/${imports.get(key.trim())}`));
  const corrections = overlays.find(batch => batch.scope === 'q3-score-correction');
  const record = corrections.products.find(product => product.id === id);
  assert.equal(record.name, 'Единый личный кабинет (ЕЛК)');
  assert.equal(record.unit, 'Data');
  assert.equal(record.type, 'Канал');
  assert.equal(record.metrics[code].rawValue, 1);
  assert.equal(record.metrics[code].source.date, '2026-11-11');
  const withoutLatest = structuredClone(overlays);
  delete withoutLatest.find(batch => batch.scope === 'q3-score-correction')
    .products.find(product => product.id === id).metrics[code];
  const args = [read('../data/salary-products-q3-2026.json'),
    read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json')];
  for (const backlog of [null, read('../../public/backlog-data.json')]) {
    const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(source, selectedPeriod, facts, ...args, backlog);
    const before = build(withoutLatest);
    const after = build(overlays);
    assert.equal(after.length, before.length);
    let corrected = 0;
    for (let index = 0; index < after.length; index++) {
      const product = after[index];
      const prior = before[index];
      if (String(product.id).replace(/::empty::.*/, '') !== id) {
        assert.deepEqual(product, prior, `Unrelated team: ${product.name}`);
        continue;
      }
      const {metrics: currentBlocks, ...identity} = product;
      const {metrics: priorBlocks, ...priorIdentity} = prior;
      assert.deepEqual(identity, priorIdentity, 'Team identity and the index denominator are unchanged');
      for (const metric of currentBlocks.flatMap(block => block.metrics)) {
        const old = priorBlocks.flatMap(block => block.metrics).find(item => item.code === metric.code);
        if (metric.code !== code) {
          assert.deepEqual(metric, old, `Unrelated ELK metric: ${metric.code}`);
          continue;
        }
        corrected++;
        assert.equal(old.value, 0, 'The final workbook fallback previously replaced the October confirmation');
        assert.equal(old.source.origin, 'keyMetricsPreviousQuarterFallback');
        assert.equal(metric.value, metric.max_value);
        assert.equal(metric.value, 0.2, 'Use the existing metric weight');
        assert.equal(metric.source.origin, 'userConfirmedQ3ScoreCorrection');
        assert.equal(metric.source.date, '2026-11-11');
        for (const field of ['max_value', 'is_applicabble_flg', 'excluded_from_index', 'dd_calculation_flg',
          'previousValue', 'previousMaxValue', 'previousPeriod']) assert.equal(metric[field], old[field], field);
        for (const item of metric.recommendation_items || []) {
          assert.equal(item.value, metric.value);
          assert.equal(item.max_value, metric.max_value);
          assert.equal(item.gap, 0);
        }
      }
    }
    assert.equal(corrected, 1, 'Only the requested ELK MAU metric changes');
    assert.deepEqual(build(overlays, 'II кв. 2026'), build(withoutLatest, 'II кв. 2026'));
    assert.deepEqual(build(overlays, 'II кв. 2026'), sourceSnapshot, 'Q2 source values remain intact');
  }
  assert.deepEqual(source, sourceSnapshot, 'The runtime pipeline does not mutate source data');
});

test('market hole recovery changes exactly four scores, preserving every other team, metric, weight and Q2', () => {
  const source = read('../../public/report-data.json').products;
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
  const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(k => read(`../data/${imports.get(k.trim())}`));
  const withoutRecovery = structuredClone(overlays);
  for (const batch of withoutRecovery) for (const item of batch.pending || []) delete item.restoredAssessment;
  const build = (facts, selectedPeriod = period) => buildDdiPeriodProducts(source, selectedPeriod, facts,
    read('../data/salary-products-q3-2026.json'), read('../data/reporting-regularity-missing-q3-2026.json'), read('../data/funnel-action-missing-q3-2026.json'));
  const before = build(withoutRecovery), after = build(overlays);
  let changes = 0;
  for (let i = 0; i < after.length; i++) {
    const p = after[i], old = before[i];
    for (const m of metrics(p)) {
      const prior = metrics(old).find(item => item.code === m.code);
      if (p.unit === 'УБ' && ['БПИФ', 'ЦФА'].includes(p.name) && ['general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere'].includes(m.code)) {
        changes++;
        assert.equal(prior.value, null);
        assert.equal(m.value, p.name === 'БПИФ' ? m.max_value : 0);
        for (const key of ['max_value', 'is_applicabble_flg', 'excluded_from_index', 'dd_calculation_flg']) assert.equal(m[key], prior[key]);
      } else assert.deepEqual(m, prior, `${p.name}: ${m.code}`);
    }
    assert.equal(p.indexMaxPoints, old.indexMaxPoints);
  }
  assert.equal(changes, 4);
  assert.deepEqual(build(overlays, 'II кв. 2026'), source);
});

test('DSZh PK derives Navigator after key metrics, preserving explicit Excel scores and other teams', () => {
  const code = 'general.navigator_reporting_knowledge';
  const id = 'e8c97fe4-bd38-5aa1-9388-5c532cbde6f2¦ДСЖ ПК';
  const base = {id, name: 'ДСЖ ПК', unit: 'УБ', type: 'Продукт', period: 'II кв. 2026', metrics: [{code: 'general', metrics: [
    ...['general.mau_produkta', 'general.obъem_celevogo_rynka_v_rossii', 'general.znanie_produktov_sputnikov'].map(code => ({code, value: .2, max_value: .2, is_applicabble_flg: true})),
    {code, value: .25, max_value: .5, is_applicabble_flg: true, recommendation_items: [{value: .25, max_value: .5, gap: .25}]},
  ]}]};
  const current = {...base, id: `${id}::empty::${period}`, period};
  const workbook = {period, scope: 'key-metrics-assessment', source: {file: 'Ключевые метрики Продукта Баллы.xlsx', metricCodes: [code]}, products: [], pending: []};
  const run = (batch = workbook, p = current) => applyKeyMetricsWorkbookPriority([p], period, [batch], [base])[0];
  const result = run();
  assert.equal(metrics(result).at(-1).value, .5);
  assert.equal(metrics(result).at(-1).source.origin, 'userConfirmedNavigatorKnowledgeHierarchy');
  assert.deepEqual(metrics(result).slice(0, -1), metrics(current).slice(0, -1));
  assert.deepEqual(metrics(result).at(-1).recommendation_items, [{value: .5, max_value: .5, gap: 0}]);
  for (const rawValue of [0, 1]) {
    const explicit = {...workbook, products: [{...base, metrics: {[code]: {rawValue, source: {origin: 'keyMetricsWorkbookAssessment'}}}}]};
    assert.equal(metrics(run(explicit)).at(-1).value, rawValue * .5);
  }
  const pending = {...workbook, pending: [{...base, metricCode: code, sourceRows: [1]}]};
  assert.equal(metrics(run(pending)).at(-1).value, null, 'an explicit unresolved row is not replaced by the rule');
  const otherBase = {...base, id: 'other', name: 'Other'};
  const other = {...current, id: 'other::empty::' + period, name: 'Other'};
  assert.equal(metrics(applyKeyMetricsWorkbookPriority([other], period, [workbook], [otherBase])[0]).at(-1).value, .25);
  assert.deepEqual(applyKeyMetricsWorkbookPriority([base], 'II кв. 2026', [workbook], [base]), [base]);
});
