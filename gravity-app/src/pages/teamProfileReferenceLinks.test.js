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

test('stand access instructions stay identical in the report dialog and the backlog modal', () => {
  const backlogSource = readFileSync(new URL('./BacklogDecompositionPage.jsx', import.meta.url), 'utf8');
  const steps = [
    'Для доступа непосредственно к системе необходимо в АС Друг в поисковой строке ввести «Доступ к стендам разработки и тестирования», далее:',
    'Выбрать «Открыть доступ»',
    'В поле «Выберите автоматизированную систему или ИТ услугу» указать «AI HUB B2C (CI06049712)»',
    'В обосновании',
    'Для разработки и тестирования инструмента AI суммаризации',
    'Для входа в систему используйте почтовый адрес сигма и первичный пароль. ФИО, кому направить первичный пароль, просьба направить на почту (Хазипова Мария Юрьевна).',
  ];
  for (const step of steps) {
    assert.ok(profileSource.includes(step), `team profile dialog: ${step}`);
    assert.ok(backlogSource.includes(step), `backlog modal: ${step}`);
  }
  assert.ok(!profileSource.includes('ТС AI Навыки Штаба B2C'), 'retired stand name is gone');
  assert.match(profileSource, /const COMPLEX_REPORT_URL|COMPLEX_REPORT_URL/);
});
