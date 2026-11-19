import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = new URL('./', import.meta.url);
const read = async (path) => JSON.parse(await fs.readFile(new URL(path, directory), 'utf8'));
const data = await read('report-app/src/data.json');
const reviewed = await read('reviewed.json');
const source = await read('../ddi-q3-survey-export-2026-11-11/responses.json');
const responses = source.responses.filter((row) => row.year === '2026' && row.quarter === '3' && !row.excludedByConfirmedUserInstruction);
const teams = data.queries.team_pains.rows;
const totals = data.queries.pain_totals.rows;
const units = data.queries.unit_totals.rows;
const unitPains = data.queries.unit_pains.rows;
const comments = data.queries.survey_comments.rows;
const [summary] = data.queries.survey_summary.rows;
const checks = [];
const check = (label, fn) => { fn(); checks.push(label); };

check('Authoring snapshot contains exactly the reviewed queries and analysis', () => {
  assert.deepEqual(data.queries, reviewed.queries);
  assert.deepEqual(data.analysis, reviewed.analysis);
  assert.equal(data.status, 'reviewed');
  assert.equal(data.report.asOf, '2026-10-28');
});
check('All 76 canonical teams and 79 valid responses are represented once', () => {
  assert.equal(responses.length, 79);
  assert.equal(teams.length, 76);
  assert.equal(new Set(teams.map((row) => row.teamId)).size, 76);
  assert.deepEqual(new Set(teams.map((row) => row.teamId)), new Set(responses.map((row) => row.canonicalTeam.id)));
  assert.equal(teams.reduce((sum, row) => sum + row.responseCount, 0), 79);
  for (const team of teams) {
    const original = responses.filter((row) => row.canonicalTeam.id === team.teamId);
    assert.equal(team.responseCount, original.length);
    assert.deepEqual(new Set(team.selectedOptions), new Set(original.flatMap((row) => row.answers.support)));
    assert.deepEqual(new Set(team.records.map((row) => row.record)), new Set(original.map((row) => row.recordId)));
    assert.ok(original.every((row) => row.canonicalTeam.unit === team.unit));
    assert.equal(team.painCount, team.painIds.length);
  }
});
check('Eight pain frequencies, all percentages, and 206 mentions reconcile', () => {
  assert.deepEqual(totals.map((row) => row.teams), [46, 41, 31, 24, 22, 19, 12, 11]);
  for (const pain of totals) {
    const matching = teams.filter((team) => team.selectedOptions.includes(pain.fullLabel));
    assert.equal(pain.teams, matching.length);
    assert.equal(pain.total, 76);
    assert.equal(pain.share, matching.length / 76 * 100);
    assert.deepEqual(new Set(matching.map((row) => row.teamId)), new Set(teams.filter((row) => row.painIds.includes(pain.id)).map((row) => row.teamId)));
  }
  assert.equal(totals.reduce((sum, row) => sum + row.teams, 0), 206);
  assert.equal(teams.reduce((sum, row) => sum + row.painCount, 0), 206);
});
check('All 64 unit × pain cells use their own unit denominator', () => {
  assert.deepEqual(Object.fromEntries(units.map((row) => [row.unit, row.teams])), { DB: 16, CBP: 13, 'УБ': 20, CX: 11, Data: 4, DP: 4, PC: 4, 'ДомКлик': 4 });
  assert.equal(unitPains.length, 64);
  assert.equal(new Set(unitPains.map((row) => `${row.unit}/${row.id}`)).size, 64);
  for (const unit of units) {
    const memberTeams = teams.filter((row) => row.unit === unit.unit);
    assert.equal(memberTeams.length, unit.teams);
    assert.equal(memberTeams.reduce((sum, row) => sum + row.responseCount, 0), unit.responses);
    for (const status of ['pain', 'okay', 'unclear']) assert.equal(memberTeams.filter((row) => row.status === status).length, unit[status]);
    for (const cell of unitPains.filter((row) => row.unit === unit.unit)) {
      const matching = memberTeams.filter((team) => team.painIds.includes(cell.id));
      assert.equal(cell.teams, matching.length);
      assert.equal(cell.total, memberTeams.length);
      assert.equal(cell.share, matching.length / memberTeams.length * 100);
    }
  }
});
check('Ten comments are literal source text; explicit okay and unclear remain separate', () => {
  const originals = responses.filter((row) => String(row.answers.supportOther || '').trim());
  assert.equal(originals.length, 10);
  assert.equal(comments.length, 10);
  for (const comment of comments) {
    const original = originals.find((row) => row.recordId === comment.record);
    assert.ok(original);
    assert.equal(comment.text, original.answers.supportOther.trim());
    assert.equal(comment.teamId, original.canonicalTeam.id);
    assert.equal(comment.unit, original.canonicalTeam.unit);
  }
  assert.deepEqual(teams.filter((row) => row.status === 'okay').map((row) => [row.unit, row.team]), [['ДомКлик', 'Сделка вторичка']]);
  assert.deepEqual(teams.filter((row) => row.status === 'unclear').map((row) => [row.unit, row.team]), [['УБ', 'Страхование жизни']]);
  assert.deepEqual(comments.reduce((counts, row) => ({ ...counts, [row.status]: counts[row.status] + 1 }), { pain: 0, okay: 0, unclear: 0 }), { pain: 8, okay: 1, unclear: 1 });
});
check('Summary and survey-design caveat are consistent', () => {
  assert.equal(summary.teams, 76);
  assert.equal(summary.responses, 79);
  assert.equal(summary.pain, 74);
  assert.equal(summary.okay, 1);
  assert.equal(summary.unclear, 1);
  assert.equal(summary.teamsWithClosedPains, 72);
  assert.equal(summary.sharedTopPains.either, 65);
  assert.equal(summary.sharedTopPains.both, 22);
  for (const query of Object.values(data.queries)) {
    assert.ok(query.source.caveats.some((caveat) => caveat.includes('обязательным') && caveat.includes('не измерение доли удовлетворённых')));
  }
});

