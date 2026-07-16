import test from 'node:test';
import assert from 'node:assert/strict';
import {groupMethodologySections, methodologyCriteria, methodologyScoreTheme, parseMethodologyContent} from './methodologyPresentation.js';

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
