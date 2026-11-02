import {correctTypos, allowsMissingMetric, isOptionSelected, hasAnswer, inlineQuestions, knownMechanics, showsOptionalComment, needsComment, needsEvidence, needsProof, needsReason, getSections, visibleQuestions, evidenceResponse} from './questions.js';
import {teams} from './teams.js';
import {otherTeamProfiles} from './other-team-profiles.js';
import {metricSourceEvidence, metricSourceFields} from './metric-source.js';
import {getPreviousHistory} from './previous-history.js';

const round = value => Math.round(value * 10000) / 10000;
const text = value => String(value ?? '').trim();
const selected = value => Array.isArray(value) ? value : value ? [value] : [];

export function buildSurveyResult(answers, backlogAnalyzed = false, completedAt = new Date().toISOString()) {
  const team = teams.find(item => item.id === answers.product);
  const baseline = otherTeamProfiles[team?.id];
  if (!team || !baseline) throw new Error('Unsupported survey team');
  const history = getPreviousHistory(team.id);
  const catalogue = getSections(answers);
  answers = {...answers};
  for (const q of catalogue.flatMap(s => s.questions).flatMap(q => [q, ...inlineQuestions(q)])) {
    if (q.type === 'multi' && Array.isArray(answers[q.id])) answers[q.id] = answers[q.id].map(correctTypos);
    if (q.type === 'radio' && typeof answers[q.id] === 'string') answers[q.id] = correctTypos(answers[q.id]);
  }
  for (const q of catalogue.flatMap(section => section.questions)) {
    if (q.action) answers[q.action.id] = isOptionSelected(q, answers, q.actionOption) ? 'Да' : 'Нет';
    if (q.benchmark) answers[q.benchmark.id] = q.benchmarkOnly ? answers[q.id] : isOptionSelected(q, answers, 'Бенчмарки') ? 'Да' : 'Нет';
  }
  const questions = catalogue.flatMap(section => visibleQuestions(section, backlogAnalyzed, answers)).flatMap(q => [q, ...inlineQuestions(q, answers), ...(q.benchmark ? [q.benchmark] : []), ...(q.action ? [q.action] : [])]).filter(q => q.type !== 'info' && (!q.optionalMetric || text(answers[q.id]) || allowsMissingMetric(q, answers)));
  if (questions.some(q => !hasAnswer(q, answers))) throw new Error('Incomplete survey');
  // Export only the current branch; old hidden proofs/comments are excluded.
  const cleanAnswers = {};
  const questionRows = {};
  for (const q of questions) {
    if (q.type === 'metricGroup') {
      if (q.optionalCommentId && text(answers[q.optionalCommentId])) {
        cleanAnswers[q.optionalCommentId] = String(answers[q.optionalCommentId]);
        questionRows[q.optionalCommentId] = q.row;
      }
      if (needsProof(q, answers)) {
        const fields = metricSourceFields(q.inlineProof, answers);
        Object.assign(cleanAnswers, fields);
        for (const id of Object.keys(fields)) questionRows[id] = q.inlineProof.row;
      }
      continue;
    }
    cleanAnswers[q.id] = Array.isArray(answers[q.id]) ? answers[q.id].filter(option => q.options.includes(option)) : answers[q.id];
    if (q.type === 'links') {
      const format = answers[`${q.id}Unknown`] === true ? 'unknown' : answers[`${q.id}Format`] || 'link';
      cleanAnswers[`${q.id}Format`] = format;
      cleanAnswers[q.id] = format === 'unknown' ? 'Затрудняюсь ответить' : format === 'excel' ? 'Отчетность в формате Excel' : String(answers[q.id] ?? '');
      questionRows[`${q.id}Format`] = q.row;
    }
    if (allowsMissingMetric(q, answers)) {
      cleanAnswers[q.id] = null;
      cleanAnswers[`${q.id}Unknown`] = true;
      questionRows[`${q.id}Unknown`] = q.row;
    }
    if (q.previousOptions?.length) cleanAnswers[q.id] = [...new Set([...q.previousOptions, ...selected(cleanAnswers[q.id])])];
    questionRows[q.id] = q.row;
    if (showsOptionalComment(q, answers) && text(answers[q.optionalCommentId])) {
      cleanAnswers[q.optionalCommentId] = String(answers[q.optionalCommentId]);
      questionRows[q.optionalCommentId] = q.row;
    }
    if (selected(answers[q.id]).some(option => /Свой вариант|Что-то ещ[её]|^Другое$/.test(option))) {cleanAnswers[`${q.id}Other`] = answers[`${q.id}Other`]; questionRows[`${q.id}Other`] = q.row;}
    if (needsComment(q, answers)) {cleanAnswers[q.commentId] = answers[q.commentId]; questionRows[q.commentId] = q.row;}
    if (needsReason(q, answers) && (!q.reasonOptional || text(answers[q.reasonId]))) {
      cleanAnswers[q.reasonId] = String(answers[q.reasonId]);
      questionRows[q.reasonId] = q.row;
    }
    if (needsProof(q, answers)) {
      const fields = q.inlineProof.kind === 'metricSource' ? metricSourceFields(q.inlineProof, answers)
        : {[q.inlineProof.id]: answers[q.inlineProof.id]};
      Object.assign(cleanAnswers, fields);
      for (const id of Object.keys(fields)) questionRows[id] = q.inlineProof.row;
    }
  }
  const activeInlineQuestions = questions.filter(q => needsEvidence(q, answers));
  const evidenceById = new Map(activeInlineQuestions.map(q => [q.inlineEvidence.id, q.inlineEvidence]));
  for (const activeInlineEvidence of evidenceById.values()) {
    const {id, formatId, row} = activeInlineEvidence;
    const response = evidenceResponse(activeInlineEvidence, answers);
    cleanAnswers[formatId] = response.format;
    if (!['excel', 'unavailable', 'unknown'].includes(response.format)) cleanAnswers[id] = response.value;
    if (response.format === 'unavailable' && response.comment) {
      cleanAnswers[`${id}Comment`] = response.comment;
      questionRows[`${id}Comment`] = row;
    }
    if (response.correction) {
      cleanAnswers[`${id}Correction`] = response.correction;
      questionRows[`${id}Correction`] = row;
    }
    questionRows[id] = row;
    questionRows[formatId] = row;
  }
  const questionSources = Object.fromEntries(questions.filter(q => q.type !== 'metricGroup').map(q => [q.id, q.id === 'product'
    ? {source: 'ddi_team_catalog', sheet: null, row: null}
    : {sheet: q.sheet || baseline.sheet, row: q.row,
      ...(q.adaptedFrom ? {adaptedFrom: q.adaptedFrom, accuracyReview: true} : {})}]));
  for (const q of questions) {
    if (q.type === 'links') questionSources[`${q.id}Format`] = {sheet: q.sheet || baseline.sheet, row: q.row};
    if (allowsMissingMetric(q, answers)) questionSources[`${q.id}Unknown`] = {sheet: q.sheet || baseline.sheet, row: q.row};
    if (q.optionalCommentId && cleanAnswers[q.optionalCommentId]) questionSources[q.optionalCommentId] = {sheet: q.sheet || baseline.sheet, row: q.row};
    if (needsReason(q, answers) && (!q.reasonOptional || text(answers[q.reasonId]))) questionSources[q.reasonId] = {
      sheet: q.sheet || baseline.sheet, row: q.row,
    };
  }
  for (const activeInlineQuestion of activeInlineQuestions) {
    const activeInlineEvidence = activeInlineQuestion.inlineEvidence;
    const source = {sheet: activeInlineEvidence.sheet || activeInlineQuestion.sheet || baseline.sheet, row: activeInlineEvidence.row};
    questionSources[activeInlineEvidence.id] = source;
    questionSources[activeInlineEvidence.formatId] = source;
    if (cleanAnswers[`${activeInlineEvidence.id}Comment`]) questionSources[`${activeInlineEvidence.id}Comment`] = source;
    if (activeInlineEvidence.previousLinks) questionSources[`${activeInlineEvidence.id}Correction`] = source;
  }

  for (const q of questions) {
    if (needsProof(q, answers)) {
      const fields = q.inlineProof.kind === 'metricSource' ? metricSourceFields(q.inlineProof, answers) : {[q.inlineProof.id]: answers[q.inlineProof.id]};
      for (const id of Object.keys(fields)) questionSources[id] = {sheet: q.sheet || baseline.sheet, row: q.inlineProof.row};
    }
  }

  for (const id of Object.keys(cleanAnswers)) {
    if (!questionSources[id]) questionSources[id] = {sheet: baseline.sheet, row: questionRows[id] ?? null};
  }

  const updates = new Map();
  const metricSourceEvidenceById = new Map(questions.filter(q => q.inlineProof?.kind === 'metricSource')
    .map(q => [q.inlineProof.id, metricSourceEvidence(q.inlineProof, answers)]));
  function score(code, q, fraction, rule) {
    const metric = baseline.metrics.find(item => item.code === code);
    if (!metric || metric.is_applicabble_flg === false || metric.excluded_from_index || Number(metric.dd_calculation_flg) === 0 || Number(metric.max_value) <= 0 || !Number.isFinite(fraction)) return;
    const sourceId = q.scoreKind === 'segmentKnowledge'
      ? answers[q.id] === q.options[0] ? `${q.knowledgeValueId}Source` : undefined
      : q.sharedSourceId || q.inlineProof?.id || q.inlineEvidence?.id;
    const sourceFormat = q.inlineEvidence?.formatId;
    updates.set(code, {
      questionId: q.id,
      value: round(Number(metric.max_value) * Math.max(0, Math.min(1, fraction))),
      rule,
      evidence: sourceId ? metricSourceEvidenceById.get(sourceId) || cleanAnswers[sourceId] ||
        (sourceFormat && cleanAnswers[sourceFormat] === 'excel' ? 'Отчетность в формате Excel' : null) : null,
      requiresReview: true,
    });
  }
  for (const q of questions) {
    const answer = cleanAnswers[q.id];
    if (q.scoreKind === 'mechanics') {
      const known = knownMechanics(q, answers).map(correctTypos);
      for (const [option, code] of Object.entries(q.optionMetricCodes || {})) {
        const uiOption = correctTypos(option);
        if (!known.includes(uiOption)) score(code, q, selected(answer).includes(uiOption) ? 1 : 0,
          'newly_selected_mechanic=1; other=0; previously_confirmed_preserved');
      }
      continue;
    }
    if (!q.metricCode || q.scoreKind === 'preserve') continue;
    let fraction;
    if (q.scoreKind === 'segmentKnowledge') fraction = answer === q.options[0] && text(cleanAnswers[q.knowledgeValueId]) ? 1 : answer === q.options[1] ? 0.5 : 0;
    else if (q.scoreKind === 'numericKnowledge') fraction = allowsMissingMetric(q, answers) ? 0 : text(answer) ? 1 : 0;
    else if (q.scoreKind === 'reporting') fraction = answer === 'Да, автоматическая (monthly/weekly)' ? 1 : answer === 'Да, по запросу' ? 0.5 : 0;
    else if (q.scoreKind === 'yesPartial') fraction = answer === 'Да' ? 1 : answer === 'Частично' ? 0.5 : 0;
    else if (q.scoreKind === 'presence') fraction = q.type === 'radio' ? answer === 'Да' ? 1 : 0 : text(answer) ? 1 : 0;
    else if (q.scoreKind === 'discovery') fraction = ['Больше 80%', 'От 40 до 79%'].includes(answer) ? 1 : 0;
    else if (['reportCompleteness', 'analysis'].includes(q.scoreKind)) {
      const options = (q.options || []).filter(option => !['Нет', 'Не проводился', 'Затрудняюсь ответить', 'Все перечисленное выше', 'Бенчмарки', q.actionOption].includes(option)
        && !/Свой вариант|Что-то ещ[её]|^Другое$/.test(option));
      fraction = selected(answer).includes('Все перечисленное выше') ? 1 : options.length ? options.filter(option => selected(answer).includes(option)).length / options.length : 0;
    }
    if (fraction !== undefined) score(q.metricCode, q, fraction,
      `${q.scoreKind}; provisional_self_report; accuracy_requires_review`);
  }

  const metrics = baseline.metrics.map(metric => {
    const update = updates.get(metric.code);
    return {
      code: metric.code,
      name: metric.name,
      baselineValue: metric.value,
      value: update ? update.value : metric.value,
      maxValue: metric.max_value,
      includedInIndex: metric.is_applicabble_flg !== false && !metric.excluded_from_index && Number(metric.dd_calculation_flg) !== 0 && Number(metric.max_value) > 0,
      source: update ? 'survey_self_report' : 'ddi_baseline',
      rule: 'ddi_baseline_preserved',
      ...(questions.some(q => q.metricCode === metric.code && q.scoreKind === 'preserve') ? {requiresReview: true, accuracyRequiresReview: true} : {}),
      ...(update || {}),
    };
  });
  const included = metrics.filter(metric => metric.includedInIndex);
  const points = round(included.reduce((sum, metric) => sum + Number(metric.value || 0), 0));
  const maxPoints = round(included.reduce((sum, metric) => sum + Number(metric.maxValue || 0), 0));
  const baselinePoints = round(included.reduce((sum, metric) => sum + Number(metric.baselineValue || 0), 0));
  return {
    schemaVersion: 1,
    surveyId: `ddi-${baseline.type === 'Сегмент' ? 'segment' : 'channel'}-${team.id.split('¦')[0]}`,
    completedAt,
    team: {id: team.id, name: team.name, unit: team.unit, type: baseline.type},
    respondent: {name: cleanAnswers.name},
    answers: cleanAnswers,
    questionRows,
    questionSources,
    previousMechanics: [...new Set([...(history?.mechanics || []).map(correctTypos), ...questions.flatMap(q => knownMechanics(q, answers))])],
    previousFunnelElements: {...Object.fromEntries(Object.entries(history?.funnelElements || {}).map(([id, values])=>[id, values.map(correctTypos)])), ...Object.fromEntries(questions.filter(q => q.previousOptions?.length).map(q => [q.id, q.previousOptions]))},
    previousFunnelReports: {...history?.reportLinks, ...Object.fromEntries(questions.filter(q => q.previousClickstreamUrl).map(q => [q.id, q.previousClickstreamUrl]))},
    ...(history ? {previousAnswers: history} : {}),
    result: {
      status: 'provisional_self_report',
      historicalBaselineAvailable: true,
      historicalSourcesAvailable: Boolean(history),
      scoringVersion: 'ddi-survey-self-report-v1',
      requiresBackendReview: true,
      baselinePeriod: baseline.period,
      baselinePoints: baselinePoints,
      points,
      maxPoints,
      scorePct: maxPoints ? round(points / maxPoints * 100) : null,
      baselineScorePct: maxPoints ? round(baselinePoints / maxPoints * 100) : null,
      scoredMetricCount: updates.size,
      unscoredGapMetricCodes: baseline.metrics.filter(metric =>
        metric.is_applicabble_flg !== false && !metric.excluded_from_index && Number(metric.dd_calculation_flg) !== 0 &&
        Number(metric.value) < Number(metric.max_value) && !updates.has(metric.code)).map(metric => metric.code),
      metrics,
    },
  };
}
