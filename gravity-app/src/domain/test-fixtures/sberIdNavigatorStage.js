// Reproduce earlier approval stages before later, separately tested confirmations.
// Current-runtime integration tests keep every confirmed assessment.
export function beforeDszhPkSelfServiceConfirmation(assessment) {
  if (assessment.scope !== 'q3-score-correction' || assessment.period !== 'III кв. 2026') return assessment;
  const code = 'attract.nalichie_self_service';
  return {...assessment, products: assessment.products.map(team => {
    const fact = team.metrics?.[code];
    if (team.id !== 'e8c97fe4-bd38-5aa1-9388-5c532cbde6f2¦ДСЖ ПК' || team.name !== 'ДСЖ ПК'
      || team.unit !== 'УБ' || team.type !== 'Продукт'
      || fact?.source?.approvalGroup !== 'dszh-pk-self-service-2026-11-19') return team;
    const previous = fact.source.previousAssessment;
    return {...team, metrics: {...team.metrics, [code]: {rawValue: previous.rawValue, source: structuredClone(previous.source)}}};
  })};
}

export function beforeSberSpasiboNavigatorConfirmation(assessment) {
  if (assessment.scope !== 'q3-score-correction' || assessment.period !== 'III кв. 2026') return assessment;
  const code = 'general.navigator_reporting_knowledge';
  let changed = false;
  const products = assessment.products.flatMap(team => {
    const fact = team.metrics?.[code];
    if (team.id !== 'aee72194-01f2-5673-9c7b-ed2beff1432a¦СберСпасибо' || team.name !== 'СберСпасибо'
      || team.unit !== 'CX' || team.type !== 'Продукт'
      || fact?.source?.approvalGroup !== 'sberspasibo-navigator-2026-11-16') return [team];
    changed = true;
    const metrics = {...team.metrics};
    delete metrics[code];
    return Object.keys(metrics).length ? [{...team, metrics}] : [];
  });
  return !changed ? assessment : {...assessment, products, counts: {...assessment.counts,
    teams: products.length, facts: products.reduce((sum, team) => sum + Object.keys(team.metrics).length, 0)}};
}

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
  assessment = beforeSberSpasiboNavigatorConfirmation(assessment);
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
