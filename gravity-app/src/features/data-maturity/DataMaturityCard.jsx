import React from 'react';
import {CaretDown, CaretUp, ChevronDown, ChevronRight} from '@gravity-ui/icons';
import {Card, Icon, Label} from '@gravity-ui/uikit';
import {progressTheme as scoreTone} from '../catalog/Catalog.jsx';
import {
  deltaDirection,
  formatMaturityDelta,
  formatMaturityValue,
  planLabelTheme,
  planStatus,
  planStatusLabel,
  planTone,
  visibleMaturityCategories,
} from './dataMaturity.js';

export function DashboardBlockCard({name, score, reference, tone}) {
  return (
    <Card className={`metric-block metric-block-static tone-${tone}`} view="outlined">
      <div className="dd-metric-block-head">
        <div className="dd-metric-block-main dd-metric-block-main-static">
          <div>
            <h3>{name}</h3>
            <span>{reference === null ? 'Нет данных по B2C' : `B2C ${reference}%`}</span>
          </div>
        </div>
        <div className="dd-metric-block-help" />
        <div className="dd-metric-block-score">{score === null ? <span className="metric-block-na">Нет данных</span> : <strong>{score}%</strong>}</div>
      </div>
    </Card>
  );
}

function MaturityMetricRow({metric}) {
  const status = planStatus(metric);
  const delta = formatMaturityDelta(metric.delta, metric.measure);
  const direction = deltaDirection(metric.delta);
  return (
    <div className="metric-row">
      <div className="metric-copy">
        <i className={`metric-light metric-light-${planTone(status)}`} aria-hidden="true" title={planStatusLabel(status)} />
        <div>
          <div className="metric-name-line"><b>{metric.label}</b></div>
          <span>{metric.note || metric.description}</span>
        </div>
      </div>
      <div className="metric-value">
        <div className="metric-status-with-confirmation">
          <div className="metric-value-group">
            {delta !== '—' && (
              <span className={`data-maturity-delta data-maturity-delta-${metric.trend}`}>
                {direction !== 'flat' && <Icon data={direction === 'up' ? CaretUp : CaretDown} size={14} />}
                {delta}
              </span>
            )}
            <Label className="metric-status-label" theme={planLabelTheme(status)}>{formatMaturityValue(metric.value, metric.measure)}</Label>
          </div>
        </div>
        <span className="data-maturity-plan-note">{metric.planLabel ? `план ${metric.planLabel}` : 'план отсутствует'}</span>
      </div>
    </div>
  );
}

export function DataMaturityCard({unit, meta, isOpen, onToggle}) {
  const categories = visibleMaturityCategories(unit);
  if (!unit || !categories.length) return null;
  return (
    <Card className={`metric-block metric-block-data-maturity${unit.score === null ? '' : ` tone-${scoreTone(unit.score)}`}`} view="outlined">
      <div className="dd-metric-block-head">
        <button className="dd-metric-block-main" type="button" onClick={onToggle} aria-expanded={isOpen}>
          <Icon data={isOpen ? ChevronDown : ChevronRight} size={14} />
          <div>
            <h3>Уровень зрелости данных</h3>
            <span>{meta?.averageScore === null || meta?.averageScore === undefined ? 'Нет данных по B2C' : `B2C ${meta.averageScore}%`} · не влияет на DD-рейтинг</span>
          </div>
        </button>
        <div className="dd-metric-block-help" />
        <div className="dd-metric-block-score">{unit.score === null ? <span className="metric-block-na">Нет нормативов</span> : <strong>{unit.score}%</strong>}</div>
      </div>
      {isOpen && (
        <div className="metric-list">
          {categories.map((category) => (
            <React.Fragment key={category.key}>
              <div className="metric-group-title"><span>{category.label}</span></div>
              {category.metrics.map((metric) => <MaturityMetricRow key={metric.key} metric={metric} />)}
            </React.Fragment>
          ))}
        </div>
      )}
    </Card>
  );
}
