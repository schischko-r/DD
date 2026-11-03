import React, {useMemo, useRef, useState} from 'react';
import {Button, Card, Disclosure, Icon, Label, Popup, SegmentedRadioGroup, Select, Table, TextInput} from '@gravity-ui/uikit';
import {Chart} from '@gravity-ui/charts';
import {ChartColumn, Xmark} from '@gravity-ui/icons';
import detailData from '../../../outputs/ddi-funnel-q3-2026-11-03/detail-data.json';
import {histogramData} from './histogram-data.js';
import data from '../../../outputs/ddi-funnel-q3-2026-11-03/report-data.json';
import baseline from '../funnel-report/report-data.json';
import baselineDetails from '../funnel-report/detail-data.json';
import {compareRows, teamKey} from './comparison-model.js';
import {GrowthSection} from './GrowthSection.jsx';
import {decorateRows, formatNumber, makeCsv, selectRows, summarizeRows} from './report-model.js';

const BLOCKS=[{code:'attract',title:'Привлечение',full:'Воронка привлечения'},{code:'churn',title:'Отток',full:'Воронка оттока'}];
const LEVELS=[{label:'Плохо',rule:'Менее 40%',className:'poor',theme:'danger'},{label:'Посередине',rule:'40–80% включительно',className:'middle',theme:'warning'},{label:'Хорошо',rule:'Более 80%',className:'good',theme:'success'}];
const pct=(value,digits=1)=>value==null?'—':`${formatNumber(value,digits)}%`;
const number=value=>value==null?'—':formatNumber(value,0);
const findLevel=(summary,label)=>summary.levels.find(level=>level.label===label)||{count:0,share:0};

function SectionTitle({number:sectionNumber,title,children}) {
  return <div className="report-section-head"><div><span className="section-number">{sectionNumber}</span><h2>{title}</h2></div>{children&&<p>{children}</p>}</div>;
}

function Finding({summaries}) {
  const attraction=summaries.attract,churn=summaries.churn;
  const a=findLevel(attraction,'Плохо'),c=findLevel(churn,'Плохо');
  const gap=attraction.n&&churn.n?c.share-a.share:null;
  const headline=gap==null?'Для сравнения нужны оценки обеих воронок':gap>0?'Низкие оценки чаще встречаются в оттоке':gap<0?'Низкие оценки чаще встречаются в привлечении':'Доля низких оценок в двух воронках совпадает';
  return <Card className="finding" view="filled">
    <div className="finding-copy"><span className="eyebrow">Главный результат</span><h2>{headline}</h2><p>{gap==null?'Попробуйте изменить фильтры: в текущей выборке один из блоков не оценивался.':`Разница — ${formatNumber(Math.abs(gap),1)} п.п. при пороге ниже 40%. Это распределение оценок DDI, а не показателей продаж.`}</p><div className="finding-foot">Медиана привлечения <strong>{pct(attraction.percentiles.P50,0)}</strong><span>·</span>Медиана оттока <strong>{pct(churn.percentiles.P50,0)}</strong></div></div>
    <div className="finding-comparison">{BLOCKS.map(({code,title})=>{const summary=summaries[code],level=findLevel(summary,'Плохо');return <div className={`finding-stat ${code}`} key={code}><span>{title}</span><strong data-qa={`${code}-poor-share`}>{summary.n?pct(level.share):'—'}</strong><p>{level.count} из {summary.n} команд ниже 40%</p></div>;})}</div>
  </Card>;
}

function Histogram({block,summary,maxCount}) {
  return <Card className="histogram-card" view="outlined">
    <div className="chart-heading"><div><span className="eyebrow">{block.full}</span><h3>{summary.n} команд</h3></div><Label theme="info" size="m">Медиана {pct(summary.percentiles.P50,0)}</Label></div>
    {summary.n?<div className="histogram" role="img" aria-label={`${block.full}. Число команд в интервалах по 10 процентных пунктов: ${summary.bins.map(b=>`${b.range}%: ${b.count}`).join('; ')}`}>
      <div className="chart-y-caption">Количество команд</div>
      <div className="histogram-scroll"><div className="histogram-plot gravity-histogram" data-chart-library="gravity-ui">
        <Chart data={histogramData(block,summary,maxCount)} lang="ru"/>
      </div></div>
      <div className="chart-x-caption">Выполнение блока, %</div>
    </div>:<div className="chart-empty">В этой выборке нет применимых оценок блока.</div>}

  </Card>;
}

