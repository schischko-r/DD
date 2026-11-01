import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildTeamProfileProducts} from '../src/domain/teamProfileSelection.js';
import {excludeRemovedTeams, isDdIndexMetric} from '../src/domain/report.js';
import {buildDdiPeriodProducts, Q3_DB_TEAMS} from '../src/domain/quarterProfiles.js';
import {navigatorKnowledgeFraction, isInvestKopilkaNavigatorOverride, isDirectNavigatorOverride} from '../src/domain/navigatorKnowledge.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.env.DDI_REPORT_DATA_PATH || path.join(root, 'public/report-data.json');
const source = excludeRemovedTeams(JSON.parse(fs.readFileSync(input, 'utf8')));
const app = fs.readFileSync(path.join(root, 'src/app/App.jsx'), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((m) => [m[1], m[2]]));
const overlayList = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/);
if (!overlayList) throw new Error('Q3 overlays are not connected to App.jsx');
const overlays = overlayList[1].split(',').map((key) => {
  const name = imports.get(key.trim());
  if (!name) throw new Error(`Cannot resolve Q3 assessment: ${key.trim()}`);
  return {name, data: JSON.parse(fs.readFileSync(path.join(root, 'src/data', name), 'utf8'))};
});
const required = ['smile-attract-analysis-q3-2026.json', 'smile-markets-zero-q3-2026.json', 'working-age-fot-knowledge-q3-2026.json', 'monthly-excel-reporting-q3-2026.json', 'data-quality-survey-q3-2026.json', 'iszh-funnel-completeness-q3-2026.json', 'nszh-funnel-completeness-q3-2026.json', 'ab-tests-insurance-visibility-q3-2026.json', 'cfa-attract-completeness-q3-2026.json', 'cfa-attract-benchmarks-q3-2026.json', 'corporate-churn-completeness-q3-2026.json', 'campaigning-data-quality-q3-2026.json', 'campaigning-alerts-q3-2026.json', 'campaigning-performance-q3-2026.json', 'campaigning-quarter-retention-q3-2026.json', 'po-goals-survey-assessments-q3-2026.json', 'po-goals-template-q3-2026.json', 'goals-informational-q3-2026.json', 'goals-tribe-assessments-q3-2026.json', 'goals-tribe-applicability-q3-2026.json', 'corporate-flexible-conditions-applicability-q3-2026.json', 'domclick-self-service-q3-2026.json', 'cx-score-metrics-q3-2026.json', 'crosssell-after-purchase-scores-q3-2026.json',
  'research-metrics-q3-2026.json', 'selected-metrics-carry-forward-q3-2026.json', 'ux-score-metrics-q3-2026.json',
  'campaign-missing-zero-q3-2026.json', 'campaign-user-assessments-q3-2026.json', 'user-metric-assessments-q3-2026.json',
  'funnel-user-assessments-q3-2026.json', 'metric-applicability-q3-2026.json', 'mechanics-user-assessments-q3-2026.json',
  'alerts-carry-forward-q3-2026.json', 'discovery-metrics-q3-2026.json', 'regularity-user-assessments-q3-2026.json',
  'navigator-market-knowledge-q3-2026.json', 'goals-user-carry-forward-q3-2026.json',
  'funnel-additional-user-assessments-q3-2026.json', 'knowledge-user-assessments-q3-2026.json', 'chat-entry-actions-q3-2026.json', 'ab-tests-user-assessments-q3-2026.json'];
for (const name of required) {
  if (!overlays.some((overlay) => overlay.name === name)) throw new Error(`Manual assessment is disconnected: ${name}`);
}
if (!overlays.some(({name}) => name === 'reporting-absence-user-q3-2026.json')) {
  throw new Error('Reporting absence rule is disconnected from App.jsx');
}
const products = buildTeamProfileProducts(source.products, 'III кв. 2026', overlays.map((item) => item.data));
const factKey = (team, code) => JSON.stringify([team.id, team.name, team.unit, team.type, code]);
// An explicit assessment supersedes the historical carry-forward value, which remains in its source file.
const explicitFunnelFacts = new Set(overlays.filter(({data}) => data.scope === 'funnel-user-assessment'
  && data.period === 'III кв. 2026').flatMap(({data}) => (data.products || []).flatMap((team) =>
  Object.entries(team.metrics || {}).filter(([, fact]) => [0, 0.5, 1].includes(fact.rawValue))
    .map(([code]) => factKey(team, code)))));
