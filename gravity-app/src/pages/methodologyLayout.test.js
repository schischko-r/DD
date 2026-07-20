import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const aboutPageSource = readFileSync(new URL('./AboutPage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('methodology filters use one large Gravity UI control height', () => {
  assert.match(aboutPageSource, /aria-label="Объект оценки"[^>]+size="l"/);
  assert.match(aboutPageSource, /aria-label="Направление методики"[^>]+size="l"/);
  assert.doesNotMatch(aboutPageSource, /aria-label="Направление методики"[^>]+size="m"/);
});

test('methodology metadata uses one horizontal 12px row with a mobile stack', () => {
  assert.match(aboutPageSource, /about-methodology-subsection-meta/);
  assert.match(aboutPageSource, /about-methodology-verification-title">Источник оценки/);
  assert.doesNotMatch(aboutPageSource, /about-methodology-verification-title[^>]*><Icon/);
  assert.match(stylesSource, /\.about-methodology-subsection-meta\s*\{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\)[^}]*font-size:\s*12px/s);
  assert.match(stylesSource, /\.about-methodology-verification\s*\{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\)[^}]*font-size:\s*12px/s);
  assert.match(stylesSource, /@media \(max-width:\s*560px\)[^\n]*\.about-methodology-subsection-meta\s*\{[^}]*grid-template-columns:\s*1fr[^\n]*\.about-methodology-verification\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test('methodology panel keeps the approved editorial type hierarchy', () => {
  assert.match(stylesSource, /\.about-methodology-panel-head h3\s*\{[^}]*font-size:\s*20px/s);
  assert.match(stylesSource, /\.about-methodology-criterion-number\s*\{[^}]*font-size:\s*12px/s);
  assert.match(stylesSource, /\.about-methodology-criterion-head h4\s*\{[^}]*font-size:\s*13px/s);
  assert.match(stylesSource, /\.about-methodology-criterion-description\s*\{[^}]*font-size:\s*13px/s);
  assert.match(stylesSource, /\.about-methodology-score-head\s*\{[^}]*font-size:\s*12px/s);
  assert.match(stylesSource, /\.about-methodology-score-condition\s*\{[^}]*font-size:\s*13px/s);
  assert.match(aboutPageSource, /about-methodology-criterion-number[^>]*>\{String\(index \+ 1\)\.padStart\(2, '0'\)\}\.<\/span>/);
  assert.match(aboutPageSource, /<Label theme=\{methodologyScoreTheme\(score\.label\)\} size="s">/);
});

test('methodology score table reaches the criterion number axis', () => {
  assert.match(stylesSource, /\.about-methodology-score-table\s*\{[^}]*margin:\s*14px 0 0;/s);
  assert.doesNotMatch(stylesSource, /\.about-methodology-score-table\s*\{[^}]*margin:\s*14px 0 0 32px;/s);
});