function DistributionPopup({block,summary,maxCount,title}) {
  const anchor=useRef(null),[open,setOpen]=useState(false);
  const label=`Распределение: ${block.title} — ${title}`;
  return <>
    <Button ref={anchor} className="distribution-trigger" view="flat-info" size="s" aria-label={label} aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(value=>!value)}><Icon data={ChartColumn} size={16}/>Распределение</Button>
    <Popup anchorRef={anchor} floatingRef={element=>{if(element)element.setAttribute('aria-label',label);}} open={open} onOpenChange={setOpen} placement="bottom-end" role="dialog" aria-label={label} disableTransition className="distribution-popup">
      <div className="distribution-popup-content"><div className="distribution-popup-heading"><b>{title} · {block.title}</b><Button view="flat-secondary" size="s" aria-label="Закрыть распределение" onClick={()=>setOpen(false)}><Icon data={Xmark} size={16}/></Button></div>
      <Histogram block={block} summary={summary} maxCount={maxCount}/><p className="method-note">Одна оценка на команду. Интервалы [0, 10), …, [90, 100]. Неприменимые оценки исключены.</p></div>
    </Popup>
  </>;
}

function LevelCard({block,summary,maxCount,scope,title,description}) {
  return <Card className="level-card" view="outlined" data-scope={scope} data-block={block.code}>
    <div className="level-card-heading"><div><h3>{title}</h3><span className="level-card-count">{summary.n} команд</span></div><DistributionPopup block={block} summary={summary} maxCount={maxCount} title={title}/></div>
    {description&&<p className="level-card-description">{description}</p>}
    <div className="level-strip" role="img" aria-label={`${block.title}: ${summary.levels.map(l=>`${l.label} ${l.count}`).join(', ')}`}>{summary.n?LEVELS.map(level=>{const row=findLevel(summary,level.label);return row.count>0?<div key={level.label} className={`level-segment ${level.className}`} style={{width:`${row.share}%`}} title={`${level.label}: ${row.count} команд, ${pct(row.share)}`}><span>{row.count}</span></div>:null;}):<span className="no-levels">Нет оценок</span>}</div>
    <div className="level-legend">{LEVELS.map(level=>{const row=findLevel(summary,level.label);return <div className="level-line" key={level.label}><span className={`legend-dot ${level.className}`}/><div><b>{level.label}</b><small>{level.rule}</small></div><span className="level-value">{summary.n?pct(row.share):'—'}<small>{row.count} команд</small></span></div>;})}</div>
  </Card>;
}

function FunnelHierarchy({summaries,filters}) {
  const scopes=Object.fromEntries(Object.entries(detailData.scopes).map(([scope,dataset])=>[scope,Object.fromEntries(BLOCKS.map(block=>[block.code,summarizeRows(selectRows(dataset,block.code,filters))]))]));
  const maxFor=items=>Math.max(5,Math.ceil(Math.max(...Object.values(items).flatMap(s=>s.bins.map(b=>b.count)),0)/5)*5);
  return <div className="funnel-hierarchy">{BLOCKS.map(block=><div className="funnel-branch" data-block={block.code} key={block.code}>
    <h3 className="branch-title">{block.title}</h3>
    <LevelCard block={block} summary={summaries[block.code]} maxCount={maxFor(summaries)} scope="whole" title="Воронка целиком"/>
    <div className="branch-children">{Object.entries(detailData.scopes).map(([scope,dataset])=><LevelCard key={scope} block={block} summary={scopes[scope][block.code]} maxCount={maxFor(scopes[scope])} scope={scope} title={dataset.title} description={dataset.description}/>)}</div>
  </div>)}</div>;
}

