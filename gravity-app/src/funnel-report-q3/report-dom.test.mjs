import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM, VirtualConsole} from 'jsdom';
import {compareRows} from './comparison-model.js';
import {histogramData} from './histogram-data.js';
import {decorateRows,formatNumber,selectRows,summarizeRows} from './report-model.js';

const data=JSON.parse(readFileSync(new URL('../../../outputs/ddi-funnel-q3-2026-11-03/report-data.json',import.meta.url),'utf8'));

test('offline report filters and recomputes summaries, searches and sorts teams, and exports the filtered block', async()=>{
  const html=readFileSync(new URL('../../../outputs/ddi-funnel-q3-2026-11-03/report/funnel-report-q3.html',import.meta.url),'utf8');
  const errors=[],requests=[],blobs=[],downloads=[];
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>errors.push(error.message));
  virtualConsole.on('error',(...args)=>errors.push(args.join(' ')));
  const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole,beforeParse(w){
    w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    // JSDOM has no layout engine: provide deterministic chart measurement primitives.
    w.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,right:800,bottom:320,width:800,height:320,toJSON(){return this;}};};
    Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return 800;}});
    Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return 320;}});
    Object.defineProperty(w.HTMLElement.prototype,'offsetWidth',{get(){return 800;}});
    Object.defineProperty(w.HTMLElement.prototype,'offsetHeight',{get(){return 320;}});
    w.HTMLCanvasElement.prototype.getContext=function(kind){assert.equal(kind,'2d');return {font:'14px sans-serif',measureText(text){return {width:String(text).length*7,actualBoundingBoxAscent:11,actualBoundingBoxDescent:3};}};};
    w.SVGElement.prototype.getBBox=function(){return {x:0,y:0,width:(this.textContent||'').length*7,height:14};};
    w.SVGElement.prototype.getComputedTextLength=function(){return (this.textContent||'').length*7;};
    w.ResizeObserver=class{constructor(callback){this.callback=callback;this.active=true;this.observed=new WeakSet();}observe(target){if(this.observed.has(target))return;this.observed.add(target);queueMicrotask(()=>{if(this.active)this.callback([{target,contentRect:target.getBoundingClientRect(),borderBoxSize:[{inlineSize:800,blockSize:320}],contentBoxSize:[{inlineSize:800,blockSize:320}]}],this);});}unobserve(){}disconnect(){this.active=false;}};
    Object.defineProperty(w.document,'fonts',{value:{ready:Promise.resolve(),check:()=>true,addEventListener(){},removeEventListener(){}}});
    w.print=()=>{};w.scrollTo=()=>{};
    w.fetch=(...args)=>{requests.push(args);throw new Error('Offline report requested network');};
    w.Blob=globalThis.Blob;
    w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:report-test';};w.URL.revokeObjectURL=()=>{};
    w.HTMLAnchorElement.prototype.click=function(){downloads.push({href:this.href,name:this.download});};
    w.addEventListener('error',e=>errors.push(e.message));
  }});
  const doc=dom.window.document;
  assert.equal(doc.querySelectorAll('script[src],link[rel="stylesheet"][href]').length,0,'All code and styles are inline');
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length);
  for(const [,attrs,script]of scripts)if(!/application\/json/.test(attrs))dom.window.eval(script.replaceAll('import.meta.url',JSON.stringify('http://localhost/funnel-report.html')));
  const pause=()=>new Promise(r=>setTimeout(r,40));
  const button=text=>[...doc.querySelectorAll('button')].find(n=>n.textContent.trim()===text);
  const click=async text=>{assert.ok(button(text),text);button(text).click();await pause();};
  const write=async value=>{const input=doc.querySelector('input[placeholder="Найти команду или юнит"]');assert.ok(input);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await pause();};
  const rows=()=>[...doc.querySelectorAll('.teams-table-wrap tbody tr')];
  const values=()=>rows().map(row=>Number(row.querySelector('.table-pct').textContent.replace('%','').replace(',','.')));
  const checkSummary=async(type='all',checkPopups=false)=>{
    const details=JSON.parse(readFileSync(new URL('../../../outputs/ddi-funnel-q3-2026-11-03/detail-data.json',import.meta.url),'utf8'));
    assert.equal(doc.querySelectorAll('.funnel-branch[data-block]').length,2);
    assert.equal(doc.querySelectorAll('[role="dialog"]').length,0,'Histograms are closed by default');
    for(const[code,index,title]of [['attract',0,'Привлечение'],['churn',1,'Отток']]){
      const summary=summarizeRows(selectRows(data,code,{type}));
      const poor=summary.levels.find(l=>l.label==='Плохо');
      assert.equal(doc.querySelector(`[data-qa="${code}-poor-share"]`).textContent,`${formatNumber(poor.share,1)}%`);
      for(const key of ['P10','P25','P50','P75','P90']){
        const row=[...doc.querySelectorAll('.percentile-table tbody tr')].find(r=>r.querySelector('th').textContent.startsWith(key));
        assert.equal(row.querySelectorAll('td')[index].textContent,`${formatNumber(summary.percentiles[key],1)}%`);
      }
      const branch=doc.querySelector(`.funnel-branch[data-block="${code}"]`);
      assert.ok(branch.querySelector('.branch-children'));
      for(const[scope,scopeTitle]of [['whole','Воронка целиком'],['reporting','Отчётность'],['completeness','Полнота отчёта']]){
        const current=scope==='whole'?summary:summarizeRows(selectRows(details.scopes[scope],code,{type}));
        const card=branch.querySelector(`.level-card[data-scope="${scope}"][data-block="${code}"]`);assert.ok(card,`${code}/${scope}`);
        if(scope!=='whole')assert.ok(card.closest('.branch-children'),'Detail levels are nested beneath the whole funnel');
        assert.equal(card.querySelector('.level-card-count').textContent,`${current.n} команд`);
        current.levels.forEach((level,i)=>assert.equal(card.querySelectorAll('.level-value')[i].textContent,`${current.n?formatNumber(level.share,1)+'%':'—'}${level.count} команд`));
        if(checkPopups){
          const label=`Распределение: ${title} — ${scopeTitle}`;
          const trigger=card.querySelector(`button[aria-label="${label}"]`);assert.ok(trigger,label);trigger.click();await new Promise(r=>setTimeout(r,180));
          const dialog=doc.querySelector(`[role="dialog"][aria-label="${label}"]`);assert.ok(dialog,label);
          assert.equal(dialog.querySelector('.distribution-popup-heading b').textContent,`${scopeTitle} · ${title}`);
          assert.equal(dialog.querySelector('.histogram-card h3').textContent,`${current.n} команд`);
          assert.ok(dialog.querySelector('[data-chart-library="gravity-ui"] svg'),'Gravity SVG mounted inside popup');
          const histogramLabel=dialog.querySelector('.histogram[role="img"]').getAttribute('aria-label');
          for(const bin of current.bins)assert.ok(histogramLabel.includes(`${bin.range}%: ${bin.count}`));
          if(scope==='reporting'){
            doc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
          }else{
            const close=dialog.querySelector('button[aria-label*="Закрыть"],button[aria-label*="Close"]');assert.ok(close,'Popup close button');close.click();
          }
          await new Promise(r=>setTimeout(r,250));assert.ok(!doc.querySelector('[role="dialog"]'),`Popup closes: ${scope}/${code}; status=${doc.querySelector('[role="dialog"]')?.getAttribute('data-floating-ui-status')}`);
        }
      }
    }
  };
  const checkGrowth=(filters={})=>{
    const baseline=JSON.parse(readFileSync(new URL('../funnel-report/report-data.json',import.meta.url),'utf8'));
    const baselineDetails=JSON.parse(readFileSync(new URL('../funnel-report/detail-data.json',import.meta.url),'utf8'));
    const details=JSON.parse(readFileSync(new URL('../../../outputs/ddi-funnel-q3-2026-11-03/detail-data.json',import.meta.url),'utf8'));
    assert.equal(doc.querySelectorAll('[data-growth-scope]').length,6);
    for(const scope of ['whole','reporting','completeness'])for(const code of ['attract','churn']){
      const result=compareRows(scope==='whole'?baseline:baselineDetails.scopes[scope],scope==='whole'?data:details.scopes[scope],code,filters);
      const card=doc.querySelector(`[data-growth-scope="${scope}"][data-growth-block="${code}"]`);
      assert.equal(card.querySelector('[data-qa="matched-count"]').textContent,`${result.pairs.length} сопоставимых команд`);
      if(!result.pairs.length){assert.ok(card.querySelector('.growth-empty'));continue;}
      const metrics=[...card.querySelectorAll('tbody tr')];assert.equal(metrics.length,5);
      for(const [i,m]of result.metrics.entries()){
        const expected=[`${formatNumber(m.baseline)}%`,`${formatNumber(m.current)}%`,`${m.deltaPp>0?'+':''}${formatNumber(m.deltaPp)}`,m.relativeChange==null?'—':`${m.relativeChange>0?'+':''}${formatNumber(m.relativeChange)}%`];
        assert.deepEqual([...metrics[i].querySelectorAll('td')].map(td=>td.textContent),expected);
      }
    }
  };
  const choose=async(label,text)=>{const select=doc.querySelector(`[role="combobox"][aria-label="${label}"]`);assert.ok(select,label);select.click();await pause();const option=[...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===text);assert.ok(option,text);option.click();await pause();};
  try{
    await new Promise(r=>setTimeout(r,220));
    assert.ok(doc.querySelector('.report-topbar').textContent.includes('III квартал 2026'));
    assert.ok(doc.querySelector('.report-footer').textContent.includes('III квартал 2026'));
    assert.equal(doc.querySelector('[data-qa="cohort-count"]').textContent,'В выборке 76 из 76 команд');
    await checkSummary('all',true);checkGrowth();assert.equal(rows().length,70);
    assert.deepEqual(values(),[...values()].sort((a,b)=>a-b));
    await write('СберСова');assert.equal(rows().length,1);
    await click('CSV');const csv=await blobs.at(-1).text();assert.equal(csv.trim().split(/\r?\n/).length,2);
    assert.ok(csv.includes('III − II, п.п.'));assert.ok(csv.includes('III − II, % к II кварталу'));assert.ok(csv.includes('СберСова'));
    const current=data.blocks.attract.rows.find(r=>r.team==='СберСова');
    const old=JSON.parse(readFileSync(new URL('../funnel-report/report-data.json',import.meta.url),'utf8')).blocks.attract.rows.find(r=>r.id===current.sourceTeamId);
    assert.deepEqual(csv.trim().split(/\r?\n/)[1].split(';').slice(12),[`"${old.pct}"`,`"${current.pct-old.pct}"`,`"${old.pct===0?'':String(100*(current.pct-old.pct)/old.pct).replace('.',',')}"`]);
    checkGrowth();assert.equal(doc.querySelector('[data-qa="cohort-count"]').textContent,'В выборке 76 из 76 команд');
    await write('');await click('Сначала низкие');assert.deepEqual(values(),[...values()].sort((a,b)=>b-a));
    await choose('Тип команды','Сегменты');await checkSummary('Сегмент');checkGrowth({type:'Сегмент'});
    const expected=selectRows(data,'attract',{type:'Сегмент'});assert.equal(rows().length,expected.length);
    await click('CSV');assert.equal((await blobs.at(-1).text()).trim().split(/\r?\n/).length,expected.length+1);
    await click('Сбросить');checkGrowth();
    await choose('Квартиль команд','Q1');const q1=decorateRows(selectRows(data,'attract')).filter(r=>r.quartile===1);
    assert.equal(rows().length,q1.length);for(const row of rows())assert.equal(row.querySelectorAll('td')[8].textContent,'Q1');
    checkGrowth();await click('CSV');assert.equal((await blobs.at(-1).text()).trim().split(/\r?\n/).length,q1.length+1);
    await choose('Квартиль команд','Все квартили');
    const churn=doc.querySelector('input[type="radio"][value="churn"]');churn.click();await pause();assert.equal(rows().length,68);
    await choose('Юнит','CX');checkGrowth({unit:'CX'});assert.equal(rows().length,selectRows(data,'churn',{unit:'CX'}).length);
    await click('Сбросить');await write('НетТакойКоманды123');assert.equal(rows().length,0);assert.ok(button('CSV').disabled);checkGrowth();
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});
