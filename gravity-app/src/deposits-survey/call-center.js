// Вопросы.xlsx, лист «Каналы Phigital»; строки указаны у каждого вопроса.
// Только применимые метрики без цифрового следа, плюс весь блок знания метрик.
// Общие знакомство, приоритеты и поддержка добавляются маршрутом опросника.
export const callCenterSections = [
  {
    id: 'callCenterMetrics',
    title: 'Ключевые метрики',
    description: 'Обращения, FCR и инструменты мониторинга.',
    questions: [
      {
        id: 'ccCalls', row: 17,
        title: 'Укажите среднее за последний квартал количество обращений, поступающих в канал (млн.обращений) (Колл-центр, Чат)',
        type: 'numeric', allowDecimal: true, placeholder: 'Введите число',
      },
      {
        id: 'ccFcr', row: 19,
        title: 'Укажите долю FCR в канале за последний квартал (Колл-центр, Чат)',
        type: 'numeric', allowDecimal: true, placeholder: 'Введите число',
      },
      {
        id: 'ccMonitoring', row: 25,
        title: 'Какими инструментами вы пользуетесь для мониторинга метрик из вопросов выше:',
        type: 'multi',
        options: [
          'Дашборд в Навигаторе (доступны все метрики)',
          'Дашборд в Навигаторе (доступна часть метрик)',
          'Запрашиваете необходимую информацию у аналитиков',
          'Собственная отчетность канала (не Навигатор)',
          'Свой вариант ответа',
          'Затрудняюсь ответить',
        ],
      },
    ],
  },
  {
    id: 'callCenterGoals',
    title: 'Цели, факторный анализ, прогноз',
    description: 'Отчётность, доступная владельцу канала.',
    questions: [
      {
        id: 'ccGoalsReporting', row: 31,
        title: 'Отчетность по целям/драйверам/прогнозам продукта уровня ЛЮ-ЛТ выведена на мониторинг и доступна владельцу продукта',
        type: 'multi',
        options: ['Цели', 'Факторный анализ', 'Прогноз по целям', 'Прогноз по драйверам'],
      },
    ],
  },
  {
    id: 'callCenterEntry',
    title: 'Воронка входа в канал',
    description: 'Состав отчёта по обращениям.',
    questions: [
      {
        id: 'ccEntryIncludes', row: 39,
        title: 'Что включает воронка входа в канал? (Колл-центр, Чат)',
        type: 'multi',
        options: [
          'Пошаговая воронка', 'CR', '% автоматизации', '% отложенных обращений',
          '% закрытых обращений', 'CSAT', 'SL', 'FCR',
          'Что-то еще? Напишите', 'Затрудняюсь ответить',
        ],
      },
      {
        id: 'ccEntryReport', row: 52,
        title: 'Приложите ссылку на отчет воронки входа в канал',
        type: 'text', proof: true, placeholder: 'Ссылка или описание',
        when: 'ccEntryIncludes',
      },
    ],
  },
  {
    id: 'callCenterMechanics',
    title: 'Механики',
    description: 'Механики удержания при обращениях клиентов.',
    questions: [
      {
        id: 'ccChannelMechanics', row: 107,
        title: 'Какие механики настроены по вашему каналу? (Колл-центр, Чат)',
        type: 'multi',
        dividerBefore: 'Не настроены дополнительные механики',
        knownOptions: [
          'Автоматизации (автоклассификация обращений, распределения очередей / сплитов /лидов)',
          'Информирования клиента о статусе обращения',
          'Персонализация скриптов',
          'Контроля качества речи',
        ],
        options: [
          'Автоматизации (автоклассификация обращений, распределения очередей / сплитов /лидов)',
          'Информирования клиента о статусе обращения',
          'Персонализация скриптов',
          'Контроля качества речи',
          'Удержания клиента (при обращении по закрытию продукта клиентом)',
          'Что-то еще? Напишите',
          'Не настроены дополнительные механики',
          'Предложенные варианты неподходят для моего продукта',
          'Затрудняюсь ответить',
        ],
      },
      {
        id: 'ccRetentionMechanic', row: 134,
        title: 'Как работает механика удержания клиента? (Колл-центр, Чат)',
        type: 'multi',
        options: [
          'Настроен спец. сценарий по удержанию по закрытию продукта',
          'Есть механики up-sell (скидка до X% / изменение условий / промокод / подключение доп. сервиса бесплатно / перевод на другой тариф )',
          'Что-то еще? Напишите',
          'Затрудняюсь ответить',
        ],
        whenOption: {
          id: 'ccChannelMechanics',
          option: 'Удержания клиента (при обращении по закрытию продукта клиентом)',
        },
      },
      {
        id: 'ccMechanicsMetrics', row: 138,
        title: 'Опишите метрики, которые вы используете для мониторинга и оценки эффективности работы механики',
        type: 'text', proof: true, placeholder: 'Ссылка или описание',
        when: 'ccRetentionMechanic',
        whenOption: {
          id: 'ccChannelMechanics',
          option: 'Удержания клиента (при обращении по закрытию продукта клиентом)',
        },
      },
    ],
  },
];

