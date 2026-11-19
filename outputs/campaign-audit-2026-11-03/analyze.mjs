import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const dir = path.dirname(fileURLToPath(import.meta.url));
const read = n => JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const current = read('current-metrics.json'), source = read('source-rows.json');
const q3Confirmed = process.env.CAMPAIGN_Q3_CONFIRMED === '1';
const norm = s => (s||'').toLowerCase().replaceAll('ё','е').replace(/\s+/g,' ').trim();
const rules = {
 'БПИФ': /^бпиф(?: |$)/,
 'Брокерский счет': /брокерск/,
 'Вклады+НС': /вклад|накопительн|^нс |^пассивы\. нс$/,
 'ДСЖ КК': /дсж кк/,
 'Дебетовая карта': /^сберкарта$|^сберкарта смена тарифа$|^транз акт\. дк$|^транзакционная активность по дебетов/,
 'Детская карта': /дк детская|сберкарта детская|детская сберкарта/,
 'ЗПИФ': /^зпиф /,
 'Зарплатный продукт': /зарплат|перевод зп|удержание зп/,
 'ИнвестКопилка': /^инвесткопилка /,
 'Конверсия': /^конверсия$/,
 'Много денег (НКПЗН)': /нкпзн/,
 'Монеты': /^монеты из драгоценных металлов$/,
 'НСЖ': /^нсж |^пассивы\. нсж$/,
 'ОПИФ': /^паевые инвестиционные фонды|^пиф |^пассивы\. пиф$|^докупка пиф$/,
 'ПДС': /^пдс(?: |$)|^перевод опс /,
 'Пакет услуг СберПервый': /^премиальные\. (?:пу сб1|привлечение в сб1)$/,
 'Пакет услуг СберПремьер': /сберпремьер|сбербанк премьер|приглашение в премьер|^премиальные\. пу сбербанк премьер$|^дорост_работа с уровнями нового сберпремьера$|пу премиальное обслуживание|пакет(?:е|а)? услуг премиальное обслуживание/,
 'Пенсионный продукт': /заявление на перевод пенсии|пдс триггер пенсия/,
 'Переводы по РФ': /^переводы p2p$|^транз акт\. переводы$|^переводы утилизация лимита$/,
 'Платежи': /^платежи |^транз акт\. платежи$|^оплата образования$|^оплата с нескольких счетов/,
 'Сейфы': /^индивидуальные сейфы$|^пассивы\. аренда сейфа$|^сейф_сервисный продукт$/,
 'Страхование залога': /^страховки\. защита залога$/,
 'Трансграничные переводы': /^международный денежный перевод|^международный денежный продукт гео$|^перевод за рубеж /,
 'Автокредит': /^автокредит(?:_|$)|^активы\. сберавтокред$/,
 'ВЗР': /^взр |^страховки\. взр$/,
 'ДСЖ ПК': /^страховки\. дсж пк$/,
 'ЗЛС': /^злс |^страховки\. защита на любой случай$/,
 'Кредитные карты': /^кредитная сберкарта|^активы\. кк |^предложение кредитная сберкарта$|^увеличение лимита по кредитной карте$|^молодежная кредитная карта |^trx перевод покупок с дк на кк$/,
 'ОМС': /^пассивы\. омс$|^омс |^пополнение омс /,
 'Кредитный потенциал': /^кредитный потенциал$/,
 'Образовательный кредит': /^активы\. образовательный кредит$|^образовательный кредит с государственной поддержкой$/,
 'КАСКО': /^каско$|^страховки\. каско$/,
 'ОСАГО': /^осаго(?: |$)|^страховки\. осаго$/,
 'СберПрайм': /^сберпрайм|^подписки сберпрайм$|^экосистема\. сберпрайм$/,
 'Потребительский кредит': /^потребительский кредит|^предложение потребительский кредит$|^активы\. пк$|^пк бо |^фк группа (?:2059|2063|2077|2106|71) |^фк рефинансирование|^рефинансирование кредита стороннего банка$/,
 'СберСпасибо': /^экосистема\. сберспасибо$|^транзакционная активность подключение к спасибо$/,
 'BNPL': /^активы\. bnpl$|^фк bnpl |^плати частями$/,
 'SberPay NFC': /sberpay_nfc/,
 'SberPay Ecom': /sberpay_online/,
 'Оплата улыбкой': /^оплата улыбкой$|оплата улыбкой/,
 'СБОЛ': /^мобильное приложение$|^обновление мп сбол|^реактивация мп сбол$|^транз акт\. мп сбол$|^цели в сбол /,
 'СберИнвестор': /^мп сберинвестиции$|^установка сберинвестор$|^реактивация сберинвестиции$/,
 'Уведомления': /^сервисное информирование$|^уведомления по кредитной истории$/,
};
// Combined offers and neighbouring products cannot establish a fact for either product separately.
const excludedNames = /сб1 осаго|сбервклад\+нс \(кросс\)|^пдс\+вклад$|^подборка продуктов|^транз акт\. перевод зп\/пенсии$|^как зарплатный$/;
const matches = (team, name) => {
 const n = norm(name);
 if (!name || !rules[team]?.test(n) || excludedNames.test(n)) return false;
 // These are products targeted at payroll/pension customers, not payroll/pension products.
 if (team === 'Зарплатный продукт' && /^(?:нс велком зарплатный|лучший процент зп)$/.test(n)) return false;
 if (team === 'Пенсионный продукт' && n === 'пдс триггер пенсия') return false;
 if (team === 'Пакет услуг СберПремьер' && /для бизнеса|сбербизнес|для ип/.test(n)) return false;
 return true;
};
const mappings = current.rows.filter((_,i)=>i%3===0).map(r=>({team:r.team,unit:r.unit,
 names:[...new Set(source.filter(s=>matches(r.team,s.product_name)).map(s=>s.product_name))].sort((a,b)=>a.localeCompare(b,'ru')),
 note: rules[r.team] ? 'Именованные кампании продукта; смежные и совместные предложения исключены' : 'Однозначного соответствия продукту нет'}));
