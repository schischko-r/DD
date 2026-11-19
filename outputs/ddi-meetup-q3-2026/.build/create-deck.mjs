import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = '/Users/roman/Documents/Codex/DD-dev';
const skillDir = '/Users/roman/.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/Presentations';
const templatePath = '/tmp/meetup_2026-07-12.pptx';
const buildDir = `${workspaceDir}/outputs/ddi-meetup-q3-2026/.build`;
const finalPath = `${workspaceDir}/outputs/ddi-meetup-q3-2026/final/DDI_митап_сравнение_II_III_кварталы_2026_v7.pptx`;
const referenceHash = 'b912a03ac5799b97b1e237662796beda2a0c0d5452a58eec97e82de1af870f63';

const C = {
  ink: '#0F1E22', muted: '#65747A', faint: '#8C979B', line: '#DCE4E7', white: '#FFFFFF',
  blue: '#2A9FDB', blueDark: '#117CB4', bluePale: '#E7F5FC', mint: '#54C6AA', mintPale: '#E7F7F2',
  lilac: '#9BAAF4', lilacPale: '#EEF0FF', orange: '#F5A24E', orangePale: '#FFF2E4',
  pink: '#E57BBE', pinkPale: '#FBEAF4', red: '#D9576F', redPale: '#FCE9ED',
  green: '#36A976', greenPale: '#E5F5EC', gray: '#92999B', grayPale: '#F1F3F3',
};
const FONT = 'SB Sans Display';
const FONT_BOLD = 'SB Sans Display Semibold';
const noLine = { style: 'solid', fill: 'none', width: 0 };
const thinLine = (fill = C.line, width = 1) => ({ style: 'solid', fill, width });

function addShape(slide, name, x, y, w, h, opts = {}) {
  return slide.shapes.add({
    geometry: opts.geometry || 'rect', name,
    position: { left: x, top: y, width: w, height: h, ...(opts.rotation ? {rotation: opts.rotation} : {}) },
    fill: opts.fill ?? 'none', line: opts.line ?? noLine,
    ...(opts.radius ? { borderRadius: opts.radius } : {}),
    ...(opts.shadow ? { shadow: opts.shadow } : {}),
  });
}
function addText(slide, name, text, x, y, w, h, opts = {}) {
  const s = addShape(slide, name, x, y, w, h, { geometry: 'textbox', fill: 'none', line: noLine });
  s.text = text;
  s.text.style = {
    typeface: opts.typeface || FONT,
    fontSize: opts.size ?? 20,
    bold: Boolean(opts.bold),
    color: opts.color || C.ink,
    alignment: opts.align || 'left',
    verticalAlignment: opts.valign || 'middle',
    wrap: opts.wrap || 'square',
    autoFit: 'shrinkText',
    insets: 0,
    ...(opts.lineSpacing ? {lineSpacing: opts.lineSpacing} : {}),
  };
  return s;
}
function card(slide, name, x, y, w, h, fill = C.white) {
  return addShape(slide, name, x, y, w, h, { geometry: 'roundRect', fill, line: thinLine(C.line, 1), radius: 14 });
}
function header(slide, title, subtitle = '') {
  addText(slide, 'slide-title', title, 42, 34, 1170, 66, { size: 48, bold: true, typeface: FONT_BOLD });
  if (subtitle) addText(slide, 'slide-subtitle', subtitle, 45, 101, 1170, 36, { size: 20, color: C.muted });
}
function badge(slide, name, value, x, y, w = 92, fill = C.greenPale, color = C.green) {
  addShape(slide, `${name}-bg`, x, y, w, 30, { geometry: 'roundRect', fill, line: noLine, radius: 8 });
  addText(slide, `${name}-text`, value, x + 4, y, w - 8, 30, { size: 17, bold: true, color, align: 'center' });
}
function line(slide, name, x, y, w) {
  addShape(slide, name, x, y, w, 1, { fill: C.line, line: noLine });
}

const p = await PresentationFile.importPptx(await FileBlob.load(templatePath));
const cover = p.slides.items[0];
const contentLayout = p.slides.items[7].layout.id;
const slideSizeEmu = '12192000,6858000';
p.slides.keep([0]);

