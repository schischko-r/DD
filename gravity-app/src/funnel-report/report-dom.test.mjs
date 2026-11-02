import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM, VirtualConsole} from 'jsdom';
import {histogramData} from './histogram-data.js';
import {decorateRows,formatNumber,selectRows,summarizeRows} from './report-model.js';

const data=JSON.parse(readFileSync(new URL('./report-data.json',import.meta.url),'utf8'));

test('offline report filters and recomputes summaries, searches and sorts teams, and exports the filtered block', async()=>{
  const html=readFileSync(new URL('../../../outputs/ddi-funnel-analysis-2026-10-20/report/funnel-report.html',import.meta.url),'utf8');
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
    const details=JSON.parse(readFileSync(new URL('./detail-data.json',import.meta.url),'utf8'));
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
  try{
    await new Promise(r=>setTimeout(r,220));
    assert.equal(doc.querySelector('[data-qa="cohort-count"]').textContent,'В выборке 83 из 83 команд');
    assert.equal(doc.querySelector('[data-qa="attract-poor-share"]').textContent,'15,6%');
    assert.equal(doc.querySelector('[data-qa="churn-poor-share"]').textContent,'32,5%');
    await checkSummary('all',true);assert.equal(rows().length,77);
    assert.deepEqual(values(),[...values()].sort((a,b)=>a-b));
    const churn=doc.querySelector('input[type="radio"][value="churn"]');assert.ok(churn);churn.click();await pause();
    assert.equal(doc.querySelector('[data-qa="table-count"]').textContent,'Показано 77 из 77 команд');
    await write('СберСова');assert.equal(rows().length,1);assert.ok(rows()[0].textContent.includes('СберСова'));assert.deepEqual(values(),[100]);
    assert.equal(doc.querySelector('[data-qa="cohort-count"]').textContent,'В выборке 83 из 83 команд','Search only filters table');
    await click('CSV');assert.equal(blobs.length,1);const one=await blobs[0].text();
    assert.equal(one.trim().split(/\r?\n/).length,2);assert.ok(one.includes('"Отток"'));assert.ok(one.includes('СберСова'));assert.ok(downloads[0].name.includes('Отток'));
    await write('');await click('Сначала низкие');assert.deepEqual(values(),[...values()].sort((a,b)=>b-a));
    const select=doc.querySelector('[role="combobox"][aria-label="Тип команды"]')||doc.querySelectorAll('[role="combobox"]')[0];
    assert.ok(select);select.click();await pause();const option=[...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()==='Сегменты');assert.ok(option);option.click();await pause();
    assert.equal(doc.querySelector('[data-qa="cohort-count"]').textContent,'В выборке 7 из 83 команд');await checkSummary('Сегмент');
    assert.equal(rows().length,7);assert.equal(doc.querySelector('[data-qa="table-count"]').textContent,'Показано 7 из 7 команд');
    await click('CSV');const filtered=await blobs[1].text();assert.equal(filtered.trim().split(/\r?\n/).length,8);assert.equal((filtered.match(/"Отток"/g)||[]).length,7);
    await click('Сбросить');assert.equal(doc.querySelector('[data-qa="cohort-count"]').textContent,'В выборке 83 из 83 команд');await checkSummary();assert.equal(rows().length,77);
    const quartileSelect=doc.querySelector('[role="combobox"][aria-label="Квартиль команд"]');
    assert.ok(quartileSelect);quartileSelect.click();await pause();
    const q1=[...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()==='Q1');assert.ok(q1);q1.click();await pause();
    const expectedQ1=decorateRows(selectRows(data,'churn')).filter(r=>r.quartile===1);
    assert.equal(rows().length,expectedQ1.length);
    assert.deepEqual(new Set(rows().map(r=>r.querySelector('.team-cell b').textContent)),new Set(expectedQ1.map(r=>r.team)));
    for(const row of rows())assert.equal(row.querySelectorAll('td')[5].textContent,'Q1');
    assert.equal(doc.querySelector('[data-qa="cohort-count"]').textContent,'В выборке 83 из 83 команд','Quartile only filters the table');await checkSummary();
    await click('CSV');const quartileCsv=await blobs.at(-1).text();
    assert.equal(quartileCsv.trim().split(/\r?\n/).length,expectedQ1.length+1);
    for(const line of quartileCsv.trim().split(/\r?\n/).slice(1)){assert.ok(line.startsWith('"Отток";'));assert.equal(line.split(';')[10],'"1"');}
    quartileSelect.click();await pause();const allQuartiles=[...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()==='Все квартили');assert.ok(allQuartiles);allQuartiles.click();await pause();assert.equal(rows().length,77);
    await write('НетТакойКоманды123');assert.ok(doc.querySelector('.table-empty').textContent.includes('Команды не найдены'));assert.equal(rows().length,0);assert.ok(button('CSV').disabled||button('CSV').getAttribute('aria-disabled')==='true');
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});


test('Gravity histogram config keeps ten half-open bins, includes 100 and shares explicit count scale',()=>{
  const summary=summarizeRows([0,10,90,100].map((pct,index)=>({id:String(index),pct})));
  const config=histogramData({code:'attract'},summary,5);
  assert.deepEqual(config.xAxis.categories,['0–10','10–20','20–30','30–40','40–50','50–60','60–70','70–80','80–90','90–100']);
  assert.equal(config.yAxis[0].min,0);assert.equal(config.yAxis[0].max,5);
  assert.equal(config.series.data[0].type,'bar-x');
  assert.deepEqual(config.series.data[0].data.map(row=>row.y),[1,1,0,0,0,0,0,0,0,2]);
  assert.equal(config.series.data[0].dataLabels.enabled,true);
  assert.equal(config.tooltip.enabled,true);
});
