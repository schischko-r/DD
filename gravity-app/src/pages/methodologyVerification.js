const SELF_ASSESSMENT = 'Расчёт на основании самооценки PO';
const SELF_ASSESSMENT_AND_TRACES = 'Расчёт на основании самооценки PO с верификацией по цифровым следам';
const DIGITAL_TRACES = 'Расчёт по цифровым следам';
const HYPOTHESES_AND_INITIATIVES = `Расчёт на основании самооценки PO с верификацией по цифровым следам: доля задач аналитиков по продукту, связанных с исследованиями.

Расчёт по цифровым следам:
— наличие дополнительных инициатив в реестре инициатив сверх бизнес-плана;
— оценка исследований по шкале Data-Driven;
— выполнение плана по запуску A/B-тестов.`;

const commonChannelComments = [
  ['Мониторинг: цели, драйверы и прогнозы', '', SELF_ASSESSMENT_AND_TRACES],
  ['Алерты', '', SELF_ASSESSMENT],
  ['Механики', '', SELF_ASSESSMENT],
  ['Гипотезы и инициативы', '', HYPOTHESES_AND_INITIATIVES],
];

const commonSegmentComments = [
  ['Мониторинг: цели, драйверы и прогнозы', '', SELF_ASSESSMENT_AND_TRACES],
  ['Алерты', '', SELF_ASSESSMENT],
  ['Воронка привлечения/оформления', 'Отчетность', SELF_ASSESSMENT],
  ['Воронка привлечения/оформления', 'Анализ', SELF_ASSESSMENT],
  ['Воронка оттока', 'Анализ', SELF_ASSESSMENT],
  ['Механики', '', SELF_ASSESSMENT],
  ['Гипотезы и инициативы', '', HYPOTHESES_AND_INITIATIVES],
];

const commentsByProfile = {
  product: [
    ['Мониторинг: цели, драйверы и прогнозы', '', SELF_ASSESSMENT_AND_TRACES],
    ['Алерты', '', SELF_ASSESSMENT],
    ['Воронка привлечения/оформления', 'Отчетность', SELF_ASSESSMENT],
    ['Воронка привлечения/оформления', 'Анализ', SELF_ASSESSMENT],
    ['Воронка привлечения/оформления', 'Кампейнинг', DIGITAL_TRACES],
    ['Воронка оттока', 'Отчетность', SELF_ASSESSMENT],
    ['Воронка оттока', 'Анализ', SELF_ASSESSMENT],
    ['Механики', '', 'Расчёт на основании самооценки PO.\nВ части cross-sell — верификация по цифровым следам.'],
    ['UX / CX Score', '', DIGITAL_TRACES],
    ['Гипотезы и инициативы', '', HYPOTHESES_AND_INITIATIVES],
  ],
  segment_age: commonSegmentComments,
  segment_income: commonSegmentComments,
  channel_digital: [
    ['Мониторинг: цели, драйверы и прогнозы', '', SELF_ASSESSMENT_AND_TRACES],
    ['Алерты', '', SELF_ASSESSMENT],
    ['Воронка по каналам/поверхностям привлечения', 'Отчетность', SELF_ASSESSMENT],
    ['Воронка онбординга', 'Отчетность', SELF_ASSESSMENT],
    ['Воронка оттока: снижение активности в канале', 'Отчетность', SELF_ASSESSMENT],
    ['Воронка по каналам/поверхностям привлечения', 'Анализ', SELF_ASSESSMENT],
    ['Воронка онбординга', 'Анализ', SELF_ASSESSMENT],
    ['Воронка оттока: снижение активности в канале', 'Анализ', SELF_ASSESSMENT],
    ['Механики', '', SELF_ASSESSMENT],
    ['Гипотезы и инициативы', '', HYPOTHESES_AND_INITIATIVES],
    ['UX / CX Score', '', DIGITAL_TRACES],
  ],
  channel_service: [
    ...commonChannelComments,
    ['Воронка входа в канал', 'Отчетность', SELF_ASSESSMENT],
    ['Воронка входа в канал', 'Анализ', SELF_ASSESSMENT],
  ],
  channel_telemarketing: [
    ...commonChannelComments,
    ['Воронка продаж', 'Отчетность', SELF_ASSESSMENT],
    ['Воронка продаж', 'Анализ', SELF_ASSESSMENT],
  ],
};

export function methodologyVerificationComment(profileKey, title, subgroup = '') {
  const entry = commentsByProfile[profileKey]?.find(([entryTitle, entrySubgroup]) => entryTitle === title && entrySubgroup === subgroup);
  return entry?.[2] || '';
}
