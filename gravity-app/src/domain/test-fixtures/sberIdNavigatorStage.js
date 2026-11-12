// Reproduce earlier approval stages before the separate 12 November SberID
// confirmation. Current-runtime integration tests keep the confirmed assessment.
export function beforeSberIdDeviationActionsConfirmation(assessment) {
  if (assessment.scope !== 'funnel-user-assessment' || assessment.period !== 'III кв. 2026') return assessment;
  const code = 'voronka_ispolьzovaniya.meropriyatiya_po_rabote_s_otkloneniyami';
  return {...assessment, products: assessment.products.map(team => {
    const fact = team.metrics?.[code];
    if (team.id !== 'f0050a4f-3ce4-5c90-b5f5-627256453071¦SberID' || team.name !== 'SberID'
      || team.unit !== 'Data' || team.type !== 'Продукт' || fact?.rawValue !== 1
      || fact.source?.approvalGroup !== 'sberid-deviation-actions-2026-11-12'
      || fact.source.correction?.approvalGroup !== 'sberid-deviation-actions-2026-11-12'
      || fact.source.previousAssessment?.rawValue !== 0.5) return team;
    return {...team, metrics: {...team.metrics, [code]: structuredClone(fact.source.previousAssessment)}};
  })};
}

export function beforeSberIdNavigatorConfirmation(assessment) {
  assessment = beforeSberIdDeviationActionsConfirmation(assessment);
  if (assessment.scope !== 'q3-score-correction' || assessment.period !== 'III кв. 2026') return assessment;
  const code = 'general.navigator_reporting_knowledge';
  return {...assessment, products: assessment.products.map(team => {
    const fact = team.metrics?.[code];
    if (team.id !== 'f0050a4f-3ce4-5c90-b5f5-627256453071¦SberID' || team.name !== 'SberID'
      || team.unit !== 'Data' || team.type !== 'Продукт'
      || fact?.source?.approvalGroup !== 'sberid-navigator-2026-11-12'
      || !fact.source.previousAssessment?.priorFact) return team;
    return {...team, metrics: {...team.metrics, [code]: structuredClone(fact.source.previousAssessment.priorFact)}};
  })};
}
