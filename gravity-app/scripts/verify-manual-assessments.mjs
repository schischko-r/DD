import {applyMetricApplicabilityAssessments} from '../src/domain/metricApplicability.js';
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';
import {buildTeamProfileProducts} from '../src/domain/teamProfileSelection.js';
import {excludeRemovedTeams, isDdIndexMetric} from '../src/domain/report.js';
import {buildDdiPeriodProducts, Q3_DB_TEAMS} from '../src/domain/quarterProfiles.js';
import {applyGoalsFinalScores, GOALS_FINAL_COUNTERPARTS} from '../src/domain/goalsFinalScores.js';
import {navigatorKnowledgeFraction, isInvestKopilkaNavigatorOverride, isDirectNavigatorOverride} from '../src/domain/navigatorKnowledge.js';

// Check automatic stages independently of the final, explicitly scoped corrections.
const buildAutomaticPeriodProducts = (products, period, assessments, ...args) =>
  buildDdiPeriodProducts(products, period, assessments.filter(item => !['ub-workbook-corrections', 'cbp-user-corrections', 'cx-user-corrections'].includes(item?.scope)), ...args);


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
const required = ['ub-workbook-corrections-q3-2026.json', 'crossborder-acquiring-reporting-applicability-q3-2026.json', 'smile-attract-analysis-q3-2026.json', 'smile-markets-zero-q3-2026.json', 'working-age-fot-knowledge-q3-2026.json', 'monthly-excel-reporting-q3-2026.json', 'data-quality-survey-q3-2026.json', 'iszh-funnel-completeness-q3-2026.json', 'nszh-funnel-completeness-q3-2026.json', 'ab-tests-insurance-visibility-q3-2026.json', 'cfa-attract-completeness-q3-2026.json', 'cfa-attract-benchmarks-q3-2026.json', 'corporate-churn-completeness-q3-2026.json', 'campaigning-data-quality-q3-2026.json', 'campaigning-alerts-q3-2026.json', 'campaigning-performance-q3-2026.json', 'campaigning-quarter-retention-q3-2026.json', 'po-goals-survey-assessments-q3-2026.json', 'po-goals-template-q3-2026.json', 'goals-informational-q3-2026.json', 'goals-tribe-assessments-q3-2026.json', 'goals-final-scores-q3-2026.json', 'goals-tribe-applicability-q3-2026.json', 'corporate-flexible-conditions-applicability-q3-2026.json', 'domclick-self-service-q3-2026.json', 'cx-score-metrics-q3-2026.json', 'crosssell-after-purchase-scores-q3-2026.json', 'crosssell-during-purchase-scores-q3-2026.json',
  'research-metrics-q3-2026.json', 'research-metric-corrections-q3-2026.json', 'selected-metrics-carry-forward-q3-2026.json', 'ux-score-metrics-q3-2026.json',
  'campaign-missing-zero-q3-2026.json', 'campaign-user-assessments-q3-2026.json', 'user-metric-assessments-q3-2026.json',
  'funnel-user-assessments-q3-2026.json', 'funnel-link-quality-assessment-q3-2026.json', 'goals-metric-corrections-q3-2026.json', 'metric-applicability-q3-2026.json', 'mechanics-user-assessments-q3-2026.json',
  'alerts-carry-forward-q3-2026.json', 'discovery-metrics-q3-2026.json', 'regularity-user-assessments-q3-2026.json',
  'navigator-market-knowledge-q3-2026.json', 'goals-user-carry-forward-q3-2026.json',
  'funnel-additional-user-assessments-q3-2026.json', 'knowledge-user-assessments-q3-2026.json', 'chat-entry-actions-q3-2026.json', 'ab-tests-user-assessments-q3-2026.json', 'cx-user-corrections-q3-2026.json',
  'crosssell-final-scores-q3-2026.json'];
for (const name of required) {
  if (!overlays.some((overlay) => overlay.name === name)) throw new Error(`Manual assessment is disconnected: ${name}`);
}
if (!overlays.some(({name}) => name === 'reporting-absence-user-q3-2026.json')) {
  throw new Error('Reporting absence rule is disconnected from App.jsx');
}
const automaticAssessments = overlays.map((item) => item.data)
  .filter((item) => !['cbp-user-corrections', 'cx-user-corrections'].includes(item.scope));
const products = applyMetricApplicabilityAssessments(buildTeamProfileProducts(source.products, 'III кв. 2026', automaticAssessments),
  'III кв. 2026', automaticAssessments, true);
const goalsFinalAssessment = overlays.find(({data}) => data.scope === 'goals-final-scores')?.data;
const finalScoreProducts = goalsFinalAssessment
  ? products.filter((product) => goalsFinalAssessment.products.some((row) => row.name === product.name && row.unit === product.unit))
  : products;
const finalGoalProducts = goalsFinalAssessment
  ? applyGoalsFinalScores(finalScoreProducts, 'III кв. 2026', [goalsFinalAssessment]) : products;
const factKey = (team, code) => JSON.stringify([team.id, team.name, team.unit, team.type, code]);
// An explicit assessment supersedes the historical carry-forward value, which remains in its source file.
const explicitFunnelFacts = new Set(overlays.filter(({data}) => data.scope === 'funnel-user-assessment'
  && data.period === 'III кв. 2026').flatMap(({data}) => (data.products || []).flatMap((team) =>
  Object.entries(team.metrics || {}).filter(([, fact]) => [0, 0.5, 1].includes(fact.rawValue))
    .map(([code]) => factKey(team, code)))));
const funnelLinkQualityFacts = new Map(overlays.filter(({data}) => data.scope === 'funnel-link-quality-assessment'
  && data.period === 'III кв. 2026').flatMap(({data}) => (data.products || []).flatMap((team) =>
    Object.entries(team.metrics || {}).map(([code, fact]) => [factKey(team, code), fact]))));
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
const goalsMetricCorrections = new Map(overlays.filter(({data}) => data.source?.origin === 'userConfirmedGoalsMetricCorrection')
  .flatMap(({data}) => (data.products || []).flatMap((team) =>
    Object.entries(team.metrics || {}).map(([code, fact]) => [factKey(team, code), fact]))));
const researchMetricCorrections = new Map(overlays.filter(({data}) => data.source?.origin === 'userConfirmedResearchMetricCorrection')
  .flatMap(({data}) => (data.products || []).flatMap((team) =>
    Object.entries(team.metrics || {}).map(([code, fact]) => [factKey(team, code), fact]))));
