import {previousBacklogs, hasBacklogLinks} from './previous-backlogs.js';
import {teams, CHANNEL_SURVEYS_ENABLED} from './teams.js';
import {callCenterSections, callCenterBaseline, callCenterBacklogAnalyzed} from './call-center.js';
import {productSurveyProfiles} from './survey-profiles.js';
import {hasMetricSource, hasHttpLinks, httpLinkValues} from './metric-source.js';
import {scoringBaseline} from './scoring-baseline.js';
import {previousFunnels, clickstreamOnlyAttraction, previousReportLinks} from './previous-funnels.js';

export const CROSS_SELL_URL = 'https://losshunter.ru/showcase/crosssell/#screen=pult';
const crossSellSection = {
  id: 'crossSell', title: 'Cross-sell',
  questions: [{id: 'crossSellInfo', row: null, type: 'info', title: 'Cross-sell во время оформления продукта',
    description: 'Наличие Cross-sell-механики во время оформления продукта мы забираем по цифровым следам с платформы LossHunter. Статус по своему продукту вы сможете посмотреть после прохождения опроса и изменить его при необходимости.',
    emphasis: ['сможете посмотреть', 'после прохождения опроса']},
    {id: 'crossSellAfter', row: null, type: 'radio',
      title: 'Настроена ли у вас механика Cross-sell после оформления продукта?',
      options: ['Да', 'Нет', 'Затрудняюсь ответить'],
      inlineProof: {id: 'crossSellAfterProduct', row: null, appearance: 'base',
        title: 'С какими продуктами настроена механика Cross-sell?', placeholder: 'Укажите продукты'},
    }],
};

