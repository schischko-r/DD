import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {otherTeamProfiles} from './other-team-profiles.js';
import {displayTeamName} from './teams.js';
for (const kind of ['channels', 'segments']) test(`${kind} standalone HTML filters teams, clears changed-team state and completes a real UI route`, async () => {
  const html = readFileSync(new URL(`../../dist-other-surveys/${kind}/${kind}-survey.html`, import.meta.url), 'utf8');
  const errors = [];
  const script = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)[1];
  const dom = new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/, ''), {runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/', beforeParse(window) {
    window.scrollTo = () => {};
    window.matchMedia = () => ({matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}});
    window.ResizeObserver = class {observe(){} unobserve(){} disconnect(){}};
    window.fetch = () => {throw new Error('Unexpected request');};
    window.addEventListener('error', event => errors.push(event.message));
  }});
  dom.window.eval(script);
  const pause = () => new Promise(resolve => setTimeout(resolve, 25));
  const doc = dom.window.document;
  const write = async (control, value) => {
    assert.ok(control, 'Input exists');
    const prototype = control.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control,value);
    control.dispatchEvent(new dom.window.Event('input',{bubbles:true})); await pause();
  };
  const button = text => [...doc.querySelectorAll('button')].find(item => item.textContent.trim() === text || item.textContent.trim().startsWith(text));
  const click = async text => {assert.ok(button(text), `Button ${text}`); button(text).click(); await pause();};
  const chooseTeam = async name => {
    doc.querySelector('[role="combobox"]').click(); await pause();
    const search = doc.querySelector('input[placeholder="Поиск команды"]');
    await write(search,name);
    const option = [...doc.querySelectorAll('[role="option"], .g-select-list__option, .g-list__item')].find(item=>item.textContent.trim()===name);
    assert.ok(option, `Team ${name}`); option.click(); await pause();
  };
  try {
    await pause();
    doc.querySelector('[role="combobox"]').click(); await pause();
    const visibleOptions = [...doc.querySelectorAll('[role="option"]')].filter(item=>!item.querySelector('.survey-team-unit')).map(item=>item.textContent.trim());
    const expected = Object.values(otherTeamProfiles).filter(profile=>profile.type === (kind==='channels'?'Канал':'Сегмент'));
    assert.equal(expected.length, kind==='channels'?9:7);
    assert.deepEqual(new Set(visibleOptions),new Set(expected.map(profile=>displayTeamName(profile.name))));
    doc.querySelector('[role="combobox"]').click(); await pause();
    await write(doc.querySelector('input[placeholder="Введите ФИО"]'),'  Тестовый респондент  ');
    const finalTeam = expected.find(profile=>profile.name === (kind==='channels'?'Колл-центр':'Дети'));
    const initial = kind==='channels' ? expected.find(profile=>profile.name==='Единый личный кабинет (ЕЛК)') : expected.find(profile=>profile.teamId!==finalTeam.teamId);
    await chooseTeam(displayTeamName(initial.name));
    await click('Далее');
    if(kind==='segments') {doc.querySelector('.survey-single-question input[type="radio"]').click(); await pause();}
    const initialNumber=doc.querySelector('input[inputmode="numeric"], input[inputmode="decimal"]');
    assert.ok(initialNumber, 'Initial team has numeric metrics');
    await write(initialNumber,'314159');
    await click('Назад');
    await chooseTeam(displayTeamName(finalTeam.name));
    assert.equal(dom.window.DDI_SURVEY_RESULT_JSON,null);
    await click('Далее');
    if(kind==='segments') {
      assert.ok(!doc.querySelector('.survey-single-question input[type="radio"]:checked'),'Changing teams clears knowledge choice');
      assert.ok(!doc.querySelector('input[inputmode="numeric"], input[inputmode="decimal"]'),'Value stays hidden until new knowledge choice');
      doc.querySelector('.survey-single-question input[type="radio"]').click(); await pause();
    }
    if(kind==='segments') assert.equal(doc.querySelector('input[inputmode="numeric"], input[inputmode="decimal"]')?.value,'', 'Changing teams clears old metric input');
    else {assert.equal(doc.querySelector('.survey-single-question').dataset.questionId,'goalsMonitoring');assert.equal(doc.querySelector('input[inputmode="numeric"], input[inputmode="decimal"]'),null);}
    let iterations=0;
    let goalLinks;
    while (!button('Завершить опрос')) {
      assert.ok(iterations++ < 50, 'Finite survey route');
      const step = doc.querySelector('.survey-single-question');
      assert.ok(step, 'Question screen');
      const id = step.dataset.questionId;
      if (kind === 'segments' && ['attractIncludes','churnIncludes'].includes(id)) {
        const expected = id === 'attractIncludes'
          ? ['Источники привлечения (самоходы, внешние привлечения, кампейнинг, кросс-перетоки)','Пошаговая воронка (CJM клиентский путь)','Механики привлечения']
          : ['Предоттоковые клиенты','% оттока','Объёмы'];
        const known = [...step.querySelectorAll('.survey-known-funnel')];
        assert.deepEqual(known.map(node=>node.textContent.replace('Уже имеются','').trim()),expected);
        for(const node of known) {
          assert.equal(node.querySelector('input').disabled,true);
          assert.equal(node.querySelector('input').checked,true);
        }
      }
      if(kind === 'channels' && id === 'entryIncludes') {
        const expected=['% автоматизации','% отложенных обращений','% закрытых обращений','CSAT','FCR'];
        const known=[...step.querySelectorAll('.survey-known-funnel')];
        assert.deepEqual(known.map(node=>node.textContent.replace('Уже имеются','').trim()),expected);
        for(const node of known) {
          assert.equal(node.querySelector('input').disabled,true);
          assert.equal(node.querySelector('input').checked,true);
        }
      }
      if(kind === 'channels' && id === 'otherMechanics') {
        const known=[...step.querySelectorAll('.survey-known-mechanic')].map(node=>node.textContent.replace('Уже настроено','').trim());
        for(const label of ['Автоматизация: классификация обращений, распределение очередей, сплитов и лидов','Информирования клиента о статусе обращения','Персонализация скриптов','Контроля качества речи']) assert.ok(known.includes(label),`Call-center known mechanic: ${label}`);
      }
      if(kind === 'segments' && id === 'otherMechanics') {
        const known=[...step.querySelectorAll('.survey-known-mechanic')].map(node=>node.textContent.replace('Уже настроено','').trim());
        for(const label of ['Персонализации клиентского опыта','Привлечение клиентов']) assert.ok(known.includes(label));
        assert.ok(!step.textContent.includes('Как работает механика персонализации клиентского опыта?'));
      }
      if(kind==='segments' && id.endsWith('Knowledge')) {
        const parentRadios=[...step.querySelectorAll('input[type="radio"]')].slice(0,3);
        assert.equal(parentRadios.length,3);
        parentRadios[0].click(); await pause();
        const numeric=step.querySelector('input[inputmode="numeric"], input[inputmode="decimal"]');
        assert.ok(numeric,'First knowledge choice reveals number');
        assert.equal(step.querySelectorAll('.survey-metric-unknown input[type="checkbox"]').length,1,'Numeric knowledge offers its own Unknown alternative');
        await write(numeric,'120');
        step.querySelector('input[type="radio"][value="Затрудняюсь ответить"]').click(); await pause();
        if(id==='activeClientsKnowledge') {
          const comment=step.querySelector('textarea');
          assert.ok(comment,'Optional numeric comment available');
          await write(comment,'Скрытый старый комментарий');
          for(const index of [1,2]) {
            parentRadios[index].click(); await pause();
            assert.ok(!step.querySelector('input[inputmode="numeric"], input[inputmode="decimal"]'));
            assert.ok(!step.querySelector('textarea'));
            assert.ok(!step.textContent.includes('Где вы смотрите этот показатель?'));
            assert.equal(button('Далее').getAttribute('aria-disabled'),'false','Second and third choices require no hidden data');
          }
          parentRadios[1].click(); await pause();
        }
      } else if (id==='goalsMonitoring') {
        step.querySelector('input[value="Да (включены все цели)"]').click(); await pause();
        const cards=[...step.querySelectorAll('.survey-goals-question')];
        assert.equal(cards.length,2);
        for (const card of cards) {card.querySelector('input[value="Нет"]').click(); await pause();}
        const first = step.querySelector('.survey-link-fields input');
        await write(first,'  example.ru/targets  ');
        await click('Добавить ещё');
        const fields=[...step.querySelectorAll('.survey-link-fields input')];
        assert.equal(fields.length,2);
        await write(fields[1],'https://example.com/forecast');
        goalLinks='  example.ru/targets  \nhttps://example.com/forecast';
        step.querySelector('input[value="excel"]').click(); await pause();
        assert.ok(!doc.body.textContent.includes('Адреса и тема письма'));
        assert.ok(!doc.body.textContent.includes('направьте отчетность'));
        step.querySelector('input[value="link"]').click(); await pause();
        const restored=[...step.querySelectorAll('.survey-link-fields input')];
        await write(restored[0],'  example.ru/targets  ');
        if(restored.length<2) await click('Добавить ещё');
        await write([...step.querySelectorAll('.survey-link-fields input')][1],'https://example.com/forecast');
        goalLinks=[...step.querySelectorAll('.survey-link-fields input')].map(input=>input.value).join('\n');
      } else {
        const numeric = step.querySelector('input[inputmode="numeric"], input[inputmode="decimal"]');
        if (numeric) {
          await write(numeric,'120');
          const source = step.querySelector('input[type="radio"][value="Затрудняюсь ответить"]');
          assert.ok(source); source.click(); await pause();
        } else {
          for (let pass=0; pass<3; pass++) {
            const groups=[...step.querySelectorAll('.survey-radio')];
            for (const group of groups) {
              const inputs=[...group.querySelectorAll('input[type="radio"]')];
              if (!inputs.length || inputs.some(input=>input.checked)) continue;
              const chosen=inputs.find(input=>input.value==='Нет') || inputs.find(input=>input.value==='Затрудняюсь ответить') || inputs[0];
              chosen.click(); await pause();
            }
            const checks=[...step.querySelectorAll('input[type="checkbox"]')];
            if(checks.length && !checks.some(input=>input.checked && !input.disabled)) {
              const chosen=checks.find(input=>input.closest('label')?.textContent.trim()==='Затрудняюсь ответить') || checks.find(input=>input.closest('label')?.textContent.trim()==='Не проводился') || checks.find(input=>!input.disabled);
              if(chosen) {chosen.click(); await pause();}
            }
          }
        }
        for(const field of step.querySelectorAll('input[type="url"]')) if(!field.value) await write(field,'example.ru/report');
        for(const field of step.querySelectorAll('textarea')) if(!field.value) await write(field,'  Комментарий\nСохранить точно  ');
      }
      assert.ok(!doc.body.textContent.includes('Адреса и тема письма'));
      await click('Далее');
      assert.ok(!doc.querySelector('.survey-validation-message'), `Valid step ${id}`);
      assert.notEqual(doc.querySelector('.survey-single-question')?.dataset.questionId,id, `Advance ${id}: ${step.textContent}; ${[...step.querySelectorAll('input')].map(input=>`${input.type}:${input.value}:${input.checked}`).join('|')}`);
    }
    await click('Завершить опрос');
    const result=JSON.parse(dom.window.DDI_SURVEY_RESULT_JSON);
    assert.equal(result.team.id,finalTeam.teamId);
    assert.equal(result.respondent.name,'  Тестовый респондент  ');
    assert.equal(result.answers.goalsDashboards,goalLinks);
    assert.equal(result.result.baselinePeriod,finalTeam.period);
    assert.equal(result.result.requiresBackendReview,true);
    if(kind==='segments') {
      assert.equal(result.answers.activeClientsKnowledge,'Знаю что за метрика, но актуального значения нет под рукой');
      for(const field of ['activeClients','activeClientsSource','activeClientsSourceLink','activeClientsComment','activeClientsUnknown']) {
        assert.ok(!(field in result.answers),`Hidden knowledge field excluded: ${field}`);
        assert.ok(!(field in result.questionSources),`Hidden metadata excluded: ${field}`);
      }
    }
    assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('Digital and Phygital channels start at goals and clear goals when changing teams', async () => {
  const html=readFileSync(new URL('../../dist-other-surveys/channels/channels-survey.html',import.meta.url),'utf8');
  const script=html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)[1];
  const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/,''),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};}});
  dom.window.eval(script);const doc=dom.window.document;
  const pause=()=>new Promise(r=>setTimeout(r,25));
  const write=async(input,value)=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await pause();};
  const click=async text=>{const b=[...doc.querySelectorAll('button')].find(n=>n.textContent.trim().startsWith(text));assert.ok(b,text);b.click();await pause();};
  try {
    await pause();await write(doc.querySelector('input[placeholder="Введите ФИО"]'),'Проверка каналов');
    for(const name of ['СберKids','Колл-центр']) {
      doc.querySelector('[role="combobox"]').click();await pause();await write(doc.querySelector('input[placeholder="Поиск команды"]'),name);
      [...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===name).click();await pause();await click('Далее');
      const step=doc.querySelector('.survey-single-question');
      assert.equal(step.dataset.questionId,'goalsMonitoring');
      assert.equal(step.querySelector('input[inputmode="numeric"],input[inputmode="decimal"]'),null);
      assert.ok(!step.querySelector('input[type="radio"]:checked'),'Team change clears goals');
      step.querySelector('input[value="Нет"]').click();await pause();
      await click('Назад');
    }
  }finally{dom.window.close();}
});

