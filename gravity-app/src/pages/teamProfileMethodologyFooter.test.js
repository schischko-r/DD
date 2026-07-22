import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const appSource = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('team profile index footer opens the Data Driven methodology page', () => {
  assert.match(appSource, /<TeamProfilePage .*onAbout=\{\(\) => \{ setView\('about'\); window\.scrollTo\(0, 0\); \}\} \/>/);
  assert.match(profileSource, /Подробнее о подходе и критериях оценки, тут:/);
  assert.match(profileSource, /<Button view="flat-info" size="s" onClick=\{onAbout\}>Перейти/);
  assert.match(stylesSource, /\.index-methodology-footer\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;/s);
});