// Формулировки и варианты дословно из Вопросы.xlsx, лист «Продукты (2)».
// Строки 80 и 83 повторены для отдельных ответов по привлечению и оттоку.
export const sections = [
  {
    "id": "intro",
    "title": "Знакомство",
    "description": "Начнём с вас и вашего продукта.",
    "questions": [
      {
        "id": "name",
        "row": 3,
        "title": "Представьтесь, пожалуйста",
        "type": "input",
        "placeholder": "Введите ФИО"
      },
      {
        "id": "product",
        "row": 4,
        "title": "Выберите вашу команду",
        "type": "select"
      }
    ]
  },
  {
    "id": "metrics",
    "title": "Ключевые метрики",
    "description": "Рынок, клиентская база и инструменты мониторинга.",
    "introNote": "В рамках проекта «Единые клиентские метрики» формировалась единая сквозная методология клиентских метрик и доступного потенциального рынка.",
    "questions": [
      {
        "id": "marketRussia",
        "row": 15,
        "title": "Укажите общий объем целевого рынка вашего продукта в России (клиентов)",
        "type": "numeric",
        "placeholder": "Введите число"
      },
      {
        "id": "marketSber",
        "row": 17,
        "title": "Напишите доступный объем рынка в Сбере (клиентов)",
        "detail": "Количество клиентов в Сбере, которых продукт реально может охватить с учетом текущей бизнес-модели.",
        "type": "numeric",
        "placeholder": "Введите число"
      },
      {
        "id": "clients",
        "row": 19,
        "title": "Сколько клиентов банка уже имеет этот продукт?",
        "type": "numeric",
        "placeholder": "Введите число"
      },
      {
        "id": "mau",
        "row": 21,
        "title": "Какое MAU у вашего продукта?",
        "type": "numeric",
        "placeholder": "Введите число"
      },
      {
        "id": "satellite",
        "row": 23,
        "title": "Какой основной продукт-спутник вашего продукта?",
        "type": "input",
        "placeholder": "Введите ответ"
      },
      {
        "id": "monitoring",
        "row": 24,
        "title": "Какими инструментами вы пользуетесь для мониторинга метрик из вопросов выше:",
        "type": "multi",
        "options": [
          "Дашборд в Навигаторе (доступны все метрики)",
          "Дашборд в Навигаторе (доступна часть метрик)",
          "Запрашиваете необходимую информацию у аналитиков",
          "Собственная отчетность продукта (не Навигатор)",
          "Свой вариант ответа",
          "Затрудняюсь ответить"
        ]
      }
    ]
  },
  {
    "id": "attract",
    "title": "Воронка привлечения",
    "description": "Состав отчёта и анализ точек роста за последний квартал.",
    "questions": [
      {
        "id": "attractIncludes",
        "row": 38,
        "title": "Укажите, что еще включает отчет по воронке привлечения?",
        "type": "multi",
        "inlineEvidence": {"id": "attractReport", "formatId": "attractReportFormat", "row": 56},
        "options": [
          "Источники привлечения (самоходы, внешние привлечения, кампейнинг, кросс-перетоки)",
          "Пошаговая воронка (CJM клиентский путь)",
          "CR (% конверсии)",
          "Объёмы",
          "Механики привлечения (кампании, кросс-селл)",
          "Сегментный/ кагортный разрез",
          "UX/UI-дизайн",
          "Затрудняюсь ответить"
        ]
      },
      {
        "id": "attractAnalysis",
        "row": 49,
        "title": "Проводился ли за последний квартал анализ воронки привлечения?",
        "type": "multi",
        "inlineEvidence": {"id": "attractReport", "formatId": "attractReportFormat", "row": 56, "evidenceWhenAbsent": "attractIncludes"},
        "options": [
          "Анализ процесса оформления продукта: экраны в СБОЛ, клиентский путь в физическом канале",
          "Сравнение с конкурентами процесса оформления продукта, условий продукта или мониторинг новых фичей",
          "По кампаниям продаж: воронка внутри кампаний, количество достигших целевого действия, оценка результативности компаний",
          "Выявление ключевых точек потери клиентов - составлен ТОР 3 факторов и причин",
          "Все перечисленное выше",
          "Не проводился",
          "Затрудняюсь ответить"
        ]
      },
      {
        "id": "attractReport",
        "row": 56,
        "inlineOnly": true,
        "title": "Приложите ссылку на отчет воронки привлечения/опишите",
        "type": "text",
        "proof": true,
        "placeholder": "Ссылка или описание",
        "whenAny": [
          "attractIncludes",
          "attractAnalysis"
        ]
      }
    ]
  },
  {
    "id": "churn",
    "title": "Воронка оттока",
    "description": "Что измеряете при уходе клиентов и какие причины изучаете.",
    "questions": [
      {
        "id": "churnIncludes",
        "row": 61,
        "title": "Укажите, что еще включает отчет по воронке оттока?",
        "type": "multi",
        "inlineEvidence": {"id": "churnReport", "formatId": "churnReportFormat", "row": 79},
        "options": [
          "Пошаговую воронку",
          "CR (% оттока)",
          "Объёмы",
          "Сегментный/ кагортный разрез",
          "Когортный retention",
          "Механики удержания (кампании, контр-оффер)",
          "UX/UI-дизайн",
          "Затрудняюсь ответить"
        ]
      },
      {
        "id": "churnAnalysis",
        "row": 72,
        "title": "Проводился ли за последний квартал анализ воронки оттока?",
        "type": "multi",
        "inlineEvidence": {"id": "churnReport", "formatId": "churnReportFormat", "row": 79, "evidenceWhenAbsent": "churnIncludes"},
        "options": [
          "Анализ процесса закрытия продукта: экраны в СБОЛ, клиентский путь в физическом канале",
          "Сравнение с конкурентами процесса закрытия продукта, условий продукта или мониторинг новых фичей",
          "По кампаниям продаж: воронка внутри кампаний, количество достигших целевого действия, оценка результативности компаний",
          "Выявление ключевых точек потрери клиентов - составлен ТОР 3 фактора и причины",
          "Все перечисленное выше",
          "Не проводился",
          "Затрудняюсь ответить"
        ]
      },
      {
        "id": "churnReport",
        "inlineOnly": true,
        "row": 79,
        "title": "Приложите ссылку на отчет воронки оттока/опишите",
        "type": "text",
        "proof": true,
        "placeholder": "Ссылка или описание",
        "whenAny": [
          "churnIncludes",
          "churnAnalysis"
        ]
      }
    ]
  },
  {
    "id": "benchmarks",
    "title": "Бенчмарки",
    "description": "Ориентиры, с которыми сравниваете результаты воронок.",
    "questions": [
      {
        "id": "benchmarksAttract",
        "row": 80,
        "title": "Есть ли бенчмарки по метрикам воронок привлечения?",
        "type": "radio",
        "inlineProof": {"id": "benchmarkAttractProof", "row": 83, "title": "Опишите, какие бенчмарки используются", "placeholder": "Введите описание"},
        "options": [
          "Да",
          "Нет",
          "Затрудняюсь ответить"
        ],
        "scope": "Привлечение"
      },
      {
        "id": "benchmarkAttractProof",
        "inlineOnly": true,
        "row": 83,
        "title": "Опишите, какие бенчмарки используются",
        "type": "text",
        "proof": true,
        "placeholder": "Введите описание",
        "when": "benchmarksAttract",
        "scope": "Привлечение"
      },
      {
        "id": "benchmarksChurn",
        "inlineProof": {"id": "benchmarkChurnProof", "row": 83, "title": "Опишите, какие бенчмарки используются", "placeholder": "Введите описание"},
        "row": 80,
        "title": "Есть ли бенчмарки по метрикам воронок оттока?",
        "type": "radio",
        "options": [
          "Да",
          "Нет",
          "Затрудняюсь ответить"
        ],
        "scope": "Отток"
      },
      {
        "id": "benchmarkChurnProof",
        "inlineOnly": true,
        "row": 83,
        "title": "Опишите, какие бенчмарки используются",
        "type": "text",
        "proof": true,
        "placeholder": "Введите описание",
        "when": "benchmarksChurn",
        "scope": "Отток"
      }
    ]
  },
  {
    "id": "actions",
    "title": "Работа с отклонениями",
    "description": "Какие действия следуют за анализом оттока.",
    "questions": [
      {
        "id": "deviations",
        "row": 88,
        "title": "Есть ли задачи/мероприятия по работе с отклонениями по воронке оттока?",
        "type": "radio",
        "options": [
          "Да",
          "Нет",
          "Затрудняюсь ответить"
        ]
      },
      {
        "id": "deviationExample",
        "row": 91,
        "title": "Приведите пример задачи/мероприятия за последний квартал",
        "type": "text",
        "proof": true,
        "placeholder": "Ссылка или описание",
        "when": "deviations"
      }
    ]
  },
  {
    "id": "alerts",
    "title": "Оповещения",
    "description": "Как команда узнаёт об изменениях бизнес-метрик.",
    "questions": [
      {
        "id": "alerts",
        "row": 96,
        "title": "Настроены ли автоматические оповещения по ключевым бизнес-метрикам?",
        "type": "radio",
        "options": [
          "Да",
          "Частично",
          "Нет",
          "Затрудняюсь ответить"
        ]
      }
    ]
  },
  {
    "id": "mechanics",
    "title": "Продуктовые механики",
    "description": "Механики удержания и возврата клиентов, а также допродаж.",
    "questions": [
      {
        "id": "upsell",
        "row": 100,
        "title": "Какие продуктовые механики настроены по вашему продукту?",
        "type": "multi",
        "inlineQuestions": [
          {"id": "retentionMechanism", "row": null, "type": "multi", "inlineAtOption": true,
           "title": "Как работает механика удержания клиентов?",
           "whenOption": {"id": "upsell", "option": "Удержание клиентов"},
           "options": ["Информационная коммуникация", "Создание ценности", "Что-то еще? Напишите", "Затрудняюсь ответить"]},
          {"id": "returnMechanism", "row": null, "type": "multi", "inlineAtOption": true,
           "title": "Как работает механика возврата?",
           "whenOption": {"id": "upsell", "option": "Возврат клиентов"},
           "options": ["Информационная коммуникация", "Создание ценности", "Что-то еще? Напишите", "Затрудняюсь ответить"]}
        ],
        "commentId": "mechanics",
        "commentWhen": ["Удержание клиентов", "Возврат клиентов", "Допродажи (upsell)"],
        "dividerBefore": "Не настроены дополнительные механики",
        "options": [
          "Удержание клиентов",
          "Возврат клиентов",
          "Допродажи (upsell)",
          "Не настроены дополнительные механики",
          "Затрудняюсь ответить"
        ]
      },
      {
        "id": "mechanics",
        "row": 105,
        "inlineOnly": true,
        "title": "Какие продуктовые механики применяете вы?",
        "type": "text",
        "when": "upsell",
        "placeholder": "Введите ответ"
      }
    ]
  },
  crossSellSection,
  {
    "id": "research",
    "title": "Исследования",
    "description": "Исследовательские задачи и бэклог аналитиков данных.",
    "questions": [
      {
        "id": "discovery",
        "row": 115,
        "title": "Какая доля задач аналитиков данных (DA) в бэклоге связана с исследованиями?",
        "type": "radio",
        "inlineQuestions": [{
          "id": "discoveryBacklogType", "row": 121, "type": "radio", "when": "discovery",
          "title": "Как ведётся бэклог задач аналитиков данных?",
          "options": ["Собственный бэклог в Jira/SberTrack", "Задачи ведет Штаб в Jira/SberTrack", "Бэклог ведется вне Jira/SberTrack"],
          "inlineProof": {"id": "backlog", "row": 121, "kind": "backlog", "whenAnswer": "Собственный бэклог в Jira/SberTrack",
            "title": "Приложите ссылку на бэклог", "placeholder": "Ссылка на бэклог в Jira/SberTrack"},
          "optionalCommentId": "discoveryBacklogComment",
          "optionalCommentWhen": ["Задачи ведет Штаб в Jira/SberTrack", "Бэклог ведется вне Jira/SberTrack"],
          "optionalCommentTitles": {"Задачи ведет Штаб в Jira/SberTrack": "ФИО сотрудников при необходимости", "Бэклог ведется вне Jira/SberTrack": "Комментарий при необходимости"},
          "optionalCommentPlaceholder": "Введите комментарий"
        }],
        "options": [
          "Больше 80%",
          "От 40 до 79%",
          "От 20 до 39%",
          "Меньше 20%",
          "Нет аналитиков",
          "Затрудняюсь ответить"
        ],

      },
      {
        "id": "backlog",
        "inlineOnly": true,
        "row": 121,
        "title": "Приложите ссылку на бэклог задач аналитиков данных (DA) в Jira/SberTrack",
        "type": "text",
        "proof": true,
        "placeholder": "Ссылка или описание",
        "when": "discovery"
      },
      {
        "id": "lastResearch",
        "row": 122,
        "title": "Какое последнее исследование вы проводили?",
        "type": "text",
        "placeholder": "Введите ответ"
      }
    ]
  },
  {
    "id": "priorities",
    "title": "Приоритеты и поддержка",
    "description": "На чём сосредоточитесь дальше и что поможет команде.",
    "questions": [
      {
        "id": "priorities",
        "row": 123,
        "title": "Ваши фокусные data driven направления на следующий квартал",
        "type": "multi",
        "options": [
          "Базовая отчетность по продукту (цели, драйверы, прогнозы)",
          "Мониторинг и анализ воронок (привлечение/отток)",
          "Система оповещений",
          "Продуктовые механики",
          "А/В тесты",
          "Исследования/инициативы",
          "Что-то еще? Напишите",
          "Затрудняюсь ответить"
        ]
      },
      {
        "id": "support",
        "row": 131,
        "title": "Каких инструментов или какой поддержки не хватает вам для повышения уровня data driven вашего продукта?",
        "type": "multi",
        "optionGroups": [
          {"title": "Аналитические ресурсы", "column": 0, "gridRow": "1", "indices": [0, 1]},
          {"title": "Инструменты и BI", "column": 1, "gridRow": "1", "indices": [2, 3]},
          {"title": "Данные и витрины", "column": 0, "gridRow": "2 / 4", "indices": [4, 5]},
          {"title": "Автоматизация мониторинга", "column": 1, "gridRow": "2", "indices": [6]},
          {"title": "A/B и ресерч", "column": 1, "gridRow": "3", "alignEnd": true, "indices": [7]},
          {"title": "Другое", "column": 0, "gridRow": "4", "indices": [8]}
        ],
        "options": [
          "Нехватка аналитических ресурсов (DA/DS/DE)",
          "Низкая автоматизация отчетности, долгие сроки",
          "Технические ограничения BI-платформы",
          "Отсутствие Self-Service BI",
          "Трудоемкий процесс вывода витрин",
          "Низкое качество данных",
          "Отсутствие алертов, нет авто-мониторинга",
          "Инструментарий платформы A/B",
          "Другое"
        ]
      }
    ]
  }
];

