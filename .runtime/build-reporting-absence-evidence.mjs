import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
const input = JSON.parse(readFileSync(new URL('../gravity-app/src/data/reporting-regularity-missing-q3-2026.json', import.meta.url), 'utf8'));
const teams = new Map();
const seen = new Map();
function add(team, blockCode, reportingCode, evidence) {
  if (String(evidence?.answer || '').trim().toLocaleLowerCase('ru') !== 'нет') return;
  assert.ok(evidence.questionId && evidence.file && Number.isInteger(evidence.csvRow));
  const key = JSON.stringify([team.id, team.name, team.unit, team.type]);
  const record = teams.get(key) || {id: team.id, name: team.name, unit: team.unit, type: team.type, blocks: []};
  const blockKey = key + '|' + blockCode;
  const old = seen.get(blockKey);
  if (old) {
    assert.equal(old.source.surveyId, evidence.surveyId);
    assert.equal(old.reportingCode, reportingCode);
    return;
  }
  const source = Object.fromEntries(['file', 'sha256', 'csvRow', 'surveyId', 'completedAt', 'originalTeamId',
    'originalTeamName', 'questionId', 'answer', 'questionSource'].filter((key) => evidence[key] !== undefined).map((key) => [key, evidence[key]]));
  const block = {blockCode, reportingCode, answer: evidence.answer, source};
  record.blocks.push(block);
  teams.set(key, record);
  seen.set(blockKey, block);
}
for (const team of input.products) for (const [code, fact] of Object.entries(team.metrics || {})) {
  const blockCode = code.split('.')[0];
  add(team, blockCode, `${blockCode}.nastroena_otchetnostь`, fact.source);
}
for (const rows of [input.verified, input.mismatches, input.pending]) for (const row of rows || []) {
  add(row, row.blockCode, row.reportingCode, row.source);
}
const data = {period: input.period, scope: 'reporting-absence-assessment',
  source: {origin: 'userConfirmedReportingAbsenceRule20261031', confirmedBy: 'user', date: '2026-10-31',
    evidenceFile: 'gravity-app/src/data/reporting-regularity-missing-q3-2026.json',
    rule: 'При точном ответе «Нет» и пустой либо нулевой оценке настроенной отчётности обнулить отчётность, бенчмарки, регулярность и полноту той же воронки. Положительная оценка настроенной отчётности защищает весь блок. Неприменимые критерии не активируются.'},
  products: [...teams.values()]};
writeFileSync(new URL('../gravity-app/src/data/reporting-absence-user-q3-2026.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({teams: data.products.length, blocks: seen.size,
  records: data.products.map((team) => ({name: team.name, blocks: team.blocks.map((block) => block.blockCode)}))}, null, 2));
