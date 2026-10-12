import React, {useEffect, useRef, useState} from 'react';
import {Button, Card, Checkbox, Icon, Label, Radio, RadioGroup, Select, TextArea, TextInput, Tooltip} from '@gravity-ui/uikit';
import {ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bulb, ChartColumn, Check, FileText, Magnifier} from '@gravity-ui/icons';
import {CROSS_SELL_URL, evidenceResponse, correctTypos, formatNumericAnswer, getBacklogAnalyzed, getSections, hasAnswer, hasEvidence, inlineQuestions, knownMechanics, needsComment, needsEvidence, needsProof, needsReason, normalizeNumericAnswer, questionOptions, toggleOption, visibleQuestions} from './questions.js';
import dataDrivenLogo from '../assets/ocb2c.png';
import {enabledTeams, filterTeamOption, teamGroups, teams} from './teams.js';
import {buildSurveyResult} from './result.js';
import {getIntroSummary, sectionCountText} from './intro.js';
import {metricSourceEvidence, metricSourceOptions} from './metric-source.js';
import {previousReportLinks} from './previous-funnels.js';

function SurveyBrand() {
  return <div className="survey-brand"><img className="survey-logo" src={dataDrivenLogo} alt="" width="30" height="30" /><span className="survey-wordmark">DATA-DRIVEN</span><span className="survey-brand-separator" aria-hidden="true" /><span className="survey-platform-wordmark">LOSSHUNTER</span></div>;
}

function Answer({question: q, answers, update, autoFocus = true}) {
  const [selectOpen, setSelectOpen] = useState(false);
  const value = answers[q.id] || '';
  const label = correctTypos(q.title);
  if (q.type === 'info') return <p className="survey-info-copy">{q.description}</p>;
  const known = [...knownMechanics(q, answers), ...(q.previousOptions || [])];
  if (q.type === 'numeric') return <TextInput autoFocus size="xl" type="text" controlProps={{inputMode: q.allowDecimal ? 'decimal' : 'numeric', pattern: q.allowDecimal ? '[0-9 ,.]*' : '[0-9 ]*'}} aria-label={label} placeholder={q.placeholder} value={formatNumericAnswer(value)} onUpdate={v => update(q.id, normalizeNumericAnswer(v, q.allowDecimal))} />;
  if (q.type === 'select') return <Select open={selectOpen} onOpenChange={setSelectOpen} size="xl" width="max" popupClassName="survey-team-popup" virtualizationThreshold={100} filterable filterOption={filterTeamOption} aria-label={label} placeholder="Выберите команду" filterPlaceholder="Поиск команды" options={teamGroups} getOptionGroupHeight={() => 46} renderOptionGroup={({label}) => <div className={`survey-team-unit ${label === teamGroups[0].label ? 'is-first' : ''}`}>{label}</div>} value={value ? [value] : []} onUpdate={v => update(q.id, v[0] || '')} />;
  if (q.type === 'input') return <TextInput autoFocus={autoFocus} size="xl" aria-label={label} placeholder={q.placeholder} readOnly={q.readOnly} value={value} onUpdate={v => update(q.id, v)} />;
  if (q.type === 'radio') return <><RadioGroup className="survey-radio" direction="vertical" size="l" aria-label={label} value={value} options={q.options.map(v => ({value: v, content: correctTypos(v)}))} onUpdate={v => update(q.id, v)} />{needsReason(q, answers) && <div className={q.reasonTitle ? "survey-inline-question" : "survey-other-answer"}>{q.reasonTitle && <h2><label htmlFor={q.reasonId}>{q.reasonTitle}</label></h2>}<TextArea id={q.reasonId} autoFocus aria-label={q.reasonTitle || "Причина неприменимости"} minRows={2} size="l" placeholder={q.reasonPlaceholder || "Укажите, почему вопрос не релевантен вашему продукту"} value={answers[q.reasonId] || ''} onUpdate={v => update(q.reasonId, v)} /></div>}{value === 'Свой вариант ответа' && <div className="survey-other-answer"><TextArea autoFocus aria-label="Ваш вариант ответа" minRows={2} size="l" placeholder="Напишите свой вариант" value={answers[`${q.id}Other`] || ''} onUpdate={v => update(`${q.id}Other`, v)} /></div>}</>;
  const renderChoice = v => <React.Fragment key={v}>{v === q.dividerBefore && <div className="survey-options-divider" aria-hidden="true" />}{known.includes(v) ? <Tooltip content="Указано при прошлом прохождении" openDelay={0} closeDelay={0} rest={0}><div className={`survey-known-mechanic ${q.previousOptions ? 'survey-known-funnel' : ''}`} tabIndex={0} aria-label={`${correctTypos(v)}: указано при прошлом прохождении`}><Checkbox size="l" checked disabled>{correctTypos(v)}<span className="survey-known-label">{q.previousOptions ? 'Уже имеются' : 'Уже настроено'}</span></Checkbox></div></Tooltip> : <Checkbox size="l" checked={Array.isArray(value) && value.includes(v)} onUpdate={() => update(q.id, toggleOption(Array.isArray(value) ? value : [], v))}>{correctTypos(v)}</Checkbox>}</React.Fragment>;
  if (q.type === 'multi') return <div className="survey-options" role="group" aria-label={label}>{q.optionGroups ? <div className="survey-option-groups">{q.optionGroups.map(group => <section className="survey-option-group" style={{gridColumn: group.column + 1, gridRow: group.gridRow, alignSelf: group.alignEnd ? 'end' : undefined}} key={group.title}><h3>{group.title}</h3><div className="survey-options">{group.indices.map(index => renderChoice(q.options[index]))}</div></section>)}</div> : questionOptions(q, answers).map(renderChoice)}{needsComment(q, answers) && <div className="survey-mechanics-comment"><label htmlFor="mechanics-comment">Комментарий (обязательно)</label><TextArea id="mechanics-comment" autoFocus aria-label="Комментарий к продуктовым механикам" minRows={3} size="l" placeholder="Опишите настроенные механики" value={answers[q.commentId] || ''} onUpdate={v => update(q.commentId, v)} /></div>}{Array.isArray(value) && value.some(v => /Свой вариант|Что-то ещ[её]|^Другое$/.test(v)) && <TextArea autoFocus aria-label="Ваш вариант ответа" minRows={2} size="l" placeholder="Напишите свой вариант" value={answers[`${q.id}Other`] || ''} onUpdate={v => update(`${q.id}Other`, v)} />}</div>;
  return <TextArea autoFocus={autoFocus} size="xl" minRows={q.proof ? 2 : 3} maxRows={8} aria-label={label} placeholder={q.placeholder || 'Ваш ответ'} value={value} onUpdate={v => update(q.id, v)} />;
}