const explicitMechanicsFacts = new Set(overlays.filter(({data}) => data.scope === 'mechanics-user-assessment'
  && data.period === 'III кв. 2026').flatMap(({data}) => (data.products || []).flatMap((team) =>
  Object.entries(team.metrics || {}).filter(([, fact]) => [0, 0.5, 1].includes(fact.rawValue))
    .map(([code]) => factKey(team, code)))));
const explicitRegularityFacts = new Set(overlays.filter(({data}) => data.scope === 'regularity-user-assessment'
  && data.period === 'III кв. 2026').flatMap(({data}) => (data.products || []).flatMap((team) =>
    Object.entries(team.metrics || {}).filter(([, fact]) => [0, 0.5, 1].includes(fact.rawValue))
      .map(([code]) => factKey(team, code)))));
const explicitAlertFacts = new Set(overlays.filter(({data}) => data.scope === 'user-metric-assessment'
  && data.period === 'III кв. 2026').flatMap(({data}) => (data.products || []).flatMap((team) =>
  Object.entries(team.metrics || {}).filter(([code, fact]) => code.startsWith('alerts.') && [0, 0.5, 1].includes(fact.rawValue))
    .map(([code]) => factKey(team, code)))));
const explicitCampaignFacts = new Set(overlays.filter(({data}) => data.scope === 'campaign-user-assessment'
  && data.period === 'III кв. 2026').flatMap(({data}) => (data.products || []).flatMap((team) =>
  Object.entries(team.metrics || {}).filter(([, fact]) => [0, 0.5, 1].includes(fact.rawValue))
    .map(([code]) => factKey(team, code)))));
const goalsTribeFacts = new Map(overlays.filter(({data}) => data.source?.origin === 'userConfirmedGoalsTribeTable')
  .flatMap(({data}) => (data.products || []).flatMap((team) =>
    Object.entries(team.metrics || {}).map(([code, fact]) => [factKey(team, code), fact]))));
const errors = [];
const latestCorrectionFacts = new Map(overlays.filter(({data}) =>
  data.period === 'III кв. 2026' && ['userConfirmedAutoAttractCorrection20261031',
    'userConfirmedInsuranceFunnelBatch20261031', 'userConfirmedDirectNavigatorAssessment'].includes(data.source?.origin))
  .flatMap(({data}) => (data.products || []).flatMap((team) =>
    Object.entries(team.metrics || {}).map(([code, fact]) => [factKey(team, code), fact]))));
const navigatorZeroMarketFacts = new Map(overlays.filter(({data}) => data.scope === 'key-metrics-assessment'
  && data.period === 'III кв. 2026').flatMap(({data}) => (data.products || []).flatMap((team) =>
  Object.entries(team.metrics || {}).filter(([code, fact]) => code === 'general.navigator_reporting_knowledge'
    && fact.rawValue === 0 && fact.source?.origin === 'userConfirmedNavigatorZeroMarketsRule'
    && fact.source?.confirmedBy === 'user').map(([code, fact]) => [factKey(team, code), fact]))));
