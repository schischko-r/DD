import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft, ArrowUpRightFromSquare, ChartLinePoints, ChevronDown, ChevronRight, CircleCheckFill, CircleExclamation, CircleInfo, CircleInfoFill, NodesRight} from '@gravity-ui/icons';
import {Alert, Button, Card, Dialog, Disclosure, HelpMark, Icon, Label, Link, Progress, SegmentedRadioGroup, Select, Text, Tooltip as GravityTooltip} from '@gravity-ui/uikit';
import {Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip} from 'recharts';
import {ApplicableRadarDot, ApplicableRadarShape, COMPLEX_REPORT_URL, HELP_POPOVER_PROPS, REPORT_ACCESS_REQUEST_URL, ProductRadarTick, allocateIndexUplifts, blockPercent, collectBlockLinks, compareNames, crossSellPreview, difficultyMeta, filterInapplicableMetricGroups, filterInapplicableMetricSubgroups, filterMetricsForBlock, groupFor, hasMetricDeviations, hasPilotCampaignSkill, inapplicableMetricLabel, isCrossSellDigitallyConfirmed, isCrossSellDigitallyUnconfirmed, isDdIndexMetric, isInformationalMetric, isTbdMetric, isUnitFilterOption, isVisibleMetric, linksForBlock, maturityTheme, metricDomId, metricGroup, metricSkillLinks, metricWord, percent, progressTheme, radarSeries, scoreFor, summarizeRecommendationUplifts, teamHelpAudience, typeTone, useMediaQuery} from '../features/catalog/Catalog.jsx';
import {BUTTON_INTENT, SemanticButton} from '../shared/ui/SemanticButton.jsx';
import {STAND_ACCESS_ALLOW_ATTRIBUTE} from '../features/stand-access/standAccessLinks.js';
import {
  RecommendationBody,
  recommendationBlockCode,
} from '../features/llm-summary/LlmSummary.jsx';
import {
  buildHtmlPageContext,
  findHtmlPageToolForRecommendation,
} from '../features/html-pages/htmlPageTools.js';
import {metricAiActionRecommendations} from './teamProfileAiSkillNavigation.js';
import {researchActionForMetric} from './teamProfileResearchLinks.js';
import {completeBlockPercent, completeProductPercent, maturityLevelName, previousQuarterIndexDelta, isQ3CampaignMetricHidden, isDdIndexMetricForPeriod} from '../domain/report.js';
import {buildTeamProfileRadarData} from '../domain/teamProfileSelection.js';
import {flattenRoadmapItems} from './teamProfileRoadmapGroups.js';
import {displayProductName, displayText, formatRoadmapUplift, isDepositOutflowAnalysis, nextMaturityLevel, roadmapLevelChanged} from '../domain/report.js';
import {CJXplorerDialog} from '../features/cjxplorer/CJXplorerDialog.jsx';
import {CENTRALIZED_KKD_CDO_URL, industrialDataResourcesFor} from './backlogScenarioRecommendations.js';
import {blockActualGrowth, campaignMetricNoteForPeriod, metricActualGrowth} from '../domain/teamProfileSelection.js';
import {hasCrossSellDecomposition} from '../domain/crossSellDecomposition.js';
import {CrossSellDecomposition} from './CrossSellDecomposition.jsx';
import {displayMetricPercent, metricFutureLabel} from '../domain/metricPresentation.js';
import {isCampaignSelfServiceConfirmation} from '../domain/campaignSelfService.js';
import {salaryB2cComparisonBlock} from '../domain/salaryCohortGrowth.js';
import {goalsProfileLevels} from '../domain/goalsProfileLevels.js';
import {buildProductQuarterComparison} from '../domain/productQuarterComparison.js';

const REPORT_ERROR_URL = 'https://public.oprosso.sberbank.ru/p/6yyb40xa';
const AB_TEST_INSTRUCTION_LINKS = [
  {label: 'Онлайн курс по A/B', href: 'https://hr.sberbank.ru/platform/catalog/c515dcab-a8b7-4f03-a76a-e1b7349f857d'},
  {label: 'Демо A/B-платформы', href: 'https://sbervideo.sberbank.ru/watch/kpgpJi35gzwMIVu3X51'},
  {label: 'A/B-платформа', href: 'https://ab.sberbank.ru/experiments?source=1'},
];
const RESEARCH_LIBRARY_URL = 'https://mapp.sberbank.ru/b2cda/page/52475';

const GENERAL_UPLIFT_RECOMMENDATION = {
  text: 'Значение можно улучшить перепройдя самооценку команды в Oprosso в следующем квартале',
};

const PILOT_CAMPAIGNS_RECOMMENDATION = Object.freeze({
  skill_key: 'pilots',
  skill_name: 'Пилотные кампании',
  block_code: 'attract',
});

const ATTRACT_UPLIFT_RECOMMENDATIONS = {
  'attract.nastroena_otchetnostь': {
    metricName: 'Настроена отчетность',
    text: 'Выстройте отчетность в Навигаторе по продуктовой воронке привлечения',
  },
  'attract.report_completeness': {
    metricName: 'Полнота отчета',
    text: 'Донасытьте отчетность в Навигаторе метриками и разрезами по продуктовой воронке привлечения',
  },
  'attract.regulyarnostь': {
    metricName: 'Регулярность',
    text: 'Автоматизируйте процесс отчетности в Навигаторе к следующей самооценке',
  },
  'attract.initiatives_list': {
    metricName: 'Составлен перечень инициатив по привлечению',
    text: 'Составьте перечень инициатив по привлечению',
  },
  'attract.benchmarks': {
    metricName: 'Наличие бенчмарков',
    text: 'Сформируйте бенчмарки по рынку по воронке привлечения',
  },
  'attract.campaign_launches': {
    metricName: 'Запуски кампаний за квартал',
    text: 'Запустите первую кампанию',
    note: 'Проверено на цифровых следах за 1Q',
  },
  'attract.chernoviki_v_sbol_70': {
    metricName: 'Черновики в СБОЛ >=70%',
    text: 'Настройте триггеры по событиям в воронке оформления и повысьте покрытие черновиков коммуникациями',
    note: 'Проверено на цифровых следах',
  },
  'attract.nalichie_self_service': {
    metricName: 'Наличие Self-service',
    text: 'Запустите свой первый Self-service пилот',
    note: 'Проверено на цифровых следах за 1Q',
  },
  'attract.nalichie_uspeshnyh_biznes_zapuskov': {
    metricName: 'Наличие успешных бизнес-запусков',
    text: 'Проведите ретроспективный анализ прошедших бизнес-запусков.',
    note: 'Проверено на цифровых следах за 1Q',
  },
};

const CHURN_UPLIFT_RECOMMENDATIONS = {
  'churn.nastroena_otchetnostь': {
    metricName: 'Настроена отчетность',
    text: 'Выстройте отчетность в Навигаторе по продуктовой воронке оттока',
  },
  'churn.report_completeness': {
    metricName: 'Полнота отчета',
    text: 'Донасытьте отчетность в Навигаторе метриками и разрезами по продуктовой воронке оттока',
  },
  'churn.regulyarnostь': {
    metricName: 'Регулярность',
    text: 'Автоматизируйте процесс отчетности в Навигаторе к следующей самооценке',
  },
  'churn.benchmarks': {
    metricName: 'Наличие бенчмарков',
    text: 'Сформируйте бенчмарки по рынку по воронке оттока',
  },
  'churn.deviation_actions': {
    metricName: 'Мероприятия по работе с отклонениями',
    text: 'Сформируйте перечень мероприятий по работе с отклонениями',
  },
};

const HYP_UPLIFT_RECOMMENDATIONS = {
  'hyp.discovery_40_backlog': {
    metricName: 'Discovery >=40% бэклога',
    text: 'Декомпозируйте бэклог аналитиков при наличии выделенных в команде',
  },
  'hyp.datadriven_rating_7_5': {
    metricName: 'Оценка исследований >=7,5',
    text: 'Повысьте DD-уровень проведенных исследований',
  },
};

const CX_UPLIFT_RECOMMENDATIONS = {
  'cx.score': {
    metricName: 'CX Score',
    text: 'Повысьте CX Score',
  },
};

const GOALS_UPLIFT_RECOMMENDATIONS = {
  'goals.monitored': {
    metricName: 'Цели выведены на мониторинг',
    text: 'Донасытьте мастер-деши в Навигаторе своими продуктовыми целями (покрытие целей от 90%)',
    note: 'Проверено на цифровых следах в мастер-дешах',
  },
  'goals.factor_analysis_l1_l2': {
    metricName: 'Факторный анализ - драйверы 1-2 ур.',
    text: 'Декомпозируйте цели в Навигаторе ключевыми драйверами, влияющими на цели (покрытие целей от 90%)',
    note: 'Проверено на цифровых следах в мастер-дешах',
  },
  'goals.forecast': {
    metricName: 'Прогноз по целям',
    text: 'Выведите прогнозные значения в Навигатор',
    note: 'Проверено на цифровых следах в мастер-дешах',
  },
};

const ALERTS_UPLIFT_RECOMMENDATIONS = {
  'alerts.business_metrics': {
    metricName: 'Оповещения по бизнес-метрикам',
    text: 'Воспользуйтесь инструментом Модуль Отклонений в Навигаторе',
  },
};

