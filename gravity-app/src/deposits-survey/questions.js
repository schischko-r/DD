import {teams} from './teams.js';
import {callCenterSections, callCenterBaseline, callCenterBacklogAnalyzed} from './call-center.js';

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
        "placeholder": "Введите ответ"
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
    "questions": [
      {
        "id": "marketRussia",
        "row": 15,
        "title": "Укажите общий объем целевого рынка вашего продукта в России",
        "type": "numeric",
        "placeholder": "Введите число"
      },
      {
        "id": "marketSber",
        "row": 17,
        "title": "Напишите доступный объем рынка в Сбере, который продукт реально может охватить с учетом текущей бизнес-модели",
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
        "title": "Что включает воронка привлечения?",
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
        "title": "Что включает воронка оттока?",
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
    "description": "Допродажи и сценарии, которые применяет команда.",
    "questions": [
      {
        "id": "upsell",
        "row": 100,
        "title": "Какие продуктовые механики были настроены по вашему продукту?",
        "type": "multi",
        "commentId": "mechanics",
        "commentWhen": ["Удержание клиентов", "Возврат клиентов", "Допродажи (upsell)"],
        "dividerBefore": "Не настроены дополнительные механики",
        "options": [
          "Удержание клиентов",
          "Возврат клиентов",
          "Допродажи (upsell)",
          "Не настроены дополнительные механики",
          "Предложенные варианты неподходят для моего продукта",
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
        "inlineProof": {"id": "backlog", "row": 121, "title": "Приложите ссылку на бэклог задач аналитиков данных (DA) по вашему продукту/опишите, кто делает исследования", "placeholder": "Ссылка или описание"},
        "options": [
          "Больше 80%",
          "От 40 до 79%",
          "От 20 до 39%",
          "Меньше 20%",
          "Нет собственных аналитиков",
          "Затрудняюсь ответить"
        ],
        "discovery": true
      },
      {
        "id": "backlog",
        "inlineOnly": true,
        "row": 121,
        "title": "Приложите ссылку на бэклог задач аналитиков данных (DA) по вашему продукту/опишите, кто делает исследования",
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

// Команда определяет набор вопросов; первоначальный каталог вкладов сохранён.
export function getSections(answers = {}) {
  if (answers.product !== callCenterBaseline.teamId) return sections;
  const common = sections.find(section => section.id === 'priorities');
  const finalSection = {...common, questions: common.questions.map(q => q.id === 'priorities'
    ? {...q, sheet: 'Каналы Phigital', row: 147, options: q.options.map(option => option.replace('по продукту', 'по каналу'))}
    : {...q, sheet: 'Каналы Phigital', row: 155, title: q.title.replace('вашего продукта', 'вашего канала')})};
  return [sections[0], ...callCenterSections, finalSection];
}

export function getBacklogAnalyzed(answers = {}) {
  return answers.product === callCenterBaseline.teamId ? callCenterBacklogAnalyzed : false;
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
    (!backlogAnalyzed || !['discovery', 'backlog'].includes(q.id)) &&
    (!q.when || indicatesPresence(answers[q.when])) &&
    (!q.whenOption || (Array.isArray(answers[q.whenOption.id]) ? answers[q.whenOption.id].includes(q.whenOption.option) : answers[q.whenOption.id] === q.whenOption.option)) &&
    (!q.whenAny || q.whenAny.some(id => indicatesPresence(answers[id]))),
  );
}

export function indicatesPresence(value) {
  if (Array.isArray(value)) return value.some(indicatesPresence);
  return Boolean(value) && !['Нет', 'Не проводился', 'Затрудняюсь ответить', 'Нет собственных аналитиков', 'Не подходит для моего продукта', 'Не настроены дополнительные механики', 'Предложенные варианты неподходят для моего продукта'].includes(value);
}

export function needsEvidence(question, answers = {}) {
  const evidence = question.inlineEvidence;
  return Boolean(evidence && indicatesPresence(answers[question.id]) &&
    (!evidence.evidenceWhenAbsent || !indicatesPresence(answers[evidence.evidenceWhenAbsent])));
}

export function hasEvidence(question, answers = {}) {
  if (!needsEvidence(question, answers)) return true;
  const {id, formatId} = question.inlineEvidence;
  if (answers[formatId] === 'excel') return true;
  if (answers[formatId] !== 'link') return false;
  try {
    const url = new URL(String(answers[id] ?? '').trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
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

export function hasAnswer(question, answers) {
  const value = answers[question.id];
  if (needsProof(question, answers) && !String(answers[question.inlineProof.id] || '').trim()) return false;
  if (question.type === 'numeric') return (question.allowDecimal ? /^[0-9]+(?:,[0-9]+)?$/ : /^[0-9]+$/).test(String(value ?? '')) && hasEvidence(question, answers);
  if (value === 'Свой вариант ответа') return Boolean(String(answers[`${question.id}Other`] || '').trim()) && hasEvidence(question, answers);
  if (Array.isArray(value)) {
    if (!value.filter(option => question.options.includes(option) && !knownMechanics(question, answers).includes(option)).length) return false;
    if (needsComment(question, answers) && !String(answers[question.commentId] || '').trim()) return false;
    if (value.some(option => /Свой вариант|Что-то ещ[её]|^Другое$/.test(option)) && !String(answers[`${question.id}Other`] || '').trim()) return false;
    return hasEvidence(question, answers);
  }
  return Boolean(String(value || '').trim()) && hasEvidence(question, answers);
}

export function needsProof(question, answers = {}) {
  return Boolean(question.inlineProof && indicatesPresence(answers[question.id]));
}

export function toggleOption(current, option) {
  const exclusive = (value) => ['Дашборд в Навигаторе (доступны все метрики)', 'Затрудняюсь ответить', 'Не проводился', 'Все перечисленное выше', 'Не настроены дополнительные механики', 'Предложенные варианты неподходят для моего продукта'].includes(value);
  if (current.includes(option)) return current.filter((v) => v !== option);
  if (exclusive(option)) return [option];
  return [...current.filter((v) => !exclusive(v)), option];
}

export function questionOptions(question) {
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
