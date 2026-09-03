import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');

test('A/B training resources include a direct link to the experiment platform', () => {
  assert.match(
    profileSource,
    /\{label: 'A\/B-платформа', href: 'https:\/\/ab\.sberbank\.ru\/experiments\?source=1'\}/,
  );
  assert.match(
    profileSource,
    /const instructionLinks = \/\^hyp\\\.ab_tests\$\/i\.test\(metric\.code\) \? AB_TEST_INSTRUCTION_LINKS : \[\];/,
  );
});

test('research score metric opens the current solutions library', () => {
  assert.match(
    profileSource,
    /const RESEARCH_LIBRARY_URL = 'https:\/\/mapp\.sberbank\.ru\/b2cda\/page\/52475';/,
  );
  assert.match(
    profileSource,
    /const library = \/\^hyp\\\.datadriven_rating_7_5\$\/i\.test\(metric\.code\) \? \{link: RESEARCH_LIBRARY_URL\} : null;/,
  );
});