function normalizeUpliftBinding(value) {
  return String(value || '').trim().toLocaleLowerCase('ru-RU');
}
function metricUpliftRecommendation(block, metric, metricPercent) {
  const blockCode = normalizeUpliftBinding(block?.code);
  const blockName = normalizeUpliftBinding(block?.name);
  const metricCode = normalizeUpliftBinding(metric?.code);
  const metricName = normalizeUpliftBinding(metric?.name);

  if (blockCode === 'general') {
    return GENERAL_UPLIFT_RECOMMENDATION;
  }

  if (blockCode === 'attract' && blockName === normalizeUpliftBinding('Воронка привлечения')) {
    if (
      metricCode === 'attract.funnel_analysis'
      && metricName === normalizeUpliftBinding('Проведение комплексного анализа воронки привлечения')
    ) {
      if (metricPercent === 0) return {text: 'Проведите комплексный анализ воронки привлечения'};
      if (metricPercent === 50) return {text: 'Повысьте полноту анализа воронки привлечения'};
      return null;
    }
    const recommendation = ATTRACT_UPLIFT_RECOMMENDATIONS[metricCode];
    return recommendation && metricName === normalizeUpliftBinding(recommendation.metricName)
      ? recommendation
      : null;
  }

  if (blockCode === 'churn' && blockName === normalizeUpliftBinding('Воронка оттока')) {
    if (
      metricCode === 'churn.funnel_analysis'
      && metricName === normalizeUpliftBinding('Проведение комплексного анализа воронки оттока')
    ) {
      if (metricPercent === 0) return {text: 'Проведите комплексный анализ воронки оттока'};
      if ([25, 50, 75].includes(metricPercent)) return {text: 'Повысьте полноту анализа воронки оттока'};
      return null;
    }
    const recommendation = CHURN_UPLIFT_RECOMMENDATIONS[metricCode];
    return recommendation && metricName === normalizeUpliftBinding(recommendation.metricName)
      ? recommendation
      : null;
  }

  if (blockCode === 'hyp' && blockName === normalizeUpliftBinding('Гипотезы и инициативы')) {
    const recommendation = HYP_UPLIFT_RECOMMENDATIONS[metricCode];
    return recommendation && metricName === normalizeUpliftBinding(recommendation.metricName)
      ? recommendation
      : null;
  }

  if (blockCode === 'cx' && blockName === normalizeUpliftBinding('Клиентский опыт')) {
    const recommendation = CX_UPLIFT_RECOMMENDATIONS[metricCode];
    return recommendation && metricName === normalizeUpliftBinding(recommendation.metricName)
      ? recommendation
      : null;
  }

  if (blockCode === 'goals' && blockName === normalizeUpliftBinding('Цели')) {
    const recommendation = GOALS_UPLIFT_RECOMMENDATIONS[metricCode];
    return recommendation && metricName === normalizeUpliftBinding(recommendation.metricName)
      ? recommendation
      : null;
  }

  if (blockCode === 'alerts' && blockName === normalizeUpliftBinding('Алерты')) {
    const recommendation = ALERTS_UPLIFT_RECOMMENDATIONS[metricCode];
    return recommendation && metricName === normalizeUpliftBinding(recommendation.metricName)
      ? recommendation
      : null;
  }

  return null;
}

function MetricInlineAction({title, subtitle, href, onClick, tone = 'info', actionLabel = 'Перейти'}) {
  const className = `metric-inline-instruction metric-inline-instruction-button metric-inline-instruction-${tone}`;
  const content = <><span className="metric-inline-instruction-icon"><Icon data={CircleInfo} size={15} /></span><span className="metric-inline-instruction-copy"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span><span className="metric-inline-instruction-action">{actionLabel} <Icon data={ChevronRight} size={13} /></span></>;
  return href
    ? <Link className={className} href={href} target="_blank" rel="noreferrer">{content}</Link>
    : <button className={className} type="button" onClick={onClick}>{content}</button>;
}

function MetricInlineResources({title, subtitle, actions}) {
  if (!actions.length) return null;
  return <div className="metric-inline-instruction metric-inline-instruction-button metric-inline-instruction-resources"><span className="metric-inline-instruction-icon"><Icon data={CircleInfo} size={15} /></span><span className="metric-inline-instruction-copy"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span><span className="metric-inline-instruction-resource-actions">{actions.map((action) => <a href={action.href} target="_blank" rel="noreferrer" key={`${action.label}-${action.href}`}>{action.label}<Icon data={ChevronRight} size={13} /></a>)}</span></div>;
}

function metricAiInsight(subject, onClick) {
  const labels = {
    'динамике MAU': 'Динамика MAU',
    'черновикам в СБОЛ': 'Черновики в СБОЛ',
    'воронке кампейнинга': 'Воронка кампейнинга',
    'воронке оттока': 'Воронка оттока',
    'воронке оформления в СБОЛ': 'Оформление в СБОЛ',
    'пилотным кампаниям': 'Пилотные кампании',
    'CSI': 'CSI',
    'жалобам и обращениям': 'Жалобы и обращения',
    'cross-sell': 'Cross-sell',
  };
  return {
    title: `AI-анализ по ${subject}`,
    label: labels[subject] || subject,
    tone: 'info',
    onClick,
  };
}

function MetricActionGroup({title, actions, icon = ChartLinePoints, stacked = false}) {
  if (!actions.length) return null;
  return <div className="metric-ai-actions"><span className="metric-ai-actions-title"><Icon data={icon} size={15} /><strong>{title}</strong></span><div className={`metric-ai-actions-buttons${stacked ? ' is-stacked' : ''}`}>{actions.map((action) => action.href ? <a href={action.href} target="_blank" rel="noreferrer" key={`${action.label}-${action.href}`}>{action.label}<Icon data={ChevronRight} size={13} /></a> : <button type="button" onClick={action.onClick} key={action.title}>{action.label}<Icon data={ChevronRight} size={13} /></button>)}</div></div>;
}

function CrossSellPreviewDialog({preview, onClose}) {
  if (!preview) return null;
  return <Dialog open onClose={onClose} hasCloseButton maxWidth="m" fullWidth contentOverflow="auto">
    <Dialog.Header caption="Cross-sell: покрытие и рекомендованные действия" />
    <Dialog.Body>
      <div className="crosssell-preview-dialog">
        <RecommendationBody item={preview.recommendation} hideRejectedCrossSellCandidates />
        <div className="crosssell-preview-actions">
          <Button view="flat" onClick={onClose}>Закрыть</Button>
          <SemanticButton intent={BUTTON_INTENT.primary} href={preview.href} target="_blank" rel="noreferrer">Перейти в LossHunter <Icon data={ArrowUpRightFromSquare} size={14} /></SemanticButton>
        </div>
      </div>
    </Dialog.Body>
  </Dialog>;
}

function roadmapCell(value) {
  return String(value ?? '').trim() || '—';
}

function RoadmapUplift({roadmap, currentLevel, productName}) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(roadmap?.items) ? roadmap.items : [];
  const rows = useMemo(() => flattenRoadmapItems(items), [items]);
  const uplift = Number(roadmap?.expected_uplift);
  const upliftLabel = formatRoadmapUplift(uplift);
  if (!items.length || !Number.isFinite(uplift) || uplift <= 0 || !upliftLabel) return null;
  const expectedLevel = String(roadmap.expected_level ?? '').trim();
  const showExpectedLevel = roadmapLevelChanged(currentLevel, expectedLevel);

  return <>
    <section className="index-roadmap-uplift" aria-label="Прогноз по дорожной карте">
      <div className="index-roadmap-summary-row">
        <Text variant="body-1" color="secondary">Исходя из дорожной карты продукта ожидается uplift:</Text>
        <Text className="index-roadmap-uplift-value" variant="body-1">+ {upliftLabel} п.п.</Text>
      </div>
      {showExpectedLevel && <div className="index-roadmap-expected-row"><Text variant="body-1" color="secondary">Новый ожидаемый уровень:</Text><Text className="index-roadmap-expected-level" variant="body-1">{expectedLevel}</Text></div>}
      <Button className="index-roadmap-dialog-trigger" view="flat-info" size="s" type="button" aria-haspopup="dialog" aria-label={`Открыть дорожную карту продукта ${productName}`} onClick={() => setOpen(true)}>Перейти к мероприятиям <Icon data={ChevronRight} size={13} /></Button>
    </section>
    <Dialog className="roadmap-dialog" open={open} onClose={() => setOpen(false)} hasCloseButton maxWidth="xl" fullWidth contentOverflow="auto" aria-label={`Дорожная карта продукта ${productName}`}>
      <Dialog.Header caption={productName} />
      <Dialog.Body className="roadmap-dialog-body">
        <div className="roadmap-table-scroll">
          <table className="roadmap-table" aria-label={`Дорожная карта продукта ${productName}`}>
            <thead>
              <tr>
                <th scope="col">Блок для развития</th>
                <th scope="col">Квартал</th>
                <th scope="col">Планируемое мероприятие</th>
                <th scope="col">Ожидание прироста индекса DD, п.п.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const upliftValue = formatRoadmapUplift(row.item.expected_uplift);
                return <tr key={`${row.item.source_sheet || productName}-${row.item.source_row ?? rowIndex}-${rowIndex}`}>
                  {row.blockRowSpan > 0 && <th className="roadmap-group-cell roadmap-block-cell" scope="rowgroup" rowSpan={row.blockRowSpan}>{row.blockLabel}</th>}
                  {row.quarterRowSpan > 0 && <th className="roadmap-group-cell roadmap-quarter-cell" scope="rowgroup" rowSpan={row.quarterRowSpan}>{row.quarterLabel}</th>}
                  <td className="roadmap-activity">{roadmapCell(row.item.planned_activity)}</td>
                  <td className="roadmap-uplift-cell">{upliftValue ? `+ ${upliftValue} п.п.` : '—'}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </Dialog.Body>
    </Dialog>
  </>;
}

function GoalsHelpContent() {
  return <div className="goals-help-content"><p>Для полного выполнения требования цели, факторный анализ (драйверы 1–2-го уровня) и прогнозы должны быть отражены именно в Мастер-дэше юнита в Навигаторе. Локальные и другие дашборды не заменяют Мастер-дэш и дают только частичную оценку по шкале ниже.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — мониторинг в Навигаторе (учитывается, если выведено более 90% целей и лидер продукта знает про BI-дашборд).</li><li><b>0,5 балла (50%)</b> — мониторинг в локальной отчётности (не в Навигаторе).</li><li><b>0 баллов (0%)</b> — мониторинг отсутствует.</li></ul></div>;
}

