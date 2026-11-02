import {otherTeamProfiles} from './other-team-profiles.js';
import {otherMetricApplicable} from './other-team-questions.js';

// Historical relevance notes from Книга1(4).xlsx, «свод_сегменты».
// DDI applicability takes priority: historical text never excludes an applicable
// metric with a positive maximum. Notes do not change baseline scores.
const evidence = (answerCell, markCell, questionRow, scope, note) => ({
  file: 'Книга1(4).xlsx', sheet: 'свод_сегменты', answerCell, markCell,
  questionRow, scope, mark: 'не релевантно', ...(note ? {note} : {}),
});
const relevanceByName = {
  'Дети': {
    excludedMetricCodes: ['mehaniki.uderzhanie_klientov', 'mehaniki.reagirovanie_na_zhiznennye_sobytiya'],
    evidence: [evidence('I164', 'J164', 164, 'возрастной', 'Удержание: в собственной возрастной ветке нет положительных отметок.'), evidence('I195', 'J195', 195, 'общий', 'Жизненные события: нет положительных отметок.')], reviewOnly: [],
  },
  'Молодежь': {
    excludedMetricCodes: ['mehaniki.privlechenie_klientov'],
    evidence: [evidence('N163', 'O163', 163, 'возрастные и МВС')], reviewOnly: [],
  },
  'Рабочий возраст': {
    excludedMetricCodes: ['mehaniki.reagirovanie_na_zhiznennye_sobytiya'],
    evidence: [evidence('S195', 'T195', 195, 'общий')],
    reviewOnly: [{...evidence('S163', 'T163', 163, 'возрастные и МВС'), conflictingSelectionCell: 'T136', conflictingSelection: 1,
      note: 'Привлечение отмечено в родительском вопросе; рядом с пометкой нерелевантности дан пример бонусной механики. Не исключаем автоматически.'}],
  },
  'Зрелость': {
    excludedMetricCodes: ['mehaniki.personalizaciya_klientskogo_opyta', 'mehaniki.privlechenie_klientov'],
    evidence: [evidence('X149', 'Y149', 149, 'общий'), evidence('X163', 'Y163', 163, 'возрастные и МВС')], reviewOnly: [],
  },
  'Top Affluent': {
    excludedMetricCodes: ['mehaniki.vozvrat_klientov'],
    evidence: [evidence('AC180', 'AD180', 180, 'доходной')], reviewOnly: [],
  },
  'PB': {
    excludedMetricCodes: ['mehaniki.vozvrat_klientov'],
    evidence: [evidence('AH180', 'AI180', 180, 'доходной')], reviewOnly: [],
  },
  'МВС': {
    excludedMetricCodes: ['mehaniki.personalizaciya_klientskogo_opyta'],
    evidence: [evidence('AM149', 'AN149', 149, 'общий')],
    reviewOnly: [{...evidence('AM180', 'AN180', 180, 'доходной'), conflictingCommentCell: 'AN183',
      note: 'При пометке нерелевантности возврата заполнен альтернативный ответ о финансовом планировании и росте до следующего сегмента. Смысл требует уточнения; автоматического исключения нет.'}],
  },
};

export const segmentApplicability = Object.fromEntries(Object.values(otherTeamProfiles)
  .filter(profile => profile.type === 'Сегмент')
  .map(profile => {
    const notes = relevanceByName[profile.name] || {excludedMetricCodes: [], evidence: [], reviewOnly: []};
    return [profile.teamId, {...notes, excludedMetricCodes: notes.excludedMetricCodes
      .filter(code => !otherMetricApplicable(profile.metrics.find(metric => metric.code === code)))}];
  }));

export function applySegmentApplicability(catalogue, teamId) {
  const rule = segmentApplicability[teamId];
  if (!rule?.excludedMetricCodes.length) return catalogue;
  const excluded = new Set(rule.excludedMetricCodes);
  const filterQuestion = (question, excludedOptions = new Set()) => {
    if (excluded.has(question.metricCode) || excludedOptions.has(question.whenOption?.option)) return null;
    const blocked = new Set(Object.entries(question.optionMetricCodes || {})
      .filter(([, code]) => excluded.has(code)).map(([option]) => option));
    const next = {...question};
    if (blocked.size) {
      next.optionMetricCodes = Object.fromEntries(Object.entries(question.optionMetricCodes).filter(([option]) => !blocked.has(option)));
      next.options = question.options.filter(option => !blocked.has(option));
      if (question.knownOptions) next.knownOptions = question.knownOptions.filter(option => !blocked.has(option));
      if (question.commentWhen) next.commentWhen = question.commentWhen.filter(option => !blocked.has(option));
    }
    if (question.inlineQuestions) next.inlineQuestions = question.inlineQuestions.map(child => filterQuestion(child, blocked)).filter(Boolean);
    return next;
  };
  return catalogue.map(section => ({...section, questions: section.questions.map(question => filterQuestion(question)).filter(Boolean)}))
    .filter(section => section.questions.length);
}
