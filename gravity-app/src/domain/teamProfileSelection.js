import {getReportPeriods} from './reportPeriods.js';
import {completeBlockPercent, isDdIndexMetric, radarBlockPercent} from './report.js';
import {sumCrossSellComponents} from './crossSellDecomposition.js';
import {applyCxScoreAssessments} from './cxScoreAssessment.js';
import {applyAbTestsAssessments} from './abTestsAssessment.js';
import {applyQuarterRetentionAssessments} from './quarterRetentionAssessment.js';
import {applyMetricApplicabilityAssessments} from './metricApplicability.js';
import {applyGoalsInformationalAssessments} from './goalsInformationalAssessment.js';
import {applyPoGoalsTemplate} from './goalsProfileLevels.js';
import {linksForBlock} from '../features/catalog/blockLinks.js';

const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
const collator = new Intl.Collator('en', {sensitivity: 'base', numeric: true});
const compare = (a, b) => collator.compare(String(a || ''), String(b || ''));
const sameTeam = (a, b) => ['name', 'unit', 'type'].every((field) => normalize(a?.[field]) === normalize(b?.[field]));
const SCOPED_METRIC_CODES = {
  'ab-tests-assessment': new Set(['hyp.ab_tests']),
  'regularity-user-assessment': new Set(['attract.regulyarnostь', 'churn.regulyarnostь', 'analiz_effektivnostь.regulyarnostь']),
  'discovery-assessment': new Set(['hyp.discovery_40_backlog']),
  'q3-score-correction': new Set(['attract.report_completeness', 'attract.nastroena_otchetnostь', 'attract.funnel_analysis', 'attract.benchmarks',
    'attract.initiatives_list', 'attract.provedenie_kompleksnogo_analiza_voronki_ispolьzovaniya', 'churn.nastroena_otchetnostь',
    'churn.report_completeness', 'churn.funnel_analysis', 'churn.benchmarks', 'churn.deviation_actions', 'churn.regulyarnostь',
    'mehaniki.uderzhanie_klientov', 'mehaniki.doprodazhi_up_sell', 'mehaniki.gibkoe_izmenenie_usloviy_produkta', 'cx.score', 'hyp.discovery_40_backlog',
    'general.navigator_reporting_knowledge', 'general.klienty_s_produktom', 'general.mau_produkta', 'general.obъem_celevogo_rynka_v_rossii',
    'dannye.promyshlenye_dannye', 'analiz_effektivnostь.provedenie_kompleksnogo_analiza_po_metrikam',
    'analiz_effektivnostь.nastroena_otchetnostь',
    'alerts.business_metrics', 'attract.campaign_launches',
    'attract.nalichie_self_service', 'attract.nalichie_uspeshnyh_biznes_zapuskov']),
  'alerts-carry-forward': new Set(['alerts.business_metrics', 'alerts.system_failures',
    'alerts.opovescheniya_po_problemam_svyazannym_s_ux_ui', 'alerts.nastroena_matrica_otkloneniy',
    'alerts.nastroeny_avtoalerty_po_otkloneniyam', 'dannye.kontrolь_kachestva_dannyh_kkd']),
  'mechanics-user-assessment': new Set(['mehaniki.uderzhaniya_klienta', 'mehaniki.vozvrat_klientov',
    'mehaniki.nailuchshego_vremeni_zvonka',
    'mehaniki.monitoring_mehanik',
    'mehaniki.uderzhanie_klientov', 'mehaniki.obuchayuschie_mehaniki', 'mehaniki.informirovaniya_klienta',
    'mehaniki.personalizaciya', 'mehaniki.kontrolya_kachestva_rechi', 'mehaniki.personalizaciya_interfeysa_kontenta',
    'mehaniki.stimulirovanie_klienta', 'mehaniki.reagirovanie_na_zhiznennye_sobytiya',
    'mehaniki.personalizaciya_klientskogo_opyta', 'mehaniki.privlechenie_klientov', 'mehaniki.doprodazhi_up_sell']),
  'funnel-user-assessment': new Set(['attract.nastroena_otchetnostь', 'attract.report_completeness', 'attract.funnel_analysis',
    'attract.initiatives_list', 'churn.deviation_actions',
    'attract.meropriyatiya_po_rabote_s_otkloneniyami',
    'voronka_ispolьzovaniya.meropriyatiya_po_rabote_s_otkloneniyami',
    'voronka_prodazh.meropriyatiya_po_rabote_s_otkloneniyami',
    'voronka_vhoda_v_kanal.meropriyatiya_po_rabote_s_otkloneniyami',
    'voronka_onbordinga.meropriyatiya_po_rabote_s_otkloneniyami',
    'churn.nastroena_otchetnostь', 'churn.regulyarnostь', 'churn.report_completeness', 'churn.funnel_analysis',
    'attract.provedenie_kompleksnogo_analiza_voronki_ispolьzovaniya',
    'voronka_ispolьzovaniya.nastroena_otchetnostь', 'voronka_ispolьzovaniya.polnota_otcheta',
    'voronka_ispolьzovaniya.provedenie_kompleksnogo_analiza_voronki_ispolьzovaniya',
    'voronka_onbordinga.nastroena_otchetnostь', 'voronka_onbordinga.polnota_otcheta',
    'voronka_onbordinga.provedenie_analiza_voronki_onbordinga',
    'voronka_vhoda_v_kanal.nastroena_otchetnostь', 'voronka_vhoda_v_kanal.polnota_otcheta',
    'voronka_vhoda_v_kanal.provedenie_analiza_voronki_vhoda_v_kanal',
    'voronka_prodazh.nastroena_otchetnostь', 'voronka_prodazh.polnota_otcheta',
    'voronka_prodazh.provedenie_analiza_voronki_prodazh',
    'analiz_effektivnostь.nastroena_otchetnostь', 'analiz_effektivnostь.provedenie_kompleksnogo_analiza_po_metrikam',
    'analiz_effektivnostь.meropriyatiya_po_rabote_s_otkloneniyami']),
  'funnel-link-quality-assessment': new Set(['attract.report_completeness', 'churn.report_completeness',
    'voronka_ispolьzovaniya.polnota_otcheta', 'voronka_onbordinga.polnota_otcheta',
    'voronka_vhoda_v_kanal.polnota_otcheta', 'voronka_prodazh.polnota_otcheta']),
  'user-metric-assessment': new Set(['general.aktivnaya_klientskaya_baza', 'general.kol_vo_major_klientov',
    'general.navigator_reporting_knowledge',
    'general.kol_vo_klientov_s_2_nefin_servisov', 'general.kol_vo_poluchateley_zp',
    'general.obъem_zachisleniy_fot', 'general.sredniy_dohoda_na_klienta',
    'attract.benchmarks', 'churn.benchmarks', 'alerts.business_metrics', 'alerts.system_failures',
    'alerts.opovescheniya_po_problemam_svyazannym_s_ux_ui', 'alerts.nastroena_matrica_otkloneniy',
    'alerts.nastroeny_avtoalerty_po_otkloneniyam', 'dannye.kontrolь_kachestva_dannyh_kkd', 'dannye.promyshlenye_dannye']),
  'campaign-user-assessment': new Set(['attract.campaign_launches', 'attract.nalichie_self_service',
    'attract.nalichie_uspeshnyh_biznes_zapuskov', 'attract.chernoviki_v_sbol_70']),
  'campaign-missing-zero-assessment': new Set(['attract.campaign_launches', 'attract.chernoviki_v_sbol_70',
    'attract.nalichie_self_service', 'attract.nalichie_uspeshnyh_biznes_zapuskov']),
  'pc-final-score-assessment': new Set(['alerts.business_metrics', 'alerts.system_failures', 'attract.benchmarks',
    'attract.funnel_analysis', 'attract.initiatives_list', 'attract.nastroena_otchetnostь', 'attract.regulyarnostь',
    'attract.report_completeness', 'general.cr_v_prodazhu', 'general.fcr', 'general.klienty_s_produktom',
    'general.kolichestvo_obrascheniy', 'general.mau_produkta', 'general.navigator_reporting_knowledge',
    'general.obschiy_obъem_ishodyaschego_trafika', 'general.znanie_produktov_sputnikov', 'hyp.ab_tests',
    'hyp.datadriven_rating_7_5', 'hyp.discovery_40_backlog', 'hyp.extra_initiatives', 'mehaniki.avtomatizacii',
    'mehaniki.gibkoe_izmenenie_usloviy_produkta', 'mehaniki.informirovaniya_klienta', 'mehaniki.kontrolya_kachestva_rechi',
    'mehaniki.monitoring_mehanik', 'mehaniki.nailuchshego_vremeni_zvonka', 'mehaniki.nalichie_sobstvennyh_mehanik',
    'mehaniki.personalizaciya', 'mehaniki.uderzhaniya_klienta', 'voronka_prodazh.meropriyatiya_po_rabote_s_otkloneniyami',
    'voronka_prodazh.nalichie_benchmarkov', 'voronka_prodazh.nastroena_otchetnostь', 'voronka_prodazh.polnota_otcheta',
    'voronka_prodazh.provedenie_analiza_voronki_prodazh', 'voronka_prodazh.regulyarnostь',
    'voronka_vhoda_v_kanal.meropriyatiya_po_rabote_s_otkloneniyami', 'voronka_vhoda_v_kanal.nalichie_benchmarkov',
    'voronka_vhoda_v_kanal.nastroena_otchetnostь', 'voronka_vhoda_v_kanal.polnota_otcheta',
    'voronka_vhoda_v_kanal.provedenie_analiza_voronki_vhoda_v_kanal', 'voronka_vhoda_v_kanal.regulyarnostь']),
  'cx-score-assessment': new Set(['cx.score']),
  'selected-metrics-carry-forward': new Set(['mehaniki.gibkoe_izmenenie_usloviy_produkta', 'hyp.extra_initiatives']),
  'research-assessment': new Set(['hyp.datadriven_rating_7_5']),
  'funnel-reporting-carry-forward': new Set(['attract.nastroena_otchetnostь', 'attract.regulyarnostь', 'attract.report_completeness',
    'churn.nastroena_otchetnostь', 'churn.regulyarnostь', 'churn.report_completeness']),
  'ux-score-assessment': new Set(['cx.uh_score']),
  'goals-assessment': new Set(['goals.monitored', 'goals.forecast', 'goals.factor_analysis_l1_l2']),
  'performance-assessment': new Set(['rezulьtativnostь.cr_vypolneniya', 'rezulьtativnostь.dop_npv_vypolneniya',
    'rezulьtativnostь.delьta_cltv_vypolneniya']),
  'key-metrics-assessment': new Set(['general.aktivnaya_klientskaya_baza', 'general.cltv_mlrd_rub', 'general.cr_kampeyninga',
    'general.cr_v_prodazhu', 'general.ctr', 'general.dau_android', 'general.dau_ios', 'general.dau_kanala', 'general.dau_mau',
    'general.dau_produkta', 'general.dau_web', 'general.dolya_rynka_fot', 'general.dop_npv_mlrd_rub', 'general.fcr',
    'general.klienty_s_produktom', 'general.kol_vo_klientov_s_2_nefin_servisov', 'general.kol_vo_major_klientov',
    'general.kol_vo_poluchateley_zp', 'general.kolichestvo_obrascheniy', 'general.mau_android', 'general.mau_ios',
    'general.mau_produkta', 'general.mau_u_vashego_kanala', 'general.mau_web', 'general.navigator_reporting_knowledge',
    'general.obschiy_obъem_ishodyaschego_trafika', 'general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere',
    'general.obъem_zachisleniy_fot', 'general.or', 'general.proniknoveniya_kanala_v_akb_sbera', 'general.sredniy_dohoda_na_klienta',
    'general.yau_produkta', 'general.znanie_produktov_sputnikov']),
  'mechanics-carry-forward': new Set(['mehaniki.vozvrat_klientov', 'mehaniki.uderzhanie_klientov',
    'mehaniki.gibkoe_izmenenie_usloviy_produkta', 'mehaniki.cross_sell', 'mehaniki.doprodazhi_up_sell',
    'mehaniki.monitoring_mehanik', 'mehaniki.nalichie_sobstvennyh_mehanik', 'mehaniki.personalizaciya_klientskogo_opyta',
    'mehaniki.privlechenie_klientov', 'mehaniki.reagirovanie_na_zhiznennye_sobytiya', 'mehaniki.avtomatizacii',
    'mehaniki.informirovaniya_klienta', 'mehaniki.personalizaciya', 'mehaniki.kontrolya_kachestva_rechi',
    'mehaniki.uderzhaniya_klienta', 'mehaniki.povyshenie_urovnya_klienta', 'mehaniki.personalizaciya_interfeysa_kontenta',
    'mehaniki.stimulirovanie_klienta', 'mehaniki.obuchayuschie_mehaniki', 'mehaniki.nailuchshego_vremeni_zvonka',
    'mehaniki.autentifikaciya', 'mehaniki.sessiya_i_dostup', 'mehaniki.onbording_i_kross_kanalьnostь', 'mehaniki.bezopasnostь_i_kontrolь']),
};

