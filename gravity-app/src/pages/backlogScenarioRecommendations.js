export const CENTRALIZED_KKD_CDO_URL = 'https://mapp.sberbank.ru/sberdataproducts/page/49403';
export const FEATURE_STORE_URL = 'https://confluence.sberbank.ru/pages/viewpage.action?pageId=21560591134';
export const SBERID_ELK_DATA_MART_STANDARD_URL = 'https://confluence.sberbank.ru/pages/viewpage.action?pageId=23607905608';
export const FEATURE_STORE_RESOURCE = Object.freeze({label: 'FeatureStore', href: FEATURE_STORE_URL});
export const DATA_MARTS_RESOURCES = Object.freeze([
  {label: 'Стандарт проектирования витрин', href: 'https://confluence.sberbank.ru/pages/viewpage.action?pageId=23607905561'},
  {label: 'Шаблон базовых витрин', href: 'https://confluence.delta.sbrf.ru/pages/viewpage.action?pageId=17033528890'},
  {label: 'Контакты CDO', href: 'https://confluence.sberbank.ru/pages/viewpage.action?pageId=12446342550'},
]);
export const INDUSTRIAL_DATA_RESOURCES = Object.freeze([
  FEATURE_STORE_RESOURCE,
  ...DATA_MARTS_RESOURCES,
]);

export function industrialDataResourcesFor(productName) {
  const name = String(productName || '').trim().toLocaleLowerCase('ru-RU');
  if (!['sberid', 'елк', 'единый личный кабинет (елк)'].includes(name)) return INDUSTRIAL_DATA_RESOURCES;
  return INDUSTRIAL_DATA_RESOURCES.map((resource) => resource.label === 'Стандарт проектирования витрин'
    ? {...resource, href: SBERID_ELK_DATA_MART_STANDARD_URL}
    : resource);
}