export function teamProfileBlockTitle(block) {
  const blockCode = normalizeUpliftBinding(block?.code);
  const blockName = normalizeUpliftBinding(block?.name);
  if (blockCode === 'goals' || blockName === normalizeUpliftBinding('Цели')) return block?.goalsLevels ? 'Цели/ФА/Прогнозы' : 'Цели уровня ЛЮ/ЛТ';
  const isCxBlock = blockCode === 'cx' || [
    normalizeUpliftBinding('Клиентский опыт'),
    normalizeUpliftBinding('CX Score'),
    normalizeUpliftBinding('CX/UX Score'),
  ].includes(blockName);
  if (!isCxBlock) return block?.name;
  const uxScoreMetricNames = new Set(['ux score', 'uх score', 'ux-score', 'uх-score']);
  const hasUxScore = (block.metrics || []).some((metric) => [metric?.name, metric?.label]
    .some((value) => uxScoreMetricNames.has(normalizeUpliftBinding(value))));
  return hasUxScore ? 'CX/UX Score' : 'CX Score';
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
    <p>Для запусков кампаний, Self-service и черновиков учитываются данные оцениваемого квартала. Для успешных бизнес-запусков — предыдущего квартала.</p>
    <section>
      <p>Наличие запусков кампаний с результатом.</p>
      <strong>Оценка:</strong>
      <ul><li><b>0,5 балла (100%)</b> — есть запуски с результатом.</li><li><b>0 баллов (0%)</b> — запуски отсутствуют.</li></ul>
    </section>
    <section>
      <p>Наличие успешных бизнес-запусков (пилоты).</p>
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
  'churn|отчетность': {type: 'reporting', label: 'Критерии оценки отчётности по воронке оттока', title: 'Настроена регулярная отчётность по воронке оттока, закрытию продукта и пролонгации.', description: 'Учитываются все поверхности: ClickStream, Навигатор и другая отчётность.', completenessTitle: 'Полнота отчёта по воронке оттока.', reportScope: 'факторы оттока, пошаговая воронка отключения продукта, CR (% оттока), объёмы, механики, сегментный или когортный разрез, UX/UI', includeMissing: true},
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
  'mehaniki.doprodazhi_upsell': [{title: 'Дополнительные продажи (up-sell).', items: [['1 балл (100%)', 'механика настроена.']]}],
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
  'mehaniki.uderzhaniya_klienta': [{title: 'Удержание клиента.', description: 'При обращении клиента по закрытию продукта настроен специальный сценарий удержания или механики up-sell.', items: [['1 балл (100%)', 'механика настроена.']]}],
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

function MechanicsHelpContent({audience, sections, hideIntro = false}) {
  const entity = audience === 'product' ? 'продукту' : ['age', 'income'].includes(audience) ? 'сегменту' : 'каналу';
  return <div className="goals-help-content mechanics-metric-help-content">{!hideIntro && <p>Наличие настроенных механик по {entity}.</p>}{sections.map((section, index) => <section key={`${section.title || 'score'}-${index}`}>{section.title && <p>{section.title}</p>}{section.description && <p>{section.description}</p>}{section.items?.length > 0 && <><strong>Оценка:</strong><ul>{section.items.map(([score, description]) => <li key={`${score}-${description}`}><b>{score}</b> — {description}</li>)}</ul></>}</section>)}</div>;
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
  const isCrossSellDuring = hasCrossSellDecomposition(product, metric);
  const sections = isCrossSellDuring
    ? [{description: 'В процессе оформления вашего продукта клиент может приобрести другой продукт банка.'}, {description: 'Данные собираются по цифровым следам LossHunter.'}]
    : helpByMetric?.[code];
  if (!sections) return null;
  return <span className="mechanics-metric-help"><HelpMark aria-label={`Критерии оценки: ${displayText(metric.name)}`} popoverProps={HELP_POPOVER_PROPS}><MechanicsHelpContent audience={audience} sections={sections} hideIntro={isCrossSellDuring} /></HelpMark></span>;
}

function CxHelpContent({audience}) {
  if (audience === 'digital-channel') {
    return <div className="goals-help-content"><p>Зеленая зона UX Score.</p><p>UX Score определяет вес каждой UX-проблемы на основе разметки задач в Jira, затем вычисляет итоговую метрику команды, продукта или трайба на основе связанных с ними задач.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — зеленая зона UX Score.</li><li><b>0,5 балла (50%)</b> — жёлтая зона UX Score.</li></ul></div>;
  }
  return <div className="goals-help-content"><p>На основе дашборда "CX Score".</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — зелёная зона CX Score.</li><li><b>0,5 балла (50%)</b> — жёлтая зона CX Score.</li></ul></div>;
}

function HypothesesHelpContent({audience, period}) {
  const isSegment = ['age', 'income'].includes(audience);
  const surveyDiscovery = period === 'III кв. 2026';
  const source = surveyDiscovery ? 'ответы команды в опроснике или декомпозиция бэклога за III квартал' : isSegment || audience === 'product'
    ? 'анализ бэклога в Jira/Сбертрек на основе LLM-модели'
    : 'самооценка продукта и верификация по цифровым следам Jira/Сбертрек';
  return <div className="goals-help-content attract-reporting-help-content">
    <section><p>Доля задач аналитиков по продукту, связанных с исследованиями ({source}).</p><strong>Оценка:</strong>{surveyDiscovery
      ? <ul><li><b>1 балл (100%)</b> — по анкете доля исследований от 40% и бэклог ведётся в Jira/SberTrack командой или Штабом; либо по декомпозиции доля исследований не менее 40%.</li><li><b>0,5 балла (50%)</b> — по анкете доля исследований 20–39% либо от 40% при бэклоге вне Jira/SberTrack; по декомпозиции — от 20% до 40% (не включая 40%).</li><li><b>0 баллов (0%)</b> — доля исследований меньше 20%, ответ «Нет аналитиков» или «Затрудняюсь ответить».</li></ul>
      : <ul><li><b>1 балл (100%)</b> — не менее 40% бэклога приходится на исследования.</li><li><b>0,5 балла (50%)</b> — не менее 20% бэклога приходится на исследования.</li></ul>}</section>
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
    hyp: {label: 'Критерии оценки гипотез и инициатив', content: <HypothesesHelpContent audience={audience} period={product.period} />},
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

function DigitalTraceConfirmation({message = 'Подтверждено на Цифровых следах'}) {
  return <GravityTooltip content={message} openDelay={200}><span className="metric-digital-trace-confirmation" tabIndex={0} aria-label={message}><Icon data={CircleCheckFill} size={16} /></span></GravityTooltip>;
}

function MetricActualGrowthBadge({growth, blockHeader = false}) {
  const [bursts, setBursts] = useState([]);
  const burstTimers = useRef(new Set());
  const burstSequence = useRef(0);
  useEffect(() => {
    setBursts([]);
    return () => {
      burstTimers.current.forEach((timer) => window.clearTimeout(timer));
      burstTimers.current.clear();
    };
  }, [growth?.currentPeriod, growth?.previousPeriod, growth?.value, growth?.previousValue]);
  if (!growth) return null;
  const number = (value, digits = 1) => value.toLocaleString('ru-RU', {maximumFractionDigits: digits});
  const delta = growth.indexPctDelta;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const label = `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta) < 0.05 && delta !== 0 ? '<0,1' : number(Math.abs(delta))} п.п.${blockHeader ? '' : ' к DDI'}`;
  const title = 'Изменение к предыдущему кварталу';
  const celebrate = (event) => {
    if (growth.indexPctDelta <= 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const particles = Array.from({length: 48}, () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.sqrt(Math.random()) * 125;
      return {x: Math.cos(angle) * distance, y: Math.sin(angle) * distance,
        size: 3 + Math.floor(Math.random() * 3), duration: 650 + Math.random() * 400, delay: Math.random() * 60};
    });
    const burst = {id: ++burstSequence.current, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, particles};
    setBursts((current) => [...current, burst]);
    const timer = window.setTimeout(() => {
      setBursts((current) => current.filter((item) => item.id !== burst.id));
      burstTimers.current.delete(timer);
    }, 1350);
    burstTimers.current.add(timer);
  };
  return <>
    <GravityTooltip content={title} openDelay={200}><button type="button" className={`metric-actual-growth-wrap${blockHeader ? ' metric-actual-growth-block' : ''}`} aria-label={title} onClick={celebrate}><Label className={`metric-index-uplift metric-actual-growth metric-index-uplift-${direction} ${direction === 'flat' ? '' : `index-quarter-delta-${direction === 'up' ? 'positive' : 'negative'}`}`} theme={direction === 'down' ? 'danger' : direction === 'up' ? 'success' : 'normal'} size="xs">{direction !== 'flat' && <span className="index-quarter-delta-direction" aria-hidden="true" />}<span className="metric-index-uplift-text">{label}</span></Label></button></GravityTooltip>
    {typeof document !== 'undefined' && bursts.map((burst) => createPortal(<div className="metric-growth-confetti" aria-hidden="true" style={{left: burst.x, top: burst.y}}>{burst.particles.map((particle, index) =>
      <span key={index} className="metric-growth-confetti-particle" style={{'--metric-growth-x': `${particle.x}px`, '--metric-growth-y': `${particle.y}px`, '--metric-growth-size': `${particle.size}px`, animationDuration: `${particle.duration}ms`, animationDelay: `${particle.delay}ms`}} />
    )}</div>, document.body, burst.id))}
  </>;
}

// «Регулярность» везде стоит подпунктом «Настроена отчетность» внутри подгруппы
// «Отчетность» — все 154 строки отчета устроены так. Раньше отступ вешался по коду блока
// и не доставал до «Анализ, эффективность», где метрика выпадала из общего строя.
function isReportingRegularity(metric) {
  return /^отч[её]тность$/i.test(String(metric?.metric_subgroup || '').trim())
    && /регулярность(?:\s*\(авто\))?$/i.test(String(metric?.name || '').trim());
}

function metricInfoMessage(metric, product) {
  if (metric.source?.level === 'Уровень PO') return 'Оценка уровня PO учитывается в итоговой оценке целей.';
  if (metric.source?.level === 'Уровень ЛЮ/ЛТ') {
    if (product.unit === 'УБ' || product.tribe === 'Комиссионные продукты') {
      return 'Метрики уровня ЛЮ/ЛТ информационные и не входят в индекс.';
    }
    return 'Оценка уровня ЛЮ/ЛТ учитывается в итоговой оценке целей.';
  }
  return 'Информационная метрика, не влияет на расчет';
}

const CROSS_SELL_UNCONFIRMED_MESSAGE = 'Мы не смогли подтвердить наличие кросс-продаж. При наличии, добавьте видео на платформу CJXplorer, иначе в следующем периоде значение скорректируется.';

function CrossSellUnconfirmedWarning() {
  return <GravityTooltip content={CROSS_SELL_UNCONFIRMED_MESSAGE} openDelay={200}><span className="metric-crosssell-unconfirmed-warning" tabIndex={0} aria-label={CROSS_SELL_UNCONFIRMED_MESSAGE}><Icon data={CircleExclamation} size={17} /></span></GravityTooltip>;
}

function SalaryCohortControl({block, aggregateBlock, period, value, onUpdate}) {
  const averagePercent = completeBlockPercent(aggregateBlock, period);
  return <div className="salary-cohort-control" title={`В индексе — ${averagePercent === null ? '—' : `${averagePercent}%`}, среднее B2B и B2C`}>
    <SegmentedRadioGroup aria-label={`Сегмент: ${teamProfileBlockTitle(block)}`} value={value} onUpdate={onUpdate} size="s">
      <SegmentedRadioGroup.Option value="b2b">B2B</SegmentedRadioGroup.Option>
      <SegmentedRadioGroup.Option value="b2c">B2C</SegmentedRadioGroup.Option>
    </SegmentedRadioGroup>
  </div>;
}

const GOALS_PO_COUNTERPART = {
  'goals.monitored': 'goals.po_monitoring',
  'goals.factor_analysis_l1_l2': 'goals.po_factor_analysis',
  'goals.forecast': 'goals.po_forecast',
};
const GOALS_PO_CODES = new Set(Object.values(GOALS_PO_COUNTERPART));

function GoalsLevelDecomposition({metric, poMetric, product, children, poChild, expanded}) {
  const disclosure = React.useRef(null);
  React.useEffect(() => { if (disclosure.current) disclosure.current.open = expanded; }, [expanded]);
  const applicable = poMetric.is_applicabble_flg !== false;
  const hasValue = applicable && Number(poMetric.max_value) > 0 && Number.isFinite(poMetric.value);
  const label = hasValue ? `${displayMetricPercent(product, poMetric)}%`
    : applicable ? '—' : inapplicableMetricLabel(poMetric);
  const theme = !hasValue ? 'normal' : poMetric.value >= poMetric.max_value ? 'success' : poMetric.value > 0 ? 'warning' : 'danger';
  return <details className="cross-sell-decomposition goals-level-decomposition" ref={disclosure}>
    <summary className="cross-sell-decomposition-summary">
      <Icon data={ChevronRight} size={14} />
      <i className={`metric-light metric-light-${theme === 'normal' ? 'default' : theme}`} aria-hidden="true" />
      <b>{displayText(metric.name)}</b>
      <MetricActualGrowthBadge growth={actualCriterionGrowth(poMetric, children.props.maxIndexPoints, product.period)} />
      <Label className={theme === 'normal' ? 'metric-status-label metric-status-label-text' : 'metric-status-label'} size="xs" theme={theme}>{label}</Label>
    </summary>
    <div className="cross-sell-decomposition-content">
      {React.cloneElement(children, {nameOverride: 'Уровень ЛЮ/ЛТ', grouped: false, nested: true})}
      {React.cloneElement(poChild, {nameOverride: 'Уровень PO', grouped: false, nested: true})}
    </div>
  </details>;
}

function actualCriterionGrowth(metric, maxIndexPoints, period) {
  return Object.hasOwn(metric, 'quarterActualGrowth')
    ? metric.quarterActualGrowth : metricActualGrowth(metric, maxIndexPoints, period);
}

function quarterBlockGrowth(comparison, code) {
  const block = comparison?.blocks.find(item => item.code === code);
  return block ? {...block, currentPeriod: comparison.currentPeriod, previousPeriod: comparison.previousPeriod,
    value: block.currentPoints, previousValue: block.previousPoints,
    comparisonLabel: `Вклад блока в изменение DDI: оценки, применимость и веса. Изменение оценок ${block.scoreChangeIndexPctDelta.toLocaleString('ru-RU', {maximumFractionDigits: 2})} п.п.; состав и веса ${block.applicabilityIndexPctDelta.toLocaleString('ru-RU', {maximumFractionDigits: 2})} п.п. Округление учтено в сверке индекса.`} : null;
}

function MetricGroupEntry({metrics, index, block, product, children, expanded = false}) {
  const group = metricGroup(metrics[index]);
  const previousGroup = index > 0 ? metricGroup(metrics[index - 1]) : '';
  const goalsDecomposition = block.code === 'goals' && block.goalsLevels && product.period === 'III кв. 2026';
  if (goalsDecomposition && GOALS_PO_CODES.has(metrics[index].code)) return null;
  const poCode = goalsDecomposition ? GOALS_PO_COUNTERPART[metrics[index].code] : null;
  const poMetric = poCode ? metrics.find((metric) => metric.code === poCode) : null;
  const poLevelMetric = poCode ? block.goalsPoLevelMetrics?.find((metric) => metric.code === poCode) || poMetric : null;
  const poChild = poLevelMetric ? React.cloneElement(children, {metric: poLevelMetric}) : null;
  const informationalGoals = block.code === 'goals' && group === 'Уровень ЛЮ/ЛТ'
    && metrics.filter(metric => metricGroup(metric) === group).every(isInformationalMetric);
  const crossSellResearchAction = researchActionForMetric(metrics[index]);
  const crossSellActions = [
    ...(children.props.aiMetricInsight ? [children.props.aiMetricInsight] : []),
    ...(crossSellResearchAction ? [crossSellResearchAction] : []),
    ...(children.props.aiMetricInsights || []),
    ...(children.props.skillActions || []),
  ];
  const content = goalsDecomposition && poMetric
    ? <GoalsLevelDecomposition metric={metrics[index]} poMetric={poMetric} product={product} poChild={poChild} expanded={expanded}>{children}</GoalsLevelDecomposition>
    : hasCrossSellDecomposition(product, metrics[index])
    ? <CrossSellDecomposition product={product} metric={metrics[index]} highlighted={children.props.highlighted} growthBadge={<MetricActualGrowthBadge growth={actualCriterionGrowth(metrics[index], children.props.maxIndexPoints, product.period)} />} analytics={crossSellActions.length > 0 ? <MetricActionGroup title="Быстрая аналитика и AI-рекомендации" actions={crossSellActions} /> : null}>{children}</CrossSellDecomposition>
    : children;
  if (goalsDecomposition) return content;
  return <>{group && group !== previousGroup && <div className={`metric-group-title${informationalGoals ? ' metric-group-title-informational' : ''}`}><span>{group}</span>{informationalGoals && <span className="metric-group-note">Информационные метрики — не входят в индекс</span>}<ProductMetricGroupHelp blockCode={block.code} group={group} product={product} /></div>}{!group && previousGroup && <div className="metric-group-break" aria-hidden="true" />}{content}</>;
}

function BlockReferenceLinks({referenceLinks = [], participantLinks = [], referencePeriod}) {
  return <>
    {participantLinks.length > 0 && <div className="block-links participant-links"><div className="block-links-title">{referencePeriod ? `Ссылки из самооценки · ${referencePeriod}` : 'Ссылки, приложенные при прохождении самооценки в Oprosso'}</div><div className="block-actions">{participantLinks.map((action) => <Button key={`${action.label}-${action.url || action.link}`} view="outlined-info" size="s" width="auto" href={action.url || action.link} target="_blank" rel="noreferrer">{action.label}<Icon data={ArrowUpRightFromSquare} size={13} /></Button>)}</div></div>}
    {referenceLinks.length > 0 && <div className="block-links"><div className="block-links-title">Где посмотреть</div><div className="block-actions">{referenceLinks.map((action) => <div className="block-action-item" key={`${action.label}-${action.url}`}><Button view="outlined-info" size="s" width="auto" href={action.url} target="_blank" rel="noreferrer">{action.label}<Icon data={ArrowUpRightFromSquare} size={13} /></Button>{action.notice && <span className="block-action-notice">{action.notice}</span>}</div>)}</div></div>}
  </>;
}

function MetricRow({block, metric, product, detailScore, maxIndexPoints, instruction, instructionLinks = [], library, zeroAction, aiMetricInsight, aiMetricInsights = [], skillActions = [], grouped, nested, digitallyConfirmed, crossSellUnconfirmed, highlighted, onOpenHtmlPageTool, hideAnalytics = false, nameOverride}) {
  const futureLabel = metricFutureLabel(product, metric);
  const emptyAbStatus = product.period === 'III кв. 2026' && metric.code === 'hyp.ab_tests'
    && metric.source?.origin !== 'userConfirmedAbTestsAssessment';
  if (!futureLabel && product.isPlaceholder && metric.is_applicabble_flg !== false
    && !(Number.isFinite(metric.value) && Number.isFinite(metric.max_value) && metric.max_value > 0)) {
    return <div id={metricDomId(metric.code)} className={`metric-row${detailScore ? '' : ' metric-row-status'}${grouped ? ' metric-row-grouped' : ''}${nested ? ' metric-row-nested' : ''}${emptyAbStatus ? ' metric-row-ab-unscored' : ''}`}>
      <div className="metric-copy"><i className="metric-light metric-light-default" aria-hidden="true" /><div><div className="metric-name-line"><b>{displayText(nameOverride || metric.name)}</b>{isInformationalMetric(metric) && !/^регулярность$/i.test(String(metric.name || '').trim()) && <GravityTooltip content={metricInfoMessage(metric, product)} openDelay={200}><span className="metric-info-icon" tabIndex={0} aria-label={metricInfoMessage(metric, product)}><Icon data={CircleInfoFill} size={14} /></span></GravityTooltip>}</div>{(hasCrossSellDecomposition(product, metric) || metric.code.startsWith('goals.')) && metric.footer && <span>{displayText(metric.footer)}</span>}</div></div>
      <div className="metric-value"><MechanicsMetricHelp metric={metric} product={product} /><span className="metric-value-label">{emptyAbStatus ? '' : '—'}</span></div>
      {!hideAnalytics && <MetricActionGroup title="Быстрая аналитика и AI-рекомендации" actions={aiMetricInsights} />}
    </div>;
  }
  const value = percent(metric.value, metric.max_value);
  const displayValue = displayMetricPercent(product, metric);
  const theme = metric.max_value ? progressTheme(value) : 'default';
  const isTbd = isTbdMetric(metric);
  const isInformational = isInformationalMetric(metric);
  const showInformationalBadge = isInformational && !/^регулярность$/i.test(String(metric.name || '').trim());
  const isIrrelevant = metric.is_applicabble_flg === false && !isTbd;
  const isNotApplicable = metric.is_applicabble_flg === false;
  const isMissingCxTeam = isNotApplicable && /^cx score$/i.test(String(metric.name || '').trim());
  const unavailableLabel = isMissingCxTeam ? 'Команда еще не добавлена'
    : emptyAbStatus ? '' : inapplicableMetricLabel(metric);
  const status = futureLabel
    ? {label: futureLabel, theme: 'normal'}
    : isTbd
    ? {label: 'TBD', theme: 'normal'}
    : isNotApplicable
      ? {label: unavailableLabel, theme: 'normal'}
    : Number(metric.max_value) > 0
      ? {
          label: `${displayValue}%`,
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
  const lightTheme = futureLabel ? 'default' : detailScore ? (isTbd ? 'default' : theme) : (status.theme === 'normal' ? 'default' : status.theme);
  const outflowTool = isDepositOutflowAnalysis(product, metric)
    ? findHtmlPageToolForRecommendation({skill_key: 'prolongation'})
    : null;
  const outflowInsight = outflowTool && onOpenHtmlPageTool
    ? metricAiInsight('воронке оттока', () => onOpenHtmlPageTool(outflowTool.id))
    : null;
  const researchAction = researchActionForMetric(metric);
  const insights = [
    ...(aiMetricInsight ? [aiMetricInsight] : []),
    ...(researchAction ? [researchAction] : []),
    ...aiMetricInsights,
    ...(outflowInsight && !aiMetricInsights.some((action) => action.label === outflowInsight.label)
      ? [outflowInsight]
      : []),
  ];
  const mechanicsHelp = <MechanicsMetricHelp metric={metric} product={product} />;
  const baseMetricRecommendation = !isNotApplicable && !isTbd
    ? metricUpliftRecommendation(block, metric, value)
    : null;
  const verificationNote = baseMetricRecommendation?.note
    && (!/^userConfirmed/.test(metric.source?.origin || '') || isCampaignSelfServiceConfirmation(metric, product.period))
    ? campaignMetricNoteForPeriod(metric.code, product.period, baseMetricRecommendation.note) : null;
  const upliftDigitalTrace = verificationNote
    ? <DigitalTraceConfirmation message={verificationNote} />
    : null;
  const actualGrowthBadge = <MetricActualGrowthBadge growth={actualCriterionGrowth(metric, maxIndexPoints, product.period)} />;
  const lossHunterSource = product.isPlaceholder && !isNotApplicable && metric.code === 'mehaniki.cross_sell'
    && metric.source?.system === 'LossHunter' && metric.source?.matched === true
    && ['own-observed-v2', 'own-observed-or-incoming-v3'].includes(metric.source?.criterionVersion)
    ? metric.source : null;
  const lossHunterZeroMessage = 'Подтверждения отсутствуют на LossHunter';
  const lossHunterSourceBadge = lossHunterSource && metric.value > 0 && lossHunterSource.qualifyingCount > 0
    ? <DigitalTraceConfirmation message={lossHunterSource.incomingQualifies
      ? 'Зачтено по данным LossHunter: более одной входящей кросс-продажи'
      : 'Проверено на цифровых следах'} />
    : lossHunterSource && metric.value === 0 && lossHunterSource.qualifyingCount === 0
      ? <GravityTooltip content={lossHunterZeroMessage} openDelay={200}><span className="metric-source-reference" style={{color: 'var(--g-color-text-info-heavy)'}} tabIndex={0} aria-label={lossHunterZeroMessage}><Icon data={CircleInfoFill} size={16} /></span></GravityTooltip>
      : null;
  const confirmationBadge = upliftDigitalTrace || lossHunterSourceBadge
    || (digitallyConfirmed ? <DigitalTraceConfirmation /> : crossSellUnconfirmed ? <CrossSellUnconfirmedWarning /> : null);
  const metricName = <b>{displayText(nameOverride || metric.name)}</b>;
  const carriedFlexibleConditions = metric.code === 'mehaniki.gibkoe_izmenenie_usloviy_produkta'
    && product.period === 'III кв. 2026' && metric.source?.origin === 'priorQuarterCarryForward'
    && metric.source?.fromPeriod === 'II кв. 2026';
  return (
    <div id={metricDomId(metric.code)} className={`metric-row${detailScore ? '' : ' metric-row-status'}${grouped ? ' metric-row-grouped' : ''}${nested ? ' metric-row-nested' : ''}${isIrrelevant ? ' metric-row-irrelevant' : ''}${isTbd ? ' metric-row-tbd' : ''}${highlighted ? ' metric-row-highlighted' : ''}${emptyAbStatus ? ' metric-row-ab-unscored' : ''}`}>
      <div className="metric-copy"><i className={`metric-light metric-light-${lightTheme}`} aria-hidden="true" /><div><div className="metric-name-line">{metricName}{showInformationalBadge && <GravityTooltip content={metricInfoMessage(metric, product)} openDelay={200}><span className="metric-info-icon" tabIndex={0} aria-label={metricInfoMessage(metric, product)}><Icon data={CircleInfoFill} size={14} /></span></GravityTooltip>}</div>{metric.footer && <span>{displayText(metric.footer)}</span>}{carriedFlexibleConditions && <span className="metric-carry-forward-note">Оценка сохранена со II квартала.</span>}</div></div>
      <div className="metric-value">{!emptyAbStatus && (detailScore && !futureLabel ? <><div className="metric-value-caption">{mechanicsHelp}<div className="metric-value-group">{actualGrowthBadge}{confirmationBadge}<span className="metric-value-label">{valueLabel}</span></div></div>{metric.is_applicabble_flg !== false && !isTbd && <Progress value={displayValue} theme={theme} size="xs" />}</> : <div className="metric-status-with-confirmation">{mechanicsHelp}<div className="metric-value-group">{actualGrowthBadge}{confirmationBadge}<Label className={status.theme === 'normal' ? 'metric-status-label metric-status-label-text' : 'metric-status-label'} theme={status.theme}>{status.label}</Label></div></div>)}</div>
      {instruction && <MetricInlineAction title="Инструкция" subtitle="по настройке алертов к бизнес-метрикам" href={instruction.button.link} />}
      <MetricInlineResources title="Инструкция к А/В тестам" actions={instructionLinks} />
      {lossHunterSource && /^https?:\/\//i.test(lossHunterSource.link || '') && <MetricInlineAction title="Источник" subtitle="Кросс-продажи" href={lossHunterSource.link} actionLabel="LossHunter" />}
      {library && <MetricInlineAction title="Библиотека решений" subtitle="Практики для повышения оценки исследований" href={library.link} actionLabel="Открыть" />}
      {zeroAction && <MetricInlineAction title="Запустить" subtitle="первый пилот в Self-Service" href={zeroAction.link || zeroAction.url} />}
      {/^dannye\.promyshlenye_dannye$/i.test(String(metric.code || '')) && <MetricInlineResources title="Инструкции и материалы" subtitle="по опромышливанию данных" actions={industrialDataResourcesFor(product.name)} />}
      {/^dannye\.kontrol.*kkd$/i.test(String(metric.code || '')) && <MetricInlineAction title="Инструкция" subtitle="Централизованный сервис ККД" href={CENTRALIZED_KKD_CDO_URL} />}
      {!hideAnalytics && <MetricActionGroup title="Быстрая аналитика и AI-рекомендации" actions={[...insights, ...skillActions]} stacked={Boolean(researchAction && aiMetricInsight && /^general\.mau_produkta$/i.test(metric.code))} />}
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

export function TeamProfilePage({product, products, rows, baselineRows = [], baselineProducts = [], detailScore, teamUnit, onTeamUnitChange, periods = [], period, onPeriodChange, onBack, onProduct, onAbout, onOpenHtmlPageTool, onBacklog, cjxplorerProduct}) {
  const compactRadar = useMediaQuery('(max-width: 560px)');
  const hasPartialData = product.isPlaceholder && (product.metrics || []).some((block) => (block.metrics || []).some((metric) => Number.isFinite(metric.value) && Number.isFinite(metric.max_value) && metric.max_value > 0));
  const completedScore = product.isPlaceholder ? completeProductPercent(product) : null;
  const hasScore = product.isPlaceholder ? completedScore !== null
    : rows.some((row) => row.name === product.name && row.unit === product.unit && row.score != null);
  const score = product.isPlaceholder ? completedScore ?? 0 : scoreFor(product, rows);
  const indexDelta = hasScore ? previousQuarterIndexDelta(product, score, baselineProducts, baselineRows) : null;
  const quarterComparison = useMemo(() => buildProductQuarterComparison(product, baselineProducts, baselineRows), [product, baselineProducts, baselineRows]);
  const maturity = product.isPlaceholder ? hasScore ? maturityLevelName(score) : 'Нет данных' : groupFor(product, rows);
  const maturityTone = hasScore ? maturityTheme(maturity) : 'default';
  const aiActionRecommendations = metricAiActionRecommendations(product);
  const profileSeries = radarSeries(product.type);
  const indexMetrics = (product.metrics || []).flatMap((block) => block.metrics || []).filter(isDdIndexMetric);
  const applicableMetrics = indexMetrics.filter((metric) => isDdIndexMetricForPeriod(metric, product.period));
  const earnedPoints = applicableMetrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
  const unscoredAbMaxPoints = indexMetrics.filter((metric) => !isDdIndexMetricForPeriod(metric, product.period))
    .reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
  const maxPoints = product.isPlaceholder && Number.isFinite(product.indexMaxPoints)
    ? product.indexMaxPoints - unscoredAbMaxPoints
    : applicableMetrics.reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
  const nextLevel = hasScore ? nextMaturityLevel(score) : null;
  const percentToNextLevel = nextLevel ? Math.max(0, nextLevel.threshold - score) : 0;
  const pointsToNextLevel = nextLevel ? Math.max(0.05, maxPoints * nextLevel.threshold / 100 - earnedPoints) : 0;
  const [detailMode, setDetailMode] = useState('compact');
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [crossSellPreviewOpen, setCrossSellPreviewOpen] = useState(null);
  const [cjxplorerOpen, setCjxplorerOpen] = useState(false);
  const [highlightedMetrics, setHighlightedMetrics] = useState(() => new Set());
  const [reportAccessOpen, setReportAccessOpen] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const [salaryCohortSelections, setSalaryCohortSelections] = useState({});
  const recommendationHighlightTimer = useRef(null);
  const teamUnits = useMemo(() => [...new Set(products.map((item) => item.unit).filter((item) => item && isUnitFilterOption(item)))].sort(compareNames), [products]);
  const filteredTeamProducts = useMemo(() => [...products]
    .filter((item) => !teamUnit || item.unit === teamUnit)
    .sort((a, b) => compareNames(a.name, b.name)), [products, teamUnit]);
  const updateTeamUnit = (value) => {
    const nextUnit = value[0] || '';
    onTeamUnitChange(nextUnit);
    if (nextUnit && product.unit !== nextUnit) {
      const nextProduct = products.filter((item) => item.unit === nextUnit).sort((a, b) => compareNames(a.name, b.name))[0];
      if (nextProduct) onProduct(nextProduct);
    }
  };
  const aiRecommendationBlockCodes = useMemo(
    () => new Set(aiActionRecommendations.map((item) => recommendationBlockCode(product, item.block_code || 'other'))),
    [aiActionRecommendations, product],
  );
  const visibleMetricBlocks = useMemo(
    () => filterInapplicableMetricGroups((product.metrics || []).map((block) => {
      const displayedBlock = goalsProfileLevels(block, product.period);
      return {...displayedBlock,
        metrics: (displayedBlock.metrics || []).filter((metric) => !isQ3CampaignMetricHidden(product, metric)).map(metric => quarterComparison
          ? {...metric, quarterActualGrowth: quarterComparison.metricGrowthByCode[metric.code] || null} : metric),
      };
    }), aiRecommendationBlockCodes, isVisibleMetric),
    [aiRecommendationBlockCodes, product, quarterComparison],
  );
  useEffect(() => {
    setRecommendationsOpen(false);
    setReportAccessOpen(false);
    setCrossSellPreviewOpen(null);
    setCjxplorerOpen(false);
    setHighlightedMetrics(new Set());
    setSalaryCohortSelections({});
    if (recommendationHighlightTimer.current) window.clearTimeout(recommendationHighlightTimer.current);
  }, [product.id, product.period]);
  useEffect(() => () => {
    if (recommendationHighlightTimer.current) window.clearTimeout(recommendationHighlightTimer.current);
  }, []);
  const clientMetricsAiRecommendations = aiActionRecommendations.filter((item) => item.skill_key === 'client_metrics' || /ключевые метрики/i.test(String(item.skill_name || '')));
  const mauAiRecommendation = clientMetricsAiRecommendations[0]
    || aiActionRecommendations.find((item) => item.block_code === 'general' && /\bMAU\b/i.test(String(item.indicator || '')) && !/\bYAU\b/i.test(String(item.indicator || '')))
    || aiActionRecommendations.find((item) => item.block_code === 'general' && /\bMAU\b/i.test(String(item.indicator || '')));
  const hasMauAiRecommendation = Boolean(mauAiRecommendation);
  const htmlPageAiRecommendations = aiActionRecommendations.reduce((matches, recommendation) => {
    const tool = findHtmlPageToolForRecommendation(recommendation);
    if (!tool || matches.some((match) => match.tool.id === tool.id)) return matches;
    return [...matches, {tool, context: buildHtmlPageContext(tool, recommendation)}];
  }, []);
  const draftAiRecommendations = aiActionRecommendations.filter((item) => item.skill_key === 'drafts' || item.skill_name === 'Черновики');
  const campaignFunnelAiRecommendations = aiActionRecommendations.filter((item) => item.skill_key === 'funnel' || item.skill_name === 'Воронка кампейнинга');
  const pilotAiRecommendations = aiActionRecommendations.filter((item) => item.skill_key === 'pilots' || item.skill_name === 'Пилотные кампании');
  const pilotHtmlTool = findHtmlPageToolForRecommendation(PILOT_CAMPAIGNS_RECOMMENDATION);
  const pilotAiRecommendation = pilotAiRecommendations[0] || {
    ...PILOT_CAMPAIGNS_RECOMMENDATION,
    ai_products: [product.name],
  };
  const csiAiRecommendations = aiActionRecommendations.filter((item) => item.skill_key === 'csi' || item.skill_name === 'CSI');
  const complaintsAiRecommendations = aiActionRecommendations.filter((item) => item.skill_key === 'complaints' || item.skill_name === 'Жалобы и обращения');
  const openConfiguredSkill = (recommendation) => {
    const tool = findHtmlPageToolForRecommendation(recommendation);
    if (tool) {
      onOpenHtmlPageTool(tool.id, buildHtmlPageContext(tool, recommendation));
      return;
    }
    setReportAccessOpen(true);
  };
  const openMauAiRecommendation = () => openConfiguredSkill(mauAiRecommendation);
  const openDraftAiRecommendation = () => openConfiguredSkill(draftAiRecommendations[0]);
  const openCampaignFunnelAiRecommendation = () => openConfiguredSkill(campaignFunnelAiRecommendations[0]);
  const openPilotAiRecommendation = () => {
    if (pilotHtmlTool) onOpenHtmlPageTool(pilotHtmlTool.id, buildHtmlPageContext(pilotHtmlTool, pilotAiRecommendation));
  };
  const openCsiAiRecommendation = () => openConfiguredSkill(csiAiRecommendations[0]);
  const openComplaintsAiRecommendation = () => openConfiguredSkill(complaintsAiRecommendations[0]);
  const toggle = (code) => setOpen((current) => {
    const next = new Set(current);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });
  const recommendations = useMemo(() => {
    if (product.isPlaceholder) {
      if (!Number.isFinite(maxPoints) || maxPoints <= 0) return [];
      const groups = new Map();
      (product.metrics || []).forEach((block) => (block.metrics || []).filter((metric) => isDdIndexMetric(metric) && Number.isFinite(metric.value) && metric.value >= 0 && metric.value < metric.max_value).forEach((metric) => {
        const items = metric.recommendation_items || [];
        items.forEach((item) => {
          const gap = Number(item.gap || 0);
          if (!item.recommendation || gap <= 0) return;
          const key = `${block.name}|${item.recommendation}`;
          const current = groups.get(key) || {recommendation: item.recommendation, block: block.name, blockCode: block.code, metricCodes: [], count: 0, gap: 0, difficulty: item.recommendation_difficulty || item.group || 1};
          current.count += 1;
          current.gap += gap;
          if (!current.metricCodes.includes(metric.code)) current.metricCodes.push(metric.code);
          groups.set(key, current);
        });
      }));
      return [...groups.values()].map((item) => ({...item, indexUplift: item.gap / maxPoints * 100})).sort((a, b) => a.difficulty - b.difficulty || b.indexUplift - a.indexUplift);
    }
    if (!hasScore) return [];
    const groups = new Map();
    (product.metrics || []).forEach((block) => (block.metrics || []).filter(isDdIndexMetric).forEach((metric) => (metric.recommendation_items || []).forEach((item) => {
      const gap = Number(item.gap || 0);
      if (!item.recommendation || gap <= 0) return;
      const key = `${block.name}|${item.recommendation}`;
      const current = groups.get(key) || {recommendation: item.recommendation, block: block.name, blockCode: block.code, metricCodes: [], count: 0, gap: 0, difficulty: item.recommendation_difficulty || item.group || 1};
      current.count += 1;
      current.gap += gap;
      if (!current.metricCodes.includes(metric.code)) current.metricCodes.push(metric.code);
      groups.set(key, current);
    })));
    const sorted = [...groups.values()].sort((a, b) => a.difficulty - b.difficulty || b.gap - a.gap);
    return allocateIndexUplifts(sorted, score);
  }, [product, score, hasScore, maxPoints]);
  const recommendationCard = useMemo(
    () => summarizeRecommendationUplifts(recommendations, 4),
    [recommendations],
  );
  const openRecommendationDetails = (recommendation, closeDialog = false) => {
    const metricCodes = recommendation.metricCodes || [];
    if (!metricCodes.length) return;
    if (closeDialog) setRecommendationsOpen(false);
    setOpen((current) => new Set(current).add(recommendation.blockCode));
    setHighlightedMetrics(new Set(metricCodes));
    if (recommendationHighlightTimer.current) window.clearTimeout(recommendationHighlightTimer.current);
    recommendationHighlightTimer.current = window.setTimeout(() => {
      setHighlightedMetrics(new Set());
      recommendationHighlightTimer.current = null;
    }, 1000);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const firstMetric = metricCodes
        .map((metricCode) => document.getElementById(metricDomId(metricCode)))
        .find(Boolean);
      firstMetric?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }));
  };
  const radarData = useMemo(() => buildTeamProfileRadarData(product, products, visibleMetricBlocks)
    .map((item, index) => ({...item, name: teamProfileBlockTitle(visibleMetricBlocks[index])})),
  [products, visibleMetricBlocks, product]);

  return (
    <main className="content detail-page">
      {hasScore && !nextLevel && <LeaderConfetti productId={product.id || product.name} />}
      <SemanticButton intent={BUTTON_INTENT.navigation} onClick={onBack}><Icon data={ArrowLeft} size={16} />Назад к Summary</SemanticButton>
      <header className="detail-header">
        <div><h1>{displayProductName(product.name)}</h1><div className="detail-meta">{product.unit} · {product.period} · <Label size="xs">{product.type}</Label><SemanticButton intent={BUTTON_INTENT.destructive} href={REPORT_ERROR_URL} target="_blank">Нашли ошибку?</SemanticButton><SemanticButton intent={BUTTON_INTENT.feedback} href="https://public.oprosso.sberbank.ru/p/amsp1k1c" target="_blank" rel="noreferrer">Есть идея?</SemanticButton></div></div>
        <div className="detail-controls">
            <label className="product-select detail-period-filter"><span>Период</span><Select value={period ? [period] : []} onUpdate={(value) => onPeriodChange(value[0] || '')} size="l">
            {periods.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}
            </Select></label>
            <label className="product-select detail-team-unit-filter"><span>Юнит</span><Select value={teamUnit ? [teamUnit] : []} onUpdate={updateTeamUnit} placeholder="Все юниты" size="l">
            <Select.Option value="">Все юниты</Select.Option>
            {teamUnits.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}
            </Select></label>
            <label className="product-select detail-team-select"><span>Команда</span><Select filterable filterPlaceholder="Найти команду" value={[product.id]} onUpdate={(value) => { const nextProduct = filteredTeamProducts.find((item) => item.id === value[0]); if (nextProduct) onProduct(nextProduct); }} size="l">
            {filteredTeamProducts.map((item) => <Select.Option key={item.id} value={item.id}>{displayProductName(item.name)}</Select.Option>)}
            </Select></label>
        </div>
      </header>

      <div className="detail-lens-content">
      <div className="notice"><div className="notice-copy"><b>Значение индекса может корректироваться в зависимости от валидации источников и точечного аудита</b></div></div>
      <section className="detail-overview">
        <Card className={`index-profile-card tone-${maturityTone}`} view="outlined"><div className={`index-card tone-${maturityTone}${detailScore ? '' : ' index-card-compact'}`}><div className="index-card-title"><span>{displayProductName(product.name)}</span><HelpMark aria-label="Формула Data-Driven Index" popoverProps={HELP_POPOVER_PROPS}><IndexFormulaHelp /></HelpMark></div><div className="index-score"><strong>{hasScore ? `${score}%` : '—'}</strong>{hasScore && <b>/ 100</b>}<em>{maturity}</em></div>{indexDelta && <div className={`index-quarter-delta index-quarter-delta-${indexDelta.value > 0 ? 'positive' : indexDelta.value < 0 ? 'negative' : 'neutral'}`}><span className="index-quarter-delta-badge"><span className="index-quarter-delta-direction" aria-hidden="true" /><strong className="index-quarter-delta-value">{indexDelta.value > 0 ? '+' : indexDelta.value < 0 ? '−' : ''}{Math.abs(indexDelta.value).toLocaleString('ru-RU', {maximumFractionDigits: 1})} <span>п.п.</span></strong></span><span className="index-quarter-delta-caption">ко II кварталу</span></div>}{hasScore && <Progress value={score} theme={maturityTone} size="s" />}<div className="scale"><span>Требуют внимания</span><span>Развивающиеся</span><span>Зрелые</span><span>Лидеры Data Driven</span></div><div className="index-next-level"><Text variant="body-1" color={!hasScore ? 'secondary' : nextLevel ? 'primary' : 'positive'}>{!hasScore ? 'Нет данных об индексе за выбранный период' : nextLevel ? `До уровня «${nextLevel.name}» — ${percentToNextLevel}%` : 'Вы достигли уровня Лидеры Data Driven B2C'}</Text></div><RoadmapUplift key={product.id || product.name} roadmap={product.roadmap} currentLevel={maturity} productName={displayProductName(product.name)} /><div className="index-methodology-footer"><Text variant="body-1" color="secondary">Подробнее о подходе и критериях оценки, тут:</Text><Button view="flat-info" size="s" onClick={onAbout}>Перейти <Icon data={ChevronRight} size={13} /></Button></div>{detailScore && hasScore && <div className="index-points"><Text variant="caption-1" color="secondary">Набрано {earnedPoints.toFixed(2)} баллов из {maxPoints.toFixed(2)}</Text>{nextLevel && <Text variant="caption-1" color="secondary">До следующего уровня — {pointsToNextLevel.toFixed(2)} балла</Text>}</div>}</div><div className="profile-card"><Text variant="subheader-1">Профиль Data-Driven индекса</Text><div className="profile-radar"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius={compactRadar ? '38%' : '48%'}><PolarGrid stroke="var(--g-color-line-generic)" /><PolarAngleAxis dataKey="name" tick={<ProductRadarTick compact={compactRadar} />} /><Tooltip formatter={(value, name) => [value == null ? 'Не применимо' : `${value}%`, name]} /><Radar name="B2C" dataKey="benchmark" stroke="var(--g-color-text-secondary)" fill="var(--g-color-base-generic-medium)" fillOpacity={0.25} strokeWidth={2} strokeDasharray="4 3" shape={<ApplicableRadarShape />} /><Radar name={profileSeries.label} dataKey="product" stroke={profileSeries.stroke} fill={profileSeries.fill} fillOpacity={0.2} strokeWidth={2} shape={<ApplicableRadarShape />} dot={<ApplicableRadarDot dotFill={profileSeries.fill} dotRadius={2} />} /><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize: 11, color: 'var(--g-color-text-secondary)'}} /></RadarChart></ResponsiveContainer></div></div></Card>
        <Card className="top-recommendations" view="outlined"><h2>Рекомендации и фокусы для повышения DD-индекса</h2>{product.isPlaceholder && recommendations.length === 0 && <Text color="secondary">{hasPartialData ? 'Нет данных для рекомендаций' : 'Данные ещё не добавлены'}</Text>}{recommendationCard.visible.map((item, index) => { const difficulty = difficultyMeta(item.difficulty); return <button type="button" className="top-recommendation recommendation-action" onClick={() => openRecommendationDetails(item)} key={`${item.block}-${item.recommendation}`}><div className="recommendation-marker"><span>{index + 1}</span><Label theme={difficulty.theme} size="xs">{difficulty.label}</Label></div><div><b>{item.recommendation}</b><small>{item.block}</small></div><div className="recommendation-side"><div className="recommendation-uplift"><b>+{item.indexUplift.toFixed(1)} п.п. индекса</b>{detailScore && <span>+{item.gap.toFixed(2)} балла</span>}</div></div></button>; })}{recommendationCard.hiddenCount > 0 && <button type="button" className="top-recommendation top-recommendation-summary recommendation-action" onClick={() => setRecommendationsOpen(true)}><div className="recommendation-marker"><span>+</span></div><div><b>Остальные рекомендации</b><small>{recommendationCard.hiddenCount} в полном списке</small></div><div className="recommendation-side"><div className="recommendation-uplift"><b>+{recommendationCard.hiddenUplift.toFixed(1)} п.п. индекса</b></div></div></button>}{recommendations.length > 0 && <Button view="flat-info" onClick={() => setRecommendationsOpen(true)}>Все рекомендации <Label size="xs">{recommendations.length}</Label><Icon data={ChevronRight} size={14} /></Button>}</Card>
      </section>
      <Dialog open={recommendationsOpen} onClose={() => setRecommendationsOpen(false)} hasCloseButton maxWidth="m" fullWidth contentOverflow="auto">
        <Dialog.Header caption={`Все рекомендации · ${recommendations.length}`} />
        <Dialog.Body>
          <div className="recommendations-dialog-list">
            {recommendations.map((item, index) => { const difficulty = difficultyMeta(item.difficulty); return <button type="button" className="dialog-recommendation recommendation-action" onClick={() => openRecommendationDetails(item, true)} key={`${item.block}-${item.recommendation}-${index}`}><div className="recommendation-marker"><span>{index + 1}</span><Label theme={difficulty.theme} size="xs">{difficulty.label}</Label></div><div><b>{item.recommendation}</b><small>{item.count} {metricWord(item.count)} · {item.block}</small></div><div className="recommendation-side"><div className="recommendation-uplift"><b>+{item.indexUplift.toFixed(1)} п.п. индекса</b>{detailScore && <span>+{item.gap.toFixed(2)} балла</span>}</div></div></button>; })}
          </div>
        </Dialog.Body>
      </Dialog>
      <CrossSellPreviewDialog preview={crossSellPreviewOpen} onClose={() => setCrossSellPreviewOpen(null)} />
      <CJXplorerDialog product={cjxplorerProduct} open={cjxplorerOpen} onClose={() => setCjxplorerOpen(false)} />
      <section className="metrics-section">
        <div className="metrics-title"><h2>Ключевые блоки DD-рейтинга</h2><div className="detail-mode" role="group" aria-label="Вид деталей"><Button selected={detailMode === 'detailed'} onClick={() => { setDetailMode('detailed'); setOpen(new Set(visibleMetricBlocks.map((item) => item.code))); }}>Подробно</Button><Button selected={detailMode === 'compact'} onClick={() => { setDetailMode('compact'); setOpen(new Set()); }}>Компактно</Button></div></div>
        <div className="metrics-grid">
          {visibleMetricBlocks.map((aggregateBlock) => {
            const salaryCohortKey = salaryCohortSelections[aggregateBlock.code] || 'b2c';
            const cohort = product.salaryToggleBlockCodes?.includes(aggregateBlock.code)
              ? product.salaryCohorts?.[salaryCohortKey] : null;
            const cohortBlock = cohort?.metrics.find((item) => item.code === aggregateBlock.code);
            const block = cohortBlock ? salaryB2cComparisonBlock(product, cohort,
              {...cohortBlock, metrics: cohortBlock.metrics.filter((metric) => !isQ3CampaignMetricHidden(cohort, metric))}, baselineProducts) : aggregateBlock;
            const metricProduct = cohortBlock ? cohort : product;
            const templateMetrics = product.isPlaceholder
              ? filterInapplicableMetricSubgroups(filterMetricsForBlock(block, (block.metrics || []).filter(isVisibleMetric)), metricGroup)
              : [];
            const templateVisibleMetrics = product.isPlaceholder ? (block.metrics || []).filter(isVisibleMetric) : [];
            const templateAllIrrelevant = templateVisibleMetrics.length > 0 && templateVisibleMetrics.every((metric) => metric.is_applicabble_flg === false && metric.code !== 'hyp.ab_tests');
            const templateBlockScore = product.isPlaceholder ? completeBlockPercent(block, metricProduct.period) : null;
            const templateGrowth = product.isPlaceholder ? quarterComparison ? quarterBlockGrowth(quarterComparison, aggregateBlock.code) : blockActualGrowth(block, maxPoints, metricProduct.period) : null;
            const templateStaticLinks = templateMetrics.flatMap((metric) => {
              if (/^hyp\.ab_tests$/i.test(metric.code)) return AB_TEST_INSTRUCTION_LINKS.map((action) => ({label: action.label, url: action.href}));
              if (/^hyp\.datadriven_rating_7_5$/i.test(metric.code)) return [{label: 'Библиотека решений', url: RESEARCH_LIBRARY_URL}];
              if (/^dannye\.promyshlenye_dannye$/i.test(metric.code)) return industrialDataResourcesFor(product.name).map((action) => ({label: action.label, url: action.href || action.url || action.link}));
              if (/^dannye\.kontrol.*kkd$/i.test(metric.code)) return [{label: 'Централизованный сервис ККД', url: CENTRALIZED_KKD_CDO_URL}];
              return [];
            });
            const templateReferenceLinks = [...(block.reference_links || []), ...templateStaticLinks].filter((item, index, all) => item.url && all.findIndex((candidate) => candidate.label === item.label && candidate.url === item.url) === index);
            if (product.isPlaceholder) return <Card key={block.code} data-salary-block={cohortBlock ? block.code : undefined} className={`metric-block tone-${templateBlockScore === null ? 'default' : progressTheme(templateBlockScore)}`} view="outlined">
              <div className="dd-metric-block-head">
                <button className="dd-metric-block-main" onClick={() => toggle(block.code)} aria-expanded={open.has(block.code)}>
                  <Icon data={open.has(block.code) ? ChevronDown : ChevronRight} size={14} />
                  <div><h3>{teamProfileBlockTitle(block)}</h3></div>
                </button>
                {templateGrowth && <div className="dd-metric-block-growth"><MetricActualGrowthBadge growth={templateGrowth} blockHeader /></div>}
                <div className="dd-metric-block-controls">{cohortBlock && <SalaryCohortControl block={block} aggregateBlock={aggregateBlock} period={product.period} value={salaryCohortKey} onUpdate={(value) => setSalaryCohortSelections((previous) => ({...previous, [block.code]: value}))} />}<div className="dd-metric-block-help"><ProductBlockHelp blockCode={block.code} product={metricProduct} />{(block.code === 'general' || /знание ключевых метрик/i.test(String(block.name || ''))) && <HelpMark aria-label="Источник оценки" popoverProps={HELP_POPOVER_PROPS}>Расчёт на основании опроса PO с верификацией по цифровым следам: ответы продукта сверяются с данными дашборда по ключевым метрикам.</HelpMark>}</div></div>
                <div className="dd-metric-block-score">{templateAllIrrelevant ? <span className="metric-block-na">Не применимо</span> : <strong>{templateBlockScore === null ? '—' : `${templateBlockScore}%`}</strong>}</div>
              </div>
              {open.has(block.code) && <div className="metric-list">{templateMetrics.map((metric, index, metrics) => { const preview = metric.code === 'mehaniki.cross_sell' ? crossSellPreview(product, block) : null; const insights = preview ? [{title: 'Cross-sell', label: 'Доступные связки', onClick: () => setCrossSellPreviewOpen({...preview, metricCriterion: true})}] : []; if (metric.code === 'hyp.discovery_40_backlog' && onBacklog) insights.push({title: 'Декомпозиция бэклога', label: 'Декомпозиция бэклога', tone: 'info', onClick: onBacklog}); return <MetricGroupEntry key={metric.code} metrics={metrics} index={index} block={block} product={metricProduct} expanded={detailMode === 'detailed'}><MetricRow block={block} product={metricProduct} metric={metric} detailScore={detailScore} maxIndexPoints={maxPoints} aiMetricInsights={insights} grouped={Boolean(metricGroup(metric))} nested={isReportingRegularity(metric)} /></MetricGroupEntry>; })}</div>}
              {open.has(block.code) && <BlockReferenceLinks referenceLinks={templateReferenceLinks} participantLinks={block.participant_links} referencePeriod={block.referencePeriod} />}
            </Card>;
            const visibleMetrics = (block.metrics || []).filter(isVisibleMetric);
            const blockMetrics = filterMetricsForBlock(block, visibleMetrics);
            const metrics = filterInapplicableMetricSubgroups(blockMetrics, metricGroup);
            const blockScore = blockPercent(block);
            const growth = quarterComparison ? quarterBlockGrowth(quarterComparison, aggregateBlock.code) : blockActualGrowth(block, maxPoints, product.period);
            const allIrrelevant = visibleMetrics.length > 0 && visibleMetrics.every((metric) => metric.is_applicabble_flg === false);
            const isOpen = open.has(block.code);
            const value = metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
            const max = metrics.reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
            const blockLinks = linksForBlock(block, product.metrics || [], product);
            const participantLinks = (block.participant_links || []).filter((item) => item?.label && (item.url || item.link));
            const instructions = (block.tools || []).filter((tool) => tool.kind === 'instruction' && tool.button?.link);
            const hasPilotCampaigns = hasPilotCampaignSkill(block);
            const firstPilotAction = metrics.find((metric) => /^attract\.campaign_launches$/i.test(metric.code) && metric.is_applicabble_flg !== false && Number(metric.value || 0) === 0 && (metric.zero_button?.link || metric.zero_button?.url))?.zero_button || null;
            const isKeyMetricsBlock = block.code === 'general' || /знание ключевых метрик/i.test(String(block.name || ''));
            const showKeyMetricsDisclaimer = isKeyMetricsBlock && hasMetricDeviations(metrics);
            return (
              <Card key={block.code} className={`metric-block tone-${allIrrelevant ? 'default' : progressTheme(blockScore)}`} view="outlined">
                <div className="dd-metric-block-head">
                  <button className="dd-metric-block-main" onClick={() => toggle(block.code)} aria-expanded={isOpen}>
                    <Icon data={isOpen ? ChevronDown : ChevronRight} size={14} />
                    <div><h3>{teamProfileBlockTitle(block)}</h3>{detailScore && <span>Набрано {value.toFixed(2)} баллов из {max.toFixed(2)}</span>}</div>
                  </button>
                  {growth && <div className="dd-metric-block-growth"><MetricActualGrowthBadge growth={growth} blockHeader /></div>}
                  <div className="dd-metric-block-help">
                    <ProductBlockHelp blockCode={block.code} product={product} />
                    {isKeyMetricsBlock && <HelpMark aria-label="Источник оценки" popoverProps={HELP_POPOVER_PROPS}>Расчёт на основании опроса PO с верификацией по цифровым следам: ответы продукта сверяются с данными дашборда по ключевым метрикам.</HelpMark>}
                  </div>
                  <div className="dd-metric-block-score">{allIrrelevant ? <span className="metric-block-na">Не применимо</span> : <strong>{blockScore}%</strong>}</div>
                </div>
                {isOpen && showKeyMetricsDisclaimer && <div className="key-metrics-disclaimer"><Icon data={CircleInfo} size={16} /><span>На базе самооценки в Oprosso. Следующая волна — 3Q26. <strong>Используйте отчёты ниже как ориентир по ключевым метрикам.</strong></span></div>}
                {isOpen && <div className="metric-list">{metrics.map((metric, index) => { const group = metricGroup(metric); const instruction = /^alerts\.business_metrics$/i.test(metric.code) ? instructions[0] : null; const instructionLinks = /^hyp\.ab_tests$/i.test(metric.code) ? AB_TEST_INSTRUCTION_LINKS : []; const library = /^hyp\.datadriven_rating_7_5$/i.test(metric.code) ? {link: RESEARCH_LIBRARY_URL} : null; const zeroAction = /^attract\.nalichie_self_service$/i.test(metric.code) ? firstPilotAction : null; const hasDraftAiInsight = draftAiRecommendations.length > 0 && /^attract\.chernoviki_v_sbol_70$/i.test(metric.code); const skillActions = metricSkillLinks(block, metric).filter((action) => !(hasDraftAiInsight && /^черновики$/i.test(action.label))); let aiMetricInsight = null; if (hasMauAiRecommendation && /\.mau_produkta$/i.test(metric.code)) aiMetricInsight = metricAiInsight('динамике MAU', openMauAiRecommendation); if (hasDraftAiInsight) aiMetricInsight = metricAiInsight('черновикам в СБОЛ', openDraftAiRecommendation); if (campaignFunnelAiRecommendations.length && /^attract\.funnel_analysis$/i.test(metric.code)) aiMetricInsight = metricAiInsight('воронке кампейнинга', openCampaignFunnelAiRecommendation); const aiMetricInsights = htmlPageAiRecommendations.filter(({tool}) => tool.action?.metricCode === metric.code).map(({tool, context}) => metricAiInsight(tool.action.subject, () => onOpenHtmlPageTool(tool.id, context))); if (hasPilotCampaigns && pilotHtmlTool && /^attract\.nalichie_self_service$/i.test(metric.code)) aiMetricInsights.push(metricAiInsight('пилотным кампаниям', openPilotAiRecommendation)); if (/^cx\.score$/i.test(metric.code) && cjxplorerProduct) aiMetricInsights.push({title: 'Оценка CJ', label: 'Оценка CJ', onClick: () => setCjxplorerOpen(true)}); if (/^cx\.score$/i.test(metric.code) && csiAiRecommendations.length) aiMetricInsights.push(metricAiInsight('CSI', openCsiAiRecommendation)); if (/^cx\.score$/i.test(metric.code) && complaintsAiRecommendations.length) aiMetricInsights.push(metricAiInsight('жалобам и обращениям', openComplaintsAiRecommendation)); const crossSell = /^mehaniki\.cross_sell$/i.test(metric.code) ? crossSellPreview(product, block) : null; if (crossSell) aiMetricInsights.push({title: 'Cross-sell', label: 'Доступные связки', tone: 'info', onClick: () => setCrossSellPreviewOpen(crossSell)}); if (metric.code === 'hyp.discovery_40_backlog' && onBacklog) aiMetricInsights.push({title: 'Декомпозиция бэклога', label: 'Декомпозиция бэклога', tone: 'info', onClick: onBacklog}); const digitallyConfirmed = isCrossSellDigitallyConfirmed(product, block, metric); const crossSellUnconfirmed = isCrossSellDigitallyUnconfirmed(product, block, metric); return <MetricGroupEntry key={metric.code} metrics={metrics} index={index} block={block} product={product} expanded={detailMode === 'detailed'}><MetricRow block={block} metric={metric} product={product} detailScore={detailScore} maxIndexPoints={maxPoints} instruction={instruction} instructionLinks={instructionLinks} library={library} zeroAction={zeroAction} aiMetricInsight={aiMetricInsight} aiMetricInsights={aiMetricInsights} skillActions={skillActions} grouped={Boolean(group)} nested={isReportingRegularity(metric)} digitallyConfirmed={digitallyConfirmed} crossSellUnconfirmed={crossSellUnconfirmed} highlighted={highlightedMetrics.has(metric.code)} onOpenHtmlPageTool={onOpenHtmlPageTool} /></MetricGroupEntry>; })}</div>}
                {isOpen && <BlockReferenceLinks referenceLinks={blockLinks} participantLinks={participantLinks} />}
              </Card>
            );
          })}
        </div>
      </section>
      {!product.isPlaceholder && <><div className="metrics-title team-business-metrics-title">
        <h2>Аналитические навыки</h2>
      </div>
      <Card className="promo metric-report-promo team-business-metrics-analytics" view="outlined">
        <div><Text variant="subheader-1">AI-аналитика по бизнес-метрикам</Text><Text variant="body-1" color="secondary">Ключевые изменения и быструю аналитику по своим бизнес-метрикам можно также посмотреть в комплексном отчете. Этот блок не влияет на Data Driven Index вашей команды, но может содержать полезные инсайты и рекомендации по основным блокам вашего бизнеса.</Text></div>
        <SemanticButton intent={BUTTON_INTENT.primary} onClick={() => setReportAccessOpen(true)}>Перейти <Icon data={ChevronRight} size={14} /></SemanticButton>
      </Card></>}
      </div>
      <Dialog open={reportAccessOpen} onClose={() => setReportAccessOpen(false)} hasCloseButton maxWidth="m" fullWidth>
        <Dialog.Header caption="Комплексный отчет" />
        <Dialog.Body>
          <div className="report-access-content">
            <Text variant="subheader-1">Доступ к системе</Text>
            <Text variant="body-2">Для доступа непосредственно к системе необходимо в АС Друг в поисковой строке ввести «Доступ к стендам разработки и тестирования», далее:</Text>
            <ul>
              <li><Text variant="body-1">Выбрать «Открыть доступ»</Text></li>
              <li><Text variant="body-1">В поле «Выберите автоматизированную систему или ИТ услугу» указать «AI HUB B2C (CI06049712)»</Text></li>
              <li><Text variant="body-1">В обосновании — «Для разработки и тестирования инструмента AI суммаризации»</Text></li>
            </ul>
            <Text variant="body-2">Для входа в систему используйте почтовый адрес сигма и первичный пароль. ФИО, кому направить первичный пароль, просьба направить на почту (Хазипова Мария Юрьевна).</Text>
            <div className="report-access-actions"><SemanticButton intent={BUTTON_INTENT.secondary} href={REPORT_ACCESS_REQUEST_URL} target="_blank">Завести заявку на доступ</SemanticButton><SemanticButton intent={BUTTON_INTENT.primary} href={COMPLEX_REPORT_URL} target="_blank" extraProps={{[STAND_ACCESS_ALLOW_ATTRIBUTE]: ''}}>Перейти</SemanticButton></div>
          </div>
        </Dialog.Body>
      </Dialog>
    </main>
  );
}
