import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupMethodologySections, methodologyCriteria, methodologyScoreTheme, parseMethodologyContent} from './methodologyPresentation.js';

const methodologyProfiles = JSON.parse(readFileSync(new URL('../data/methodologyCriteria.json', import.meta.url), 'utf8'));
const aboutPageSource = readFileSync(new URL('./AboutPage.jsx', import.meta.url), 'utf8');
const teamProfilePageSource = readFileSync(new URL('./TeamProfilePage.jsx', import.meta.url), 'utf8');

function methodologySection(profileKey, title, subgroup = '') {
  return methodologyProfiles
    .find((profile) => profile.key === profileKey)
    ?.sections.find((section) => section.title === title && section.subgroup === subgroup);
}

test('methodology sections with the same title are grouped into subsections', () => {
  const groups = groupMethodologySections([
    {title: 'Воронка', subgroup: 'Отчетность'},
    {title: 'Воронка', subgroup: 'Анализ'},
    {title: 'Алерты', subgroup: ''},
  ]);
  assert.deepEqual(groups.map((group) => [group.title, group.subsections.length]), [
    ['Воронка', 2],
    ['Алерты', 1],
  ]);
});

test('methodology content separates headings, score labels, and conditions', () => {
  const tokens = parseMethodologyContent([
    'Регулярная отчетность',
    'Оценка:',
    '0,5 баллов (100%) - формируется автоматически',
    '0,25 баллов (50%) - формируется по запросу',
    '',
    'Полнота отчета',
    '1 балл (100%) - комплексный отчет',
  ].join('\n'));
  assert.deepEqual(tokens, [
    {kind: 'heading', text: 'Регулярная отчетность'},
    {kind: 'score', label: '0,5 баллов (100%)', text: 'формируется автоматически'},
    {kind: 'score', label: '0,25 баллов (50%)', text: 'формируется по запросу'},
    {kind: 'break'},
    {kind: 'heading', text: 'Полнота отчета'},
    {kind: 'score', label: '1 балл (100%)', text: 'комплексный отчет'},
  ]);
});

test('methodology score themes follow the percentage in the workbook', () => {
  assert.equal(methodologyScoreTheme('1 балл (100%)'), 'success');
  assert.equal(methodologyScoreTheme('0,5 балла (50%)'), 'warning');
  assert.equal(methodologyScoreTheme('0 баллов (0%)'), 'danger');
});

test('methodology criteria keep each scoring rule in a separate readable group', () => {
  const criteria = methodologyCriteria([
    'Регулярная отчетность',
    '0,5 баллов (100%) - формируется автоматически',
    '0,25 баллов (50%) - формируется по запросу',
    '',
    'Полнота отчета',
    '1 балл (100%) - комплексный отчет',
  ].join('\n'));
  assert.deepEqual(criteria, [
    {
      title: 'Регулярная отчетность',
      description: [],
      scores: [
        {label: '0,5 баллов (100%)', text: 'формируется автоматически'},
        {label: '0,25 баллов (50%)', text: 'формируется по запросу'},
      ],
    },
    {
      title: 'Полнота отчета',
      description: [],
      scores: [{label: '1 балл (100%)', text: 'комплексный отчет'}],
    },
  ]);
});

test('methodology criteria promote long workbook descriptions to readable titles', () => {
  const longTitle = 'Настроены автоматические алерты по системным сбоям и всем ключевым бизнес-метрикам, которые определены для команды в расчетном периоде и подтверждены актуальными данными из отчетности';
  const [criterion] = methodologyCriteria(`${longTitle}\n1 балл (100%) - настроены полностью`);
  assert.equal(criterion.title, longTitle);
  assert.deepEqual(criterion.scores, [{label: '1 балл (100%)', text: 'настроены полностью'}]);
});

