import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, ArrowUpRightFromSquare, ChartLinePoints, ChevronDown, ChevronRight, CircleCheckFill, CircleInfo, CircleInfoFill, NodesRight} from '@gravity-ui/icons';
import {Alert, Button, Card, Dialog, Disclosure, HelpMark, Icon, Label, Link, Progress, SegmentedRadioGroup, Select, Text, Tooltip as GravityTooltip} from '@gravity-ui/uikit';
import {Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip} from 'recharts';
import {COMPLEX_REPORT_URL, HELP_POPOVER_PROPS, REPORT_ACCESS_REQUEST_URL, ProductRadarTick, blockPercent, collectBlockLinks, compareNames, difficultyMeta, filterInapplicableMetricGroups, filterInapplicableMetricSubgroups, filterMetricsForBlock, groupFor, inapplicableMetricLabel, isCrossSellDigitallyConfirmed, isInformationalMetric, isTbdMetric, isVisibleMetric, linksForBlock, maturityTheme, metricDomId, metricGroup, metricWord, percent, pilotToolLinks, progressTheme, radarSeries, scoreFor, teamHelpAudience, typeTone} from '../features/catalog/Catalog.jsx';
import {BUTTON_INTENT, SemanticButton} from '../shared/ui/SemanticButton.jsx';
import {
  ProductMetricBlocks,
  ProductMetricRecommendations,
  digestStatus,
  digestTheme,
  hasAvailableRecommendations,
  recommendationBlockCode,
  worstDigestLight,
} from '../features/llm-summary/LlmSummary.jsx';

const CROSS_SELL_ANALYTICS_URL = 'https://losshunter.ru/showcase/crosssell/#screen=pult';
const AB_TEST_INSTRUCTION_LINKS = [
  {label: 'Онлайн курс по A/B', href: 'https://hr.sberbank.ru/platform/catalog/c515dcab-a8b7-4f03-a76a-e1b7349f857d'},
  {label: 'Демо A/B-платформы', href: 'https://sbervideo.sberbank.ru/watch/kpgpJi35gzwMIVu3X51'},
];

function MetricInlineAction({title, subtitle, href, onClick, tone = 'info', actionLabel = 'Перейти'}) {
  const className = `metric-inline-instruction metric-inline-instruction-button metric-inline-instruction-${tone}`;
  const content = <><span className="metric-inline-instruction-icon"><Icon data={CircleInfo} size={15} /></span><span className="metric-inline-instruction-copy"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span><span className="metric-inline-instruction-action">{actionLabel} <Icon data={ChevronRight} size={13} /></span></>;
  return href
    ? <Link className={className} href={href} target="_blank" rel="noreferrer">{content}</Link>
    : <button className={className} type="button" onClick={onClick}>{content}</button>;
}

function MetricInlineResources({title, actions}) {
  if (!actions.length) return null;
  return <div className="metric-inline-instruction metric-inline-instruction-button metric-inline-instruction-resources"><span className="metric-inline-instruction-icon"><Icon data={CircleInfo} size={15} /></span><span className="metric-inline-instruction-copy"><strong>{title}</strong></span><span className="metric-inline-instruction-resource-actions">{actions.map((action) => <a href={action.href} target="_blank" rel="noreferrer" key={`${action.label}-${action.href}`}>{action.label}<Icon data={ChevronRight} size={13} /></a>)}</span></div>;
}

function metricAiInsight(subject, onClick) {
  const labels = {
    'динамике MAU': 'Динамика MAU',
    'черновикам в СБОЛ': 'Черновики в СБОЛ',
    'воронке кампейнинга': 'Воронка кампейнинга',
    'воронке оформления в СБОЛ': 'Оформление в СБОЛ',
    'CSI': 'CSI',
    'жалобам и обращениям': 'Жалобы и обращения',
  };
  return {
    title: `AI-анализ по ${subject}`,
    label: labels[subject] || subject,
    tone: 'info',
    onClick,
  };
}

function MetricActionGroup({title, actions, icon = ChartLinePoints}) {
  if (!actions.length) return null;
  return <div className="metric-ai-actions"><span className="metric-ai-actions-title"><Icon data={icon} size={15} /><strong>{title}</strong></span><div className="metric-ai-actions-buttons">{actions.map((action) => action.href ? <a href={action.href} target="_blank" rel="noreferrer" key={`${action.label}-${action.href}`}>{action.label}<Icon data={ChevronRight} size={13} /></a> : <button type="button" onClick={action.onClick} key={action.title}>{action.label}<Icon data={ChevronRight} size={13} /></button>)}</div></div>;
}

function GoalsHelpContent() {
  return <div className="goals-help-content"><p>Метрические цели, факторный анализ (драйверы 1–2 уровня), прогноз по целям и драйверам выведены на мониторинг и доступны ЛТ/ЛЮ.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — мониторинг в Навигаторе (учитывается, если выведено более 90% целей и лидер продукта знает про BI-дашборд).</li><li><b>0,5 балла (50%)</b> — мониторинг в локальной отчётности (не в Навигаторе).</li><li><b>0 баллов (0%)</b> — мониторинг отсутствует.</li></ul></div>;
}

function AlertsHelpContent({audience}) {
  const isSegment = ['age', 'income'].includes(audience);
  const isDigitalChannel = audience === 'digital-channel';
  if (isSegment) {
    return <div className="goals-help-content"><p>Настроены автоматические алерты по бизнес-метрикам.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — настроены автоматические алерты по всем ключевым метрикам.</li><li><b>0,5 балла (50%)</b> — алерты настроены частично.</li></ul></div>;
  }
  const scope = isDigitalChannel
    ? 'системным сбоям (событиям в IT-инфраструктуре, которые приводят к недоступности или некорректной работе продукта для клиентов), бизнес-метрикам и проблемам, связанным с UX и пользовательским опытом'
    : 'системным сбоям (событиям в IT-инфраструктуре, которые приводят к недоступности или некорректной работе продукта для клиентов) и бизнес-метрикам';
  return <div className="goals-help-content"><p>Настроены автоматические алерты по {scope}.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — {isDigitalChannel ? 'алерты настроены на все ключевые метрики.' : 'настроены алерты по системным сбоям и бизнес-метрикам.'}</li><li><b>0,5 балла (50%)</b> — {isDigitalChannel ? 'алерты настроены частично.' : 'алерты настроены частично: по системным сбоям или бизнес-метрикам.'}</li></ul></div>;
}

function FunnelReportingHelpContent({title, description, completenessTitle, reportScope, includeMissing = false}) {
  return <div className="goals-help-content attract-reporting-help-content">
    <section><p>{title}{description ? ` ${description}` : ''}</p><strong>Оценка:</strong><ul><li><b>0,5 балла (100%)</b> — формируется автоматически.</li><li><b>0,25 балла (50%)</b> — формируется по запросу.</li>{includeMissing && <li><b>0 баллов (0%)</b> — отчётность отсутствует.</li>}</ul></section>
    <section><p>{completenessTitle}</p><strong>Оценка:</strong><ul><li><b>0,5 балла (100%)</b> — комплексный отчёт ({reportScope}).</li><li><b>0,25 балла (50%)</b> — неполный отчёт.</li></ul></section>
  </div>;
}

function FunnelAnalysisHelpContent({title, analysisScope}) {
  return <div className="goals-help-content attract-reporting-help-content">
    <section><p>{title}</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — комплексный анализ ({analysisScope}).</li><li><b>0,5 балла (50%)</b> — неполный анализ.</li></ul></section>
    <section><p>Перечень инициатив по отклонениям.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — составлен перечень инициатив.</li><li><b>0,5 балла (50%)</b> — перечень отсутствует.</li></ul></section>
    <section><p>Бенчмарки по показателям воронки: цели, динамика, рыночные бенчмарки.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — есть бенчмарки.</li><li><b>0 баллов (0%)</b> — бенчмарки отсутствуют.</li></ul></section>
  </div>;
}