const sourceQuestion = id => sections.flatMap(section => section.questions).find(q => q.id === id);
const productMetric = (profile, code) => profile.metrics.find(metric => metric.code === code);
const applicable = metric => metric && metric.is_applicabble_flg !== false && !metric.excluded_from_index &&
  Number(metric.dd_calculation_flg) !== 0 && Number(metric.max_value) > 0;
export const quarterlyAnalysisCodes = ['attract.funnel_analysis', 'churn.funnel_analysis'];
const needsSurvey = (profile, code) => {
  const metric = productMetric(profile, code);
  return applicable(metric) && (quarterlyAnalysisCodes.includes(code)
    || Number(metric.value) < Number(metric.max_value));
};

// Дополнительные исходные вопросы листа «Продукты (2)», которых нет в пилоте вкладов.
const extraProductQuestions = {
  attractConfigured: {id: 'attractConfigured', row: 34, title: 'Настроена ли регулярная отчётность по воронке привлечения?',
    type: 'radio', options: ['Да', 'Нет', 'Не релевантно для вашего продукта (в комментарии укажите, почему?)', 'Затрудняюсь ответить'],
    reasonId: 'attractConfiguredReason', reasonWhen: 'Не релевантно для вашего продукта (в комментарии укажите, почему?)',
    inlineEvidence: {id: 'attractReport', formatId: 'attractReportFormat', row: 56}},
  churnConfigured: {id: 'churnConfigured', row: 57, title: 'Настроена ли регулярная отчётность по воронке оттока?',
    type: 'radio', options: ['Да, автоматическая (monthly/weekly)', 'Да, по запросу', 'Нет', 'Затрудняюсь ответить'],
    inlineEvidence: {id: 'churnReport', formatId: 'churnReportFormat', row: 79}},
  attractDeviations: {id: 'attractDeviations', row: 84, title: 'Есть ли задачи/мероприятия по работе с отклонениями по воронке привлечения?',
    type: 'radio', options: ['Да', 'Нет', 'Затрудняюсь ответить']},
  attractDeviationExample: {id: 'attractDeviationExample', row: 87, title: 'Приведите пример задачи/мероприятия за последний квартал',
    type: 'text', proof: true, placeholder: 'Ссылка или описание', when: 'attractDeviations'},
  systemAlerts: {id: 'systemAlerts', row: 92, title: 'Настроены ли автоматические оповещения по системным сбоям?',
    sectionDescription: 'Системный сбой — это техническая проблема в работе продукта: недоступность сервиса, ошибки или задержки при выполнении операций, сбои API и интеграций. Оповещения помогают команде быстро узнать о таких проблемах.',
    type: 'radio', options: ['Да', 'Частично', 'Нет', 'Затрудняюсь ответить']},
  mechanicsMonitoring: {id: 'mechanicsMonitoring', row: 114, title: 'Опишите метрики, которые вы используете для мониторинга и оценки эффективности работы механики',
    type: 'text', placeholder: 'Введите ответ'},
};

// Пул мероприятий спрашиваем каждый квартал независимо от прошлого балла.
function actionQuestions(profile) {
  return [
    ['attract.initiatives_list', 'attractDeviations', 'attractDeviationExample', 'привлечения', 84, 87],
    ['churn.deviation_actions', 'deviations', 'deviationExample', 'оттока', 88, 91],
  ].flatMap(([code, id, exampleId, direction, row, proofRow]) => {
    const metric = productMetric(profile, code);
    if (!applicable(metric)) return [];
    const scope = direction === 'привлечения' ? 'Привлечение' : 'Отток';
    const questions = [];
    questions.push({id, row, scope, type: 'radio',
      title: `Есть ли задачи/мероприятия по работе с отклонениями по воронке ${direction} в текущем квартале?`,
      options: ['Да', 'Нет', 'Затрудняюсь ответить'],
      inlineEvidence: {id: `${exampleId}Report`, formatId: `${exampleId}ReportFormat`, row: proofRow,
        title: 'Пожалуйста, приложите ссылки на мероприятия в прошедшем квартале',
        formats: [{value: 'jira', label: 'Ссылка на задачу в Jira/ST'}, {value: 'confluence', label: 'Ссылка на Confluence'}, {value: 'other', label: 'Другое'}],
        label: `Материалы по мероприятиям ${direction} в прошедшем квартале`},
    });
    return questions;
  });
}

export function inlineQuestions(question, answers) {
  return (question.inlineQuestions || []).filter(q => !answers ||
    ((!q.when || indicatesPresence(answers[q.when])) &&
      (!q.whenOption || (Array.isArray(answers[q.whenOption.id])
        ? answers[q.whenOption.id].includes(q.whenOption.option)
        : answers[q.whenOption.id] === q.whenOption.option))));
}

