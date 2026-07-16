const SELF_ASSESSMENT = 'Расчет на основании самооценке PO';
const SELF_ASSESSMENT_AND_TRACES = 'Расчет на основании самооценке PO+ верификация по цифровым следам';
const DIGITAL_TRACES = 'Расчет по цифровым следам';
const HYPOTHESES_AND_INITIATIVES = `Расчет на основании самооценке PO/верификация по цифровым следам: Доля задач аналитиков по продукту связанных с исследованиями

Расчет по цифровым следам:
- Наличие доп инициатив в реестре инициатив сверх Бизнес план
- Оценка исследований по шкале DataDriven
- Выполнен план по запуску А/В тестов`;

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
    ['Механики', '', 'Расчет на основании самооценке PO\n- в части cross-sell- верификация по цифровым следам'],
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