let artifact = null;
const buildFile = new URL('report-app/dist/data-app-build.json', directory);
try {
  const build = JSON.parse(await fs.readFile(buildFile, 'utf8'));
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const sourceBytes = await fs.readFile(new URL('report-app/src/data.json', directory));
  const htmlBytes = await fs.readFile(new URL(`report-app/dist/${build.html.path}`, directory));
  const snapshotBytes = await fs.readFile(new URL(`report-app/dist/${build.snapshot.path}`, directory));
  const portableBytes = await fs.readFile(new URL('Боли_команд_B2C_III_квартал_2026.html', directory));
  const portable = portableBytes.toString('utf8');
  check('Final split build hashes, bytes, and complete snapshot agree', () => {
    assert.equal(hash(htmlBytes), build.html.sha256);
    assert.equal(htmlBytes.length, build.html.bytes);
    assert.equal(hash(snapshotBytes), build.snapshot.sha256);
    assert.equal(snapshotBytes.length, build.snapshot.bytes);
    assert.equal(hash(sourceBytes), build.sourceSnapshotSha256);
    assert.deepEqual(JSON.parse(snapshotBytes), data);
    assert.equal(data.buildStatus, 'complete');
  });
  check('Portable HTML embeds exactly the final reviewed 76-team dataset', () => {
    const scripts = [...portable.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    const chunks = scripts.filter((match) => match[1].includes('application/json')).map((match) => match[2]);
    assert.ok(chunks.length > 0);
    const embedded = JSON.parse(chunks.join(''));
    assert.deepEqual(embedded, data);
    assert.equal(embedded.id, 'report:49ec1bf4-f02d-42fc-b2e1-4b399a4c85f9');
    assert.equal(embedded.queries.team_pains.rows.length, 76);
    assert.ok(portable.includes(`name="data-app-snapshot-sha256" content="${build.snapshot.sha256}"`));
  });
  check('Portable HTML has no external script, stylesheet, font, or image dependencies', () => {
    const tags = portable.match(/<(?:script|link|img|source|iframe)\b[^>]*>/gi) || [];
    for (const tag of tags) {
      for (const match of tag.matchAll(/\b(?:src|href|srcset)\s*=\s*["']([^"']*)["']/gi)) {
        assert.ok(match[1].startsWith('data:') || match[1].startsWith('#'), `External asset reference: ${match[1].slice(0, 150)}`);
      }
    }
    for (const [, style] of portable.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      assert.ok(!/@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i.test(style));
      for (const [, asset] of style.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) assert.ok(asset.startsWith('data:') || asset.startsWith('#'), `External CSS asset: ${asset}`);
    }
  });
  artifact = { portableSha256: hash(portableBytes), portableBytes: portableBytes.length, buildHtmlSha256: build.html.sha256, sidecarSha256: build.snapshot.sha256 };
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const output = { status: 'PASS', checks, checkedAt: new Date().toISOString(), snapshotSha256: createHash('sha256').update(await fs.readFile(new URL('report-app/src/data.json', directory))).digest('hex') };
if (artifact) output.artifact = artifact;
await fs.writeFile(new URL('tester-validation.json', directory), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