// Для SberID и «Почта, Диск, Календарь» применим отдельный лист «Data».
// Формулировка DAU адаптирована с «канала» на «продукта»; источник сохранён.
const dataProductQuestions = {
  dau: {id: 'dau', sheet: 'Data', row: 23, adaptedFrom: 'Какое DAU у вашего канала?', accuracyReview: true,
    title: 'Какое DAU у вашего продукта?', type: 'numeric', placeholder: 'Введите число'},
  yau: {id: 'yau', sheet: 'Data', row: 25, title: 'Какое YAU у вашего продукта?', type: 'numeric', placeholder: 'Введите число'},
  dauMau: {id: 'dauMau', sheet: 'Data', row: 27, title: 'Какое DAU/MAU (липкость) у вашего продукта?',
    type: 'numeric', allowDecimal: true, placeholder: 'Введите число'},
  monitoring: {id: 'monitoring', sheet: 'Data', row: 29, title: 'Какими инструментами вы пользуетесь для мониторинга метрик из вопросов выше:',
    type: 'multi', options: ['Дашборд в Навигаторе (доступны все метрики)', 'Дашборд в Навигаторе (доступна часть метрик)',
      'Запрашиваете необходимую информацию у аналитиков', 'Собственная отчетность продукта (не Навигатор)',
      'Свой вариант ответа', 'Затрудняюсь ответить']},
  qualityTools: {id: 'qualityTools', sheet: 'Data', row: 35,
    title: 'Какие инструменты вы используете для проверки качества данных для построения аналитики по вашему продукту?',
    type: 'multi', options: ['Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе',
      'Собственная система мониторинга качества данных', 'Ручная проверка аналитиками (сверка с первичными источниками, выгрузки)',
      'Проверка на стороне источника данных (DWH, витрины) силами data-инженеров',
      'Не используем специальные инструменты — доверяем источнику', 'Свой вариант ответа', 'Затрудняюсь ответить']},
  usageConfigured: {id: 'usageConfigured', sheet: 'Data', row: 53, title: 'Настроена ли регулярная отчётность по воронке использования?',
    type: 'radio', options: ['Да', 'Нет', 'Не релевантно для моего продукта', 'Затрудняюсь ответить'],
    adaptedFrom: 'Не релевантно для моего канала', accuracyReview: true,
    inlineEvidence: {id: 'usageReport', formatId: 'usageReportFormat', row: 68}},
  usageIncludes: {id: 'usageIncludes', sheet: 'Data', row: 57, title: 'Что включает воронка использования?',
    type: 'multi', options: ['Каналы привлечения', 'Пошаговая воронка', 'CR и CTR', 'Объёмы коммуникаций',
      'Количество целевых действий', 'Сегментный/ кагортный разрез', 'UX/UI-дизайн', 'Затрудняюсь ответить'],
    inlineEvidence: {id: 'usageReport', formatId: 'usageReportFormat', row: 68}},
  usageAnalysis: {id: 'usageAnalysis', sheet: 'Data', row: 115, title: 'Проводился ли за последний квартал анализ воронки использования?',
    type: 'multi', options: ['Сравнение с конкурентами процесса оформления продукта, условий продукта или мониторинг новых фичей',
      'По кампаниям продаж: воронка внутри кампаний, количество достигших целевого действия, оценка результативности компаний',
      'A/B тесты', 'Сегментный/Когортный анализ', 'UX/UI воронки целевых действий', 'Что-то еще? Напишите',
      'Все перечисленное выше', 'Не проводился', 'Затрудняюсь ответить'],
    inlineEvidence: {id: 'usageReport', formatId: 'usageReportFormat', row: 68}},
  churnConfigured: {id: 'churnConfigured', sheet: 'Data', row: 85,
    title: 'Настроена ли регулярная отчётность по воронке оттока (анализа снижения активности в продукте)?',
    type: 'radio', options: ['Да, автоматическая (monthly/weekly)', 'Да, по запросу', 'Нет', 'Затрудняюсь ответить'],
    adaptedFrom: ['Настроена ли регулярная отчётность по воронке оттока (анализа снижения активности в канале)?', 'Не релевантно для моего канала'], accuracyReview: true,
    inlineEvidence: {id: 'churnReport', formatId: 'churnReportFormat', row: 100}},
  churnIncludes: {id: 'churnIncludes', sheet: 'Data', row: 89,
    title: 'Что включает воронка оттока (анализа снижения активности в продукте)?',
    adaptedFrom: 'Что включает воронка оттока (анализа снижения активности в канале)?', accuracyReview: true,
    type: 'multi', options: ['Сегментный/когортный разрез', 'Когортный retention', 'Механики удержания', '% оттока', 'Затрудняюсь ответить'],
    inlineEvidence: {id: 'churnReport', formatId: 'churnReportFormat', row: 100}},
  churnAnalysis: {id: 'churnAnalysis', sheet: 'Data', row: 128,
    title: 'Проводился ли за последний квартал анализ воронки оттока (снижения активности в продукте)?',
    adaptedFrom: ['Проводился ли за последний квартал анализ воронки оттока (снижения активности в канале)?', 'Анализ процесса использования канала: количество проведенного времени, количество просмотренных страниц, отзывы'], accuracyReview: true,
    type: 'multi', options: ['Анализ процесса использования продукта: количество проведенного времени, количество просмотренных страниц, отзывы',
      'Выявление ключевых точек потери клиентов - составлен ТОР 3 фактора и причины', 'Сегментный/когортный анализ',
      'A/B тесты', 'Что-то еще? Напишите', 'Все перечисленное выше', 'Не проводился', 'Затрудняюсь ответить'],
    inlineEvidence: {id: 'churnReport', formatId: 'churnReportFormat', row: 100}},
  uxAlerts: {id: 'uxAlerts', sheet: 'Data', row: 147,
    title: 'Настроены ли автоматические оповещения по проблемам, связанным с UX и пользовательскому опыту?',
    type: 'radio', options: ['Да', 'Частично', 'Нет', 'Затрудняюсь ответить']},
  businessAlerts: {id: 'alerts', sheet: 'Data', row: 151,
    title: 'Настроены ли автоматические оповещения по ключевым бизнес-метрикам?',
    type: 'radio', options: ['Да', 'Частично', 'Нет', 'Затрудняюсь ответить']},
};