// The title slide stays untouched from the supplied meetup deck. The profile spider is its own slide.
const sProfile = p.slides.add({ layoutId: contentLayout });
header(sProfile, 'Профиль Data-Driven Index', 'II → III квартал 2026 · средний индекс 53% → 63% · +10 п.п.');
card(sProfile, 'profile-chart-card', 42, 158, 1195, 492, C.white);
const radarCenter = { x: 600, y: 388 };
const radarRadius = 145;
const radarPoints = (values) => values.map((value, i) => {
  const angle = -Math.PI / 2 + 2 * Math.PI * i / 8;
  const radius = radarRadius * value / 100;
  return { x: radarCenter.x + Math.cos(angle) * radius, y: radarCenter.y + Math.sin(angle) * radius };
});
const polygonPath = (pts) => [{ moveTo: { x: pts[0].x, y: pts[0].y } }, ...pts.slice(1).map(pt => ({ lineTo: { x: pt.x, y: pt.y } })), { close: {} }];
for (let ring = 1; ring <= 5; ring += 1) {
  const pts = radarPoints(Array(8).fill(ring * 20));
  sProfile.shapes.add({ geometry: 'custom', name: `profile-grid-${ring}`, position: { left: radarCenter.x - radarRadius, top: radarCenter.y - radarRadius, width: radarRadius * 2, height: radarRadius * 2 }, fill: 'none', line: thinLine('#D9E1E5', 1), customPaths: [{ width: radarRadius * 2, height: radarRadius * 2, commands: polygonPath(pts.map(pt => ({ x: pt.x - radarCenter.x + radarRadius, y: pt.y - radarCenter.y + radarRadius }))) }] });
}
for (let i = 0; i < 8; i += 1) {
  const end = radarPoints(Array.from({ length: 8 }, (_, index) => index === i ? 100 : 0))[i];
  const left = Math.min(radarCenter.x, end.x); const top = Math.min(radarCenter.y, end.y);
  const width = Math.max(1, Math.abs(end.x - radarCenter.x)); const height = Math.max(1, Math.abs(end.y - radarCenter.y));
  sProfile.shapes.add({ geometry: 'custom', name: `profile-axis-${i}`, position: { left, top, width, height }, fill: 'none', line: thinLine('#D9E1E5', 1), customPaths: [{ width, height, commands: [{ moveTo: { x: radarCenter.x - left, y: radarCenter.y - top } }, { lineTo: { x: end.x - left, y: end.y - top } }] }] });
}
const q2Radar = radarPoints([72, 44, 59, 51, 53, 49, 35, 69]);
const q3Radar = radarPoints([75, 81, 59, 54, 69, 63, 46, 60]);
for (const [name, pts, stroke, fill] of [['q2', q2Radar, C.gray, '#92999B/20'], ['q3', q3Radar, C.blue, '#2A9FDB/20']]) {
  sProfile.shapes.add({ geometry: 'custom', name: `profile-${name}-polygon`, position: { left: radarCenter.x - radarRadius, top: radarCenter.y - radarRadius, width: radarRadius * 2, height: radarRadius * 2 }, fill, line: { style: 'solid', fill: stroke, width: name === 'q3' ? 3 : 2 }, customPaths: [{ width: radarRadius * 2, height: radarRadius * 2, commands: polygonPath(pts.map(pt => ({ x: pt.x - radarCenter.x + radarRadius, y: pt.y - radarCenter.y + radarRadius }))) }] });
  pts.forEach((pt, i) => addShape(sProfile, `profile-${name}-point-${i}`, pt.x - 3, pt.y - 3, 6, 6, { geometry: 'ellipse', fill: stroke, line: { style: 'solid', fill: C.white, width: 1 } }));
}
const radarLabels = [
  ['Метрики', 550, 211, 100, 'center'], ['Цели', 735, 238, 90, 'left'], ['Привлечение', 753, 375, 122, 'left'], ['Отток', 735, 500, 90, 'left'],
  ['Алерты', 550, 540, 100, 'center'], ['Механики', 375, 500, 112, 'right'], ['Гипотезы', 325, 375, 112, 'right'], ['CX', 385, 238, 75, 'right'],
];
radarLabels.forEach(([label, x, y, w, align], i) => addText(sProfile, `profile-label-${i}`, label, x, y, w, 22, { size: 14, color: C.muted, align }));
addShape(sProfile, 'profile-legend-q2-swatch', 500, 577, 12, 12, { geometry: 'rect', fill: C.gray, line: noLine });
addText(sProfile, 'profile-legend-q2', 'II кв. 2026', 518, 571, 105, 24, { size: 14, color: C.muted });
addShape(sProfile, 'profile-legend-q3-swatch', 650, 577, 12, 12, { geometry: 'rect', fill: C.blue, line: noLine });
addText(sProfile, 'profile-legend-q3', 'III кв. 2026', 668, 571, 110, 24, { size: 14, color: C.blueDark });
card(sProfile, 'profile-summary-card', 900, 277, 286, 218, '#F5F8FF');
addText(sProfile, 'profile-summary-label', 'СРЕДНИЙ РЕЗУЛЬТАТ', 925, 302, 235, 28, { size: 14, bold: true, color: C.muted });
addText(sProfile, 'profile-summary-value', '53% → 63%', 925, 345, 235, 52, { size: 34, bold: true, typeface: FONT_BOLD });
badge(sProfile, 'profile-summary-delta', '+10 п.п.', 925, 411, 124, C.greenPale, C.green);
addText(sProfile, 'profile-summary-cohort', 'Q2 — 83 команды по серверу\nQ3 — 76 команд', 925, 451, 240, 38, { size: 14, color: C.muted });
addText(sProfile, 'profile-foot', 'Состав и охват когорты изменились; сравнение средних приведено по серверным итогам.', 44, 665, 1185, 24, { size: 13, color: C.faint });