const maximumSurveyFacts = new Map(overlays.flatMap(({data}) => (data.products || []).flatMap((team) =>
  Object.entries(team.metrics || {}).filter(([code, fact]) => (['userMaximumSurveyAssessment', 'userConfirmedAlertsBenchmarksBatch'].includes(fact.source?.origin)
    || (code === 'general.navigator_reporting_knowledge' && fact.rawValue === 0.5
      && team.id === '181a8be0-a6c1-5590-819c-b49ae1c80081¦ИнвестКопилка'
      && fact.source?.origin === 'userConfirmedInvestKopilkaNavigator20261030')
    || (code === 'churn.report_completeness' && fact.rawValue === 0
      && team.id === '7fdb5658-795c-54e1-bc4a-0de761a9f33f¦Вклады+НС'
      && fact.source?.origin === 'userConfirmedDepositsChurnCompleteness20261030')
    || (['mehaniki.doprodazhi_up_sell', 'mehaniki.vozvrat_klientov'].includes(code) && fact.rawValue === 0
      && team.id === 'aa80593f-3f07-5935-96b3-2e367d6a78f4¦Платежи'
      && fact.source?.origin === 'userConfirmedPaymentsMechanics20261030')
    || (fact.source?.origin === 'userConfirmedSmileMarketsZero20261030'
      && team.id === '11a243e6-5b73-56ad-8ac7-203e0d744062¦Оплата улыбкой'
      && team.name === 'Оплата улыбкой' && team.unit === 'DB' && team.type === 'Продукт'
      && ['general.mau_produkta', 'general.klienty_s_produktom', 'general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere'].includes(code)
      && fact.rawValue === 0)
    || (fact.source?.origin === 'userConfirmedQuarterRetention' && fact.source?.policy === 'fullProductKnowledge'
      && ['general.klienty_s_produktom', 'general.mau_produkta'].includes(code) && fact.rawValue === 1))
    && fact.source?.confirmedBy === 'user').map(([code, fact]) => [factKey(team, code), fact]))));
