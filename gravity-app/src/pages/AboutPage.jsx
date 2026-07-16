import React, {useState} from 'react';
import {ArrowLeft, BarsAscendingAlignLeft, ChartColumn, ChartMixed, CircleInfo, Persons} from '@gravity-ui/icons';
import {Button, Card, Icon, Label, SegmentedRadioGroup, Text} from '@gravity-ui/uikit';
import methodologyProfiles from '../data/methodologyCriteria.json';
import {BUTTON_INTENT, SemanticButton} from '../shared/ui/SemanticButton.jsx';
import {groupMethodologySections, methodologyCriteria, methodologyScoreTheme} from './methodologyPresentation.js';
import {methodologyVerificationComment} from './methodologyVerification.js';

const METHODOLOGY_ENTITY_TYPES = [
  {key: 'product', label: 'Продукт'},
  {key: 'segment', label: 'Сегмент'},
  {key: 'channel', label: 'Канал'},
];

function MethodologyContent({body}) {
  return <div className="about-methodology-content">{methodologyCriteria(body).map((criterion, index) => <section className="about-methodology-criterion" key={`${criterion.title}-${index}`}>
    <header className="about-methodology-criterion-head"><span>{String(index + 1).padStart(2, '0')}</span><div><h4>{criterion.title}</h4>{criterion.description.map((text) => <Text color="secondary" key={text}>{text}</Text>)}</div></header>
    {criterion.scores.length > 0 && <div className="about-methodology-score-table"><div className="about-methodology-score-head"><span>Баллы</span><span>Условие</span></div>{criterion.scores.map((score, scoreIndex) => <div className="about-methodology-score" key={`${score.label}-${scoreIndex}`}><Label theme={methodologyScoreTheme(score.label)} size="xs">{score.label}</Label><span>{score.text}</span></div>)}</div>}
  </section>)}</div>;
}