// Slide 2: block dynamics.
const s2 = p.slides.add({ layoutId: contentLayout });
header(s2, 'Динамика ключевых блоков DDI', 'Сильнейший прирост — в блоке целей; снижение — в клиентском опыте');
card(s2, 'block-trend-table', 42, 164, 835, 492);
addText(s2, 'block-col-title', 'БЛОК', 68, 179, 385, 30, { size: 14, bold: true, color: C.faint });
addText(s2, 'q2-col-title', 'II КВ.', 488, 179, 100, 30, { size: 14, bold: true, color: C.faint, align: 'center' });
addText(s2, 'q3-col-title', 'III КВ.', 612, 179, 100, 30, { size: 14, bold: true, color: C.faint, align: 'center' });
addText(s2, 'delta-col-title', 'ДЕЛЬТА', 744, 179, 100, 30, { size: 14, bold: true, color: C.faint, align: 'center' });
const trends = [
  ['Цели / ФА / прогнозы', 44, 81, 37, C.blue],
  ['Алерты', 53, 69, 16, C.mint],
  ['Механики', 49, 63, 14, C.orange],
  ['Гипотезы и инициативы', 35, 46, 11, C.pink],
  ['Знание ключевых метрик', 72, 75, 3, C.lilac],
  ['Клиентский опыт', 69, 60, -9, C.red],
];
trends.forEach(([label, q2, q3, delta, accent], i) => {
  const y = 219 + i * 69;
  if (i > 0) line(s2, `trend-rule-${i}`, 66, y - 4, 786);
  addShape(s2, `trend-dot-${i}`, 69, y + 17, 9, 9, { geometry: 'ellipse', fill: accent, line: noLine });
  addText(s2, `trend-label-${i}`, label, 91, y + 3, 372, 40, { size: 20, bold: true });
  addText(s2, `trend-q2-${i}`, `${q2}%`, 486, y + 2, 100, 42, { size: 24, bold: true, align: 'center', color: C.muted });
  addText(s2, `trend-q3-${i}`, `${q3}%`, 612, y + 2, 100, 42, { size: 24, bold: true, align: 'center', color: C.ink });
  const pos = delta >= 0;
  badge(s2, `trend-delta-${i}`, `${pos ? '+' : '−'}${Math.abs(delta)} п.п.`, 744, y + 8, 98, pos ? C.greenPale : C.redPale, pos ? C.green : C.red);
});
card(s2, 'overall-result-card', 902, 164, 335, 492, '#F5F8FF');
addText(s2, 'overall-kicker', 'СРЕДНИЙ РЕЗУЛЬТАТ', 933, 199, 268, 32, { size: 14, bold: true, color: C.muted });
addText(s2, 'overall-from', '53%', 936, 260, 108, 70, { size: 49, bold: true, color: C.gray, typeface: FONT_BOLD });
addText(s2, 'overall-arrow', '→', 1043, 264, 58, 60, { size: 38, color: C.blue, align: 'center' });
addText(s2, 'overall-to', '63%', 1096, 260, 115, 70, { size: 49, bold: true, color: C.blueDark, typeface: FONT_BOLD });
badge(s2, 'overall-delta', '+10 п.п.', 941, 358, 125, C.greenPale, C.green);
addText(s2, 'overall-description', 'Рост индекса за квартал', 941, 403, 250, 34, { size: 19, bold: true });
line(s2, 'overall-rule', 941, 448, 247);
addText(s2, 'only-decline-label', 'Единственный блок со снижением', 941, 467, 250, 52, { size: 16, color: C.muted });
addText(s2, 'only-decline', 'Клиентский опыт  −9 п.п.', 941, 518, 255, 40, { size: 19, bold: true, color: C.red });
addText(s2, 'overall-foot', 'Внутренние дельты блоков рассчитаны по средним оценкам DDI; общий итог Q2 взят из материалов митапа.', 942, 581, 254, 57, { size: 13, color: C.faint });
addText(s2, 'slide2-source', 'Примечание: Q2 — 83 команды, средний индекс 53% по серверу; Q3 — 76 команд. Состав когорты изменился.', 44, 672, 1185, 24, { size: 13, color: C.faint });