let checked = 0;
for (const {name, data} of overlays.filter((item) => item.data.scope && item.data.scope !== 'reporting-format-assessment')) {
  for (const team of excludeRemovedTeams({products: data.products || []}).products) {
    const product = products.find((p) => p.id.replace(/::empty::.*/, '') === team.id
      && ['name', 'unit', 'type'].every((key) => p[key] === team[key]));
    if (!product) {errors.push(`${name}: missing team ${team.unit} / ${team.name}`); continue;}
    const metrics = product.metrics.flatMap((block) => block.metrics || []);
    for (const [code, fact] of Object.entries(team.metrics || {})) {
      const latestCorrectionFact = latestCorrectionFacts.get(factKey(team, code));
      if (latestCorrectionFact && latestCorrectionFact !== fact) continue;
      if (data.scope === 'goals-information-assessment') {
        const metric = metrics.find(metric => metric.code === code);
        if (!metric || metric.dd_calculation_flg !== 0 || metric.excluded_from_index !== true) {
          errors.push(`${name}: ${team.name} / ${code}: informational exclusion was lost`);
        }
        checked++;
        continue;
      }
      const explicitMaximumSurveyFact = latestCorrectionFact ? null : maximumSurveyFacts.get(factKey(team, code));
      if (explicitMaximumSurveyFact && explicitMaximumSurveyFact !== fact) continue;
      if (data.scope === 'user-confirmed-q2-retention') {
        const prior = source.products.find((product) => product.period === 'II кв. 2026'
          && product.id === team.id && ['name', 'unit', 'type'].every((key) => product[key] === team[key]));
        const old = prior?.metrics.flatMap((block) => block.metrics).find((metric) => metric.code === code);
        const metric = metrics.find((metric) => metric.code === code);
        const segmentFloor = fact.source?.policy === 'segmentMechanicsNonDecreasing';
        const proposed = fact.source?.proposedRawValue;
        const expected = old && segmentFloor ? Math.max(old.value, proposed * old.max_value) : old?.value;
        const expectedRaw = old && segmentFloor ? Math.max(old.value / old.max_value, proposed) : old?.value / old?.max_value;
        if (!old || !metric || metric.value !== expected || metric.max_value !== old.max_value
          || metric.is_applicabble_flg === false || !(metric.max_value > 0)
          || fact.source?.sourceValue !== old.value || fact.source?.sourceMaxValue !== old.max_value
          || fact.rawValue !== expectedRaw || (segmentFloor && ![0, 0.5, 1].includes(proposed))) {
          errors.push(`${name}: ${team.name} / ${code}: exact Q2 retention was lost`);
        }
        checked++;
        continue;
      }
      const goalsTribeFact = goalsTribeFacts.get(factKey(team, code));
      if (goalsTribeFact && goalsTribeFact !== fact) continue;
      const navigatorZeroMarketFact = latestCorrectionFact ? null : navigatorZeroMarketFacts.get(factKey(team, code));
      if (navigatorZeroMarketFact && navigatorZeroMarketFact !== fact) continue;
      const maximumSurveyFact = latestCorrectionFact ? null : maximumSurveyFacts.get(factKey(team, code));
      if (maximumSurveyFact && maximumSurveyFact !== fact) continue;
      if (data.scope === 'metric-applicability-assessment' && fact.applicable === false) {
        const metric = metrics.find((item) => item.code === code);
        if (!metric || metric.is_applicabble_flg !== false || metric.max_value !== 0 || metric.value !== null
          || metric.excluded_from_index !== true) errors.push(`${name}: ${team.name} / ${code}: non-applicability was lost`);
        checked++;
        continue;
      }
      const ratio = fact.source?.completenessRatio;
      const isCompletenessFraction = data.scope === 'funnel-user-assessment'
        && ['attract.report_completeness', 'churn.report_completeness'].includes(code)
        && Number.isInteger(ratio?.selected) && Number.isInteger(ratio?.available)
        && ratio.available > 0 && ratio.selected >= 0 && ratio.selected <= ratio.available
        && fact.rawValue === ratio.selected / ratio.available;
      const isPerformanceQuarter = data.scope === 'performance-assessment' && fact.rawValue === 0.25
        && ['rezulьtativnostь.cr_vypolneniya', 'rezulьtativnostь.dop_npv_vypolneniya', 'rezulьtativnostь.delьta_cltv_vypolneniya'].includes(code);
      if (!isCompletenessFraction && !isPerformanceQuarter && ![0, 0.5, 1].includes(fact.rawValue) && !(data.scope === 'ab-tests-assessment'
        && code === 'hyp.ab_tests' && fact.rawValue === 0.25)) continue;
      if (data.scope === 'funnel-reporting-carry-forward'
        && (explicitFunnelFacts.has(factKey(team, code)) || explicitRegularityFacts.has(factKey(team, code)))) continue;
      if (data.scope === 'mechanics-carry-forward' && explicitMechanicsFacts.has(factKey(team, code))) continue;
      if (data.scope === 'alerts-carry-forward' && explicitAlertFacts.has(factKey(team, code))) continue;
      if (data.scope === 'campaign-missing-zero-assessment' && explicitCampaignFacts.has(factKey(team, code))) continue;
      const metric = metrics.find((item) => item.code === code);
      const expected = metric && metric.is_applicabble_flg !== false && metric.max_value > 0
        ? data.scope === 'ab-tests-assessment' && code === 'hyp.ab_tests'
          ? fact.rawValue : fact.rawValue * metric.max_value : null;
      if (!metric || metric.value !== expected) errors.push(`${name}: ${team.name} / ${code}: expected ${expected}, got ${metric?.value}`);
      if (data.scope === 'performance-assessment' && (!metric || metric.max_value !== 1 || metric.is_applicabble_flg !== true)) {
        errors.push(`${name}: ${team.name} / ${code}: performance maximum must stay 1`);
      }
      if (data.scope === 'cx-score-assessment' && (!metric || metric.max_value !== 1 || metric.is_applicabble_flg !== true)) {
        errors.push(`${name}: ${team.name}: CX Score must remain applicable with maximum 1`);
      }
      if (data.scope === 'ab-tests-assessment' && (code !== 'hyp.ab_tests' || !metric || metric.max_value !== (fact.rawValue === 0.25 ? 0.25 : 1)
        || metric.is_applicabble_flg !== true || metric.excluded_from_index !== false || metric.dd_calculation_flg !== 1)) {
        errors.push(`${name}: ${team.name}: explicit A/B assessment must preserve the Q3 assessment maximum`);
      }
      if (data.scope === 'funnel-user-assessment' && fact.applicabilityOverride
        && (!metric || metric.max_value !== 0.5 || metric.is_applicabble_flg !== true)) {
        errors.push(`${name}: ${team.name} / ${code}: explicit Q3 reporting applicability was lost`);
      }
      checked++;
    }
    if (data.scope === 'crosssell-after-purchase-assessment') {
      const metric = metrics.find((item) => item.code === 'mehaniki.cross_sell');
      const after = metric?.crossSellComponents?.after;
      const expected = team.postPurchaseApplicable === false ? null : team.postPurchaseValue;
      if (!after || after.rawValue !== expected || after.applicable !== (team.postPurchaseApplicable !== false)) {
        errors.push(`${name}: ${team.name}: after-purchase Cross-sell assessment was lost`);
      }
      checked++;
    }
  }
}
const poAssessments = overlays.filter(({data}) => data.scope === 'po-goals-assessment')
  .flatMap(({data}) => data.products || []);