function AttractCampaigningHelpContent() {
  return <div className="goals-help-content attract-reporting-help-content">
    <p>Использование централизованного кампейнинга/Self service (в расчёт идут данные предыдущего квартала, чтобы кампании успели вызреть).</p>
    <section>
      <p>Наличие запусков кампаний с результатом.</p>
      <strong>Оценка:</strong>
      <ul><li><b>0,5 балла (100%)</b> — есть запуски с результатом.</li><li><b>0 баллов (0%)</b> — запуски отсутствуют.</li></ul>
    </section>
    <section>
      <p>Наличие успешных бизнес-запусков.</p>
      <strong>Оценка:</strong>
      <ul><li><b>0,5 балла (100%)</b> — есть успешные бизнес-запуски.</li><li><b>0 баллов (0%)</b> — успешные бизнес-запуски отсутствуют.</li></ul>
    </section>
    <section>
      <p>Использование Self service.</p>
      <strong>Оценка:</strong>
      <ul><li><b>0,5 балла (100%)</b> — настроен Self service.</li><li><b>0 баллов (0%)</b> — Self service отсутствует.</li></ul>
    </section>
    <section>
      <p>Наличие запусков кампаний коммуникаций по черновикам (брошенные корзины) в СБОЛ за квартал.</p>
      <strong>Оценка:</strong>
      <ul><li><b>1 балл (100%)</b> — покрытие черновиками ≥70% от потенциала продукта.</li><li><b>0,5 балла (50%)</b> — покрытие черновиками &lt;70%, но больше 15% от потенциала продукта.</li></ul>
    </section>
  </div>;
}

const PRODUCT_FUNNEL_HELP = {
  'attract|отчетность': {type: 'reporting', label: 'Критерии оценки отчётности по воронке привлечения', title: 'Настроена регулярная отчётность по воронке привлечения/оформления.', description: 'Учитываются все поверхности: ClickStream, Навигатор и другая отчётность.', completenessTitle: 'Полнота отчёта по воронке привлечения.', reportScope: 'источники привлечения, пошаговая воронка, CR (% конверсии), объёмы, механики, сегментный или когортный разрез, UX/UI', includeMissing: true},
  'attract|анализ': {type: 'analysis', label: 'Критерии оценки анализа воронки привлечения', title: 'Анализ воронки привлечения/оформления.', analysisScope: 'анализ процесса оформления продукта, сравнение с конкурентами, кампании продаж, ключевые точки потери клиентов'},
  'attract|кампейнинг': {type: 'campaigning', label: 'Критерии оценки кампейнинга'},
  'churn|отчетность': {type: 'reporting', label: 'Критерии оценки отчётности по воронке оттока', title: 'Настроена регулярная отчётность по воронке оттока, закрытию продукта и пролонгации.', description: 'Учитываются все поверхности: ClickStream, Навигатор и другая отчётность.', completenessTitle: 'Полнота отчёта по воронке оттока.', reportScope: 'источники привлечения, пошаговая воронка, CR (% конверсии), объёмы, механики, сегментный или когортный разрез, UX/UI', includeMissing: true},
  'churn|анализ': {type: 'analysis', label: 'Критерии оценки анализа воронки оттока', title: 'Анализ воронки оттока, закрытия продукта и пролонгации.', analysisScope: 'пошаговая воронка, CTR, объёмы, сегментный или когортный разрез, retention, механики удержания, UX/UI'},
};

const SEGMENT_FUNNEL_HELP = {
  'attract|отчетность': {type: 'reporting', label: 'Критерии оценки отчётности по воронке привлечения', title: 'Настроена регулярная отчётность по воронке привлечения.', description: 'Учитываются все поверхности: ClickStream, Навигатор и другая отчётность.', completenessTitle: 'Полнота отчёта по воронке привлечения.', reportScope: 'источники привлечения, пошаговая воронка, CR (% конверсии), кросс-перетоки, объёмы, механики, сегментный или когортный разрез', includeMissing: true},
  'attract|анализ': {type: 'analysis', label: 'Критерии оценки анализа воронки привлечения', title: 'Анализ воронки привлечения.', analysisScope: 'анализ CJM, конверсия на каждом шаге воронки, анализ входящего потока, кампании продаж, продукты-драйверы притока'},
  'churn|анализ': {type: 'analysis', label: 'Критерии оценки анализа воронки оттока', title: 'Анализ воронки оттока.', analysisScope: 'предотточные сигналы, анализ CJM, конверсия на каждом шаге воронки, кампании удержания, выявление ключевых точек потери клиентов'},
};

const DIGITAL_CHANNEL_FUNNEL_HELP = {
  'attract|отчетность': {type: 'reporting', label: 'Критерии оценки отчётности по воронке привлечения', title: 'Настроена регулярная отчётность по воронке привлечения по каналам и поверхностям.', completenessTitle: 'Полнота отчёта по воронке привлечения.', reportScope: 'каналы привлечения, пошаговая воронка, CR и CTR, объёмы коммуникаций, количество целевых действий, сегментный или когортный разрез, UX/UI-дизайн'},
  'attract|анализ': {type: 'analysis', label: 'Критерии оценки анализа воронки привлечения', title: 'Анализ воронки привлечения по каналам и поверхностям.', analysisScope: 'сравнение с конкурентами процесса оформления и условий продукта или мониторинг новых функций; воронка внутри кампаний, количество достигших целевого действия и оценка результативности кампаний; A/B-тесты; сегментный или когортный анализ; UX/UI'},
  'voronka_onbordinga|отчетность': {type: 'reporting', label: 'Критерии оценки отчётности по воронке онбординга', title: 'Настроена регулярная отчётность по воронке онбординга.', completenessTitle: 'Полнота отчёта по воронке онбординга.', reportScope: 'источники привлечения, количество входов, пошаговая воронка, количество или доля клиентов с целевым действием, время до целевого действия, UX/UI'},
  'voronka_onbordinga|анализ': {type: 'analysis', label: 'Критерии оценки анализа воронки онбординга', title: 'Анализ воронки онбординга.', analysisScope: 'сравнение с конкурентами процесса оформления и условий продукта или мониторинг новых функций; воронка внутри кампаний, количество достигших целевого действия и оценка результативности кампаний; A/B-тесты; сегментный или когортный анализ; UX/UI'},
  'churn|отчетность': {type: 'reporting', label: 'Критерии оценки отчётности по воронке оттока', title: 'Настроена регулярная отчётность по воронке оттока и снижению активности в канале.', completenessTitle: 'Полнота отчёта по воронке оттока.', reportScope: 'определение предотточных клиентов, сегментный или когортный разрез, когортный retention, механики удержания, % оттока'},
  'churn|анализ': {type: 'analysis', label: 'Критерии оценки анализа воронки оттока', title: 'Анализ воронки оттока и снижения активности в канале.', analysisScope: 'процесс использования канала: время в канале, количество просмотренных страниц и отзывы; топ-3 фактора и причины потери клиентов; сегментный или когортный анализ; A/B-тесты'},
};

const SERVICE_CHANNEL_FUNNEL_HELP = {
  'voronka_vhoda_v_kanal|отчетность': {type: 'reporting', label: 'Критерии оценки отчётности по воронке входа в канал', title: 'Настроена регулярная отчётность по воронке входа в канал.', description: 'Воронка отражает общий объём входящего трафика и распределение первой волны входа: бот, оператор, отложенные обращения.', completenessTitle: 'Полнота отчёта по воронке входа в канал.', reportScope: 'пошаговая воронка, CR, % автоматизации, % отложенных обращений, % закрытых обращений, CSAT'},
  'voronka_vhoda_v_kanal|анализ': {type: 'analysis', label: 'Критерии оценки анализа воронки входа в канал', title: 'Анализ воронки входа в канал.', analysisScope: 'доля обращений, переведённых на оператора; CR; топ-3 причины или тематики перехода на оператора; доля обращений, ушедших в отложенные; причины, по которым обращения не решены в моменте'},
};