function referenceFieldsForBlock(block, product, measuredMetrics = {}) {
  const sanitize = (items, withNotice = true) => items.flatMap((item) => {
    const label = String(item?.label || '').trim();
    const url = String(item?.url || item?.link || '').trim();
    return label && /^https?:\/\//i.test(url)
      ? [{label, url, ...(withNotice && typeof item.notice === 'string' && item.notice.trim() ? {notice: item.notice.trim()} : {})}]
      : [];
  }).filter((item, index, all) => all.findIndex((candidate) => candidate.label === item.label && candidate.url === item.url) === index);
  const instructions = [];
  const collectInstructions = (tool, instruction = false) => {
    const isInstruction = instruction || tool?.kind === 'instruction';
    const url = tool?.button?.link || tool?.button?.url || tool?.link || tool?.url;
    if (isInstruction && url) instructions.push({label: tool.name || tool.label || tool.button?.label || 'Инструкция', url, notice: tool.footer});
    (tool?.tools || []).forEach((child) => collectInstructions(child, isInstruction));
    (tool?.buttons || []).forEach((child) => collectInstructions(child, isInstruction));
  };
  (block.tools || []).forEach((tool) => collectInstructions(tool));
  const referenceLinks = sanitize([...linksForBlock(block, product.metrics || [], product), ...instructions]);
  const evidenceSources = (block.metrics || []).map((metric) => measuredMetrics[metric.code]?.source)
    .filter((source) => Array.isArray(source?.evidenceLinks) && source.evidenceLinks.length);
  const participantLinks = sanitize([...(block.participant_links || []),
    ...evidenceSources.flatMap((source) => source.evidenceLinks)], false);
  return {
    ...(referenceLinks.length ? {reference_links: referenceLinks} : {}),
    ...(participantLinks.length ? {participant_links: participantLinks} : {}),
    ...(referenceLinks.length || participantLinks.length
      ? {referencePeriod: evidenceSources[0]?.period || product.period} : {}),
  };
}

