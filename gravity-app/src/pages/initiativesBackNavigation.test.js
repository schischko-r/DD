import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const pageSource = readFileSync(new URL('./InitiativesBacklogPage.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const aboutSource = readFileSync(new URL('./AboutPage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('every full-page view can be left the same way', () => {
  for (const [name, source] of [['InitiativesBacklogPage', pageSource], ['AboutPage', aboutSource]]) {
    assert.match(source, /BUTTON_INTENT\.navigation/, `${name} offers the shared back control`);
    assert.match(source, /<Icon data=\{ArrowLeft\} size=\{16\} \/> К Summary/, `${name} names the view it returns to`);
    assert.doesNotMatch(source, /К сводке/, `${name} calls the view by the name the navigation uses`);
  }
});

test('the initiatives page receives a way back and shows it before the data lands', () => {
  assert.match(pageSource, /export function InitiativesBacklogPage\(\{onBack\}\)/);
  assert.match(
    appSource,
    /<InitiativesBacklogPage onBack=\{\(\) => \{ setView\('dashboard'\); window\.scrollTo\(0, 0\); \}\} \/>/,
    'App hands it the same handler the other pages get',
  );

  const backControls = pageSource.match(/className="initiatives-back"/g) || [];
  assert.equal(backControls.length, 2, 'the loading state carries it too, so a slow fetch is not a dead end');
  const loading = pageSource.slice(pageSource.indexOf('if (!data) return'), pageSource.indexOf('</main>;') + 8);
  assert.match(loading, /initiatives-back/);
  assert.match(loading, /initiatives-document/, 'the loading state keeps the same column, so the control does not jump on load');

  for (const [source, name] of [[pageSource, 'initiatives'], [aboutSource, 'about']]) {
    // "initiatives-back" also matches inside initiatives-backlog.json, so match the attribute.
    assert.ok(
      source.indexOf(`className="${name}-document"`) < source.indexOf(`className="${name}-back"`),
      `the ${name} control sits inside the document column, aligned with the copy`,
    );
  }

  assert.match(stylesSource, /\.about-back, \.initiatives-back \{ margin-bottom: 14px; \}/);
});

test('both pages open with the same Data-Driven B2C eyebrow', () => {
  for (const [source, name] of [[pageSource, 'initiatives'], [aboutSource, 'about']]) {
    assert.match(
      source,
      new RegExp(`<div className="${name}-eyebrow"><Icon data=\\{CircleInfo\\} size=\\{16\\} /><span>Data-Driven B2C</span></div>`),
      `${name} uses the icon and the mixed-case label`,
    );
  }
  assert.doesNotMatch(pageSource, /DATA-DRIVEN B2C/, 'the shouting copy is gone; the rule uppercases it');
  assert.match(
    stylesSource,
    /\.about-eyebrow, \.initiatives-eyebrow \{ margin-bottom: 18px;[^}]*color: var\(--g-color-text-info-heavy\);/,
    'one rule, so the two pages cannot drift apart again',
  );
});
