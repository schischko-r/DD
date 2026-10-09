import {hasAnswer, knownMechanics, needsComment, needsEvidence, needsProof, getSections, visibleQuestions} from './questions.js';
import {teams} from './teams.js';
import {scoringBaseline} from './scoring-baseline.js';
import {callCenterBaseline, callCenterScoreRules} from './call-center.js';

const round = value => Math.round(value * 10000) / 10000;
const text = value => String(value ?? '').trim();
const selected = value => Array.isArray(value) ? value : value ? [value] : [];

export function buildSurveyResult(answers, backlogAnalyzed = false, completedAt = new Date().toISOString()) {
  const team = teams.find(item => item.id === answers.product);
  const baseline = team?.id === callCenterBaseline.teamId ? callCenterBaseline : scoringBaseline;
  if (!team || team.id !== baseline.teamId) throw new Error('Unsupported survey team');
  const questions = getSections(answers).flatMap(section => visibleQuestions(section, backlogAnalyzed, answers));
  if (questions.some(q => !hasAnswer(q, answers))) throw new Error('Incomplete survey');
  // Export only the current branch; old hidden proofs/comments are excluded.
  const cleanAnswers = {};
  const questionRows = {};
  for (const q of questions) {
    cleanAnswers[q.id] = Array.isArray(answers[q.id]) ? answers[q.id].filter(option => q.options.includes(option)) : answers[q.id];
    questionRows[q.id] = q.row;
    if (selected(answers[q.id]).some(option => /Свой вариант|Что-то ещ[её]|^Другое$/.test(option))) cleanAnswers[`${q.id}Other`] = answers[`${q.id}Other`];
    if (needsComment(q, answers)) cleanAnswers[q.commentId] = answers[q.commentId];
    if (needsProof(q, answers)) {
      cleanAnswers[q.inlineProof.id] = answers[q.inlineProof.id];
      questionRows[q.inlineProof.id] = q.inlineProof.row;
    }
  }
  const activeInlineQuestions = questions.filter(q => needsEvidence(q, answers));
  const evidenceById = new Map(activeInlineQuestions.map(q => [q.inlineEvidence.id, q.inlineEvidence]));
  for (const activeInlineEvidence of evidenceById.values()) {
    const {id, formatId, row} = activeInlineEvidence;
    cleanAnswers[formatId] = answers[formatId];
    if (answers[formatId] === 'link') cleanAnswers[id] = String(answers[id]).trim();
    questionRows[id] = row;
    questionRows[formatId] = row;
  }
  const questionSources = Object.fromEntries(questions.map(q => [q.id, q.id === 'product'
    ? {source: 'ddi_team_catalog', sheet: null, row: null}
    : {sheet: q.sheet || (baseline === callCenterBaseline ? 'Каналы Phigital' : 'Продукты (2)'), row: q.row}]));
  for (const activeInlineQuestion of activeInlineQuestions) {
    const activeInlineEvidence = activeInlineQuestion.inlineEvidence;
    const source = {sheet: activeInlineQuestion.sheet || 'Продукты (2)', row: activeInlineEvidence.row};
    questionSources[activeInlineEvidence.id] = source;
    questionSources[activeInlineEvidence.formatId] = source;
  }

  for (const q of questions) {
    if (needsProof(q, answers)) {
      questionSources[q.inlineProof.id] = {sheet: q.sheet || 'Продукты (2)', row: q.inlineProof.row};
    }
  }

  const updates = new Map();
  function score(code, questionId, fraction, rule, evidenceId) {
    const metric = baseline.metrics.find(item => item.code === code);
    if (!metric || !questions.some(q => q.id === questionId)) return;
    const inlineEvidence = evidenceById.get(evidenceId);
    updates.set(code, {
      questionId,
      value: round(metric.max_value * Math.max(0, Math.min(1, fraction))),
      rule,
      evidence: evidenceId ? cleanAnswers[evidenceId] ||
        (inlineEvidence && cleanAnswers[inlineEvidence.formatId] === 'excel'
          ? 'Отчет в формате Excel' : null) : null,
      requiresReview: true,
    });
  }

  const knowledge = {
    marketRussia: 'general.obъem_celevogo_rynka_v_rossii',
    marketSber: 'general.obъem_celevogo_rynka_v_sbere',
    clients: 'general.klienty_s_produktom',
    mau: 'general.mau_produkta',
    satellite: 'general.znanie_produktov_sputnikov',
  };
  for (const [id, code] of Object.entries(knowledge)) score(code, id, text(answers[id]) ? 1 : 0, 'answer_present; accuracy_requires_review');
  const monitor = selected(answers.monitoring);
  const full = monitor.includes('Дашборд в Навигаторе (доступны все метрики)');
  const partial = monitor.includes('Дашборд в Навигаторе (доступна часть метрик)');
  score('general.navigator_reporting_knowledge', 'monitoring', full ? 1 : partial ? 0.5 : 0, 'navigator_all=1; navigator_partial=0.5; other=0');

  // Versioned self-report rubric. These estimates are not a verified DDI update.
  for (const [prefix, includesId, analysisId, proofId] of [
    ['attract', 'attractIncludes', 'attractAnalysis', 'attractReport'],
    ['churn', 'churnIncludes', 'churnAnalysis', 'churnReport'],
  ]) {
    const includesQ = questions.find(q => q.id === includesId);
    const analysisQ = questions.find(q => q.id === analysisId);
    if (includesQ) {
      const positive = includesQ.options.filter(option => option !== 'Затрудняюсь ответить');
      const count = positive.filter(option => selected(answers[includesId]).includes(option)).length;
      score(`${prefix}.report_completeness`, includesId, count / positive.length, 'selected_positive_elements / available_positive_elements', proofId);
    }
    if (analysisQ) {
      const positive = analysisQ.options.filter(option => !['Все перечисленное выше', 'Не проводился', 'Затрудняюсь ответить'].includes(option));
      const choices = selected(answers[analysisId]);
      const fraction = choices.includes('Все перечисленное выше') ? 1 : positive.filter(option => choices.includes(option)).length / positive.length;
      score(`${prefix}.funnel_analysis`, analysisId, fraction, 'all=1; otherwise selected_analysis_dimensions / available_dimensions', proofId);
    }
  }
  score('attract.benchmarks', 'benchmarksAttract', answers.benchmarksAttract === 'Да' ? 1 : 0, 'yes=1; other=0', 'benchmarkAttractProof');
  score('churn.benchmarks', 'benchmarksChurn', answers.benchmarksChurn === 'Да' ? 1 : 0, 'yes=1; other=0', 'benchmarkChurnProof');
  score('churn.deviation_actions', 'deviations', answers.deviations === 'Да' ? 1 : 0, 'yes=1; other=0', 'deviationExample');
  score('alerts.business_metrics', 'alerts', answers.alerts === 'Да' ? 1 : answers.alerts === 'Частично' ? 0.5 : 0, 'yes=1; partial=0.5; other=0');
  score('hyp.discovery_40_backlog', 'discovery', ['Больше 80%', 'От 40 до 79%'].includes(answers.discovery) ? 1 : 0, 'reported_discovery_at_least_40_percent=1; other=0', 'backlog');

  const mechanicsQ = questions.find(q => q.id === 'upsell');
  const known = mechanicsQ ? knownMechanics(mechanicsQ, answers) : [];
  const mechanicCodes = {
    'Удержание клиентов': 'mehaniki.uderzhanie_klientov',
    'Возврат клиентов': 'mehaniki.vozvrat_klientov',
    'Допродажи (upsell)': 'mehaniki.doprodazhi_up_sell',
  };
  for (const [option, code] of Object.entries(mechanicCodes)) {
    if (!known.includes(option)) score(code, 'upsell', selected(answers.upsell).includes(option) ? 1 : 0, 'newly_selected_mechanic=1; other=0; previously_confirmed_preserved', 'mechanics');
  }

  if (baseline === callCenterBaseline) {
    for (const {code, questionId, kind, evidenceId, option} of callCenterScoreRules) {
      const q = questions.find(question => question.id === questionId);
      if (!q) continue;
      const answer = answers[questionId];
      let fraction = 0;
      if (kind === 'presence') fraction = text(answer) ? 1 : 0;
      else if (kind === 'optionSelected') fraction = selected(answer).includes(option) ? 1 : 0;
      else if (kind === 'yes') fraction = answer === 'Да' ? 1 : 0;
      else if (kind === 'partial') fraction = answer === 'Да' ? 1 : answer === 'Частично' ? 0.5 : 0;
      else if (kind === 'navigator') fraction = selected(answer).includes('Дашборд в Навигаторе (доступны все метрики)') ? 1 : selected(answer).includes('Дашборд в Навигаторе (доступна часть метрик)') ? 0.5 : 0;
      else if (kind === 'multiFraction') {
        const options = q.options.filter(option => !['Затрудняюсь ответить', 'Нет', 'Не проводился', 'Все перечисленное выше'].includes(option) && !/Свой вариант|Что-то ещ[её]|^Другое$/.test(option));
        fraction = selected(answer).includes('Все перечисленное выше') ? 1 : options.filter(option => selected(answer).includes(option)).length / options.length;
      } else if (kind === 'discovery') fraction = ['Больше 80%', 'От 40 до 79%'].includes(answer) ? 1 : 0;
      score(code, questionId, fraction, `call_center_${kind}; accuracy_requires_review`, evidenceId);
    }
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
      ...(update || {}),
    };
  });
  const included = metrics.filter(metric => metric.includedInIndex);
  const points = round(included.reduce((sum, metric) => sum + Number(metric.value || 0), 0));
  const maxPoints = round(included.reduce((sum, metric) => sum + Number(metric.maxValue || 0), 0));
  const baselinePoints = round(included.reduce((sum, metric) => sum + Number(metric.baselineValue || 0), 0));
  return {
    schemaVersion: 1,
    surveyId: baseline === callCenterBaseline ? 'ddi-call-center' : 'ddi-deposits-ns',
    completedAt,
    team: {id: team.id, name: team.name, unit: team.unit},
    respondent: {name: cleanAnswers.name},
    answers: cleanAnswers,
    questionRows,
    questionSources,
    previousMechanics: [...new Set(questions.flatMap(q => knownMechanics(q, answers)))],
    result: {
      status: 'provisional_self_report',
      scoringVersion: 'ddi-survey-self-report-v1',
      requiresBackendReview: true,
      baselinePeriod: baseline.period,
      baselinePoints,
      points,
      maxPoints,
      scorePct: maxPoints ? round(points / maxPoints * 100) : null,
      baselineScorePct: maxPoints ? round(baselinePoints / maxPoints * 100) : null,
      scoredMetricCount: updates.size,
      metrics,
    },
  };
}