function productSections(profile) {
  const has = code => needsSurvey(profile, code);
  const specialData = profile.teamId.endsWith('¦SberID') || profile.teamId.endsWith('¦Почта, Диск, Календарь');
  const knowledgeCodes = {
    marketRussia: 'general.obъem_celevogo_rynka_v_rossii',
    marketSber: 'general.obъem_celevogo_rynka_v_sbere',
    clients: 'general.klienty_s_produktom',
    mau: 'general.mau_produkta',
    satellite: 'general.znanie_produktov_sputnikov',
    monitoring: 'general.navigator_reporting_knowledge',
  };
  const metrics = Object.entries(knowledgeCodes).filter(([, code]) => applicable(productMetric(profile, code)))
    .map(([id]) => specialData && id === 'monitoring' ? dataProductQuestions.monitoring : sourceQuestion(id));
  if (specialData) {
    const extra = [
      ['dau', 'general.dau_produkta'], ['yau', 'general.yau_produkta'], ['dauMau', 'general.dau_mau'],
    ].filter(([, code]) => applicable(productMetric(profile, code))).map(([id]) => dataProductQuestions[id]);
    const monitoringIndex = metrics.findIndex(q => q.id === 'monitoring');
    metrics.splice(monitoringIndex < 0 ? metrics.length : monitoringIndex, 0, ...extra);
  }
  const result = [sections[0], {...sections[1], questions: metrics}];
  if (specialData && has('dannye.kontrolь_kachestva_dannyh_kkd')) {
    result.push({id: 'dataQuality', title: 'Качество данных', description: 'Инструменты контроля качества.',
      questions: [dataProductQuestions.qualityTools]});
  }

  const funnelGroup = (prefix, configured, includes, analysis, proof) => {
    const questions = [];
    if (has(`${prefix}.nastroena_otchetnostь`)) questions.push(extraProductQuestions[configured]);
    if (has(`${prefix}.report_completeness`)) {
      const q = sourceQuestion(includes);
      questions.push({...q, inlineEvidence: {...q.inlineEvidence,
        evidenceWhenAbsent: questions.length ? configured : undefined}});
    }
    if (has(`${prefix}.funnel_analysis`)) {
      const q = sourceQuestion(analysis);
      questions.push({...q, inlineEvidence: {...q.inlineEvidence,
        evidenceWhenAbsent: questions.filter(item => item.inlineEvidence).map(item => item.id)}});
    }
    if (questions.length) questions.push(sourceQuestion(proof));
    return questions;
  };
  if (specialData) {
    const usage = [];
    if (has('attract.nastroena_otchetnostь')) usage.push(dataProductQuestions.usageConfigured);
    if (has('voronka_ispolьzovaniya.polnota_otcheta') || has('attract.report_completeness')) usage.push(dataProductQuestions.usageIncludes);
    if (has('attract.provedenie_kompleksnogo_analiza_voronki_ispolьzovaniya')) usage.push(dataProductQuestions.usageAnalysis);
    if (usage.length) {
      const seen = [];
      result.push({id: 'usage', title: 'Воронка использования', description: 'Состав и анализ воронки использования.',
        questions: usage.map(q => {
          const entry = {...q, inlineEvidence: {...q.inlineEvidence, evidenceWhenAbsent: [...seen]}};
          seen.push(q.id);
          return entry;
        })});
    }
    const churn = [];
    if (has('churn.nastroena_otchetnostь')) churn.push(dataProductQuestions.churnConfigured);
    if (has('churn.report_completeness')) churn.push(dataProductQuestions.churnIncludes);
    if (has('churn.funnel_analysis')) churn.push(dataProductQuestions.churnAnalysis);
    if (churn.length) {
      const seen = [];
      result.push({id: 'churn', title: 'Воронка оттока', description: 'Снижение активности в продукте.',
        questions: churn.map(q => {
          const entry = {...q, inlineEvidence: {...q.inlineEvidence, evidenceWhenAbsent: [...seen]}};
          seen.push(q.id);
          return entry;
        })});
    }
  } else {
    const attract = funnelGroup('attract', 'attractConfigured', 'attractIncludes', 'attractAnalysis', 'attractReport');
    if (attract.length) result.push({...sections.find(s => s.id === 'attract'), questions: attract});
    const churn = funnelGroup('churn', 'churnConfigured', 'churnIncludes', 'churnAnalysis', 'churnReport');
    if (churn.length) result.push({...sections.find(s => s.id === 'churn'), questions: churn});
  }

  const benchmarks = sections.find(s => s.id === 'benchmarks').questions.filter(q =>
    (q.id.includes('Attract') && has('attract.benchmarks')) ||
    (q.id.includes('Churn') && has('churn.benchmarks')));
  if (benchmarks.length) result.push({...sections.find(s => s.id === 'benchmarks'), questions: benchmarks});
  const actions = actionQuestions(profile);
  if (actions.length) result.push({...sections.find(s => s.id === 'actions'), questions: actions});
  const alerts = [];
  if (has('alerts.system_failures')) alerts.push(extraProductQuestions.systemAlerts);
  if (specialData && has('alerts.opovescheniya_po_problemam_svyazannym_s_ux_ui')) alerts.push(dataProductQuestions.uxAlerts);
  if (has('alerts.business_metrics')) alerts.push(specialData ? dataProductQuestions.businessAlerts : sourceQuestion('alerts'));
  if (alerts.length) result.push({...sections.find(s => s.id === 'alerts'), questions: alerts});
  if (['mehaniki.uderzhanie_klientov', 'mehaniki.vozvrat_klientov', 'mehaniki.doprodazhi_up_sell'].some(has)) {
    result.push(sections.find(s => s.id === 'mechanics'));
  }
  if (has('mehaniki.monitoring_mehanik')) {
    const index = result.findIndex(s => s.id === 'mechanics');
    if (index < 0) result.push({id: 'mechanics', title: 'Продуктовые механики', description: 'Мониторинг механик.', questions: [extraProductQuestions.mechanicsMonitoring]});
    else result[index] = {...result[index], questions: [...result[index].questions, extraProductQuestions.mechanicsMonitoring]};
  }
  result.push(crossSellSection);
  if (applicable(productMetric(profile, 'hyp.discovery_40_backlog')) && !previousBacklogs[profile.teamId]) {
    const research = sections.find(s => s.id === 'research');
    result.push({...research, questions: research.questions.filter(q => q.id !== 'lastResearch')});
  }
  result.push(sections.find(s => s.id === 'priorities'));
  return result;
}

// Команда определяет набор вопросов; первоначальный каталог вкладов сохранён.
function baseSections(answers = {}) {
  const productProfile = productSurveyProfiles[answers.product];
  if (productProfile && answers.product !== scoringBaseline.teamId) return productSections(productProfile);
  if (!CHANNEL_SURVEYS_ENABLED || answers.product !== callCenterBaseline.teamId) {
    if (!productProfile) return sections;
    return sections.map(section => section.id === 'actions'
      ? {...section, description: 'Мероприятия привлечения и оттока и их результаты.', questions: actionQuestions(productProfile)}
      : section);
  }
  const common = sections.find(section => section.id === 'priorities');
  const finalSection = {...common, questions: common.questions.map(q => q.id === 'priorities'
    ? {...q, sheet: 'Каналы Phigital', row: 147, options: q.options.map(option => option.replace('по продукту', 'по каналу'))}
    : {...q, sheet: 'Каналы Phigital', row: 155, title: q.title.replace('вашего продукта', 'вашего канала')})};
  return [sections[0], ...callCenterSections, finalSection];
}

function embedBenchmarks(catalogue) {
  const benchmarks = catalogue.find(section => section.id === 'benchmarks')?.questions.filter(q => !q.inlineOnly) || [];
  const result = catalogue.filter(section => section.id !== 'benchmarks').map(section => ({...section, questions: [...section.questions]}));
  for (const benchmark of benchmarks) {
    const direction = benchmark.id === 'benchmarksAttract' ? 'attract' : 'churn';
    let section = result.find(section => section.id === direction || (direction === 'attract' && section.id === 'usage'));
    if (!section) {
      section = {...sections.find(section => section.id === direction), questions: []};
      const insertion = result.findIndex(section => !['intro', 'metrics', 'dataQuality', 'attract', 'usage', 'churn'].includes(section.id));
      result.splice(insertion < 0 ? result.length : insertion, 0, section);
    }
    let parent = section.questions.find(q => q.id === `${direction}Includes` || (direction === 'attract' && q.id === 'usageIncludes'));
    if (!parent) {
      const source = sourceQuestion(`${direction}Includes`);
      parent = {id: source.id, row: source.row, title: `Есть ли бенчмарки по воронке ${direction === 'attract' ? 'привлечения' : 'оттока'}?`, type: 'radio', options: ['Да', 'Нет', 'Затрудняюсь ответить'], benchmarkOnly: true};
      section.questions.push(parent);
    }
    section.questions = section.questions.map(q => q.id === parent.id ? {...q,
      options: q.benchmarkOnly ? ['Да', 'Нет', 'Затрудняюсь ответить'] : [...q.options.filter(option => option !== 'Затрудняюсь ответить'), 'Бенчмарки', 'Затрудняюсь ответить'],
      benchmark, inlineProof: benchmark.inlineProof} : q);
  }
  return result;
}