for (const product of products) {
  const poAssessment = poAssessments.find(team => team.id === product.id.replace(/::empty::.*/, '')
    && ['name', 'unit', 'type'].every(key => team[key] === product[key]));
  const metrics = product.metrics.flatMap(block => block.metrics);
  for (const code of ['goals.po_monitoring', 'goals.po_forecast', 'goals.po_factor_analysis']) {
    const metric = metrics.find(metric => metric.code === code);
    const fact = poAssessment?.metrics?.[code];
    const expectedValue = fact?.rawValue ?? null;
    const notApplicable = fact?.applicable === false;
    if (!metric || metric.value !== expectedValue || metric.max_value !== (notApplicable ? 0 : 1) || metric.dd_calculation_flg !== 1
      || metric.excluded_from_index !== notApplicable || metric.is_applicabble_flg !== !notApplicable
      || (notApplicable && metric.hidden_from_profile !== true)) {
      errors.push(`${product.name} / ${code}: PO goals must retain their confirmed scores and remain indexed`);
    }
  }
}
if (errors.length) throw new Error(`Manual DDI assessments would be lost; build stopped:\n${errors.join('\n')}`);
const salary = JSON.parse(fs.readFileSync(path.join(root, 'src/data/salary-products-q3-2026.json'), 'utf8'));
if (!/buildDdiPeriodProducts\(data\?\.products/.test(app)) throw new Error('Quarter-specific roster is disconnected from App.jsx');
const reportingPath = path.join(root, 'src/data/reporting-regularity-missing-q3-2026.json');
const reportingMissing = JSON.parse(fs.readFileSync(reportingPath, 'utf8'));
if (!/salaryProductsQ32026, reportingMissingQ32026, funnelActionMissingQ32026\)/.test(app)) throw new Error('Missing reporting assessments are disconnected from App.jsx');
const actionMissing = JSON.parse(fs.readFileSync(path.join(root, 'src/data/funnel-action-missing-q3-2026.json'), 'utf8'));
const beforeReportingFill = buildDdiPeriodProducts(source.products, 'III кв. 2026', overlays.map((item) => item.data), salary, reportingMissing);
const finalProducts = buildDdiPeriodProducts(source.products, 'III кв. 2026', overlays.map((item) => item.data), salary, reportingMissing, actionMissing);
for (const product of finalProducts) {
  const metrics = product.metrics.flatMap((block) => block.metrics);
  const navigator = metrics.find((metric) => metric.code === 'general.navigator_reporting_knowledge');
  if (navigator?.source?.origin !== 'userConfirmedNavigatorZeroMarketsRule') continue;
  const markets = ['general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere']
    .map((code) => metrics.find((metric) => metric.code === code));
  if (!markets.every((metric) => metric && metric.is_applicabble_flg !== false && metric.max_value > 0 && metric.value === 0)
    || navigator.value !== 0 || navigator.is_applicabble_flg === false || !(navigator.max_value > 0)) {
    throw new Error(`Navigator zero-market rule is inconsistent: ${product.name}`);
  }
}
const dbNames = finalProducts.filter((p) => p.unit === 'DB').map((p) => p.name).sort();
for (const product of finalProducts) {
  const metrics = product.metrics.flatMap((block) => block.metrics);
  const navigator = metrics.find((metric) => metric.code === 'general.navigator_reporting_knowledge');
  const fraction = navigatorKnowledgeFraction(metrics);
  if (!isInvestKopilkaNavigatorOverride(product, navigator) && !isDirectNavigatorOverride(product, navigator)
    && fraction !== undefined && navigator?.is_applicabble_flg !== false && navigator?.max_value > 0
    && navigator.value !== (fraction === null ? null : fraction * navigator.max_value)) {
    throw new Error(`Navigator knowledge hierarchy lost: ${product.name}`);
  }
}
if (JSON.stringify(dbNames) !== JSON.stringify([...Q3_DB_TEAMS].sort())) throw new Error('Q3 Daily Banking roster changed');
for (const child of salary.products) {
  const parent = finalProducts.find((p) => p.id.replace(/::empty::.*/, '') === child.baseTeamId);
  const product = parent?.salaryCohorts?.[child.cohort.toLowerCase()];
  if (!product || product.respondent !== child.respondent) throw new Error(`Salary respondent mapping lost: ${child.name}`);
  const metrics = product.metrics.flatMap((b) => b.metrics);
  for (const [code, fact] of Object.entries(child.metrics)) {
    const metric = metrics.find((m) => m.code === code);
    const expected = fact.rawValue === null ? null : fact.rawValue * metric?.max_value;
    if (!metric || metric.value !== expected) throw new Error(`Salary assessment lost: ${child.name} / ${code}`);
  }
  for (const code of child.unassignedAggregateMetricCodes || []) {
    const metric = metrics.find((m) => m.code === code);
    if (!metric || metric.crossSellComponents?.during?.value !== 0
      || metric.crossSellComponents?.during?.source?.origin !== 'userConfirmedCrossSellMissingAsZero'
      || metric.crossSellComponents?.during?.source?.previousSource?.origin !== 'salarySplitUnassignedAggregate'
      || metric.value !== child.crossSellAfterPurchase?.rawValue * metric.max_value / 2) {
      throw new Error(`Aggregate evidence was assigned to a salary cohort without confirmation: ${child.name} / ${code}`);
    }
    if (metric.crossSellComponents?.after?.rawValue !== child.crossSellAfterPurchase?.rawValue) {
      throw new Error(`Salary after-purchase assessment lost: ${child.name}`);
    }
  }
}
const combinedSalary = finalProducts.find((product) => product.id.replace(/::empty::.*/, '') === salary.source.baseTeamId);
if (!combinedSalary?.salaryCohorts?.b2b || !combinedSalary?.salaryCohorts?.b2c
  || combinedSalary.name !== 'Зарплатный продукт') throw new Error('Combined salary product or cohort history was lost');