function ExcelNotice() {
  return <div className="survey-excel-notice" role="alert">Для учета в оценке просим направить по почте <a href="mailto:MYCherkova@sberbank.ru,RGShishko@sberbank.ru,ASAntandze@sberbank.ru">нам</a>. В противном случае ответ не будет принят.</div>;
}

function InlineEvidence({question, answers, update}) {
  if (!needsEvidence(question, answers)) return null;
  const {id, formatId, title, label, previousLinks} = question.inlineEvidence;
  const {format, correction} = evidenceResponse(question.inlineEvidence, answers);
  const direction = id === 'churnReport' ? 'оттока' : id === 'usageReport' ? 'использования' : 'привлечения';
  return <section className={`survey-inline-evidence ${previousLinks ? 'survey-previous-evidence' : ''}`} aria-label={label || `Подтверждение воронки ${direction}`}>
    {previousLinks ? <>
      <h2>При предыдущем прохождении опроса вы направили ссылку на воронку {direction}:</h2>
      <ol>{previousLinks.map(link => <li key={link}><a href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ol>
      <p>При необходимости скорректируйте.</p>
    </> : <h2>{title || `Прикрепите подтверждающую ссылку на воронку ${direction}.`}</h2>}
    {previousLinks && <div className="survey-correction-actions">
      <Button type="button" size="l" view={correction === 'keep' ? 'outlined-action' : 'outlined'} selected={correction === 'keep'} onClick={() => update(`${id}Correction`, 'keep')}>Не требуется корректировки</Button>
      <Button type="button" size="l" view={correction === 'edit' ? 'outlined-action' : 'outlined'} selected={correction === 'edit'} onClick={() => update(`${id}Correction`, 'edit')}>Скорректировать</Button>
    </div>}
    {(!previousLinks || correction === 'edit') && <>
    <div className="survey-radio survey-evidence-options" role="radiogroup" aria-label={label ? `Формат: ${label}` : `Формат подтверждения воронки ${direction}`}>
      <Radio size="l" name={formatId} value="link" checked={format === 'link'} onUpdate={checked => {if (checked) update(formatId, 'link');}}>Ссылка на отчёт</Radio>
      <span className="survey-evidence-or" aria-hidden="true">ИЛИ</span>
      <Radio size="l" name={formatId} value="excel" checked={format === 'excel'} onUpdate={checked => {if (checked) update(formatId, 'excel');}}>Отчет в формате Excel</Radio>
    </div>
    {format === 'excel' && <ExcelNotice />}
    {format === 'link' && (previousLinks ? <TextArea size="l" minRows={2} maxRows={6} aria-label="Ссылка на отчёт" placeholder="По одной ссылке на строку · Shift + Enter — новая строка" value={answers[id] || ''} onUpdate={value => update(id, value)} /> : <TextInput autoFocus size="l" type="url" controlProps={{inputMode: 'url'}} aria-label="Ссылка на отчёт" placeholder="https://" value={answers[id] || ''} onUpdate={value => update(id, value)} />)}
    </>}
  </section>;
}

function InlineProof({question, answers, update}) {
  const proof = question.inlineProof;
  if (!needsProof(question, answers)) return null;
  if (proof.kind === 'metricSource') {
    const id = proof.id;
    const source = answers[id] || '';
    return <section className="survey-inline-question" aria-label={proof.title}>
      <h2>{proof.title}</h2>
      <div className="survey-radio" role="group" aria-label={proof.title}>{metricSourceOptions.map((option, optionIndex) => <div className="survey-source-option" key={option}>
      <Radio size="l" name={id} value={option} checked={source === option} onUpdate={checked => {if (checked) update(id, option);}}>{optionIndex === 1 ? `${option} (Clickstream, QlikSense, Excel...)` : option}</Radio>
      {source === option && <>
      {optionIndex === 0 && <section className="survey-inline-evidence"><h2>Приложите ссылку на дашборд в Навигаторе.</h2><TextInput autoFocus size="l" type="url" aria-label="Ссылка на дашборд в Навигаторе" placeholder="https://" value={answers[`${id}Link`] || ''} onUpdate={value => update(`${id}Link`, value)} /></section>}
      {optionIndex === 1 && <InlineEvidence question={{id, inlineEvidence: {id: `${id}Link`, formatId: `${id}Format`, title: 'Приложите подтверждение собственной отчётности.', label: 'Подтверждение источника показателя'}}} answers={answers} update={update} />}
      {optionIndex === 3 && <div className="survey-other-answer"><TextArea autoFocus id={`${id}Other`} size="l" minRows={2} aria-label="Свой источник показателя" placeholder="Опишите, где вы смотрите показатель" value={answers[`${id}Other`] || ''} onUpdate={value => update(`${id}Other`, value)} /></div>}
      </>}
      </div>)}</div>
    </section>;
  }
  return <section className={proof.appearance === 'base' ? 'survey-inline-question' : 'survey-inline-evidence'} aria-label={`Подтверждение: ${question.title}`}>
    <h2><label htmlFor={proof.id}>{proof.title}</label></h2>
    <TextArea id={proof.id} autoFocus={proof.autoFocus !== false} size="l" minRows={2} maxRows={8} aria-label={proof.title} placeholder={proof.placeholder} value={answers[proof.id] || ''} onUpdate={value => update(proof.id, value)} />
    {question.action && <InlineEvidence question={question.action} answers={{...answers, [question.action.id]: 'Да'}} update={update} />}
  </section>;
}

function ProgressNavigator({flow, index, review, editingFromReview, visitedIds, go, edit}) {
  const [hover, setHover] = useState(null);
  const canEdit = review || editingFromReview;
  function showHint(event, id, label) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 16));
    const top = Math.max(16, Math.min(rect.bottom + 4, window.innerHeight - 136));
    setHover({id, label, left, top, width});
  }
  return <><nav className="survey-progress-steps" aria-label="Вопросы опроса" style={{gridTemplateColumns: `repeat(${flow.length}, minmax(0, 1fr))`}}>{flow.map((q, i) => {
    const visited = visitedIds.has(q.id) && i !== index;
    const allowed = canEdit || visited;
    const current = i === index && !review;
    const label = `Шаг ${i + 1}. ${q.title}`;
    return <button key={q.id} className={`survey-progress-step ${canEdit || visited ? 'is-complete' : ''} ${current ? 'is-current' : ''}`} type="button" aria-label={label} aria-disabled={!allowed} aria-current={current ? 'step' : undefined} onMouseEnter={event => showHint(event, q.id, label)} onFocus={event => showHint(event, q.id, label)} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)} onClick={() => {setHover(null); if (allowed) canEdit ? edit(q.id) : go(q.id);}}><span aria-hidden="true" /></button>;
  })}</nav>{hover && <span className="survey-progress-hint" aria-hidden="true" style={{left: hover.left, top: hover.top, width: hover.width}}>{hover.label}</span>}</>;
}