const TELEMARKETING_FUNNEL_HELP = {
  'voronka_prodazh|отчетность': {type: 'reporting', label: 'Критерии оценки отчётности по воронке продаж', title: 'Настроена регулярная отчётность по воронке продаж.', description: 'Воронка отражает общий объём исходящего трафика и распределение первой волны дозвона: бот, оператор, целевое действие, отказ, недозвоны.', completenessTitle: 'Полнота отчёта по воронке продаж.', reportScope: 'пошаговая воронка, CR в целевое действие, % недозвонов, % отказов и согласий, CSAT'},
  'voronka_prodazh|анализ': {type: 'analysis', label: 'Критерии оценки анализа воронки продаж', title: 'Анализ воронки продаж.', analysisScope: 'объём трафика, доля дозвонов, CR от входа до целевого действия, топ-3 причины отказов, доля недозвонов по волнам, оптимальность волн и времени'},
};

const FUNNEL_HELP_BY_AUDIENCE = {
  product: PRODUCT_FUNNEL_HELP,
  age: SEGMENT_FUNNEL_HELP,
  income: SEGMENT_FUNNEL_HELP,
  'digital-channel': DIGITAL_CHANNEL_FUNNEL_HELP,
  'service-channel': SERVICE_CHANNEL_FUNNEL_HELP,
  telemarketing: TELEMARKETING_FUNNEL_HELP,
};

const PRODUCT_MECHANICS_HELP = {
  'mehaniki.nalichie_sobstvennyh_mehanik': [],
  'mehaniki.uderzhanie_klientov': [{title: 'Удержание клиентов.', items: [['1 балл (100%)', 'через создание ценности.'], ['0,5 балла (50%)', 'только через информационную коммуникацию.']]}],
  'mehaniki.vozvrat_klientov': [{title: 'Возврат клиентов.', items: [['1 балл (100%)', 'через создание ценности.'], ['0,5 балла (50%)', 'только через информационную коммуникацию.']]}],
  'mehaniki.cross_sell': [{title: 'Перекрёстные продажи (cross-sell).', items: [['1 балл (100%)', 'в процессе оформления и после покупки.'], ['0,5 балла (50%)', 'в процессе оформления или после покупки.']]}],
  'mehaniki.doprodazhi_upsell': [{title: 'Дополнительные продажи (upsell).', items: [['1 балл (100%)', 'механика настроена.']]}],
  'mehaniki.gibkoe_izmenenie_usloviy_produkta': [{title: 'Гибкость изменений без IT. Ценообразование не учитывается.', items: [['1 балл (100%)', 'изменение условий с персонализацией до клиентских подсегментов.'], ['0,5 балла (50%)', 'изменение набора опций без персонализации.']]}],
  'mehaniki.monitoring_mehanik': [{title: 'Мониторинг эффективности механик.', items: [['0,25 балла (100%)', 'есть метрики мониторинга.']]}],
};

const AGE_SEGMENT_MECHANICS_HELP = {
  'mehaniki.personalizaciya_klientskogo_opyta': [{title: 'Персонализация клиентского опыта.', description: 'Контент под сегмент, онбординг, персонализация главного экрана, кастомизация приложения, персональный CRM.', items: [['1 балл (100%)', 'настроена по всем компонентам.'], ['0,5 балла (50%)', 'настроена частично.']]}],
  'mehaniki.privlechenie_klientov': [{title: 'Привлечение клиентов.', items: [['1 балл (100%)', 'настроено по всем компонентам.'], ['0,5 балла (50%)', 'настроено частично.']]}],
  'mehaniki.uderzhanie_klientov': [
    {title: 'Удержание клиентов.', description: 'Информационная коммуникация, персональный оффер, бесшовный переход в другой сегмент.', items: [['1 балл (100%)', 'удержание клиентов через создание ценности.'], ['0,5 балла (50%)', 'удержание клиентов только через информационную коммуникацию.']]},
    {items: [['1 балл (100%)', 'механики базируются на ML-моделях определения потенциала клиентов или моделях склонности к оттоку, есть сценарные запуски.'], ['0,5 балла (50%)', 'механики запускаются вручную.']]},
  ],
  'mehaniki.reagirovanie_na_zhiznennye_sobytiya': [{title: 'Реагирование на жизненные события.', description: 'Настроены сообщения поздравительного характера, релевантные предложения продуктов банка, специальные предложения и промо.', items: [['1 балл (100%)', 'настроено по всем компонентам.'], ['0,5 балла (50%)', 'настроено частично.']]}],
  'mehaniki.monitoring_mehanik': [{title: 'Мониторинг эффективности механик.', items: [['0,25 балла (100%)', 'есть метрики мониторинга.']]}],
};

const INCOME_SEGMENT_MECHANICS_HELP = {
  ...AGE_SEGMENT_MECHANICS_HELP,
  'mehaniki.uderzhanie_klientov': [
    {title: 'Удержание клиентов.', description: 'Информационная коммуникация, персональный оффер, бесшовный переход в другой сегмент.', items: [['1 балл (100%)', 'удержание клиентов через создание ценности.'], ['0,5 балла (50%)', 'удержание клиентов только через информационную коммуникацию.']]},
    {items: [['1 балл (100%)', 'механики базируются на ML-моделях определения потенциала клиентов или моделях склонности к оттоку, есть сценарные запуски.'], ['0,5 балла (50%)', 'механики базируются на ручном мониторинге.']]},
  ],
  'mehaniki.vozvrat_klientov': [{title: 'Возврат клиентов.', items: [['1 балл (100%)', 'через создание ценности.'], ['0,5 балла (50%)', 'только через информационную коммуникацию.']]}],
  'mehaniki.povyshenie_urovnya_klienta': [{title: 'Миграция вверх (повышение уровня).', description: 'Информационная коммуникация, персональный оффер, пробный период для потенциальных клиентов.', items: [['1 балл (100%)', 'настроена для сегмента.'], ['0,5 балла (50%)', 'настроена частично.']]}],
};

const DIGITAL_CHANNEL_MECHANICS_HELP = {
  'mehaniki.uderzhanie_klientov': [{title: 'Удержание клиентов.', items: [['1 балл (100%)', 'через создание ценности.'], ['0,5 балла (50%)', 'только через информационную коммуникацию.']]}],
  'mehaniki.vozvrat_klientov': [{title: 'Возврат клиентов.', items: [['1 балл (100%)', 'через создание ценности.'], ['0,5 балла (50%)', 'только через информационную коммуникацию.']]}],
  'mehaniki.personalizaciya_interfeysa_kontenta': [{title: 'Персонализация интерфейса, контента и рекомендаций.', items: [['1 балл (100%)', 'механика настроена.']]}],
  'mehaniki.stimulirovanie_klienta': [{title: 'Стимулирование клиента.', description: 'Геймификация, push-уведомления, побуждающие рассылки и другие механики.', items: [['1 балл (100%)', 'механика настроена.']]}],
  'mehaniki.obuchayuschie_mehaniki': [{title: 'Обучающие механики.', description: 'Подсказки, пошаговое знакомство и другие обучающие сценарии.', items: [['1 балл (100%)', 'механика настроена.']]}],
  'mehaniki.gibkoe_izmenenie_usloviy_produkta': [{title: 'Гибкость изменений без IT.', items: [['1 балл (100%)', 'изменения учитывают персонализацию до клиентских подсегментов.'], ['0,5 балла (50%)', 'изменяется набор опций без персонализации.']]}],
  'mehaniki.monitoring_mehanik': [{title: 'Мониторинг эффективности механик.', items: [['0,25 балла (100%)', 'есть метрики мониторинга.']]}],
};

