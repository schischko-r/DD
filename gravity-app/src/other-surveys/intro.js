import {getSections, visibleQuestions, getBacklogAnalyzed, knownMechanics} from './questions.js';
import {otherTeamProfiles} from './other-team-profiles.js';
import {otherMetricApplicable} from './other-team-questions.js';
export {sectionCountText} from '../deposits-survey/intro.js';
const digitalCodes = ['attract.campaign_launches','attract.chernoviki_v_sbol_70','attract.nalichie_self_service','attract.nalichie_uspeshnyh_biznes_zapuskov','goals.monitored','goals.factor_analysis_l1_l2','goals.forecast','mehaniki.cross_sell','hyp.ab_tests','hyp.datadriven_rating_7_5','hyp.extra_initiatives','cx.score','cx.uh_score'];
export function getIntroSummary(product) {
  const profile=otherTeamProfiles[product];if(!profile)return null;
  const a={product};const sections=getSections(a).filter(s=>s.id!=='intro'&&visibleQuestions(s,getBacklogAnalyzed(a),a).length);
  const groups=new Map();
  function add(id,title,label){if(!groups.has(id))groups.set(id,{id,title,metrics:[]});const g=groups.get(id);if(!g.metrics.includes(label))g.metrics.push(label);}
  for(const s of sections)for(const q of visibleQuestions(s,false,a)){
    if(q.benchmarkOnly||q.id==='churnModel'||s.id==='goals')continue;
    if(q.type==='numeric'||q.type==='metricGroup'||q.scoreKind==='segmentKnowledge')add('metrics','Ключевые метрики','Знание ключевых метрик');
    else if(['attract','churn','onboarding','usage','entry','sales'].includes(s.id))add('funnels','Воронки',`Отчетность и аналитика по ${s.title.replace('Воронка ','').replace('Воронка ', '').replace('привлечения','привлечению').replace('оттока','оттоку').replace('онбординга','онбордингу').replace('использования','использованию').replace('входа в канал','входу в канал').replace('продаж','продажам')}`);
    else if(q.id==='otherMechanics')for(const option of Object.keys(q.optionMetricCodes||{}).filter(v=>!knownMechanics(q,a).includes(v)))add('mechanics','Механики',option);
    else if(q.id==='mechanicsMonitoring')add('mechanics','Механики','Мониторинг эффективности механик');
    else if(q.id==='crossSellAfter')add('mechanics','Механики','Cross-sell после оформления продукта');
    else if(s.id==='alerts')add('alerts','Оповещения',q.type==='numeric'?q.title:'Настройка алертов');
    else if(q.id==='discovery')add('research','Исследования','Discovery: доля исследований в бэклоге');
    else if(s.id==='support')continue;
    else add(s.id,s.title,q.title);
  }
  const digitalGroups=new Map();
  for(const code of digitalCodes){const m=profile.metrics.find(m=>m.code===code&&otherMetricApplicable(m));if(!m)continue;
    const prefix=code.split('.')[0], id=prefix==='goals'?'goals':prefix==='attract'?'funnels':prefix==='mehaniki'?'mechanics':prefix==='cx'?'cx':'research';
    const title={goals:'Цели',funnels:'Воронки',mechanics:'Механики',cx:'Клиентский опыт',research:'Исследования'}[id];
    if(!digitalGroups.has(id))digitalGroups.set(id,{id,title,metrics:[]});digitalGroups.get(id).metrics.push(code==='mehaniki.cross_sell'?'Cross-sell во время оформления продукта (LossHunter)':m.name);
  }
  if(getBacklogAnalyzed(a)&&profile.metrics.some(m=>m.code==='hyp.discovery_40_backlog'&&otherMetricApplicable(m))){
    if(!digitalGroups.has('research'))digitalGroups.set('research',{id:'research',title:'Исследования',metrics:[]});
    digitalGroups.get('research').metrics.push('Discovery — бэклог Jira/SberTrack по ранее приложенной ссылке');
  }
  const surveyGroups=[...groups.values()], digital=[...digitalGroups.values()];
  return {sectionCount:sections.length,surveyGroups,digitalGroups:digital,survey:surveyGroups.flatMap(g=>g.metrics),digital:digital.flatMap(g=>g.metrics)};
}