export const DD_SCENARIO_RECOMMENDATIONS = [
  {
    key: 'AI',
    direction: 'AI',
    scenario: 'AI',
    info: 'Обучение и калибровка AI-моделей, настройка и тестирование AI-агентов',
    sourceTool: 'Bootcamp',
    recommendation: 'Рекомендуем согласованить с HR-партнёром участие аналитиков в AI Bootcamp',
    resources: [{label: 'AI Bootcamp', href: 'https://bootcamp.pcbltools.ru/task/1585206?courseId=1176', placement: 'inline'}],
  },
  {
    key: 'customer_experience_analytics',
    direction: 'Аналитика',
    scenario: 'Аналитика клиентского опыта',
    info: 'Анализ поведения пользователей, пути клиента, воронки, когортный анализ.',
    sourceTool: 'OpenCode',
    recommendation: 'Рекомендуем для оптимизации работы с кодом попробовать OpenCode в DataLab AI — аналог Claude.\n\nДля оценки клиентских путей рекомендуем использовать LossHunter и CJExplorer.\n\nТакже предлагаем воспользоваться AI Toolkit «Продуктовый аналитик».',
    resources: [
      {label: 'OpenCode в DataLab AI', href: 'https://mapp.sberbank.ru/b2cda/page/394333', placement: 'inline'},
      {label: 'LossHunter', href: 'https://losshunter.ru', placement: 'inline'},
      {label: 'CJExplorer', href: 'https://cjxplorer.com/', placement: 'inline'},
      {label: 'Продуктовый аналитик', action: 'product-analyst-access', placement: 'inline'},
    ],
  },
  {
    key: 'methodology_dev',
    direction: 'Аналитика',
    scenario: 'Разработка методологии',
    info: 'Разработка правил расчета метрик, согласование определений с бизнесом.',
    sourceTool: 'FeatureStore',
    recommendation: 'Рекомендуем оформлять согласованные методологии как переиспользуемые артефакты во FeatureStore',
    resources: [{...FEATURE_STORE_RESOURCE, placement: 'inline'}],
  },
  {
    key: 'metrics_calculation',
    direction: 'Аналитика',
    scenario: 'Расчет метрик',
    info: 'Разработка скриптов или процедур для расчета ключевых показателей (часто на регулярной основе)',
    sourceTool: 'OpenCode',
    recommendation: 'Рекомендуем использовать OpenCode в Datalab AI для подготовки, рефакторинга и документирования расчётных скриптов.',
    resources: [{label: 'OpenCode в DataLab AI', href: 'https://mapp.sberbank.ru/b2cda/page/394333'}],
  },
  {
    key: 'exports_to_excel',
    direction: 'Выгрузка',
    scenario: 'Выгрузки в Excel',
    info: 'Формирование выгрузки по разовому запросу. Данные без глубокой обработки или «как есть» из источника',
    sourceTool: 'Агент CX и Агент DB',
    recommendation: 'Предлагаемый инструментарий: рекомендуем подключить витрины к агентам для автоматизации выгрузок: Агент CX, Агент DB.',
    resources: [
      {label: 'Агент CX', href: 'https://navigator.sigma.sbrf.ru/gdash/1000004321', placement: 'inline'},
      {label: 'Агент DB', href: 'https://confluence.sberbank.ru/login.action?os_destination=%2Fpages%2Fviewpage.action%3FpageId%3D23031908778&permissionViolation=true', placement: 'inline'},
    ],
  },
  {
    key: 'excel_automatic_reports',
    direction: 'Выгрузка',
    scenario: 'Автоматизированные отчеты',
    info: 'Отчеты, формируемые автоматически по расписанию или триггеру. Настройка производится однократно через скрипт (SQL, Python, ETL) или прямое подключение к базе данных. После настройки обновление данных происходит без ручного вмешательства',
    sourceTool: 'AirFlow и AI Note в ЛД',
    recommendation: 'Рекомендуем планировать регулярные расчёты в AirFlow, а AI Note в ЛД использовать для ускорения разработки и проверки кода.',
    resources: [{label: 'AirFlow и AI Note в ЛД', href: 'https://mapp.sberbank.ru/greenlab/page/994'}],
  },
  {
    key: 'data_marts',
    direction: 'Данные и автоматизация',
    scenario: 'Данные и автоматизация',
    info: 'Проектирование и создание витрин данных для отчетов или дашбордов (ETL/ELT процессы).',
    sourceTool: 'Стандарты создания витрин',
    recommendation: 'Рекомендуем начинать новые витрины со стандартного маршрута проектирования, для базовых витрин использовать готовый шаблон и заранее подключать CDO юнита.',
    resources: DATA_MARTS_RESOURCES,
  },
  {
    key: 'manual_data_quality_control',
    direction: 'Данные и автоматизация',
    scenario: 'Ручной ККД',
    info: 'Ручной контроль качества данных, сверка, исправление ошибок в данных вручную.',
    sourceTool: 'Централизованный сервис ККД CDO и Штаб',
    recommendation: 'Предлагаемый инструментарий: для автоматизации ККД витрин в промышленном контуре рекомендуем использовать Централизованный сервис ККД CDO.\n\nДля настройки ККД в отчетности рекомендуем воспользоваться инструментом Штаба.',
    resources: [
      {label: 'Централизованный сервис ККД CDO', href: CENTRALIZED_KKD_CDO_URL, placement: 'inline'},
      {label: 'инструментом Штаба', href: 'https://sbertrack.sberbank.ru/swtr/wiki/unit/QLIKPROS1-585?space=QLIKPROS1&tenant=default&suite=wiki_page', placement: 'inline'},
    ],
  },
  {
    key: 'root_cause_analysis',
    direction: 'Исследования',
    scenario: 'Анализ корневых причин',
    info: 'Выявление корневых причин отклонений или проблем в данных/процессах с помощью исследовательских и статистических методов',
    sourceTool: 'DataLab Pro|OpenCode',
    recommendation: 'Рекомендуем проводить анализ корневых причин в DataLab Pro, а OpenCode использовать для ускорения подготовки и проверки исследовательского кода.',
    resources: [{label: 'DataLab Pro и OpenCode', href: 'https://mapp.sberbank.ru/b2cda/page/394333'}],
  },
  {
    key: 'growth_factors_research',
    direction: 'Исследования',
    scenario: 'Поиск точек роста',
    info: 'Выявление скрытых зависимостей (что влияет на LTV, Retention). Часто требует статистических методов.',
    sourceTool: 'OpenCode',
    recommendation: 'Рекомендуем использовать OpenCode в Datalab AI для ускорения разведочного анализа, проверки гипотез и воспроизводимого расчёта факторов роста.',
    resources: [{label: 'OpenCode в DataLab AI', href: 'https://mapp.sberbank.ru/b2cda/page/394333'}],
  },
  {
    key: 'business_planning',
    direction: 'Моделирование',
    scenario: 'Бизнес-планирование',
    info: 'Построение прогнозов, план-факт анализ, моделирование сценариев развития.',
    sourceTool: 'OpenCode',
    recommendation: 'Рекомендуем использовать OpenCode в Datalab AI для подготовки сценарных моделей, автоматизации план-факт расчётов и документирования допущений.',
    resources: [{label: 'OpenCode в DataLab AI', href: 'https://mapp.sberbank.ru/b2cda/page/394333'}],
  },
  {
    key: 'financial_impact_estimation',
    direction: 'Моделирование',
    scenario: 'Оценка финансового эффекта',
    info: 'Финансово-экономическое обоснование, прогноз окупаемости, расчет юнит-экономики гипотезы, расчет эффекта от проделанных акций/кампаний.',
    sourceTool: 'АВ тестирование',
    recommendation: 'Рекомендуем подтверждать финансовый эффект через дизайн A/B-теста: заранее фиксировать основную метрику, горизонт наблюдения и правила расчёта эффекта.',
    resources: [{label: 'A/B', href: 'https://ab.sberbank.ru/experiments?source=1', placement: 'inline'}],
  },
  {
    key: 'unknown',
    direction: 'Неизвестно',
    scenario: 'Невозможно разметить',
    info: 'Невозможно выполнить разметку (назначить категорию, сценарий, метку) из-за низкого качества исходного описания: недостаточно деталей, размытые формулировки, отсутствие ключевых параметров. Требуется доработка описания автором.',
    sourceTool: '',
    recommendation: 'Рекомендуем повысить качество описаний задач для более корректного мапинга задач с нашей стороны',
  },
  {
    key: 'employee_trainings',
    direction: 'Организационное',
    scenario: 'Обучение сотрудников',
    info: 'Онбординг новичков, проведение лекций/вебинаров по аналитике.',
    sourceTool: 'Bootcamp',
    recommendation: 'Рекомендуем включить Bootcamp в план развития команды и закреплять обучение практическим заданием на данных продукта.',
  },
  {
    key: 'knowledge_base_maintenance',
    direction: 'Организационное',
    scenario: 'Формирование базы знаний',
    info: 'Написание документации, глоссария, поддержание гигиены в Confluence/M-App',
    sourceTool: '',
    recommendation: 'Рекомендуем назначить владельцев ключевых разделов базы знаний, ввести срок пересмотра материалов и единый шаблон описания аналитических артефактов.',
  },
  {
    key: 'excel_reports',
    direction: 'Отчеты вне BI',
    scenario: 'Отчеты в Excel',
    info: 'Создание структурированных отчетов в Excel.',
    sourceTool: 'EX-EL',
    recommendation: 'Рекомендуем оценить EX-EL как основной инструмент для типовых Excel-отчётов и начать с одного регулярного отчёта с наибольшими трудозатратами.',
    resources: [{label: 'EX-EL', action: 'ex-el-access', placement: 'inline'}],
  },
  {
    key: 'presentations',
    direction: 'Отчеты вне BI',
    scenario: 'Презентации',
    info: 'Расчет и упаковка выводов в слайды (PowerPoint) для руководства или контрагентов.',
    sourceTool: 'EX-EL',
    recommendation: 'Для подготовки материалов рекомендуем использовать EX-EL.',
    resources: [{label: 'EX-EL', action: 'ex-el-access', placement: 'inline'}],
  },
  {
    key: 'dashboard_improvements',
    direction: 'Разработка и поддержка BI',
    scenario: 'Доработки дашбордов',
    info: 'Проектирование и создание витрин данных для отчетов или дашбордов (ETL/ELT процессы).',
    sourceTool: 'курс Навигатора/Продуктовая аналитика',
    recommendation: 'Рекомендуем направить владельцев дашбордов на курс Навигатора или продуктовой аналитики и применить обучение на ближайшей доработке.',
    resources: [{label: 'Курс Навигатора', href: 'https://confluence.sberbank.ru/display/NAV'}],
  },
  {
    key: 'dashboard_migration',
    direction: 'Разработка и поддержка BI',
    scenario: 'Миграция дешбордов',
    info: 'Перенос существующих дашбордов и отчетов с текущей BI-платформы на целевую BI-систему. Включает: анализ исходных дашбордов, перепроектирование моделей данных под целевую платформу, перенос или пересоздание графиков и фильтров, валидацию совпадения метрик с исходными отчетами, настройку прав доступа и обновления данных. По завершении — тестирование и сдача в эксплуатацию',
    sourceTool: 'курс Навигатора/Продуктовая аналитика',
    recommendation: 'Рекомендуем до миграции пройти курс Навигатора или продуктовой аналитики, затем провести инвентаризацию метрик и зафиксировать критерии сверки со старым дашбордом.',
    resources: [{label: 'Курс Навигатора', href: 'https://confluence.sberbank.ru/display/NAV'}],
  },
  {
    key: 'dashboard_manual_data_update',
    direction: 'Разработка и поддержка BI',
    scenario: 'Ручное обновление данных',
    info: 'Расчет и ручная поставка данных в BI',
    sourceTool: 'Продуктовая аналитика',
    recommendation: 'Рекомендуем обучить владельца отчёта продуктовой аналитике и составить план перевода ручной поставки на расписание или автоматический триггер.',
  },
  {
    key: 'BI_bugfix',
    direction: 'Разработка и поддержка BI',
    scenario: 'Фикс багов в BI',
    info: 'Исправление ошибок в формулах на стороне Навигатора',
    sourceTool: '',
    recommendation: 'Рекомендуем ввести чек-лист проверки формул, тестовый набор контрольных значений и разбор повторяющихся причин ошибок перед публикацией в Навигаторе.',
  },
];