const SERVICE_CHANNEL_MECHANICS_HELP = {
  'mehaniki.avtomatizacii': [{title: 'Автоматизация.', description: 'Автоклассификация обращений, распределение очередей, сплитов и лидов.', items: [['1 балл (100%)', 'механика настроена.']]}],
  'mehaniki.informirovaniya_klienta': [{title: 'Информирование клиента о статусе обращения.', items: [['1 балл (100%)', 'механика настроена.']]}],
  'mehaniki.personalizaciya': [{title: 'Персонализация скриптов.', description: 'Разные скрипты и предложения для разных сегментов вплоть до конкретного человека; скрипт меняется в зависимости от волны контакта.', items: [['1 балл (100%)', 'настроена по большинству компонентов.'], ['0,5 балла (50%)', 'настроена частично.']]}],
  'mehaniki.kontrolya_kachestva_rechi': [{title: 'Контроль качества речи.', description: 'Автоматический анализ обязательных фраз и соблюдения скрипта, выборочные прослушивания, подсказки оператору в реальном времени.', items: [['1 балл (100%)', 'настроен по большинству компонентов.'], ['0,5 балла (50%)', 'настроен частично.']]}],
  'mehaniki.uderzhaniya_klienta': [{title: 'Удержание клиента.', description: 'При обращении клиента по закрытию продукта настроен специальный сценарий удержания или механики upsell.', items: [['1 балл (100%)', 'механика настроена.']]}],
};

const TELEMARKETING_MECHANICS_HELP = {
  ...SERVICE_CHANNEL_MECHANICS_HELP,
  'mehaniki.nailuchshego_vremeni_zvonka': [{title: 'Наилучшее время звонка.', description: 'Механика настроена для всех клиентов либо только для определённой доли клиентов или сегмента.', items: [['1 балл (100%)', 'настроена полностью.'], ['0,5 балла (50%)', 'настроена частично.']]}],
};

const MECHANICS_BLOCK_HELP = {
  'digital-channel': [{title: 'Информирование клиента о статусе обращения.', items: [['1 балл (100%)', 'механика настроена.']]}],
  'service-channel': [{title: 'Мониторинг эффективности механик.', items: [['0,25 балла (100%)', 'есть метрики мониторинга.']]}],
  telemarketing: [{title: 'Мониторинг эффективности механик.', items: [['0,25 балла (100%)', 'есть метрики мониторинга.']]}],
};

function MechanicsHelpContent({audience, sections}) {
  const entity = audience === 'product' ? 'продукту' : ['age', 'income'].includes(audience) ? 'сегменту' : 'каналу';
  return <div className="goals-help-content mechanics-metric-help-content"><p>Наличие настроенных механик по {entity}.</p>{sections.map((section, index) => <section key={`${section.title || 'score'}-${index}`}>{section.title && <p>{section.title}</p>}{section.description && <p>{section.description}</p>}{section.items?.length > 0 && <><strong>Оценка:</strong><ul>{section.items.map(([score, description]) => <li key={`${score}-${description}`}><b>{score}</b> — {description}</li>)}</ul></>}</section>)}</div>;
}

function MechanicsMetricHelp({metric, product}) {
  const audience = teamHelpAudience(product);
  const helpByMetric = {
    product: PRODUCT_MECHANICS_HELP,
    age: AGE_SEGMENT_MECHANICS_HELP,
    income: INCOME_SEGMENT_MECHANICS_HELP,
    'digital-channel': DIGITAL_CHANNEL_MECHANICS_HELP,
    'service-channel': SERVICE_CHANNEL_MECHANICS_HELP,
    telemarketing: TELEMARKETING_MECHANICS_HELP,
  }[audience];
  const code = String(metric?.code || '').trim().toLowerCase();
  const sections = helpByMetric?.[code];
  if (!sections) return null;
  return <span className="mechanics-metric-help"><HelpMark aria-label={`Критерии оценки: ${metric.name}`} popoverProps={HELP_POPOVER_PROPS}><MechanicsHelpContent audience={audience} sections={sections} /></HelpMark></span>;
}

function CxHelpContent({audience}) {
  if (audience === 'digital-channel') {
    return <div className="goals-help-content"><p>Зеленая зона UX Score.</p><p>UX Score определяет вес каждой UX-проблемы на основе разметки задач в Jira, затем вычисляет итоговую метрику команды, продукта или трайба на основе связанных с ними задач.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — зеленая зона UX Score.</li><li><b>0,5 балла (100%)</b> — желтая зона UX Score.</li></ul></div>;
  }
  return <div className="goals-help-content"><p>CX Score рассчитывается на основе данных дашборда «Здоровье CX продуктов».</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — зелёная зона CX Score.</li><li><b>0,5 балла (50%)</b> — жёлтая зона CX Score.</li></ul></div>;
}

function HypothesesHelpContent({audience}) {
  const isSegment = ['age', 'income'].includes(audience);
  const source = isSegment || audience === 'product'
    ? 'анализ бэклога в Jira/Сбертрек на основе LLM-модели'
    : 'самооценка продукта и верификация по цифровым следам Jira/Сбертрек';
  return <div className="goals-help-content attract-reporting-help-content">
    <section><p>Доля задач аналитиков по продукту, связанных с исследованиями ({source}).</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — не менее 40% бэклога приходится на исследования.</li><li><b>0,5 балла (50%)</b> — не менее 20% бэклога приходится на исследования.</li></ul></section>
    {!isSegment && <section><p>Наличие дополнительных инициатив в реестре инициатив сверх бизнес-плана. Учитываются доходные и расходные инициативы.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — есть минимум одна инициатива.</li></ul></section>}
    <section><p>Оценка исследований по шкале DataDriven. В расчёт входят все исследования с начала года.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — средняя оценка не ниже 7,5.</li></ul></section>
    <section><p>Выполнен план по запуску A/B-тестов.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — проведено не менее 80% A/B-тестов от общего числа инициатив, подходящих под критерии A/B.</li><li><b>0,5 балла (50%)</b> — проведено не менее 30% A/B-тестов от общего числа инициатив, подходящих под критерии A/B.</li><li><b>0 баллов (0%)</b> — есть план по A/B, но тесты отсутствуют.</li></ul></section>
  </div>;
}

function ProductBlockHelp({blockCode, product}) {
  const audience = teamHelpAudience(product);
  const knownAudience = ['product', 'age', 'income', 'digital-channel', 'service-channel', 'telemarketing'].includes(audience);
  if (!knownAudience) return null;
  if (blockCode === 'cx' && !['product', 'digital-channel'].includes(audience)) return null;
  if (blockCode === 'mehaniki' && !MECHANICS_BLOCK_HELP[audience]) return null;
  const help = {
    goals: {label: 'Критерии оценки мониторинга целей', content: <GoalsHelpContent />},
    alerts: {label: 'Критерии оценки алертов', content: <AlertsHelpContent audience={audience} />},
    cx: {label: audience === 'digital-channel' ? 'Критерии оценки UX Score' : 'Критерии оценки клиентского опыта', content: <CxHelpContent audience={audience} />},
    hyp: {label: 'Критерии оценки гипотез и инициатив', content: <HypothesesHelpContent audience={audience} />},
    mehaniki: {label: 'Дополнительные критерии оценки механик', content: <MechanicsHelpContent audience={audience} sections={MECHANICS_BLOCK_HELP[audience] || []} />},
  }[blockCode];
  return help ? <HelpMark aria-label={help.label} popoverProps={HELP_POPOVER_PROPS}>{help.content}</HelpMark> : null;
}