export function buildTeamProfileProducts(products, period, overlay = null) {
  const overlays = (Array.isArray(overlay) ? overlay : [overlay]).filter(Boolean);
  const scoringOverlays = overlays.filter((item) => !['metric-applicability-assessment', 'metric-index-exclusion-assessment', 'user-confirmed-q2-retention', 'goals-information-assessment', 'po-goals-template', 'po-goals-assessment', 'goals-final-scores', 'reporting-format-assessment', 'ub-workbook-corrections', 'cbp-user-corrections'].includes(item.scope));
  const periods = getReportPeriods(products);
  const activePeriod = period || periods[0] || '';
  const actual = products.filter((product) => product.period === activePeriod);
  const finalize = (profiles) => applyPoGoalsTemplate(applyGoalsInformationalAssessments(applyQuarterRetentionAssessments(applyAbTestsAssessments(applyMetricApplicabilityAssessments(
    applyCxScoreAssessments(profiles, activePeriod, overlays, products), activePeriod, overlays), activePeriod, overlays, products), activePeriod, overlays, products), activePeriod, overlays), activePeriod, overlays);
  if (actual.length || !periods.includes(activePeriod)) return finalize(actual);
  const maxOverrides = Object.assign({}, ...scoringOverlays.filter((item) => item.period === activePeriod && !SCOPED_METRIC_CODES[item.scope]).map((item) => item.metricMaxOverrides || {}));
  const templates = [];
  for (const source of products) {
    if (templates.some((template) => sameTeam(template, source))) continue;
    const measuredMetricScopes = new Map();
    const measuredTeams = scoringOverlays.filter((item) => item.period === activePeriod && (item.scope === 'ux-score-assessment'
      ? normalize(source.type) === 'канал' : normalize(source.type) === 'продукт' || SCOPED_METRIC_CODES[item.scope]))
      .map((item) => {
        const team = (item.products || []).find((candidate) => String(candidate.id).replace(/::empty::.*/, '')
          === String(source.id).replace(/::empty::.*/, '') && sameTeam(candidate, source));
        const scopeCodes = SCOPED_METRIC_CODES[item.scope];
        if (!team) return null;
        const metrics = scopeCodes ? Object.fromEntries(Object.entries(team.metrics || {}).filter(([code]) => scopeCodes.has(code))) : team.metrics || {};
        Object.keys(metrics).forEach((code) => measuredMetricScopes.set(code, item.scope));
        return scopeCodes ? {metrics} : team;
      }).filter(Boolean);
    const measuredMetrics = Object.assign({}, ...measuredTeams.map((team) => team.metrics || {}));
    const effectiveMaxFor = (metric) => {
      const fact = measuredMetrics[metric.code];
      const proof = fact?.source;
      const confirmedMaximum = (item) => item?.origin === 'userConfirmedQ3ScoreCorrection'
        && item.confirmedBy === 'user' && item.date === '2026-11-11' && item.period === activePeriod
        && item.approvalGroup === 'osago-flexible-max-2026-11-11';
      if (activePeriod === 'III кв. 2026' && source.id === '16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО'
        && source.name === 'ОСАГО' && source.unit === 'УБ' && source.type === 'Продукт'
        && metric.code === 'mehaniki.gibkoe_izmenenie_usloviy_produkta'
        && metric.is_applicabble_flg !== false && metric.max_value === 1 && metric.value === 0
        && measuredMetricScopes.get(metric.code) === 'q3-score-correction'
        && fact.rawValue === 0 && fact.maxValueOverride === 1.5
        && confirmedMaximum(proof) && confirmedMaximum(proof.correction)
        && proof.correction.rawValue === 0 && proof.correction.maxValueOverride === 1.5
        && proof.previousAssessment?.value === 0 && proof.previousAssessment.maxValue === 1) return 1.5;
      return normalize(source.type) === 'продукт'
        && metric.code === 'attract.chernoviki_v_sbol_70' && maxOverrides[metric.code] === 1
        && metric.is_applicabble_flg !== false && Number(metric.max_value) > 0
        ? 1 : metric.max_value;
    };
    // Explicit Q3 assessments can restore a benchmark missing from the Q2 rubric.
    // Existing metrics, including non-applicable ones, keep their original rubric.
    const addChurnBenchmark = measuredMetricScopes.get('churn.benchmarks') === 'user-metric-assessment'
      && [0, 0.5, 1].includes(measuredMetrics['churn.benchmarks']?.rawValue)
      && !source.metrics.some((block) => block.metrics.some((metric) => metric.code === 'churn.benchmarks'));
    let sourceMetrics = addChurnBenchmark ? source.metrics.map((block) => block.code === 'churn'
      ? {...block, metrics: [...block.metrics, {code: 'churn.benchmarks', name: 'Наличие бенчмарков',
        max_value: 0.5, is_applicabble_flg: true, excluded_from_index: false, dd_calculation_flg: 1}]}
      : block) : source.metrics;
    const industrialCode = 'dannye.promyshlenye_dannye';
    if (measuredMetricScopes.get(industrialCode) === 'q3-score-correction'
      && !sourceMetrics.some((block) => block.metrics.some((metric) => metric.code === industrialCode))) {
      const templateBlock = products.flatMap((product) => product.metrics || []).find((block) => block.code === 'dannye');
      const templateMetric = templateBlock?.metrics.find((metric) => metric.code === industrialCode);
      if (templateMetric) {
        const metric = {...templateMetric, value: null, max_value: templateMetric.max_value,
          is_applicabble_flg: true, excluded_from_index: false, dd_calculation_flg: 1};
        const dataBlock = {...templateBlock, metrics: [metric]};
        sourceMetrics = sourceMetrics.some((block) => block.code === 'dannye')
          ? sourceMetrics.map((block) => block.code === 'dannye' ? {...block, metrics: [...block.metrics, metric]} : block)
          : [...sourceMetrics, dataBlock];
      }
    }
    const crossSellDuringFact = measuredMetricScopes.get('mehaniki.cross_sell') === 'crosssell-during-purchase-assessment'
      && [0, 1].includes(measuredMetrics['mehaniki.cross_sell']?.rawValue);
    const activatedCrossSellCodes = new Set();
    if (crossSellDuringFact) sourceMetrics = sourceMetrics.map((block) => ({...block, metrics: block.metrics.map((metric) => {
      if (metric.code !== 'mehaniki.cross_sell' || (metric.is_applicabble_flg !== false && Number(metric.max_value) > 0)) return metric;
      activatedCrossSellCodes.add(metric.code);
      return {...metric, max_value: 1, is_applicabble_flg: true, excluded_from_index: false, dd_calculation_flg: 1};
    })}));
    const activatedFunnelCodes = new Set();
    // Only explicitly assessed Q3 funnel metrics may restore a formerly non-applicable rubric.
    const requestedFunnelActivations = source.type === 'Продукт' && source.unit === 'DB'
      ? {'Трансграничные переводы': {'attract.report_completeness': 0.5},
        'Трансграничный эквайринг': {'churn.nastroena_otchetnostь': 0.5}}[source.name] || {}
      : source.type === 'Продукт' && source.unit === 'ДомКлик' && source.name === 'Сделка с Первичным жильём'
        ? {'churn.nastroena_otchetnostь': 0.5, 'churn.regulyarnostь': 1, 'churn.report_completeness': 0.5} : {};
    if (Object.keys(requestedFunnelActivations).length) sourceMetrics = sourceMetrics.map((block) => ({...block,
      metrics: block.metrics.map((metric) => {
        const fact = measuredMetrics[metric.code];
        const activationMax = requestedFunnelActivations[metric.code];
        if (!activationMax || measuredMetricScopes.get(metric.code) !== 'funnel-user-assessment'
          || ![0, 0.5, 1].includes(fact?.rawValue) || fact.applicabilityOverride?.applicable !== true
          || fact.applicabilityOverride?.maxValue !== activationMax
          || !(metric.is_applicabble_flg === false || Number(metric.max_value) <= 0)) return metric;
        activatedFunnelCodes.add(metric.code);
        return {...metric, max_value: activationMax, is_applicabble_flg: true,
          excluded_from_index: metric.excluded_from_index ?? false,
          dd_calculation_flg: metric.dd_calculation_flg ?? 1};
      }),
    }));
    const crossSellAfterPurchase = activePeriod === 'III кв. 2026'
      ? measuredTeams.find((team) => [0, 0.5, 1].includes(team.postPurchaseValue) || team.postPurchaseApplicable === false) : null;
    const freshCrosssell = measuredTeams.find((team) => Array.isArray(team.crosssellRecommendations));
    const freshCrosssellRecommendations = (freshCrosssell?.crosssellRecommendations || []).filter((item) => item.skill_key === 'cross_sell');
    templates.push({
      id: `${source.id}::empty::${activePeriod}`,
      name: source.name, unit: source.unit, type: source.type, period: activePeriod,
      isPlaceholder: true,
      ...(freshCrosssellRecommendations.length ? {metric_recommendations: freshCrosssellRecommendations} : {}),
      indexMaxPoints: (sourceMetrics || []).flatMap((block) => block.metrics || [])
        .filter(isDdIndexMetric).reduce((sum, metric) => sum + Number(effectiveMaxFor(metric)), 0),
      metrics: (sourceMetrics || []).map((block) => ({
        code: block.code, name: block.name,
        ...referenceFieldsForBlock(block, source, measuredMetrics),
        ...(block.code === 'mehaniki' && freshCrosssell?.crosssellTool?.ai_tool_key === 'cross_sell'
          ? {tools: [freshCrosssell.crosssellTool]} : {}),
        metrics: (block.metrics || []).map((metric) => {
          const fact = measuredMetricScopes.get(metric.code) === 'key-metrics-assessment' && block.code !== 'general'
            ? undefined : measuredMetrics[metric.code];
          const completenessRatio = fact?.source?.completenessRatio;
          const hasCompletenessFraction = measuredMetricScopes.get(metric.code) === 'funnel-user-assessment'
            && ['attract.report_completeness', 'churn.report_completeness'].includes(metric.code)
            && Number.isInteger(completenessRatio?.selected) && Number.isInteger(completenessRatio?.available)
            && completenessRatio.available > 0 && completenessRatio.selected >= 0
            && completenessRatio.selected <= completenessRatio.available
            && Number.isFinite(fact?.rawValue) && fact.rawValue === completenessRatio.selected / completenessRatio.available;
          const hasPerformanceQuarter = fact?.rawValue === 0.25 && measuredMetricScopes.get(metric.code) === 'performance-assessment'
            && SCOPED_METRIC_CODES['performance-assessment'].has(metric.code);
          const hasDiscoveryQuarter = fact?.rawValue === 0.25 && measuredMetricScopes.get(metric.code) === 'discovery-assessment'
            && metric.code === 'hyp.discovery_40_backlog';
          const hasDirectQ3Correction = Number.isFinite(fact?.rawValue) && fact.rawValue >= 0 && fact.rawValue <= 1
            && fact.source?.correction?.origin === 'userConfirmedQ3ScoreCorrection'
            && fact.source.correction.confirmedBy === 'user' && fact.source.correction.period === activePeriod
            && SCOPED_METRIC_CODES[measuredMetricScopes.get(metric.code)]?.has(metric.code);
          const hasDirectNavigatorFact = fact?.rawValue === 0.5
            && ['key-metrics-assessment', 'q3-score-correction'].includes(measuredMetricScopes.get(metric.code))
            && metric.code === 'general.navigator_reporting_knowledge'
            && fact.source?.origin === 'userConfirmedDirectNavigatorAssessment'
            && fact.source?.confirmedBy === 'user'
            && fact.source?.teamId === String(source.id).replace(/::empty::.*/, '')
            && fact.source?.teamName === source.name && fact.source?.unit === source.unit && fact.source?.type === source.type;
          const hasFact = fact && (hasCompletenessFraction || hasPerformanceQuarter || hasDiscoveryQuarter || hasDirectQ3Correction || hasDirectNavigatorFact || fact.rawValue === 0 || fact.rawValue === 1 || (fact.rawValue === 0.5
            && (['mehaniki.cross_sell', 'attract.chernoviki_v_sbol_70', 'cx.uh_score'].includes(metric.code)
              || (['goals-assessment', 'selected-metrics-carry-forward', 'user-metric-assessment', 'funnel-user-assessment', 'funnel-link-quality-assessment', 'research-assessment', 'mechanics-user-assessment', 'discovery-assessment', 'regularity-user-assessment', 'pc-final-score-assessment', 'q3-score-correction'].includes(measuredMetricScopes.get(metric.code))
                && SCOPED_METRIC_CODES[measuredMetricScopes.get(metric.code)].has(metric.code)))));
          const applicable = metric.is_applicabble_flg !== false && Number(metric.max_value) > 0;
          const hasPreviousValue = hasFact && applicable && !activatedFunnelCodes.has(metric.code)
            && !activatedCrossSellCodes.has(metric.code) && source.period && source.period !== activePeriod
            && Number.isFinite(metric.value) && Number.isFinite(Number(metric.max_value))
            && metric.value >= 0 && metric.value <= Number(metric.max_value);
          const rubric = Object.fromEntries(['code', 'name', 'metric_subgroup', 'footer', 'max_value', 'recommendation_difficulty',
            'is_applicabble_flg', 'excluded_from_index', 'dd_calculation_flg']
            .filter((key) => metric[key] !== undefined).map((key) => [key, metric[key]]));
          const maxValue = effectiveMaxFor(metric);
          const crossSellDuringScore = measuredMetricScopes.get(metric.code) === 'crosssell-during-purchase-assessment'
            && metric.code === 'mehaniki.cross_sell';
          const currentValue = hasFact && applicable
            ? fact.rawValue * Number(maxValue) / (crossSellDuringScore ? 2 : 1) : null;
          const recommendationRubric = {
            ...Object.fromEntries(['recommendation', 'recommendations', 'recommendation_group', 'recommendation_groups']
              .filter((key) => metric[key] !== undefined).map((key) => [key, Array.isArray(metric[key]) ? [...metric[key]] : metric[key]])),
            ...(Array.isArray(metric.recommendation_items) ? {recommendation_items: metric.recommendation_items.filter((item) => typeof item.recommendation === 'string').map((item) => ({
              ...Object.fromEntries(['recommendation', 'group', 'recommendation_difficulty'].filter((key) => item[key] !== undefined).map((key) => [key, item[key]])),
              value: currentValue, max_value: maxValue,
              gap: currentValue === null ? null : Math.max(0, Number(maxValue) - currentValue),
            }))} : {}),
          };
          const result = {
            ...rubric,
            ...(maxValue !== metric.max_value ? {max_value: maxValue} : {}),
            ...recommendationRubric,
            value: currentValue,
            ...(hasPreviousValue ? {previousValue: metric.value, previousMaxValue: Number(metric.max_value), previousPeriod: source.period} : {}),
            ...(hasFact ? {source: {...fact.source, rawValue: fact.rawValue}} : {}),
          };
          return crossSellAfterPurchase ? sumCrossSellComponents(result, crossSellAfterPurchase) : result;
        }),
      })),
    });
  }
  return finalize(templates);
}

