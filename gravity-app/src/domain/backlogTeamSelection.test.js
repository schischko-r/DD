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

test('the shipped eleven datasets each contain Q3 and each shared member resolves to one shared board',async()=>{
  const {readFileSync}=await import('node:fs');
  const data=JSON.parse(readFileSync(new URL('../../public/backlog-data.json',import.meta.url)));
  assert.equal(data.teams.length,11);
  for(const team of data.teams)assert.ok(team.quarters.some(q=>q.key==='2026-Q3'));
  const insurance=data.teams.find(team=>team.memberTeams.includes('КАСКО'));
  const payments=data.teams.find(team=>team.memberTeams.includes('Оплата улыбкой'));
  assert.equal(insurance.memberTeams.length,2);assert.equal(payments.memberTeams.length,4);
  for(const team of [insurance,payments])for(const name of team.memberTeams){const found=data.teams.filter(t=>backlogTeamMatchesProduct(t,product(name)));assert.equal(found.length,1);assert.equal(found[0],team);}
});

test('fifteen individual options reference the original eleven datasets without copying aggregates or splitting ordinary comma names',async()=>{
  const {readFileSync}=await import('node:fs');
  const raw=readFileSync(new URL('../../public/backlog-data.json',import.meta.url));
  const data=JSON.parse(raw),before=JSON.stringify(data);const options=getBacklogTeamFilterOptions(data.teams);
  assert.equal(options.length,15);assert.equal(new Set(options.map(o=>o.value)).size,15);
  const expected=['КАСКО','ОСАГО','Переводы по РФ','Переводы подарков','SberPay Вжух','Оплата улыбкой'];
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