const errors = [];
// These approved facts resolve at final workbook priority, after the generic
// profile stage checked below. Validate that final stage instead of its input.
const approvedKnowledgeGroup = 'segment-channel-key-metrics-2026-11-11';
const approvedKnowledgeCodes = {
  'Рабочий возраст': ['general.aktivnaya_klientskaya_baza', 'general.kol_vo_major_klientov',
    'general.kol_vo_klientov_s_2_nefin_servisov', 'general.kol_vo_poluchateley_zp',
    'general.obъem_zachisleniy_fot', 'general.dolya_rynka_fot', 'general.navigator_reporting_knowledge'],
  'Top Affluent': ['general.aktivnaya_klientskaya_baza', 'general.kol_vo_major_klientov',
    'general.kol_vo_klientov_s_2_nefin_servisov', 'general.sredniy_dohoda_na_klienta'],
  'МВС': ['general.aktivnaya_klientskaya_baza', 'general.kol_vo_major_klientov',
    'general.kol_vo_klientov_s_2_nefin_servisov', 'general.sredniy_dohoda_na_klienta'],
  'Зрелость': ['general.aktivnaya_klientskaya_baza', 'general.kol_vo_major_klientov',
    'general.kol_vo_klientov_s_2_nefin_servisov'],
  'Молодежь': ['general.aktivnaya_klientskaya_baza', 'general.kol_vo_major_klientov',
    'general.kol_vo_klientov_s_2_nefin_servisov', 'general.navigator_reporting_knowledge'],
  'Дети': ['general.aktivnaya_klientskaya_baza', 'general.kol_vo_major_klientov', 'general.navigator_reporting_knowledge'],
  'PB': ['general.aktivnaya_klientskaya_baza', 'general.kol_vo_major_klientov',
    'general.kol_vo_klientov_s_2_nefin_servisov', 'general.sredniy_dohoda_na_klienta', 'general.navigator_reporting_knowledge'],
  'Чат': ['general.navigator_reporting_knowledge'],
  'СБОЛ': ['general.navigator_reporting_knowledge'],
  'Уведомления': ['general.navigator_reporting_knowledge'],
  'Единый личный кабинет (ЕЛК)': ['general.navigator_reporting_knowledge'],
};
const approvedSatelliteGroup = 'satellites-navigator-selected-12-2026-11-11';
const satelliteCode = 'general.znanie_produktov_sputnikov';
const navigatorCode = 'general.navigator_reporting_knowledge';
const approvedSatelliteTeams = {
  'Оплата улыбкой': {id: '11a243e6-5b73-56ad-8ac7-203e0d744062¦Оплата улыбкой', unit: 'DB', codes: [satelliteCode]},
  'Трансграничные переводы': {id: '9721f391-d1a5-57d5-beb1-e0eaccbf0ed1¦Трансграничные переводы', unit: 'DB', codes: [satelliteCode]},
  'СберПрайм': {id: '723125c3-303d-5d2e-adc3-18460f242f63¦СберПрайм', unit: 'CX', codes: [satelliteCode]},
  'СберЧаевые': {id: '5b3c81af-8ad4-5fcd-84c0-729f3f44093f¦СберЧаевые', unit: 'DB', codes: [satelliteCode]},
  'ВЗР': {id: '8cba2f54-2829-5599-9ee7-d1f288bb1f03¦ВЗР', unit: 'УБ', codes: [satelliteCode]},
  'Платежи': {id: 'aa80593f-3f07-5935-96b3-2e367d6a78f4¦Платежи', unit: 'DB', codes: [satelliteCode]},
  'Кредитные карты': {id: 'afe119a5-a944-5e11-90f9-e3facbd32e5c¦Кредитные карты', unit: 'DB', codes: [satelliteCode]},
  'Трансграничный эквайринг': {id: '75028b72-7f89-55c1-a309-8c5b4193250a¦Трансграничный эквайринг', unit: 'DB', codes: [satelliteCode]},
  'Переводы по РФ': {id: '4bf2be31-ba6b-5ee2-b60d-bf62932ea0ce¦Переводы по РФ', unit: 'DB', codes: [satelliteCode]},
  'КАСКО': {id: '89b13e92-db89-516e-823f-1d102242bdc9¦КАСКО', unit: 'УБ', codes: [satelliteCode, navigatorCode]},
  'ОСАГО': {id: '16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО', unit: 'УБ', codes: [satelliteCode, navigatorCode]},
  'Личная защита Плюс': {id: '715a3090-94df-5954-b638-bb36c1ae24ae¦Личная защита Плюс', unit: 'УБ', codes: [satelliteCode, navigatorCode]},
};
const salary = JSON.parse(fs.readFileSync(path.join(root, 'src/data/salary-products-q3-2026.json'), 'utf8'));
const reportingPath = path.join(root, 'src/data/reporting-regularity-missing-q3-2026.json');
const reportingMissing = JSON.parse(fs.readFileSync(reportingPath, 'utf8'));
const actionMissing = JSON.parse(fs.readFileSync(path.join(root, 'src/data/funnel-action-missing-q3-2026.json'), 'utf8'));
const approvedKnowledgeProducts = buildDdiPeriodProducts(source.products, 'III кв. 2026',
  overlays.map(item => item.data), salary, reportingMissing, actionMissing);
const checkedApprovedKnowledge = new Set();
const checkedApprovedSatellites = new Set();
const approvedKnowledgeProof = (proof, group = approvedKnowledgeGroup) => proof?.origin === 'userConfirmedQ3ScoreCorrection'
  && proof.confirmedBy === 'user' && proof.date === '2026-11-11'
  && proof.period === 'III кв. 2026' && proof.approvalGroup === group;
