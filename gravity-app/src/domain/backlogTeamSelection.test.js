import test from 'node:test';
import assert from 'node:assert/strict';
import {backlogTeamMatchesProduct,findProductForBacklogTeam,getBacklogTeamFilterOptions,findBacklogTeamFilterOption,backlogTeamOptionValue} from './backlogTeamSelection.js';
const product=name=>({name,unit:'DB',type:'Продукт',period:'III кв. 2026'});

test('shared insurance and payment datasets match every explicit member without duplicating the dataset',()=>{
  const groups=[{key:'insurance',memberTeams:['КАСКО','ОСАГО']},{key:'payments',meta:{memberTeams:['Переводы по РФ','Переводы подарков','SberPay Вжух','Оплата улыбкой']}}];
  for(const name of ['КАСКО','ОСАГО','Переводы по РФ','Переводы подарков','Вжух','Оплата улыбкой'])assert.equal(groups.filter(g=>backlogTeamMatchesProduct(g,product(name))).length,1);
  assert.ok(!groups.some(g=>backlogTeamMatchesProduct(g,product('SberID'))));
  const kasco=product('КАСКО'),osago=product('ОСАГО');
  assert.equal(findProductForBacklogTeam(groups[0],[kasco,osago],osago),osago);
  assert.equal(findProductForBacklogTeam(groups[0],[kasco,osago],product('SberID')),kasco);
  assert.equal(findProductForBacklogTeam(groups[0],[product('СберЧаевые')]),null,'No unrelated fallback when a shared member is unavailable in this period');
});

test('canonical legacy aliases are supported while commas do not infer arbitrary shared memberships',()=>{
  for(const [label,name] of [['СберЧаевые','Сберчаевые #B2C'],['Молодёжь','Молодежь'],['Персональная рекомендация (кампанийнг)','Персональная рекомендация']])assert.ok(backlogTeamMatchesProduct({label},product(name)));
  assert.ok(backlogTeamMatchesProduct({label:'Выписки, справки'},product('Выписки, справки')));
  assert.equal(backlogTeamMatchesProduct({label:'Выписки, справки'},product('Выписки')),false);
  assert.equal(backlogTeamMatchesProduct({label:'КАСКО, ОСАГО'},product('КАСКО')),false,'Only explicit shared-member metadata permits a split');
  const scoped={memberTeams:[{name:'PB',unit:'CX',type:'Сегмент'}]};
  assert.ok(backlogTeamMatchesProduct(scoped,{name:'PB',unit:'CX',type:'Сегмент'}));
  assert.equal(backlogTeamMatchesProduct(scoped,{name:'PB',unit:'DB',type:'Продукт'}),false);
});

test('Top Affluent and СберПервый open the same shared PSDA decomposition',async()=>{
  const {readFileSync}=await import('node:fs');
  const data=JSON.parse(readFileSync(new URL('../../public/backlog-data.json',import.meta.url)));
  const board=data.teams.find(team=>team.key==='top-affluent');
  assert.deepEqual(board.memberTeams,['Top Affluent','Пакет услуг СберПервый']);
  const options=getBacklogTeamFilterOptions(data.teams);
  const affluent=options.find(option=>option.content==='Top Affluent');
  const first=options.find(option=>option.content==='Пакет услуг СберПервый');
  assert.ok(affluent);assert.ok(first);assert.equal(affluent.teamKey,first.teamKey);
  assert.equal(backlogTeamOptionValue(board,product('Пакет услуг СберПервый')),first.value);
});

test('the shipped fourteen datasets each contain Q3 and each shared member resolves to one shared board',async()=>{
  const {readFileSync}=await import('node:fs');
  const data=JSON.parse(readFileSync(new URL('../../public/backlog-data.json',import.meta.url)));
  assert.equal(data.teams.length,14);
  for(const team of data.teams)assert.ok(team.quarters.some(q=>q.key==='2026-Q3'));
  const affluent=data.teams.find(team=>team.memberTeams.includes('Top Affluent'));
  const insurance=data.teams.find(team=>team.memberTeams.includes('КАСКО'));
  const payments=data.teams.find(team=>team.memberTeams.includes('Оплата улыбкой'));
  assert.equal(affluent.memberTeams.length,2);assert.equal(insurance.memberTeams.length,2);assert.equal(payments.memberTeams.length,4);
  for(const team of [affluent,insurance,payments])for(const name of team.memberTeams){const found=data.teams.filter(t=>backlogTeamMatchesProduct(t,product(name)));assert.equal(found.length,1);assert.equal(found[0],team);}
});