// A matching source row is required. Zero and an absent product remain different states.
const audits = current.rows.map((r,i)=>{
 const success=r.metric.endsWith('nalichie_uspeshnyh_biznes_zapuskov');
 const month=success?'2026-04':q3Confirmed?'2026-07':'2026-09';
 const matched=source.filter(s=>s.quarter_start.startsWith(month)&&matches(r.team,s.product_name));
 const sums=Object.fromEntries(['self_service_fact','camp_fact','successful_self_service_fact_num','successful_camp_fact_num'].map(k=>[k,matched.length?matched.reduce((sum,s)=>sum+s[k],0):null]));
 const fields=success?['successful_self_service_fact_num','successful_camp_fact_num']:r.metric.endsWith('nalichie_self_service')?['self_service_fact']:['self_service_fact','camp_fact'];
 const fact=matched.length?Number(matched.some(s=>fields.some(k=>s[k]>=1))):null;
 let status,reason;
 if(!r.included){status='Вне расчета';reason=fact===1?'В источнике есть факт; применимость DDI не пересматривалась':'Метрика сейчас не входит в расчет DDI';}
 else if(!success&&!q3Confirmed){status='Не проверено';reason='Сентябрьских дат в XLSX нет: quarter_start содержит только 01.04 и 01.07';}
 else if(fact===null){status='Не проверено';reason='Нет однозначно сопоставленных строк продукта в нужном периоде';}
 else if(r.score===null){status='Не проверено';reason='В DDI нет числового балла';}
 else if(r.score!==fact){status='Противоречие';reason=r.score===1?'Сейчас 100%, но во всех сопоставленных строках проверяемый факт = 0':'Сейчас 0%, но в источнике найден факт ≥1';}
 else{status='Совпадает';reason=fact===1?'Факт ≥1 найден':'Сопоставленные строки есть, проверяемый факт = 0';}
 return{...r,auditId:`C${String(i+1).padStart(3,'0')}`,sourcePeriod:month,requestedPeriod:success?'Апрель 2026':q3Confirmed?'III квартал 2026 (по сентябрь)':'Сентябрь 2026',status,reason,fact,...sums,
 sourceRows:matched.map(s=>s.row),sourceNames:[...new Set(matched.map(s=>s.product_name))],
 evidence:matched.map(s=>`${s.product_name}: ${fields.map(k=>`${k}=${s[k]}`).join(', ')} (стр. ${s.row})`).join('\n')};
});
assert.equal(audits.length,228);assert.equal(audits.filter(r=>r.included).length,141);
assert.equal(new Set(source.map(s=>`${s.quarter_start}|${s.product_name}`)).size,source.length);
fs.writeFileSync(path.join(dir,'audit.json'),JSON.stringify({sourceMail:'https://mail.google.com/mail/u/?authuser=schischko.r%40gmail.com#all/1a1a05a190a67036',
 sourceFile:'Кампейнинг.xlsx',sourceSheet:'Лист1',q3Confirmed,quarterStartNote:'В источнике 01.04 и 01.07 — quarter_start. Сентябрьских дат нет. 01.07 используется как квартальный итог III квартала только после подтверждения пользователя.',
 mappings,audits,source},null,2));
console.log(JSON.stringify({teams:mappings.length,statuses:Object.fromEntries([...new Set(audits.map(r=>r.status))].map(s=>[s,audits.filter(r=>r.status===s).length])),
 aprilConflicts:audits.filter(r=>r.included&&r.sourcePeriod==='2026-04'&&r.status==='Противоречие').map(r=>({team:r.team,score:r.score,fact:r.fact}))},null,2));
