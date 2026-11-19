import React, {useMemo, useState} from 'react';
import {ChevronDown, ChevronRight} from '@gravity-ui/icons';
import {Button, Dialog, Icon, Label, Select} from '@gravity-ui/uikit';
import {MATURITY_LEVELS, displayProductName, maturityLevelName} from '../domain/report.js';
import {buildSummaryGoalProgress} from '../domain/summaryGoalProgress.js';

const formatNumber = (value) => Number(value).toLocaleString('ru-RU', {maximumFractionDigits: 1});

function GoalStatus({status}) {
  return <Label theme={status === 'met' ? 'success' : 'normal'} size="s">
    {status === 'met' ? 'Выполнена' : status === 'not-met' ? 'Не выполнена' : 'Нет сравнения'}
  </Label>;
}

function GoalLevelTransition({team}) {
  const currentLevel = maturityLevelName(team.score);
  const previousLevel = maturityLevelName(team.baselineScore);
  const shortLevel = (name) => name === MATURITY_LEVELS.at(-1) ? 'Лидеры' : name;
  const currentText = Number.isFinite(team.score) ? `${formatNumber(team.score)}% · ${shortLevel(currentLevel)}` : '—';
  if (!Number.isFinite(team.score) || !Number.isFinite(team.baselineScore)) {
    return <span className="dashboard-goal-level-current">{currentText}</span>;
  }
  if (team.baselineLeader && team.score >= 81) {
    return <span className="dashboard-goal-level-retained">{formatNumber(team.score)}% · Лидеры (сохранение)</span>;
  }
  const improved = MATURITY_LEVELS.indexOf(currentLevel) > MATURITY_LEVELS.indexOf(previousLevel);
  return <span className="dashboard-goal-level-transition">
    <span className="dashboard-goal-level-previous" title="II кв. 2026">{formatNumber(team.baselineScore)}% · {shortLevel(previousLevel)}</span>
    <span className="dashboard-goal-level-arrow" aria-hidden="true">→</span>
    <span className={`dashboard-goal-level-current${improved ? ' is-improved' : ''}`} title="III кв. 2026">{currentText}</span>
  </span>;
}

export function DashboardGoalDialog({products, baselineProducts, baselineRows, period, initialUnit = '', onClose}) {
  const [unit, setUnit] = useState(initialUnit);
  const allProgress = useMemo(() => buildSummaryGoalProgress(products, baselineProducts, baselineRows, period),
    [products, baselineProducts, baselineRows, period]);
  const progress = useMemo(() => buildSummaryGoalProgress(products, baselineProducts, baselineRows, period, unit),
    [products, baselineProducts, baselineRows, period, unit]);
  const [expandedUnits, setExpandedUnits] = useState(() => new Set([initialUnit || allProgress.groups[0]?.unit]));
  const changeUnit = (value) => {
    const nextUnit = value[0] || '';
    setUnit(nextUnit);
    setExpandedUnits(new Set([nextUnit || allProgress.groups[0]?.unit]));
  };
  const toggleUnit = (name) => setExpandedUnits((current) => {
    const next = new Set(current);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });
  const distribution = [
    {key: 'met', label: 'Выполнили', count: progress.met},
    {key: 'not-met', label: 'Не выполнили', count: progress.notMet},
    {key: 'no-comparison', label: 'Нет сравнения', count: progress.noComparison},
  ];

  return <Dialog className="dashboard-goal-dialog" open onClose={onClose} hasCloseButton maxWidth="l" fullWidth contentOverflow="auto" returnFocus aria-label="Выполнение цели по повышению уровня DDI">
    <Dialog.Header caption="Выполнение цели по повышению уровня DDI" />
    <Dialog.Body className="dashboard-goal-dialog-body">
      <div className="dashboard-goal-controls">
        <label className="dashboard-goal-unit"><span>Область</span><Select value={[unit]} onUpdate={changeUnit} width={190} aria-label="Область выполнения цели">
          <Select.Option value="">B2C · Все юниты</Select.Option>
          {allProgress.groups.map((group) => <Select.Option key={group.unit} value={group.unit}>{group.unit}</Select.Option>)}
        </Select></label>
        <span>{progress.baselinePeriod} → {progress.period}</span>
      </div>
      <div className="dashboard-goal-hero">
        <div>
          <div className="dashboard-goal-metric-label">Выполнили цель</div>
          <div className="dashboard-goal-metric" aria-live="polite"><strong>{progress.met}</strong><span>/ {progress.comparable}</span><b>{progress.share === null ? '—' : `${formatNumber(progress.share * 100)}%`}</b></div>
          <div className="dashboard-goal-metric-note">команд с сопоставимой базой</div>
        </div>
        <div className="dashboard-goal-rule"><b>+1 уровень; лидерам ≥81%</b><span>Относительно II квартала 2026</span></div>
      </div>
      <div className="dashboard-goal-status-bar" role="img" aria-label={distribution.map((item) => `${item.label}: ${item.count}`).join('; ')}>
        {distribution.filter((item) => item.count > 0).map((item) => <span key={item.key} className={`dashboard-goal-segment dashboard-goal-segment-${item.key}`} style={{flexGrow: item.count}} />)}
      </div>
      <div className="dashboard-goal-legend">{distribution.map((item) => <span key={item.key}><i className={`dashboard-goal-segment-${item.key}`} />{item.label} <b>{item.count}</b></span>)}</div>
      <div className="dashboard-goal-leaders">Лидеры сейчас: <b>{progress.leaders} / {progress.total}</b><span> · индекс III кв. ≥81%</span></div>
      <div className="dashboard-goal-table-scroll">
        <table className="dashboard-goal-table">
          <caption className="dashboard-goal-sr-only">Выполнение цели командами, сгруппированными по юниту</caption>
          <thead><tr><th scope="col">Команда</th><th scope="col">Переход уровня DDI</th><th scope="col">Цель по повышению уровня DDI</th></tr></thead>
          {progress.groups.map((group) => {
            const expanded = expandedUnits.has(group.unit);
            return <tbody key={group.unit}>
              <tr className="dashboard-goal-unit-row"><th scope="rowgroup" colSpan={2}><Button view="flat" size="m" className="dashboard-goal-unit-toggle" onClick={() => toggleUnit(group.unit)} aria-expanded={expanded} aria-label={`${group.unit}: ${expanded ? 'свернуть' : 'показать'} команды`}><Icon data={expanded ? ChevronDown : ChevronRight} size={14} /><b>{group.unit}</b><span>{group.total} команд</span></Button></th><td><b>{group.met} / {group.comparable}</b> выполнили</td></tr>
              {expanded && group.teams.map((team) => <tr className="dashboard-goal-team-row" key={team.id}><th scope="row">{displayProductName(team.name)}</th><td><GoalLevelTransition team={team} /></td><td><GoalStatus status={team.status} /></td></tr>)}
            </tbody>;
          })}
        </table>
        {!progress.groups.length && <div className="dashboard-goal-empty">Нет данных команд в выбранной области.</div>}
      </div>
      {progress.noComparison > 0 && <div className="dashboard-goal-comparison-note">Команды без сопоставимой базы не входят в расчёт выполнения цели.</div>}
    </Dialog.Body>
  </Dialog>;
}
