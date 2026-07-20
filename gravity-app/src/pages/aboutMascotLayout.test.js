import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const aboutPageSource = readFileSync(new URL('./AboutPage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('about page uses two decorative mascots in a left-right editorial rhythm', () => {
  assert.match(aboutPageSource, /mascot\/thinking\.png/);
  assert.match(aboutPageSource, /mascot\/question\.png/);

  const positions = [...aboutPageSource.matchAll(/about-mascot about-mascot--(right|left)/g)]
    .map((match) => match[1]);
  assert.deepEqual(positions, ['left', 'right']);

  const decorativeImages = [...aboutPageSource.matchAll(/<img[^>]+className="about-mascot-image"[^>]+>/g)];
  assert.equal(decorativeImages.length, 2);
  decorativeImages.forEach((image) => {
    assert.match(image[0], /alt=""/);
    assert.match(image[0], /aria-hidden="true"/);
  });
});

test('about mascots stack below section copy on narrow screens', () => {
  assert.match(stylesSource, /\.about-editorial-row\s*\{[^}]*display:\s*grid/s);
  assert.match(stylesSource, /@media \(max-width:\s*760px\)/);
  assert.match(stylesSource, /\.about-editorial-row,\s*\.about-editorial-row--reverse\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(stylesSource, /\.about-mascot\s*\{[^}]*order:\s*2/s);
});

test('about page uses one white document canvas with aligned responsive gutters', () => {
  assert.match(aboutPageSource, /<main className="content about-page">\s*<div className="about-document">/s);
  assert.match(stylesSource, /\.content\.about-page\s*\{[^}]*padding:\s*0 24px[^}]*background:\s*var\(--g-color-base-generic\)/s);
  assert.match(stylesSource, /\.about-document\s*\{[^}]*padding:\s*42px 24px 84px[^}]*background:\s*var\(--g-color-base-background\)/s);
  assert.match(stylesSource, /\.about-hero\s*\{[^}]*padding:\s*52px 0/s);
  assert.match(stylesSource, /\.about-nav\s*\{[^}]*background:\s*var\(--g-color-base-background\)/s);
  assert.match(stylesSource, /@media \(max-width:\s*1000px\)[^\n]*\.content\.about-page\s*\{[^}]*padding:\s*0 12px[^\n]*\.about-document\s*\{[^}]*padding:\s*32px 12px 60px/s);
  assert.match(stylesSource, /@media \(max-width:\s*760px\)[^\n]*\.content\.about-page\s*\{[^}]*padding:\s*0[^\n]*\.about-document\s*\{[^}]*padding:\s*24px 14px 48px/s);
});