// Полный снимок DDI: неизменяемые опросом метрики сохраняются в результате.
const baselineRows = [
  ['general.kolichestvo_obrascheniy', 'Количество обращений', 0.5, 0.5, 1, true, false],
  ['general.fcr', 'FCR', 0.5, 0.5, 1, true, false],
  ['general.obschiy_obъem_ishodyaschego_trafika', 'Общий объем исходящего трафика', 0, 0, 1, false, false],
  ['general.navigator_reporting_knowledge', 'Знание об отчетности в Навигаторе', 0.25, 0.5, 1, true, false],
  ['general.cr_v_prodazhu', 'CR в продажу', 0, 0, 1, false, false],
  ['goals.monitored', 'Цели выведены на мониторинг', 1, 1, 1, true, false],
  ['goals.factor_analysis_l1_l2', 'Факторный анализ - драйверы 1-2 ур.', 1, 1, 1, true, false],
  ['goals.forecast', 'Прогноз по целям', 0.5, 1, 1, true, false],
  ['voronka_vhoda_v_kanal.nastroena_otchetnostь', 'Настроена отчетность', 0.5, 0.5, 1, true, false],
  ['voronka_vhoda_v_kanal.regulyarnostь', 'Регулярность', 1, 1, 0, true, true],
  ['voronka_vhoda_v_kanal.polnota_otcheta', 'Полнота отчета', 0.25, 0.5, 1, true, false],
  ['voronka_vhoda_v_kanal.provedenie_analiza_voronki_vhoda_v_kanal', 'Проведение комплексного анализа воронки входа в канал', 1, 1, 1, true, false],
  ['voronka_vhoda_v_kanal.meropriyatiya_po_rabote_s_otkloneniyami', 'Мероприятия по работе с отклонениями', 1, 1, 1, true, false],
  ['voronka_vhoda_v_kanal.nalichie_benchmarkov', 'Наличие бенчмарков', 1, 1, 1, true, false],
  ['voronka_prodazh.nastroena_otchetnostь', 'Настроена отчетность', 0, 0, 1, false, false],
  ['voronka_prodazh.regulyarnostь', 'Регулярность', 0, 0, 0, false, true],
  ['voronka_prodazh.polnota_otcheta', 'Полнота отчета', 0, 0, 1, false, false],
  ['voronka_prodazh.provedenie_analiza_voronki_prodazh', 'Проведение комплексного анализа воронки продаж', 0, 0, 1, false, false],
  ['alerts.business_metrics', 'Оповещения по бизнес-метрикам', 1, 1, 1, true, false],
  ['alerts.system_failures', 'Оповещения по системным сбоям', 1, 1, 1, true, false],
  ['mehaniki.nalichie_sobstvennyh_mehanik', 'Наличие собственных механик', 0, 0, 1, false, false],
  ['mehaniki.avtomatizacii', 'Автоматизации', 1, 1, 1, true, false],
  ['mehaniki.informirovaniya_klienta', 'Информирования клиента', 1, 1, 1, true, false],
  ['mehaniki.personalizaciya', 'Персонализация', 1, 1, 1, true, false],
  ['mehaniki.kontrolya_kachestva_rechi', 'Контроля качества речи', 1, 1, 1, true, false],
  ['mehaniki.uderzhaniya_klienta', 'Удержания клиента', 0, 1, 1, true, false],
  ['hyp.discovery_40_backlog', 'Discovery >=40% бэклога', 1, 1, 1, true, false],
  ['hyp.datadriven_rating_7_5', 'Оценка исследований >=7,5', 1, 1, 1, true, false],
  ['hyp.ab_tests', 'A/B-тесты', 1, 1, 1, true, false],
  ['hyp.extra_initiatives', 'Доп. инициативы сверх БП', 1, 1, 1, true, false],
];

export const callCenterBaseline = {
  teamId: '83d2bd82-e67b-5432-9c81-604090f9d311¦Колл-центр',
  period: 'II кв. 2026',
  metrics: baselineRows.map(([code, name, value, max_value, dd_calculation_flg, is_applicabble_flg, excluded_from_index]) => ({
    code, name, value, max_value, dd_calculation_flg, is_applicabble_flg, excluded_from_index,
  })),
};

// В доступной декомпозиции backlog-data.json Колл-центра нет. Discovery
// исключён по полному баллу 1/1, а не по признаку уже разобранного бэклога.
export const callCenterBacklogAnalyzed = false;

// Обновляем балл только для вопросов ниже. Остальные оценки остаются из DDI.
export const callCenterScoreRules = [
  {code: 'general.kolichestvo_obrascheniy', questionId: 'ccCalls', kind: 'presence'},
  {code: 'general.fcr', questionId: 'ccFcr', kind: 'presence'},
  {code: 'general.navigator_reporting_knowledge', questionId: 'ccMonitoring', kind: 'navigator'},
  {code: 'goals.forecast', questionId: 'ccGoalsReporting', kind: 'optionSelected', option: 'Прогноз по целям'},
  {code: 'voronka_vhoda_v_kanal.polnota_otcheta', questionId: 'ccEntryIncludes', kind: 'multiFraction', evidenceId: 'ccEntryReport'},
  {
    code: 'mehaniki.uderzhaniya_klienta', questionId: 'ccChannelMechanics',
    kind: 'optionSelected', option: 'Удержания клиента (при обращении по закрытию продукта клиентом)',
    evidenceId: 'ccMechanicsMetrics',
  },
];