export function AboutPage({onBack}) {
  const [methodologyEntityType, setMethodologyEntityType] = useState('product');
  const [methodologyProfileKey, setMethodologyProfileKey] = useState('product');
  const [methodologyGroupTitle, setMethodologyGroupTitle] = useState('');
  const availableProfiles = methodologyProfiles.filter((profile) => profile.entityType === methodologyEntityType);
  const activeProfile = availableProfiles.find((profile) => profile.key === methodologyProfileKey) || availableProfiles[0];
  const methodologyGroups = groupMethodologySections(activeProfile?.sections || []);
  const activeMethodologyGroup = methodologyGroups.find((group) => group.title === methodologyGroupTitle) || methodologyGroups[0];
  const selectMethodologyEntityType = (entityType) => {
    setMethodologyEntityType(entityType);
    setMethodologyProfileKey(methodologyProfiles.find((profile) => profile.entityType === entityType)?.key || '');
    setMethodologyGroupTitle('');
  };
  const selectMethodologyProfile = (profileKey) => {
    setMethodologyProfileKey(profileKey);
    setMethodologyGroupTitle('');
  };
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
          <div className="about-eyebrow"><Icon data={CircleInfo} size={16} /><span>Data Driven B2C</span></div>
          <h1>Что такое Data Driven</h1>
          <div className="about-hero-definition">
            <Text variant="body-2" color="secondary">Data Driven — это метод принятия решений, основанный на анализе данных, а не только на интуиции или личном опыте.</Text>
            <Text variant="body-2" color="secondary">Главный принцип — решения основываются на фактических данных и их анализе. При этом сами данные должны быть качественными и актуальными.</Text>
          </div>
          <div className="about-hero-actions">
            <Button view="outlined-info" size="l" href="#assessment">Формула и шкала</Button>
            <Button view="flat" size="l" href="#practices">Критерии оценки</Button>
          </div>
        </div>
        <div className="about-index-overview">
          <Text variant="caption-2" color="secondary">МЕТОДИКА ОЦЕНКИ</Text>
          <h2>Что такое Data-Driven Index</h2>
          <Text color="secondary">Data-Driven Index — это нормированная оценка зрелости практик работы с данными для продуктов, сегментов и каналов.</Text>
          <div className="about-index-equation" aria-label="Data-Driven Index равен сумме фактических баллов, делённой на сумму максимальных применимых баллов, умноженной на сто процентов">
            <span>Data-Driven Index</span>
            <strong>Σ фактических баллов / Σ максимальных применимых баллов × 100%</strong>
          </div>
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
          <div className="about-maturity-head"><div><h2>Формула Data-Driven Index</h2><Text color="secondary">Data-Driven Index — это нормированная оценка зрелости практик работы с данными для продуктов, сегментов и каналов.</Text></div></div>
          <Card className="about-formula-card" view="outlined" type="container" size="l">
            <div className="about-formula" aria-label="Data-Driven Index равен фактически набранные баллы, делённые на максимальный балл, умноженные на сто процентов">
              <strong>Data-Driven Index</strong>
              <span className="about-formula-sign">=</span>
              <span className="about-formula-fraction">
                <span>фактически набранные баллы</span>
                <span>максимальный балл</span>
              </span>
              <span className="about-formula-sign">× 100%</span>
            </div>
            <div className="about-formula-definitions">
              <div><b>Фактические баллы</b><span>Сумма баллов, которую продукт, канал или сегмент набрал по разделам чек-листа.</span></div>
              <div><b>Максимальный балл</b><span>Потолок для конкретного продукта, канала или сегмента за вычетом нерелевантных критериев.</span></div>
            </div>
            <div className="about-formula-example">
              <span>Пример</span>
              <p>Продукт набрал 15 баллов из 25 возможных.</p>
              <strong>Индекс = 15 / 25 × 100% = 60%</strong>
            </div>
          </Card>
          <div className="about-levels-heading"><h2>Уровни зрелости</h2><Text color="secondary">Итоговый процент определяет уровень зрелости.</Text></div>
          <ul className="about-levels">{levels.map((level) => <li className={`about-level about-level-${level.tone}`} key={level.title}><b>{level.range}</b><span>{level.title}</span><small>{level.note}</small></li>)}</ul>
        </div>
      </section>

      <section className="about-section" id="practices">
        <div className="about-practices-heading">
          <div><Text variant="caption-2" color="secondary">МЕТОДИКА ИЗ EXCEL</Text><h2>Критерии и баллы</h2><Text color="secondary">Выберите тип команды: список покажет только релевантные блоки, условия оценки и баллы из соответствующего столбца методики.</Text></div>
          <div className="about-scoring-method"><span>Правило расчёта</span><b>В индекс входят только применимые критерии с заданным максимальным баллом.</b><small>Не применимые критерии исключаются и из набранных баллов, и из максимального балла команды.</small></div>
        </div>

        <Card className="about-methodology-controls" view="outlined" type="container" size="l">
          <div className="about-methodology-controls-copy"><Text variant="subheader-1">Критерии для команды</Text><Text color="secondary">Сначала выберите объект оценки, затем нужное направление.</Text></div>
          <div className="about-methodology-switches">
            <div className="about-methodology-switch"><span>Объект оценки</span><SegmentedRadioGroup aria-label="Объект оценки" value={methodologyEntityType} onUpdate={selectMethodologyEntityType} size="l">{METHODOLOGY_ENTITY_TYPES.map((type) => <SegmentedRadioGroup.Option value={type.key} key={type.key}>{type.label}</SegmentedRadioGroup.Option>)}</SegmentedRadioGroup></div>
            {availableProfiles.length > 1 && <div className="about-methodology-switch"><span>Направление</span><SegmentedRadioGroup className="about-methodology-profile-switch" aria-label="Направление методики" value={activeProfile?.key || ''} onUpdate={selectMethodologyProfile} size="m">{availableProfiles.map((profile) => <SegmentedRadioGroup.Option value={profile.key} key={profile.key}>{profile.shortLabel}</SegmentedRadioGroup.Option>)}</SegmentedRadioGroup></div>}
          </div>
        </Card>

        {activeMethodologyGroup && <div className="about-methodology-browser">
          <nav className="about-methodology-blocks" aria-label="Ключевые блоки Data Driven"><div className="about-methodology-blocks-head">Ключевые блоки Data Driven</div>{methodologyGroups.map((group, index) => <Button className="about-methodology-block-button" view="flat" pin="clear-clear" width="max" selected={group.title === activeMethodologyGroup.title} onClick={() => setMethodologyGroupTitle(group.title)} key={group.title}><span><small>{String(index + 1).padStart(2, '0')}</small><span className="about-methodology-block-title">{group.title}</span></span></Button>)}</nav>
          <section className="about-methodology-panel"><header className="about-methodology-panel-head"><div><Text variant="caption-2" color="secondary">{activeProfile.shortLabel}</Text><h3>{activeMethodologyGroup.title}</h3></div></header><div className="about-methodology-subsections">{activeMethodologyGroup.subsections.map((section) => {
            const verificationComment = methodologyVerificationComment(activeProfile.key, activeMethodologyGroup.title, section.subgroup);
            return <section className="about-methodology-subsection" key={`${section.sourceRow}-${section.subgroup}`}><div className="about-methodology-subsection-head"><Label theme={section.subgroup ? 'info' : 'utility'} size="s">{section.subgroup || 'Критерии'}</Label></div>{verificationComment && <div className="about-methodology-verification"><Icon data={CircleInfo} size={16} /><div><b>Источник оценки</b><span>{verificationComment}</span></div></div>}<MethodologyContent body={section.body} /></section>;
          })}</div></section>
        </div>}
      </section>

    </main>
  );
}