test('ELK quality tools show two historical checks, editable KKD and the retained report link', async () => {
  const html=readFileSync(new URL('../../dist-other-surveys/channels/channels-survey.html',import.meta.url),'utf8');
  const script=html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)[1];
  const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/,''),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};}});
  dom.window.eval(script);
  const doc=dom.window.document;
  const pause=()=>new Promise(resolve=>setTimeout(resolve,25));
  const write=async(input,value)=>{Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await pause();};
  const button=text=>[...doc.querySelectorAll('button')].find(n=>n.textContent.trim().startsWith(text));
  const click=async text=>{assert.ok(button(text),text);button(text).click();await pause();};
  try {
    await pause();await write(doc.querySelector('input[placeholder="Введите ФИО"]'),'Проверка ЕЛК');
    doc.querySelector('[role="combobox"]').click();await pause();
    await write(doc.querySelector('input[placeholder="Поиск команды"]'),'Единый личный кабинет');
    [...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()==='Единый личный кабинет (ЕЛК)').click();await pause();
    await click('Далее');
    let steps=0;
    while(doc.querySelector('.survey-single-question').dataset.questionId!=='qualityTools') {
      assert.ok(steps++<12,'Reach quality tools');
      const step=doc.querySelector('.survey-single-question');
      const oldId=step.dataset.questionId;
      if(step.querySelector('input[inputmode="numeric"],input[inputmode="decimal"]')) {
        step.querySelector('.survey-metric-unknown input').click();await pause();
        step.querySelector('input[type="radio"][value="Затрудняюсь ответить"]').click();await pause();
      } else {
        const radios=[...step.querySelectorAll('input[type="radio"]')];
        (radios.find(n=>n.value==='Нет')||radios[0]).click();await pause();
      }
      await click('Далее');assert.notEqual(doc.querySelector('.survey-single-question').dataset.questionId,oldId);
    }
    const step=doc.querySelector('.survey-single-question');
    const known=[...step.querySelectorAll('.survey-known-mechanic')];
    assert.equal(known.length,2);
    for(const item of known){assert.equal(item.querySelector('input').checked,true);assert.equal(item.querySelector('input').disabled,true);}
    assert.deepEqual(known.map(n=>n.textContent.replace('Уже имеются','').trim()),['Ручная проверка аналитиками (сверка с первичными источниками, выгрузки)','Проверка на стороне источника данных (DWH, витрины) силами data-инженеров']);
    const kkd=[...step.querySelectorAll('input[type="checkbox"]')].find(n=>n.closest('label')?.textContent.trim()==='Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе');
    assert.ok(kkd);assert.equal(kkd.disabled,false);assert.equal(kkd.checked,false);
    kkd.click();await pause();assert.equal(kkd.checked,true);
    kkd.click();await pause();assert.equal(kkd.checked,false);
    const uncertain=[...step.querySelectorAll('input[type="checkbox"]')].find(n=>n.closest('label')?.textContent.trim()==='Затрудняюсь ответить');
    assert.ok(uncertain);kkd.click();await pause();uncertain.click();await pause();
    assert.ok(uncertain.checked);assert.equal(kkd.checked,false,'Unknown excludes fresh tool choice');
    assert.equal(button('Далее').getAttribute('aria-disabled'),'false');
    uncertain.click();await pause();assert.equal(uncertain.checked,false);
    assert.equal(step.querySelectorAll('.survey-previous-evidence').length,1,'Historical quality report is shown once after the options');
    const report=step.querySelector('.survey-previous-evidence');
    assert.equal(report.querySelector('h2').textContent,'Приложенные ранее ссылки:');
    assert.equal(report.querySelector('a').href,'https://navigator.sigma.sbrf.ru/gdash/1000004198');
    assert.equal(report.querySelectorAll('.survey-link-fields input').length,0,'No duplicate URL entry for retained link');
    assert.equal(button('Далее').getAttribute('aria-disabled'),'false','Default retained choices and link already complete');
    await click('Скорректировать');
    report.querySelector('input[value="link"]').click();await pause();
    await write(report.querySelector('.survey-link-fields input'),'example.ru/updated-quality');
    assert.equal(button('Далее').getAttribute('aria-disabled'),'false');
    await click('Не требуется корректировки');
    assert.equal(report.querySelectorAll('.survey-link-fields input').length,0);
    await click('Далее');
    assert.notEqual(doc.querySelector('.survey-single-question').dataset.questionId,'qualityTools');
    let remaining=0;
    while(doc.querySelector('.survey-single-question').dataset.questionId!=='otherMechanics') {
      assert.ok(remaining++<25,'Reach ELK mechanics');
      const current=doc.querySelector('.survey-single-question');const id=current.dataset.questionId;
      const radios=[...current.querySelectorAll('input[type="radio"]')];
      if(radios.length){(radios.find(n=>n.value==='Нет')||radios.find(n=>n.value==='Затрудняюсь ответить')||radios[0]).click();await pause();}
      const boxes=[...current.querySelectorAll('input[type="checkbox"]')].filter(n=>!n.disabled);
      if(boxes.length){(boxes.find(n=>n.closest('label')?.textContent.trim()==='Затрудняюсь ответить')||boxes.find(n=>n.closest('label')?.textContent.trim()==='Не проводился')||boxes[0]).click();await pause();}
      for(const input of current.querySelectorAll('textarea'))if(!input.value)await write(input,'Описание');
      for(const input of current.querySelectorAll('input[type="url"]'))if(!input.value)await write(input,'example.ru/report');
      await click('Далее');assert.notEqual(doc.querySelector('.survey-single-question')?.dataset.questionId,id);
    }
    const mechanics=doc.querySelector('.survey-single-question');
    const retained=[...mechanics.querySelectorAll('.survey-known-mechanic')];
    assert.deepEqual(retained.map(n=>n.textContent.replace('Уже настроено','').trim()),['Удержание клиентов']);
    assert.ok(retained[0].querySelector('input').checked);assert.ok(retained[0].querySelector('input').disabled);
    const stimulate=[...mechanics.querySelectorAll('input[type="checkbox"]')].find(n=>n.closest('label')?.textContent.trim()==='Стимулирование клиента (геймификация, пуши, Nudging-механики)');
    assert.ok(stimulate);assert.equal(stimulate.checked,false);assert.equal(stimulate.disabled,false);
    stimulate.click();await pause();assert.ok(stimulate.checked);
    assert.equal(button('Далее').getAttribute('aria-disabled'),'true','Fresh mechanic needs its comment');
    await write(mechanics.querySelector('textarea'),'  Новая механика  ');
    assert.equal(button('Далее').getAttribute('aria-disabled'),'false');
    stimulate.click();await pause();assert.equal(stimulate.checked,false);

  } finally{dom.window.close();}
});

