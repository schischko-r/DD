import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir = new URL('./', import.meta.url);
const text = (value) => value == null ? '' : Array.isArray(value) ? value.map(text).join('; ')
  : typeof value === 'object' ? JSON.stringify(value) : String(value);
const flattened = (value) => text(value).replace(/\r?\n/g, '; ');
const unique = (values) => [...new Set(values.filter((value) => value !== null && value !== undefined && String(value).trim()))];
const percentage = (value) => Number.isFinite(value) ? `${Number((100 * value).toFixed(2)).toLocaleString('ru-RU')}%` : 'не выставлен';
const urls = (value) => {
  if (typeof value === 'string') return (value.match(/https?:\/\/[^\s<>"']+/g) || []).map((url) => url.replace(/[;,]+$/, ''));
  if (Array.isArray(value)) return value.flatMap(urls);
  return value && typeof value === 'object' ? Object.values(value).flatMap(urls) : [];
};
const author = (response) => `${String(response.respondent || 'Коллега').trim()}${response.cohort ? ` [${response.cohort}]` : ''}`;
const materialKey = (key) => /Comment|Other|Reason|Source|Report|Proof|Dashboards|^backlog$|Backlog/.test(key);
const fieldLabel = (key) => /SourceLinkComment$/.test(key) ? 'Комментарий к ссылке'
  : /Comment$/.test(key) ? 'Комментарий'
    : /SourceOther$/.test(key) ? 'Другой источник'
      : /Other$/.test(key) ? 'Другое'
        : /Reason$/.test(key) ? 'Пояснение'
          : /SourceLink$|Link$/.test(key) ? 'Ссылка'
            : /Source$/.test(key) ? 'Источник'
              : /Format$/.test(key) ? 'Формат материалов'
                : /Correction$/.test(key) ? 'Материалы прошлого опроса'
                  : /Report$|Dashboards$/.test(key) ? 'Отчёт'
                    : /Proof$/.test(key) ? 'Подтверждение'
                      : key === 'backlog' ? 'Бэклог' : /BacklogType$/.test(key) ? 'Где ведётся бэклог' : 'Дополнительный ответ';
function materialText(key, value) {
  if (typeof value === 'boolean') return value ? 'Не удалось уточнить' : '';
  if (/Format$/.test(key)) return ({link: 'Ссылка', excel: 'Excel', other: 'Другой формат', unknown: 'Неизвестно', unavailable: 'Материалы недоступны'})[value] || text(value);
  if (/Correction$/.test(key)) return ({keep: 'Подтверждены прежние материалы', replace: 'Материалы обновлены', change: 'Материалы обновлены'})[value] || text(value);
  return text(value);
}

export function reportingAbsenceContext(row, details, responses) {
  if (!row.applicable || row.newScore !== 0
    || !/\.(?:benchmarks|nalichie_benchmarkov|report_completeness|polnota_otcheta)$/.test(row.code)) return null;
  const prefix = row.code.split('.')[0];
  const reporting = details.find((item) => item.teamId === row.teamId && item.unit === row.unit
    && item.code === `${prefix}.nastroena_otchetnostь`);
  if (!reporting?.applicable || !(reporting.newScore == null || reporting.newScore === 0)) return null;
  const records = responses.filter((response) => response.canonicalTeam?.id === row.teamId);
  const configuredQuestions = {attract: 'attractConfigured', churn: 'churnConfigured',
    voronka_onbordinga: 'onboardingConfigured', voronka_ispolьzovaniya: 'usageConfigured',
    voronka_vhoda_v_kanal: 'entryConfigured', voronka_prodazh: 'salesConfigured',
    analiz_effektivnostь: 'campaignConfigured'};
  const questionId = prefix === 'attract' && row.unit === 'Data' && records.some((record) => Object.hasOwn(record.answers, 'usageConfigured'))
    ? 'usageConfigured' : configuredQuestions[prefix];
  if (!questionId) return null;
  const answered = records.filter((record) => record.answers[questionId] !== null
    && record.answers[questionId] !== undefined && record.answers[questionId] !== '');
  if (!answered.length || !answered.every((record) => record.answers[questionId] === 'Нет')) return null;
  return {questionId, responses: answered,
    dependent: /\.(?:benchmarks|nalichie_benchmarkov)$/.test(row.code) ? 'бенчмарки' : 'полнота отчёта'};
}

function introduction(row, extra, absence) {
  const old = row.commentSourceText ?? row.comment ?? '';
  const firstOrigin = Object.hasOwn(row, 'activeSourceOrigin') ? row.activeSourceOrigin
    : old.match(/Подтверждённая оценка:\s*([^;,\n]+)/)?.[1];
  if (row.team === 'Телемаркетинг' && row.code === 'mehaniki.nailuchshego_vremeni_zvonka') {
    return `Балл оставлен по прошлому опросу: ${percentage(row.newScore)}.`;
  }
  if (absence) return `Нет отчётности по этой воронке, поэтому ${absence.dependent} — 0%.`;
  if (row.code.startsWith('goals.export_final_')) return row.applicable
    ? 'Сумма по уровням ЛЮ/ЛТ и PO. Отдельные строки ниже второй раз не считаем.'
    : 'Итоговая метрика целей не применима и не входит в DDI.';
  if (row.disclosure || row.code.endsWith('.disclosure')) {
    const goal = extra.goals.find((item) => item.id === row.teamId && item.components.some((component) => `${component.code}.disclosure` === row.code));
    const title = goal ? goal.title.replace(/ — итоговая метрика$/, '') : row.metric.replace(/ — (?:PO|ЛЮ\/ЛТ)$/, '');
    const po = row.code.startsWith('goals.po_');
    const current = po && Number.isFinite(row.runtimeEffectiveValue) && row.runtimeEffectiveMax > 0
      ? row.runtimeEffectiveValue / row.runtimeEffectiveMax : row.newScore;
    const summary = po && current !== row.newScore
      ? `По ответу PO — ${percentage(row.newScore)}; с учётом ЛЮ/ЛТ — ${percentage(current)}.`
      : `${po ? 'Оценка PO' : 'Оценка ЛЮ/ЛТ'}: ${percentage(row.newScore)}.`;
    return `${summary} Не входят в DDI напрямую; входят в итоговую метрику «${title}». Повторно не суммировать. Прошлый опрос не разделял оценки по этим уровням.`;
  }
  if (row.code.startsWith('mehaniki.cross_sell.')) {
    const missing = row.denominatorOnly
      ? 'Отдельный балл не выставлялся; вес этой половины сохранён.' : !row.applicable ? 'Компонент не применяется.' : '';
    return `Эта часть даёт 50% общей оценки Cross-sell. За прошлый опрос отдельного балла нет.${missing ? ` ${missing}` : ''}`;
  }
  if (row.code === 'general.navigator_reporting_knowledge') {
    if (['userConfirmedDirectNavigatorAssessment', 'userConfirmedInvestKopilkaNavigator20261030'].includes(firstOrigin)) {
      return `Балл уточнён: ${percentage(row.newScore)}. Ссылка на дашборд не обязательна.`;
    }
    if (firstOrigin === 'userConfirmedMajorNavigatorRule') {
      return `Команда знает число Major-клиентов: ${percentage(row.newScore)}. Ссылка на дашборд не обязательна.`;
    }
    if (firstOrigin === 'salaryCohortAverage') return 'Средняя оценка B2B и B2C. Ссылка на дашборд не обязательна.';
    return 'Считаем по знанию MAU и рынка; ссылка на дашборд не обязательна.';
  }
  if (row.code === 'hyp.discovery_40_backlog') {
    const discovery = extra.discovery.find((item) => item.id === row.teamId);
    if (discovery?.manualOverride) return `Балл уточнён вручную: ${percentage(row.newScore)}.`;
    const evidence = discovery?.availableDecomposition?.[0] || discovery?.decompositionEvidence?.[0];
    if (evidence) {
      const share = evidence.discoveryShare ?? evidence.displayedShare ?? evidence.actualShare;
      const base = `Discovery: ${evidence.discoveryCount} из ${evidence.createdCount} задач (${Number(share.toFixed(2)).toLocaleString('ru-RU')}%).`;
      return `${base}${!discovery.hasEffectiveDecompositionSource ? ' Текущий балл взят из опроса.' : ''}${evidence.isComplete === false ? ' Данные за квартал неполные.' : ''}`;
    }
    return 'Балл по ответу команды о доле Discovery.';
  }
  if (row.code === 'hyp.ab_tests' && row.newScore === null) return 'Оценка A/B-тестов за III квартал не выставлена и в расчёте не учитывается.';
  if (!row.applicable) return 'Метрика не применима и не входит в DDI.';
  if (row.code === 'hyp.extra_initiatives' || firstOrigin === 'priorQuarterCarryForward'
    || firstOrigin === 'userConfirmedQuarterRetention' && row.oldScore === row.newScore) return row.oldScore === 1 && row.newScore === 1
    ? 'В прошлом периоде получили макс. балл, не спрашиваем' : 'Сохранён балл прошлого периода.';
  if (!row.included) return 'Справочный показатель; в DDI не входит.';
  if (row.source?.startsWith('Цифровые следы')) return 'Балл по цифровым следам.';
  if (/userConfirmed|userMaximum/.test(firstOrigin || '')) return `Балл уточнён: ${percentage(row.newScore)}.`;
  return 'Балл по ответу команды.';
}

/** Keep generated explanations separate from exact submitted field values. */
export function cleanCommentRows(workbook, responseData, extra) {
  const responses = responseData.responses.filter((response) => !response.excludedByConfirmedUserInstruction);
  const prepared = workbook.details.map((row) => {
    const absence = reportingAbsenceContext(row, workbook.details, responses);
    const old = row.commentSourceText ?? row.comment ?? '';
    const additionalParagraphs = old.split('\n').filter((paragraph) => /— дополнительные ответы и материалы анкеты:|— ссылки на предыдущую отчётность/.test(paragraph));
    const primary = old.split('\n').filter((paragraph) => !additionalParagraphs.includes(paragraph)).join('\n');
    const oldFlat = flattened(primary);
    const rowUrls = new Set(urls(old));
    const primaryUrls = new Set(urls(primary));
    const materials = new Map();
    const additionalMaterials = new Map();
    const historicalBestTime = row.team === 'Телемаркетинг' && row.code === 'mehaniki.nailuchshego_vremeni_zvonka';
    for (const response of responses.filter((record) => record.canonicalTeam?.id === row.teamId)) {
      if (historicalBestTime) continue;
      const entries = [];
      const additionalEntries = [];
      const verbatimValues = new Set();
      const extraText = additionalParagraphs.filter((paragraph) => paragraph.startsWith(String(response.respondent).trim())).join('\n');
      for (const [key, value] of Object.entries(response.answers || {})) {
        if (['name', 'product'].includes(key) || value === null || value === undefined || value === '') continue;
        const shown = text(value), flattenedValue = flattened(value);
        const byKey = oldFlat.includes(`${key}: ${flattenedValue}`);
        const byUrl = urls(value).some((url) => primaryUrls.has(url));
        const byText = materialKey(key) && shown.length > 8 && oldFlat.includes(flattenedValue);
        const additional = extraText.includes(`${key}: ${flattenedValue}`);
        if (!byKey && !byUrl && !byText && !additional) continue;
        const rendered = materialText(key, value);
        if (rendered && !verbatimValues.has(rendered)) {
          (byKey || byUrl || byText ? entries : additionalEntries).push(`${fieldLabel(key)}: ${rendered}`);
          verbatimValues.add(rendered);
        }
      }
      if (entries.length) materials.set(author(response), unique(entries));
      if (additionalEntries.length) additionalMaterials.set(author(response), unique(additionalEntries));
    }
    for (const response of absence?.responses || []) {
      const who = author(response), entries = materials.get(who) || [];
      const verbatim = `Ответ об отчётности: ${response.answers[absence.questionId]}`;
      if (!entries.includes(verbatim)) entries.unshift(verbatim);
      materials.set(who, entries);
    }
    // Preserve genuine analyst notes without the classification machinery around them.
    const findings = unique([...old.matchAll(/(?:^|;\s*|\n)(Находка:[^\n]+)/g)].map((match) => match[1]));
    const parts = [`Почему такой балл: ${introduction(row, extra, absence)}`, ...findings];
    if (historicalBestTime) {
      const historical = responses.filter((response) => response.canonicalTeam?.id === row.teamId)
        .map((response) => response.payload.previousAnswers?.knownSubanswers?.otherMechanicnailuchshego_vremeni_zvonka).filter(Boolean);
      const selected = unique(historical.flatMap((answer) => answer.selectedOptions || []));
      if (selected.length) parts.push(`Ответ из прошлого опроса:\n${selected.join('\n')}`);
      const notes = unique(historical.flatMap((answer) => answer.comments || []));
      if (notes.length) parts.push(`Пояснения из прошлого опроса:\n${notes.map(text).join('\n')}`);
      const links = unique(historical.flatMap((answer) => answer.links || []));
      if (links.length) parts.push(`Ссылки и материалы из прошлого опроса:\n${links.map(text).join('\n')}`);
    }
    for (const [who, entries] of materials) parts.push(`Ответ PO — ${who}:\n${entries.join('\n')}`);
    for (const [who, entries] of additionalMaterials) parts.push(`Дополнительные ответы PO — ${who}:\n${entries.join('\n')}`);
    const rendered = parts.join('\n\n');
    const remaining = historicalBestTime ? [] : [...rowUrls].filter((url) => !urls(rendered).includes(url));
    if (remaining.length) parts.push(`Ссылки и материалы:\n${remaining.join('\n')}`);
    return {team: row.team, code: row.code, comment: parts.join('\n\n'), teamId: row.teamId};
  });
  // Cover every actually submitted comment and attachment, even where the old
  // exporter had not associated a field with one particular metric.
  for (const response of responses) {
    const rows = prepared.filter((row) => row.teamId === response.canonicalTeam?.id);
    if (!rows.length) continue;
    const original = workbook.details.filter((row) => row.teamId === response.canonicalTeam.id);
    const combined = [...rows.map((row) => row.comment), ...original.map((row) => row.answer)].join('\n');
    const extras = [];
    for (const [key, value] of Object.entries(response.answers || {})) {
      if (!materialKey(key) || value == null || value === '' || typeof value === 'boolean'
        || /Format$|Correction$/.test(key)) continue;
      const rendered = text(value);
      if (!combined.includes(rendered)) extras.push(`${fieldLabel(key)}: ${rendered}`);
    }
    if (extras.length) rows[0].comment += `\n\nОтвет PO — ${author(response)} (дополнительные материалы):\n${unique(extras).join('\n')}`;
    const present = new Set(urls([...rows.map((row) => row.comment), ...original.map((row) => row.answer)]));
    const missingUrls = unique(urls(response.answers)).filter((url) => !present.has(url));
    if (missingUrls.length) rows[0].comment += `\n\nСсылки и материалы — ${author(response)}:\n${missingUrls.join('\n')}`;
  }
  return prepared.map(({team, code, comment}) => ({team, code, comment}));
}

function main() {
  const workbook = JSON.parse(fs.readFileSync(new URL('workbook-data.json', dir), 'utf8'));
  const responses = JSON.parse(fs.readFileSync(new URL('responses-lossless.json', dir), 'utf8'));
  const extra = JSON.parse(fs.readFileSync(new URL('goals-discovery.json', dir), 'utf8'));
  const cleaned = cleanCommentRows(workbook, responses, extra);
  assert.equal(cleaned.length, workbook.details.length);
  const actualUrls = new Set(urls(responses.responses.filter((response) => !response.excludedByConfirmedUserInstruction).map((response) => response.answers)));
  const presentUrls = new Set(urls([...cleaned.map((row) => row.comment), ...workbook.details.map((row) => row.answer)]));
  const missing = [...actualUrls].filter((url) => !presentUrls.has(url));
  assert.deepEqual(missing, []);
  const output = new URL('comments-clean.json', dir);
  fs.writeFileSync(output, JSON.stringify(cleaned, null, 2));
  console.log(JSON.stringify({output: output.pathname, rows: cleaned.length, actualAnswerUrls: actualUrls.size,
    preservedActualAnswerUrls: actualUrls.size - missing.length, maxCommentChars: Math.max(...cleaned.map((row) => row.comment.length)),
    examples: cleaned.filter((row) => row.team === 'Много денег (НКПЗН)' && ['hyp.discovery_40_backlog', 'hyp.extra_initiatives',
      'general.navigator_reporting_knowledge', 'goals.export_final_monitoring', 'mehaniki.cross_sell.after'].includes(row.code))}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