// Slide 3: unit results.
const s3 = p.slides.add({ layoutId: contentLayout });
header(s3, 'Результаты по юнитам', 'III квартал · средний DDI по командам юнита');
card(s3, 'unit-chart-card', 42, 164, 804, 492);
addText(s3, 'unit-chart-title', 'СРЕДНИЙ ИНДЕКС', 70, 181, 340, 28, { size: 14, bold: true, color: C.faint });
const units = [
  ['PC', 83, 4], ['ДомКлик', 77, 4], ['УБ', 67, 20], ['DP', 67, 4], ['CX', 63, 11], ['Data', 62, 4], ['DB', 57, 16], ['CBP', 54, 13],
];
units.forEach(([name, score, n], i) => {
  const y = 225 + i * 50;
  addText(s3, `unit-name-${i}`, name, 71, y, 130, 28, { size: 19, bold: true });
  addText(s3, `unit-n-${i}`, `n=${n}`, 71, y + 23, 115, 20, { size: 13, color: C.faint });
  addShape(s3, `unit-bar-bg-${i}`, 208, y + 5, 530, 19, { geometry: 'roundRect', fill: '#E9EEF0', line: noLine, radius: 9 });
  addShape(s3, `unit-bar-${i}`, 208, y + 5, 530 * score / 100, 19, { geometry: 'roundRect', fill: i < 2 ? C.blue : (i > 5 ? C.lilac : C.mint), line: noLine, radius: 9 });
  addText(s3, `unit-score-${i}`, `${score}%`, 750, y - 1, 70, 30, { size: 21, bold: true, align: 'right', color: i < 2 ? C.blueDark : C.ink });
});
card(s3, 'unit-insights-card', 871, 164, 366, 492, '#F5F8FF');
addText(s3, 'unit-insights-title', 'Что выделяется', 902, 188, 300, 36, { size: 25, bold: true, typeface: FONT_BOLD });
addShape(s3, 'unit-insight-1-accent', 902, 249, 5, 88, { fill: C.blue, line: noLine });
addText(s3, 'unit-insight-1-title', 'Высокий результат', 921, 246, 264, 30, { size: 17, bold: true, color: C.blueDark });
addText(s3, 'unit-insight-1-body', 'PC — 83%, ДомКлик — 77%. PC сохраняет лидерство; ДомКлик — второй по среднему индексу.', 921, 278, 274, 65, { size: 17 });
line(s3, 'unit-insight-rule-1', 902, 363, 300);
addShape(s3, 'unit-insight-2-accent', 902, 389, 5, 88, { fill: C.orange, line: noLine });
addText(s3, 'unit-insight-2-title', 'Ниже среднего', 921, 386, 264, 30, { size: 17, bold: true, color: '#BD711B' });
addText(s3, 'unit-insight-2-body', 'CBP — 54%, DB — 57%. Гипотезы и инициативы — частый пробел в УБ, CBP, DB и Data.', 921, 418, 274, 68, { size: 17 });
line(s3, 'unit-insight-rule-2', 902, 503, 300);
addText(s3, 'unit-insight-3', 'Охват Q3: 76 команд в 8 юнитах. Малые выборки (n=4) читать с осторожностью.', 902, 523, 300, 82, { size: 15, color: C.muted });
addText(s3, 'slide3-source', 'Источник: профили DDI за III квартал; средние рассчитаны по командам внутри юнита.', 44, 672, 1185, 24, { size: 13, color: C.faint });

