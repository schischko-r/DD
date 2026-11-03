import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {displayProductName} from '../domain/report.js';
import {buildSummaryRadarData} from '../domain/summaryRadar.js';
const sourceData=JSON.parse(readFileSync(new URL('../../public/report-data.json',import.meta.url),'utf8'));

const build=process.env.DDI_PROFILE_TEST_HTML;
test('built Summary renders Q3 categories and both periods from current profiles',{skip:!build},async()=>{
  assert.ok(existsSync(build));const html=readFileSync(build,'utf8');const errors=[],requests=[];
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',(...e)=>errors.push(e.join(' ')));
  const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
    w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    w.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,top:0,left:0,right:900,bottom:1000,width:900,height:1000};};
    Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return 1000;}});
    Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return 900;}});
    // Chart typography/layout APIs are absent in JSDOM; provide deterministic measurements.
    w.HTMLCanvasElement.prototype.getContext=function(kind){assert.equal(kind,'2d');return {font:'14px sans-serif',measureText(text){return {width:String(text).length*7,actualBoundingBoxAscent:11,actualBoundingBoxDescent:3};}};};
    w.SVGElement.prototype.getBBox=function(){return {x:0,y:0,width:(this.textContent||'').length*7,height:14};};
    w.SVGElement.prototype.getComputedTextLength=function(){return (this.textContent||'').length*7;};
    Object.defineProperty(w.document,'fonts',{value:{ready:Promise.resolve(),check:()=>true,addEventListener(){},removeEventListener(){}}});
    w.ResizeObserver=class{constructor(callback){this.callback=callback;this.seen=new WeakSet();this.active=true;}observe(target){if(this.seen.has(target))return;this.seen.add(target);queueMicrotask(()=>{if(this.active)this.callback([{target,contentRect:target.getBoundingClientRect()}],this);});}unobserve(){}disconnect(){this.active=false;}};
    w.fetch=async url=>{requests.push(String(url));const name=String(url).split('/').at(-1);if(!/^[\w-]+\.json$/.test(name))throw new Error('Unexpected network request');const file=new URL(`../../public/${name}`,import.meta.url);return {ok:existsSync(file),json:async()=>{if(!existsSync(file))return null;const payload=JSON.parse(readFileSync(file,'utf8'));if(name==='report-data.json'){const deposits=payload.products.find(p=>p.name==='Вклады+НС');deposits.metrics.find(b=>b.code==='attract').participant_links=[{label:'Ранее приложенный отчёт (fixture)',url:'https://example.ru/previous-participant'}];}return payload;}};};
    w.addEventListener('error',e=>errors.push(e.message));
  }});
  const doc=dom.window.document;const pause=()=>new Promise(r=>setTimeout(r,60));
  const wait=async predicate=>{for(let i=0;i<40;i++){if(predicate())return;await pause();}assert.ok(predicate(),'UI state became ready');};
  try{
    for(const[,attrs,script]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/application\/json/.test(attrs))dom.window.eval(script.replaceAll('import.meta.url',JSON.stringify('http://localhost/index.html')));
    await wait(()=>doc.querySelector('.dashboard-period [role="combobox"]'));
    assert.ok(doc.querySelector('.dashboard-period [role="combobox"]').textContent.includes('III кв. 2026'),'Third quarter is selected by default');
    assert.ok(!doc.querySelector('.dashboard-page').textContent.includes('Данные ещё не добавлены'));
    assert.equal(doc.querySelectorAll('.dashboard-page .dashboard-category-card').length,3);
    const closeCatalog=async()=>{
      const dialog=doc.querySelector('.catalog-dialog');
      const close=dialog.querySelector('button[aria-label*="Закрыть"],button[aria-label*="Close"]');
      if(close)close.click();else doc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
      await wait(()=>!doc.querySelector('.catalog-dialog'));
    };
    const checkComparison=()=>{
      const table=doc.querySelector('.catalog-dialog .catalog-table');
      const headers=[...table.querySelectorAll('.catalog-table-head > span')].map(n=>n.textContent);
      assert.ok(headers.includes('DDI 2 кв'),headers.join(', '));
      assert.ok(headers.includes('DDI 3 кв'),headers.join(', '));
      assert.ok(headers.includes('Дельта'),headers.join(', '));
      assert.ok(headers.includes('Статус 3 кв'),headers.join(', '));
      const items=[...table.querySelectorAll('.catalog-item-row')];
      assert.ok(items.length>0,'catalog has teams');
      let checked=0;
      for(const item of items){
        const name=item.querySelector('.catalog-title b').textContent;
        const baseline=sourceData.title.rows.filter(row=>displayProductName(row.name)===name);
        if(baseline.length!==1)continue;
        const scores=[...item.querySelectorAll(':scope > strong')].map(n=>n.textContent);
        assert.equal(scores.length,2,name);
        if(scores[0]==='—'||scores[1]==='—')continue;
        assert.equal(scores[0],`${baseline[0].score}%`,`${name}: source Q2 index`);
        const delta=Number.parseFloat(scores[1])-baseline[0].score;
        const signed=delta>0?`+${delta}`:String(delta);
        assert.ok(item.textContent.includes(`${signed} п.п.`),`${name}: ${item.textContent}`);
        checked++;
      }
      assert.ok(checked>0,'compared at least one known historical team');
    };
    for(const category of ['channel','segment','product']){
      doc.querySelector(`.dashboard-category-${category} .dashboard-category-footer`).click();
      await wait(()=>doc.querySelector('.catalog-dialog .catalog-table-head'));
      if(category==='product'){
        doc.querySelector('.catalog-dialog .catalog-unit-row').click();await pause();
      }
      checkComparison();
      await closeCatalog();
    }
    const choose=async(selector,label)=>{
      doc.querySelector(selector).click();await pause();
      const option=[...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===label);
      assert.ok(option,label);option.click();await pause();
    };
    await choose('.dashboard-unit-filter [role="combobox"]','CBP');
    const previousBlocks=buildSummaryRadarData(sourceData.products,'II кв. 2026','CBP',sourceData.products.find(p=>p.unit==='CBP').metrics).points;
    const unitCards=[...doc.querySelectorAll('.metric-block-static')];
    assert.equal(unitCards.length,8,'CBP shows all eight DDI block cards');
    for(const card of unitCards){
      const name=card.querySelector('h3').textContent;
      const previous=previousBlocks.find(block=>block.name===name)?.unit;
      assert.ok(Number.isFinite(previous),`${name}: Q2 baseline exists`);
      const current=Number.parseFloat(card.querySelector('.dd-metric-block-score').textContent);
      const badge=card.querySelector('.dashboard-block-quarter-delta');
      assert.ok(badge,`${name}: quarter-change badge is visible`);
      const expected=current-previous;
      assert.equal(badge.querySelector('.index-quarter-delta-value').textContent,`${expected>0?'+':expected<0?'−':''}${Math.abs(expected)} п.п.`,name);
      assert.equal(badge.title,'Изменение к предыдущему кварталу');
    }
    await choose('.dashboard-unit-filter [role="combobox"]','DP');
    assert.ok(doc.querySelector('.dashboard-category-strip'),'unit scope uses compact categories');
    const channels=[...doc.querySelectorAll('.dashboard-category-row-title')].find(n=>n.textContent.includes('Каналы и поверхности'));
    assert.ok(channels);channels.click();await wait(()=>doc.querySelector('.catalog-dialog .catalog-table-head'));
    checkComparison();
    for(const row of doc.querySelectorAll('.catalog-dialog .catalog-item-row'))assert.equal(row.children[1].textContent,'DP','unit filter scopes comparison rows');
    const search=doc.querySelector('.catalog-dialog input');
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(search,'СБОЛ');
    search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    await wait(()=>doc.querySelectorAll('.catalog-dialog .catalog-item-row').length===1);
    assert.equal(doc.querySelector('.catalog-dialog .catalog-title b').textContent,'СБОЛ','team search narrows the scoped comparison');
    checkComparison();
    await closeCatalog();
    const periods = doc.querySelector('.dashboard-period [role="combobox"]');
    periods.click(); await pause();
    assert.ok(doc.body.textContent.includes('II кв. 2026'));
    assert.ok(doc.body.textContent.includes('III кв. 2026'));
    [...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()==='II кв. 2026').click();await pause();
    [...doc.querySelectorAll('.dashboard-category-row-title')].find(n=>n.textContent.includes('Каналы и поверхности')).click();
    await wait(()=>doc.querySelector('.catalog-dialog .catalog-table-head'));
    const oldHeaders=[...doc.querySelectorAll('.catalog-dialog .catalog-table-head > span')].map(n=>n.textContent);
    assert.deepEqual(oldHeaders,['Каналы и поверхности','Юнит','Data-Driven Index','Статус']);
    assert.ok(!doc.querySelector('.catalog-dialog').textContent.includes('п.п.'));
    assert.equal(doc.querySelector('.catalog-dialog .catalog-item-row').querySelectorAll(':scope > strong').length,1);
    assert.ok(!errors.some((e) => /Maximum update depth|TypeError|ReferenceError/.test(e)), errors.join('\n'));
  } finally {dom.window.close();}
});