export function metricActualGrowth(metric, maxIndexPoints, currentPeriod) {
  if (!isDdIndexMetric(metric) || !Number.isFinite(metric.value) || !Number.isFinite(metric.previousValue)
    || !Number.isFinite(metric.max_value) || !Number.isFinite(metric.previousMaxValue)
    || metric.max_value <= 0 || metric.max_value !== metric.previousMaxValue
    || metric.previousValue < 0 || metric.value < 0 || metric.value > metric.max_value || metric.value === metric.previousValue
    || !Number.isFinite(maxIndexPoints) || maxIndexPoints <= 0
    || !metric.previousPeriod || !currentPeriod || metric.previousPeriod === currentPeriod) return null;
  const pointsDelta = metric.value - metric.previousValue;
  return {pointsDelta, metricPctDelta: pointsDelta / metric.max_value * 100,
    indexPctDelta: pointsDelta / maxIndexPoints * 100 * (metric.actualGrowthWeight === 0.5 ? 0.5 : 1), previousPeriod: metric.previousPeriod,
    ...(metric.growthComparisonLabel ? {comparisonLabel: metric.growthComparisonLabel} : {}),
    currentPeriod, previousValue: metric.previousValue, value: metric.value};
}

export function blockActualGrowth(block, maxIndexPoints, currentPeriod) {
  const growths = (block?.metrics || []).map((metric) => metricActualGrowth(metric, maxIndexPoints, currentPeriod))
    .filter(Boolean);
  if (!growths.length || new Set(growths.map((growth) => growth.previousPeriod)).size !== 1) return null;
  return {...growths[0],
    pointsDelta: growths.reduce((sum, growth) => sum + growth.pointsDelta, 0),
    indexPctDelta: growths.reduce((sum, growth) => sum + growth.indexPctDelta, 0),
    value: growths.reduce((sum, growth) => sum + growth.value, 0),
    previousValue: growths.reduce((sum, growth) => sum + growth.previousValue, 0),
  };
}