// Slide 4: maturity distribution.
const s4 = p.slides.add({ layoutId: contentLayout });
header(s4, 'Команды по уровню зрелости', 'Средний результат: 53% во II квартале → 63% в III квартале · +10 п.п.');
card(s4, 'maturity-table-card', 42, 164, 1195, 432);
const cols = [
  { x: 67, w: 170, title: 'ОЦЕНКА' }, { x: 237, w: 220, title: 'ГРУППА' },
  { x: 457, w: 400, title: 'СУТЬ' }, { x: 857, w: 115, title: 'II КВ.' },
  { x: 972, w: 115, title: 'III КВ.' }, { x: 1087, w: 120, title: 'ДЕЛЬТА' },
];
cols.forEach((c, i) => addText(s4, `maturity-head-${i}`, c.title, c.x, 182, c.w, 30, { size: 14, bold: true, color: C.faint, align: i >= 3 ? 'center' : 'left' }));
const maturity = [
  ['81–100%', 'Лидеры Data Driven', 'Продукт — образец для экосистемы', 2, 6, 4, C.mint],
  ['61–80%', 'Зрелые', 'Устойчивая база, есть точечные пробелы', 19, 42, 23, C.blue],
  ['40–60%', 'Развивающиеся', 'База закладывается, много слепых зон', 44, 25, -19, C.orange],
  ['<40%', 'Требуют внимания', 'Data-Driven фундамент отсутствует', 18, 3, -15, C.red],
];
maturity.forEach(([range, group, meaning, q2, q3, delta, accent], i) => {
  const y = 231 + i * 79;
  if (i > 0) line(s4, `maturity-rule-${i}`, 67, y - 8, 1138);
  addText(s4, `maturity-range-${i}`, range, 67, y, 155, 40, { size: 19, color: C.muted });
  addText(s4, `maturity-group-${i}`, group, 237, y, 210, 44, { size: 19, bold: true, color: accent });
  addText(s4, `maturity-meaning-${i}`, meaning, 457, y - 1, 385, 48, { size: 17 });
  addText(s4, `maturity-q2-${i}`, String(q2), 857, y, 115, 40, { size: 22, bold: true, align: 'center', color: C.muted });
  addText(s4, `maturity-q3-${i}`, String(q3), 972, y, 115, 40, { size: 22, bold: true, align: 'center' });
  const positive = delta >= 0;
  badge(s4, `maturity-delta-${i}`, `${positive ? '+' : '−'}${Math.abs(delta)}`, 1097, y + 5, 84, positive ? C.greenPale : C.redPale, positive ? C.green : C.red);
});
addText(s4, 'maturity-total-label', 'Команд в выборке', 67, 562, 360, 28, { size: 17, bold: true });
addText(s4, 'maturity-q2-total', '83', 857, 562, 115, 28, { size: 18, bold: true, align: 'center' });
addText(s4, 'maturity-q3-total', '76', 972, 562, 115, 28, { size: 18, bold: true, align: 'center' });
addText(s4, 'slide4-foot', 'Q2: 83 команды, средний индекс 53% по серверу; Q3: 76 команд по текущим профилям DDI. Состав когорты изменился.', 44, 625, 1185, 50, { size: 14, color: C.faint });

