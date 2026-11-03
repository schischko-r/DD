// Replay tests for the earlier goals stages without the later November 3 user table.
export function beforeFinalGoalsTable(assessment) {
  const data = structuredClone(assessment);
  if (data.scope === 'goals-final-scores') for (const team of data.products) {
    for (const [code, correction] of Object.entries(team.finalCorrections || {})) {
      if (correction.group === 'finalGoalsTable20261103') team.final[code] = correction.previousValue;
    }
  }
  if (['cbp-user-corrections', 'cx-user-corrections'].includes(data.scope)) for (const team of data.products) {
    for (const [code, fact] of Object.entries(team.metrics)) {
      if (fact.source?.correction?.group === 'finalGoalsTable20261103') team.metrics[code] = fact.source.correction.previousAssessment;
    }
  }
  return data;
}