function embedActions(catalogue) {
  const result = catalogue.map(section => ({...section, questions: [...section.questions]}));
  const actions = result.find(section => section.id === 'actions');
  if (!actions) return result;
  for (const [id, direction, label] of [
    ['attractDeviations', 'attract', 'привлечением'], ['deviations', 'churn', 'оттоком'],
  ]) {
    const action = actions.questions.find(q => q.id === id);
    if (!action) continue;
    const option = `Зафиксирован пул мероприятий по работе с ${label}`;
    let section = result.find(s => s.id === direction || (direction === 'attract' && s.id === 'usage'));
    if (!section) {
      section = {...sections.find(s => s.id === direction), questions: []};
      result.splice(result.indexOf(actions), 0, section);
    }
    let parent = section.questions.find(q => q.id === `${direction}Analysis` || (direction === 'attract' && q.id === 'usageAnalysis'));
    if (!parent) {
      const source = sourceQuestion(`${direction}Analysis`);
      parent = {id: source.id, row: source.row, title: source.title, type: 'multi', options: ['Затрудняюсь ответить'], actionOnly: true};
      section.questions.push(parent);
    }
    const metadata = action;
    section.questions = section.questions.map(q => q.id === parent.id ? {...q,
      options: [...q.options.filter(value => !['Все перечисленное выше', 'Не проводился', 'Затрудняюсь ответить'].includes(value)), option,
        ...q.options.filter(value => ['Все перечисленное выше', 'Не проводился', 'Затрудняюсь ответить'].includes(value))],
      action: metadata, actionOption: option, inlineProof: action.inlineProof} : q);
    actions.questions = actions.questions.filter(q => q.id !== id);
  }
  return result.filter(section => section.questions.length);
}

function addChurnModel(catalogue, product) {
  if (!productSurveyProfiles[product]) return catalogue;
  const result = catalogue.map(section => ({...section, questions: [...section.questions]}));
  let churn = result.find(section => section.id === 'churn');
  if (!churn) {
    churn = {...sections.find(section => section.id === 'churn'), questions: []};
    const insertion = result.findIndex(section => !['intro', 'metrics', 'dataQuality', 'attract', 'usage'].includes(section.id));
    result.splice(insertion < 0 ? result.length : insertion, 0, churn);
  }
  const includesIndex = churn.questions.findIndex(q => q.id === 'churnIncludes');
  const analysisIndex = churn.questions.findIndex(q => q.id === 'churnAnalysis');
  const insertion = includesIndex >= 0 ? includesIndex + 1 : analysisIndex >= 0 ? analysisIndex : churn.questions.length;
  churn.questions.splice(insertion, 0, {
    id: 'churnModel', row: null, type: 'radio', title: 'Есть ли у вас модель оттока?',
    hint: 'Модель оттока — это факторная модель, которая оценивает вероятность того, что клиент перестанет пользоваться продуктом. Она учитывает сочетание признаков: например, снижение активности, изменение частоты операций, остатков или объёма использования продукта. Модель помогает определить клиентов с высоким риском оттока и факторы, связанные с этим риском, чтобы выбрать меры удержания.',
    options: ['Да', 'Нет', 'Не релевантно для моего продукта', 'Затрудняюсь ответить'],
    inlineEvidence: {id: 'churnModelReport', formatId: 'churnModelReportFormat', row: null,
      title: 'Пожалуйста, приложите ссылки на модель оттока', label: 'Материалы по модели оттока'},
  });
  return result;
}

export function assignFunnelEvidence(section) {
  let questions = section.questions;
  for (const direction of ['attract', 'churn']) {
    const reportId = `${direction}Report`;
    const candidates = questions.filter(q => !q.inlineOnly && q.inlineEvidence?.id === reportId);
    const owner = candidates.find(q => q.id === `${direction}Includes`)
      || candidates.find(q => q.id === `${direction}Configured`);
    questions = questions.map(q => q.inlineEvidence?.id !== reportId ? q
      : {...q, inlineEvidence: q.id === owner?.id ? {...q.inlineEvidence, evidenceWhenAbsent: undefined} : undefined});
  }
  return {...section, questions};
}

function addGoals(catalogue, product) {
  if (!productSurveyProfiles[product]) return catalogue;
  const result = [...catalogue];
  const metricsIndex = result.findIndex(section => section.id === 'metrics');
  result.splice(metricsIndex >= 0 ? metricsIndex + 1 : 1, 0, {
    id: 'goals', title: 'Цели', description: 'Где команда отслеживает ключевые показатели эффективности продукта.',
    questions: [{id: 'goalsMonitoring', row: null, type: 'radio',
      title: 'Есть ли у вас регулярный отчет/дашборд для мониторинга всех метрических целей уровня РО?',
      options: ['Да (включены все цели)', 'Частично (мониторинг не по всем целям)', 'Нет'],
      inlineQuestions: [
        {id: 'goalsForecast', row: null, type: 'radio', questionCards: true, when: 'goalsMonitoring',
          title: 'Все ли метрические цели уровня PO покрыты прогнозами?',
          options: ['Да, >90%', 'Частично, <90%', 'Нет']},
        {id: 'goalsFactorAnalysis', row: null, type: 'radio', questionCards: true, when: 'goalsMonitoring',
          title: 'У всех ли метрических целей уровня PO есть факторный анализ?',
          options: ['Да, >90%', 'Частично, <90%', 'Нет']},
        {id: 'goalsDashboards', row: null, type: 'links', when: 'goalsMonitoring',
          title: 'Пожалуйста, приложите ссылку на отчет',
          hint: 'Можно указать несколько ссылок. Для каждой дополнительной ссылки нажмите «Добавить ещё».'}
      ]}],
  });
  return result;
}

const businessAlertHints = {
  'Да': 'По всем ключевым бизнес-метрикам автоматически приходят уведомления об отклонениях.',
  'Частично': 'Автоматические уведомления настроены только для части ключевых бизнес-метрик или отклонений.',
  'Нет': 'Автоматические уведомления об отклонениях ключевых бизнес-метрик не настроены.',
};

const reportingOptions = ['Да, автоматическая (monthly/weekly)', 'Да, по запросу', 'Нет', 'Затрудняюсь ответить'];
const reportingCodes = {
  attractConfigured: 'attract.nastroena_otchetnostь',
  churnConfigured: 'churn.nastroena_otchetnostь',
  usageConfigured: 'attract.nastroena_otchetnostь',
};

function configureReporting(question, profile, catalogue) {
  const code = reportingCodes[question.id];
  if (code) {
    const alreadyConfigured = Number(profile && productMetric(profile, code)?.value) > 0;
    return {...question,
      ...(alreadyConfigured ? {title: `С какой регулярностью настроен мониторинг по воронке ${{attractConfigured: 'привлечения', churnConfigured: 'оттока', usageConfigured: 'использования'}[question.id]}?`} : {}),
      options: reportingOptions.filter(option => option !== 'Нет' || !alreadyConfigured),
      reasonId: undefined, reasonWhen: undefined};
  }
  const configuredId = {attractIncludes: 'attractConfigured', churnIncludes: 'churnConfigured', usageIncludes: 'usageConfigured'}[question.id];
  if (configuredId && !question.benchmarkOnly && catalogue.some(q => q.id === configuredId)) {
    return {...question, hideWhenAnswer: {id: configuredId, value: 'Нет'}};
  }
  return question;
}