// Slide 5: Q3 weak zones in Observe / Investigate / Act.
const s5 = p.slides.add({ layoutId: contentLayout });
header(s5, 'Системно слабые зоны · III квартал', 'Низкое покрытие сохраняется в аналитике оттока, исследованиях и бизнес-алертах');
const phases = [
  { x: 42, title: '01 / НАБЛЮДАЙ', subtitle: 'Проверяй, что происходит', color: C.blue, pale: C.bluePale,
    rows: [['Оповещения по бизнес-метрикам', '34 из 75 команд', 45], ['Фактор и прогноз уровня ЛЮ/ЛТ на 100%', '50 из 67 команд', 75], ['Регулярность воронки привлечения', '47 из 58 команд', 81]] },
  { x: 445, title: '02 / ИССЛЕДУЙ', subtitle: 'Найди причину потерь', color: '#747FE3', pale: C.lilacPale,
    rows: [['Комплексный анализ воронки оттока', '12 из 66 команд', 18], ['Исследования с оценкой ≥7,5', '28 из 76 команд', 37], ['Discovery ≥40% бэклога', '22 из 76 команд', 29]] },
  { x: 848, title: '03 / ДЕЙСТВУЙ', subtitle: 'Меняй ситуацию', color: C.mint, pale: C.mintPale,
    rows: [['Черновики в СБОЛ покрывают >70%', '9 из 35 применимых команд', 26], ['Успешные бизнес-запуски', '13 из 47 применимых команд', 28], ['Есть механика Cross-sell', '35 из 58 применимых команд', 60]] },
];
phases.forEach((phase, pi) => {
  card(s5, `phase-card-${pi}`, phase.x, 164, 390, 478);
  addShape(s5, `phase-head-${pi}`, phase.x + 14, 180, 362, 72, { geometry: 'roundRect', fill: phase.pale, line: noLine, radius: 10 });
  addText(s5, `phase-title-${pi}`, phase.title, phase.x + 30, 186, 320, 30, { size: 19, bold: true, color: phase.color });
  addText(s5, `phase-subtitle-${pi}`, phase.subtitle, phase.x + 30, 217, 320, 24, { size: 14, color: C.muted });
  phase.rows.forEach(([label, den, score], ri) => {
    const y = 274 + ri * 115;
    if (ri > 0) line(s5, `phase-${pi}-rule-${ri}`, phase.x + 24, y - 10, 342);
    addText(s5, `phase-${pi}-metric-${ri}`, label, phase.x + 28, y, 252, 46, { size: 17, bold: true });
    addText(s5, `phase-${pi}-rate-${ri}`, `${score}%`, phase.x + 287, y - 5, 68, 40, { size: 27, bold: true, align: 'right', color: score < 30 ? C.red : (score < 50 ? '#C27B22' : C.green), typeface: FONT_BOLD });
    addText(s5, `phase-${pi}-den-${ri}`, den, phase.x + 28, y + 51, 327, 25, { size: 13, color: C.faint });
    addShape(s5, `phase-${pi}-bg-${ri}`, phase.x + 28, y + 82, 326, 9, { geometry: 'roundRect', fill: '#E9EEF0', line: noLine, radius: 5 });
    addShape(s5, `phase-${pi}-bar-${ri}`, phase.x + 28, y + 82, 326 * score / 100, 9, { geometry: 'roundRect', fill: phase.color, line: noLine, radius: 5 });
  });
});
addText(s5, 'slide5-foot', 'Число в скобках — команды, для которых критерий применим; процент — полное выполнение критерия. Цели: есть ненулевой результат и по фактору, и по прогнозу.', 44, 655, 1188, 41, { size: 13, color: C.faint });

