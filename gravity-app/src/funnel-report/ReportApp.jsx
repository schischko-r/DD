import React from 'react';
import {Card} from '@gravity-ui/uikit';
import data from './current-data.json';
import {formatNumber} from './report-model.js';

const BLOCKS = [{code: 'attract', title: 'Привлечение'}, {code: 'churn', title: 'Отток'}];
const SCOPES = ['total', 'reporting', 'completeness'];
const COMPARISONS = [
  {scope: 'analysis', label: 'Анализ воронок', titles: {attract: 'Анализ воронки привлечения', churn: 'Анализ воронки оттока'}},
];
const LEVELS = [
  {label: 'Плохо', className: 'poor'},
  {label: 'Посередине', className: 'middle'},
  {label: 'Хорошо', className: 'good'},
];
const findLevel = (summary, label) => summary.levels.find(level => level.label === label) || {count: 0, share: 0};
const percent = value => `${formatNumber(value, 1)}%`;
const deltaLabel = value => {
  if (value === null) return 'Нет сравнения с II кварталом';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${formatNumber(Math.abs(rounded), 1)} п.п. к II кварталу`;
};

function QuarterDistribution({summary, period, label, blockTitle, scopeTitle}) {
  const description = summary.n
    ? LEVELS.map(level => {
      const row = findLevel(summary, level.label);
      return `${level.label}: ${row.count} команд, ${percent(row.share)}`;
    }).join('; ')
    : 'Нет применимых оценок';
  return <div className={`quarter-distribution ${period}`} data-period={period}>
    <div className="quarter-caption"><b>{label}</b><span data-qa="quarter-count">{summary.n} команд</span></div>
    <div className="level-strip" data-period={period} role="img" aria-label={`${blockTitle}, ${scopeTitle}, ${label}. ${description}`}>
      {summary.n ? LEVELS.map(level => {
        const row = findLevel(summary, level.label);
        return row.count > 0 ? <div key={level.label} className={`level-segment ${level.className}`} data-level={level.label}
          style={{width: `${row.share}%`}} title={`${level.label}: ${row.count} команд, ${percent(row.share)}`}>
          {row.share >= 7 && <span>{percent(row.share)}</span>}
        </div> : null;
      }) : <span className="no-levels">Нет применимых оценок</span>}
    </div>
  </div>;
}

function LevelCard({block, scope, dataset, title = dataset.title}) {
  const {baseline, current} = dataset.blocks[block.code];
  return <Card className="level-card" view="outlined" data-scope={scope} data-block={block.code}>
    <h3>{title}</h3>
    <div className="quarter-distributions">
      <QuarterDistribution summary={baseline} period="baseline" label={data.periods.baseline} blockTitle={block.title} scopeTitle={title}/>
      <QuarterDistribution summary={current} period="current" label={data.periods.current} blockTitle={block.title} scopeTitle={title}/>
    </div>
    <div className="level-legend" aria-label="III квартал и изменение к II кварталу">
      {LEVELS.map(level => {
        const before = findLevel(baseline, level.label), after = findLevel(current, level.label);
        const delta = baseline.n && current.n ? after.share - before.share : null;
        const direction = delta === null || Math.round(delta * 10) === 0 ? 'neutral' : delta > 0 ? 'growth' : 'decline';
        const tone = direction === 'neutral' || level.className === 'middle' ? 'neutral'
          : (level.className === 'poor' ? delta < 0 : delta > 0) ? 'improvement' : 'deterioration';
        return <div className={`level-line ${level.className}`} key={level.label} data-level={level.label}
          data-count={after.count} data-share={current.n ? after.share : undefined} data-delta={delta ?? undefined}>
          <span className={`legend-dot ${level.className}`} aria-hidden="true"/>
          <span className="level-result"><b>{level.label} ({after.count})</b><span className="level-divider"> — </span><strong>{current.n ? percent(after.share) : '—'}</strong></span>
          <span className={`level-delta ${direction} ${tone}`}>
            {direction !== 'neutral' && <span className="delta-indicator" aria-hidden="true">{direction === 'growth' ? '▲' : '▼'}</span>}
            {deltaLabel(delta)}
          </span>
        </div>;
      })}
    </div>
  </Card>;
}

export function ReportApp() {
  return <main className="ddi-funnel-report">
    <section className="report-section" id="levels" aria-labelledby="levels-title">
      <header className="report-section-head">
        <h1 id="levels-title">Какая доля команд работает хорошо, а какая — плохо</h1>
        <p>Порог «хорошо» — выше 80%. Для этого анализа «плохо» — ниже 40%; 40% и 80% входят в середину.</p>
      </header>
      <div className="funnel-hierarchy">{BLOCKS.map(block => <section className="funnel-branch" data-block={block.code} key={block.code} aria-labelledby={`${block.code}-title`}>
        <h2 className="branch-title" id={`${block.code}-title`}>{block.title}</h2>
        <div className="branch-cards">
          {SCOPES.map(scope => <LevelCard key={scope} block={block} scope={scope} dataset={data.scopes[scope]}/>)}
          {block.code === 'attract' && <LevelCard block={block} scope="campaigning" dataset={data.scopes.campaigning} title="Кампейнинг"/>}
        </div>
      </section>)}</div>
      {COMPARISONS.map(({scope, label, titles}) => <section key={scope} className={`metric-comparison ${scope}-comparison`} aria-label={label}>
        {BLOCKS.filter(block => titles[block.code]).map(block => <LevelCard key={block.code} block={block} scope={scope} dataset={data.scopes[scope]} title={titles[block.code]}/>)}
      </section>)}
      <p className="comparison-note">II и III кварталы 2026. Пороги одинаковы для обоих кварталов. Доли рассчитаны среди команд с применимыми оценками в каждом квартале; состав и количество команд могут различаться. Изменение доли — в процентных пунктах.</p>
    </section>
  </main>;
}
