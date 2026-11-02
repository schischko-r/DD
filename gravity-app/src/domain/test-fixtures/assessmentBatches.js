// These named batches arrived after the immutable snapshots for the earlier
// assessment regressions. Exclude them only when reproducing those old stages;
// current-runtime tests, including the salary merge, still use every App overlay.
const postSnapshotExternalFiles = new Set([
  'ub-workbook-corrections-q3-2026.json',
  'crossborder-acquiring-reporting-applicability-q3-2026.json',
  'trade-acquiring-alerts-user-q3-2026.json',
  'telemarketing-mechanics-user-q3-2026.json',
  'notification-retention-user-q3-2026.json',
  'call-center-navigator-user-q3-2026.json',
  'daily-banking-funnel-user-q3-2026.json',
  'cross-border-mechanics-user-q3-2026.json',
  'elk-knowledge-user-q3-2026.json',
  'bullion-mechanics-user-q3-2026.json',
  'industrial-data-user-q3-2026.json',
  'digital-funnel-actions-user-q3-2026.json',
  'cfa-market-index-exclusions-q3-2026.json',
  'domclick-cx-score-user-q3-2026.json',
  'cfa-navigator-user-q3-2026.json',
  'insurance-funnel-user-q3-2026.json',
  'bpif-key-metrics-user-q3-2026.json',
  'segment-mechanics-floor-q3-2026.json',
  'reporting-absence-user-q3-2026.json',
  'children-mechanics-user-q3-2026.json',
  'funnel-missing-user-fill-q3-2026.json',
  'tips-regularity-user-q3-2026.json',
  'tips-benchmarks-user-q3-2026.json',
  'auto-attract-analysis-q3-2026.json',
  'auto-self-service-q3-2026.json',
  'tips-funnel-user-q3-2026.json',
  'tips-mechanics-user-q3-2026.json',
  'bullion-funnel-user-q3-2026.json',
  'smile-attract-analysis-q3-2026.json',
  'smile-markets-zero-q3-2026.json',
  'working-age-fot-knowledge-q3-2026.json',
  'monthly-excel-reporting-q3-2026.json',
  'data-quality-survey-q3-2026.json',
  'payments-mechanics-q3-2026.json',
  'investkopilka-navigator-q3-2026.json',
  'deposits-churn-completeness-q3-2026.json',
  'iszh-funnel-completeness-q3-2026.json',
  'nszh-funnel-completeness-q3-2026.json',
  'ab-tests-insurance-visibility-q3-2026.json',
  'cfa-attract-completeness-q3-2026.json',
  'cfa-attract-benchmarks-q3-2026.json',
  'corporate-churn-completeness-q3-2026.json',
  'campaigning-deviation-actions-q3-2026.json',
  'all-satellites-knowledge-q3-2026.json',
  'campaigning-data-quality-q3-2026.json',
  'campaigning-alerts-q3-2026.json',
  'campaigning-performance-q3-2026.json',
  'kasko-satellites-q3-2026.json',
  'monety-churn-analysis-q3-2026.json',
  'campaigning-quarter-retention-q3-2026.json',
  'po-goals-survey-assessments-q3-2026.json',
  'po-goals-template-q3-2026.json',
  'goals-informational-q3-2026.json',
  'goals-tribe-assessments-q3-2026.json',
  'goals-tribe-applicability-q3-2026.json',
  'corporate-flexible-conditions-applicability-q3-2026.json',
  'domclick-self-service-q3-2026.json',
  'navigator-mau-knowledge-q3-2026.json',
  'digital-channel-actions-q3-2026.json',
  'digital-channel-return-q3-2026.json',
  'oms-key-metrics-assessment-q3-2026.json',
  'oms-goals-assessment-q3-2026.json',
  'oms-funnel-user-assessment-q3-2026.json',
  'oms-user-metric-assessment-q3-2026.json',
  'oms-mechanics-user-assessment-q3-2026.json',
  'segment-user-assessments-q3-2026.json',
  'navigator-zero-markets-q3-2026.json',
  'alerts-benchmarks-user-q3-2026.json',
  'quarter-retention-user-q3-2026.json',
  'pb-business-alerts-q3-2026.json',
  'pb-nonfinancial-knowledge-q3-2026.json',
  'pb-navigator-knowledge-q3-2026.json',
]);

export const isPostSnapshotExternalAssessment = (file) => postSnapshotExternalFiles.has(file);

// These two named applicability changes arrived after the immutable stage snapshots.
// Current-runtime tests keep the complete batch; only historical comparisons use this adapter.
export function beforeInsuranceInitiativeApplicability(assessment) {
  if (assessment.scope !== 'metric-applicability-assessment') return assessment;
  const ids = new Set(['89b13e92-db89-516e-823f-1d102242bdc9¦КАСКО', '16a909e6-2a89-532d-b1df-1f749aff70c8¦ОСАГО']);
  return {...assessment, products: assessment.products.map(team => {
    if (!ids.has(team.id) || team.unit !== 'УБ' || team.type !== 'Продукт') return team;
    const {['hyp.extra_initiatives']: laterFact, ...metrics} = team.metrics;
    return {...team, metrics};
  }).filter(team => Object.keys(team.metrics).length)};
}

// The campaign regularity fact was also added to an existing batch after these snapshots.
export function historicalAssessmentBatch(assessment) {
  if (assessment.source?.file === 'Книга4(1).xlsx') {
    assessment = {...assessment, products: assessment.products.map(team => {
      const code = 'attract.chernoviki_v_sbol_70';
      const fact = team.metrics?.[code];
      if (team.name !== 'ВЗР' || fact?.source?.origin !== 'userConfirmedVzrDraftsZero') return team;
      return {...team, metrics: {...team.metrics, [code]: {...fact, rawValue: 1,
        source: fact.source.previousAssessmentSource}}};
    })};
  }
  // Deposits drafts were explicitly reset after these immutable snapshots.
  if (assessment.metricMaxOverrides?.['attract.chernoviki_v_sbol_70'] === 1) {
    return {...assessment, products: assessment.products.map(team => {
      if (team.name !== 'Вклады+НС' || team.unit !== 'CBP' || team.type !== 'Продукт') return team;
      const code = 'attract.chernoviki_v_sbol_70', fact = team.metrics[code];
      if (!fact?.source?.overrideHistory?.at(-1)?.points) return team;
      const history = fact.source.overrideHistory;
      return {...team, metrics: {...team.metrics, [code]: {...fact, rawValue: .5,
        source: {...fact.source, override: history.at(-1), overrideHistory: history.slice(0, -1)}}}};
    })};
  }
  if (assessment.scope === 'regularity-user-assessment') {
    return {...assessment, products: assessment.products.map(team => {
      if (team.id !== '6d607e87-5e45-5759-a9cc-1a162b981a26¦Персональная рекомендация'
        || team.unit !== 'Data' || team.type !== 'Канал') return team;
      const {['analiz_effektivnostь.regulyarnostь']: laterFact, ...metrics} = team.metrics;
      return {...team, metrics};
    }).filter(team => Object.keys(team.metrics).length)};
  }
  return beforeInsuranceInitiativeApplicability(assessment);
}