const features = [
  {icon: Magnifier, title: 'Исследования на открытых данных', copy: 'Потенциал рынка, сравнение с конкурентами, сегментный и региональный анализ.', href: 'https://losshunter.ru/new/research'},
  {icon: FileText, title: 'Разборы клиентских путей', copy: 'Анализ UI/UX, карты процессов и механики cross-sell / up-sell внутри продуктового сценария.', href: 'https://losshunter.ru/platform/product-closing?q=%D0%B2%D0%BA%D0%BB%D0%B0%D0%B4%D1%8B'},
  {icon: Bulb, title: 'Disrupt-решения', copy: 'Новые подходы к нестандартным продуктовым задачам.', href: 'https://losshunter.ru/'},
  {icon: BookOpen, title: 'One page по продукту', copy: 'Рекомендации из исследований по вашему продукту — в одном месте.', href: 'https://losshunter.ru/'},
  {icon: ChartColumn, title: 'Прокачайте навыки работы с данными', copy: 'Проверяйте себя на реальных кейсах и находите новые идеи для команды.', href: 'https://losshunter.ru/'},
];

function Finish({name, back}) {
  return <main className="survey-finish">
    <div className="finish-top"><SurveyBrand /><Label theme="success" size="m"><Icon data={Check} size={14} /> Опрос завершён</Label></div>
    <section className="finish-hero"><p className="survey-eyebrow">От ответов — к действиям</p><h1>Спасибо{name?.trim() ? `, ${name.trim()}` : ''}.<br />Следующий шаг — новые идеи.</h1><p>Вы прошли опрос на аналитической платформе <b>LossHunter</b>.<br />Здесь можно изучить рынок, разобрать клиентский путь и найти точки роста продукта.</p><Button view="action" size="xl" href="https://losshunter.ru/" target="_blank" rel="noreferrer">Открыть LossHunter <Icon data={ArrowUpRight} size={18} /></Button></section>
    <Card view="outlined" className="finish-crosssell" aria-labelledby="finish-crosssell-title"><div><p className="survey-eyebrow">Cross-sell · цифровые следы</p><h2 id="finish-crosssell-title">Не забудьте посмотреть статус Cross-sell по ссылке</h2><p>Наличие механики во время оформления вашего продукта — на платформе LossHunter.</p></div><Button view="action" size="xl" href={CROSS_SELL_URL} target="_blank" rel="noreferrer">Посмотреть статус Cross-sell <Icon data={ArrowUpRight} size={18} /></Button></Card>
    <section className="finish-features"><div className="finish-section-head"><h2>Что есть на платформе</h2><span>Исследуйте. Сравнивайте. Применяйте.</span></div><div className="finish-feature-grid">{features.map((f, i) => <Card view="outlined" className={`finish-feature feature-${i}`} key={f.title}><div className="finish-feature-top"><span className="feature-icon"><Icon data={f.icon} size={20} /></span><Button size="s" view="outlined" href={f.href} target="_blank" rel="noreferrer">Перейти <Icon data={ArrowUpRight} size={14} /></Button></div><h3>{f.title}</h3><p>{f.copy}</p></Card>)}</div></section>
    <section className="finish-stats" aria-label="LossHunter в цифрах">{[['2 140+', 'клиентских сценариев разобрано'], ['195+', 'готовых исследований'], ['35 мин', 'в среднем на подготовку исследования']].map(([n, text]) => <Card view="outlined" key={n}><strong>{n}</strong><span>{text}</span></Card>)}</section>
    <footer className="finish-footer"><Button view="flat" size="l" onClick={back}><Icon data={ArrowLeft} size={16} /> Вернуться к ответам</Button><span>LossHunter · аналитика для продуктовых решений</span></footer>
  </main>;
}

