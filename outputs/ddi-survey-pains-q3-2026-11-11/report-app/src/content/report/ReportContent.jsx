import React, { useState } from 'react';
import { Button, DataComponent, DataTable, Dropdown, EvidenceChart, ReportSection, RichNarrative, SectionNavigator, useDataApp } from '../../data-app-public.jsx';

const pct = (n) => `${Number(n).toLocaleString('ru-RU', {maximumFractionDigits: 1})}%`;
const barSpec = {type:'horizontalBar', x:'label', y:'teams', stackable:false, valueDecimals:0, colors:{teams:'var(--chart-1)'}};
const teamNoun = (n) => n % 100 >= 11 && n % 100 <= 14 ? 'команд' : n % 10 === 1 ? 'команда' : [2, 3, 4].includes(n % 10) ? 'команды' : 'команд';
const allUnits = 'Все юниты';
const allAnswers = 'Все ответы';
const topics = [
  {id:'marts', number:'01', title:'T2M и использование витрин', painIds:['marts'], quoteTeams:['SberPay NFC'],
    insight:'Сложность не заканчивается появлением витрины. SberPay NFC пишет, что готовые витрины сложно использовать для маркетинговых активностей: передача клиентских выборок требует дополнительных действий аналитиков и продактов.'},
  {id:'resources', number:'02', title:'Нехватка аналитиков', painIds:['resources'], quoteTeams:['ПДС'],
    insight:'ПДС зависит от аналитиков соседних команд. У ПДС нет выделенного дата-аналитика: задачи передают смежным командам, и, по словам команды, это увеличивает сроки.'},
  {id:'bi', number:'03', title:'BI и Self-Service', painIds:['bi','selfservice'], quoteTeams:[],
    insight:'Из 11 команд, которым не хватает Self-Service BI, 6 не отмечают технические ограничения BI-платформы. Жалобы на саму платформу и самостоятельную работу с данными совпадают у 5 команд.'},
  {id:'monitoring', number:'04', title:'Отчётность и алерты', painIds:['automation','alerts'], quoteTeams:[],
    insight:'У 24 из 35 команд жалобы на автоматизацию отчётности и алерты встречаются по отдельности. 11 команд отмечают обе проблемы.'},
  {id:'experiments', number:'05', title:'A/B-тесты и пилоты', painIds:['ab'], quoteTeams:['ПДС','Личная защита Плюс'],
    insight:'Жалобы касаются функций платформы и проведения пилотов. ПДС не хватает сегментных A/B-тестов. «Личная защита Плюс» отмечает долгие согласования пилотов и отсутствие подключения СберБизнес к платформе.'},
  {id:'quality', number:'06', title:'Качество и обновление данных', painIds:['quality'], quoteTeams:['СберПрайм'],
    insight:'Проблемы с данными включают и их обновление. СберПрайм пишет о редком обновлении и контроле поставок от ДЗО.'},
];

function PainTags({row}) {
  return <div className="pains-tags">{row.painLabels.map((label)=><span key={label}>{label}</span>)}{row.otherInterpretations.map((text,i)=><span className={`pains-tag-other is-${row.status}`} key={i}>{text}</span>)}</div>;
}
const teamColumns = [{key:'unit',label:'Юнит'},{key:'team',label:'Команда'},{key:'painLabels',label:'Что отметили',renderCell:(_,row)=><PainTags row={row}/>},{key:'comments',label:'Свободный комментарий',renderCell:(value)=>value.length ? value.join(' / ') : '—'}];

