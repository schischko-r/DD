import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JSDOM, VirtualConsole} from 'jsdom';
import {formatNumber} from './report-model.js';

const data=JSON.parse(readFileSync(new URL('../../../outputs/ddi-funnel-levels-2026-11-10/report-data.json',import.meta.url),'utf8'));
const text=node=>node.textContent.replace(/\s+/g,' ').trim();
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-8,`${message}: ${actual} != ${expected}`);

async function mount(){
  const html=readFileSync(new URL('../../../outputs/ddi-funnel-analysis-2026-10-20/report/funnel-report.html',import.meta.url),'utf8');
  const errors=[],requests=[],virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>errors.push(error.message));
  virtualConsole.on('error',(...args)=>errors.push(args.join(' ')));
  const dom=new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),{
    runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole,
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
      w.fetch=(...args)=>{requests.push(args);throw new Error('Offline report requested network');};
      w.addEventListener('error',error=>errors.push(error.message));
    },
  });
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length,'Standalone must include its application');
  for(const[,attrs,script]of scripts)if(!/application\/json/.test(attrs))dom.window.eval(script.replaceAll('import.meta.url',JSON.stringify('http://localhost/funnel-report.html')));
  await new Promise(resolve=>setTimeout(resolve,150));
  return {dom,doc:dom.window.document,errors,requests};
}

test('standalone contains only the requested quarter comparisons and works without network access',async()=>{
  const {dom,doc,errors,requests}=await mount();
  try{
    assert.equal(doc.querySelectorAll('script[src],link[rel="stylesheet"][href]').length,0,'Code and styles must be embedded');
    const body=text(doc.body);
    assert.ok(body.includes('Какая доля команд работает хорошо, а какая — плохо'));
    assert.match(body,/выше 80%/);assert.match(body,/ниже 40%/);assert.match(body,/40% и 80% входят в середину/);
    assert.equal(doc.querySelectorAll('.funnel-branch[data-block]').length,2);
    assert.equal(doc.querySelectorAll('.level-card[data-scope][data-block]').length,9);
    assert.equal(doc.querySelectorAll('.level-strip').length,18);
    const campaign=doc.querySelector('.funnel-branch[data-block="attract"] .level-card[data-scope="campaigning"]');
    assert.ok(campaign,'Campaigning belongs in the attraction column');
    assert.equal(text(campaign.querySelector('h3')),'Кампейнинг');
    assert.equal(doc.querySelectorAll('.level-card[data-scope="campaigning"][data-block="churn"]').length,0,'Campaigning must not be added to churn');
    const hierarchy=doc.querySelector('.funnel-hierarchy'),analysis=doc.querySelector('.analysis-comparison');
    assert.ok(analysis,'Analysis must be a separate block below the existing funnel cards');
    assert.ok(hierarchy.compareDocumentPosition(analysis)&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
    assert.deepEqual([...analysis.querySelectorAll('.level-card')].map(card=>card.dataset.block),['attract','churn']);
    assert.deepEqual([...analysis.querySelectorAll('.level-card h3')].map(heading=>text(heading)),['Анализ воронки привлечения','Анализ воронки оттока']);
    assert.equal(doc.querySelectorAll('.actions-comparison,.benchmarks-comparison,.level-card[data-scope="benchmarks"],.level-card[data-scope="actions"]').length,0);
    assert.doesNotMatch(body,/Наличие бенчмарков|Составлен перечень инициатив|Мероприятия по работе с отклонениями/);
    assert.equal(doc.querySelectorAll('.report-filters,.report-hero,.finding,.histogram,.quartiles-card,.teams-card,.percentile-table,[role="dialog"],table,[role="combobox"]').length,0,'Removed sections and controls must not remain');
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});

test('progress bars and III-quarter counts, shares and signed changes agree with each quarter denominator',async()=>{
  const {dom,doc}=await mount();
  try{
    for(const code of ['attract','churn']){
      const branch=doc.querySelector(`.funnel-branch[data-block="${code}"]`);assert.ok(branch,code);
      assert.deepEqual([...branch.querySelectorAll('.level-card')].map(card=>card.dataset.scope),code==='attract'?['total','reporting','completeness','campaigning']:['total','reporting','completeness']);
      for(const scope of ['total','completeness','reporting','analysis',...(code==='attract'?['campaigning']:[])]){
        const source=data.scopes[scope].blocks[code],card=doc.querySelector(`.level-card[data-scope="${scope}"][data-block="${code}"]`);
        assert.ok(card,`${scope}/${code}`);
        for(const period of ['baseline','current']){
          const summary=source[period],quarter=card.querySelector(`.quarter-distribution[data-period="${period}"]`);
          assert.ok(quarter,`${scope}/${code}/${period}`);assert.match(text(quarter),new RegExp(`${summary.n}\\s+команд`));
          const bar=quarter.querySelector(`.level-strip[data-period="${period}"]`);assert.ok(bar?.getAttribute('aria-label'),'Bar needs a textual equivalent');
          let width=0;
          for(const level of summary.levels){
            const segment=bar.querySelector(`.level-segment[data-level="${level.label}"]`);
            if(level.count===0&&!segment)continue;
            assert.ok(segment,`${scope}/${code}/${period}/${level.label}`);
            near(Number.parseFloat(segment.style.width),level.share,'Segment share');width+=Number.parseFloat(segment.style.width);
            assert.ok(segment.getAttribute('title')?.includes(String(level.count)),'Tooltip must state count');
          }
          near(width,summary.n?100:0,'Bar total');
        }
        for(const level of source.current.levels){
          const previous=source.baseline.levels.find(row=>row.label===level.label),delta=level.share-previous.share;
          const line=card.querySelector(`.level-legend > .level-line[data-level="${level.label}"]`);assert.ok(line,`${scope}/${code}/${level.label}`);
          assert.equal(Number(line.dataset.count),level.count);near(Number(line.dataset.share),level.share,'Legend share');near(Number(line.dataset.delta),delta,'Legend delta');
          assert.ok(text(line).includes(`${level.label} (${level.count})`));assert.ok(text(line).includes(`${formatNumber(level.share,1)}%`));assert.ok(text(line).includes('п.п. к II кварталу'));
          const signed=delta<0?'−':delta>0?'+':'',expected=`${signed}${formatNumber(Math.abs(delta),1)}`;
          assert.ok(text(line).replace(/-/g,'−').includes(expected),`Visible signed delta ${expected}: ${text(line)}`);
          const direction=Math.round(delta*10)===0?'neutral':delta>0?'growth':'decline';
          const deltaElement=line.querySelector('.level-delta');
          assert.ok(deltaElement.classList.contains(direction),'Direction must follow growth or decline of the share');
          const tone=direction==='neutral'||level.label==='Посередине'?'neutral'
            :(level.label==='Плохо'?delta<0:delta>0)?'improvement':'deterioration';
          assert.ok(deltaElement.classList.contains(tone),'Colour must reflect improvement: fewer poor teams or more good teams');
          const indicator=deltaElement.querySelector('.delta-indicator');
          assert.equal(indicator?.textContent??'',direction==='neutral'?'':direction==='growth'?'▲':'▼');
          if(indicator)assert.equal(indicator.getAttribute('aria-hidden'),'true');
        }
      }
    }
    assert.match(text(doc.body),/состав/i,'Different quarter cohorts must be disclosed');
  }finally{dom.window.close();}
});