for (const block of combinedSalary.metrics.filter((item) => ['general', 'attract', 'churn', 'mehaniki', 'hyp'].includes(item.code))) {
  for (const metric of block.metrics) {
    const pair = ['b2b', 'b2c'].map((key) => combinedSalary.salaryCohorts[key].metrics.flatMap((item) => item.metrics)
      .find((item) => item.code === metric.code));
    const eligible = pair.every((item) => item && item.is_applicabble_flg !== false && item.max_value > 0)
      && pair[0].max_value === pair[1].max_value;
    const expected = eligible && pair.every((item) => Number.isFinite(item.value)) ? (pair[0].value + pair[1].value) / 2 : null;
    if (metric.value !== expected || metric.source?.origin !== 'salaryCohortAverage') {
      throw new Error(`Combined salary mean was lost: ${metric.code}`);
    }
  }
}
// Latest instruction: no existing assigned score can be overwritten by the new reporting rule.
for (const previous of beforeReportingFill) {
  const final = finalProducts.find((p) => p.id === previous.id && p.name === previous.name && p.unit === previous.unit && p.type === previous.type);
  if (!final) throw new Error(`Reporting fill removed a team: ${previous.name}`);
  const metrics = final.metrics.flatMap((b) => b.metrics);
  for (const old of previous.metrics.flatMap((b) => b.metrics)) {
    const metric = metrics.find((m) => m.code === old.code);
    if (!metric || metric.max_value !== old.max_value || metric.is_applicabble_flg !== old.is_applicabble_flg
      || (Number.isFinite(old.value) && metric.value !== old.value)) {
      throw new Error(`Reporting fill changed an existing assessment: ${previous.name} / ${old.code}`);
    }
  }
}
let reportingFilled = 0;
const finalAssessmentProducts = finalProducts.flatMap((product) => [product, ...Object.values(product.salaryCohorts || {})]);
const reportingFormatFacts = new Map(overlays.filter(({data}) => data.period === 'III кв. 2026'
  && data.scope === 'reporting-format-assessment').flatMap(({data}) => data.products.flatMap(team =>
  Object.entries(team.metrics).map(([code, fact]) => [factKey(team, code), fact]))));