function PercentileRange({block,summary}) {
  const p=summary.percentiles;
  return <div className="percentile-range"><div className="range-label"><b>{block.title}</b><span>P25–P75: {pct(p.P25,0)}–{pct(p.P75,0)}</span></div>{summary.n?<>
    <div className="range-track" role="img" aria-label={`${block.title}: минимум ${p.P0}%, P25 ${p.P25}%, медиана ${p.P50}%, P75 ${p.P75}%, максимум ${p.P100}%`}>
      {[0,20,40,60,80,100].map(v=><span className="range-grid" style={{left:`${v}%`}} key={v}/>)}
      <div className="range-whisker" style={{left:`${p.P0}%`,width:`${p.P100-p.P0}%`}}/>
      <div className={`range-box ${block.code}`} style={{left:`${p.P25}%`,width:`${Math.max(.3,p.P75-p.P25)}%`}}/>
      <div className="range-median" style={{left:`${p.P50}%`}}><span>{pct(p.P50,0)}</span></div>
      {[p.P0,p.P100].map((v,i)=><i className="range-cap" style={{left:`${v}%`}} key={i}/>)}
    </div>
    <div className="range-axis">{[0,20,40,60,80,100].map(v=><span key={v}>{v}%</span>)}</div>
  </>:<div className="range-empty">Нет оценок</div>}</div>;
}

function Quartiles({summaries}) {
  return <Card view="outlined" className="quartiles-card"><div className="compact-heading"><h3>Команды между квартильными границами</h3></div><div className="quartile-grid"><div className="quartile-grid-header">Группа</div>{BLOCKS.map(b=><div key={b.code} className="quartile-grid-header">{b.title}</div>)}{[0,1,2,3].map(index=><React.Fragment key={index}><div className="quartile-name"><span>Q{index+1}</span><b>{['До P25','P25–P50','P50–P75','Выше P75'][index]}</b></div>{BLOCKS.map(({code})=>{const s=summaries[code],q=s.quartiles[index];return <div className="quartile-cell" key={code}><strong>{q?.count??0}<small>команд</small></strong><span>{s.n?q?.range:'Нет оценок'} · {s.n?pct(q?.share):'—'}</span></div>;})}</React.Fragment>)}</div><p className="method-note">Одинаковые оценки не разделяются между группами. Поэтому в каждой группе может быть больше или меньше 25% команд.</p></Card>;
}

