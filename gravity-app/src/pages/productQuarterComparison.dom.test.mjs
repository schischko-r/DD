import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {displayProductName} from '../domain/report.js';
const build=process.env.DDI_PROFILE_TEST_HTML;
test('quarter comparison keeps card deltas without a block reconciliation spoiler',{skip:!build},async()=>{
  const html=readFileSync(build,'utf8'),errors=[],requests=[];
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',(...e)=>errors.push(e.join(' ')));
  const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
    w.scrollTo=()=>{};w.matchMedia=query=>({matches:query.includes('prefers-reduced-motion'),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    w.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,top:0,left:0,right:900,bottom:1000,width:900,height:1000};};
    Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return 1000;}});
    Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return 900;}});
    // Chart typography/layout APIs are absent in JSDOM; provide deterministic measurements.
    w.HTMLCanvasElement.prototype.getContext=function(kind){assert.equal(kind,'2d');return {font:'14px sans-serif',measureText(text){return {width:String(text).length*7,actualBoundingBoxAscent:11,actualBoundingBoxDescent:3};}};};
    w.SVGElement.prototype.getBBox=function(){return {x:0,y:0,width:(this.textContent||'').length*7,height:14};};
    w.SVGElement.prototype.getComputedTextLength=function(){return (this.textContent||'').length*7;};
    Object.defineProperty(w.document,'fonts',{value:{ready:Promise.resolve(),check:()=>true,addEventListener(){},removeEventListener(){}}});
    w.ResizeObserver=class{constructor(callback){this.callback=callback;this.seen=new WeakSet();this.active=true;}observe(target){if(this.seen.has(target))return;this.seen.add(target);queueMicrotask(()=>{if(this.active)this.callback([{target,contentRect:target.getBoundingClientRect()}],this);});}unobserve(){}disconnect(){this.active=false;}};
    w.fetch=async url=>{requests.push(String(url));const name=String(url).split('/').at(-1);if(!/^[\w-]+\.json$/.test(name))throw new Error('Unexpected network request');const file=new URL(`../../public/${name}`,import.meta.url);return {ok:existsSync(file),json:async()=>{if(!existsSync(file))return null;const payload=JSON.parse(readFileSync(file,'utf8'));return payload;}};};
    w.addEventListener('error',e=>errors.push(e.message));
  }});
  const doc=dom.window.document;const pause=()=>new Promise(r=>setTimeout(r,60));
  const wait=async predicate=>{for(let i=0;i<40;i++){if(predicate())return;await pause();}assert.ok(predicate(),'UI state became ready');};
  const numeric=text=>Number(String(text).replaceAll('−','-').replaceAll(',','.').match(/[+-]?\s*\d+(?:\.\d+)?/)?.[0].replace(/\s/g,''));
  try{
    for(const[,attrs,script]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/application\/json/.test(attrs))dom.window.eval(script.replaceAll('import.meta.url',JSON.stringify('http://localhost/index.html')));
    await wait(()=>doc.querySelector('.dashboard-period [role="combobox"]'));
    const expand=doc.querySelector('button[title="Развернуть меню"]');if(expand){expand.click();await pause();}
    const profile=[...doc.querySelectorAll('[data-qa="dd-primary-navigation"], [role="menuitem"], .gn-composite-bar-item')].find(n=>n.textContent.includes('Профиль команды')||n.getAttribute('title')==='Профиль команды'||n.getAttribute('aria-label')==='Профиль команды');
    assert.ok(profile);profile.click();
    await wait(()=>doc.querySelector('.detail-team-unit-filter [role="combobox"]'));
    const choose=async(selector,text)=>{
      const trigger=doc.querySelector(selector+' [role="combobox"]');assert.ok(trigger,`${selector}: ${errors.join(' | ')}; ${doc.body.textContent.slice(-1000)}`);trigger.click();await pause();
      const option=[...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===text);assert.ok(option,text);option.click();await pause();
    };
    const verify=()=>{
      const disclosure=doc.querySelector('[data-qa="quarter-index-reconciliation"]');
      assert.equal(disclosure,null,'block reconciliation spoiler is removed');
      const card=numeric(doc.querySelector('.index-quarter-delta-value').textContent);
      assert.ok(Number.isFinite(card),'quarter delta remains on the profile card');
      for(const summary of doc.querySelectorAll('.goals-level-decomposition > summary')){
        const badge=summary.querySelector('.metric-actual-growth');
        const score=summary.querySelector('.metric-status-label');
        if(badge&&score)assert.ok(badge.compareDocumentPosition(score)&dom.window.Node.DOCUMENT_POSITION_FOLLOWING,'Goals uplift precedes the score');
      }
      return card;
    };
    const teams=[['CBP','Вклады+НС'],['УБ','БПИФ'],['DB','Зарплатный продукт'],['CX','СберСпасибо'],
      ['ДомКлик','Сделка вторичка'],['DP','СБОЛ'],['PC','Телемаркетинг'],['Data','Персональная рекомендация']];
    const verifyGoals=()=>{
      const summaries=[...doc.querySelectorAll('.goals-level-decomposition > summary')];assert.ok(summaries.length);
      const factor=summaries.find(n=>/фактор/i.test(n.textContent));assert.ok(factor);
      assert.match(factor.querySelector('.metric-status-label')?.textContent||'',/^0%$/,'latest final factor-analysis score is zero');
      assert.equal(summaries.filter(n=>n.querySelector('.metric-actual-growth')).length,0,'unchanged final goals add no growth badges');
    };
    for(const[unit,name]of teams){
      await choose('.detail-team-unit-filter',unit);
      await choose('.detail-team-select',displayProductName(name));
      await wait(()=>doc.querySelector('.detail-header h1').textContent===displayProductName(name));
      const compact=verify();
      const detailed=[...doc.querySelectorAll('button')].find(n=>n.textContent.trim()==='Подробно');assert.ok(detailed);detailed.click();await pause();
      assert.equal(verify(),compact,'detail mode does not change aggregate accounting');
      if(name==='Зарплатный продукт'){
        const b2b=[...doc.querySelectorAll('[data-salary-block] label')].find(n=>n.textContent.trim()==='B2B');assert.ok(b2b,'B2B toggle');b2b.click();await pause();
        assert.equal(b2b.querySelector('input').checked,true);
        assert.equal(verify(),compact,'cohort toggle does not change product aggregate accounting');
        const b2c=[...doc.querySelectorAll('[data-salary-block] label')].find(n=>n.textContent.trim()==='B2C');assert.ok(b2c);b2c.click();await pause();assert.equal(verify(),compact);
        assert.equal(b2c.querySelector('input').checked,true);
      }
      if(name==='Персональная рекомендация'){
        verifyGoals();
      }
      const compactButton=[...doc.querySelectorAll('button')].find(n=>n.textContent.trim()==='Компактно');compactButton.click();await pause();assert.equal(verify(),compact);
      if(name==='Персональная рекомендация'){
        const goals=[...doc.querySelectorAll('.dd-metric-block-main')].find(n=>n.textContent.includes('Цели'));
        assert.ok(goals);goals.click();await pause();verifyGoals();
      }
    }
    let allTeams=0;
    const rawTeams=JSON.parse(readFileSync(new URL('../../public/report-data.json',import.meta.url))).products;
    for(const unit of new Set(teams.map(([unit])=>unit))){
      await choose('.detail-team-unit-filter',unit);
      doc.querySelector('.detail-team-select [role="combobox"]').click();await pause();
      const knownNames=new Set(rawTeams.filter(team=>team.unit===unit).map(team=>displayProductName(team.name)));
      const options=[...doc.querySelectorAll('[role="option"]')].filter(option=>knownNames.has(option.textContent.trim()));assert.ok(options.length);
      const names=options.map(option=>option.textContent.trim());options[0].click();await pause();
      for(const name of names){await choose('.detail-team-select',name);verify();allTeams++;}
    }
    assert.equal(allTeams,76,'every effective Q3 team in all eight units has a rendered quarter delta');
    assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});