function ProductMetricGroupHelp({blockCode, group, product}) {
  const key = `${blockCode}|${String(group || '').toLowerCase()}`;
  const audience = teamHelpAudience(product);
  const help = FUNNEL_HELP_BY_AUDIENCE[audience]?.[key];
  if (!help) return null;
  const content = help.type === 'reporting'
    ? <FunnelReportingHelpContent {...help} />
    : help.type === 'analysis'
      ? <FunnelAnalysisHelpContent {...help} />
      : <AttractCampaigningHelpContent />;
  return <HelpMark aria-label={help.label} popoverProps={HELP_POPOVER_PROPS}>{content}</HelpMark>;
}

function IndexFormulaHelp() {
  return <div className="index-formula-help"><div>Data-Driven Index = Σ баллов по блокам / Σ максимальных применимых баллов × 100%</div><p>Не применимые критерии исключаются и из набранных баллов, и из максимального балла продукта.</p></div>;
}

function DigitalTraceConfirmation() {
  const message = 'Подтверждено на Цифровых следах';
  return <GravityTooltip content={message} openDelay={200}><span className="metric-digital-trace-confirmation" tabIndex={0} aria-label={message}><Icon data={CircleCheckFill} size={16} /></span></GravityTooltip>;
}

function MetricRow({metric, product, detailScore, instruction, instructionLinks = [], library, zeroAction, aiMetricInsight, aiMetricInsights = [], pilotActions = [], grouped, digitallyConfirmed}) {
  const value = percent(metric.value, metric.max_value);
  const theme = metric.max_value ? progressTheme(value) : 'default';
  const isTbd = isTbdMetric(metric);
  const isInformational = isInformationalMetric(metric);
  const showInformationalBadge = isInformational && !/^регулярность$/i.test(String(metric.name || '').trim());
  const isIrrelevant = metric.is_applicabble_flg === false && !isTbd;
  const isNotApplicable = metric.is_applicabble_flg === false;
  const isMissingCxTeam = isNotApplicable && /^cx score$/i.test(String(metric.name || '').trim());
  const unavailableLabel = isMissingCxTeam ? 'Команда еще не добавлена' : inapplicableMetricLabel(metric);
  const status = isTbd
    ? {label: 'TBD', theme: 'normal'}
    : isNotApplicable
      ? {label: unavailableLabel, theme: 'normal'}
    : Number(metric.max_value) > 0
      ? {
          label: `${value}%`,
          theme: Number(metric.value) >= Number(metric.max_value) ? 'success' : Number(metric.value) > 0 ? 'warning' : 'danger',
        }
      : {label: 'Нет данных', theme: 'normal'};
  const valueLabel = isTbd
    ? 'TBD'
    : isIrrelevant
    ? unavailableLabel
    : metric.max_value
      ? `Набрано ${metric.value} баллов из ${metric.max_value}`
      : 'Нет данных';
  const lightTheme = detailScore ? (isTbd ? 'default' : theme) : (status.theme === 'normal' ? 'default' : status.theme);
  const insights = [...(aiMetricInsight ? [aiMetricInsight] : []), ...aiMetricInsights];
  const mechanicsHelp = <MechanicsMetricHelp metric={metric} product={product} />;
  return (
    <div id={metricDomId(metric.code)} className={`metric-row${detailScore ? '' : ' metric-row-status'}${grouped ? ' metric-row-grouped' : ''}${isIrrelevant ? ' metric-row-irrelevant' : ''}${isTbd ? ' metric-row-tbd' : ''}`}>
      <div className="metric-copy"><i className={`metric-light metric-light-${lightTheme}`} aria-hidden="true" /><div><div className="metric-name-line"><b>{metric.name}</b>{showInformationalBadge && <GravityTooltip content="Информационная метрика, не влияет на расчет" openDelay={200}><span className="metric-info-icon" tabIndex={0} aria-label="Информационная метрика, не влияет на расчет"><Icon data={CircleInfoFill} size={14} /></span></GravityTooltip>}</div>{metric.footer && <span>{metric.footer}</span>}</div></div>
      <div className="metric-value">{detailScore ? <><div className="metric-value-caption">{digitallyConfirmed && <DigitalTraceConfirmation />}{mechanicsHelp}<span className="metric-value-label">{valueLabel}</span></div>{metric.is_applicabble_flg !== false && !isTbd && <Progress value={value} theme={theme} size="xs" />}</> : <div className="metric-status-with-confirmation">{digitallyConfirmed && <DigitalTraceConfirmation />}{mechanicsHelp}<Label className="metric-status-label" theme={status.theme}>{status.label}</Label></div>}</div>
      {instruction && <MetricInlineAction title="Инструкция" subtitle="по настройке алертов к бизнес-метрикам" href={instruction.button.link} />}
      <MetricInlineResources title="Инструкция к А/В тестам" actions={instructionLinks} />
      {library && <MetricInlineAction title="Библиотека решений" subtitle="Практики для повышения оценки исследований" href={library.link} actionLabel="Открыть" />}
      {zeroAction && <MetricInlineAction title="Запустить" subtitle="первый пилот в Self-Service" href={zeroAction.link || zeroAction.url} />}
      <MetricActionGroup title="Быстрая аналитика и AI-рекомендации" actions={insights} />
      <MetricActionGroup title="Быстрая аналитика и AI-рекомендации" actions={pilotActions} />
    </div>
  );
}

const LEADER_CONFETTI_COLORS = ['#ff6363', '#ffb224', '#7bd65c', '#35b9e9', '#7567f4', '#eb62c5'];

function LeaderConfetti({productId}) {
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    setVisible(true);
    return undefined;
  }, [productId]);
  useEffect(() => {
    if (!visible || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * pixelRatio);
      canvas.height = Math.round(window.innerHeight * pixelRatio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const makeParticle = (side, index) => {
      const fromLeft = side === 'left';
      const angle = (fromLeft ? -78 + Math.random() * 46 : -148 + Math.random() * 46) * Math.PI / 180;
      const speed = 12 + Math.random() * 10;
      return {
        x: fromLeft ? 18 : window.innerWidth - 18,
        y: window.innerHeight + 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.16 + Math.random() * 0.09,
        drag: 0.982 + Math.random() * 0.008,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.42,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.08 + Math.random() * 0.08,
        width: index % 5 === 0 ? 5 : 6 + Math.random() * 4,
        height: index % 5 === 0 ? 15 : 6 + Math.random() * 7,
        color: LEADER_CONFETTI_COLORS[index % LEADER_CONFETTI_COLORS.length],
        circle: index % 4 === 0,
        age: 0,
        life: 108 + Math.random() * 34,
      };
    };
    const particles = ['left', 'right'].flatMap((side) => Array.from({length: 34}, (_, index) => makeParticle(side, index)));
    let animationFrame;
    let previousTime = performance.now();
    const draw = (time) => {
      const step = Math.min((time - previousTime) / 16.67, 2);
      previousTime = time;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let active = false;
      particles.forEach((particle) => {
        particle.age += step;
        if (particle.age >= particle.life) return;
        active = true;
        particle.vx *= Math.pow(particle.drag, step);
        particle.vy += particle.gravity * step;
        particle.x += (particle.vx + Math.sin(particle.wobble) * 0.35) * step;
        particle.y += particle.vy * step;
        particle.rotation += particle.rotationSpeed * step;
        particle.wobble += particle.wobbleSpeed * step;
        const fadeStart = particle.life * 0.72;
        const opacity = particle.age > fadeStart ? 1 - (particle.age - fadeStart) / (particle.life - fadeStart) : Math.min(1, particle.age / 5);
        context.save();
        context.globalAlpha = Math.max(0, opacity);
        context.fillStyle = particle.color;
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.scale(Math.cos(particle.wobble), 1);
        if (particle.circle) {
          context.beginPath();
          context.arc(0, 0, particle.width / 2, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
        }
        context.restore();
      });
      if (active) animationFrame = window.requestAnimationFrame(draw);
      else setVisible(false);
    };
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    };
  }, [visible, productId]);
  if (!visible) return null;
  return <canvas ref={canvasRef} className="leader-confetti" aria-hidden="true" key={productId} />;
}

