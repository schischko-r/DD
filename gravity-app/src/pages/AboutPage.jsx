import React from 'react';
import {ArrowLeft, BarsAscendingAlignLeft, ChartColumn, ChartMixed, CircleInfo, Persons} from '@gravity-ui/icons';
import {Accordion, Button, Card, Icon, Label, Text} from '@gravity-ui/uikit';
import {BUTTON_INTENT, SemanticButton} from '../shared/ui/SemanticButton.jsx';

export function AboutPage({onBack}) {
  const principles = [
    {title: 'Объект оценки', text: 'Команда продукта, сегмента или канала. Индекс отражает состояние практик команды в расчётном периоде.', icon: Persons},
    {title: 'Источники фактов', text: 'Цифровые следы, действующая отчётность и ответы команды. Для каждого критерия фиксируется подтверждённое значение.', icon: ChartColumn},
    {title: 'Балльная модель', text: 'Каждый применимый критерий имеет фактический и максимальный балл. Баллы суммируются внутри блоков и по профилю.', icon: BarsAscendingAlignLeft},
    {title: 'Применимость', text: 'Не применимые критерии исключаются из числителя и знаменателя, поэтому они не занижают итоговую оценку.', icon: ChartMixed},
  ];
  const zones = [
    {title: 'Знание ключевых метрик и инструментов', text: 'Самооценка знания продуктовых метрик и доступной отчётности.', criteria: [{name: 'Объём целевого рынка в России', points: '0,2 балла'}, {name: 'Объём целевого рынка в Сбере', points: '0,2 балла'}, {name: 'Клиенты с продуктом', points: '0,2 балла'}, {name: 'MAU продукта', points: '0,2 балла'}, {name: 'Знание продуктов-спутников', points: '0,2 балла'}, {name: 'Знание отчётности в Навигаторе', points: '0,5 балла'}]},
    {title: 'Цели', text: 'Метрические цели, факторный анализ (драйверы 1–2 уровня), прогноз по целям и драйверам выведены на мониторинг и доступны ЛТ/ЛЮ.', criteria: [{name: 'Мониторинг в Навигаторе: выведено более 90% целей, лидер продукта знает про BI-дашборд.', points: '1 балл (100%)'}, {name: 'Мониторинг ведётся в локальной отчётности, не в Навигаторе.', points: '0,5 балла (50%)'}]},
    {title: 'Воронка привлечения', text: 'Оцениваются отчётность, анализ отклонений, кампейнинг и покрытие черновиков. Для кампаний используются данные предыдущего квартала.', criteria: [
      {section: 'Отчётность', name: 'Регулярная отчётность формируется автоматически.', points: '0,5 балла'},
      {section: 'Отчётность', name: 'Регулярная отчётность формируется по запросу.', points: '0,25 балла'},
      {section: 'Отчётность', name: 'Комплексный отчёт: источники, пошаговая воронка, CR, объёмы, механики, сегментный или когортный разрез, UX/UI.', points: '0,5 балла'},
      {section: 'Отчётность', name: 'Неполный отчёт.', points: '0,25 балла'},
      {section: 'Анализ', name: 'Комплексный анализ оформления, конкурентов, кампаний продаж и точек потери клиентов.', points: '1 балл'},
      {section: 'Анализ', name: 'Неполный анализ.', points: '0,5 балла'},
      {section: 'Анализ', name: 'Составлен перечень инициатив по отклонениям.', points: '1 балл'},
      {section: 'Анализ', name: 'Есть бенчмарки: цели, динамика или рыночное сравнение.', points: '1 балл'},
      {section: 'Кампейнинг', name: 'Есть запуски кампаний с результатом.', points: '0,5 балла'},
      {section: 'Кампейнинг', name: 'Есть успешные бизнес-запуски.', points: '0,5 балла'},
      {section: 'Кампейнинг', name: 'Используется Self-service.', points: '0,5 балла'},
      {section: 'Кампейнинг', name: 'Черновики покрывают не менее 70% потенциала продукта.', points: '1 балл'},
      {section: 'Кампейнинг', name: 'Черновики покрывают более 15%, но менее 70% потенциала.', points: '0,5 балла'},
    ]},
    {title: 'Воронка оттока', text: 'Оцениваются полнота и регулярность отчётности, анализ причин оттока, инициативы по отклонениям и бенчмарки.', criteria: [
      {section: 'Отчётность', name: 'Регулярная отчётность формируется автоматически.', points: '0,5 балла'},
      {section: 'Отчётность', name: 'Регулярная отчётность формируется по запросу.', points: '0,25 балла'},
      {section: 'Отчётность', name: 'Комплексный отчёт: пошаговая воронка, CR, объёмы, механики, сегментный или когортный разрез, UX/UI.', points: '0,5 балла'},
      {section: 'Отчётность', name: 'Неполный отчёт.', points: '0,25 балла'},
      {section: 'Анализ', name: 'Комплексный анализ: воронка, CTR, объёмы, сегменты или когорты, retention, механики удержания, UX/UI.', points: '1 балл'},
      {section: 'Анализ', name: 'Неполный анализ.', points: '0,5 балла'},
      {section: 'Анализ', name: 'Составлен перечень инициатив по отклонениям.', points: '1 балл'},
      {section: 'Анализ', name: 'Есть бенчмарки: цели, динамика или рыночное сравнение.', points: '1 балл'},
    ]},
    {title: 'Алерты', text: 'Автоматические алерты по системным сбоям и бизнес-метрикам продукта.', criteria: [{name: 'Настроены алерты по системным сбоям и бизнес-метрикам.', points: '1 балл (100%)'}, {name: 'Алерты настроены частично: только по одному из двух направлений.', points: '0,5 балла (50%)'}]},
    {title: 'Механики', text: 'Оцениваются продуктовые механики и наличие метрик их эффективности.', criteria: [
      {section: 'Удержание и возврат', name: 'Удержание через ценность; возврат через ценность.', points: 'до 1 балла'},
      {section: 'Удержание и возврат', name: 'Удержание или возврат только через информационную коммуникацию.', points: '0,5 балла'},
      {section: 'Продажи', name: 'Cross-sell при оформлении и после покупки.', points: '1 балл'},
      {section: 'Продажи', name: 'Cross-sell только на одном этапе.', points: '0,5 балла'},
      {section: 'Продажи', name: 'Дополнительные продажи (upsell).', points: '1 балл'},
      {section: 'Гибкость', name: 'Изменение условий без IT с персонализацией до клиентских подсегментов.', points: '1 балл'},
      {section: 'Гибкость', name: 'Изменение набора опций без IT, но без персонализации.', points: '0,5 балла'},
      {section: 'Мониторинг', name: 'Есть метрики эффективности механик.', points: '0,25 балла'},
    ]},
    {title: 'Гипотезы и инициативы', text: 'Исследовательская загрузка аналитиков, качество исследований и инициативы сверх бизнес-плана.', criteria: [{name: 'Не менее 40% бэклога аналитиков приходится на исследования.', points: '1 балл'}, {name: 'Не менее 20% бэклога приходится на исследования.', points: '0,5 балла'}, {name: 'Средняя оценка исследований с начала года не ниже 7,5.', points: '1 балл'}, {name: 'Есть минимум одна доходная или расходная инициатива сверх БП.', points: '1 балл'}]},
    {title: 'Клиентский опыт', text: 'CX Score рассчитывается по данным дашборда «Здоровье CX продуктов».', criteria: [{name: 'Зелёная зона CX Score.', points: '1 балл (100%)'}, {name: 'Жёлтая зона CX Score.', points: '0,5 балла (50%)'}]},
  ];
  const levels = [
    {range: '<40%', title: 'Требуют внимания', note: 'Нет устойчивого фундамента', tone: 'attention'},
    {range: '40–60%', title: 'Развивающиеся', note: 'База формируется', tone: 'developing'},
    {range: '61–80%', title: 'Зрелые', note: 'Практики работают регулярно', tone: 'mature'},
    {range: '81–100%', title: 'Лидеры Data-Driven', note: 'Ориентир для экосистемы', tone: 'leader'},
  ];
  return (
    <main className="content about-page">
      <SemanticButton className="about-back" intent={BUTTON_INTENT.navigation} onClick={onBack}><Icon data={ArrowLeft} size={16} /> К Summary</SemanticButton>
      <section className="about-hero">
        <div className="about-hero-main">
          <div className="about-eyebrow"><Icon data={CircleInfo} size={16} /><span>Методология Data Driven B2C</span></div>
          <h1>Методология Data-Driven Index</h1>
          <Text variant="body-2" color="secondary">Нормированная оценка зрелости практик работы с данными для продуктов, сегментов и каналов. Итоговый индекс рассчитывается по применимым критериям и дополняется профилем по отдельным блокам.</Text>
          <div className="about-hero-actions">
            <Button view="outlined-info" size="l" href="#assessment">Формула и шкала</Button>
            <Button view="flat" size="l" href="#practices">Критерии оценки</Button>
          </div>
        </div>
        <div className="about-method-summary" aria-label="Основные параметры методики">
          <div><span>Результат</span><strong>0–100%</strong><small>нормированный индекс</small></div>
          <div><span>Структура</span><strong>8 практик</strong><small>от ключевых метрик до клиентского опыта</small></div>
          <div><span>Основа</span><strong>Факт / максимум</strong><small>только применимые критерии</small></div>
          <div><span>Детализация</span><strong>По блокам</strong><small>для локализации отклонений</small></div>
        </div>
      </section>

      <nav className="about-nav" aria-label="Разделы методологии">
        <a href="#system">Принципы</a>
        <a href="#assessment">Формула и шкала</a>
        <a href="#practices">Критерии и баллы</a>
      </nav>

      <section className="about-section" id="system">
        <div className="about-section-heading"><Text variant="caption-2" color="secondary">ПРИНЦИПЫ ОЦЕНКИ</Text><h2>Как формируется индекс</h2><Text color="secondary">Расчёт строится на подтверждённых фактах и единой балльной модели. Итоговый процент сопоставим между командами только при одинаковой версии методики и расчётном периоде.</Text></div>
        <div className="about-elements">{principles.map((item) => <Card view="outlined" type="container" size="l" key={item.title}><div className="about-element-icon"><Icon data={item.icon} size={20} /></div><h3>{item.title}</h3><Text color="secondary">{item.text}</Text></Card>)}</div>
      </section>

      <section className="about-section about-diagnosis" id="assessment">
        <div className="about-maturity">
          <div className="about-maturity-head"><div><h2>Формула и уровни зрелости</h2><Text color="secondary">Data-Driven Index = Σ баллов по блокам / Σ максимальных применимых баллов × 100%. Итоговый процент определяет уровень зрелости команды.</Text></div></div>
          <ul className="about-levels">{levels.map((level) => <li className={`about-level about-level-${level.tone}`} key={level.title}><b>{level.range}</b><span>{level.title}</span><small>{level.note}</small></li>)}</ul>
        </div>
      </section>

      <section className="about-section" id="practices">
        <div className="about-practices-layout">
          <div className="about-practices-intro">
            <h2>Критерии<br />и максимальные баллы</h2>
            <Text className="about-practices-lead" color="secondary">Каждая практика раскрывается в набор измеримых критериев. Карточка команды показывает факт, максимум и статус по каждому применимому критерию.</Text>
            <div className="about-scoring-method"><span>Правило расчёта</span><b>В индекс входят только применимые критерии с заданным максимальным баллом.</b><small>Не применимые критерии исключаются и из набранных баллов, и из максимального балла команды.</small></div>
          </div>
          <div className="about-accordion-card">
            <Accordion view="top-bottom" size="l">
              {zones.map((zone, index) => <Accordion.Item key={zone.title} summary={<div className="about-zone-summary"><Label theme="utility">{String(index + 1).padStart(2, '0')}</Label><b>{zone.title}</b></div>}><div className="about-zone-detail"><Text color="secondary">{zone.text}</Text><div className="about-zone-criteria">{zone.criteria.map((criterion, criterionIndex) => <React.Fragment key={`${criterion.section || ''}-${criterion.name}-${criterion.points}`}>{criterion.section && criterion.section !== zone.criteria[criterionIndex - 1]?.section && <div className="about-zone-subgroup">{criterion.section}</div>}<div className="about-zone-criterion"><Label theme={criterion.excluded ? 'normal' : 'info'} size="xs">{criterion.points}</Label><span>{criterion.name}</span></div></React.Fragment>)}</div></div></Accordion.Item>)}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="about-method-notes" aria-labelledby="method-notes-title">
        <div><Text variant="caption-2" color="secondary">ИНТЕРПРЕТАЦИЯ</Text><h2 id="method-notes-title">Как читать результат</h2></div>
        <div className="about-method-note"><b>Итоговый индекс</b><span>Показывает общий уровень зрелости, но не заменяет разбор оценок по отдельным практикам.</span></div>
        <div className="about-method-note"><b>Профиль по блокам</b><span>Показывает, в каких практиках сформированы устойчивые процессы, а где остаются незакрытые критерии.</span></div>
        <div className="about-method-note"><b>A/B-тесты</b><span>Учитываются в индексе для применимых команд по факту и максимальному баллу из flat_table.xlsx.</span></div>
      </section>
    </main>
  );
}