test('product churn reporting uses its own exact scope while attraction stays unchanged', () => {
  const churnScope = 'факторы оттока, пошаговая воронка отключения продукта, CR (% оттока), объёмы, механики, сегментный/когортный разрез, UX/UI';
  const popupChurnScope = 'факторы оттока, пошаговая воронка отключения продукта, CR (% оттока), объёмы, механики, сегментный или когортный разрез, UX/UI';
  const attractionScope = 'источники привлечения, пошаговая воронка, CR (% конверсии), объёмы, механики, сегментный/когортный разрез, UX/UI';
  const popupAttractionScope = 'источники привлечения, пошаговая воронка, CR (% конверсии), объёмы, механики, сегментный или когортный разрез, UX/UI';

  assert.ok(methodologySection('product', 'Воронка оттока', 'Отчетность').body.includes(churnScope));
  assert.ok(aboutPageSource.includes(`Комплексный отчёт: ${churnScope}.`));
  assert.ok(teamProfilePageSource.includes(`reportScope: '${popupChurnScope}'`));
  assert.ok(methodologySection('product', 'Воронка привлечения/оформления', 'Отчетность').body.includes(attractionScope));
  assert.ok(teamProfilePageSource.includes(`reportScope: '${popupAttractionScope}'`));
});

test('product mechanics render exactly six named criteria with their scores preserved', () => {
  const mechanics = methodologyCriteria(methodologySection('product', 'Механики').body);
  assert.deepEqual(mechanics.map(({title, scores}) => [title, scores.map(({label}) => label)]), [
    ['Удержание клиентов', ['1 балл (100%)', '0,5 балла (50%)']],
    ['Возврат клиентов', ['1 балл (100%)', '0,5 балла (50%)']],
    ['Перекрёстные продажи (cross-sell)', ['1 балл (100%)', '0,5 балла (50%)']],
    ['Дополнительные продажи (up-sell)', ['1 балл (100%)']],
    ['Гибкость изменений без IT', ['1 балл (100%)', '0,5 балла (50%)']],
    ['Мониторинг эффективности механик', ['0,25 балла (100%)']],
  ]);
  assert.equal(mechanics.some(({title}) => title === 'Дополнительные условия' || title === 'Условие оценки'), false);
});

test('research and A/B half-score rows occur once in every profile and use warning theme', () => {
  assert.equal(methodologyProfiles.length, 6);
  for (const profile of methodologyProfiles) {
    const body = methodologySection(profile.key, 'Гипотезы и инициативы').body;
    assert.equal((body.match(/0,5 балла \(50%\) — ≥ 20% бэклога на исследования/g) || []).length, 1, profile.key);
    assert.equal((body.match(/0,5 балла \(50%\) — доля проведённых A\/B-тестов составляет ≥ 30%/g) || []).length, 1, profile.key);
    const halfScoreRows = parseMethodologyContent(body).filter(({kind, text}) => kind === 'score' && (/≥ 20%/.test(text) || /≥ 30%/.test(text)));
    assert.equal(halfScoreRows.length, 2, profile.key);
    assert.deepEqual(halfScoreRows.map(({label}) => methodologyScoreTheme(label)), ['warning', 'warning'], profile.key);
  }
});

test('product CX methodology and team popup share the CX Score dashboard source and yellow score', () => {
  const cxBody = methodologySection('product', 'UX / CX Score').body;
  const source = 'На основе дешборда "CX Score"';
  const yellowScore = '0,5 балла (50%) — жёлтая зона CX Score';

  assert.ok(cxBody.includes(source));
  assert.ok(cxBody.includes(yellowScore));
  assert.ok(aboutPageSource.includes(`${source}.`));
  assert.ok(teamProfilePageSource.includes(`<p>${source}.</p>`));
  assert.ok(teamProfilePageSource.includes(`<b>0,5 балла (50%)</b> — жёлтая зона CX Score.`));
  assert.equal(methodologyScoreTheme('0,5 балла (50%)'), 'warning');
});

test('income segment mechanics separate return and monitoring from adjacent criteria', () => {
  const mechanics = methodologyCriteria(methodologySection('segment_income', 'Механики').body);
  const returnCriterion = mechanics.find(({title}) => title === 'Возврат клиентов');
  const monitoringCriterion = mechanics.find(({title}) => title === 'Мониторинг эффективности механик');
  const additionalCriterion = mechanics.find(({title}) => title === 'Дополнительные условия');

  assert.deepEqual(returnCriterion?.scores.map(({label}) => label), ['1 балл (100%)', '0,5 балла (50%)']);
  assert.deepEqual(monitoringCriterion?.scores, [{label: '0,25 балла (25%)', text: '— наличие метрик мониторинга эффективности механик'}]);
  assert.equal(additionalCriterion?.scores.some(({text}) => text.includes('мониторинга эффективности механик')), false);
});
