import React, {useMemo, useState} from 'react';
import {
  ArrowUpRightFromSquare,
  ChartLinePoints,
  ChevronDown,
  ChevronRight,
  CircleCheckFill,
  CircleInfo,
} from '@gravity-ui/icons';
import {
  Button,
  Card,
  Icon,
  Label,
  Link,
  Progress,
  Select,
  Tooltip,
} from '@gravity-ui/uikit';
import {
  getClickstreamCatalog,
  getClickstreamReport,
  resolveClickstreamFunnelId,
} from '../clickstream/clickstreamData.js';

const TRAFFIC_THEMES = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
};

const CONCLUSION_THEMES = {
  stable: 'success',
  traffic: 'warning',
  local: 'warning',
  cascade: 'danger',
  distributed: 'danger',
};

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value || 0));
}

function formatDelta(value, suffix = '') {
  if (value == null) return '—';
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${number}${suffix}`;
}

function conversionTheme(value, high = 70, middle = 50) {
  if (value >= high) return 'success';
  if (value >= middle) return 'warning';
  return 'danger';
}

function initialSelection(catalog) {
  const parameters = new URLSearchParams(window.location.search);
  const requestedFunnel = parameters.get('funnel') || '';
  const requestedPeriod = parameters.get('period') || '';
  const funnelId = resolveClickstreamFunnelId(requestedFunnel)
    || catalog.funnels[0]?.id
    || '';
  const periodValue = requestedPeriod && requestedPeriod !== 'latest'
    && catalog.periods.some(({value}) => value === requestedPeriod)
    ? requestedPeriod
    : catalog.latestPeriodValue;
  return {funnelId, periodValue};
}

function SummaryTile({label, value, note, wide = false}) {
  return (
    <Card view="outlined" className={`clickstream-summary-tile${wide ? ' clickstream-summary-tile-wide' : ''}`}>
      <div className="clickstream-eyebrow">{label}</div>
      <div className="clickstream-summary-value">{value}</div>
      <div className="clickstream-summary-note">{note}</div>
    </Card>
  );
}

function SummaryGrid({report}) {
  const {summary} = report;
  return (
    <section className="clickstream-summary-grid" aria-label="Сводка по воронке">
      <SummaryTile
        label="Воронка"
        value={summary.funnelName}
        note={`${summary.dateFrom} — ${summary.dateTo}`}
        wide
      />
      <SummaryTile
        label="Входящих"
        value={formatNumber(summary.incoming)}
        note={summary.incomingStep.name}
      />
      <SummaryTile
        label="Финальных"
        value={formatNumber(summary.final)}
        note={summary.finalStep.name}
      />
      <SummaryTile
        label="Итоговая конверсия"
        value={`${summary.totalConversion.toFixed(1)}%`}
        note="от начала до финала"
      />
    </section>
  );
}

function EventDetails({step}) {
  if (!step.eventActions.length && !step.nrtMatches.length) return null;
  return (
    <div className="clickstream-event-details">
      {step.eventActions.length > 0 && (
        <div>
          <div className="clickstream-detail-caption">
            Настроено {step.eventActions.length} event_action
          </div>
          <div className="clickstream-event-list">
            {step.eventActions.map((action) => (
              <Label key={action} theme="info" size="s">{action}</Label>
            ))}
          </div>
        </div>
      )}
      {step.nrtMatches.map((match) => (
        <div className="clickstream-nrt-group" key={`${step.number}-${match.product}`}>
          <div className="clickstream-nrt-heading">
            <strong>{match.product}</strong>
            <span>совпало {match.matched_count} из {match.total_count} событий</span>
          </div>
          {(match.events || []).map((event) => (
            <div className="clickstream-nrt-event" key={event.original}>
              <Icon data={event.matched ? CircleCheckFill : CircleInfo} size={14} />
              <span>{event.original}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FunnelTable({report}) {
  const [expanded, setExpanded] = useState(() => new Set());
  const hasNrt = Boolean(report.raw.nrt_configured);
  const tableColumnCount = 8 + Number(hasNrt);
  const toggleStep = (number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  };

  return (
    <Card
      view="outlined"
      className="clickstream-widget clickstream-table-card"
    >
      <div className="clickstream-widget-header">
        <div>
          <div className="clickstream-eyebrow">Детализация</div>
          <h2>Шаги воронки</h2>
        </div>
        <Label theme="info">{report.steps.length} этапов</Label>
      </div>
      <div className="clickstream-table-scroll">
        <table className="clickstream-table">
          <thead>
            <tr>
              <th className="clickstream-cell-center">#</th>
              <th>Шаг</th>
              <th className="clickstream-cell-center">События</th>
              {hasNrt && <th className="clickstream-cell-center">NRT</th>}
              <th className="clickstream-cell-number">Кол-во</th>
              <th className="clickstream-cell-number">Дельта к пред.</th>
              <th className="clickstream-cell-center">Конв. к пред.</th>
              <th className="clickstream-cell-center">Конв. от начала</th>
              <th>Ширина воронки</th>
            </tr>
          </thead>
          <tbody>
            {report.steps.map((step) => {
              const hasDetails = step.eventActions.length > 0 || step.nrtMatches.length > 0;
              const isExpanded = expanded.has(step.number);
              const matchedNrtEvents = step.nrtMatches.flatMap((match) => (
                (match.events || []).filter((event) => event.matched)
              )).length;
              return (
                <React.Fragment key={step.number}>
                  <tr>
                    <td className="clickstream-step-number clickstream-cell-center">{step.number}</td>
                    <td className="clickstream-step-name">{step.name}</td>
                    <td className="clickstream-cell-center">
                      {hasDetails ? (
                        <Button
                          view="flat-secondary"
                          size="s"
                          onClick={() => toggleStep(step.number)}
                          aria-expanded={isExpanded}
                        >
                          <Icon data={isExpanded ? ChevronDown : ChevronRight} size={14} />
                          {step.eventActions.length || 'NRT'}
                        </Button>
                      ) : '—'}
                    </td>
                    {hasNrt && <td className="clickstream-cell-center">{matchedNrtEvents}</td>}
                    <td className="clickstream-number clickstream-cell-number">{formatNumber(step.count)}</td>
                    <td className={`clickstream-cell-number clickstream-secondary-metric${step.countDelta > 0 ? ' clickstream-positive' : step.countDelta < 0 ? ' clickstream-negative' : ''}`}>
                      {formatDelta(step.countDelta)}
                    </td>
                    <td className="clickstream-cell-center clickstream-secondary-metric">
                      {step.conversionFromPrevious == null
                        ? '—'
                        : <Label theme={conversionTheme(step.conversionFromPrevious)}>{step.conversionFromPrevious.toFixed(1)}%</Label>}
                    </td>
                    <td className="clickstream-cell-center clickstream-secondary-metric">
                      <Label theme={conversionTheme(step.conversionFromStart, 70, 30)}>
                        {step.conversionFromStart.toFixed(1)}%
                      </Label>
                    </td>
                    <td className="clickstream-progress-cell">
                      <Progress value={step.conversionFromStart} theme="info" size="s" />
                    </td>
                  </tr>
                  {isExpanded && hasDetails && (
                    <tr className="clickstream-expanded-row">
                      <td colSpan={tableColumnCount}>
                        <EventDetails step={step} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TrafficWidget({traffic}) {
  const help = (
    <div className="clickstream-tooltip-copy">
      <div><strong>Рост:</strong> финальный шаг растёт к прошлому периоду.</div>
      <div><strong>Нейтрально:</strong> снижение неустойчиво или истории недостаточно.</div>
      <div><strong>Снижение:</strong> три последних периода строго ниже предыдущих.</div>
    </div>
  );
  return (
    <Card view="outlined" className={`clickstream-widget clickstream-traffic clickstream-traffic-${traffic.status}`}>
      <div className="clickstream-traffic-mark" aria-hidden="true" />
      <div className="clickstream-traffic-title">
        <Label theme={TRAFFIC_THEMES[traffic.status] || 'normal'} size="m">
          {traffic.label}
        </Label>
        <Tooltip content={help} placement="top">
          <Button view="flat-secondary" size="s" aria-label="Как определяется статус">
            <Icon data={CircleInfo} size={16} />
          </Button>
        </Tooltip>
      </div>
      <div className="clickstream-traffic-copy">
        <p>{traffic.description}</p>
        <span>Сравнение с предыдущим периодом: {traffic.previousPeriodLabel}</span>
      </div>
    </Card>
  );
}

function RecommendationText({recommendation}) {
  if (recommendation.kind === 'campaigns' && recommendation.salesDelta != null) {
    return (
      <>
        {recommendation.text}{' '}
        Текущий результат — {formatNumber(recommendation.salesCurrent)} шт.,
        ранее — {formatNumber(recommendation.salesPrevious)} шт.;
        изменение {formatDelta(recommendation.salesDelta)} шт.
      </>
    );
  }
  return recommendation.text;
}

function RecommendationsWidget({recommendations}) {
  const positive = recommendations.length === 1 && recommendations[0].kind === 'positive';
  return (
    <Card view="outlined" className={`clickstream-widget${positive ? ' clickstream-recommendations-positive' : ''}`}>
      <div className="clickstream-widget-header">
        <div>
          <div className="clickstream-eyebrow">Следующие действия</div>
          <h2>Рекомендации</h2>
        </div>
        {positive && <Icon data={CircleCheckFill} size={22} />}
      </div>
      <ol className="clickstream-recommendations">
        {recommendations.map((recommendation, index) => (
          <li key={`${recommendation.kind}-${index}`}>
            <span className="clickstream-recommendation-number">{index + 1}</span>
            <div>
              <RecommendationText recommendation={recommendation} />
              {recommendation.link && (
                <>
                  {' '}
                  <Link href={recommendation.link.href} target="_blank" rel="noreferrer">
                    {recommendation.link.label}
                    <Icon data={ArrowUpRightFromSquare} size={13} />
                  </Link>
                </>
              )}
              {recommendation.kind === 'nrt' && recommendation.details && (
                <ul className="clickstream-recommendation-details">
                  {recommendation.details.notCovered.length > 0 && (
                    <li>Нет покрытия: {recommendation.details.notCovered.join(', ')}</li>
                  )}
                  {recommendation.details.partial.length > 0 && (
                    <li>Частичное покрытие: {recommendation.details.partial.join(', ')}</li>
                  )}
                  {recommendation.details.extra.length > 0 && (
                    <li>Лишние триггеры: {recommendation.details.extra.join(', ')}</li>
                  )}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function NrtCoverageWidget({coverage}) {
  if (!coverage) return null;
  const issues = [
    coverage.notCovered.length && `Не покрыто: ${coverage.notCovered.join(', ')}`,
    coverage.partial.length && `Частично: ${coverage.partial.join(', ')}`,
    coverage.extra.length && `Лишние триггеры: ${coverage.extra.join(', ')}`,
  ].filter(Boolean);
  return (
    <Card view="outlined" className="clickstream-widget">
      <div className="clickstream-widget-header">
        <div>
          <div className="clickstream-eyebrow">Коммуникации</div>
          <h2>Покрытие NRT-коммуникациями</h2>
        </div>
        <Label theme={coverage.coveredPercent === 100 ? 'success' : 'warning'}>
          {coverage.coveredPercent}%
        </Label>
      </div>
      <p className="clickstream-coverage-copy">
        Покрыто NRT: {coverage.fullyCovered} из {coverage.total} этапов
      </p>
      <Progress value={coverage.coveredPercent} theme="info" size="m" />
      {issues.length > 0 && (
        <ul className="clickstream-coverage-issues">
          {issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      )}
    </Card>
  );
}

function TopDropsWidget({steps}) {
  return (
    <Card view="outlined" className="clickstream-widget">
      <div className="clickstream-widget-header">
        <div>
          <div className="clickstream-eyebrow">Диагностика</div>
          <h2>Основные этапы по падению CR</h2>
        </div>
      </div>
      {steps.length ? (
        <div className="clickstream-table-scroll">
          <table className="clickstream-table clickstream-drops-table">
            <thead>
              <tr>
                <th className="clickstream-cell-center">#</th>
                <th>Этап</th>
                <th className="clickstream-cell-center">Шаг</th>
                <th className="clickstream-cell-center">CR</th>
                <th className="clickstream-cell-number">Δ CR м/м</th>
                <th className="clickstream-cell-number">Потери, шт.</th>
                <th className="clickstream-cell-number">Потери, %</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, index) => (
                <tr key={step.number}>
                  <td className="clickstream-cell-center">{index + 1}</td>
                  <td className="clickstream-step-name">{step.name}</td>
                  <td className="clickstream-cell-center">{step.number}</td>
                  <td className="clickstream-cell-center"><Label theme={conversionTheme(step.conversionFromPrevious)}>{step.conversionFromPrevious.toFixed(1)}%</Label></td>
                  <td className={`clickstream-cell-number${step.conversionDelta > 0 ? ' clickstream-positive' : step.conversionDelta < 0 ? ' clickstream-negative' : ''}`}>
                    {formatDelta(step.conversionDelta, ' пп')}
                  </td>
                  <td className="clickstream-cell-number">{step.lost == null ? '—' : `−${formatNumber(step.lost)}`}</td>
                  <td className="clickstream-cell-number">{step.lostPercent == null ? '—' : `${step.lostPercent.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="clickstream-empty">Нет данных</p>}
    </Card>
  );
}