export function getSections(answers = {}) {
  const profile = productSurveyProfiles[answers.product];
  const completedKnowledge = new Set(Object.entries({
    marketRussia: 'general.obъem_celevogo_rynka_v_rossii',
    marketSber: 'general.obъem_celevogo_rynka_v_sbere',
    satellite: 'general.znanie_produktov_sputnikov',
  }).filter(([, code]) => {
    const metric = profile && productMetric(profile, code);
    return metric && Number(metric.max_value) > 0 && Number(metric.value) / Number(metric.max_value) === 1;
  }).map(([id]) => id));
  return addGoals(addChurnModel(embedActions(embedBenchmarks(baseSections(answers))), answers.product), answers.product).map(section => ({...section,
    ...(section.id === 'priorities' ? {title: 'Поддержка', description: 'Какие инструменты и поддержка помогут команде.'} : {}),
    questions: section.questions.filter(q => !['lastResearch', 'priorities', 'attractDeviationsCompleted', 'deviationsCompleted'].includes(q.id) && !completedKnowledge.has(q.id))
      .filter(q => q.id !== 'crossSellAfter' || !profile || needsSurvey(profile, 'mehaniki.cross_sell'))
      .map(q => ['attractAnalysis', 'churnAnalysis'].includes(q.id) ? {...q, inlineEvidence: undefined} : q)
      .map(q => q.id === 'alerts' ? {...q, optionHints: businessAlertHints,
        optionalCommentId: 'alertsComment', optionalCommentWhen: ['Да', 'Частично'], optionalCommentRequired: true,
        optionalCommentTitle: 'Что настроено и как?'} : q.id === 'upsell' ? {...q,
        optionHints: {'Допродажи (upsell)': 'Upsell — это предложение клиенту более дорогой или расширенной версии текущего продукта. Например, повышение тарифа, переход на премиальный пакет или подключение дополнительных платных возможностей.'}} : q),
  })).filter(section => section.questions.length).map(section => section.id !== 'metrics' ? {
    ...section,
    questions: section.questions.map(question => !question.benchmarkOnly && question.type !== 'info' && previousFunnels[answers.product]?.[question.id]?.length ? {
        ...question,
        previousOptions: [...new Set([...previousFunnels[answers.product][question.id],
          ...(question.id === 'attractIncludes' && clickstreamOnlyAttraction[answers.product] ? [2] : [])])].sort((a, b) => a - b)
          .filter(index => !(question.id === 'attractIncludes' && clickstreamOnlyAttraction[answers.product] && [0, 4].includes(index)))
          .map(index => question.options[index]),
        ...(question.id === 'attractIncludes' && clickstreamOnlyAttraction[answers.product] ? {
          title: 'Укажите, что еще включает отчет по воронке привлечения?',
          previousClickstreamUrl: clickstreamOnlyAttraction[answers.product],
        } : {}),
      } : question),
  } : {
    ...section,
    questions: section.questions.map(question => question.id === 'monitoring' ? {...question, inlineOnly: true} : question.id === 'satellite' ? question : {
      ...question,
      ...(question.type === 'numeric' ? {
        title: question.title.replace(/\s*\(клиентов\)/g, ''),
        hint: 'Введите число за последний доступный период',
        unit: question.id === 'dauMau' ? '%' : 'клиентов',
        optionalCommentId: `${question.id}Comment`,
      } : {}),
      inlineProof: {id: `${question.id}Source`, kind: 'metricSource', row: null, appearance: 'base', always: true, autoFocus: false,
        title: 'Где вы смотрите этот показатель?'},
    }),
  }).map(section => ({...section, questions: section.questions.map(question => {
    const links = previousReportLinks[answers.product]?.[question.inlineEvidence?.id];
    return links ? {...question, inlineEvidence: {...question.inlineEvidence, previousLinks: links}} : question;
  })})).map(section => section.id === 'crossSell' ? {...section,
    questions: section.questions.filter(q => q.id !== 'crossSellInfo').map(q => q.id === 'crossSellAfter'
      ? {...q, introInfo: crossSellSection.questions[0]} : q),
  } : section).map(section => ({...section, questions: section.questions.map(q =>
    ['attractIncludes', 'churnIncludes', 'usageIncludes'].includes(q.id) && !q.benchmarkOnly ? {...q,
      title: ['attractIncludes', 'churnIncludes'].includes(q.id) ? `Какие метрики вы мониторите в рамках воронки ${q.id === 'attractIncludes' ? 'привлечения' : 'оттока'} по вашему продукту?` : 'Какую отчетность вы используете для мониторинга метрик ниже?',
      hint: ['attractIncludes', 'churnIncludes'].includes(q.id) ? 'Можно выбрать несколько вариантов' : 'Пожалуйста, добавьте ссылку и выберите метрики',
      reportMonitoring: true, evidenceAfterOptions: ['attractIncludes', 'churnIncludes'].includes(q.id),
    } : q)})).map(section => ({...section, questions: section.questions.map(q => configureReporting(q, profile, section.questions))})).map(assignFunnelEvidence).filter(section => section.questions.length);
}

export function getBacklogAnalyzed(answers = {}) {
  if (productSurveyProfiles[answers.product]) return Boolean(previousBacklogs[answers.product]);
  return CHANNEL_SURVEYS_ENABLED && answers.product === callCenterBaseline.teamId ? callCenterBacklogAnalyzed : false;
}

// Исправляем только очевидные опечатки при отображении; исходный текст Excel
// и значения выбранных ответов сохраняются.
export function correctTypos(text) {
  return text
    .replaceAll('Автоматизации (автоклассификация обращений, распределения очередей / сплитов /лидов)', 'Автоматизация: классификация обращений, распределение очередей, сплитов и лидов')
    .replaceAll('кагортный', 'когортный')
    .replaceAll('Сегментный/ когортный', 'Сегментный/когортный')
    .replaceAll('потрери', 'потери')
    .replaceAll('неподходят', 'не подходят')
    .replaceAll('Выберете ваш юнит', 'Выберите ваш юнит')
    .replaceAll('оценка результативности компаний', 'оценка результативности кампаний')
    .replaceAll('ТОР 3', 'ТОП-3')
    .replace(/\s*\(Колл-центр, Чат\)/g, '')
    .trim();
}

export function visibleQuestions(section, backlogAnalyzed, answers = {}) {
  return section.questions.filter((q) =>
    !q.inlineOnly &&
    (!q.hideWhenAnswer || answers[q.hideWhenAnswer.id] !== q.hideWhenAnswer.value) &&
    (!backlogAnalyzed || !['discovery', 'backlog'].includes(q.id)) &&
    (!q.when || indicatesPresence(answers[q.when])) &&
    (!q.whenOption || (Array.isArray(answers[q.whenOption.id]) ? answers[q.whenOption.id].includes(q.whenOption.option) : answers[q.whenOption.id] === q.whenOption.option)) &&
    (!q.whenAny || q.whenAny.some(id => indicatesPresence(answers[id]))),
  );
}

export function indicatesPresence(value) {
  if (Array.isArray(value)) return value.some(indicatesPresence);
  return Boolean(value) && !(typeof value === 'string' && value.toLocaleLowerCase('ru').startsWith('не релевантно')) &&
    !['Нет', 'Не проводился', 'Затрудняюсь ответить', 'Затрудняюсь', 'Нет собственных аналитиков', 'Нет аналитиков', 'Не подходит для моего продукта', 'Не настроены дополнительные механики', 'Предложенные варианты неподходят для моего продукта'].includes(value);
}

