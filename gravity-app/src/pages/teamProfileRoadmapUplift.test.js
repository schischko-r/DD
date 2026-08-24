import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatRoadmapUplift, roadmapLevelChanged} from '../domain/report.js';

const profileSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const roadmapSource = profileSource.match(
  /function RoadmapUplift\([\s\S]*?(?=\nfunction GoalsHelpContent)/,
)?.[0] || '';

test('roadmap uplift formatting is stable for Russian UI copy', () => {
  assert.equal(formatRoadmapUplift(12), '12');
  assert.equal(formatRoadmapUplift(12.34), '12,3');
  assert.equal(formatRoadmapUplift(12.36), '12,4');
  assert.equal(formatRoadmapUplift('0.5'), '0,5');
  assert.equal(formatRoadmapUplift(null), '');
  assert.equal(formatRoadmapUplift(''), '');
  assert.equal(formatRoadmapUplift('not-a-number'), '');
});

test('expected roadmap level is shown only for a real maturity transition', () => {
  assert.equal(roadmapLevelChanged('Развивающиеся', 'Зрелые'), true);
  assert.equal(roadmapLevelChanged('Зрелые', 'Зрелые'), false);
  assert.equal(roadmapLevelChanged('Лидеры Data Driven B2C', 'Лидеры'), false);
  assert.equal(roadmapLevelChanged('Зрелые', ''), false);
});

test('roadmap forecast stays hidden for absent, empty, zero, or invalid uplift data', () => {
  assert.match(roadmapSource, /const items = Array\.isArray\(roadmap\?\.items\) \? roadmap\.items : \[\];/);
  assert.match(
    roadmapSource,
    /if \(!items\.length \|\| !Number\.isFinite\(uplift\) \|\| uplift <= 0 \|\| !upliftLabel\) return null;/,
  );
});

test('team profile renders the roadmap uplift directly below the next-level copy', () => {
  const nextLevelIndex = profileSource.indexOf('className="index-next-level"');
  const roadmapIndex = profileSource.indexOf('<RoadmapUplift key={product.id || product.name}');
  const methodologyIndex = profileSource.indexOf('className="index-methodology-footer"', roadmapIndex);

  assert.ok(nextLevelIndex >= 0);
  assert.ok(roadmapIndex > nextLevelIndex);
  assert.ok(methodologyIndex > roadmapIndex);
  assert.match(roadmapSource, /<div className="index-roadmap-summary-row">/);
  assert.match(roadmapSource, /Исходя из дорожной карты продукта ожидается uplift:/);
  assert.doesNotMatch(roadmapSource, /аплифт/iu);
  assert.match(roadmapSource, /<Text className="index-roadmap-uplift-value" variant="body-1">\+ \{upliftLabel\} п\.\u043f\.<\/Text>/);
  assert.doesNotMatch(roadmapSource, /index-roadmap-uplift-(?:trigger|value)[^>]*(?:onClick|aria-haspopup)/);
  assert.match(roadmapSource, /\{showExpectedLevel && <div className="index-roadmap-expected-row"><Text[^>]+>Новый ожидаемый уровень:<\/Text><Text[^>]+>\{expectedLevel\}<\/Text><\/div>\}/);
  assert.match(roadmapSource, /<Button className="index-roadmap-dialog-trigger" view="flat-info" size="s" type="button" aria-haspopup="dialog" aria-label=\{`Открыть дорожную карту продукта \$\{productName\}`\} onClick=\{\(\) => setOpen\(true\)\}>Перейти <Icon data=\{ChevronRight\} size=\{13\} \/><\/Button>/);
});

test('roadmap dialog contains one semantic table with the exact four-column header', () => {
  assert.match(roadmapSource, /<section className="index-roadmap-uplift" aria-label="Прогноз по дорожной карте">/);
  assert.match(roadmapSource, /<Dialog className="roadmap-dialog" open=\{open\} onClose=\{\(\) => setOpen\(false\)\} hasCloseButton maxWidth="xl" fullWidth contentOverflow="auto" aria-label=\{`Дорожная карта продукта \$\{productName\}`\}>/);
  assert.match(roadmapSource, /<Dialog\.Header caption=\{productName\} \/>/);
  assert.doesNotMatch(roadmapSource, /Дорожная карта продукта ·/);
  assert.equal(roadmapSource.match(/<table\b/g)?.length, 1);
  assert.equal(roadmapSource.match(/<thead\b/g)?.length, 1);
  assert.equal(roadmapSource.match(/<tbody\b/g)?.length, 1);
  assert.match(roadmapSource, /<thead>\s*<tr>\s*<th scope="col">Блок для развития<\/th>\s*<th scope="col">Квартал<\/th>\s*<th scope="col">Планируемое мероприятие<\/th>\s*<th scope="col">Ожидание прироста индекса DD, п\.п\.<\/th>\s*<\/tr>\s*<\/thead>/);
  assert.doesNotMatch(roadmapSource, /<th scope="col">Срок<\/th>|roadmap-due-date-cell|roadmapDate\(/);
  assert.doesNotMatch(roadmapSource, /<Table\b|className="roadmap-(?:groups|block|quarter-group|due-group)"|<h[3-5]\b/);
  assert.doesNotMatch(roadmapSource, /<th scope="col">(?:Продукт|Статус)<\/th>/);
});

test('roadmap grouped cells use accessible rowgroup headers and computed rowSpan values', () => {
  assert.match(roadmapSource, /row\.blockRowSpan > 0 && <th className="roadmap-group-cell roadmap-block-cell" scope="rowgroup" rowSpan=\{row\.blockRowSpan\}>\{row\.blockLabel\}<\/th>/);
  assert.match(roadmapSource, /row\.quarterRowSpan > 0 && <th className="roadmap-group-cell roadmap-quarter-cell" scope="rowgroup" rowSpan=\{row\.quarterRowSpan\}>\{row\.quarterLabel\}<\/th>/);
  assert.doesNotMatch(roadmapSource, /row\.dueDateRowSpan|row\.dueDateLabel/);
});

test('roadmap UI uses tokenized 4px borders and keeps table overflow local on mobile', () => {
  assert.match(stylesSource, /\.index-roadmap-uplift\s*\{[^}]*border-top:\s*1px solid var\(--g-color-line-generic\);/s);
  assert.match(stylesSource, /\.index-roadmap-summary-row, \.index-roadmap-expected-row\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s);
  assert.match(stylesSource, /\.index-roadmap-summary-row > \.index-roadmap-uplift-value, \.index-roadmap-expected-row > \.index-roadmap-expected-level\s*\{[^}]*font-size:\s*11px[^}]*font-weight:\s*500;[^}]*line-height:\s*1\.4;/s);
  assert.doesNotMatch(stylesSource, /\.index-roadmap-uplift-trigger/);
  assert.match(stylesSource, /\.roadmap-table-scroll\s*\{[^}]*overflow-x:\s*auto;[^}]*border:\s*1px solid var\(--g-color-line-generic\);[^}]*border-radius:\s*4px;/s);
  assert.match(stylesSource, /\.roadmap-table\s*\{[^}]*min-width:\s*760px;/s);
  assert.match(stylesSource, /\.roadmap-table th, \.roadmap-table td\s*\{[^}]*vertical-align:\s*top;/s);
  assert.match(stylesSource, /@media \(max-width: 560px\) \{[^\n]*\.roadmap-table\s*\{[^}]*min-width:\s*640px;/);
});