test('campaign performance skips metrics with dashboards and preserves the remaining campaign route', async () => {
  const {getSections}=await import('./questions.js');
  const {previousChannels}=await import('./previous-channels.js');
  const profile=Object.values(otherTeamProfiles).find(p=>p.name==='Персональная рекомендация');
  const history=previousChannels[profile.teamId];
  const ids=['campaignCrPerformance','campaignNpvPerformance','campaignCltvPerformance'];
  const questions=getSections({product:profile.teamId}).flatMap(s=>s.questions);
  const html=readFileSync(new URL('../../dist-other-surveys/channels/channels-survey.html',import.meta.url),'utf8');
  const script=html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)[1];
  const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/,''),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};}});
  dom.window.eval(script);
  const doc=dom.window.document;
  const pause=()=>new Promise(resolve=>setTimeout(resolve,25));
  const write=async(input,value)=>{const proto=input.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await pause();};
  const button=text=>[...doc.querySelectorAll('button')].find(n=>n.textContent.trim().startsWith(text));
  const click=async text=>{assert.ok(button(text),text);button(text).click();await pause();};
  const seen=[];
  try {
    await pause();await write(doc.querySelector('input[placeholder="Введите ФИО"]'),'Проверка кампейнинга');
    doc.querySelector('[role="combobox"]').click();await pause();
    await write(doc.querySelector('input[placeholder="Поиск команды"]'),profile.name);
    [...doc.querySelectorAll('[role="option"]')].find(n=>n.textContent.trim()===displayTeamName(profile.name)).click();await pause();await click('Далее');
    let steps=0;
    while(!button('Завершить опрос')) {
      assert.ok(steps++<50,'Campaign route completes');
      const step=doc.querySelector('.survey-single-question');
      const id=step.dataset.questionId;
      assert.notEqual(id,'campaignReporting');
      assert.ok(!['campaignTriggerShare','campaignDeliveredShare','campaignT2m','campaignSuccessfulPilotShare'].includes(id));
      const input=step.querySelector('input[inputmode="numeric"],input[inputmode="decimal"]');
      if(ids.includes(id)) {
        const index=ids.indexOf(id);seen.push(id);
        const q=questions.find(q=>q.id===id);
        assert.equal(step.querySelector('[aria-label="Ответ из прошлого опроса"]'),null);
        assert.equal(step.querySelector('.survey-previous-numeric'),null);
        assert.ok(!step.textContent.includes('Использовать прежние ссылки'));
        assert.equal(input.value,'','Historical number never prefills the current answer');
        const radios=[...step.querySelectorAll('input[type="radio"]')];
        assert.ok(!radios.some(n=>n.checked),'Source must be selected afresh');
        await write(input,['82,25','99,5','113'][index]);
        assert.equal(button('Далее').getAttribute('aria-disabled'),'true','Number alone cannot complete the question');
        step.querySelector('input[type="radio"][value="Дашборд в Навигаторе"]').click();await pause();
        const link=step.querySelector('.survey-link-fields input');
        assert.equal(link.value,'','Old links are not prefilled');
        await write(link,`  example.ru/current-performance-${index}  `);
      } else if(id==='qualityTools') {
        const known=[...step.querySelectorAll('.survey-known-funnel')];
        assert.deepEqual(known.map(n=>n.textContent.replace('Уже имеются','').trim()),['Собственная система мониторинга качества данных','Проверка на стороне источника данных (DWH, витрины) силами data-инженеров']);
        for(const item of known){assert.ok(item.querySelector('input').checked);assert.ok(item.querySelector('input').disabled);}
        const kkd=[...step.querySelectorAll('input[type="checkbox"]')].find(n=>n.closest('label')?.textContent.trim()==='Встроенные дашборды и алерты по качеству данных (ККД) в Навигаторе');
        assert.ok(kkd);assert.equal(kkd.checked,false);assert.equal(kkd.disabled,false);
        assert.equal(step.querySelectorAll('.survey-previous-evidence a').length,0);
        const uncertain=[...step.querySelectorAll('input[type="checkbox"]')].find(n=>n.closest('label')?.textContent.trim()==='Затрудняюсь ответить');
        assert.ok(uncertain);kkd.click();await pause();uncertain.click();await pause();
        assert.ok(uncertain.checked);assert.equal(kkd.checked,false,'Unknown excludes fresh tool choice');
        assert.equal(button('Далее').getAttribute('aria-disabled'),'false');
        uncertain.click();await pause();assert.equal(uncertain.checked,false);
        assert.equal(button('Далее').getAttribute('aria-disabled'),'false','Known non-dashboard tools need no source');
        assert.equal(step.querySelector('.survey-inline-evidence'),null);
        kkd.click();await pause();
        assert.equal(button('Далее').getAttribute('aria-disabled'),'true','Navigator choice requires source');
        assert.ok(step.textContent.includes('Пожалуйста, приложите ссылки на дашборды'));
        assert.ok(!step.querySelector('input[type="radio"][value="excel"]'));
        step.querySelector('input[type="radio"][value="link"]').click();await pause();
        await write(step.querySelector('.survey-link-fields input'),'example.ru/quality-tools');
        assert.equal(button('Далее').getAttribute('aria-disabled'),'false');
      } else if(input) {
        await write(input,'120');
        step.querySelector('input[type="radio"][value="Затрудняюсь ответить"]').click();await pause();
      } else {
        const radios=[...step.querySelectorAll('input[type="radio"]')];
        if(radios.length){(radios.find(n=>n.value==='Нет')||radios.find(n=>n.value==='Нет аналитиков')||radios.find(n=>n.value==='Затрудняюсь ответить')||radios[0]).click();await pause();}
        const boxes=[...step.querySelectorAll('input[type="checkbox"]')].filter(n=>!n.disabled);
        if(boxes.length){(boxes.find(n=>n.closest('label')?.textContent.trim()==='Затрудняюсь ответить')||boxes.find(n=>n.closest('label')?.textContent.trim()==='Не проводился')||boxes[0]).click();await pause();}
      }
      for(const text of step.querySelectorAll('textarea'))if(!text.value)await write(text,'Описание');
      for(const url of step.querySelectorAll('input[type="url"]'))if(!url.value)await write(url,'example.ru/report');
      await click('Далее');
      assert.notEqual(doc.querySelector('.survey-single-question')?.dataset.questionId,id,`Advance ${id}`);
    }
    assert.deepEqual(seen,[]);await click('Завершить опрос');
    const result=JSON.parse(dom.window.DDI_SURVEY_RESULT_JSON);
    for(const [index,id] of ids.entries()) {
      const q=questions.find(q=>q.id===id);
      if (!q) {assert.equal(result.answers[id],undefined);continue;}
      assert.equal(result.answers[id],['82,25','99,5','113'][index]);
      assert.equal(result.answers[`${q.inlineProof.id}Link`],`  example.ru/current-performance-${index}  `);
    }
    assert.equal(result.answers.qualityToolsReport,'example.ru/quality-tools');
    assert.equal(result.answers.campaignReporting,undefined);
    assert.equal(result.answers.campaignReport,undefined);
    assert.deepEqual(result.previousAnswers,history);
  }finally{dom.window.close();}
});
