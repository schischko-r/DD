import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DD_FAQ} from '../data/ddFaq.js';

const aboutPageSource = readFileSync(new URL('./AboutPage.jsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('./DashboardPage.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('FAQ keeps all nine questions and answers from the supplied workbook', () => {
  assert.equal(DD_FAQ.length, 9);
  assert.deepEqual(
    DD_FAQ.map((item) => item.question),
    [
      'Как рассчитывается значение по каждому показателю?',
      'Какая метрика замерялась по итогам опроса, а какая — по цифровым следам?',
      'Почему для получения максимальной оценки в 100% доля исследовательских задач должна быть не менее 40%?',
      'У нас в структуре нет DA, все DA — в Штабе. Как учитывается доля исследовательских задач DA?',
      'Почему CX Score участвует в DD-индексе?',
      'Как оценивался блок «Цели уровня ЛЮ/ЛТ»? Обязательно ли цели должны быть выведены в мастер-дэш юнита?',
      'Будут ли считаться A/B-тесты на платформе АБ Sberworks, если нет плана?',
      'Почему оценка 0%, если мы проводим A/B-тесты на SberNBA?',
      'Мы некорректно ответили на вопрос. Можно ли скорректировать оценку по этому вопросу на более высокую?',
    ],
  );
  DD_FAQ.forEach((item) => assert.ok(item.answer.length > 0));
});

test('methodology renders an accessible Gravity UI FAQ and exposes its local anchor', () => {
  assert.match(aboutPageSource, /import \{[^}]*Disclosure[^}]*\} from '@gravity-ui\/uikit'/);
  assert.match(aboutPageSource, /<a href="#faq">FAQ<\/a>/);
  assert.match(aboutPageSource, /<section className="about-section about-faq" id="faq" aria-labelledby="about-faq-title">/);
  assert.match(aboutPageSource, /DD_FAQ\.map\(\(item, index\) => <Disclosure/);
  assert.match(aboutPageSource, /arrowPosition="end"/);
});

test('Summary has separate methodology and FAQ actions without nested controls', () => {
  assert.match(dashboardSource, /<Card className="dashboard-about-card" view="outlined" type="container">/);
  assert.match(dashboardSource, /<button className="dashboard-about-main" type="button"[^>]+onClick=\{onClick\}>/);
  assert.match(dashboardSource, /action="Методология" onClick=\{\(\) => onAbout\(\)\} secondaryAction=\{\{label: 'FAQ', onClick: \(\) => onAbout\('faq'\)\}\}/);
  assert.doesNotMatch(dashboardSource, /dashboard-about-card" type="action"/);
});

test('FAQ deep-link survives the view transition and stacks cleanly on mobile', () => {
  assert.match(appSource, /const \[aboutSection, setAboutSection\] = useState\(''\)/);
  assert.match(appSource, /<AboutPage initialSection=\{aboutSection\}/);
  assert.match(aboutPageSource, /document\.getElementById\(initialSection\)\?\.scrollIntoView\(\{block: 'start'\}\)/);
  assert.match(stylesSource, /\.about-faq-list\s*\{[^}]*width:\s*100%/s);
  assert.doesNotMatch(stylesSource, /\.about-faq-list\s*\{[^}]*max-width:/s);
  assert.match(stylesSource, /\.about-faq-answer\s*\{[^}]*width:\s*100%[^}]*max-width:\s*none/s);
  assert.doesNotMatch(stylesSource, /\.about-faq-answer\s*\{[^}]*max-width:\s*760px/s);
  assert.match(stylesSource, /\.about-faq-item \.g-disclosure__trigger\s*\{[^}]*min-height:\s*64px/s);
  assert.match(stylesSource, /\.about-faq-item \.g-disclosure__content\s*\{[^}]*padding:\s*0 calc\(var\(--about-faq-inline\) \+ var\(--about-faq-arrow-space\)\) 20px calc\(var\(--about-faq-inline\) \+ var\(--about-faq-number\) \+ var\(--about-faq-gap\)\)/s);
  assert.match(stylesSource, /@media \(max-width:\s*760px\)[^\n]*\.about-faq-heading\s*\{[^}]*display:\s*grid[^\n]*\.about-faq-item\s*\{[^}]*--about-faq-inline:\s*10px[^\n]*\.about-faq-item \.g-disclosure__content\s*\{[^}]*padding-bottom:\s*18px/s);
});

test('FAQ reuses the methodology surface, borders, and brand interaction tokens', () => {
  assert.match(aboutPageSource, /<Label theme="clear" size="s">\{DD_FAQ\.length\} вопросов<\/Label>/);
  assert.doesNotMatch(aboutPageSource, /<Label theme="info" size="s">\{DD_FAQ\.length\} вопросов<\/Label>/);
  assert.match(stylesSource, /\.about-faq-heading > \.g-label\s*\{[^}]*background:\s*var\(--g-color-base-selection\)[^}]*box-shadow:\s*inset 0 0 0 1px var\(--g-color-line-brand\)[^}]*color:\s*var\(--g-color-text-brand-heavy\)/s);
  assert.match(stylesSource, /\.about-faq-list\s*\{[^}]*border:\s*1px solid var\(--g-color-line-generic\)[^}]*background:\s*var\(--g-color-base-background\)/s);
  assert.match(stylesSource, /\.about-faq-item \.g-disclosure__trigger:hover\s*\{[^}]*background:\s*var\(--g-color-base-selection\)/s);
  assert.match(stylesSource, /\.about-faq-item \.g-disclosure__trigger\[aria-expanded="true"\]\s*\{[^}]*background:\s*var\(--g-color-base-selection\)[^}]*box-shadow:\s*inset 3px 0 var\(--g-color-line-brand\)/s);
  assert.match(stylesSource, /\.about-faq-item \.g-disclosure__trigger\[aria-expanded="true"\]:hover\s*\{[^}]*background:\s*var\(--g-color-base-selection-hover\)/s);
  assert.match(stylesSource, /\.about-faq-item \.g-disclosure__trigger \.g-arrow-toggle\s*\{[^}]*color:\s*var\(--g-color-text-brand-heavy\)/s);
  assert.match(stylesSource, /\.about-faq-question > span\s*\{[^}]*color:\s*var\(--g-color-text-brand-heavy\)/s);
  assert.doesNotMatch(stylesSource, /\.about-faq-item \.g-disclosure__trigger:hover\s*\{[^}]*var\(--g-color-base-simple-hover\)/s);
});

test('Summary renders FAQ with the same button color as Methodology', () => {
  const matchingButtons = dashboardSource.match(/<Button view="outlined-info" size="m" onClick=\{[^}]+\}>/g) || [];
  assert.equal(matchingButtons.length, 2);
  assert.doesNotMatch(dashboardSource, /secondaryAction && <Button view="flat"/);
});