for (const product of finalAssessmentProducts) for (const metric of product.metrics.flatMap(block => block.metrics)) {
  const identity = {...product, id: product.id.replace(/::empty::.*/, '')};
  const fact = reportingFormatFacts.get(factKey(identity, metric.code));
  if (fact && metric.is_applicabble_flg !== false && metric.max_value > 0
    && (metric.value !== 0.5 * metric.max_value || metric.source?.reportFormat !== 'excel')) {
    throw new Error(`Monthly Excel half score lost: ${product.name} / ${metric.code}`);
  }
}

for (const team of reportingMissing.products || []) {
  const product = finalAssessmentProducts.find((p) => p.id.replace(/::empty::.*/, '') === team.id
    && ['name', 'unit', 'type'].every((key) => p[key] === team[key]));
  if (!product) throw new Error(`Missing reporting fill team: ${team.name}`);
  for (const [code, fact] of Object.entries(team.metrics || {})) {
    const metric = product.metrics.flatMap((b) => b.metrics).find((m) => m.code === code);
    const effectiveFact = latestCorrectionFacts.get(factKey(team, code)) || reportingFormatFacts.get(factKey(team, code)) || fact;
    if (!metric || metric.value !== effectiveFact.rawValue * metric.max_value) {
      throw new Error(`Missing reporting fill lost: ${team.name} / ${code}`);
    }
    reportingFilled++;
  }
}
let actionsFilled = 0;
for (const team of actionMissing.products || []) {
  const product = finalAssessmentProducts.find((p) => p.id.replace(/::empty::.*/, '') === team.id
    && ['name', 'unit', 'type'].every((key) => p[key] === team[key]));
  if (!product) throw new Error(`Missing funnel action team: ${team.name}`);
  for (const [code, fact] of Object.entries(team.metrics || {})) {
    const metric = product.metrics.flatMap((b) => b.metrics).find((m) => m.code === code);
    if (!['attract.initiatives_list', 'churn.deviation_actions'].includes(code)
      || ![0, 1].includes(fact.rawValue) || !metric || metric.value !== fact.rawValue * metric.max_value) {
      throw new Error(`Funnel action fill lost: ${team.name} / ${code}`);
    }
    actionsFilled++;
  }
}
const absenceAssessments = overlays.filter(({data}) => data.scope === 'reporting-absence-assessment');
const beforeAbsence = buildDdiPeriodProducts(source.products, 'III кв. 2026',
  overlays.filter(({data}) => data.scope !== 'reporting-absence-assessment').map(({data}) => data), salary, reportingMissing, actionMissing);
