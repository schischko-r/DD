import {readFileSync} from 'node:fs';
import {applyAbTestsAssessments} from '../abTestsAssessment.js';

// Historical fixtures predate the corrected 38-team AB list. Bring only these
// explicitly assigned AB cells to the current policy; all other cells are kept.
export function withCurrentAbQuarterWeights(products) {
  const assessment = JSON.parse(readFileSync(new URL('../../data/ab-tests-user-assessments-q3-2026.json', import.meta.url)));
  const baseline = JSON.parse(readFileSync(new URL('../../../public/report-data.json', import.meta.url))).products;
  return applyAbTestsAssessments(products, assessment.period, [assessment], baseline);
}