export function buildTeamProfileRadarData(product, products, blocks) {
  const blockValue = (team, block) => team.isPlaceholder ? completeBlockPercent(block, team.period) : radarBlockPercent(block);
  const benchmarkProducts = products.filter((item) => item.period === product.period
    && /продукт|сегмент|product|segment/i.test(String(item.type || '')));
  return blocks.map((block) => {
    const benchmarkValues = benchmarkProducts.flatMap((item) => {
      const value = blockValue(item, item.metrics?.find((candidate) => candidate.code === block.code));
      return value === null ? [] : [value];
    });
    return {code: block.code, product: blockValue(product, block),
      benchmark: benchmarkValues.length
        ? Math.round(benchmarkValues.reduce((sum, value) => sum + value, 0) / benchmarkValues.length) : null};
  });
}

export function campaignMetricNoteForPeriod(code, period, note) {
  const campaignCodes = new Set(['attract.campaign_launches', 'attract.nalichie_self_service', 'attract.chernoviki_v_sbol_70', 'attract.nalichie_uspeshnyh_biznes_zapuskov']);
  const quarterName = String(period || '').match(/^(I|II|III|IV)\s+кв\.\s*\d{4}$/i)?.[1]?.toUpperCase();
  if (!note || !/цифровых\s+следах/i.test(note) || !campaignCodes.has(code) || !quarterName) return note;
  const evaluatedQuarter = {I: 1, II: 2, III: 3, IV: 4}[quarterName];
  const quarter = code === 'attract.nalichie_uspeshnyh_biznes_zapuskov' ? (evaluatedQuarter + 2) % 4 + 1 : evaluatedQuarter;
  return /за\s*[1-4]Q\b/i.test(note) ? note.replace(/за\s*[1-4]Q\b/i, `за ${quarter}Q`) : `${note} за ${quarter}Q`;
}

