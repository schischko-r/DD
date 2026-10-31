import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildTeamProfileProducts} from './teamProfileSelection.js';
const actual=JSON.parse(readFileSync(new URL('../../public/report-data.json',import.meta.url))).products;
const overlay=JSON.parse(readFileSync(new URL('../data/goals-metrics-q3-2026.json',import.meta.url)));
const mapping=JSON.parse(readFileSync(new URL('../../../outputs/goals-q3-2026-mapping/ddi-goals-mapping.json',import.meta.url)));
const others=['mechanics','campaign','draft','crosssell','research','funnel-reporting','ux-score'].map(name=>JSON.parse(readFileSync(new URL(`../data/${name}-metrics-q3-2026.json`,import.meta.url))));
const columns=[['goals.monitored','C',3],['goals.forecast','D',4],['goals.factor_analysis_l1_l2','E',5]];
const codes=columns.map(c=>c[0]),metrics=p=>p.metrics.flatMap(b=>b.metrics);
const normalize=v=>String(v||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru').replaceAll('ё','е');
// Independent openpyxl read-only extraction of A:E from all 74 nonempty source rows.
const golden=[[2, "Core Banking", "Авто", 1, 0, 0], [3, "Core Banking", "Комиссионные продукты", 1, 0, 0], [4, "Core Banking", "Кредитный потенциал", 1, 0, 1], [5, "Core Banking", "Потребительское кредитование", 1, 0, 1], [6, "Core Banking", "Сбережения клиентов", 1, 0, 0], [7, "Core Banking", "Сбережения клиентов", 1, 0, 0], [8, "Core Banking", "ЛЮ", 1, 0, 0], [9, "CX", "Дети и Молодежь", 1, 0, 1], [10, "CX", "Лояльность", 1, 0, 0], [11, "CX", "МВС", 1, 0, 0], [12, "CX", "Прайм", 1, 0, 0], [13, "CX", "Премиальный сегмент", 1, 0, 0], [14, "CX", "Рабочий возраст", 1, 0, 0], [15, "CX", "Управление клиентского опыта", 1, 0, 0], [16, "CX", "Управление частным капиталом", 1, 0, 0], [17, "CX", "Упр-е ИИ-сценариев и комплексных реш.", 1, 0, 0], [18, "CX", "Почтенный возраст", 1, 0, 0], [19, "CX", "Упр-е монетизации и индивидуального ценообразования", 1, 0, 0], [20, "CX", "ЛЮ", 1, 0, 0], [21, "Daily Banking B2C", "Альтернативные платежные методы", 0, 1, 0], [22, "Daily Banking B2C", "Государственные продукты и сервисы", 0, 0, 0], [23, "Daily Banking B2C", "Кошелёк клиента", 1, 0, 0], [24, "Daily Banking B2C", "Кредитные карты", 0, 0, 0], [25, "Daily Banking B2C", "Переводы", 0, 0, 0], [26, "Daily Banking B2C", "Платежи", 1, 0, 0], [27, "Daily Banking B2C", "Социальные и зарплатные решения", 0, 0, 0], [28, "Daily Banking B2C", "Эквайринг", 1, 0, 0], [29, "Daily Banking B2C", "ЛЮ", 0, 0, 0], [30, "Data", "AmazMe", 1, 0, 0], [31, "Data", "CDO B2C", 1, 0, 0], [32, "Data", "CDS B2C", 1, 0, 0], [33, "Data", "Sber ID", 1, 0, 0], [34, "Data", "SberCampaigning", 1, 0, 0], [35, "Data", "SberNBA", 1, 0, 0], [36, "Data", "SberProfile", 1, 0, 0], [37, "Data", "ЛЮ", 1, 0, 0], [38, "Digital Channels", "Digital Platform", 1, 0, 0], [39, "Digital Channels", "СберKids", 0, 0, 0], [40, "Digital Channels", "СберИнвестор", 1, 0, 0], [41, "Digital Channels", "СБОЛ", 1, 0, 0], [42, "Digital Channels", "Уведомления", 1, 0, 1], [43, "Digital Channels", "Цифровой ассистент", 0, 0, 1], [44, "Digital Channels", "ЛЮ", 1, 0, 0], [45, "eCom", "ЛЮ", 1, 0, 0], [46, "Phygital Channels", "AI", 1, 0, 0], [47, "Phygital Channels", "Клиентские документы", 1, 0, 0], [48, "Phygital Channels", "Платформа Phygital", 1, 0, 1], [49, "Phygital Channels", "Продажи", 0, 0, 0], [50, "Phygital Channels", "СберМобайл", 1, 0, 0], [51, "Phygital Channels", "Сервисные технологии", "#DIV/0!", "#DIV/0!", "#DIV/0!"], [52, "Phygital Channels", "Управление каналами ЕСЗК", 1, 0, 1], [53, "Phygital Channels", "Развитие сервисных технологий в каналах", 1, 0, 1], [54, "Phygital Channels", "ЛЮ", 1, 0, 1], [55, "В2С", "В2С", 0, 0, 0], [56, "Домклик", "Аренда", 1, 0, 1], [57, "Домклик", "Вторичка", 1, 1, 1], [58, "Домклик", "ИЖС", 1, 0, 1], [59, "Домклик", "Лайфстайл", 1, 1, 1], [60, "Домклик", "Первичка", 1, 1, 1], [61, "Домклик", "ЛЮ", 0, 0, 1], [62, "Индустрия Развлечений и рекламы", "ЛЮ", 0, "#DIV/0!", "#DIV/0!"], [63, "УБ", "AI эффективность", 1, 0, 0], [64, "УБ", "PFM", 0, 1, 0], [65, "УБ", "ДББ", 1, 0, 0], [66, "УБ", "Деп. Инвест бизнес (ДИБ)", 1, 0, 0], [67, "УБ", "Депозитарий", 0, 0, 0], [68, "УБ", "ДЗСПиС", 1, 0, 0], [69, "УБ", "ДИиН", 1, 0, 0], [70, "УБ", "ИЦ (Инвестиционный центр)", "#DIV/0!", "#DIV/0!", "#DIV/0!"], [71, "УБ", "РИБ", 1, 1, 0], [72, "УБ", "УППБ", 1, 0, 0], [73, "УБ", "ЦКС", 0, 0, 0], [74, "УБ", "УИЭиПР", 0, 1, 0], [75, "УБ", "ЛЮ", 0, 0, 0]];

test('all 74 matched teams retain exact source workbook C/D/E values, mapping and duplicate-row provenance',()=>{
  assert.equal(overlay.scope,'goals-assessment');assert.equal(overlay.period,'III кв. 2026');assert.equal(overlay.products.length,74);
  const workbook=readFileSync(new URL('../../../Копия Выведение целей (факт план прогно ФА) 3Q.xlsx',import.meta.url));assert.equal(createHash('sha256').update(workbook).digest('hex'),'cc92a5a45bf1cb15f6e2bc9b8b3de4b9a943071df4f66e7e8bd5f7c58c0cb055');
  assert.equal(golden.length,74);for(const row of mapping.sourceRows){const source=golden.find(g=>g[0]===row.sourceRow);assert.ok(source);assert.equal(row.unit,source[1]);assert.equal(row.tribe,source[2]);for(const [,column,index] of columns)assert.equal(row.scores[column].rawValue,source[index]);}
  const aliases={'Много денег (НКПЗН)':[57],'Пакет услуг СберПремьер':[11],'Сделка ИЖС':[58],'Сделка вторичка':[57],'Сделка с Первичным жильём':[60],'МВС':[11]};
  const unitAliases={'core banking':'cbp','daily banking b2c':'db','digital channels':'dp','phygital channels':'pc'};
  let ones=0,halves=0,zeros=0,exact=0,alias=0;
  for(const team of overlay.products){
    const old=actual.find(p=>p.id===team.id),match=mapping.teams.find(p=>p.id===team.id);assert.ok(old);assert.equal(team.name,old.name);assert.deepEqual(Object.keys(team.metrics).sort(),[...codes].sort());
    assert.ok(['exact','normalized_alias'].includes(match.mappingStatus));if(match.mappingStatus==='exact')exact++;else{alias++;assert.deepEqual(match.sourceRows,aliases[team.name]);}
    for(const [code,column,index] of columns){
      const fact=team.metrics[code],source=fact.source;assert.deepEqual(source.sourceRows,match.sourceRows);assert.equal(source.mappingStatus,match.mappingStatus);assert.equal(source.confirmedBy,'user');assert.equal(source.cell,`${column}${match.sourceRows[0]}`);assert.equal(source.column,column);
      assert.equal(source.cells.length,match.sourceRows.length);
      for(const rowNumber of match.sourceRows){const row=golden.find(g=>g[0]===rowNumber);const previous=metrics(old).find(m=>m.code===code);assert.equal(fact.rawValue,previous.value===.5&&row[index]===0?.5:row[index]);assert.equal(source.cells.find(c=>c.cell===`${column}${rowNumber}`).rawValue,row[index]);if(match.mappingStatus==='exact'){assert.equal(normalize(old.tribe),normalize(row[2]));assert.equal(normalize(old.unit),unitAliases[normalize(row[1])]||normalize(row[1]));}}
      assert.ok([0,.5,1].includes(fact.rawValue));if(fact.rawValue===1)ones++;else if(fact.rawValue===.5)halves++;else zeros++;
    }
  }
  assert.equal(exact,68);assert.equal(alias,6);assert.equal(ones,78);assert.equal(halves,47);assert.equal(zeros,97);
  const duplicated=overlay.products.filter(p=>p.metrics[codes[0]].source.sourceRows.includes(6));assert.ok(duplicated.length>0);for(const p of duplicated)assert.deepEqual(p.metrics[codes[0]].source.sourceRows,[6,7]);
});

test('222 goal facts apply literally without changing maxima, previous overlays, Q2 or source recommendations; pending teams stay unknown',()=>{
  const oldData=JSON.stringify(actual),raw=JSON.stringify(overlay);
  const base=buildTeamProfileProducts(actual,overlay.period,others),current=buildTeamProfileProducts(actual,overlay.period,[...others,overlay]);
  const pending=['POS-кредиты','BNPL','Зрелость','Колл-центр','Телемаркетинг','SberID','Единый личный кабинет (ЕЛК)','Почта, Диск, Календарь','Персональная рекомендация'];
  assert.deepEqual(overlay.pending.map(p=>p.name).sort(),[...pending].sort());let applied=0,positiveDelta=0,negativeDelta=0;
  for(const product of current){
    const old=actual.find(p=>p.name===product.name&&p.unit===product.unit&&p.type===product.type),prior=base.find(p=>p.name===product.name&&p.unit===product.unit&&p.type===product.type);assert.equal(product.indexMaxPoints,prior.indexMaxPoints);
    const facts=overlay.products.find(p=>p.id===old.id)?.metrics;
    for(const metric of metrics(product)){
      const previous=metrics(prior).find(m=>m.code===metric.code),q2=metrics(old).find(m=>m.code===metric.code);assert.equal(metric.max_value,previous.max_value);
      if(!codes.includes(metric.code)||!facts){assert.deepEqual(metric,previous);if(pending.includes(product.name)&&codes.includes(metric.code))assert.equal(metric.value,null);continue;}
      const fact=facts[metric.code];assert.equal(metric.max_value,1);assert.equal(metric.value,fact.rawValue);assert.deepEqual(metric.source,{...fact.source,rawValue:fact.rawValue});
      assert.deepEqual((metric.recommendation_items||[]).map(i=>[i.recommendation,i.group,i.recommendation_difficulty]),(q2.recommendation_items||[]).map(i=>[i.recommendation,i.group,i.recommendation_difficulty]));assert.ok((metric.recommendation_items||[]).every(i=>i.value===metric.value&&i.max_value===metric.max_value&&i.gap===metric.max_value-metric.value));applied++;
    }
    if(facts){const oldPoints=metrics(old).filter(m=>codes.includes(m.code)).reduce((s,m)=>s+m.value,0),newPoints=metrics(product).filter(m=>codes.includes(m.code)).reduce((s,m)=>s+m.value,0);const delta=newPoints-oldPoints;if(delta>0)positiveDelta++;if(delta<0)negativeDelta++;assert.ok(Number.isFinite(delta/product.indexMaxPoints*100));}
  }
  assert.equal(applied,222);assert.ok(positiveDelta>0);assert.ok(negativeDelta>0);assert.equal(JSON.stringify(actual),oldData);assert.equal(JSON.stringify(overlay),raw);
  buildTeamProfileProducts(actual,'II кв. 2026',[...others,overlay]).forEach(p=>assert.equal(p,actual.find(old=>old.id===p.id)));
});

test('goals scope projects exactly three goal metrics across all team types and cannot change maxima or import unrelated data',()=>{
  for(const type of ['Продукт','Канал','Сегмент']){
    const old={id:type,name:type,unit:'DB',type,period:'II кв. 2026',metrics:[{code:'goals',metrics:[...codes.map(code=>({code,value:0,max_value:1,is_applicabble_flg:true})),{code:'hyp.datadriven_rating_7_5',value:0,max_value:1,is_applicabble_flg:true}]}]};
    const facts={period:overlay.period,scope:overlay.scope,metricMaxOverrides:{[codes[0]]:99},products:[{id:type,name:type,unit:'DB',type,metrics:Object.fromEntries(metrics(old).map(m=>[m.code,{rawValue:m.code===codes[1]?0:1,source:{fixture:true}}]))}]};
    const current=metrics(buildTeamProfileProducts([old],overlay.period,facts)[0]);for(const metric of current){assert.equal(metric.max_value,1);assert.equal(metric.value,codes.includes(metric.code)?metric.code===codes[1]?0:1:null);}
    facts.products[0].metrics[codes[0]].rawValue=.5;assert.equal(metrics(buildTeamProfileProducts([old],overlay.period,facts)[0])[0].value,.5);assert.equal(metrics(buildTeamProfileProducts([old],overlay.period,{...facts,scope:'untrusted-other-assessment'})[0])[0].value,null,'A half-point goal fact requires the explicit goals scope');
    facts.products[0].metrics[codes[0]].rawValue=.25;assert.equal(metrics(buildTeamProfileProducts([old],overlay.period,facts)[0])[0].value,null,'Unsupported quarter-point facts are rejected');
  }
});

test('the delta artifact compares only the three goals with Q2 using the effective Q3 index denominator',()=>{
  const delta=JSON.parse(readFileSync(new URL('../../../outputs/goals-q3-2026-mapping/goals-delta.json',import.meta.url)));
  const current=buildTeamProfileProducts(actual,overlay.period,[...others,overlay]);assert.equal(delta.rows.length,74);assert.equal(delta.pending.length,9);
  let beforeTotal=0,afterTotal=0,up=0,down=0,flat=0;
  const round=v=>Math.round(v*10000)/10000;
  for(const row of delta.rows){
    const old=actual.find(p=>p.id===row.id),q3=current.find(p=>p.name===old.name&&p.unit===old.unit&&p.type===old.type);
    const before=metrics(old).filter(m=>codes.includes(m.code)),after=metrics(q3).filter(m=>codes.includes(m.code));
    const b=before.reduce((s,m)=>s+m.value,0),a=after.reduce((s,m)=>s+m.value,0),d=a-b;
    assert.equal(row.beforeGoalPoints,b);assert.equal(row.afterGoalPoints,a);assert.equal(row.goalPointsDelta,d);assert.equal(row.goalMaxPoints,3);
    assert.equal(row.effectiveQ3IndexMaxPoints,q3.indexMaxPoints);assert.ok(Math.abs(row.indexContributionDeltaPp-round(100*d/q3.indexMaxPoints))<.00011);
    assert.ok(Math.abs(row.goalPercentDeltaPp-round(100*d/3))<.00011);
    for(const m of row.metrics){const source=before.find(p=>p.code===m.code),next=after.find(p=>p.code===m.code);assert.equal(m.beforePoints,source.value);assert.equal(m.afterPoints,next.value);assert.equal(m.pointsDelta,next.value-source.value);}
    beforeTotal+=b;afterTotal+=a;if(d>0)up++;else if(d<0)down++;else flat++;
  }
  assert.equal(beforeTotal,98);assert.equal(afterTotal,101.5);assert.equal(afterTotal-beforeTotal,3.5);assert.deepEqual([up,down,flat],[30,19,25]);
  assert.equal(delta.summary.beforeGoalPoints,beforeTotal);assert.equal(delta.summary.afterGoalPoints,afterTotal);assert.deepEqual([delta.summary.up,delta.summary.down,delta.summary.flat],[up,down,flat]);
});

test('the half-score exception affects only the exact 47 Q2-half/workbook-zero facts while preserving literal Excel zeros',()=>{
  let changed=0;const teams=new Set(),byCode=Object.fromEntries(codes.map(c=>[c,0]));
  for(const product of overlay.products){
    const old=actual.find(p=>p.id===product.id);
    for(const [code,fact] of Object.entries(product.metrics)){
      const previous=metrics(old).find(m=>m.code===code),raw=golden.find(r=>r[0]===fact.source.sourceRow)[columns.find(c=>c[0]===code)[2]];
      const exception=previous.value===.5&&raw===0;
      assert.equal(fact.rawValue,exception?.5:raw);
      if(!exception){assert.equal(fact.source.userPolicyOverride,undefined);continue;}
      changed++;teams.add(product.id);byCode[code]++;
      assert.equal(fact.source.excelRawValue,0);assert.equal(fact.source.appliedPoints,.5);assert.equal(fact.source.points,0);assert.ok(fact.source.cells.every(c=>c.rawValue===0));
      const policy=fact.source.userPolicyOverride;assert.equal(policy.policy,'retainQ2HalfWhenWorkbookZero');assert.equal(policy.previousValue,.5);assert.equal(policy.workbookValue,0);assert.equal(policy.appliedPoints,.5);assert.equal(policy.confirmedBy,'user');
      assert.ok(fact.source.policyHistory.some(h=>h.previousAppliedPoints===0&&h.appliedPoints===.5));
    }
  }
  assert.equal(changed,47);assert.equal(teams.size,37);assert.deepEqual(byCode,{'goals.monitored':4,'goals.forecast':24,'goals.factor_analysis_l1_l2':19});
});