function csvDownload(rows,blockLabel) {
  const csv=makeCsv(rows,{blockLabel});
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download=`DDI_${blockLabel}_команды.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}

export function ReportApp() {
  const [type,setType]=useState('all'),[unit,setUnit]=useState('all');
  const [tableBlock,setTableBlock]=useState('attract'),[query,setQuery]=useState(''),[descending,setDescending]=useState(false),[quartile,setQuartile]=useState('all');
  const summaries=useMemo(()=>Object.fromEntries(BLOCKS.map(b=>[b.code,summarizeRows(selectRows(data,b.code,{type,unit}))])),[type,unit]);
  const selectedTeams=data.teams.filter(t=>(type==='all'||t.type===type)&&(unit==='all'||t.unit===unit));
  const units=[...new Set(data.teams.map(t=>t.unit))].sort((a,b)=>a.localeCompare(b,'ru'));
  const activeSummary=summaries[tableBlock];
  const comparison=compareRows(baseline,data,tableBlock,{type,unit});
  const pairsById=new Map(comparison.pairs.map(pair=>[teamKey(pair.current),pair]));
  const decorated=decorateRows(activeSummary.rows,activeSummary).map(row=>{const pair=pairsById.get(teamKey(row));return {...row,baselinePct:pair?.baseline.pct??null,deltaPp:pair?.deltaPp??null,relativeChange:pair?.relativeChange??null};});
  const search=query.trim().toLocaleLowerCase('ru');
  const tableRows=decorated.filter(r=>(quartile==='all'||r.quartile===Number(quartile))&&(!search||`${r.team} ${r.unit}`.toLocaleLowerCase('ru').includes(search))).sort((a,b)=>(descending?b.pct-a.pct:a.pct-b.pct)||a.team.localeCompare(b.team,'ru'));
  const excluded=code=>data.blocks[code].excluded.filter(r=>(type==='all'||r.type===type)&&(unit==='all'||r.unit===unit));
  const columns=[
    {id:'team',name:'Команда',primary:true,template:r=><div className="team-cell"><b>{r.team}</b><small>{r.type}</small></div>},
    {id:'unit',name:'Юнит',width:92},
    {id:'points',name:'Баллы / максимум',align:'end',template:r=>`${formatNumber(r.earned,4)} / ${formatNumber(r.max,4)}`},
    {id:'baselinePct',name:'II кв. 2026',align:'end',template:r=>pct(r.baselinePct,0)},
    {id:'pct',name:'III кв. 2026',align:'end',template:r=><strong className="table-pct">{pct(r.pct,0)}</strong>},
    {id:'deltaPp',name:'Δ, п.п.',align:'end',template:r=>r.deltaPp==null?'—':`${r.deltaPp>0?'+':''}${formatNumber(r.deltaPp)}`},
    {id:'relativeChange',name:'Δ, % к II кв.',align:'end',template:r=>r.relativeChange==null?'—':`${r.relativeChange>0?'+':''}${pct(r.relativeChange)}`},
    {id:'status',name:'Группа',template:r=><Label theme={LEVELS.find(l=>l.label===r.status)?.theme||'normal'}>{r.status}</Label>},
    {id:'quartile',name:'Квартиль',align:'center',template:r=>`Q${r.quartile}`},
    {id:'cdf',name:'Команд не выше',align:'end',template:r=>pct(r.cdf)},
  ];
  const reset=()=>{setType('all');setUnit('all');};
  return <main className="ddi-funnel-report">
    <header className="report-topbar"><div className="report-brand"><span className="brand-mark">DDI</span><span>Data Driven Index<small>Аналитический отчёт</small></span></div><div className="report-topbar-actions"><Label theme="info" size="m">III квартал 2026</Label><Button view="outlined" size="l" onClick={()=>window.print()}>Печать / PDF</Button></div></header>
    <section className="report-hero"><span className="eyebrow">Привлечение и отток</span><h1>Как команды работают<br className="desktop-break"/> с воронками</h1><p>Сколько команд работает с воронками хорошо, сколько отстаёт и где проходят границы квартильных групп.</p><Button className="growth-jump" view="outlined" size="l" href="#growth">Динамика II → III</Button></section>
    <div className="report-filters" role="region" aria-label="Фильтры отчёта"><div><label>Тип команды</label><Select aria-label="Тип команды" value={[type]} onUpdate={([value])=>setType(value||'all')} options={[{value:'all',content:'Все команды'},{value:'Продукт',content:'Продукты'},{value:'Сегмент',content:'Сегменты'},{value:'Канал',content:'Каналы'}]} size="l" width="max"/></div><div><label>Юнит</label><Select aria-label="Юнит" value={[unit]} onUpdate={([value])=>setUnit(value||'all')} options={[{value:'all',content:'Все юниты'},...units.map(value=>({value,content:value}))]} size="l" width="max"/></div><Button view="flat-secondary" size="l" onClick={reset} disabled={type==='all'&&unit==='all'}>Сбросить</Button><span className="filter-count" data-qa="cohort-count">В выборке <b>{selectedTeams.length}</b> из {data.totalTeams} команд</span></div>
    <Finding summaries={summaries}/>
    <section className="report-section" id="quartile-groups"><SectionTitle number="01" title="Сколько команд в каждой части распределения">Границы определены по перцентилям. Нижняя группа — до P25, верхняя — выше P75.</SectionTitle><Quartiles summaries={summaries}/></section>
    <section className="report-section" id="levels"><SectionTitle number="02" title="Какая доля команд работает хорошо, а какая — плохо">Порог «хорошо» — выше 80%. Для этого анализа «плохо» — ниже 40%; 40% и 80% входят в середину.</SectionTitle><FunnelHierarchy summaries={summaries} filters={{type,unit}}/></section>
    <section className="report-section" id="percentiles"><SectionTitle number="03" title="Границы распределения по перцентилям">P25 — граница нижней четверти, P50 — медиана, P75 — граница верхней четверти распределения.</SectionTitle><div className="percentiles-layout"><Card className="ranges-card" view="outlined"><div className="compact-heading"><h3>Разброс оценок</h3><span>0–100%</span></div>{BLOCKS.map(block=><PercentileRange key={block.code} block={block} summary={summaries[block.code]}/>)}<p className="method-note">Линия — минимум и максимум. Полоса — P25–P75. Вертикальная черта — медиана.</p></Card><Card className="percentile-table-card" view="outlined"><table className="percentile-table"><thead><tr><th>Перцентиль</th><th>Привлечение</th><th>Отток</th></tr></thead><tbody>{['P10','P25','P50','P75','P90'].map(p=><tr key={p} className={p==='P50'?'median-row':''}><th>{p}{p==='P50'&&<small>Медиана</small>}</th>{BLOCKS.map(b=><td key={b.code}>{pct(summaries[b.code].percentiles[p],1)}</td>)}</tr>)}</tbody></table></Card></div></section>
    <section className="report-section" id="teams"><SectionTitle number="04" title="Какие команды входят в каждую группу">Исходные баллы, максимум блока и позиция в распределении. Выберите квартиль, чтобы увидеть его команды. Поиск и квартиль относятся только к таблице. II квартал и Δ показаны только для сопоставимых команд, прошедших фильтры в обоих кварталах; прочерк означает отсутствие пары. При нулевой базе относительное изменение не рассчитывается.</SectionTitle><Card view="outlined" className="teams-card"><div className="table-toolbar"><SegmentedRadioGroup value={tableBlock} onUpdate={setTableBlock} size="l" aria-label="Воронка в таблице">{BLOCKS.map(b=><SegmentedRadioGroup.Option key={b.code} value={b.code}>{b.title}</SegmentedRadioGroup.Option>)}</SegmentedRadioGroup><div className="table-actions"><Select aria-label="Квартиль команд" value={[quartile]} onUpdate={([value])=>setQuartile(value||'all')} options={[{value:'all',content:'Все квартили'},...Array.from({length:4},(_,i)=>({value:String(i+1),content:`Q${i+1}`}))]} size="l"/><TextInput value={query} onUpdate={setQuery} placeholder="Найти команду или юнит" aria-label="Поиск команды" hasClear size="l"/><Button view="outlined" size="l" onClick={()=>setDescending(v=>!v)}>{descending?'Сначала высокие':'Сначала низкие'}</Button><Button view="outlined" size="l" disabled={!tableRows.length} onClick={()=>csvDownload(tableRows,BLOCKS.find(b=>b.code===tableBlock).title)}>CSV</Button></div></div><div className="table-info"><span data-qa="table-count">Показано {tableRows.length} из {activeSummary.n} команд</span><span>«Команд не выше» — доля команд с такой же или меньшей оценкой</span></div>{tableRows.length?<div className="teams-table-wrap"><Table data={tableRows} columns={columns} wordWrap verticalAlign="middle" getRowDescriptor={item=>({id:item.id})}/></div>:<div className="table-empty">Команды не найдены. Измените поиск или фильтры.</div>}</Card></section>
    <GrowthSection baseline={baseline} current={data} baselineDetails={baselineDetails} currentDetails={detailData} filters={{type,unit}}/>
    <section className="methodology"><Disclosure size="l" summary="Источник, расчёт и исключения"><div className="methodology-content"><p><b>Источник:</b> снимок DDI за III квартал 2026 из {data.source}. Базовый период динамики — II квартал 2026, исходный отчёт сохранён отдельно. В исходной выборке {data.totalTeams} уникальные команды; отдельной метки первого прохождения в данных нет.</p><p><b>Процент блока:</b> сумма всех баллов блока / сумма всех максимумов × 100, с округлением до целого — как в интерфейсе DDI. Это процент блока, а не пересчитанный индекс. Равные проценты разных команд сохраняются.</p><p><b>Сопоставимость:</b> динамика рассчитана по парным командам с применимыми оценками в обоих кварталах. Применимость метрик, максимумы и полнота заполнения могут меняться; изменение в п.п. относится к оценке DDI, а не конверсии продаж. В оценке воронки целиком незаполненные значения при положительном максимуме дают нулевой вклад в числитель, а максимум остаётся в знаменателе — как в исходном интерфейсе. Вложенные показатели отчётности и полноты используют только конечные применимые значения.</p><p><b>Перцентили:</b> линейная интерполяция по округлённым процентам. При формировании квартильных групп равные значения не разделяются; верхняя граница каждой группы включена. Средние и доли команд не взвешиваются размером команды или максимумом блока.</p><div className="exclusions-grid">{BLOCKS.map(b=><div key={b.code}><h3>{b.title}: исключено {excluded(b.code).length}</h3>{excluded(b.code).length?<ul>{excluded(b.code).map(r=><li key={r.team}><b>{r.team}</b><span>{r.reason}</span></li>)}</ul>:<p>Нет исключённых команд в выбранной группе.</p>}</div>)}</div><p className="source-hash">Контрольный SHA-256 источника: {data.sha256}</p></div></Disclosure></section>
    <footer className="report-footer"><span>DDI · III квартал 2026</span><span>Все данные встроены в HTML · работает без подключения к сети</span></footer>
  </main>;
}
