import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {metricDomId} from '../domain/report.js';
const freshCrosssell=JSON.parse(readFileSync(new URL('../data/crosssell-metrics-q3-2026.json',import.meta.url),'utf8')).products.find(p=>p.name==='Вклады+НС');

const build=process.env.DDI_PROFILE_TEST_HTML;
test('Q3 Summary uses current profiles while team profiles preserve unknowns and avoid stale Q2 data or React loops',{skip:!build},async()=>{
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
    const expand=doc.querySelector('button[title="Развернуть меню"]');if(expand){expand.click();await pause();}
    const profile=[...doc.querySelectorAll('[data-qa="dd-primary-navigation"], [role="menuitem"], .gn-composite-bar-item')] .find(n=>n.textContent.includes('Профиль команды')||n.getAttribute('title')==='Профиль команды'||n.getAttribute('aria-label')==='Профиль команды')||[...doc.querySelectorAll('div,span')].find(n=>n.textContent==='Профиль команды');
    assert.ok(profile,`Profile navigation exists: ${[...doc.querySelectorAll('button,a,[role=menuitem]')].map(n=>[n.tagName,n.getAttribute('data-qa'),n.getAttribute('title'),n.getAttribute('aria-label'),n.textContent.slice(0,55)]).slice(0,30).map(a=>JSON.stringify(a)).join('|')}`);profile.click();await pause();
    await wait(()=>doc.querySelector('.detail-header .detail-period-filter'));
    const heading=doc.querySelector('.detail-header h1').textContent;assert.ok(heading);
    assert.ok(doc.querySelector('.detail-meta').textContent.includes('III кв. 2026'));
    assert.equal(doc.querySelector('.index-score strong').textContent,'—');
    const detailed=[...doc.querySelectorAll('button')].find(n=>n.textContent.trim()==='Подробно');assert.ok(detailed);detailed.click();await pause();
    assert.ok(doc.querySelector('.metric-row'),'Full metric structure is rendered');
    const reportGroup=[...doc.querySelectorAll('.metric-group-title')].find(n=>/Отч[её]тность/.test(n.textContent));
    assert.ok(reportGroup,'Reporting subgroup heading is preserved');
    const regularity=[...doc.querySelectorAll('.metric-row')].find(n=>/Регулярность/.test(n.querySelector('.metric-copy')?.textContent||''));
    assert.ok(regularity,'Regularity metric remains in the empty template');
    assert.ok(regularity.classList.contains('metric-row-grouped'));
    assert.ok(regularity.classList.contains('metric-row-nested'),'Regularity keeps its nested indentation');
    assert.equal(regularity.querySelector('.metric-status-label').textContent,'100%','Informational regularity carries the fully earned Q2 value');
    for(const code of ['attract.nastroena_otchetnostь','attract.regulyarnostь','churn.nastroena_otchetnostь','churn.regulyarnostь']){const row=doc.getElementById(metricDomId(code));assert.equal(row.querySelector('.metric-status-label').textContent,'100%');assert.ok(row.querySelector('.metric-light-success'));assert.ok(!row.querySelector('.metric-actual-growth'),'Unchanged full reporting scores do not invent growth');assert.ok(!row.querySelector('.metric-digital-trace-confirmation'),'Carried reporting scores do not invent digital confirmation');}
    for(const code of ['attract.report_completeness','churn.report_completeness'])assert.equal(doc.getElementById(metricDomId(code)).querySelector('.metric-value-label').textContent,'—','Q2 partial and zero reporting scores remain unknown in Q3');
    const ab=doc.getElementById(metricDomId('hyp.ab_tests'));assert.ok(ab);assert.equal(ab.querySelector('.metric-value-label').textContent,'—','A/B plan status is not carried into Q3 yet');

    for(const label of doc.querySelectorAll('.metric-value-label'))assert.ok(!/Набрано|\d+%/.test(label.textContent));
    const knownCodes=['attract.campaign_launches','attract.nalichie_self_service','attract.nalichie_uspeshnyh_biznes_zapuskov'];
    for(const code of knownCodes){
      const row=doc.getElementById(metricDomId(code));assert.ok(row,code);
      assert.equal(row.querySelector('.metric-status-label').textContent,'100%');
      assert.ok(row.querySelector('.metric-light-success'));
      assert.ok(row.querySelector('.metric-digital-trace-confirmation'),'Imported metric has digital evidence badge');
    }
    const research=doc.getElementById(metricDomId('hyp.datadriven_rating_7_5'));assert.ok(research);assert.equal(research.querySelector('.metric-status-label').textContent,'100%');assert.ok(!research.querySelector('.metric-digital-trace-confirmation'),'Research assessment does not invent a digital-trace badge');assert.doesNotMatch(research.textContent,/7[,.]75/,'Raw average remains JSON-only; the row retains the Q2 presentation');
    for(const element of research.querySelectorAll('[aria-label],[title]'))assert.doesNotMatch(`${element.getAttribute('aria-label')||''} ${element.getAttribute('title')||''}`,/7[,.]75/);
    const draft=doc.getElementById(metricDomId('attract.chernoviki_v_sbol_70'));assert.ok(draft);
    assert.equal(draft.querySelector('.metric-status-label').textContent,'50%','User-confirmed deposits draft assessment is half a point');
    assert.ok(draft.querySelector('.metric-light-warning'));
    assert.ok(draft.querySelector('.metric-digital-trace-confirmation'),'Draft half score still has source confirmation');
    const draftAdvice=draft.querySelector('.metric-index-uplift-trigger');assert.ok(draftAdvice);draftAdvice.click();await pause();
    const draftPopup=doc.querySelector('.metric-index-uplift-popup-content');assert.ok(draftPopup);assert.equal(draftPopup.querySelector('p').textContent,'Увеличить покрытие черновиков');draftAdvice.click();await new Promise(r=>setTimeout(r,180));
    const cross=doc.getElementById(metricDomId('mehaniki.cross_sell'));assert.ok(cross);
    assert.equal(cross.querySelector('.metric-status-label').textContent,'50%');
    assert.equal(cross.querySelector('.metric-digital-trace-confirmation').getAttribute('aria-label'),'Проверено на цифровых следах');
    assert.ok([...cross.querySelectorAll('a')].some(a=>a.href===freshCrosssell.crosssellTool.button.link));
    assert.equal(doc.querySelectorAll('.metric-digital-trace-confirmation').length,5);
    const previewAction=cross.querySelector('.metric-ai-actions-buttons button');assert.ok(previewAction,'Fresh cross-sell recommendation action is accessible');previewAction.click();await pause();
    const preview=doc.querySelector('.crosssell-preview-dialog');assert.ok(preview);
    assert.doesNotMatch(preview.textContent,/\b(?:seen|pairs|API)\b|по фильтру|nature=|status=/i,'Business-facing preview does not expose technical scoring terminology');
    for(const element of cross.querySelectorAll('[aria-label],[title]'))assert.doesNotMatch(`${element.getAttribute('aria-label')||''} ${element.getAttribute('title')||''}`,/\b(?:seen|pairs|API)\b|по фильтру|nature=|status=/i);
    const crossRecommendationText='Проработать механики кросс-продаж';assert.ok(preview.textContent.includes(freshCrosssell.crosssellRecommendations[0].recommendations[0]),'Current API recommendation summary is actually displayed');
    assert.ok([...preview.querySelectorAll('a')].some(a=>a.href===freshCrosssell.crosssellTool.button.link));
    [...preview.querySelectorAll('button')].find(b=>b.textContent.trim()==='Закрыть').click();await new Promise(r=>setTimeout(r,180));
    assert.ok(!doc.querySelector('.crosssell-preview-dialog'));
    for(const code of [...knownCodes,'attract.chernoviki_v_sbol_70']){const quarter=code==='attract.nalichie_uspeshnyh_biznes_zapuskov'?2:3;const note=doc.getElementById(metricDomId(code)).querySelector('.metric-digital-trace-confirmation').getAttribute('aria-label');assert.ok(note.includes(`за ${quarter}Q`));assert.ok(!note.includes('за 1Q'));}
    const attraction=doc.getElementById(metricDomId(knownCodes[0])).closest('.metric-block');
    const links=[...attraction.querySelectorAll('.block-links a')].map(a=>a.href);
    for(const id of ['1000003057','1000000687','1000003969'])assert.ok(links.includes(`https://navigator.sigma.sbrf.ru/gdash/${id}`),'Restored attraction reference link');
    assert.ok([...attraction.querySelectorAll('.block-links-title')].some(n=>n.textContent==='Где посмотреть'));
    const previous=attraction.querySelector('.participant-links');assert.ok(previous);
    assert.equal(previous.querySelector('.block-links-title').textContent,'Ссылки из самооценки · II кв. 2026');
    assert.equal(previous.querySelector('a').href,'https://example.ru/previous-participant');
    const recCard=doc.querySelector('.top-recommendations');const recommendations=[...recCard.querySelectorAll('.top-recommendation')];
    const draftRecommendation=recommendations.find(r=>r.textContent.includes('Увеличить покрытие черновиков'));assert.ok(draftRecommendation,'Draft recommendation retains exact Q2 source wording');
    assert.match(draftRecommendation.querySelector('.recommendation-uplift').textContent,/1[,.]9/);
    const crossRecommendation=recommendations.find(r=>r.textContent.includes(crossRecommendationText));assert.ok(crossRecommendation,'Existing Q2 recommendation wording is retained with the Q3 gap');assert.match(crossRecommendation.querySelector('.recommendation-uplift').textContent,/1[,.]9/);assert.equal(recommendations.length,2);
    assert.ok(recommendations.every(r=>/черновик/i.test(r.textContent)||r.textContent.includes(crossRecommendationText)),'No unknown metric recommends an improvement');
    const allRecommendations=[...recCard.querySelectorAll('button')].find(n=>n.textContent.startsWith('Все рекомендации'));assert.ok(allRecommendations);allRecommendations.click();await pause();
    const dialog=doc.querySelector('[role="dialog"]');assert.ok(dialog);assert.equal(dialog.querySelectorAll('.dialog-recommendation').length,recommendations.length);
    const close=dialog.querySelector('button[aria-label*="Закрыть"],button[aria-label*="Close"]');
    if(close)close.click();else doc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
    await new Promise(r=>setTimeout(r,200));assert.ok(!doc.querySelector('[role="dialog"]'),'Recommendations dialog closes');

    const allGains=[...doc.querySelectorAll('.metric-actual-growth:not(.metric-index-uplift-negative)')];assert.equal(allGains.length,3,'Drafts, successful business launches and research assessment improved');
    assert.ok(allGains.some(g=>g.closest('.metric-row').id===research.id));
    assert.ok(allGains.some(g=>g.closest('.metric-row').id===draft.id));
    const gains=allGains.filter(g=>g.closest('.metric-row').id===metricDomId('attract.nalichie_uspeshnyh_biznes_zapuskov'));
    assert.ok(gains[0].closest('.metric-row').id===metricDomId('attract.nalichie_uspeshnyh_biznes_zapuskov'));
    assert.match(gains[0].textContent,/1[,.]9/);
    const explanation=gains[0].closest('[aria-label]').getAttribute('aria-label');assert.ok(explanation);
    assert.equal(explanation,'Изменение к прошлому кварталу');
    const growthButton=gains[0].closest('button');assert.ok(growthButton,'Growth badge is a keyboard-accessible native button');
    assert.equal(growthButton.getAttribute('aria-label'),'Изменение к прошлому кварталу');
    assert.equal(doc.querySelectorAll('.metric-growth-confetti').length,0);
    growthButton.click();await pause();
    const burst=doc.querySelector('.metric-growth-confetti');assert.ok(burst,'Click launches the particle burst');
    const particles=[...burst.querySelectorAll('.metric-growth-confetti-particle')];assert.equal(particles.length,48);
    const firstTrajectories=particles.map(p=>p.style.cssText);
    for(const particle of particles)assert.ok([3,4,5].includes(parseFloat(particle.style.getPropertyValue('--metric-growth-size'))));
    assert.ok(particles.some(p=>parseFloat(p.style.getPropertyValue('--metric-growth-x'))>0));
    assert.ok(particles.some(p=>parseFloat(p.style.getPropertyValue('--metric-growth-x'))<0));
    assert.ok(particles.some(p=>parseFloat(p.style.getPropertyValue('--metric-growth-y'))>0));
    assert.ok(particles.some(p=>parseFloat(p.style.getPropertyValue('--metric-growth-y'))<0));
    assert.equal(burst.querySelectorAll('svg,rect,canvas').length,0,'Burst consists of small dots, not star icons');
    assert.equal(doc.querySelectorAll('.leader-confetti').length,0);
    growthButton.click();await pause();
    assert.equal(doc.querySelectorAll('.metric-growth-confetti').length,2,'Repeated clicks layer independent bursts');
    assert.ok(burst.isConnected,'The original burst keeps playing');
    assert.deepEqual([...burst.querySelectorAll('.metric-growth-confetti-particle')].map(p=>p.style.cssText),firstTrajectories,'New clicks preserve existing particle trajectories');
    const nextBurst=[...doc.querySelectorAll('.metric-growth-confetti')].find(b=>b!==burst);
    assert.notDeepEqual([...nextBurst.querySelectorAll('.metric-growth-confetti-particle')].map(p=>p.style.cssText),firstTrajectories,'Every burst gets a fresh random pattern');
    assert.equal(doc.querySelectorAll('.metric-growth-confetti-particle').length,96);


    assert.equal(doc.querySelectorAll('.metric-action-link,.metric-crosssell-unconfirmed-warning').length,0);
    assert.equal(doc.querySelector('.notice').textContent,'Значение индекса может корректироваться в зависимости от валидации источников и точечного аудита');
    assert.equal(doc.querySelectorAll('.notice b').length,1);
    assert.equal(doc.querySelectorAll('.notice span').length,0);
    for(const score of doc.querySelectorAll('.dd-metric-block-score strong'))assert.equal(score.textContent,'—');
    assert.ok(!doc.querySelector('.detail-page').textContent.includes('Набрано 0.00 баллов из 0.00'));
    const before=doc.querySelector('.detail-header').textContent;await new Promise(r=>setTimeout(r,300));
    assert.equal(doc.querySelector('.detail-header').textContent,before,'Selection effect has converged');
    doc.querySelector('.detail-team-select [role="combobox"]').click();await pause();
    const search=doc.querySelector('input[placeholder="Найти команду"]');assert.ok(search);
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(search,'ДСЖ ПК');search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await pause();
    const dsj=[...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()==='ДСЖ ПК');assert.ok(dsj);dsj.click();await pause();
    const detailedAgain=[...doc.querySelectorAll('button')].find(n=>n.textContent.trim()==='Подробно');detailedAgain.click();await pause();
    const notApplicable=doc.getElementById(metricDomId('attract.campaign_launches'));assert.ok(notApplicable);
    assert.equal(notApplicable.querySelector('.metric-status-label').textContent,'Не применимо','Prior non-applicability stays explicit in Q3');
    assert.ok(!notApplicable.textContent.includes('0%'));

    doc.querySelector('.detail-team-select [role="combobox"]').click();await pause();
    const sharedSearch=doc.querySelector('input[placeholder="Найти команду"]');assert.ok(sharedSearch);
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(sharedSearch,'КАСКО');sharedSearch.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await pause();
    const sharedOption=[...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()==='КАСКО');assert.ok(sharedOption);sharedOption.click();await pause();
    const sharedDetails=[...doc.querySelectorAll('button')].find(n=>n.textContent.trim()==='Подробно');sharedDetails.click();await pause();
    const discovery=doc.getElementById(metricDomId('hyp.discovery_40_backlog'));assert.ok(discovery);assert.ok([...discovery.querySelectorAll('button')].some(b=>b.textContent.includes('Декомпозиция бэклога')),'A Q3 shared-board member exposes the existing backlog action even with unknown assessment');

    [...discovery.querySelectorAll('button')].find(b=>b.textContent.includes('Декомпозиция бэклога')).click();await wait(()=>doc.querySelector('.backlog-page'));
    const chooseBacklog=async(label,text)=>{const control=doc.querySelector(`[role="combobox"][aria-label="${label}"]`);assert.ok(control,label);control.click();await pause();const option=[...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===text);assert.ok(option,text);option.click();await pause();};
    const boardSelector=()=>doc.querySelector('[role="combobox"][aria-label="Команда"]');assert.equal(boardSelector().textContent.trim(),'КАСКО','Profile entry selects its individual shared-board member');
    boardSelector().click();await pause();const boardOptions=[...doc.querySelectorAll('[role="option"]')].map(n=>n.textContent.trim());assert.equal(boardOptions.length,15);assert.ok(boardOptions.includes('КАСКО'));assert.ok(boardOptions.includes('ОСАГО'));assert.ok(!boardOptions.some(n=>n==='КАСКО, ОСАГО'||n.includes('Переводы по РФ,')));doc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await pause();
    assert.match(doc.querySelector('.backlog-goal-card').textContent,/из 119 созданных задач/);
    const quarterControl=()=>doc.querySelector('[role="combobox"][aria-label="Квартал"]');const sameQuarter=quarterControl().textContent;
    await chooseBacklog('Направление графика','Неизвестно');
    await chooseBacklog('Команда','ОСАГО');assert.equal(boardSelector().textContent.trim(),'ОСАГО');assert.equal(quarterControl().textContent,sameQuarter);assert.equal(doc.querySelector('[role="combobox"][aria-label="Направление графика"]').textContent.trim(),'Неизвестно','Same-board member changes preserve graph filter');assert.match(doc.querySelector('.backlog-goal-card').textContent,/из 119 созданных задач/);
    [...doc.querySelectorAll('button')].find(b=>b.textContent.trim()==='Назад к карточке команды').click();await pause();assert.equal(doc.querySelector('.detail-team-select [role="combobox"]').textContent.trim(),'ОСАГО','Reverse navigation follows the chosen member even though the previous profile was КАСКО');
    const osagoDetailed=[...doc.querySelectorAll('button')].find(b=>b.textContent.trim()==='Подробно');osagoDetailed.click();await pause();const osagoDiscovery=doc.getElementById(metricDomId('hyp.discovery_40_backlog'));[...osagoDiscovery.querySelectorAll('button')].find(b=>b.textContent.includes('Декомпозиция бэклога')).click();await wait(()=>doc.querySelector('.backlog-page'));assert.equal(boardSelector().textContent.trim(),'ОСАГО','Profile ОСАГО re-entry preserves its individual option');[...doc.querySelectorAll('button')].find(b=>b.textContent.trim()==='Назад к карточке команды').click();await pause();

    const summary=[...doc.querySelectorAll('button')].find(n=>n.textContent.trim()==='Назад к Summary');assert.ok(summary);summary.click();await pause();
    assert.ok(doc.querySelector('.dashboard-page'));
    assert.equal(doc.querySelectorAll('.metric-growth-confetti').length,0,'Leaving profile cleans up the burst');

    assert.deepEqual(errors,[]);
    assert.ok(requests.every(url=>!/^https?:/.test(url)),'No external data is requested');
  }finally{dom.window.close();}
});