export function TeamProfilePage({product, products, rows, detailScore, onBack, onProduct}) {
  const score = scoreFor(product, rows);
  const maturity = groupFor(product, rows);
  const maturityTone = maturityTheme(maturity);
  const aiRecommendations = product.metric_recommendations || [];
  const hasAiRecommendations = hasAvailableRecommendations(aiRecommendations);
  const aiRecommendationLight = hasAiRecommendations ? worstDigestLight(aiRecommendations) : 'gray';
  const aiRecommendationTheme = aiRecommendationLight === 'gray' ? 'default' : digestTheme(aiRecommendationLight);
  const profileSeries = radarSeries(product.type);
  const applicableMetrics = (product.metrics || []).flatMap((block) => block.metrics || []).filter((metric) => metric.is_applicabble_flg !== false);
  const earnedPoints = applicableMetrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
  const maxPoints = applicableMetrics.reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
  const nextLevel = score < 40
    ? {name: 'Развивающиеся', threshold: 40}
    : score < 60
      ? {name: 'Зрелые', threshold: 60}
      : score < 80
        ? {name: 'Лидеры Data Driven', threshold: 80}
        : null;
  const percentToNextLevel = nextLevel ? Math.max(0, nextLevel.threshold - score) : 0;
  const pointsToNextLevel = nextLevel ? Math.max(0.05, maxPoints * nextLevel.threshold / 100 - earnedPoints) : 0;
  const [detailMode, setDetailMode] = useState('compact');
  const [lens, setLens] = useState('dd');
  const [aiFocusBlock, setAiFocusBlock] = useState(null);
  const [aiFocusSkill, setAiFocusSkill] = useState(null);
  const [aiReturnMetric, setAiReturnMetric] = useState(null);
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [reportAccessOpen, setReportAccessOpen] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const generalRecommendationBlock = recommendationBlockCode(product, 'general');
  const aiRecommendationBlockCodes = useMemo(
    () => new Set(aiRecommendations.map((item) => recommendationBlockCode(product, item.block_code || 'other'))),
    [aiRecommendations, product],
  );
  const visibleMetricBlocks = useMemo(
    () => filterInapplicableMetricGroups(product.metrics || [], aiRecommendationBlockCodes, isVisibleMetric),
    [aiRecommendationBlockCodes, product],
  );
  const mauMetricCode = (product.metrics || []).flatMap((block) => block.metrics || []).find((metric) => /\.mau_produkta$/i.test(String(metric.code || '')))?.code || 'general.mau_produkta';
  useEffect(() => {
    if (!hasAiRecommendations && lens === 'metrics') setLens('dd');
  }, [hasAiRecommendations, lens, product.id]);
  useEffect(() => setAiReturnMetric(null), [product.id]);
  const mauAiRecommendation = (product.metric_recommendations || []).find((item) => item.block_code === 'general' && /\bMAU\b/i.test(String(item.indicator || '')) && !/\bYAU\b/i.test(String(item.indicator || '')))
    || (product.metric_recommendations || []).find((item) => item.block_code === 'general' && /\bMAU\b/i.test(String(item.indicator || '')));
  const hasMauAiRecommendation = Boolean(mauAiRecommendation);
  const funnelAiRecommendation = (product.metric_recommendations || []).find((item) => item.skill_key === 'clickstream_funnel' || item.skill_name === 'Воронка оформления в СБОЛ');
  const draftAiRecommendations = (product.metric_recommendations || []).filter((item) => item.skill_key === 'drafts' || item.skill_name === 'Черновики');
  const campaignFunnelAiRecommendations = (product.metric_recommendations || []).filter((item) => item.skill_key === 'funnel' || item.skill_name === 'Воронка кампейнинга');
  const csiAiRecommendations = (product.metric_recommendations || []).filter((item) => item.skill_key === 'csi' || item.skill_name === 'CSI');
  const complaintsAiRecommendations = (product.metric_recommendations || []).filter((item) => item.skill_key === 'complaints' || item.skill_name === 'Жалобы и обращения');
  const openMauAiRecommendation = () => {
    setAiFocusBlock(generalRecommendationBlock);
    setAiFocusSkill('Ключевые метрики');
    setAiReturnMetric(mauMetricCode);
    setLens('metrics');
  };
  const openFunnelAiRecommendation = () => {
    setAiFocusBlock('attract');
    setAiFocusSkill('Воронка оформления в СБОЛ');
    setAiReturnMetric('attract.funnel_analysis');
    setLens('metrics');
  };
  const openDraftAiRecommendation = () => {
    setAiFocusBlock('attract');
    setAiFocusSkill('Черновики');
    setAiReturnMetric('attract.chernoviki_v_sbol_70');
    setLens('metrics');
  };
  const openCampaignFunnelAiRecommendation = () => {
    setAiFocusBlock('attract');
    setAiFocusSkill('Воронка кампейнинга');
    setAiReturnMetric('attract.funnel_analysis');
    setLens('metrics');
  };
  const openCsiAiRecommendation = () => {
    setAiFocusBlock('cx');
    setAiFocusSkill('CSI');
    setAiReturnMetric('cx.score');
    setLens('metrics');
  };
  const openComplaintsAiRecommendation = () => {
    setAiFocusBlock('cx');
    setAiFocusSkill('Жалобы и обращения');
    setAiReturnMetric('cx.score');
    setLens('metrics');
  };
  const returnToDataDriven = () => {
    const target = aiReturnMetric;
    setLens('dd');
    setAiReturnMetric(null);
    setAiFocusBlock(null);
    setAiFocusSkill(null);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(metricDomId(target))?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }));
  };
  const toggle = (code) => setOpen((current) => {
    const next = new Set(current);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });
  const recommendations = useMemo(() => {
    const groups = new Map();
    (product.metrics || []).forEach((block) => (block.metrics || []).forEach((metric) => (metric.recommendation_items || []).forEach((item) => {
      const gap = Number(item.gap || 0);
      if (!item.recommendation || gap <= 0) return;
      const key = `${block.name}|${item.recommendation}`;
      const current = groups.get(key) || {recommendation: item.recommendation, block: block.name, count: 0, gap: 0, difficulty: item.recommendation_difficulty || item.group || 1};
      current.count += 1;
      current.gap += gap;
      groups.set(key, current);
    })));
    return [...groups.values()].map((item) => ({...item, indexUplift: maxPoints ? item.gap / maxPoints * 100 : 0})).sort((a, b) => a.difficulty - b.difficulty || b.gap - a.gap);
  }, [product, maxPoints]);
  const radarData = useMemo(() => {
    const benchmarkProducts = products.filter((item) => /продукт|сегмент|product|segment/i.test(String(item.type || '')));
    return visibleMetricBlocks.map((block) => {
      const benchmarkValues = benchmarkProducts.flatMap((item) => {
        const benchmarkBlock = (item.metrics || []).find((candidate) => candidate.code === block.code);
        if (!benchmarkBlock) return [];
        const benchmarkMetrics = benchmarkBlock.metrics || [];
        const allIrrelevant = benchmarkMetrics.length > 0 && benchmarkMetrics.every((metric) => metric.is_applicabble_flg === false);
        return allIrrelevant ? [] : [blockPercent(benchmarkBlock)];
      });
      return {
        name: block.name,
        product: blockPercent(block),
        benchmark: benchmarkValues.length ? Math.round(benchmarkValues.reduce((sum, value) => sum + value, 0) / benchmarkValues.length) : 0,
      };
    });
  }, [products, visibleMetricBlocks]);

  return (
    <main className="content detail-page">
      {!nextLevel && <LeaderConfetti productId={product.id || product.name} />}
      <SemanticButton intent={BUTTON_INTENT.navigation} onClick={onBack}><Icon data={ArrowLeft} size={16} />Назад к Summary</SemanticButton>
      <header className="detail-header">
        <div><h1>{product.name}</h1><div className="detail-meta">{product.unit} · {product.period} · <Label size="xs">{product.type}</Label><SemanticButton intent={BUTTON_INTENT.destructive} href="https://public.oprosso.sberbank.ru/p/6yyb40xa" target="_blank">Нашли ошибку?</SemanticButton><SemanticButton intent={BUTTON_INTENT.feedback} href="https://public.oprosso.sberbank.ru/p/amsp1k1c" target="_blank" rel="noreferrer">Есть идея?</SemanticButton></div></div>
        <div className="detail-controls">
          <div className="product-select detail-section-select">
            <span>Раздел</span>
            <SegmentedRadioGroup value={lens} onUpdate={(value) => { setLens(value); setAiFocusBlock(null); setAiFocusSkill(null); setAiReturnMetric(null); }} size="l">
              <SegmentedRadioGroup.Option value="dd">Data-Driven Index</SegmentedRadioGroup.Option>
              <SegmentedRadioGroup.Option value="metrics" disabled={!hasAiRecommendations}><span className="detail-lens-option" title={hasAiRecommendations ? digestStatus(aiRecommendationLight) : 'Рекомендаций пока нет'}>AI-рекомендации<i className={`metric-light metric-light-${aiRecommendationTheme}${aiRecommendationLight === 'gray' ? ' detail-lens-light-empty' : ''}`} aria-hidden="true" /><span className="visually-hidden">{hasAiRecommendations ? digestStatus(aiRecommendationLight) : 'Рекомендаций пока нет'}</span></span></SegmentedRadioGroup.Option>
            </SegmentedRadioGroup>
          </div>
          <label className="product-select"><span>Команда</span><Select filterable filterPlaceholder="Найти команду" value={[product.id]} onUpdate={(value) => onProduct(products.find((item) => item.id === value[0]))} width={300} size="l">
          {[...products].sort((a, b) => compareNames(a.name, b.name)).map((item) => <Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>)}
          </Select></label>
        </div>
      </header>

      <div className={lens === 'dd' ? 'detail-lens-content' : 'detail-lens-content detail-lens-hidden'}>
      <div className="notice"><div className="notice-copy"><b>Значение индекса может корректироваться в зависимости от валидации источников и точечного аудита</b></div></div>
      <section className="detail-overview">
        <Card className={`index-profile-card tone-${maturityTone}`} view="outlined"><div className={`index-card tone-${maturityTone}${detailScore ? '' : ' index-card-compact'}`}><div className="index-card-title"><span>{product.name}</span><HelpMark aria-label="Формула Data-Driven Index" popoverProps={HELP_POPOVER_PROPS}><IndexFormulaHelp /></HelpMark></div><div className="index-score"><strong>{score}%</strong><b>/ 100</b><em>{maturity}</em></div><Progress value={score} theme={maturityTone} size="s" /><div className="scale"><span>Требуют внимания</span><span>Развивающиеся</span><span>Зрелые</span><span>Лидеры Data Driven</span></div><div className="index-next-level"><Text variant="body-1" color={nextLevel ? 'primary' : 'positive'}>{nextLevel ? `До уровня «${nextLevel.name}» — ${percentToNextLevel}%` : 'Вы достигли уровня Лидеры Data Driven B2C'}</Text></div>{detailScore && <div className="index-points"><Text variant="caption-1" color="secondary">Набрано {earnedPoints.toFixed(2)} баллов из {maxPoints.toFixed(2)}</Text>{nextLevel && <Text variant="caption-1" color="secondary">До следующего уровня — {pointsToNextLevel.toFixed(2)} балла</Text>}</div>}</div><div className="profile-card"><Text variant="subheader-1">Профиль Data-Driven индекса</Text><div className="profile-radar"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="55%"><PolarGrid stroke="var(--g-color-line-generic)" /><PolarAngleAxis dataKey="name" tick={<ProductRadarTick />} /><Tooltip formatter={(value, name) => [`${value}%`, name]} /><Radar name="B2C" dataKey="benchmark" stroke="var(--g-color-text-secondary)" fill="var(--g-color-base-generic-medium)" fillOpacity={0.25} strokeWidth={2} strokeDasharray="4 3" /><Radar name={profileSeries.label} dataKey="product" stroke={profileSeries.stroke} fill={profileSeries.fill} fillOpacity={0.2} strokeWidth={2} dot={{r: 2, fill: profileSeries.fill}} /><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize: 11, color: 'var(--g-color-text-secondary)'}} /></RadarChart></ResponsiveContainer></div></div></Card>
        <Card className="top-recommendations" view="outlined"><h2>Рекомендации и фокусы для повышения DD-индекса</h2>{recommendations.slice(0, 4).map((item, index) => { const difficulty = difficultyMeta(item.difficulty); return <div className="top-recommendation" key={`${item.block}-${item.recommendation}`}><div className="recommendation-marker"><span>{index + 1}</span><Label theme={difficulty.theme} size="xs">{difficulty.label}</Label></div><div><b>{item.recommendation}</b><small>{item.block}</small></div><div className="recommendation-side"><div className="recommendation-uplift"><b>+{item.indexUplift.toFixed(1)} п.п. индекса</b>{detailScore && <span>+{item.gap.toFixed(2)} балла</span>}</div></div></div>; })}<Button view="flat-info" onClick={() => setRecommendationsOpen(true)}>Все рекомендации <Label size="xs">{recommendations.length}</Label><Icon data={ChevronRight} size={14} /></Button></Card>
      </section>
      <Dialog open={recommendationsOpen} onClose={() => setRecommendationsOpen(false)} hasCloseButton maxWidth="m" fullWidth contentOverflow="auto">
        <Dialog.Header caption={`Все рекомендации · ${recommendations.length}`} />
        <Dialog.Body>
          <div className="recommendations-dialog-list">
            {recommendations.map((item, index) => { const difficulty = difficultyMeta(item.difficulty); return <div className="dialog-recommendation" key={`${item.block}-${item.recommendation}-${index}`}><div className="recommendation-marker"><span>{index + 1}</span><Label theme={difficulty.theme} size="xs">{difficulty.label}</Label></div><div><b>{item.recommendation}</b><small>{item.count} {metricWord(item.count)} · {item.block}</small></div><div className="recommendation-side"><div className="recommendation-uplift"><b>+{item.indexUplift.toFixed(1)} п.п. индекса</b>{detailScore && <span>+{item.gap.toFixed(2)} балла</span>}</div></div></div>; })}
          </div>
        </Dialog.Body>
      </Dialog>
      <section className="metrics-section">
        <div className="metrics-title"><h2>Ключевые блоки DD-рейтинга</h2><div className="detail-mode" role="group" aria-label="Вид деталей"><Button selected={detailMode === 'detailed'} onClick={() => { setDetailMode('detailed'); setOpen(new Set(visibleMetricBlocks.map((item) => item.code))); }}>Подробно</Button><Button selected={detailMode === 'compact'} onClick={() => { setDetailMode('compact'); setOpen(new Set()); }}>Компактно</Button></div></div>
        <div className="metrics-grid">
          {visibleMetricBlocks.map((block) => {
            const visibleMetrics = (block.metrics || []).filter(isVisibleMetric);
            const blockMetrics = filterMetricsForBlock(block, visibleMetrics);
            const metrics = filterInapplicableMetricSubgroups(blockMetrics, metricGroup);
            const blockScore = blockPercent(block);
            const allIrrelevant = visibleMetrics.length > 0 && visibleMetrics.every((metric) => metric.is_applicabble_flg === false);
            const isOpen = open.has(block.code);
            const value = metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
            const max = metrics.reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
            const blockLinks = linksForBlock(block, product.metrics || [], product);
            const participantLinks = (block.participant_links || []).filter((item) => item?.label && (item.url || item.link));
            const instructions = (block.tools || []).filter((tool) => tool.kind === 'instruction' && tool.button?.link);
            const blockPilotActions = pilotToolLinks(block);
            const firstPilotAction = metrics.find((metric) => /^attract\.campaign_launches$/i.test(metric.code) && metric.is_applicabble_flg !== false && Number(metric.value || 0) === 0 && (metric.zero_button?.link || metric.zero_button?.url))?.zero_button || null;
            const isKeyMetricsBlock = block.code === 'general' || /знание ключевых метрик/i.test(String(block.name || ''));
            return (
              <Card key={block.code} className={`metric-block tone-${allIrrelevant ? 'default' : progressTheme(blockScore)}`} view="outlined">
                <div className="dd-metric-block-head">
                  <button className="dd-metric-block-main" onClick={() => toggle(block.code)} aria-expanded={isOpen}>
                    <Icon data={isOpen ? ChevronDown : ChevronRight} size={14} />
                    <div><h3>{block.name}</h3>{detailScore && <span>Набрано {value.toFixed(2)} баллов из {max.toFixed(2)}</span>}</div>
                  </button>
                  <div className="dd-metric-block-help">
                    <ProductBlockHelp blockCode={block.code} product={product} />
                    {isKeyMetricsBlock && <HelpMark aria-label="Источник оценки" popoverProps={HELP_POPOVER_PROPS}>На основании пройденной самооценки в Oprosso</HelpMark>}
                  </div>
                  <div className="dd-metric-block-score">{allIrrelevant ? <span className="metric-block-na">Не применимо</span> : <strong>{blockScore}%</strong>}</div>
                </div>
                {isOpen && <div className="metric-list">{metrics.map((metric, index) => { const group = metricGroup(metric); const previousGroup = index > 0 ? metricGroup(metrics[index - 1]) : ''; const instruction = /^alerts\.business_metrics$/i.test(metric.code) ? instructions[0] : null; const instructionLinks = /^hyp\.ab_tests$/i.test(metric.code) ? AB_TEST_INSTRUCTION_LINKS : []; const library = /^hyp\.datadriven_rating_7_5$/i.test(metric.code) && metric.button?.link ? metric.button : null; const zeroAction = /^attract\.nalichie_self_service$/i.test(metric.code) ? firstPilotAction : null; const pilotActions = /^attract\.campaign_launches$/i.test(metric.code) ? blockPilotActions : []; let aiMetricInsight = null; if (hasMauAiRecommendation && /\.mau_produkta$/i.test(metric.code)) aiMetricInsight = metricAiInsight('динамике MAU', openMauAiRecommendation); if (draftAiRecommendations.length && /^attract\.chernoviki_v_sbol_70$/i.test(metric.code)) aiMetricInsight = metricAiInsight('черновикам в СБОЛ', openDraftAiRecommendation); if (campaignFunnelAiRecommendations.length && /^attract\.funnel_analysis$/i.test(metric.code)) aiMetricInsight = metricAiInsight('воронке кампейнинга', openCampaignFunnelAiRecommendation); const aiMetricInsights = []; if (funnelAiRecommendation && /^attract\.funnel_analysis$/i.test(metric.code)) aiMetricInsights.push(metricAiInsight('воронке оформления в СБОЛ', openFunnelAiRecommendation)); if (/^cx\.score$/i.test(metric.code) && csiAiRecommendations.length) aiMetricInsights.push(metricAiInsight('CSI', openCsiAiRecommendation)); if (/^cx\.score$/i.test(metric.code) && complaintsAiRecommendations.length) aiMetricInsights.push(metricAiInsight('жалобам и обращениям', openComplaintsAiRecommendation)); if (/^mehaniki\.cross_sell$/i.test(metric.code)) aiMetricInsights.push({label: 'Перейти', href: CROSS_SELL_ANALYTICS_URL}); const digitallyConfirmed = isCrossSellDigitallyConfirmed(product, block, metric); return <React.Fragment key={metric.code}>{group && group !== previousGroup && <div className="metric-group-title"><span>{group}</span><ProductMetricGroupHelp blockCode={block.code} group={group} product={product} /></div>}{!group && previousGroup && <div className="metric-group-break" aria-hidden="true" />}<MetricRow metric={metric} product={product} detailScore={detailScore} instruction={instruction} instructionLinks={instructionLinks} library={library} zeroAction={zeroAction} aiMetricInsight={aiMetricInsight} aiMetricInsights={aiMetricInsights} pilotActions={pilotActions} grouped={Boolean(group)} digitallyConfirmed={digitallyConfirmed} /></React.Fragment>; })}</div>}
                {participantLinks.length > 0 && isOpen && <div className="block-links participant-links"><div className="block-links-title">Ссылки, приложенные при прохождении самооценки в Oprosso</div><div className="block-actions">{participantLinks.map((action) => <Button key={`${action.label}-${action.url || action.link}`} view="outlined-info" size="s" width="auto" href={action.url || action.link} target="_blank">{action.label}<Icon data={ArrowUpRightFromSquare} size={13} /></Button>)}</div></div>}
                {blockLinks.length > 0 && isOpen && <div className="block-links"><div className="block-links-title">Где посмотреть</div><div className="block-actions">{blockLinks.map((action) => <Button key={`${action.label}-${action.url}`} view="outlined-info" size="s" width="auto" href={action.url} target="_blank">{action.label}<Icon data={ArrowUpRightFromSquare} size={13} /></Button>)}</div></div>}
              </Card>
            );
          })}
        </div>
      </section>
      </div>
      {lens === 'metrics' && <ProductMetricBlocks key={product.id} product={product} onOpenReport={() => setReportAccessOpen(true)} focusBlock={aiFocusBlock} focusSkill={aiFocusSkill} />}
      {lens === 'metrics' && aiReturnMetric && <div className="ai-return-action"><SemanticButton intent={BUTTON_INTENT.primary} onClick={returnToDataDriven}><Icon data={ArrowLeft} size={16} />Назад к Data-Driven индексу</SemanticButton></div>}
      <Dialog open={reportAccessOpen} onClose={() => setReportAccessOpen(false)} hasCloseButton maxWidth="m" fullWidth>
        <Dialog.Header caption="Комплексный отчет" />
        <Dialog.Body>
          <div className="report-access-content">
            <Text variant="subheader-1">Доступ к системе</Text>
            <Text variant="body-2">Для доступа непосредственно к системе необходимо в АС Друг в поисковой строке ввести «Доступ к стендам разработки и тестирования», далее:</Text>
            <ul>
              <li><Text variant="body-1">В поле стенд указать «ТС AI Навыки Штаба B2C (CI09261834) (DEV) (CI09933741)»</Text></li>
              <li><Text variant="body-1">В обосновании — «Для разработки и тестирования инструмента AI суммаризации»</Text></li>
            </ul>
            <div className="report-access-actions"><SemanticButton intent={BUTTON_INTENT.secondary} href={REPORT_ACCESS_REQUEST_URL} target="_blank">Завести заявку на доступ</SemanticButton><SemanticButton intent={BUTTON_INTENT.primary} href={COMPLEX_REPORT_URL} target="_blank">Перейти</SemanticButton></div>
          </div>
        </Dialog.Body>
      </Dialog>
    </main>
  );
}
