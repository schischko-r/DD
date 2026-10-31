import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/verify-manual-assessments.mjs');
const run = (input) => spawnSync(process.execPath, [script], {
  cwd: root, encoding: 'utf8', env: {...process.env, DDI_REPORT_DATA_PATH: input},
});

test('prebuild verifies actual manual assessments and rejects a rebuilt source missing an assessed team', () => {
  const sourcePath = path.join(root, 'public/report-data.json');
  const before = fs.readFileSync(sourcePath);
  const good = run(sourcePath);
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /Manual Q3 assessments preserved: \d+ values checked/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ddi-assessment-check-'));
  try {
    const source = JSON.parse(before);
    source.products = source.products.filter((team) => team.name !== 'НСЖ');
    const input = path.join(directory, 'report-data.json');
    fs.writeFileSync(input, JSON.stringify(source));
    const missing = run(input);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Manual DDI assessments would be lost/);
    assert.match(missing.stderr, /missing team УБ \/ НСЖ/);
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
  assert.deepEqual(fs.readFileSync(sourcePath), before);
});
