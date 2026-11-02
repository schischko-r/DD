// Additional source links; generated historical answers remain unchanged.
const source = (sheet, cell, target, url) => ({
  file: 'Расчет_СХ_чек_проверка релевантности.xlsx', sheet, cell, target, url,
});
const workingAgeReport = 'https://navigator.sigma.sbrf.ru/gdash/1000001388';
export const supplementarySegmentLinks = {
  'cbb36731-ec7c-5e0c-9516-c3b21328e952¦Рабочий возраст': [
    source('Рабочий возраст', 'C85', 'attractReport', workingAgeReport),
    source('Рабочий возраст', 'C100', 'churnReport', workingAgeReport),
    source('Рабочий возраст (2)', 'F86', 'churnReport', 'https://navigator.sigma.sbrf.ru/gdash/1000006592#eyJ3aWRnZXRzIjp7IjEwMDA1MjYyNTQiOnsibW9kaWZpZWRSb3dzIjp7IjUiOjAsIjkiOjB9fX19'),
    source('Рабочий возраст (2)', 'C202', 'backlog', 'https://sbertrack.sberbank.ru/swtr/units/all?space=NLTKRBCHVZRST'),
  ],
  'b89fb857-45f0-5046-9811-cfcb31c0a656¦Молодежь': [
    source('Молодежь', 'C202', 'backlog', 'https://jira.sberbank.ru/secure/RapidBoard.jspa?rapidView=41166&projectKey=SDRSA'),
  ],
  '74567319-718b-554b-a770-096b8acbecdf¦Top Affluent': [
    source('Top Affluent', 'C85', 'attractReport', 'https://navigator.sigma.sbrf.ru/gdash/1000000135/1000046561'),
    source('Top Affluent', 'C202', 'backlog', 'https://sbertrack.sberbank.ru/swtr/board/b5380d96-6b2a-4846-9a42-ac7e877607cf?space=PSDA&tenant=default&spaces=%5B%7B%22label%22%3A%22Premium_Solutions_DA%22%2C%22value%22%3A%22PSDA%22%7D%5D'),
  ],
  '371e8205-137b-5e04-9212-c2c9c57e0d04¦PB': [
    source('PB', 'C100', 'churnReport', 'https://navigator.sigma.sbrf.ru/gdash/1000000301/1000003047?segment=PB'),
  ],
  '0b1990e4-3fd5-5f25-8f50-110ffedac76f¦МВС': [
    source('МВС', 'C85', 'attractReport', 'https://confluence.sberbank.ru/pages/viewpage.action?pageId=6699321962'),
  ],
};
