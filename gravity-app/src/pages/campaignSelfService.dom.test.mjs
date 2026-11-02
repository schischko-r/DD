import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {metricDomId} from '../domain/report.js';
const build=process.env.DDI_PROFILE_TEST_HTML;
test('self-service launch correction keeps its Q3 digital-trace check in both profile modes',{skip:!build},async()=>{
  const html=readFileSync(build,'utf8'),errors=[],requests=[];
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
    const expand=doc.querySelector('button[title="Развернуть меню"]');if(expand){expand.click();await pause();}
    const profile=[...doc.querySelectorAll('[data-qa="dd-primary-navigation"], [role="menuitem"], .gn-composite-bar-item')] .find(n=>n.textContent.includes('Профиль команды')||n.getAttribute('title')==='Профиль команды'||n.getAttribute('aria-label')==='Профиль команды')||[...doc.querySelectorAll('div,span')].find(n=>n.textContent==='Профиль команды');
    assert.ok(profile,`Profile navigation exists: ${[...doc.querySelectorAll('button,a,[role=menuitem]')].map(n=>[n.tagName,n.getAttribute('data-qa'),n.getAttribute('title'),n.getAttribute('aria-label'),n.textContent.slice(0,55)]).slice(0,30).map(a=>JSON.stringify(a)).join('|')}`);profile.click();await pause();
    await wait(()=>doc.querySelector('.detail-header .detail-period-filter'));
    const choose=async(selector,text)=>{doc.querySelector(selector+' [role="combobox"]').click();await pause();const option=[...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===text);assert.ok(option,text);option.click();await pause();};
    await choose('.detail-team-unit-filter','УБ');
    await choose('.detail-team-select','КАСКО');
    for(const mode of ['Подробно','Компактно']){
      const button=[...doc.querySelectorAll('button')].find(n=>n.textContent.trim()===mode);assert.ok(button,mode);button.click();await pause();
      if(mode==='Компактно'){
        const attraction=[...doc.querySelectorAll('.dd-metric-block-main')].find(n=>n.textContent.includes('Воронка привлечения'));assert.ok(attraction);attraction.click();await pause();
      }
      const row=doc.getElementById(metricDomId('attract.campaign_launches'));
      assert.ok(row);
      assert.equal(row.querySelector('.metric-status-label').textContent,'100%');
      assert.equal(row.querySelector('.metric-digital-trace-confirmation')?.getAttribute('aria-label'),'Проверено на цифровых следах за 3Q');
    }
    assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});