function TeamQuote({row,standalone=false,standaloneCount}) {
  return <div className="pains-comment topic-quote" data-reviewed-rows><div className="pains-comment-owner"><span>{row.unit}</span><strong>{row.team}</strong></div>{standalone&&<div className="topic-standalone">Из ответа «Другое»; в числе {standaloneCount} не учтено.</div>}<blockquote>{row.text}</blockquote></div>;
}
function heatCellStyle(share) {
  if (share===0) return {background:'var(--muted)',color:'var(--secondary)'};
  const ratio=Math.max(0,Math.min(100,share))/100;
  const mix=(base)=>base.map((value,index)=>Math.round(value+([40,88,217][index]-value)*ratio));
  const light=mix([255,255,255]);
  const dark=mix([24,24,24]);
  const luminance=light.map((value)=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((total,value,index)=>total+value*[.2126,.7152,.0722][index],0);
  const lightText=1.05/(luminance+.05)>=4.5?'#fff':'#000';
  return {background:`light-dark(rgb(${light.join(' ')}),rgb(${dark.join(' ')}))`,color:`light-dark(${lightText},#fff)`};
}
function TopicUnitHeatmap({topic,pains,units,unitPains,pickPain}) {
  const rows=unitPains.filter((row)=>topic.painIds.includes(row.id));
  const measures=topic.painIds.map((id)=>pains.find((pain)=>pain.id===id));
  const title={marts:'Какие юниты жалуются на T2M витрин',resources:'Где не хватает аналитических ресурсов',bi:'Жалобы на BI и Self-Service по юнитам',monitoring:'Жалобы на отчётность и алерты по юнитам',experiments:'Где жалуются на инструментарий A/B',quality:'Где жалуются на качество данных'}[topic.id];
  return <DataComponent id={`topic-${topic.id}-unit-heatmap`} title={title} queryId="unit_pains" kind="custom" sourceRows={rows} displayRows={rows} headingLevel={3} className="topic-unit-heatmap">
    <div className="topic-heatmap-caption"><RichNarrative id={`topic-${topic.id}-unit-heatmap:caption`} value="Доля команд внутри юнита. В ячейке — процент и число команд."/></div>
    <div className="topic-heatmap-scroll"><table className="topic-heatmap-table" data-reviewed-rows><caption className="pains-sr-only">{title}. Доля и число команд внутри каждого юнита.</caption><thead><tr><th scope="col">Проблема</th>{units.map((unit)=><th scope="col" key={unit.unit}>{unit.unit}<small>{unit.teams} {teamNoun(unit.teams)}</small></th>)}</tr></thead><tbody>{measures.map((pain)=><tr key={pain.id}><th scope="row">{pain.label}</th>{units.map((unit)=>{const cell=rows.find((row)=>row.id===pain.id&&row.unit===unit.unit);if(!cell)return <td key={unit.unit}><span className="topic-heatmap-empty" aria-label={`${unit.unit}: нет данных`}>—</span></td>;return <td key={unit.unit}><button type="button" className="topic-heatmap-cell" style={heatCellStyle(cell.share)} onClick={()=>pickPain(pain.id,unit.unit)} aria-label={`${unit.unit}: ${pain.fullLabel}; ${pct(cell.share)}, ${cell.teams} из ${cell.total} команд. Показать команды`}><strong>{pct(cell.share)}</strong><small>{cell.teams}/{cell.total}</small></button></td>;})}</tr>)}</tbody></table></div>
    <div className="topic-heatmap-scale" aria-label="Единая шкала от 0 до 100 процентов">{[0,25,50,75,100].map((value)=><span key={value}><i style={heatCellStyle(value)}/>{value}%</span>)}</div>
  </DataComponent>;
}
function TopicSection({topic,pains,quotes,teams,units,unitPains,pickPain}) {
  const measures = pains.filter((pain)=>topic.painIds.includes(pain.id));
  const comments = topic.quoteTeams.map((team)=>quotes.find((row)=>row.team===team));
  const commentTeams = teams.filter((team)=>comments.some((comment)=>comment.teamId===team.teamId));
  const pairConfig = topic.id==='bi' ? {first:'bi',second:'selfservice',firstLabel:'Только BI',secondLabel:'Только Self-Service BI'} : topic.id==='monitoring' ? {first:'alerts',second:'automation',firstLabel:'Только алерты',secondLabel:'Только отчётность'} : null;
  const pairedTeams = pairConfig ? teams.filter((team)=>team.painIds.includes(pairConfig.first)||team.painIds.includes(pairConfig.second)) : [];
  const pairRows = pairConfig ? [
    {label:pairConfig.firstLabel,kind:'marts',teams:pairedTeams.filter((team)=>team.painIds.includes(pairConfig.first)&&!team.painIds.includes(pairConfig.second)).length},
    {label:'Обе проблемы',kind:'both',teams:pairedTeams.filter((team)=>team.painIds.includes(pairConfig.first)&&team.painIds.includes(pairConfig.second)).length},
    {label:pairConfig.secondLabel,kind:'resources',teams:pairedTeams.filter((team)=>!team.painIds.includes(pairConfig.first)&&team.painIds.includes(pairConfig.second)).length},
  ] : [];
  const scopedTeams = teams.filter((team)=>commentTeams.includes(team)||pairedTeams.includes(team));
  const sources = {pain_totals:measures, ...(comments.length ? {survey_comments:comments} : {}), ...(scopedTeams.length ? {team_pains:scopedTeams} : {})};
  return <section id={`topic-${topic.id}`} className="pains-section topic-section">
    <div className="pains-section-heading"><span>{topic.number}</span><h2>{topic.title}</h2></div>
    <ReportSection id={`topic-${topic.id}-analysis`} title={topic.title} queryId="pain_totals" queryIds={Object.keys(sources)} sourceRowsByQuery={sources} showHeading={false}>
      <div className="topic-analysis-grid">
        <div className="topic-evidence">
          <div className="topic-measures" data-reviewed-rows>{measures.map((pain)=><div className="topic-measure" key={pain.id}><div className="topic-measure-line"><span>{pain.fullLabel}</span><strong>{pain.teams}<small>из 76 · {pct(pain.share)}</small></strong></div><div className="pains-track"><i style={{width:`${pain.share}%`}}/></div><Button className="topic-team-link" onClick={()=>pickPain(pain.id)}>Кто отметил ↗</Button></div>)}</div>
          <RichNarrative id={`topic-${topic.id}:interpretation`} className="pains-analysis" value={topic.insight}/>
          {pairConfig&&<div className="topic-overlap topic-pair" data-reviewed-rows><div className="topic-pair-title">{pairedTeams.length} {teamNoun(pairedTeams.length)} отметили хотя бы одну из этих проблем</div><div className="topic-overlap-bar" role="img" aria-label={pairRows.map((row)=>`${row.label}: ${row.teams}`).join('; ')}>{pairRows.map((row)=><div className={`is-${row.kind}`} key={row.kind} style={{flex:row.teams}}><strong>{row.teams}</strong></div>)}</div><div className="topic-overlap-legend">{pairRows.map((row)=><span key={row.kind}><i className={`is-${row.kind}`}/><span>{row.label}<small>{row.teams} {teamNoun(row.teams)}</small></span></span>)}</div></div>}
        </div>
        {comments.length>0 && <div className="topic-quotes"><div className="topic-side-label">Дословно из анкеты</div>{comments.map((row)=><TeamQuote row={row} standalone={commentTeams.find((team)=>team.teamId===row.teamId)?.painIds.length===0} standaloneCount={measures[0]?.teams} key={row.record}/>)}</div>}
      </div>
    </ReportSection>
    <TopicUnitHeatmap topic={topic} pains={pains} units={units} unitPains={unitPains} pickPain={pickPain}/>
  </section>;
}

export function ReportContent() {
  const {snapshot,visible,canEdit,mode,appTitle,setAppTitle} = useDataApp();
  const {summary,painDefinitions,units,teamRows,quoteRows} = snapshot.analysis;
  const pains = snapshot.queries.pain_totals.rows;
  const pairTotals = (first,second) => {
    const both = teamRows.filter((team)=>team.painIds.includes(first)&&team.painIds.includes(second)).length;
    const firstOnly = teamRows.filter((team)=>team.painIds.includes(first)&&!team.painIds.includes(second)).length;
    const secondOnly = teamRows.filter((team)=>!team.painIds.includes(first)&&team.painIds.includes(second)).length;
    return {both,firstOnly,secondOnly,union:both+firstOnly+secondOnly};
  };
  const biOverlap = pairTotals('bi','selfservice');
  const monitoringOverlap = pairTotals('alerts','automation');
  const [topic,setTopic] = useState(allAnswers);
  const [topicUnit,setTopicUnit] = useState(allUnits);
  const selectedPain = painDefinitions.find((pain)=>pain.id===topic);
  const selectedTeams = teamRows.filter((team)=>(topic===allAnswers || team.painIds.includes(topic)) && (topicUnit===allUnits || team.unit===topicUnit));
  const okay = quoteRows.find((row)=>row.status==='okay');
  const unclear = quoteRows.find((row)=>row.status==='unclear');
  const platformQuotes = ['ОСАГО','СБОЛ','СберKids','СберИнвестор'].map((team)=>quoteRows.find((row)=>row.team===team));
  const pickPain = (id,unit=allUnits)=>{setTopic(id);setTopicUnit(unit);document.getElementById('who-complains')?.scrollIntoView({behavior:'smooth',block:'start'});};
  const overlap = [
    {label:'Жалуются только на T2M витрин',kind:'marts',test:(row)=>row.painIds.includes('marts')&&!row.painIds.includes('resources')},
    {label:'Жалуются на обе проблемы',kind:'both',test:(row)=>row.painIds.includes('marts')&&row.painIds.includes('resources')},
    {label:'Жалуются только на нехватку аналитических ресурсов',kind:'resources',test:(row)=>!row.painIds.includes('marts')&&row.painIds.includes('resources')},
    {label:'Не отметили ни одну из этих проблем',kind:'neither',test:(row)=>!row.painIds.includes('marts')&&!row.painIds.includes('resources')},
  ].map(({test,...row})=>({...row,teams:teamRows.filter(test).length}));
  const sections = [{id:'b2c-overview',label:'Главные выводы'},{id:'pain-ranking-section',label:'Рейтинг болей'},...topics.map((row)=>({id:`topic-${row.id}`,label:{marts:'Витрины',resources:'Ресурсы',bi:'BI / Self-Service',monitoring:'Отчётность',experiments:'Эксперименты',quality:'Качество'}[row.id]})),{id:'who-complains',label:'Все команды'},{id:'all-okay',label:'У кого всё ок'}];

  return <article className="report-content pains-report topic-report" aria-label="Анализ болей B2C по проблематике">
    <SectionNavigator sections={sections}/>
    <header className="pains-hero"><div className="pains-kicker"><span>DDI / B2C</span><span>III квартал 2026</span><span>Анкеты 15–28 октября</span></div><h1 data-data-app-title contentEditable={canEdit&&mode==='edit'} suppressContentEditableWarning onBlur={canEdit&&mode==='edit' ? (event)=>setAppTitle(event.currentTarget.textContent.trim()||appTitle) : undefined}>{appTitle}</h1><RichNarrative id="pains:hero-intro" className="pains-deck" value="Разбор по проблемам: что встречается чаще и что об этом говорят команды."/></header>

    <section id="b2c-overview" className="pains-section">
      {visible('b2c-status')&&<DataComponent id="b2c-status" title="Общая картина B2C" queryId="team_pains" kind="custom" sourceRows={teamRows} displayRows={teamRows}><div className="topic-scope-strip" data-reviewed-rows><div><strong>76</strong><span>команд / 8 юнитов</span></div><div><strong>79</strong><span>анкет, повторы объединены</span></div><div><strong>74</strong><span>отметили ограничения<br/>или потребность в поддержке</span></div></div></DataComponent>}
      <ReportSection id="pains-overview-finding" title="Три главных вывода" queryId="pain_totals" queryIds={['pain_totals','team_pains','survey_comments']} sourceRowsByQuery={{pain_totals:pains,team_pains:teamRows,survey_comments:quoteRows.filter((row)=>row.status==='pain')}} showHeading={false}>
        <RichNarrative id="topic-summary:insights" className="topic-summary" value={`## Три главных вывода

1. **T2M витрин — самая частая боль.** На трудоёмкий вывод витрин жалуются 46 из 76 команд. 24 из них не отмечают нехватку аналитических ресурсов; 22 жалуются на обе проблемы.

2. **Жалобы на BI и Self-Service чаще встречаются по отдельности.** ${biOverlap.firstOnly} команд отметили только ограничения BI, ${biOverlap.secondOnly} — только отсутствие Self-Service BI, ${biOverlap.both} — обе проблемы.

3. **Жалобы на отчётность и алерты совпадают у трети команд.** Из ${monitoringOverlap.union} команд с этими проблемами ${monitoringOverlap.both} жалуются на обе, ${monitoringOverlap.firstOnly} — только на алерты, ${monitoringOverlap.secondOnly} — только на автоматизацию отчётности.`}/>
      </ReportSection>
      <DataComponent id="topic-marts-resources-overlap" title="T2M витрин и нехватка аналитических ресурсов" queryId="team_pains" kind="custom" sourceRows={teamRows} displayRows={overlap}>
        <div className="topic-overlap" data-reviewed-rows><div className="topic-overlap-bar" role="img" aria-label="Из 76 команд: 24 отметили витрины, но не нехватку ресурсов, 22 обе проблемы, 19 нехватку ресурсов, но не витрины, 11 не отметили ни одну из этих проблем">{overlap.map((row)=><div className={`is-${row.kind}`} key={row.kind} style={{flex:row.teams}}><strong>{row.teams}</strong></div>)}</div><div className="topic-overlap-legend">{overlap.map((row)=><span key={row.kind}><i className={`is-${row.kind}`}/><span>{row.label}<small>{row.teams} {teamNoun(row.teams)} · {pct(row.teams/76*100)}</small></span></span>)}</div></div>
        <RichNarrative id="topic-overlap:qualification" className="pains-note" value="Сравниваем T2M витрин и нехватку аналитических ресурсов. У команд могут быть другие жалобы."/>
      </DataComponent>
    </section>

    <section id="pain-ranking-section" className="pains-section"><div className="pains-section-heading"><span>Обзор</span><h2>На что жалуются чаще всего</h2></div><div className="pains-ranking-layout"><EvidenceChart id="pain-ranking-chart" title="Число команд по выбранным вариантам" queryId="pain_totals" spec={barSpec} rows={pains} sourceRows={pains} height={370} chartOptions={{getMarkActions:({row})=>[{label:'Посмотреть команды',onSelect:()=>pickPain(row.id)}]}}/><DataComponent id="pain-ranking-numbers" title="Доля от 76 команд" queryId="pain_totals" kind="custom" sourceRows={pains} displayRows={pains}><div className="pains-rank-list" data-reviewed-rows>{pains.map((pain,i)=><Button key={pain.id} className="pains-rank-action" onClick={()=>pickPain(pain.id)}><span className="pains-rank-index">{String(i+1).padStart(2,'0')}</span><span className="pains-rank-name">{pain.label}</span><strong>{pain.teams}<small>{pct(pain.share)}</small></strong><span className="pains-rank-arrow">↗</span></Button>)}</div></DataComponent></div><RichNarrative id="pains:ranking-note" className="pains-note" value="Всего 206 отметок по восьми вариантам ответа."/></section>

    {topics.map((row)=><TopicSection topic={row} pains={pains} quotes={quoteRows} teams={teamRows} units={units} unitPains={snapshot.queries.unit_pains.rows} pickPain={pickPain} key={row.id}/>)}

    <section id="topic-platform" className="pains-section"><div className="pains-section-heading"><span>Дополнительно</span><h2>Свободные запросы к платформам</h2></div><RichNarrative id="topic-platform:intro" className="pains-note" value="Команды также пишут о логировании, мощности кластеров, доступе к данным и стабильности инфраструктуры."/><DataComponent id="topic-platform-comments" title="Дословные запросы команд" queryId="survey_comments" kind="custom" sourceRows={platformQuotes} displayRows={platformQuotes}><div className="pains-comment-grid">{platformQuotes.map((row)=><div key={row.record}><h3 className="topic-platform-theme" data-reviewed-rows>{row.theme}</h3><TeamQuote row={row}/></div>)}</div></DataComponent></section>

    <section id="who-complains" className="pains-section"><div className="pains-section-heading"><span>Реестр</span><h2>Кто на что жалуется</h2></div><DataComponent id="pain-team-register" title="Все команды и выбранные проблемы" queryId="team_pains" kind="table" sourceRows={selectedTeams} displayRows={selectedTeams} headerControls={<><Dropdown label="Проблема" showLabel value={topic} choices={[allAnswers,...painDefinitions.map((pain)=>pain.id)]} choiceLabels={Object.fromEntries(painDefinitions.map((pain)=>[pain.id,pain.label]))} onChange={setTopic}/><Dropdown label="Юнит" showLabel value={topicUnit} choices={[allUnits,...units.map((unit)=>unit.unit)]} onChange={setTopicUnit}/></>}><div className="pains-register-scope" data-reviewed-rows><span>{selectedPain?.fullLabel||'Полный перечень ответивших команд'}</span><strong>{selectedTeams.length} {teamNoun(selectedTeams.length)}</strong></div><DataTable rows={selectedTeams} rowKey="teamId" columns={teamColumns} caption="Команды, выбранные проблемы и дословные комментарии; поиск доступен по всем полям"/></DataComponent></section>

    <section id="all-okay" className="pains-section"><div className="pains-section-heading"><span>Отдельно</span><h2>У кого всё ок</h2></div><div className="pains-okay-layout"><DataComponent id="explicit-okay" title="Прямое подтверждение" queryId="survey_comments" kind="custom" sourceRows={[okay]} displayRows={[okay]}><div className="pains-okay" data-reviewed-rows><span className="pains-eyebrow">1 из 76 команд</span><div className="pains-okay-symbol">✓</div><h3>{okay.team}</h3><p>{okay.unit}</p><blockquote>{okay.text}</blockquote></div></DataComponent><DataComponent id="unclear-answer" title="Ответ неясен" queryId="survey_comments" kind="custom" sourceRows={[unclear]} displayRows={[unclear]}><div className="pains-unclear" data-reviewed-rows><span className="pains-eyebrow">Отдельно от «всё ок»</span><h3>{unclear.team}</h3><p>{unclear.unit}</p><blockquote>{unclear.text}</blockquote><p>Выбран вариант «Другое». По этому ответу нельзя заключить, что проблем нет.</p></div></DataComponent></div></section>

    <section id="survey-scope" className="pains-method"><ReportSection id="survey-method" title="Как читали ответы" queryId="survey_summary" sourceRows={[summary]} showHeading={false}><RichNarrative id="pains:method" value="## Как читали ответы\n\nВ расчёте **79 анкет 76 команд из 8 юнитов** за III квартал 2026 года; анкеты заполнены **15–28 октября 2026**. Повторные анкеты трёх команд — зарплатного проекта B2B/B2C, ОМС и Слитков — объединены: вариант учитывается один раз на команду.\n\n**74 команды** сообщили об ограничениях или потребности в поддержке: 72 выбрали хотя бы один из восьми закрытых вариантов, ещё две описали запрос только свободным текстом. 8 содержательных свободных комментариев не включены в частоты закрытых категорий. Один комментарий может иллюстрировать несколько тем; это не дополнительная команда и не объяснение всей категории.\n\nВопрос был обязательным, допускал несколько ответов и не содержал варианта «всё устраивает». Знаменатель всех общих долей — 76 команд. Тематическое объединение BI и Self-Service, отчётности и мониторинга не означает суммирование частот. Частота жалоб не показывает их тяжесть или бизнес-ущерб. Доли не суммируются в 100%. Отсутствие отдельного варианта «всё устраивает» не позволяет оценить общую удовлетворённость.\n\n«Сделка вторичка» прямо сообщила, что всё устраивает; ответ «Страхования жизни» — «Другое» с комментарием «-» — оставлен неясным. Источники, определения и исходные строки доступны в меню каждого блока."/></ReportSection><div className="pains-endnote">DDI · B2C · III квартал 2026<span>Тематический разбор · конец отчёта</span></div></section>
  </article>;
}