const latestCorrectionFacts = new Map(overlays.filter(({data}) =>
  data.period === 'III кв. 2026' && ['userConfirmedAutoAttractCorrection20261031',
    'userConfirmedInsuranceFunnelBatch20261031', 'userConfirmedDirectNavigatorAssessment',
    'userConfirmedDomclickCxScore20261102', 'userConfirmedDomclickCampaignScore',
    'userConfirmedDomclickNavigatorReporting20261102', 'userConfirmedAdditionalFunnelAssessment',
    'userConfirmedFunnelAssessment', 'userConfirmedDepositsChurnCompleteness20261030',
    'userConfirmedPCFinalScore20261102', 'userConfirmedQ3ScoreCorrection'].includes(data.source?.origin))
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
const hiddenReportingFacts = new Set(overlays.filter(({data}) => data.scope === 'metric-applicability-assessment'
  && data.period === 'III кв. 2026' && data.source?.origin === 'userConfirmedCrossborderAcquiringReportingNotApplicable')
  .flatMap(({data}) => data.products.flatMap(team => Object.entries(team.metrics)
    .filter(([, fact]) => fact.applicable === false && fact.hiddenFromProfile === true)
    .map(([code]) => factKey(team, code)))));
let checked = 0;
for (const {name, data} of overlays.filter((item) => item.data.scope && !['reporting-format-assessment', 'ub-workbook-corrections', 'cbp-user-corrections', 'cx-user-corrections', 'frozen-q3-crosssell-scores'].includes(item.data.scope))) {
  if (data.scope === 'goals-final-scores') {
    if (data.products?.length !== finalGoalProducts.length) errors.push(`${name}: final goals roster is incomplete`);
    for (const row of data.products || []) {
      const product = finalGoalProducts.find((item) => item.name === row.name && item.unit === row.unit);
      const block = product?.metrics.find((item) => item.code === 'goals');
      if (!block) {errors.push(`${name}: missing final goals product ${row.unit} / ${row.name}`); continue;}
      for (const [baseCode, poCode] of Object.entries(GOALS_FINAL_COUNTERPARTS)) {
        const finalMetric = block.metrics.find((metric) => metric.code === poCode);
        const ltMetric = block.metrics.find((metric) => metric.code === baseCode);
        const poMetric = block.goalsPoLevelMetrics?.find((metric) => metric.code === poCode);
        const finalApplicable = row.final[baseCode] !== null;
        if (!finalMetric || finalMetric.value !== row.final[baseCode]
          || finalMetric.max_value !== (finalApplicable ? 1 : 0)
          || finalMetric.is_applicabble_flg !== finalApplicable) {
          errors.push(`${name}: ${row.name} / ${baseCode}: final goals score was lost`);
        }
        const ltApplicable = row.lulT[baseCode] !== null;
        const poApplicable = row.po[poCode] !== null;
        if (!ltMetric || ltMetric.value !== row.lulT[baseCode] || ltMetric.max_value !== (ltApplicable ? 1 : 0)
          || ltMetric.is_applicabble_flg !== ltApplicable || ltMetric.dd_calculation_flg !== 0
          || ltMetric.excluded_from_index !== true) errors.push(`${name}: ${row.name} / ${baseCode}: LULt score was lost`);
        if (!poMetric || poMetric.value !== row.po[poCode] || poMetric.max_value !== (poApplicable ? 1 : 0)
          || poMetric.is_applicabble_flg !== poApplicable || poMetric.dd_calculation_flg !== 0
          || poMetric.excluded_from_index !== true) errors.push(`${name}: ${row.name} / ${poCode}: PO detail score was lost`);
        checked++;
      }
    }
    continue;
  }
  for (const team of excludeRemovedTeams({products: data.products || []}).products) {
    const product = products.find((p) => p.id.replace(/::empty::.*/, '') === team.id
      && ['name', 'unit', 'type'].every((key) => p[key] === team[key]));
    if (!product) {errors.push(`${name}: missing team ${team.unit} / ${team.name}`); continue;}
    const metrics = product.metrics.flatMap((block) => block.metrics || []);
    for (const [code, fact] of Object.entries(team.metrics || {})) {
      const approvalGroup = [fact.source?.approvalGroup, fact.source?.correction?.approvalGroup]
        .find(group => [approvedKnowledgeGroup, approvedSatelliteGroup].includes(group));
      if (approvalGroup) {
        const satelliteApproval = approvalGroup === approvedSatelliteGroup;
        const allowed = satelliteApproval ? approvedSatelliteTeams[team.name]?.codes.includes(code) : approvedKnowledgeCodes[team.name]?.includes(code);
        const checkedGroup = satelliteApproval ? checkedApprovedSatellites : checkedApprovedKnowledge;
        const expectedIdentity = satelliteApproval ? {...approvedSatelliteTeams[team.name], type: 'Продукт'}
          : ['Чат', 'СБОЛ', 'Уведомления', 'Единый личный кабинет (ЕЛК)'].includes(team.name)
          ? {type: 'Канал', unit: team.name === 'Чат' ? 'PC' : team.name === 'Единый личный кабинет (ЕЛК)' ? 'Data' : 'DP'}
          : {type: 'Сегмент', unit: 'CX'};
        const resolved = approvedKnowledgeProducts.find(item => item.id.replace(/::empty::.*/, '') === team.id
          && ['name', 'unit', 'type'].every(key => item[key] === team[key]));
        const metric = resolved?.metrics.find(block => block.code === 'general')?.metrics.find(item => item.code === code);
        const original = source.products.find(item => item.id === team.id && item.period === 'II кв. 2026'
          && ['name', 'unit', 'type'].every(key => item[key] === team[key]))
          ?.metrics.find(block => block.code === 'general')?.metrics.find(item => item.code === code);
        const key = factKey(team, code);
        if (!allowed || team.type !== expectedIdentity.type || team.unit !== expectedIdentity.unit
          || (satelliteApproval && team.id !== expectedIdentity.id)
          || checkedGroup.has(key) || data.scope !== 'q3-score-correction'
          || !approvedKnowledgeProof(fact.source, approvalGroup) || !approvedKnowledgeProof(fact.source.correction, approvalGroup)
          || fact.rawValue !== 1 || fact.source.correction.rawValue !== 1
          || !metric || !original || !(metric.max_value > 0) || metric.max_value !== original.max_value
          || metric.is_applicabble_flg !== original.is_applicabble_flg || metric.is_applicabble_flg === false
          || metric.value !== metric.max_value || !approvedKnowledgeProof(metric.source, approvalGroup)
          || !approvedKnowledgeProof(metric.source.correction, approvalGroup) || metric.source.rawValue !== 1
          || (satelliteApproval && (fact.source.approvedScenario?.file !== 'outputs/ddi-satellites-navigator-selected-12-2026-11-11/scenario.json'
            || !/^[a-f0-9]{64}$/.test(fact.source.approvedScenario.sha256 || '')
            || (code === navigatorCode && (!fact.source.inputs?.length
              || !fact.source.inputs.every(input => input.maxValue > 0 && input.value === input.maxValue && input.rawValue === 1)))))) {
          errors.push(`${name}: ${team.name} / ${code}: approved final key-metrics assessment was lost`);
        }
        checkedGroup.add(key);
        checked++;
        continue;
      }
      if (hiddenReportingFacts.has(factKey(team, code))) {
        const metric = metrics.find(item => item.code === code);
        if (!metric || metric.value !== null || metric.max_value !== 0 || metric.is_applicabble_flg !== false
          || metric.excluded_from_index !== true || metric.hidden_from_profile !== true) {
          errors.push(`${name}: ${team.name} / ${code}: latest hidden reporting applicability was lost`);
        }
        checked++;
        continue;
      }
      const researchCorrection = researchMetricCorrections.get(factKey(team, code));
      if (data.scope === 'research-assessment' && researchCorrection && researchCorrection !== fact) continue;
      if (data.scope === 'funnel-user-assessment' && funnelLinkQualityFacts.has(factKey(team, code))) continue;
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
        const correction = metric?.source?.correction;
        if (correction?.origin === 'userConfirmedQ3ScoreCorrection' && correction.confirmedBy === 'user'
          && correction.period === 'III кв. 2026') {
          if (!old || !metric || metric.value !== correction.rawValue * metric.max_value
            || metric.max_value !== old.max_value || metric.is_applicabble_flg === false) {
            errors.push(`${name}: ${team.name} / ${code}: explicit Q3 score correction was lost`);
          }
          checked++;
          continue;
        }
        const segmentFloor = fact.source?.policy === 'segmentMechanicsNonDecreasing';
        const proposed = fact.source?.proposedRawValue;
        const expected = old && segmentFloor ? Math.max(old.value, proposed * old.max_value) : old?.value;
        const expectedRaw = old && segmentFloor ? Math.max(old.value / old.max_value, proposed) : old?.value / old?.max_value;
        if (!old || !metric || metric.value !== expected || metric.max_value !== old.max_value
          || metric.is_applicabble_flg === false || !(metric.max_value > 0)
          || fact.source?.sourceValue !== old.value || fact.source?.sourceMaxValue !== old.max_value
          || fact.rawValue !== expectedRaw || (segmentFloor && ![0, 0.5, 0.75, 1].includes(proposed))) {
          errors.push(`${name}: ${team.name} / ${code}: exact Q2 retention was lost`);
        }
        checked++;
        continue;
      }
      const goalsTribeFact = goalsTribeFacts.get(factKey(team, code));
      const goalsMetricCorrection = goalsMetricCorrections.get(factKey(team, code));
      if (data.source?.origin === 'userConfirmedGoalsTribeTable' && goalsMetricCorrection) continue;
      if (goalsMetricCorrection && goalsMetricCorrection !== fact) continue;
      if (goalsTribeFact && goalsTribeFact !== fact && !goalsMetricCorrection) continue;
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
      const isUserConfirmedQuarterCorrection = Number.isFinite(fact.rawValue) && fact.rawValue >= 0 && fact.rawValue <= 1
        && fact.source?.correction?.origin === 'userConfirmedQ3ScoreCorrection'
        && fact.source.correction.confirmedBy === 'user'
        && fact.source.correction.period === 'III кв. 2026';
      const isPerformanceQuarter = data.scope === 'performance-assessment' && fact.rawValue === 0.25
        && ['rezulьtativnostь.cr_vypolneniya', 'rezulьtativnostь.dop_npv_vypolneniya', 'rezulьtativnostь.delьta_cltv_vypolneniya'].includes(code);
      if (!isCompletenessFraction && !isUserConfirmedQuarterCorrection && !isPerformanceQuarter
        && ![0, 0.5, 1].includes(fact.rawValue) && !(data.scope === 'ab-tests-assessment'
        && code === 'hyp.ab_tests' && fact.rawValue === 0.25)) continue;
      if (data.scope === 'funnel-reporting-carry-forward'
        && (explicitFunnelFacts.has(factKey(team, code)) || explicitRegularityFacts.has(factKey(team, code)))) continue;
      if (data.scope === 'mechanics-carry-forward' && explicitMechanicsFacts.has(factKey(team, code))) continue;
      if (data.scope === 'alerts-carry-forward' && explicitAlertFacts.has(factKey(team, code))) continue;
      if (data.scope === 'campaign-missing-zero-assessment' && explicitCampaignFacts.has(factKey(team, code))) continue;
      const metric = metrics.find((item) => item.code === code);
      const expected = metric && metric.is_applicabble_flg !== false && metric.max_value > 0
        ? data.scope === 'ab-tests-assessment' && code === 'hyp.ab_tests'
          ? fact.rawValue : data.scope === 'crosssell-during-purchase-assessment' && code === 'mehaniki.cross_sell'
            ? Math.min(metric.max_value, fact.rawValue * metric.max_value / 2
              + (metric.crossSellComponents?.after?.value || 0))
            : fact.rawValue * metric.max_value : null;
      if (!metric || metric.value !== expected) errors.push(`${name}: ${team.name} / ${code}: expected ${expected}, got ${metric?.value}`);
      if (data.scope === 'performance-assessment' && (!metric || metric.max_value !== 1 || metric.is_applicabble_flg !== true)) {
        errors.push(`${name}: ${team.name} / ${code}: performance maximum must stay 1`);
      }
      const explicitlyRemovedCxScore = data.scope === 'cx-score-assessment' && code === 'cx.score'
        && overlays.some((overlay) => overlay.data.scope === 'metric-applicability-assessment'
          && overlay.data.products?.some((row) => row.id === team.id && row.name === team.name
            && row.unit === team.unit && row.type === team.type && row.metrics?.[code]?.applicable === false));
      if (data.scope === 'cx-score-assessment' && !explicitlyRemovedCxScore
        && (!metric || metric.max_value !== 1 || metric.is_applicabble_flg !== true)) {
        errors.push(`${name}: ${team.name}: CX Score must remain applicable with maximum 1`);
      }
      if (data.scope === 'ab-tests-assessment' && (code !== 'hyp.ab_tests' || !metric || metric.max_value !== (fact.rawValue === 0.25 ? 0.25 : 1)
        || metric.is_applicabble_flg !== true || metric.excluded_from_index !== false || metric.dd_calculation_flg !== 1)) {
        errors.push(`${name}: ${team.name}: explicit A/B assessment must preserve the Q3 assessment maximum`);
      }
      if (data.scope === 'funnel-user-assessment' && fact.applicabilityOverride
        && (!metric || metric.max_value !== fact.applicabilityOverride.maxValue || metric.is_applicabble_flg !== true)) {
        errors.push(`${name}: ${team.name} / ${code}: explicit Q3 reporting applicability was lost`);
      }
      checked++;
    }
    if (data.scope === 'crosssell-during-purchase-assessment') {
      const metric = metrics.find((item) => item.code === 'mehaniki.cross_sell');
      if (!metric || metric.max_value !== 1 || metric.is_applicabble_flg !== true
        || (metric.crossSellComponents?.during?.source?.origin || metric.source?.origin)
          !== 'userConfirmedCrossSellDuringPurchase') {
        errors.push(`${name}: ${team.name}: during-purchase Cross-sell assessment or applicability was lost`);
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
if (checkedApprovedKnowledge.size !== 34) errors.push(`Approved final key-metrics scope: expected 34 unique facts, got ${checkedApprovedKnowledge.size}`);
if (checkedApprovedSatellites.size !== 15) errors.push(`Approved satellites/Navigator scope: expected 15 unique facts, got ${checkedApprovedSatellites.size}`);
if (errors.length) throw new Error(`Manual DDI assessments would be lost; build stopped:\n${errors.join('\n')}`);
if (!/buildDdiPeriodProducts\(data\?\.products/.test(app)) throw new Error('Quarter-specific roster is disconnected from App.jsx');
if (!/salaryProductsQ32026, reportingMissingQ32026, funnelActionMissingQ32026,\s*backlog\.status === 'ready' \? backlog\.data : null\)/.test(app)) throw new Error('Reporting or Discovery decomposition assessments are disconnected from App.jsx');
const beforeReportingFill = buildAutomaticPeriodProducts(source.products, 'III кв. 2026', overlays.map((item) => item.data), salary, reportingMissing);
const finalProducts = buildAutomaticPeriodProducts(source.products, 'III кв. 2026', overlays.map((item) => item.data), salary, reportingMissing, actionMissing);
const sberIdNavigatorGroup = 'sberid-navigator-2026-11-12';
const sberIdNavigatorCode = 'general.navigator_reporting_knowledge';
const matchesSberId = (team) => String(team.id).replace(/::empty::.*/, '') === 'f0050a4f-3ce4-5c90-b5f5-627256453071¦SberID'
  && team.name === 'SberID' && team.unit === 'Data' && team.type === 'Продукт';
const sberIdNavigatorApprovals = overlays.flatMap(({data}) => (data.products || []).flatMap(team =>
  Object.entries(team.metrics || {}).filter(([, fact]) => fact.source?.approvalGroup === sberIdNavigatorGroup)
    .map(([code, fact]) => ({data, team, code, fact}))));
const sberIdNavigatorApproval = sberIdNavigatorApprovals[0];
const sberIdProduct = approvedKnowledgeProducts.find(matchesSberId);
const sberIdNavigator = sberIdProduct?.metrics.find(block => block.code === 'general')?.metrics.find(metric => metric.code === sberIdNavigatorCode);
if (sberIdNavigatorApprovals.length !== 1 || !matchesSberId(sberIdNavigatorApproval.team)
  || sberIdNavigatorApproval.data.scope !== 'q3-score-correction' || sberIdNavigatorApproval.data.period !== 'III кв. 2026'
  || sberIdNavigatorApproval.code !== sberIdNavigatorCode || sberIdNavigatorApproval.fact.rawValue !== 1
  || sberIdNavigatorApproval.fact.source.date !== '2026-11-12'
  || sberIdNavigatorApproval.fact.source.previousAssessment?.value !== 0.25
  || sberIdNavigatorApproval.fact.source.previousAssessment.maxValue !== 0.5
  || sberIdNavigatorApproval.fact.source.previousAssessment.priorFact?.rawValue !== 0.5
  || !isDirectNavigatorOverride(sberIdProduct, sberIdNavigator)
  || sberIdNavigator.value !== 0.5 || sberIdNavigator.max_value !== 0.5
  || sberIdNavigator.source.approvalGroup !== sberIdNavigatorGroup || sberIdNavigator.source.priorityOverWorkbook !== true
  || sberIdNavigator.excluded_from_index !== false || sberIdNavigator.dd_calculation_flg !== 1
  || !sberIdNavigator.recommendation_items?.every(item => item.value === 0.5 && item.max_value === 0.5 && item.gap === 0)) {
  throw new Error('SberID Q3 Navigator knowledge must retain the explicitly approved 100% score and original rubric.');
}
const premierInitiativesGroup = 'premier-attract-initiatives-2026-11-11';
const premierInitiativesCode = 'attract.initiatives_list';
const matchesPremier = (team) => String(team.id).replace(/::empty::.*/, '') === 'cf93b82b-89a1-588c-992b-ed349f585aa0¦Пакет услуг СберПремьер'
  && team.name === 'Пакет услуг СберПремьер' && team.unit === 'CX' && team.type === 'Продукт';
const premierApprovals = overlays.flatMap(({data}) => (data.products || []).flatMap(team =>
  Object.entries(team.metrics || {}).filter(([, fact]) => fact.source?.approvalGroup === premierInitiativesGroup
    || fact.source?.correction?.approvalGroup === premierInitiativesGroup).map(([code, fact]) => ({data, team, code, fact}))));
const premierApproval = premierApprovals[0];
const premierMetric = approvedKnowledgeProducts.find(matchesPremier)?.metrics.find(block => block.code === 'attract')
  ?.metrics.find(metric => metric.code === premierInitiativesCode);
if (premierApprovals.length !== 1 || !matchesPremier(premierApproval.team) || premierApproval.code !== premierInitiativesCode
  || premierApproval.data.scope !== 'q3-score-correction' || premierApproval.data.period !== 'III кв. 2026'
  || premierApproval.fact.rawValue !== 1 || !approvedKnowledgeProof(premierApproval.fact.source, premierInitiativesGroup)
  || !approvedKnowledgeProof(premierApproval.fact.source.correction, premierInitiativesGroup)
  || premierApproval.fact.source.correction.rawValue !== 1
  || premierApproval.fact.source.previousAssessment?.value !== 0.5 || premierApproval.fact.source.previousAssessment.maxValue !== 1
  || premierMetric?.value !== 1 || premierMetric.max_value !== 1 || premierMetric.is_applicabble_flg !== true
  || premierMetric.excluded_from_index !== false || premierMetric.dd_calculation_flg !== 1
  || !approvedKnowledgeProof(premierMetric.source, premierInitiativesGroup)
  || !premierMetric.recommendation_items?.every(item => item.value === 1 && item.max_value === 1 && item.gap === 0)) {
  throw new Error('SberPremier Q3 attraction initiatives must retain the approved 100% score and original rubric.');
}
const smileMarketCode = 'general.obъem_celevogo_rynka_v_rossii';
const smileMarketGroup = 'smile-russia-market-2026-11-11';
const matchesSmile = (team) => String(team.id).replace(/::empty::.*/, '') === '11a243e6-5b73-56ad-8ac7-203e0d744062¦Оплата улыбкой'
  && team.name === 'Оплата улыбкой' && team.unit === 'DB' && team.type === 'Продукт';
const smileApprovals = overlays.flatMap(({data}) => (data.products || []).flatMap(team =>
  Object.entries(team.metrics || {}).filter(([, fact]) => fact.source?.approvalGroup === smileMarketGroup
    || fact.source?.correction?.approvalGroup === smileMarketGroup).map(([code, fact]) => ({data, team, code, fact}))));
const smileApproval = smileApprovals[0];
const beforeSmileOverlays = structuredClone(overlays.map(item => item.data));
for (const assessment of beforeSmileOverlays.filter(item => item.scope === 'q3-score-correction')) {
  for (const team of (assessment.products || []).filter(matchesSmile)) delete team.metrics[smileMarketCode];
}
const beforeSmile = buildDdiPeriodProducts(source.products, 'III кв. 2026', beforeSmileOverlays,
  salary, reportingMissing, actionMissing).find(matchesSmile);
const smile = approvedKnowledgeProducts.find(matchesSmile);
const generalMetric = (team, code) => team?.metrics.find(block => block.code === 'general')?.metrics.find(metric => metric.code === code);
const smileMarket = generalMetric(smile, smileMarketCode);
const beforeSmileMarket = generalMetric(beforeSmile, smileMarketCode);
const smileNavigator = generalMetric(smile, navigatorCode);
const beforeSmileNavigator = generalMetric(beforeSmile, navigatorCode);
const savedSmileNavigator = smileApproval?.fact.source?.preservedNavigatorAssessment;
if (smileApprovals.length !== 1 || !matchesSmile(smileApproval.team) || smileApproval.code !== smileMarketCode
  || smileApproval.data.scope !== 'q3-score-correction' || smileApproval.data.period !== 'III кв. 2026'
  || smileApproval.fact.rawValue !== 1 || !approvedKnowledgeProof(smileApproval.fact.source, smileMarketGroup)
  || !approvedKnowledgeProof(smileApproval.fact.source.correction, smileMarketGroup)
  || smileApproval.fact.source.correction.rawValue !== 1 || beforeSmileMarket?.value !== 0
  || smileMarket?.value !== 0.2 || smileMarket.max_value !== beforeSmileMarket.max_value
  || smileMarket.is_applicabble_flg !== beforeSmileMarket.is_applicabble_flg
  || !approvedKnowledgeProof(smileMarket.source, smileMarketGroup)
  || beforeSmileNavigator?.value !== 0.5 || beforeSmileNavigator.max_value !== 0.5
  || !isDeepStrictEqual(smileNavigator, beforeSmileNavigator)
  || savedSmileNavigator?.code !== navigatorCode || savedSmileNavigator.value !== beforeSmileNavigator.value
  || savedSmileNavigator.maxValue !== beforeSmileNavigator.max_value || savedSmileNavigator.rawValue !== 1
  || !isDeepStrictEqual(savedSmileNavigator.source, beforeSmileNavigator.source)) {
  throw new Error('Smile Q3 Russia-market knowledge must be 100%, preserving the entire standing Navigator assessment.');
}
const osagoFlexibleCode = 'mehaniki.gibkoe_izmenenie_usloviy_produkta';
const osagoFlexibleGroup = 'osago-flexible-max-2026-11-11';
const osagoFlexibleTeam = {id: '16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО', name: 'ОСАГО', unit: 'УБ', type: 'Продукт'};
const matchesOsagoFlexibleTeam = (team) => String(team.id).replace(/::empty::.*/, '') === osagoFlexibleTeam.id
  && ['name', 'unit', 'type'].every(key => team[key] === osagoFlexibleTeam[key]);
const osagoFlexibleFact = overlays.find(({data}) => data.scope === 'q3-score-correction' && data.period === 'III кв. 2026')
  ?.data.products.find(matchesOsagoFlexibleTeam)?.metrics[osagoFlexibleCode];
const osagoFlexibleProduct = finalProducts.find(matchesOsagoFlexibleTeam);
const osagoFlexibleMetric = osagoFlexibleProduct?.metrics.find(block => block.code === 'mehaniki')
  ?.metrics.find(metric => metric.code === osagoFlexibleCode);
const osagoFlexiblePrior = source.products.find(team => team.period === 'II кв. 2026' && matchesOsagoFlexibleTeam(team))
  ?.metrics.find(block => block.code === 'mehaniki')?.metrics.find(metric => metric.code === osagoFlexibleCode);
if (!osagoFlexibleFact || osagoFlexibleFact.rawValue !== 0 || osagoFlexibleFact.maxValueOverride !== 1.5
  || !approvedKnowledgeProof(osagoFlexibleFact.source, osagoFlexibleGroup)
  || !approvedKnowledgeProof(osagoFlexibleFact.source.correction, osagoFlexibleGroup)
  || osagoFlexibleFact.source.correction.rawValue !== 0 || osagoFlexibleFact.source.correction.maxValueOverride !== 1.5
  || osagoFlexibleFact.source.previousAssessment?.value !== 0 || osagoFlexibleFact.source.previousAssessment.maxValue !== 1
  || osagoFlexiblePrior?.max_value !== 1 || osagoFlexibleMetric?.max_value !== 1.5 || osagoFlexibleMetric.value !== 0
  || osagoFlexibleMetric.previousMaxValue !== 1 || osagoFlexibleMetric.previousValue !== 0
  || osagoFlexibleMetric.is_applicabble_flg !== osagoFlexiblePrior.is_applicabble_flg
  || osagoFlexibleMetric.excluded_from_index !== osagoFlexiblePrior.excluded_from_index
  || osagoFlexibleMetric.dd_calculation_flg !== osagoFlexiblePrior.dd_calculation_flg
  || !approvedKnowledgeProof(osagoFlexibleMetric.source, osagoFlexibleGroup)
  || !osagoFlexibleMetric.recommendation_items?.length
  || !osagoFlexibleMetric.recommendation_items.every(item => item.value === 0 && item.max_value === 1.5 && item.gap === 1.5)
  || osagoFlexibleProduct.indexMaxPoints !== osagoFlexibleProduct.metrics.flatMap(block => block.metrics)
    .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(metric.max_value), 0)) {
  throw new Error('OSAGO Q3 flexible-conditions maximum must be 1.5, preserving earned0, Q2maximum1 and applicability.');
}
const frozenCrossSell = overlays.find(({data}) => data.scope === 'frozen-q3-crosssell-scores')?.data;
if (!frozenCrossSell || frozenCrossSell.products?.length !== finalProducts.length) {
  throw new Error('Frozen Q3 Cross-sell snapshot roster is incomplete');
}
const frozenCrossSellMetric = (product) => product.metrics.flatMap((block) => block.metrics || [])
  .find((metric) => metric.code === 'mehaniki.cross_sell');
const validateFrozenCrossSellRecord = (product, record, label) => {
  const metric = frozenCrossSellMetric(product);
  if (Boolean(metric) !== record.present) errors.push(`${label}: frozen Cross-sell presence changed`);
  if (!record.present) return;
  for (const key of ['value', 'max_value', 'is_applicabble_flg', 'excluded_from_index', 'dd_calculation_flg', 'source', 'crossSellComponents', 'recommendation_items']) {
    if (!isDeepStrictEqual(metric?.[key], record.metric?.[key])) errors.push(`${label}: frozen Cross-sell ${key} changed`);
  }
};
const frozenPresentCount = frozenCrossSell.products.filter((record) => record.present).length;
if (frozenPresentCount !== 59 || frozenCrossSell.products.length - frozenPresentCount !== 17) {
  errors.push(`Frozen Q3 Cross-sell expected 59 scored and 17 absent teams, got ${frozenPresentCount} scored and ${frozenCrossSell.products.length - frozenPresentCount} absent`);
}
for (const record of frozenCrossSell.products) {
  const product = finalProducts.find((item) => item.name === record.name && item.unit === record.unit && item.type === record.type);
  if (!product) {errors.push(`Frozen Q3 Cross-sell missing team ${record.unit} / ${record.name}`); continue;}
  validateFrozenCrossSellRecord(product, record, `${record.unit} / ${record.name}`);
  if (record.salaryCohorts) {
    for (const [key, cohortRecord] of Object.entries(record.salaryCohorts)) {
      const cohort = product.salaryCohorts?.[key];
      if (!cohort) {errors.push(`Frozen Q3 Cross-sell missing salary cohort ${key}`); continue;}
      validateFrozenCrossSellRecord(cohort, cohortRecord ? {present: true, metric: cohortRecord} : {present: false}, `${record.unit} / ${record.name} / ${key}`);
    }
  }
}
if (errors.length) throw new Error(`Frozen Q3 Cross-sell scores would change; build stopped:\n${errors.filter((error) => error.includes('frozen Cross-sell') || error.includes('Frozen Q3 Cross-sell')).join('\n')}`);
const keyWorkbook = overlays.find(({data}) => data.scope === 'key-metrics-assessment'
  && data.period === 'III кв. 2026' && data.source?.file === 'Ключевые метрики Продукта Баллы.xlsx')?.data;
const sameWorkbookTeam = (a, b) => String(a.id).replace(/::empty::.*/, '') === String(b.id).replace(/::empty::.*/, '')
  && ['name', 'unit', 'type'].every((key) => a[key] === b[key]);
function expectedWorkbookValue(product, metric) {
  if (!keyWorkbook?.source.metricCodes.includes(metric?.code) || metric.is_applicabble_flg === false || !(metric.max_value > 0)) return undefined;
  const directQ3Correction = overlays.find(({data}) => data.scope === 'q3-score-correction')?.data.products
    ?.find((team) => sameWorkbookTeam(team, product))?.metrics?.[metric.code];
  if (directQ3Correction?.source?.correction?.origin === 'userConfirmedQ3ScoreCorrection'
    && directQ3Correction.source.correction.confirmedBy === 'user'
    && directQ3Correction.source.correction.period === 'III кв. 2026') {
    return {value: directQ3Correction.rawValue * metric.max_value};
  }
  if (isDirectNavigatorOverride(product, metric) && metric.source.priorityOverWorkbook === true) {
    return {value: metric.source.rawValue * metric.max_value};
  }
  if (metric.code === 'general.navigator_reporting_knowledge' && metric.source?.origin === 'userConfirmedKeyMetricsAccuracyCap') {
    return {value: 0.5 * metric.max_value};
  }
  const priors = source.products.filter((old) => old.period === 'II кв. 2026' && sameWorkbookTeam(old, product));
  const team = [...keyWorkbook.products, ...(keyWorkbook.additionalTeamAssessments || [])].find((item) => sameWorkbookTeam(item, product));
  const pending = keyWorkbook.pending.some((item) => sameWorkbookTeam(item, product) && item.metricCode === metric.code);
  const restored = keyWorkbook.pending.find((item) => sameWorkbookTeam(item, product) && item.metricCode === metric.code)?.restoredAssessment;
  if (restored) return {value: restored.rawValue * metric.max_value};
  if (priors.length !== 1 && !team && !pending) return undefined;
  if (pending) return {value: null};
  const fact = team?.metrics[metric.code];
  if (fact?.source?.origin === 'keyMetricsWorkbookAssessment' && [0, 1].includes(fact.rawValue)) return {value: fact.rawValue * metric.max_value};
  if (product.name === 'ДСЖ ПК' && product.unit === 'УБ' && metric.code === 'general.navigator_reporting_knowledge') {
    return {value: navigatorKnowledgeFraction(product.metrics.flatMap(block => block.metrics)) * metric.max_value};
  }
  if (product.salaryCohorts) {
    const pair = Object.values(product.salaryCohorts).map((cohort) => cohort.metrics.find((block) => block.code === 'general')?.metrics.find((item) => item.code === metric.code));
    if (pair.length !== 2 || pair.some((item) => !item || item.max_value !== metric.max_value)) return undefined;
    return {value: pair.every((item) => Number.isFinite(item.value)) ? (pair[0].value + pair[1].value) / 2 : null};
  }
  if (priors.length !== 1) return undefined;
  const old = priors[0].metrics.find((block) => block.code === 'general')?.metrics.find((item) => item.code === metric.code);
  return {value: old?.is_applicabble_flg !== false && old?.max_value > 0 && Number.isFinite(old.value)
    && old.value >= 0 && old.value <= old.max_value ? old.value / old.max_value * metric.max_value : null};
}
for (const product of finalProducts) {
  for (const metric of product.metrics.filter((block) => block.code === 'general').flatMap((block) => block.metrics)) {
    const expected = expectedWorkbookValue(product, metric);
    if (expected && metric.value !== expected.value) throw new Error(`Final workbook priority lost: ${product.name} / ${metric.code}`);
  }
}
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
  if (expectedWorkbookValue(product, navigator)) continue; // Validated against the workbook and Q2 above.
  const fraction = navigatorKnowledgeFraction(metrics);
  const uncappedNavigatorValue = fraction === null ? null : fraction * navigator?.max_value;
  const expectedNavigatorValue = navigator?.source?.origin === 'userConfirmedKeyMetricsAccuracyCap'
    && Number.isFinite(uncappedNavigatorValue)
    ? Math.min(uncappedNavigatorValue, Number(navigator.source.rawValue) * Number(navigator.max_value))
    : uncappedNavigatorValue;
  if (!isInvestKopilkaNavigatorOverride(product, navigator) && !isDirectNavigatorOverride(product, navigator)
    && fraction !== undefined && navigator?.is_applicabble_flg !== false && navigator?.max_value > 0
    && navigator.value !== expectedNavigatorValue) {
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
    const workbookExpected = expectedWorkbookValue(product, metric);
    const expected = workbookExpected ? workbookExpected.value : fact.rawValue === null ? null : fact.rawValue * metric?.max_value;
    if (!metric || metric.value !== expected) throw new Error(`Salary assessment lost: ${child.name} / ${code}`);
  }
  for (const code of child.unassignedAggregateMetricCodes || []) {
    const metric = metrics.find((m) => m.code === code);
    const crossSellDuringFact = code === 'mehaniki.cross_sell'
      ? overlays.find(({data}) => data.scope === 'crosssell-during-purchase-assessment')?.data.products
        .find((team) => team.id === child.baseTeamId)?.metrics?.[code] : null;
    if (crossSellDuringFact) {
      if (metric?.crossSellComponents?.during?.value !== crossSellDuringFact.rawValue * metric.max_value / 2
        || metric.crossSellComponents?.during?.source?.origin !== 'userConfirmedCrossSellDuringPurchase'
        || metric.crossSellComponents?.after?.rawValue !== child.crossSellAfterPurchase?.rawValue) {
        throw new Error(`Confirmed during/after-purchase Cross-sell was lost: ${child.name}`);
      }
      continue;
    }
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
    if (block.code === 'general') {
      const expected = expectedWorkbookValue(combinedSalary, metric);
      if (expected) {
        if (metric.value !== expected.value) throw new Error(`Combined salary workbook priority lost: ${metric.code}`);
        continue;
      }
    }
    const pair = ['b2b', 'b2c'].map((key) => combinedSalary.salaryCohorts[key].metrics.flatMap((item) => item.metrics)
      .find((item) => item.code === metric.code));
    const eligible = pair.every((item) => item && item.is_applicabble_flg !== false && item.max_value > 0)
      && pair[0].max_value === pair[1].max_value;
    const expected = eligible && pair.every((item) => Number.isFinite(item.value)) ? (pair[0].value + pair[1].value) / 2 : null;
    const isConfirmedCrossSellOverride = metric.code === 'mehaniki.cross_sell'
      && metric.source?.origin === 'crossSellComponentSum'
      && metric.crossSellComponents?.during?.source?.origin === 'userConfirmedCrossSellDuringPurchase';
    if (metric.value !== expected || (metric.source?.origin !== 'salaryCohortAverage' && !isConfirmedCrossSellOverride)) {
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
    if (!metric || (hiddenReportingFacts.has(factKey(team, code))
      ? metric.value !== null || metric.is_applicabble_flg !== false || metric.hidden_from_profile !== true
      : metric.value !== effectiveFact.rawValue * metric.max_value)) {
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
    const directFact = overlays.filter(({data}) => data.period === 'III кв. 2026' && data.scope === 'funnel-user-assessment')
      .flatMap(({data}) => data.products || []).filter(record => sameWorkbookTeam(record, product) && record.metrics?.[code])
      .at(-1)?.metrics[code];
    const latestCorrectionFact = latestCorrectionFacts.get(factKey(team, code));
    const expectedRaw = latestCorrectionFact ? latestCorrectionFact.rawValue
      : directFact?.source?.confirmedBy === 'user' && [0, .5, 1].includes(directFact.rawValue)
        ? directFact.rawValue : fact.rawValue;
    if (!['attract.initiatives_list', 'churn.deviation_actions'].includes(code)
      || ![0, 1].includes(fact.rawValue) || !metric || metric.value !== expectedRaw * metric.max_value) {
      throw new Error(`Funnel action fill lost: ${team.name} / ${code}`);
    }
    actionsFilled++;
  }
}
const absenceAssessments = overlays.filter(({data}) => data.scope === 'reporting-absence-assessment');
const absenceInputs = overlays.filter(({data}) => !data.applyAfterReporting);
const beforeAbsence = buildAutomaticPeriodProducts(source.products, 'III кв. 2026',
  absenceInputs.filter(({data}) => data.scope !== 'reporting-absence-assessment').map(({data}) => data), salary, reportingMissing, actionMissing);
const afterAbsence = buildAutomaticPeriodProducts(source.products, 'III кв. 2026',
  absenceInputs.map(({data}) => data), salary, reportingMissing, actionMissing);
const absenceAssessmentProducts = afterAbsence.flatMap(product => [product, ...Object.values(product.salaryCohorts || {})]);
const beforeAbsenceTeams = beforeAbsence.flatMap(product => [product, ...Object.values(product.salaryCohorts || {})]);
let absenceChanges = 0;
for (const product of absenceAssessmentProducts) {
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
      const preserved = dependent && proof?.preserveMetricCodes?.includes(metric.code);
      const expected = eligible && !preserved && (metric.code === proof.reportingCode || dependent)
        && old.is_applicabble_flg !== false && old.max_value > 0 ? 0 : old.value;
      if (metric.value !== expected || metric.max_value !== old.max_value || metric.is_applicabble_flg !== old.is_applicabble_flg) {
        throw new Error(`Reporting absence rule changed an unauthorized value: ${product.name} / ${metric.code}`);
      }
      if (metric.value !== old.value) absenceChanges++;
    }
  }
}
const exclusionAssessments = overlays.filter(({data}) => data.scope === 'metric-index-exclusion-assessment');
const beforeExclusions = buildAutomaticPeriodProducts(source.products, 'III кв. 2026',
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

const ubWorkbookAssessment = overlays.find(({data}) => data.scope === 'ub-workbook-corrections')?.data;
const actualFinalProducts = buildDdiPeriodProducts(source.products, 'III кв. 2026', overlays.map(item => item.data)
  .filter(item => !['cbp-user-corrections', 'cx-user-corrections'].includes(item.scope)), salary, reportingMissing, actionMissing);
let ubWorkbookChecked = 0;
for (const product of actualFinalProducts) {
  const prior = finalProducts.find(team => team.id === product.id);
  const record = ubWorkbookAssessment?.products.find(team => team.id === product.id.replace(/::empty::.*/, '')
    && ['name', 'unit', 'type'].every(key => team[key] === product[key]));
  if (!record) {
    if (JSON.stringify(product) !== JSON.stringify(prior)) throw new Error(`UB workbook changed an unselected team: ${product.name}`);
    continue;
  }
  if (product.unit !== 'УБ') throw new Error(`UB workbook includes another unit: ${product.name}`);
  for (const metric of product.metrics.flatMap(block => block.metrics)) {
    const old = prior.metrics.flatMap(block => block.metrics).find(item => item.code === metric.code);
    const fact = record.metrics[metric.code];
    const during = metric.code === 'mehaniki.cross_sell' && record.metrics[metric.code + '.during'];
    const after = metric.code === 'mehaniki.cross_sell' && record.metrics[metric.code + '.after'];
    if (!fact && !during && !after) {
      if (JSON.stringify(metric) !== JSON.stringify(old)) throw new Error(`UB workbook changed an unselected metric: ${product.name} / ${metric.code}`);
      continue;
    }
    if (fact?.applicable === false) {
      if (metric.value !== null || metric.max_value !== 0 || metric.is_applicabble_flg !== false || !metric.excluded_from_index) {
        throw new Error(`UB workbook non-applicability lost: ${product.name} / ${metric.code}`);
      }
      ubWorkbookChecked++;
    } else if (fact) {
      const laterCorrection = old.source?.origin === 'userConfirmedQ3ScoreCorrection'
        && old.source.confirmedBy === 'user' && old.source.correction?.period === 'III кв. 2026';
      const laterCampaign = old.source?.origin === 'userConfirmedCampaignPresence20261102';
      if (laterCorrection || laterCampaign ? JSON.stringify(metric) !== JSON.stringify(old)
        : metric.value !== fact.rawValue * old.max_value || metric.max_value !== old.max_value
          || metric.source?.cell !== fact.source.cell) throw new Error(`UB workbook correction lost: ${product.name} / ${metric.code}`);
      ubWorkbookChecked++;
    } else {
      for (const [key, part] of [['during', during], ['after', after]]) {
        const actual = metric.crossSellComponents[key];
        if (part) {
          if (actual.value !== part.rawValue * metric.max_value / 2 || actual.source?.cell !== part.source.cell) {
            throw new Error(`UB workbook Cross-sell component lost: ${product.name} / ${key}`);
          }
          ubWorkbookChecked++;
        } else if (JSON.stringify(actual) !== JSON.stringify(old.crossSellComponents[key])) {
          throw new Error(`UB workbook changed another Cross-sell component: ${product.name} / ${key}`);
        }
      }
    }
  }
}
if (ubWorkbookChecked !== ubWorkbookAssessment?.counts.corrections || ubWorkbookChecked !== 50) {
  throw new Error(`UB workbook correction coverage changed: ${ubWorkbookChecked}`);
}
console.log(`UB workbook: ${ubWorkbookChecked} F-column corrections verified; all unselected teams and metrics preserved.`);
const cbpAssessment = overlays.find(({data}) => data.scope === 'cbp-user-corrections')?.data;
if (cbpAssessment) {
  if (cbpAssessment.period !== 'III кв. 2026' || cbpAssessment.unit !== 'CBP'
    || cbpAssessment.source?.origin !== 'userConfirmedCbpCorrections20261102'
    || cbpAssessment.source.confirmedBy !== 'user') throw new Error('CBP correction source is invalid');
  const cbpFinalProducts = buildDdiPeriodProducts(source.products, 'III кв. 2026', overlays.map(item => item.data)
    .filter(item => item.scope !== 'cx-user-corrections'), salary, reportingMissing, actionMissing);
  let cbpChecked = 0;
  for (const product of cbpFinalProducts) {
    const prior = actualFinalProducts.find(team => team.id === product.id);
    const records = cbpAssessment.products.filter(team => team.id === product.id.replace(/::empty::.*/, '')
      && ['name', 'unit', 'type'].every(key => team[key] === product[key]));
    if (!records.length) {
      if (JSON.stringify(product) !== JSON.stringify(prior)) throw new Error(`CBP correction changed another team: ${product.name}`);
      continue;
    }
    if (records.length !== 1 || product.unit !== 'CBP' || product.type !== 'Продукт') throw new Error(`CBP correction identity is invalid: ${product.name}`);
    const record = records[0];
    for (const metric of product.metrics.flatMap(block => block.metrics)) {
      const old = prior.metrics.flatMap(block => block.metrics).find(item => item.code === metric.code);
      const fact = record.metrics[metric.code] || (metric.code === 'mehaniki.cross_sell' && record.metrics[metric.code + '.during']);
      if (!fact) {
        if (JSON.stringify(metric) !== JSON.stringify(old)) throw new Error(`CBP correction changed another metric: ${product.name} / ${metric.code}`);
        continue;
      }
      if (fact.source?.confirmedBy !== 'user' || fact.source.origin !== 'userConfirmedCbpCorrections20261102'
        || fact.source.period !== 'III кв. 2026' || fact.source.sourceUnit !== 'CBP'
        || !Number.isInteger(fact.source.inputRow)) throw new Error(`CBP correction fact is invalid: ${product.name} / ${metric.code}`);
      if (fact.applicable === false) {
        if (metric.value !== null || metric.max_value !== 0 || metric.is_applicabble_flg !== false || metric.dd_calculation_flg !== 0
          || !metric.excluded_from_index) throw new Error(`CBP non-applicability lost: ${product.name} / ${metric.code}`);
      } else if (metric.code === 'mehaniki.cross_sell') {
        const after = metric.crossSellComponents?.after;
        const expected = after?.applicable === false ? fact.rawValue * old.max_value / 2
          : Math.min(old.max_value, fact.rawValue * old.max_value / 2 + after?.value);
        if (metric.crossSellComponents?.during?.value !== fact.rawValue * old.max_value / 2
          || JSON.stringify(after) !== JSON.stringify(old.crossSellComponents?.after) || metric.value !== expected) {
          throw new Error(`CBP Cross-sell component lost: ${product.name}`);
        }
      } else if (metric.value !== fact.rawValue * old.max_value || metric.max_value !== old.max_value
        || metric.source?.inputRow !== fact.source.inputRow) throw new Error(`CBP correction lost: ${product.name} / ${metric.code}`);
      const baseGoal = Object.keys(GOALS_FINAL_COUNTERPARTS).find(code => GOALS_FINAL_COUNTERPARTS[code] === metric.code);
      if (baseGoal) {
        const block = product.metrics.find(item => item.code === 'goals');
        const oldBlock = prior.metrics.find(item => item.code === 'goals');
        if (block.goalsFinalScores[baseGoal] !== fact.rawValue || metric.source?.level !== 'final'
          || JSON.stringify(block.goalsPoLevelMetrics) !== JSON.stringify(oldBlock.goalsPoLevelMetrics)) throw new Error(`CBP final goals metadata lost: ${product.name}`);
      }
      cbpChecked++;
    }
    const expectedMax = product.metrics.flatMap(block => block.metrics).filter(isDdIndexMetric).reduce((sum, metric) => sum + metric.max_value, 0);
    if (product.indexMaxPoints !== expectedMax) throw new Error(`CBP correction denominator is inconsistent: ${product.name}`);
  }
  if (cbpChecked !== 46) throw new Error(`CBP correction coverage changed: ${cbpChecked}`);
  console.log(`CBP corrections: ${cbpChecked} user rows verified; unrelated teams and metrics preserved.`);
}
const cxAssessment = overlays.find(({data}) => data.scope === 'cx-user-corrections')?.data;
if (cxAssessment) {
  if (cxAssessment.period !== 'III кв. 2026' || cxAssessment.unit !== 'CX'
    || cxAssessment.source?.origin !== 'userConfirmedCxCorrections20261102'
    || cxAssessment.source.confirmedBy !== 'user') throw new Error('CX correction source is invalid');
  const cxFinalProducts = buildDdiPeriodProducts(source.products, 'III кв. 2026', overlays.map(item => item.data)
    .filter(item => item.scope !== 'cbp-user-corrections'), salary, reportingMissing, actionMissing);
  let cxChecked = 0;
  for (const product of cxFinalProducts) {
    const prior = actualFinalProducts.find(team => team.id === product.id);
    const records = cxAssessment.products.filter(team => team.id === product.id.replace(/::empty::.*/, '')
      && ['name', 'unit', 'type'].every(key => team[key] === product[key]));
    if (!records.length) {
      if (JSON.stringify(product) !== JSON.stringify(prior)) throw new Error(`CX correction changed another team: ${product.name}`);
      continue;
    }
    if (records.length !== 1 || product.unit !== 'CX') throw new Error(`CX correction identity is invalid: ${product.name}`);
    const record = records[0];
    for (const [code, fact] of Object.entries(record.metrics)) {
      const metric = product.metrics.flatMap(block => block.metrics).find(item => item.code === code);
      if (!metric && product.name === 'СберСпасибо' && code === 'churn.benchmarks' && fact.applicable === false) {
        cxChecked++;
        continue;
      }
      if (!metric) throw new Error(`CX correction metric is missing: ${product.name} / ${code}`);
      const old = prior.metrics.flatMap(block => block.metrics).find(item => item.code === code);
      if (fact.source?.confirmedBy !== 'user' || fact.source.origin !== 'userConfirmedCxCorrections20261102'
        || fact.source.period !== 'III кв. 2026' || fact.source.sourceUnit !== 'CX'
        || !Number.isInteger(fact.source.inputRow)) throw new Error(`CX correction fact is invalid: ${product.name} / ${code}`);
      if (fact.applicable === false) {
        if (metric.value !== null || metric.max_value !== 0 || metric.is_applicabble_flg !== false || metric.dd_calculation_flg !== 0
          || !metric.excluded_from_index) throw new Error(`CX non-applicability lost: ${product.name} / ${code}`);
      } else if (!old || metric.value !== fact.rawValue * old.max_value || metric.max_value !== old.max_value
        || metric.source?.inputRow !== fact.source.inputRow) throw new Error(`CX correction lost: ${product.name} / ${code}`);
      const baseGoal = Object.keys(GOALS_FINAL_COUNTERPARTS).find(code => GOALS_FINAL_COUNTERPARTS[code] === metric.code);
      if (baseGoal) {
        const block = product.metrics.find(item => item.code === 'goals');
        const oldBlock = prior.metrics.find(item => item.code === 'goals');
        if (block.goalsFinalScores[baseGoal] !== fact.rawValue || metric.source?.level !== 'final'
          || JSON.stringify(block.goalsPoLevelMetrics) !== JSON.stringify(oldBlock.goalsPoLevelMetrics)) {
          throw new Error(`CX final goals metadata lost: ${product.name}`);
        }
      }
      cxChecked++;
    }
    const expectedMax = product.metrics.flatMap(block => block.metrics).filter(isDdIndexMetric).reduce((sum, metric) => sum + metric.max_value, 0);
    if (product.indexMaxPoints !== expectedMax) throw new Error(`CX correction denominator is inconsistent: ${product.name}`);
  }
  if (cxChecked !== 51) throw new Error(`CX correction coverage changed: ${cxChecked}`);
  console.log(`CX corrections: ${cxChecked} user rows verified; unrelated teams and metrics preserved.`);
}
console.log(`Funnel action blanks filled: ${actionsFilled}; existing scores preserved.`);
console.log(`Reporting blanks filled: ${reportingFilled}; existing scores preserved.`);
console.log(`Manual Q3 assessments preserved: ${checked} values checked across ${products.length} teams.`);
console.log(`Q3 roster preserved: ${finalProducts.length} teams; Daily Banking: ${dbNames.length}.`);

const backlogForDiscovery = JSON.parse(fs.readFileSync(path.join(root, 'public/backlog-data.json'), 'utf8'));
const allAssessments = overlays.map(item => item.data);
const beforeDiscoveryBacklog = buildDdiPeriodProducts(source.products, 'III кв. 2026', allAssessments, salary, reportingMissing, actionMissing);
const afterDiscoveryBacklog = buildDdiPeriodProducts(source.products, 'III кв. 2026', allAssessments, salary, reportingMissing, actionMissing, backlogForDiscovery);
let discoveryBacklogChecked = 0;
function verifyDiscoveryBacklogChanges(current, prior) {
  const product = structuredClone(current);
  const cohortChanged = current.salaryCohorts && Object.keys(current.salaryCohorts)
    .some(key => !isDeepStrictEqual(current.salaryCohorts[key], prior.salaryCohorts[key]));
  if (cohortChanged) {
    for (const [key, cohort] of Object.entries(current.salaryCohorts)) {
      verifyDiscoveryBacklogChanges(cohort, prior.salaryCohorts[key]);
    }
    product.salaryCohorts = prior.salaryCohorts;
  }
  for (let bi = 0; bi < product.metrics.length; bi++) for (let mi = 0; mi < product.metrics[bi].metrics.length; mi++) {
    const metric = product.metrics[bi].metrics[mi];
    if (cohortChanged && metric.code === 'hyp.discovery_40_backlog' && metric.source?.origin === 'salaryCohortAverage') {
      const cohorts = ['b2b', 'b2c'].map(key => current.salaryCohorts[key].metrics.flatMap(block => block.metrics).find(item => item.code === metric.code));
      const old = prior.metrics[bi].metrics[mi];
      const compatible = cohorts.every(item => item?.is_applicabble_flg !== false && item?.max_value > 0)
        && cohorts[0].max_value === cohorts[1].max_value;
      const expected = compatible && cohorts.every(item => Number.isFinite(item.value))
        ? (cohorts[0].value + cohorts[1].value) / 2 : null;
      if (metric.value !== expected || metric.max_value !== old.max_value || metric.is_applicabble_flg !== old.is_applicabble_flg
        || ['b2b', 'b2c'].some((key, index) => !isDeepStrictEqual(metric.source.cohorts[key], {
          value: cohorts[index].value, maxValue: cohorts[index].max_value,
          applicable: cohorts[index].is_applicabble_flg !== false && cohorts[index].max_value > 0, source: cohorts[index].source,
        }))) throw new Error(`Discovery cohort average failed: ${product.name}`);
      product.metrics[bi].metrics[mi] = old;
      discoveryBacklogChecked++;
      continue;
    }
    if (metric.source?.origin !== 'userConfirmedDiscoveryBacklogPriority20261102') continue;
    const proof = metric.source, old = prior.metrics[bi].metrics[mi];
    const expected = proof.discoveryCount * 100 >= proof.createdCount * 40 ? 1
      : proof.discoveryCount * 100 >= proof.createdCount * 20 ? .5 : 0;
    if (metric.code !== 'hyp.discovery_40_backlog' || metric.value !== expected * old.max_value
      || metric.max_value !== old.max_value || metric.is_applicabble_flg !== old.is_applicabble_flg) {
      throw new Error(`Discovery decomposition rule failed: ${product.name}`);
    }
    product.metrics[bi].metrics[mi] = old;
    discoveryBacklogChecked++;
  }
  if (JSON.stringify(product) !== JSON.stringify(prior)) throw new Error(`Discovery decomposition changed another field: ${product.name}`);
}
for (let i = 0; i < afterDiscoveryBacklog.length; i++) {
  verifyDiscoveryBacklogChanges(afterDiscoveryBacklog[i], beforeDiscoveryBacklog[i]);
}
for (const [name, expected] of [['PB', 0], ['Пакет услуг СберПремьер', .5], ['МВС', .5]]) {
  const metric = afterDiscoveryBacklog.find(p => p.name === name)?.metrics.flatMap(b => b.metrics).find(m => m.code === 'hyp.discovery_40_backlog');
  if (!metric || metric.value !== expected * metric.max_value) throw new Error(`Discovery decomposition priority lost: ${name}`);
}
console.log(`Discovery: ${discoveryBacklogChecked} Q3 decomposition assessments verified; all other fields preserved.`);
