import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {metricDomId} from '../domain/report.js';
const freshCrosssell=JSON.parse(readFileSync(new URL('../data/crosssell-metrics-q3-2026.json',import.meta.url),'utf8')).products.find(p=>p.name==='Вклады+НС');

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
    const periods = doc.querySelector('.dashboard-period [role="combobox"]');
    periods.click(); await pause();
    assert.ok(doc.body.textContent.includes('II кв. 2026'));
    assert.ok(doc.body.textContent.includes('III кв. 2026'));
    assert.ok(!errors.some((e) => /Maximum update depth|TypeError|ReferenceError/.test(e)), errors.join('\n'));
  } finally {dom.window.close();}
});