const beforeAbsenceTeams = beforeAbsence.flatMap(product => [product, ...Object.values(product.salaryCohorts || {})]);
let absenceChanges = 0;
for (const product of finalAssessmentProducts) {
  const oldProduct = beforeAbsenceTeams.find(team => team.id === product.id && ['name', 'unit', 'type'].every(key => team[key] === product[key]));
  if (!oldProduct) throw new Error(`Reporting absence rule changed the roster: ${product.name}`);
  const facts = absenceAssessments.flatMap(({data}) => data.products || []).filter(team =>
    team.id === product.id.replace(/::empty::.*/, '') && ['name', 'unit', 'type'].every(key => team[key] === product[key]));
  for (const block of product.metrics) {
    const oldBlock = oldProduct.metrics.find(item => item.code === block.code);
    const proof = facts.flatMap(team => team.blocks || []).find(item => item.blockCode === block.code && item.answer === 'Нет');
    const report = proof && oldBlock.metrics.find(metric => metric.code === proof.reportingCode);
    const eligible = report && report.is_applicabble_flg !== false && report.max_value > 0
      && (report.value == null || report.value === '' || report.value === 0);
    for (const metric of block.metrics) {
      const old = oldBlock.metrics.find(item => item.code === metric.code);
      const dependent = /\.(?:benchmarks|nalichie_benchmarkov|regulyarnostь|report_completeness|polnota_otcheta)$/.test(metric.code);
      const expected = eligible && (metric.code === proof.reportingCode || dependent)
        && old.is_applicabble_flg !== false && old.max_value > 0 ? 0 : old.value;
      if (metric.value !== expected || metric.max_value !== old.max_value || metric.is_applicabble_flg !== old.is_applicabble_flg) {
        throw new Error(`Reporting absence rule changed an unauthorized value: ${product.name} / ${metric.code}`);
      }
      if (metric.value !== old.value) absenceChanges++;
    }
  }
}
const exclusionAssessments = overlays.filter(({data}) => data.scope === 'metric-index-exclusion-assessment');
const beforeExclusions = buildDdiPeriodProducts(source.products, 'III кв. 2026',
  overlays.filter(({data}) => data.scope !== 'metric-index-exclusion-assessment').map(({data}) => data), salary, reportingMissing, actionMissing);
let excludedMetrics = 0;
for (const product of finalProducts) {
  const previous = beforeExclusions.find(item => item.id === product.id);
  const teams = exclusionAssessments.flatMap(({data}) => data.products || []).filter(team =>
    team.id === product.id.replace(/::empty::.*/, '') && ['name', 'unit', 'type'].every(key => team[key] === product[key]));
  const facts = Object.assign({}, ...teams.map(team => team.metrics || {}));
  for (const metric of product.metrics.flatMap(block => block.metrics)) {
    const old = previous.metrics.flatMap(block => block.metrics).find(item => item.code === metric.code);
    if (metric.value !== old.value || metric.max_value !== old.max_value || metric.is_applicabble_flg !== old.is_applicabble_flg
      || JSON.stringify(metric.source) !== JSON.stringify(old.source)) {
      throw new Error(`Index exclusion changed a score or rubric: ${product.name} / ${metric.code}`);
    }
    if (facts[metric.code]?.excludedFromIndex === true) {
      if (metric.excluded_from_index !== true || metric.dd_calculation_flg !== 0 || isDdIndexMetric(metric)) {
        throw new Error(`Index exclusion lost: ${product.name} / ${metric.code}`);
      }
      excludedMetrics++;
    } else if (metric.excluded_from_index !== old.excluded_from_index || metric.dd_calculation_flg !== old.dd_calculation_flg) {
      throw new Error(`Index exclusion changed another metric: ${product.name} / ${metric.code}`);
    }
  }
  const expectedMax = product.metrics.flatMap(block => block.metrics).filter(isDdIndexMetric)
    .reduce((sum, metric) => sum + Number(metric.max_value), 0);
  if (teams.length && Math.abs(product.indexMaxPoints - expectedMax) > 1e-9) {
    throw new Error(`Index exclusion denominator is inconsistent: ${product.name}`);
  }
}
console.log(`Index exclusions preserved: ${excludedMetrics}; scores and rubric maxima unchanged.`);
console.log(`Reporting absence rule: ${absenceChanges} values changed; positive reporting and unrelated metrics preserved.`);
console.log(`Funnel action blanks filled: ${actionsFilled}; existing scores preserved.`);
console.log(`Reporting blanks filled: ${reportingFilled}; existing scores preserved.`);
console.log(`Manual Q3 assessments preserved: ${checked} values checked across ${products.length} teams.`);
console.log(`Q3 roster preserved: ${finalProducts.length} teams; Daily Banking: ${dbNames.length}.`);