test('twenty-two individual options reference fourteen datasets without copying aggregates or splitting ordinary comma names',async()=>{
  const {readFileSync}=await import('node:fs');
  const raw=readFileSync(new URL('../../public/backlog-data.json',import.meta.url));
  const data=JSON.parse(raw),before=JSON.stringify(data);const options=getBacklogTeamFilterOptions(data.teams);
  assert.equal(options.length,22);assert.equal(new Set(options.map(o=>o.value)).size,22);
  const expected=['Top Affluent','Пакет услуг СберПервый','КАСКО','ОСАГО','Переводы по РФ','Переводы подарков','SberPay Вжух','Оплата улыбкой'];
  for(const name of expected)assert.equal(options.filter(o=>o.content===name).length,1);
  assert.ok(!options.some(o=>o.content==='КАСКО, ОСАГО'||o.content.includes('Переводы по РФ,')));
  const kasco=options.find(o=>o.content==='КАСКО'),osago=options.find(o=>o.content==='ОСАГО');assert.notEqual(kasco.value,osago.value);assert.equal(kasco.teamKey,osago.teamKey);
  const board=data.teams.find(t=>t.key===osago.teamKey),quarter=board.quarters.find(q=>q.key==='2026-Q3');
  assert.ok(quarter.createdCount>0);assert.ok(quarter.directions.find(d=>d.key==='Неизвестно').count>0);
  assert.equal(quarter.directions.reduce((sum,direction)=>sum+direction.count,0),quarter.createdCount,'Unknown tasks remain in the complete shared-board denominator');
  assert.equal(backlogTeamOptionValue(board,product('ОСАГО')),osago.value);assert.equal(findBacklogTeamFilterOption(options,osago.value),osago);
  assert.equal(findBacklogTeamFilterOption(options,board.key).teamKey,board.key);
  const ordinary=getBacklogTeamFilterOptions([{key:'ordinary',label:'Выписки, справки'}]);assert.equal(ordinary.length,1);assert.equal(ordinary[0].content,'Выписки, справки');
  assert.equal(JSON.stringify(data),before);
});

test('survey-confirmed Q3 members share their original boards only for the exact team and period',async()=>{
  const {readFileSync}=await import('node:fs');
  const {previousBacklogs}=await import('../deposits-survey/previous-backlogs.js');
  const data=JSON.parse(readFileSync(new URL('../../public/backlog-data.json',import.meta.url)));
  const options=getBacklogTeamFilterOptions(data.teams);
  for(const [name,unit,owner,identity] of [
    ['Автокредит','CBP','Объект Авто','sbertrack.sberbank.ru/space/CI8LDDG1KY'],
    ['Залоговое страхование (корпоративное страхование)','УБ','Личная защита Плюс','jira.sberbank.ru/board/21722/project/KPDS'],
  ]){
    const current={name,unit,type:'Продукт',period:'III кв. 2026'};
    const matches=data.teams.filter(team=>backlogTeamMatchesProduct(team,current));
    assert.equal(matches.length,1,name);
    const board=matches[0];
    assert.equal(board.label,owner,'original dataset label retained');
    assert.ok(board.memberTeams.includes(owner),'legacy member retained');
    const descriptor=board.memberTeams.find(member=>member.name===name);
    assert.deepEqual([descriptor.unit,descriptor.type,descriptor.period],[unit,'Продукт','III кв. 2026']);
    assert.equal(descriptor.mappingEvidence.identity,identity);
    assert.equal(descriptor.mappingEvidence.current.answer,'backlog');
    const evidence=descriptor.mappingEvidence;
    assert.equal(evidence.previous.file,'gravity-app/src/deposits-survey/previous-backlogs.js');
    const saved=previousBacklogs[evidence.previous.teamId];
    assert.ok(saved);assert.equal(saved.cell,evidence.previous.savedCell);
    const priorUrl=new URL(saved.links[0]),currentUrl=new URL(evidence.current.url);
    assert.equal(priorUrl.hostname,currentUrl.hostname);
    for(const parameter of name==='Автокредит'?['space']:['projectKey','rapidView']){
      assert.ok(priorUrl.searchParams.get(parameter));
      assert.equal(priorUrl.searchParams.get(parameter),currentUrl.searchParams.get(parameter));
    }
    assert.equal(priorUrl.searchParams.has('quickFilter'),false);
    assert.equal(currentUrl.searchParams.has('quickFilter'),false);
    assert.equal(board.meta.memberTeams.find(member=>member.name===name).mappingEvidence.identity,identity);
    assert.equal(backlogTeamMatchesProduct(board,{...current,period:'II кв. 2026'}),false);
    assert.equal(backlogTeamMatchesProduct(board,{...current,period:undefined}),false);
    assert.equal(backlogTeamMatchesProduct(board,{...current,unit:'Other'}),false);
    assert.equal(backlogTeamMatchesProduct(board,{...current,type:'Канал'}),false);
    const historical={...current,period:'II кв. 2026'};
    assert.equal(findProductForBacklogTeam({memberTeams:[descriptor]},[historical,current]),current);
    assert.equal(findProductForBacklogTeam({memberTeams:[descriptor]},[historical]),null,'no cross-period fallback');
    const option=options.find(item=>item.content===name);
    assert.ok(option);assert.equal(option.teamKey,board.key);
    assert.equal(backlogTeamOptionValue(board,current),option.value);
    assert.ok(backlogTeamMatchesProduct(board,{name:owner,period:'II кв. 2026'}),'legacy string membership still works in Q2');
  }
});