// Slide 6: Q2 baseline vs Q3 delta, matching the three-phase visual.
const s6 = p.slides.add({ layoutId: contentLayout });
header(s6, 'Системно слабые зоны: II → III квартал', 'Сопоставление показателей, показанных в Q2; положительная дельта означает рост покрытия');
const deltas = [
  { x: 42, title: '01 / НАБЛЮДАЙ', subtitle: 'Мониторинг сигналов', color: C.blue, pale: C.bluePale,
    rows: [['Оповещения по бизнес-метрикам', 17, 45, 28], ['Фактор и прогноз уровня ЛЮ/ЛТ на 100%', 27, 75, 48], ['Регулярность воронки привлечения', 50, 81, 31]] },
  { x: 445, title: '02 / ИССЛЕДУЙ', subtitle: 'Анализ и гипотезы', color: '#747FE3', pale: C.lilacPale,
    rows: [['Комплексный анализ оттока', 17, 18, 1], ['Исследования / аналитика', 23, 37, 14], ['Выполнение плана A/B-тестов', 37, 84, 47]] },
  { x: 848, title: '03 / ДЕЙСТВУЙ', subtitle: 'Изменения в продукте', color: C.mint, pale: C.mintPale,
    rows: [['Черновики покрывают >70%', 15, 26, 11], ['Успешные бизнес-запуски', 16, 28, 12], ['Cross-sell механика', 30, 60, 30]] },
];
deltas.forEach((phase, pi) => {
  card(s6, `delta-phase-card-${pi}`, phase.x, 164, 390, 478);
  addShape(s6, `delta-phase-head-${pi}`, phase.x + 14, 180, 362, 72, { geometry: 'roundRect', fill: phase.pale, line: noLine, radius: 10 });
  addText(s6, `delta-phase-title-${pi}`, phase.title, phase.x + 30, 186, 320, 30, { size: 19, bold: true, color: phase.color });
  addText(s6, `delta-phase-subtitle-${pi}`, phase.subtitle, phase.x + 30, 217, 320, 24, { size: 14, color: C.muted });
  phase.rows.forEach(([label, q2, q3, delta], ri) => {
    const y = 274 + ri * 115;
    if (ri > 0) line(s6, `delta-${pi}-rule-${ri}`, phase.x + 24, y - 10, 342);
    addText(s6, `delta-${pi}-metric-${ri}`, label, phase.x + 28, y, 326, 42, { size: 16, bold: true });
    addText(s6, `delta-${pi}-q2-${ri}`, `${q2}%`, phase.x + 30, y + 46, 72, 34, { size: 22, bold: true, color: C.muted });
    addText(s6, `delta-${pi}-arrow-${ri}`, '→', phase.x + 105, y + 45, 30, 35, { size: 21, color: C.faint, align: 'center' });
    addText(s6, `delta-${pi}-q3-${ri}`, `${q3}%`, phase.x + 142, y + 46, 76, 34, { size: 22, bold: true, color: C.ink });
    badge(s6, `delta-${pi}-badge-${ri}`, `+${delta} п.п.`, phase.x + 235, y + 48, 112, C.greenPale, C.green);
    addShape(s6, `delta-${pi}-bg-${ri}`, phase.x + 28, y + 88, 326, 8, { geometry: 'roundRect', fill: '#E9EEF0', line: noLine, radius: 5 });
    addShape(s6, `delta-${pi}-bar-${ri}`, phase.x + 28, y + 88, 326 * q3 / 100, 8, { geometry: 'roundRect', fill: phase.color, line: noLine, radius: 5 });
  });
});
addText(s6, 'slide6-foot', 'Q2: значения с исходного слайда о системно слабых зонах. Q3: действующие профили DDI; знаменатель — только применимые команды. Рост покрытия трактуйте с учётом изменившейся когорты.', 44, 655, 1188, 41, { size: 13, color: C.faint });

// Render every slide for visual QA, then export a draft and run the standard finalizer.
await fs.mkdir(buildDir, { recursive: true });
for (const [index, slide] of p.slides.items.entries()) {
  const blob = await p.export({ slide, format: 'png', scale: 1 });
  await fs.writeFile(path.join(buildDir, `slide-${String(index + 1).padStart(2, '0')}.png`), new Uint8Array(await blob.arrayBuffer()));
}
const candidatePath = path.join(buildDir, 'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidatePath);
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
const runtimePython = '/usr/bin/python3';
const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', slideSizeEmu, '--validate-bullet-geometry', '--validate-heading-fit'],
  requiredNativeChartOwnerSlides: [],
  explicitTotalSlideCount: 7,
  sourceTemplatePath: templatePath,
  requiredTemplateReferenceSlides: [1, 8],
  minimumTemplateCoverageRatio: 0.15,
  fontPolicy: { basis: 'reference', families: [FONT, FONT_BOLD], referencePath: templatePath, referenceSha256: referenceHash },
  verifyArtifactToolImport: true,
  receiptPath: path.join(buildDir, 'validation-v7.json'),
});
console.log(JSON.stringify({ finalPath, result }, null, 2));
