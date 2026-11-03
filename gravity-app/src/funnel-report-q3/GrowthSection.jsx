import React from 'react';
import {Card} from '@gravity-ui/uikit';
import {compareRows} from './comparison-model.js';
import {formatNumber} from './report-model.js';

const blocks = [{code:'attract',title:'Привлечение'}, {code:'churn',title:'Отток'}];
const percent = value => value == null ? '—' : `${formatNumber(value)}%`;
const signed = (value, suffix) => value == null ? '—' : `${value > 0 ? '+' : ''}${formatNumber(value)}${suffix}`;

function GrowthPlot({comparison, title}) {
  const metrics=comparison.metrics.slice(0,2);
  return <figure className="growth-plot" aria-label={`${title}: сравнение среднего и медианы на сопоставимой выборке`}>
    <figcaption><span><i className="growth-baseline-key"/>II квартал</span><span><i className="growth-current-key"/>III квартал</span><span>Шкала 0–100%</span></figcaption>
    {metrics.map(metric=><div className="growth-plot-row" key={metric.label}><b>{metric.label}</b>{[['baseline','II'],['current','III']].map(([period,label])=><div className="growth-bar-row" key={period}><span>{label}</span><div className="growth-bar-track"><div className={`growth-bar ${period}`} style={{width:`${metric[period]}%`}}/></div><strong>{percent(metric[period])}</strong></div>)}</div>)}
  </figure>;
}

export function GrowthSection({baseline,current,baselineDetails,currentDetails,filters}) {
  const scopes = [{code:'whole',title:'Воронка целиком',before:baseline,after:current},
    ...Object.entries(currentDetails.scopes).map(([code,dataset]) => ({code,title:dataset.title,
      before:baselineDetails.scopes[code] || {blocks:{}},after:dataset}))];
  return <section className="report-section" id="growth">
    <div className="report-section-head"><div><span className="section-number">05</span><h2>Динамика II → III квартал 2026</h2></div>
      <p>Состав выборки меняется. Динамика рассчитана только на сопоставимых командах с применимой оценкой в обоих кварталах, отдельно для каждой воронки и вложенного показателя. Фильтры типа и юнита применяются к обоим периодам: команда должна соответствовать им в каждом квартале. Разница общих выборок не трактуется как рост. Даже у сопоставимых команд могут меняться применимость метрик, максимумы и полнота оценки.</p>
    </div>
    {scopes.map(scope=><div className="growth-scope" key={scope.code}><h3>{scope.title}</h3><div className="growth-grid">{blocks.map(block=>{
      const comparison=compareRows(scope.before,scope.after,block.code,filters);
      return <Card view="outlined" className="growth-card" key={block.code} data-growth-scope={scope.code} data-growth-block={block.code}>
        <div className="compact-heading"><h3>{block.title}</h3><span data-qa="matched-count">{comparison.pairs.length} сопоставимых команд</span></div>
        <p className="method-note">Применимые оценки после фильтров: II кв. — {comparison.baselineCount}, III кв. — {comparison.currentCount}. Вне сопоставимой выборки: {comparison.baselineCount-comparison.pairs.length} / {comparison.currentCount-comparison.pairs.length} соответственно.</p>
        {comparison.pairs.length?<><GrowthPlot comparison={comparison} title={`${scope.title} · ${block.title}`}/><div className="growth-table-scroll"><table className="growth-table"><thead><tr><th>Показатель</th><th>II кв.</th><th>III кв.</th><th>Δ, п.п.</th><th>Δ, % к II кв.</th></tr></thead><tbody>{comparison.metrics.map(metric=><tr key={metric.label}><th>{metric.label}</th><td>{percent(metric.baseline)}</td><td>{percent(metric.current)}</td><td>{signed(metric.deltaPp,'')}</td><td>{signed(metric.relativeChange,'%')}</td></tr>)}</tbody></table></div></>:<p className="growth-empty">Нет сопоставимых команд. Измените фильтры.</p>}
      </Card>;
    })}</div></div>)}
    <p className="method-note">Δ, п.п. — разница III и II кварталов; относительное изменение — (III − II) / II × 100%. При нулевой базе показан прочерк. Средние, медианы и доли сравниваются на одной и той же парной выборке; это изменение оценки DDI, а не продаж. Пороги сохранены: &lt;40%, 40–80% включительно, &gt;80%.</p>
  </section>;
}