export function filterTitleRowsByPeriod(rows, products, period) {
  const sourcePeriods = [...new Set(products.map((item) => item.period).filter(Boolean))];
  const unlabelledPeriodMatches = sourcePeriods.length <= 1 && (!period || sourcePeriods[0] === period);
  return rows.filter((row) => row.period ? row.period === period : unlabelledPeriodMatches);
}

export function resolveTeamProfileSelection(products, {period = '', unit = '', selected = null} = {}) {
  const periods = getReportPeriods(products);
  const activePeriod = period || periods[0] || '';
  const periodProducts = products.filter((item) => !activePeriod || item.period === activePeriod);
  const sorted = [...periodProducts].sort((a, b) => compare(a.name, b.name));
  const matchingTeam = selected && (sorted.find((item) => item.id === selected.id && sameTeam(item, selected))
    || sorted.find((item) => sameTeam(item, selected)));
  const activeUnit = unit && sorted.some((item) => item.unit === unit) ? unit : '';
  const candidates = sorted.filter((item) => !activeUnit || item.unit === activeUnit);
  const product = (matchingTeam && (!activeUnit || matchingTeam.unit === activeUnit) ? matchingTeam : null)
    || (!selected && (candidates.find((item) => /^вклады$/i.test(String(item.name || '').trim()))
      || candidates.find((item) => /^вклады\s*\+\s*нс$/i.test(String(item.name || '').trim()))))
    || candidates[0] || null;
  return {period: activePeriod, periods, products: periodProducts, unit: activeUnit, product};
}