export function SurveyApp() {
  const [activeId, setActiveId] = useState('cover');
  const [visitedIds, setVisitedIds] = useState(() => new Set(['cover']));
  const [answers, setAnswers] = useState({});
  const backlogAnalyzed = getBacklogAnalyzed(answers);
  const sections = getSections(answers);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState('');
  const [editingFromReview, setEditingFromReview] = useState(false);
  const heading = useRef(null);
  useEffect(() => {
    if (!finished) window.DDI_SURVEY_RESULT_JSON = null;
  }, [answers, finished]);
  const all = sections.flatMap(section => visibleQuestions(section, backlogAnalyzed, answers).map(q => ({...q, title: correctTypos(q.title), section})));
  const introQuestions = all.filter(q => q.section.id === 'intro');
  const flow = [{id: 'cover', title: 'Добрый день!', section: {title: 'Data Driven · 3Q26'}}, ...all.filter(q => q.section.id !== 'intro')];
  const introSummary = getIntroSummary(answers.product);
  const review = activeId === 'review';
  const index = flow.findIndex(q => q.id === activeId);
  const question = flow[index];
  const isCover = activeId === 'cover';
  const isSectionStart = !isCover && question && flow[index - 1]?.section.id !== question.section.id;
  const sectionNumber = [...new Set(flow.slice(1, index + 1).map(step => step.section.id))].length;
  const canContinue = review || (isCover ? introQuestions.every(q => hasAnswer(q, answers)) : question && hasAnswer(question, answers));
  useEffect(() => {
    if (activeId !== 'review') setVisitedIds(previous => previous.has(activeId) ? previous : new Set([...previous, activeId]));
    const inputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (question?.type === 'select' || !inputFocused) heading.current?.focus();
    window.scrollTo({top: 0, behavior: 'instant'});
  }, [activeId, finished]);
  function update(id, value) {
    if (id === 'product') {
      const team = enabledTeams.find(item => item.id === value);
      if (!team) return;
      if (answers.product !== value) setVisitedIds(new Set(['cover']));
      setAnswers(a => a.product === value
        ? {...a, product: value, unit: team.unit}
        : {name: a.name, product: value, unit: team.unit,
          ...Object.fromEntries(Object.entries(previousReportLinks[value] || {}).flatMap(([id, links]) => [[id, links.join('\n')], [`${id}Format`, 'link']]))});
    } else setAnswers(a => ({...a, [id]: value}));
    setError('');
  }
  function go(id) {setError(''); setActiveId(id);}
  function edit(id) {setEditingFromReview(true); go(['name', 'product'].includes(id) ? 'cover' : id);}
  function returnToReview() {setEditingFromReview(false); go('review');}
  function advance() {go(flow[index + 1]?.id || 'review');}
  function next(event) {
    event?.preventDefault();
    if (review) {
      const missing = all.find(q => !hasAnswer(q, answers));
      if (missing) {edit(missing.id); setError('Ответьте на вопрос, чтобы продолжить.'); return;}
      window.DDI_SURVEY_RESULT_JSON = JSON.stringify(buildSurveyResult(answers, backlogAnalyzed));
      setFinished(true);
      return;
    }
    if (!canContinue) {
      setError('Введите ответ или выберите вариант, чтобы продолжить.');
      return;
    }
    if (editingFromReview) returnToReview();
    else advance();
  }
  function answerText(q) {
    if (q.type === 'info') return '';
    const value = answers[q.id];
    if (q.previousOptions?.length) {
      const fresh = (Array.isArray(value) ? value : []).filter(option => !q.previousOptions.includes(option));
      return `${q.previousOptions.map(correctTypos).join('; ')} — уже имеются.${fresh.length ? ` Новые ответы: ${fresh.map(correctTypos).join('; ')}` : ''}`;
    }
    if (q.id === 'product') return teams.find(team => team.id === value)?.name || 'Не заполнено';
    if (q.type === 'numeric') return formatNumericAnswer(value);
    const known = knownMechanics(q, answers);
    const knownText = known.length ? `${known.join('; ')} — указано ранее. ` : '';
    const base = Array.isArray(value) ? value.map(correctTypos).join('; ') : ['radio', 'select'].includes(q.type) ? correctTypos(value || 'Не заполнено') : value || 'Не заполнено';
    if (needsReason(q, answers) && String(answers[q.reasonId] || '').trim()) return `${base}. ${answers[q.reasonId]}`;
    if (needsComment(q, answers)) return `${knownText}${base}. ${answers[q.commentId]}`;
    const otherSelected = (Array.isArray(value) ? value : [value]).some(option => /Свой вариант|Что-то ещ[её]|^Другое$/.test(option || ''));
    return otherSelected && answers[`${q.id}Other`] ? `${base}. ${answers[`${q.id}Other`]}` : `${knownText}${base}`;
  }
  function reviewEvidence(q, values = answers) {
    const proof = needsProof(q, values) ? <><p className="review-inline-evidence">{q.inlineProof.title}: {q.inlineProof.kind === 'metricSource' ? metricSourceEvidence(q.inlineProof, answers) : values[q.inlineProof.id]}</p>{q.action && reviewEvidence({...q.action, inlineProof: undefined}, {...values, [q.action.id]: 'Да'})}</> : null;
    if (!needsEvidence(q, values)) return proof;
    const {id, formatId} = q.inlineEvidence;
    const {format, value} = evidenceResponse(q.inlineEvidence, values);
    if (format === 'excel') return <>{proof}<p className="review-inline-evidence">Подтверждение: Отчет в формате Excel</p></>;
    if (format === 'link') return <>{proof}<p className="review-inline-evidence">Подтверждение: Ссылка на отчёт — {hasEvidence(q, values) ? value.split(/\r?\n/).filter(Boolean).map(link => <React.Fragment key={link}><a href={link.trim()} target="_blank" rel="noreferrer">{link.trim()}</a><br /></React.Fragment>) : (values[id] || 'Не заполнено')}</p></>;
    return <>{proof}<p className="review-inline-evidence">Подтверждение: Не заполнено</p></>;
  }
  if (finished) return <Finish name={answers.name} back={() => {setFinished(false); go('review');}} />;
  return <div className="survey-shell">
    <header className="survey-header"><SurveyBrand /><span className="survey-progress-label">{review ? `Проверка ответов · ${flow.length} вопросов` : `Шаг ${index + 1} из ${flow.length}`}</span></header>
    <div className="survey-top-progress"><ProgressNavigator flow={flow} index={index} review={review} editingFromReview={editingFromReview} visitedIds={visitedIds} go={go} edit={edit} /></div>
    <main className={`survey-main ${review ? 'is-review' : ''} ${isCover ? 'is-cover' : ''}`}>
      {review ? <>
        <p className="survey-eyebrow">Последний шаг</p><h1 ref={heading} tabIndex={-1}>Всё готово.<br />Проверьте ответы.</h1><p className="survey-intro-copy">Можно уточнить любой ответ перед завершением.</p>
        <div className="survey-review">{sections.filter(section => section.questions.some(q => q.type !== 'info' || inlineQuestions(q).length)).map(section => <Card view="outlined" className="review-section" key={section.id}><h2>{section.title}</h2>{visibleQuestions(section, backlogAnalyzed, answers).filter(q => q.type !== 'info' || inlineQuestions(q).length).map(q => <div className="review-answer" key={q.id}><div><b>{correctTypos(q.title)}</b><p>{answerText(q)}</p>{reviewEvidence(q)}{inlineQuestions(q).map(field => <div key={field.id}><b>{field.title}</b><p>{answerText(field)}</p>{reviewEvidence(field)}</div>)}</div><Button view="flat" size="m" onClick={() => edit(q.id)}>Изменить</Button></div>)}</Card>)}</div>
      </> : <form onSubmit={next} className="survey-single-form" onKeyDown={e => {
        if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.defaultPrevented || e.target.closest('.g-select, button')) return;
        if (e.shiftKey) {
          if (e.target.tagName !== 'TEXTAREA') e.preventDefault();
          return;
        }
        next(e);
      }}>
        <div className="survey-question-meta"><span className={`survey-eyebrow ${isSectionStart ? 'survey-section-number' : ''}`}>{isSectionStart ? `Раздел ${sectionNumber}` : `${question.section.title}${question.scope ? ` · ${question.scope}` : ''}`}</span><span className="survey-question-counter">{index + 1} / {flow.length}</span></div>
        <section className="survey-single-question" key={question.id} data-question-id={question.id} aria-labelledby="survey-title">
          {isSectionStart && <div className="survey-section-intro">
            <h2>{question.section.title}</h2>
            <p>{question.section.description || 'Механики Cross-sell во время оформления продукта и после него.'}</p>
          </div>}
          {question.proof && <p className="survey-proof-label"><Icon data={FileText} size={16} /> Подтверждение</p>}
          {question.previousClickstreamUrl && <section className="survey-clickstream-history" aria-label="Отчёт из прошлого опроса">
            <p>При прохождении прошлого опроса вы приложили ссылку на отчет в <a href={question.previousClickstreamUrl} target="_blank" rel="noreferrer">Clickstream</a>. Это закрывает метрики:</p>
            <ul>{question.previousOptions.map(option => <li key={option}><Icon data={Check} size={16} />{correctTypos(option)}</li>)}</ul>
          </section>}
          <h1 id="survey-title" ref={heading} tabIndex={-1}>{question.title}</h1>
          {isCover ? <>
            <p className="survey-cover-lead">Вы проходите опрос в рамках оценки Data Driven 3Q26.</p>
            <p className="survey-intro-copy">В оценке за 3 квартал применён индивидуальный подход.<br />В этом опросе учтены предыдущие ответы и цифровые следы.</p>
            <div className="survey-cover-fields survey-answer">{introQuestions.map(q => <div key={q.id}><label>{q.title}</label><Answer question={q} answers={answers} update={update} autoFocus={false} /></div>)}</div>
            {introSummary ? <>
              <p className="survey-cover-count" aria-live="polite">В опросе участвует {sectionCountText(introSummary.sectionCount)}.</p>
              <table className="survey-source-table"><thead><tr><th scope="col">В опросе остаются метрики</th><th scope="col">По цифровым следам забираем</th></tr></thead><tbody><tr>{[introSummary.survey, introSummary.digital].map((metrics, column) => <td key={column}><ul>{metrics.map(metric => <li key={metric}>{metric}</li>)}</ul>{!metrics.length && <p>Нет применимых метрик</p>}</td>)}</tr></tbody></table>
            </> : <p className="survey-cover-placeholder">Выберите команду, чтобы увидеть число разделов и состав метрик.</p>}
          </> : <>
          <p className="question-hint">{question.type === 'multi' ? 'Можно выбрать несколько вариантов' : question.proof ? 'Добавьте ссылку или описание, если ссылки нет' : ''}</p>
          <div className="survey-answer"><Answer question={question} answers={answers} update={update} /><InlineProof question={question} answers={answers} update={update} /><InlineEvidence question={question} answers={answers} update={update} />{inlineQuestions(question).map(field => <section className="survey-inline-question" key={field.id} aria-label={field.title}><h2>{field.title}</h2><Answer question={field} answers={answers} update={update} autoFocus={false} /><InlineProof question={field} answers={answers} update={update} /><InlineEvidence question={field} answers={answers} update={update} /></section>)}</div>
          </>}
        </section>
        <div className="survey-error" role="alert">{error}</div>
        <footer className="survey-actions"><Button type="button" view="flat" size="l" disabled={!editingFromReview && index === 0} onClick={() => editingFromReview ? returnToReview() : go(flow[index - 1].id)}><Icon data={ArrowLeft} size={16} /> {editingFromReview ? 'К проверке' : 'Назад'}</Button><div><Button type="submit" view="action" size="xl" disabled={!canContinue}>{editingFromReview ? 'Сохранить и вернуться' : 'Далее'} <Icon data={ArrowRight} size={17} /></Button></div></footer>
        <div className="survey-under-form"><span>{editingFromReview ? 'Enter — сохранить' : 'Enter — далее'}{question.type === 'text' ? ' · Shift + Enter — новая строка' : ''}</span><span>{index === 0 ? 'Ответы только в этой вкладке' : 'Ваш ответ можно изменить, вернувшись назад'}</span></div>
      </form>}
      {review && <footer className="survey-actions"><Button view="flat" size="l" onClick={() => edit(flow.at(-1).id)}><Icon data={ArrowLeft} size={16} /> Назад</Button><Button view="action" size="xl" onClick={next}>Завершить опрос <Icon data={ArrowRight} size={17} /></Button></footer>}
    </main>
    <footer className="survey-page-footer"><span>LossHunter · аналитика для продуктовых решений</span><span>Ваша команда. Ваш продукт. Ваш следующий шаг.</span></footer>
  </div>;
}