function ConclusionWidget({conclusion}) {
  if (!conclusion) return null;
  return (
    <Card view="outlined" className="clickstream-widget clickstream-conclusion">
      <div className="clickstream-widget-header">
        <div>
          <div className="clickstream-eyebrow">Изменение к прошлому месяцу</div>
          <h2>Вывод по изменению CR <small>{conclusion.periodMark}</small></h2>
        </div>
        <Label theme={CONCLUSION_THEMES[conclusion.pattern] || 'info'}>{conclusion.label}</Label>
      </div>
      <p>{conclusion.text}</p>
    </Card>
  );
}

export function ClickstreamApp() {
  const catalog = useMemo(() => getClickstreamCatalog(), []);
  const initial = useMemo(() => initialSelection(catalog), [catalog]);
  const [draftFunnelId, setDraftFunnelId] = useState(initial.funnelId);
  const [draftPeriodValue, setDraftPeriodValue] = useState(initial.periodValue);
  const [selection, setSelection] = useState(initial);
  const report = useMemo(
    () => getClickstreamReport(selection.funnelId, selection.periodValue),
    [selection],
  );

  const funnelOptions = catalog.funnels.map(({id, name}) => ({value: id, content: name}));
  const periodOptions = catalog.periods.map(({value, label}) => ({value, content: label}));
  const applyFilters = () => {
    if (!draftFunnelId || !draftPeriodValue) return;
    setSelection({funnelId: draftFunnelId, periodValue: draftPeriodValue});
  };

  return (
    <main className="clickstream-page">
      <div className="clickstream-document">
        <header className="clickstream-page-header">
          <div className="clickstream-title-icon">
            <Icon data={ChartLinePoints} size={22} />
          </div>
          <div>
            <h1>Анализ кликстрим воронок</h1>
            <p>Выгрузка · месячный режим</p>
          </div>
        </header>

        <Card view="outlined" className="clickstream-filter-card">
          <div className="clickstream-filter-field" id="exp-funnel">
            <label>Воронка</label>
            <Select
              size="l"
              width="max"
              filterable
              value={draftFunnelId ? [draftFunnelId] : []}
              options={funnelOptions}
              placeholder="Найдите воронку"
              onUpdate={(values) => setDraftFunnelId(values[0] || '')}
            />
          </div>
          <div className="clickstream-filter-field" id="exp-period">
            <label>Период</label>
            <Select
              size="l"
              width="max"
              value={draftPeriodValue ? [draftPeriodValue] : []}
              options={periodOptions}
              onUpdate={(values) => setDraftPeriodValue(values[0] || '')}
            />
          </div>
          <Button
            id="exp-show"
            view="action"
            size="l"
            disabled={!draftFunnelId || !draftPeriodValue}
            onClick={applyFilters}
          >
            Показать
          </Button>
        </Card>

        {report ? (
          <div className="clickstream-results">
            <SummaryGrid report={report} />
            <FunnelTable report={report} />
            <TrafficWidget traffic={report.traffic} />
            <RecommendationsWidget recommendations={report.recommendations} />
            <NrtCoverageWidget coverage={report.nrtCoverage} />
            <TopDropsWidget steps={report.topCrDrops} />
            <ConclusionWidget conclusion={report.conclusion} />
          </div>
        ) : (
          <Card view="outlined" className="clickstream-empty">
            Нет данных для выбранной комбинации фильтров
          </Card>
        )}
      </div>
    </main>
  );
}
