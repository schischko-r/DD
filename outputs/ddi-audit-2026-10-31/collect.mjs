import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {buildSummaryPeriodData} from '../../gravity-app/src/domain/summaryPeriod.js';
import {completeProductPercent, isDdIndexMetricForPeriod} from '../../gravity-app/src/domain/report.js';
import {getSections, sections} from '../../gravity-app/src/deposits-survey/questions.js';
import {productSurveyProfiles} from '../../gravity-app/src/deposits-survey/survey-profiles.js';
import {callCenterSections} from '../../gravity-app/src/deposits-survey/call-center.js';
import {cleanCommentRows} from './clean-comments.mjs';

const dir = new URL('./', import.meta.url), root = new URL('../../', dir);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const source = read('gravity-app/public/report-data.json');
const app = fs.readFileSync(new URL('gravity-app/src/app/App.jsx', root), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map(m => [m[1], m[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map(s => read(`gravity-app/src/data/${imports.get(s.trim())}`));
const salary = read('gravity-app/src/data/salary-products-q3-2026.json');
const reporting = read('gravity-app/src/data/reporting-regularity-missing-q3-2026.json');
const actions = read('gravity-app/src/data/funnel-action-missing-q3-2026.json');
const q2 = buildDdiPeriodProducts(source.products, 'II кв. 2026', overlays, salary, reporting, actions);
const q3 = buildDdiPeriodProducts(source.products, 'III кв. 2026', overlays, salary, reporting, actions);
const oldRows = buildSummaryPeriodData(source.products, source.title.rows, q2, 'II кв. 2026').rows;
const responseData = JSON.parse(fs.readFileSync(new URL('responses-lossless.json', dir), 'utf8'));
const responses = responseData.responses.filter(r => !r.excludedByConfirmedUserInstruction);
const canonicalId = p => p.id.split('::empty::')[0];
const norm = x => String(x ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
const unique = a => [...new Set(a.filter(x => x !== null && x !== undefined && String(x).trim()))];
const text = x => x === null || x === undefined ? '' : Array.isArray(x) ? x.map(text).join('; ') : typeof x === 'object' ? JSON.stringify(x) : String(x);
const ratio = m => m?.is_applicabble_flg !== false && Number(m?.max_value) > 0 && Number.isFinite(m?.value) ? m.value / m.max_value : null;
const flatten = p => p.metrics.flatMap(b => b.metrics.map(m => ({...m, blockCode: b.code, blockName: b.name})));
const questionsCache = new Map();
function questionsFor(id) {
  if (questionsCache.has(id)) return questionsCache.get(id);
  const catalog = productSurveyProfiles[id] ? getSections({product: id}) : id.endsWith('¦Колл-центр') ? callCenterSections : [];
  const qs = new Map();
  function visit(q, parent) {
    qs.set(q.id, {...q, parentId: parent?.id});
    for (const c of [...q.inlineQuestions || [], ...[q.inlineEvidence, q.inlineProof, q.benchmark, q.action].filter(Boolean)]) visit(c, q);
  }
  for (const s of catalog) for (const q of s.questions || []) visit(q);
  questionsCache.set(id, qs); return qs;
}
const genericQuestions = new Map();
for (const s of [...getSections({}), ...sections, ...callCenterSections]) for (const q of s.questions || []) {
  genericQuestions.set(q.id, q);
  for (const c of [...q.inlineQuestions || [], ...[q.inlineProof, q.inlineEvidence, q.benchmark, q.action].filter(Boolean)]) genericQuestions.set(c.id, c);
}
function visitSource(value, callback) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {value.forEach(x => visitSource(x, callback)); return;}
  callback(value);
  for (const v of Object.values(value)) if (v && typeof v === 'object') visitSource(v, callback);
}
const knowledge = {
  'general.obъem_celevogo_rynka_v_rossii': ['marketRussia'], 'general.obъem_celevogo_rynka_v_sbere': ['marketSber'],
  'general.klienty_s_produktom': ['clients'], 'general.mau_produkta': ['mau'], 'general.dau_produkta': ['dau'],
  'general.yau_produkta': ['yau'], 'general.dau_mau': ['dauMau', 'channelDauMau'], 'general.znanie_produktov_sputnikov': ['satellite'],
  'general.aktivnaya_klientskaya_baza': ['activeClientsKnowledge', 'activeClients'],
  'general.kol_vo_major_klientov': ['majorClientsKnowledge', 'majorClients'],
  'general.kol_vo_klientov_s_2_nefin_servisov': ['nonFinancialClientsKnowledge', 'nonFinancialClients'],
  'general.sredniy_dohoda_na_klienta': ['clientIncomeKnowledge', 'clientIncome'],
  'general.kol_vo_poluchateley_zp': ['salaryClientsKnowledge', 'salaryClients'],
  'general.dolya_rynka_fot': ['payrollShareKnowledge', 'payrollShare'], 'general.obъem_zachisleniy_fot': ['payrollVolumeKnowledge', 'payrollVolume'],
  'general.navigator_reporting_knowledge': ['monitoring', 'ccMonitoring'], 'general.kolichestvo_obrascheniy': ['ccCalls'],
  'general.fcr': ['ccFcr'], 'general.mau_u_vashego_kanala': ['channelMau'], 'general.dau_kanala': ['channelDau'],
  'general.dop_npv_mlrd_rub': ['campaignNpv'], 'general.cltv_mlrd_rub': ['campaignCltv'],
  'general.or': ['campaignOr'], 'general.ctr': ['campaignCtr'], 'general.cr_kampeyninga': ['campaignCr'],
};
const directQuestions = {
  'alerts.business_metrics': ['alerts'], 'alerts.system_failures': ['systemAlerts'],
  'alerts.opovescheniya_po_problemam_svyazannym_s_ux_ui': ['uxAlerts'],
  'alerts.nastroena_matrica_otkloneniy': ['campaignDeviationMatrix'], 'alerts.nastroeny_avtoalerty_po_otkloneniyam': ['campaignAutomaticAlerts'],
  'hyp.discovery_40_backlog': ['discovery', 'backlog'], 'mehaniki.cross_sell.after': ['crossSellAfter'],
  'dannye.promyshlenye_dannye': ['industrialData'], 'dannye.kontrolь_kachestva_dannyh_kkd': ['qualityTools'],
  'mehaniki.monitoring_mehanik': ['mechanicsMonitoring'],
};
function candidateIds(m, rs) {
  const ids = [...knowledge[m.code] || [], ...directQuestions[m.code] || []];
  for (const r of rs) for (const item of r.metrics || []) if (item.code === m.code && item.questionId) ids.push(item.questionId);
  visitSource(m.source, s => {if (s.questionId) ids.push(s.questionId);});
  const prefix = {attract: 'attract', churn: 'churn', voronka_onbordinga: 'onboarding', voronka_ispolьzovaniya: 'usage', voronka_vhoda_v_kanal: 'entry', voronka_prodazh: 'sales', analiz_effektivnostь: 'campaign'}[m.blockCode];
  if (prefix) {
    if (/nastroena_otchetnost|regulyarnost/.test(m.code)) ids.push(`${prefix}Configured`);
    if (/report_completeness|polnota_otcheta/.test(m.code)) ids.push(`${prefix}Includes`);
    if (/funnel_analysis|provedenie_/.test(m.code)) ids.push(`${prefix}Analysis`);
    if (/benchmarks/.test(m.code)) ids.push(prefix === 'attract' ? 'benchmarksAttract' : prefix === 'churn' ? 'benchmarksChurn' : `${prefix}Benchmarks`);
    if (/initiatives_list|deviation_actions|meropriyatiya/.test(m.code)) ids.push(`${prefix}Deviations`, ...(prefix === 'churn' ? ['deviations'] : []));
    if (m.blockCode === 'attract' && rs.some(r => r.answers.usageConfigured !== undefined)) {
      for (const id of [...ids]) if (id.startsWith('attract')) ids.push(id.replace(/^attract/, 'usage'));
    }
  }
  if (m.code.startsWith('mehaniki.') && !m.code.startsWith('mehaniki.cross_sell.')) {
    ids.push(`otherMechanic${m.code.split('.')[1]}`, 'otherMechanics', 'mechanics');
    if (['mehaniki.uderzhanie_klientov', 'mehaniki.vozvrat_klientov', 'mehaniki.doprodazhi_up_sell'].includes(m.code)) ids.push('upsell');
    if (m.code.includes('vozvrat')) ids.push('returnMechanism');
    if (m.code.includes('uderzh')) ids.push('retentionMechanism');
  }
  return unique(ids);
}
function surveyEvidence(p, m) {
  const rs = responses.filter(r => r.canonicalTeam?.id === canonicalId(p));
  const ids = candidateIds(m, rs), titles = [], variants = [], answers = [], comments = [], people = [];
  const coverage = new Set();
  for (const r of rs) {
    const qs = questionsFor(r.team.id), who = `${r.respondent.trim()}${r.canonicalTeam?.cohort ? ` [${r.canonicalTeam.cohort}]` : ''}`;
    const blocks = [], extra = [];
    for (const item of r.metrics || []) if (item.code === m.code && item.evidence
      && !Object.values(r.answers).some(value => norm(text(value)) === norm(text(item.evidence))))
      extra.push(`Подтверждение в результате анкеты: ${text(item.evidence)}`);
    for (const id of ids) {
      const has = Object.hasOwn(r.answers, id);
      let q = qs.get(id);
      // Generic product definitions are not assigned to channel/segment questions.
      if (!q && productSurveyProfiles[r.team.id]) q = genericQuestions.get(id);
      const hist = r.payload.previousAnswers?.knownSubanswers?.[id];
      if (q && (has || qs.has(id))) {
        titles.push(q.title || '');
        if (q.options?.length) variants.push(`${q.title}\n${q.options.map(text).join('\n')}`);
        else if (q.type === 'numeric') variants.push(`${q.title}: числовой ввод`);
        else if (['input', 'text', 'links', 'textarea'].includes(q.type)) variants.push(`${q.title}: свободный ввод`);
      } else if (hist?.question) {
        titles.push(`[Формулировка из предыдущего опроса] ${hist.question}`);
        const opts = unique((hist.sourceCells || []).map(c => c.templateOption));
        if (opts.length) variants.push(`[Варианты из предыдущего опроса] ${opts.join('\n')}`);
      }
      if (has) {
        blocks.push(`${q?.title || hist?.question || id}: ${text(r.answers[id])}`);
        coverage.add(`${r.payloadSha256}|${id}`);
        if (!q && !hist?.question) extra.push(`Для поля ${id} исходный текст вопроса и полный каталог вариантов не сохранены в CSV.`);
      }
      const roots = unique([id, q?.inlineEvidence?.id, q?.inlineProof?.id, q?.commentId, q?.optionalCommentId, q?.reasonId,
        ...(id.endsWith('Configured') || id.endsWith('Includes') || id.endsWith('Analysis') ? [id.replace(/Configured$|Includes$|Analysis$/, 'Report')] : []),
        ...(id.endsWith('Deviations') ? [id.replace(/Deviations$/, 'DeviationExampleReport')] : []),
        ...(id === 'deviations' ? ['deviationExampleReport'] : []),
      ]);
      for (const [key, value] of Object.entries(r.answers)) {
        if (key === id || value === null || value === undefined || value === '') continue;
        if (!roots.some(base => key === base || key.startsWith(base) && /^(Source|Format|Link|Comment|Other|Reason|Correction|Unknown)/.test(key.slice(base.length)))) continue;
        extra.push(`${key}: ${text(value)}`);
        coverage.add(`${r.payloadSha256}|${key}`);
      }
      if (hist && (has || q)) {
        const prior = [...hist.comments || [], ...hist.links || []];
        if (prior.length) extra.push(`Предыдущие пояснения/ссылки (${id}): ${prior.map(text).join('\n')}`);
      }
    }
    if (blocks.length || extra.length) {
      people.push(who);
      if (blocks.length) answers.push(`${who}, ${r.completedAt || ''}\n${unique(blocks).join('\n')}`);
      comments.push(`${who}\n${unique(extra).join('\n')}\nАнкета: ${r.sources.map(s => `${s.file}, строка ${s.csvRow}`).join('; ')}`);
    }
  }
  return {question: unique(titles).join('\n\n'), options: unique(variants).join('\n\n'), answer: unique(answers).join('\n\n'),
    comment: unique(comments).join('\n\n'), respondent: unique(people.length ? people : rs.map(r => `${r.respondent.trim()}${r.canonicalTeam?.cohort ? ` [${r.canonicalTeam.cohort}]` : ''}`)).join('\n'), coverage, responses: rs};
}
const digitalCodes = new Set(['attract.campaign_launches', 'attract.chernoviki_v_sbol_70', 'attract.nalichie_self_service', 'attract.nalichie_uspeshnyh_biznes_zapuskov',
  'hyp.datadriven_rating_7_5', 'hyp.ab_tests', 'cx.score', 'cx.uh_score', 'rezulьtativnostь.cr_vypolneniya', 'rezulьtativnostь.dop_npv_vypolneniya', 'rezulьtativnostь.delьta_cltv_vypolneniya']);
function sourceLabel(m) {
  if (m.code === 'general.navigator_reporting_knowledge') return 'Расчёт по знанию метрик';
  if (m.code === 'hyp.extra_initiatives') return 'Перенос из II квартала';
  if (digitalCodes.has(m.code) || m.code === 'mehaniki.cross_sell.during') return 'Цифровые следы';
  return 'Опрос';
}
function sourceComment(m) {
  const lines = [];
  visitSource(m.source, s => {
    if (s.origin === 'priorQuarterCarryForward' && s.rule?.startsWith('Пара команда–метрика отсутствует в файле; полностью набранная')) {
      lines.push('В прошлом периоде получили макс. балл, не спрашиваем'); return;
    }
    if (s.confirmedBy === 'user' && s.origin) lines.push(`Подтверждённая оценка: ${s.origin}${s.date || s.confirmedAt ? `, ${s.date || s.confirmedAt}` : ''}`);
    if (s.rule || s.reason || s.mappingRule) lines.push(text(s.rule || s.reason || s.mappingRule));
    for (const key of ['file', 'sheet', 'cell', 'sourceFile', 'fromPeriod', 'reportEvidence', 'evidence', 'answer', 'resolution', 'sourceKind'])
      if (s[key] !== undefined && s[key] !== null && typeof s[key] !== 'object') lines.push(`${key}: ${text(s[key])}`);
    for (const [key, value] of Object.entries(s)) if (typeof value === 'string' && /https?:\/\//.test(value) && !lines.some(x => x.includes(value))) lines.push(`${key}: ${value}`);
  });
  if (m.code === 'general.navigator_reporting_knowledge') lines.unshift('Расчётная метрика по знанию MAU и рынка с действующими подтверждёнными правилами DDI. Наличие ссылки на дашборд не является отдельным условием.');
  if (m.code === 'hyp.datadriven_rating_7_5') lines.unshift('Цифровые следы: Excel Саши Базилевича (указано пользователем).');
  if (m.code === 'hyp.ab_tests') lines.unshift('Цифровые следы: Excel Саши Ярмаковича (указано пользователем). Пустая оценка III квартала исключена из расчёта, не является нулём.');
  if (m.code === 'hyp.extra_initiatives') lines.unshift('Учитывается ранее выставленная оценка по указанию пользователя.');
  if (m.is_applicabble_flg === false || !(m.max_value > 0)) lines.unshift('Метрика не применима; в DDI не входит.');
  else if (!isDdIndexMetricForPeriod(m, 'III кв. 2026')) lines.unshift('В расчёт DDI за III квартал не входит.');
  return unique(lines).join('\n');
}
const summaries = [], details = [], qa = {responseCoverage: [], warnings: []};
const goalExtraPath = new URL('goals-discovery.json', dir);
const goalExtra = fs.existsSync(goalExtraPath) ? JSON.parse(fs.readFileSync(goalExtraPath, 'utf8')) : null;
assert.ok(goalExtra, 'Run collect-goals-discovery.mjs first');
for (const p of q3.sort((a, b) => a.unit.localeCompare(b.unit, 'ru') || a.name.localeCompare(b.name, 'ru'))) {
  const old = q2.filter(x => x.id === canonicalId(p) && x.name === p.name && x.unit === p.unit);
  assert.equal(old.length, 1, `Missing/ambiguous Q2: ${p.name}`);
  const oldRow = oldRows.filter(x => x.name === p.name && x.unit === p.unit && norm(x.type) === norm(p.type));
  assert.equal(oldRow.length, 1);
  const score3 = completeProductPercent(p); assert.ok(Number.isFinite(score3));
  summaries.push({unit: p.unit, team: p.name, oldScore: oldRow[0].score / 100, newScore: score3 / 100, id: canonicalId(p)});
  const oldMetrics = new Map(flatten(old[0]).map(m => [m.code, m]));
  const coverage = new Set(), firstRow = details.length;
  let goalsAdded = false;
  for (const m of flatten(p)) {
    const evidence = surveyEvidence(p, m); for (const x of evidence.coverage) coverage.add(x);
    const previous = oldMetrics.get(m.code);
    const row = {unit: p.unit, team: p.name, group: m.blockName, metric: m.name, source: sourceLabel(m),
      oldScore: ratio(previous), newScore: ratio(m), question: evidence.question, options: evidence.options,
      answer: evidence.answer, comment: unique([sourceComment(m), evidence.comment]).join('\n\n'), respondent: evidence.respondent,
      teamId: canonicalId(p), code: m.code, value: m.value, max: m.max_value, oldValue: previous?.value ?? null, oldMax: previous?.max_value ?? null,
      activeSourceOrigin: m.source?.origin || null,
      included: isDdIndexMetricForPeriod(m, p.period), applicable: m.is_applicabble_flg !== false && m.max_value > 0};
    if (m.blockCode === 'goals') {
      if (goalsAdded) continue;
      goalsAdded = true;
      const goalNames = {monitoring: 'Цели выведены на мониторинг', factor_analysis: 'Факторный анализ — драйверы 1–2 ур.', forecast: 'Прогноз по целям'};
      const records = goalExtra.goals.filter(g => g.id === canonicalId(p));
      const componentRows = [];
      for (const goal of records) {
        const title = goalNames[goal.key];
        details.push({...row, group: 'Цели — итоговые метрики', metric: title, source: 'Цифровые следы',
          oldScore: goal.old.fraction, newScore: goal.current.fraction,
          code: goal.code, value: goal.current.value, max: goal.current.maxValue, oldValue: goal.old.value, oldMax: goal.old.maxValue,
          included: goal.current.includedInDdi, applicable: goal.current.maxValue > 0,
          question: '', options: '', answer: '',
          comment: `${goal.current.formula}\nЭффективный вес в текущем DDI: ${goal.current.effectiveWeight}. Раскрытия ЛЮ/ЛТ и PO ниже повторно не суммируются.\n${goal.old.note}`});
        for (const component of goal.components) {
          const actual = flatten(p).find(x => x.code === component.code);
          const ev = surveyEvidence(p, actual);
          for (const x of ev.coverage) coverage.add(x);
          const pure = component.purePoSurvey;
          const note = `Не входят в DDI напрямую; интегрально собираются в общую метрику «${title}». Не суммировать повторно.`;
          const poNote = pure ? `Оценка PO по прямым ответам: ${pure.value === null ? 'нет согласованной оценки' : `${pure.value * 100}%`}. Оценка PO после действующего правила DDI: ${component.fraction === null ? 'не применимо' : `${component.fraction * 100}%`}.\n${component.integrationComment}` : '';
          componentRows.push({...row, group: component.level === 'ЛЮ/ЛТ' ? 'Цели — ЛЮ/ЛТ' : 'Цели — PO', metric: `${title} — ${component.level === 'ЛЮ/ЛТ' ? 'ЛЮ/ЛТ' : 'PO'}`,
            source: component.declaredSourceType, oldScore: null, newScore: pure ? pure.value : component.fraction,
            question: ev.question, options: ev.options, answer: ev.answer, respondent: ev.respondent,
            comment: unique([note, component.oldNote, poNote, sourceComment(actual), ev.comment]).join('\n\n'),
            code: `${component.code}.disclosure`, included: false, disclosure: true, value: pure ? pure.value : component.value, max: pure ? 1 : component.maxValue,
            oldValue: null, oldMax: null, runtimeEffectiveValue: component.value, runtimeEffectiveMax: component.maxValue});
        }
      }
      details.push(...componentRows.filter(x => x.group === 'Цели — ЛЮ/ЛТ'), ...componentRows.filter(x => x.group === 'Цели — PO'));
    } else if (m.code === 'mehaniki.cross_sell') {
      const componentMax = m.max_value > 0 ? m.max_value / 2 : null;
      for (const key of ['during', 'after']) {
        const component = m.crossSellComponents?.[key];
        const applicable = row.applicable && (key === 'during' || component?.applicable !== false);
        const value = applicable && Number.isFinite(component?.value) ? Math.max(0, Math.min(component.value, componentMax)) : null;
        const ev = key === 'after' ? surveyEvidence(p, {...m, code: 'mehaniki.cross_sell.after'}) : {question: '', options: '', answer: '', comment: '', respondent: row.respondent, coverage: new Set()};
        for (const x of ev.coverage) coverage.add(x);
        details.push({...row, metric: `Cross-sell ${key === 'during' ? 'во время продажи' : 'после оформления'}`,
          source: key === 'during' ? 'Цифровые следы' : 'Опрос', code: `mehaniki.cross_sell.${key}`,
          oldScore: null, newScore: value !== null ? value / componentMax : null,
          question: ev.question, options: ev.options, answer: ev.answer, respondent: ev.respondent,
          comment: unique([`Каждый компонент даёт 50% общей метрики Cross-sell. II квартал: общая оценка ${row.oldScore === null ? 'не применима' : `${row.oldScore * 100}%`}; отдельные оценки компонентов в источнике отсутствуют.`,
            !applicable ? 'Компонент не применим.' : '',
            row.included && !applicable ? 'В действующем DDI общий вес Cross-sell сохранён полностью: эта половина сохраняет вес 0,5 и даёт 0 баллов в числителе. Отдельная оценка компонента не выставлялась.' : '',
            sourceComment({...m, source: component?.source}), ev.comment]).join('\n\n'),
          value: row.included && !applicable ? 0 : value, max: row.included ? componentMax : applicable ? componentMax : 0,
          oldValue: null, oldMax: null, included: row.included, applicable,
          denominatorOnly: row.included && !applicable});
      }
    } else {
      if (m.code === 'hyp.discovery_40_backlog') {
        const discovery = goalExtra.discovery.find(d => d.id === canonicalId(p));
        assert.ok(discovery);
        row.source = discovery.declaredSourceType;
        row.comment = unique([row.comment, discovery.hasEffectiveDecompositionSource ? 'Источник текущей оценки — подтверждённая декомпозиция бэклога III квартала.' : 'Опрос с подтверждениями; декомпозиция не использована как текущий источник.',
          discovery.note || '', discovery.manualOverride ? 'Действует ручная корректировка пользователя.' : '']).join('\n\n');
      }
      details.push(row);
    }
  }
  // Preserve every supplied field, including unassigned attachments, once per team.
  const extra = [];
  for (const r of responses.filter(r => r.canonicalTeam?.id === canonicalId(p))) {
    const fields = Object.entries(r.answers).filter(([id, v]) => !['name', 'product'].includes(id) && v !== null && v !== '' && v !== undefined && !coverage.has(`${r.payloadSha256}|${id}`));
    if (fields.length) extra.push(`${r.respondent.trim()} — дополнительные ответы и материалы анкеты:\n${fields.map(([k,v]) => `${k}: ${text(v)}`).join('\n')}`);
    const priorLinks = unique(Object.entries(r.payload.previousFunnelReports || {}).flatMap(([k, values]) => (Array.isArray(values) ? values : [values]).map(v => `${k}: ${text(v)}`)));
    if (priorLinks.length) extra.push(`${r.respondent.trim()} — ссылки на предыдущую отчётность, сохранённые анкетой:\n${priorLinks.join('\n')}`);
    qa.responseCoverage.push({team: p.name, respondent: r.respondent, totalFields: Object.keys(r.answers).length,
      attachedFields: Object.keys(r.answers).filter(id => coverage.has(`${r.payloadSha256}|${id}`)).length, additionalFields: fields.length});
  }
  if (extra.length) details[firstRow].comment += '\n\n' + extra.join('\n\n');
}
assert.equal(summaries.length, 76);
// Keep all submitted text and links; compress only line breaks in comments.
for (const row of details) row.comment = row.comment.split(/\n\s*\n/).map(paragraph => paragraph.replaceAll('\n', '; ')).join('\n');
const result = {periods: ['II кв. 2026', 'III кв. 2026'], summaries, details, qa,
  sourceFiles: responseData.files, goalExtraAvailable: !!goalExtra, metadata: {scores: 'Доли от 0 до 1; аплифт в процентных пунктах', summaryRule: 'Официальные оценки II квартала и актуальный DDI III квартала; округление как в дашборде'}};
// Keep technical source explanations inspectable, separate from reader-facing comments.
for (const row of details) row.commentSourceText = row.comment;
const cleanComments = cleanCommentRows(result, responseData, goalExtra);
for (let index = 0; index < details.length; index++) details[index].comment = cleanComments[index].comment;
fs.writeFileSync(new URL('comments-clean.json', dir), JSON.stringify(cleanComments, null, 2));
fs.writeFileSync(new URL('workbook-data.json', dir), JSON.stringify(result, null, 2));
console.log(JSON.stringify({teams: summaries.length, metrics: details.length, maxCommentChars: Math.max(...details.map(x => x.comment.length)), fields: qa.responseCoverage.length, goalExtraAvailable: !!goalExtra}));