export function needsEvidence(question, answers = {}) {
  const evidence = question.inlineEvidence;
  const absent = evidence?.evidenceWhenAbsent;
  const earlierIds = Array.isArray(absent) ? absent : absent ? [absent] : [];
  const unknown = Array.isArray(answers[question.id]) && answers[question.id].includes('Затрудняюсь ответить');
  return Boolean(evidence && !unknown && (question.reportMonitoring || question.previousOptions?.length || indicatesPresence(answers[question.id])) &&
    earlierIds.every(id => !indicatesPresence(answers[id])));
}

export function hasEvidence(question, answers = {}) {
  if (!needsEvidence(question, answers)) return true;
  const {format, value} = evidenceResponse(question.inlineEvidence, answers);
  if (question.inlineEvidence.formats) {
    if (!question.inlineEvidence.formats.some(option => option.value === format)) return false;
    if (format === 'other') return Boolean(value);
  } else {
    if (['excel', 'unavailable'].includes(format)) return true;
    if (format !== 'link') return false;
  }
  return hasHttpLinks(value);
}

export function evidenceResponse(evidence, answers = {}) {
  const correction = evidence.previousLinks ? (answers[`${evidence.id}Correction`] || 'keep') : undefined;
  return correction === 'keep'
    ? {format: 'link', value: evidence.previousLinks.join('\n'), correction}
    : {format: answers[evidence.formatId] || '', value: answers[evidence.formatId] === 'other' ? String(answers[evidence.id] ?? '').trim() : httpLinkValues(answers[evidence.id]).join('\n'), correction,
      ...(answers[evidence.formatId] === 'unavailable' ? {comment: String(answers[`${evidence.id}Comment`] || '').trim()} : {})};
}

export function normalizeNumericAnswer(value, allowDecimal = false) {
  if (!allowDecimal) return String(value).replace(/[^0-9]/g, '');
  const cleaned = String(value).replaceAll('.', ',').replace(/[^0-9,]/g, '');
  const [integer, ...fraction] = cleaned.split(',');
  return fraction.length ? `${integer || '0'},${fraction.join('')}` : integer;
}

export function formatNumericAnswer(value) {
  const [integer, fraction] = String(value || '').split(',');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

export function allowsMissingMetric(question, answers) {
  return question.type === 'numeric' && answers[`${question.id}Unknown`] === true;
}

export function hasAnswer(question, answers) {
  const value = question.previousOptions?.length ? [...question.previousOptions, ...(Array.isArray(answers[question.id]) ? answers[question.id] : [])] : answers[question.id];
  if (inlineQuestions(question, answers).some(q => !hasAnswer(q, answers))) return false;
  if (question.type === 'info') return true;
  if (question.type === 'links') {
    const format = answers[`${question.id}Unknown`] === true ? 'unknown' : answers[`${question.id}Format`] || 'link';
    if (['excel', 'unknown'].includes(format)) return true;
    return format === 'link' && hasHttpLinks(value);
  }
  if (question.type === 'radio' && !question.options.includes(value)) return false;
  if (question.optionalCommentRequired && showsOptionalComment(question, answers)
    && !String(answers[question.optionalCommentId] || '').trim()) return false;
  if (question.action && isOptionSelected(question, answers, question.actionOption) && !hasEvidence(question.action, {...answers, [question.action.id]: 'Да'})) return false;
  if (needsReason(question, answers) && !question.reasonOptional && !String(answers[question.reasonId] || '').trim()) return false;
  if (needsProof(question, answers) && (question.inlineProof.kind === 'metricSource'
    ? !hasMetricSource(question.inlineProof, answers) : question.inlineProof.kind === 'backlog' ? !hasBacklogLinks(answers[question.inlineProof.id]) : !String(answers[question.inlineProof.id] || '').trim())) return false;
  if (question.type === 'numeric') return (allowsMissingMetric(question, answers)
    ? !String(value ?? '').trim()
    : (question.allowDecimal ? /^[0-9]+(?:,[0-9]+)?$/ : /^[0-9]+$/).test(String(value ?? ''))) && hasEvidence(question, answers);
  if (value === 'Свой вариант ответа') return Boolean(String(answers[`${question.id}Other`] || '').trim()) && hasEvidence(question, answers);
  if (Array.isArray(value)) {
    if (!value.filter(option => question.options.includes(option) && !knownMechanics(question, answers).includes(option)).length) return false;
    if (needsComment(question, answers) && !String(answers[question.commentId] || '').trim()) return false;
    if (value.some(option => /Свой вариант|Что-то ещ[её]|^Другое$/.test(option)) && !String(answers[`${question.id}Other`] || '').trim()) return false;
    return hasEvidence(question, answers);
  }
  return Boolean(String(value || '').trim()) && hasEvidence(question, answers);
}

export function isOptionSelected(question, answers, option) {
  if (question.benchmarkOnly && option === 'Бенчмарки') return answers[question.id] === 'Да';
  const choices = answers[question.id];
  return Array.isArray(choices) && question.options?.includes(option)
    && (choices.includes(option) || (question.options.includes('Все перечисленное выше') && choices.includes('Все перечисленное выше')));
}

export function needsProof(question, answers = {}) {
  if (question.inlineProof?.whenAnswer) return answers[question.id] === question.inlineProof.whenAnswer;
  return Boolean(question.inlineProof && (question.benchmark
    ? isOptionSelected(question, answers, 'Бенчмарки')
    : question.action ? isOptionSelected(question, answers, question.actionOption)
    : question.inlineProof.always || indicatesPresence(answers[question.id])));
}

export function toggleOption(current, option) {
  const exclusive = (value) => ['Дашборд в Навигаторе (доступны все метрики)', 'Затрудняюсь ответить', 'Не проводился', 'Все перечисленное выше', 'Не настроены дополнительные механики', 'Предложенные варианты неподходят для моего продукта'].includes(value);
  if (current.includes(option)) return current.filter((v) => v !== option);
  if (exclusive(option)) return [option];
  return [...current.filter((v) => !exclusive(v)), option];
}

export function questionOptions(question) {
  if (question.previousOptions?.length) return [...question.previousOptions, ...question.options.filter(option => !question.previousOptions.includes(option))];
  return question.options || [];
}

export function knownMechanics(question, answers) {
  const team = teams.find(team => team.id === answers.product);
  if (question.knownOptions) return question.knownOptions;
  return (question.commentWhen || []).filter(option => team?.mechanicScores?.[option] === 1);
}

export function needsComment(question, answers) {
  const known = knownMechanics(question, answers);
  return Boolean(question.commentId && Array.isArray(answers[question.id]) && answers[question.id].some(option => question.commentWhen.includes(option) && !known.includes(option)));
}

export function needsReason(question, answers = {}) {
  return Boolean(question.reasonId && answers[question.id] === question.reasonWhen);
}


export function showsOptionalComment(question, answers) {
  return Boolean(question.optionalCommentId && (!question.optionalCommentWhen
    || question.optionalCommentWhen.includes(answers[question.id])));
}


export function shouldShowCrossSellReminder(answers) {
  const profile = productSurveyProfiles[answers.product];
  const metric = profile && productMetric(profile, 'mehaniki.cross_sell');
  return Boolean(applicable(metric) && Number(metric.value) > 0
    && Number(metric.value) < Number(metric.max_value) && answers.crossSellAfter !== 'Нет');
}
