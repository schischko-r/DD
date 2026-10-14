import {hasBacklogLinks} from './previous-backlogs.js';
import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {Button, Card, Checkbox, Icon, Label, Radio, RadioGroup, Select, TextArea, TextInput, Tooltip} from '@gravity-ui/uikit';
import {ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bulb, ChartColumn, Check, FileText, Magnifier} from '@gravity-ui/icons';
import {CROSS_SELL_URL, shouldShowCrossSellReminder, allowsMissingMetric, evidenceResponse, correctTypos, formatNumericAnswer, getBacklogAnalyzed, getSections, hasAnswer, hasEvidence, inlineQuestions, isOptionSelected, knownMechanics, showsOptionalComment, needsComment, needsEvidence, needsProof, needsReason, normalizeNumericAnswer, questionOptions, toggleOption, visibleQuestions} from './questions.js';
import dataDrivenLogo from '../assets/ocb2c.png';
import {enabledTeams, filterTeamOption, teamGroups, teams} from './teams.js';
import {buildSurveyResult} from './result.js';
import {getIntroSummary, sectionCountText} from './intro.js';
import {hasMetricSource, hasHttpLinks, hasDashboardSources, httpLinkValues, metricSourceEvidence, metricSourceOptions} from './metric-source.js';
import {previousReportLinks} from './previous-funnels.js';

const ValidationContext = createContext(false);
const requiredMessage = 'Заполните обязательные поля, чтобы продолжить.';
const blank = value => !String(value ?? '').trim();

function SurveyBrand() {
  return <div className="survey-brand"><img className="survey-logo" src={dataDrivenLogo} alt="" width="30" height="30" /><span className="survey-wordmark">DATA-DRIVEN</span><span className="survey-brand-separator" aria-hidden="true" /><span className="survey-platform-wordmark">LOSSHUNTER</span></div>;
}

function Answer({question: q, answers, update, autoFocus = true}) {
  const [selectOpen, setSelectOpen] = useState(false);
  const value = answers[q.id] || '';
  const attempted = useContext(ValidationContext);
  const invalid = attempted && !(allowsMissingMetric(q, answers) && blank(value)) && !hasAnswer({...q, inlineProof: undefined, inlineEvidence: undefined, inlineQuestions: undefined,
    reasonId: undefined, commentId: undefined, optionalCommentRequired: undefined, action: undefined}, answers);
  const validationState = invalid ? 'invalid' : undefined;
  const label = correctTypos(q.title);
  if (q.type === 'info') {
    const phrases = q.emphasis || [];
    const pattern = phrases.map(phrase => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const parts = pattern ? q.description.split(new RegExp(`(${pattern})`, 'g')) : [q.description];
    return <p className="survey-info-copy">{parts.map((part, index) => phrases.includes(part) ? <strong key={index}>{part}</strong> : part)}</p>;
  }
  const known = [...knownMechanics(q, answers), ...(q.previousOptions || [])];
  if (q.type === 'links') {
    const links = String(value).split(/\r?\n/);
    const format = answers[`${q.id}Unknown`] === true ? 'unknown' : answers[`${q.id}Format`] || 'link';
    const options = [{value: 'link', label: 'Ссылки на дашборды'}, {value: 'excel', label: 'Отчетность в формате Excel'}, {value: 'unknown', label: 'Затрудняюсь ответить'}];
    return <div className="survey-radio survey-goals-formats" role="radiogroup" aria-label="Формат мониторинга КПЭ">{options.map(option => <React.Fragment key={option.value}>
      <Radio size="l" name={`${q.id}Format`} value={option.value} checked={format === option.value} onUpdate={checked => {if (checked) {update(`${q.id}Format`, option.value); update(`${q.id}Unknown`, option.value === 'unknown'); if (option.value !== 'link') update(q.id, '');}}}>{option.label}</Radio>
      {format === option.value && option.value === 'link' && <>
        <div className="survey-link-fields">{links.map((link, index) => <div className="survey-link-row" key={index}>
          <TextInput validationState={invalid && !hasHttpLinks(link) && (!blank(link) || !httpLinkValues(value).length && index === 0) ? 'invalid' : undefined} autoFocus={index === links.length - 1} size="xl" type="url" aria-label={`Ссылка на дашборд ${index + 1}`} placeholder="https://" value={link} onUpdate={v => update(q.id, links.map((item, i) => i === index ? v : item).join('\n'))} />
          {links.length > 1 && <Button type="button" view="flat" size="xl" aria-label={`Удалить ссылку ${index + 1}`} onClick={() => update(q.id, links.filter((_, i) => i !== index).join('\n'))}>Удалить</Button>}
        </div>)}</div>
        <Button type="button" className="survey-add-link" view="outlined" size="l" onClick={() => update(q.id, `${value}\n`)}>Добавить ещё</Button>
      </>}
      {format === option.value && option.value === 'excel' && <ExcelNotice product={answers.product} />}
    </React.Fragment>)}</div>;
  }
  if (q.type === 'numeric') {
    const unknown = allowsMissingMetric(q, answers);
    return <><TextInput endContent={q.unit && <span className="survey-metric-unit">{q.unit}</span>} validationState={validationState} autoFocus size="xl" type="text" controlProps={{inputMode: q.allowDecimal ? 'decimal' : 'numeric', pattern: q.allowDecimal ? '[0-9 ,.]*' : '[0-9 ]*'}} aria-label={label} placeholder={q.placeholder} value={formatNumericAnswer(value)} onUpdate={v => {update(`${q.id}Unknown`, false); update(q.id, normalizeNumericAnswer(v, q.allowDecimal));}} />
      <div className="survey-metric-or" aria-hidden="true">ИЛИ</div>
      <div className={`survey-metric-unknown survey-options ${invalid ? 'survey-field-error' : ''}`}><Checkbox size="l" checked={unknown} onUpdate={checked => {update(`${q.id}Unknown`, checked); if (checked) update(q.id, '');}}>Затрудняюсь ответить</Checkbox></div>
    </>;
  }
  if (q.type === 'select') return <Select validationState={validationState} open={selectOpen} onOpenChange={setSelectOpen} size="xl" width="max" popupClassName="survey-team-popup" virtualizationThreshold={100} filterable filterOption={filterTeamOption} aria-label={label} placeholder="Выберите команду" filterPlaceholder="Поиск команды" options={teamGroups} getOptionGroupHeight={() => 46} renderOptionGroup={({label}) => <div className={`survey-team-unit ${label === teamGroups[0].label ? 'is-first' : ''}`}>{label}</div>} value={value ? [value] : []} onUpdate={v => update(q.id, v[0] || '')} />;
  if (q.type === 'input') return <TextInput validationState={validationState} autoFocus={autoFocus} size="xl" aria-label={label} placeholder={q.placeholder} readOnly={q.readOnly} value={value} onUpdate={v => update(q.id, v)} />;
  if (q.type === 'radio') return <>{q.optionHints ? <div className={`survey-radio ${invalid ? 'survey-field-error' : ''}`} role="radiogroup" aria-label={label} aria-invalid={invalid || undefined}>{q.options.map(option => <Tooltip key={option} disabled={!q.optionHints[option]} content={q.optionHints[option]} openDelay={0} closeDelay={0} rest={0}><div className="survey-radio-hint"><Radio name={q.id} size="l" value={option} checked={value === option} onUpdate={checked => {if (checked) update(q.id, option);}}>{correctTypos(option)}</Radio></div></Tooltip>)}</div> : <RadioGroup className={`survey-radio ${invalid ? "survey-field-error" : ""}`} aria-invalid={invalid || undefined} direction="vertical" size="l" aria-label={label} value={value} options={q.options.map(v => ({value: v, content: correctTypos(v)}))} onUpdate={v => update(q.id, v)} />}{showsOptionalComment(q, answers) && <section className="survey-inline-question survey-optional-comment"><h2><label htmlFor={q.optionalCommentId}>{q.optionalCommentTitles?.[value] || q.optionalCommentTitle || 'Комментарий при необходимости'}</label></h2><TextArea validationState={attempted && q.optionalCommentRequired && blank(answers[q.optionalCommentId]) ? "invalid" : undefined} id={q.optionalCommentId} size="l" minRows={2} placeholder={q.optionalCommentPlaceholder || 'Опишите, какие оповещения настроены и как они работают'} value={answers[q.optionalCommentId] || ''} onUpdate={value => update(q.optionalCommentId, value)} /></section>}{needsReason(q, answers) && <div className={q.reasonTitle ? "survey-inline-question" : "survey-other-answer"}>{q.reasonTitle && <h2><label htmlFor={q.reasonId}>{q.reasonTitle}</label></h2>}<TextArea validationState={attempted && !q.reasonOptional && blank(answers[q.reasonId]) ? "invalid" : undefined} id={q.reasonId} autoFocus aria-label={q.reasonTitle || "Причина неприменимости"} minRows={2} size="l" placeholder={q.reasonPlaceholder || "Укажите, почему вопрос не релевантен вашему продукту"} value={answers[q.reasonId] || ''} onUpdate={v => update(q.reasonId, v)} /></div>}{value === 'Свой вариант ответа' && <div className="survey-other-answer"><TextArea validationState={attempted && blank(answers[`${q.id}Other`]) ? "invalid" : undefined} autoFocus aria-label="Ваш вариант ответа" minRows={2} size="l" placeholder="Напишите свой вариант" value={answers[`${q.id}Other`] || ''} onUpdate={v => update(`${q.id}Other`, v)} /></div>}</>;
  const renderChoice = v => {
    const hint = q.optionHints?.[v];
    const choice = known.includes(v)
      ? <Tooltip content={<>{'Указано при прошлом прохождении'}{hint && <><br />{hint}</>}</>} openDelay={0} closeDelay={0} rest={0}><div className={`survey-known-mechanic ${q.previousOptions ? 'survey-known-funnel' : ''}`} tabIndex={0} aria-label={`${correctTypos(v)}: указано при прошлом прохождении`}><Checkbox size="l" checked disabled>{correctTypos(v)}<span className="survey-known-label">{q.previousOptions ? 'Уже имеются' : 'Уже настроено'}</span></Checkbox></div></Tooltip>
      : hint ? <Tooltip content={hint} openDelay={0} closeDelay={0} rest={0}><div className="survey-option-hint"><Checkbox size="l" checked={Array.isArray(value) && value.includes(v)} onUpdate={() => update(q.id, toggleOption(Array.isArray(value) ? value : [], v))}>{correctTypos(v)}</Checkbox></div></Tooltip>
      : <Checkbox size="l" checked={Array.isArray(value) && value.includes(v)} onUpdate={() => update(q.id, toggleOption(Array.isArray(value) ? value : [], v))}>{correctTypos(v)}</Checkbox>;
    return <React.Fragment key={v}>{v === q.dividerBefore && <div className="survey-options-divider" aria-hidden="true" />}{choice}{inlineQuestions(q, answers).filter(field => field.inlineAtOption && field.whenOption?.option === v).map(field => <section className="survey-inline-question survey-mechanic-detail" key={field.id} aria-label={field.title}><h2>{field.title}</h2><Answer question={field} answers={answers} update={update} autoFocus={false} /></section>)}</React.Fragment>;
  };
  if (q.type === 'multi') return <div className={`survey-options ${invalid ? "survey-field-error" : ""}`} aria-invalid={invalid || undefined} role="group" aria-label={label}>{q.optionGroups ? <div className="survey-option-groups">{q.optionGroups.map(group => <section className="survey-option-group" style={{gridColumn: group.column + 1, gridRow: group.gridRow, alignSelf: group.alignEnd ? 'end' : undefined}} key={group.title}><h3>{group.title}</h3><div className="survey-options">{group.indices.map(index => renderChoice(q.options[index]))}</div></section>)}</div> : questionOptions(q, answers).map(renderChoice)}{needsComment(q, answers) && <div className="survey-mechanics-comment"><label htmlFor="mechanics-comment">Комментарий (обязательно)</label><TextArea validationState={attempted && blank(answers[q.commentId]) ? "invalid" : undefined} id="mechanics-comment" autoFocus aria-label="Комментарий к продуктовым механикам" minRows={3} size="l" placeholder="Опишите настроенные механики" value={answers[q.commentId] || ''} onUpdate={v => update(q.commentId, v)} /></div>}{Array.isArray(value) && value.some(v => /Свой вариант|Что-то ещ[её]|^Другое$/.test(v)) && <TextArea validationState={attempted && blank(answers[`${q.id}Other`]) ? "invalid" : undefined} autoFocus aria-label="Ваш вариант ответа" minRows={2} size="l" placeholder="Напишите свой вариант" value={answers[`${q.id}Other`] || ''} onUpdate={v => update(`${q.id}Other`, v)} />}</div>;
  return <TextArea validationState={validationState} autoFocus={autoFocus} size="xl" minRows={q.proof ? 2 : 3} maxRows={8} aria-label={label} placeholder={q.placeholder || 'Ваш ответ'} value={value} onUpdate={v => update(q.id, v)} />;
}

function EvidenceLinks({id, value, update, invalid, allowNames = false, label = 'Ссылка на отчёт'}) {
  const links = String(value || '').split(/\r?\n/);
  const hasAny = httpLinkValues(value).length > 0;
  const validEntry = allowNames ? hasDashboardSources : hasHttpLinks;
  return <div className="survey-evidence-link-fields">
    <div className="survey-link-fields">{links.map((link, index) => <div className="survey-link-row" key={index}>
      <TextInput size="l" type={allowNames ? "text" : "url"} controlProps={{inputMode: allowNames ? 'text' : 'url'}} autoFocus={index === links.length - 1} aria-label={index === 0 ? label : `${label} ${index + 1}`} placeholder={allowNames ? "Ссылка или название дашборда" : "https://"} value={link}
        validationState={invalid && ((!blank(link) && !validEntry(link)) || (!hasAny && index === 0)) ? 'invalid' : undefined}
        onUpdate={next => update(id, links.map((item, i) => i === index ? next : item).join('\n'))} />
      {links.length > 1 && <Button type="button" view="flat" size="l" aria-label={`Удалить источник ${index + 1}`} onClick={() => update(id, links.filter((_, i) => i !== index).join('\n'))}>Удалить</Button>}
    </div>)}</div>
    <Button type="button" view="outlined" size="l" className="survey-add-link" onClick={() => update(id, `${value || ''}\n`)}>Добавить ещё</Button>
  </div>;
}

function ExcelNotice({product}) {
  const [showMailDetails, setShowMailDetails] = useState(false);
  const teamName = teams.find(team => team.id === product)?.name || '';
  const recipients = 'MYCherkova@sberbank.ru,RGShishko@sberbank.ru,ASAntandze@sberbank.ru';
  const subject = `3Q_DDI - ${teamName} - Источники`;
  const href = `mailto:${recipients}?subject=${encodeURIComponent(subject)}`;
  return <div className="survey-excel-notice" role="alert">
    Пожалуйста, направьте отчетность <a className="survey-mail-link" href={href} target="_blank" rel="noopener noreferrer" onClick={() => setShowMailDetails(true)}>нам</a> по почте, чтобы мы могли учесть её при оценке.
    <details className="survey-mail-details" open={showMailDetails} onToggle={event => setShowMailDetails(event.currentTarget.open)}>
      <summary>Адреса и тема письма</summary>
      <p>Если письмо не открылось, создайте его в вашей почте с этими данными и приложите Excel.</p>
      <label>Кому<input readOnly aria-label="Получатели отчётности" value={recipients} onFocus={event => event.target.select()} /></label>
      <label>Тема<input readOnly aria-label="Тема письма с отчётностью" value={subject} onFocus={event => event.target.select()} /></label>
    </details>
  </div>;
}

function InlineEvidence({question, answers, update}) {
  const attempted = useContext(ValidationContext);
  const invalid = attempted && !hasEvidence(question, answers);
  if (!needsEvidence(question, answers)) return null;
  const {id, formatId, title, label, previousLinks, formats} = question.inlineEvidence;
  const options = formats || [{value: "link", label: "Ссылки на отчетность"}, {value: "excel", label: "Отчетность в формате Excel"}, {value: "unavailable", label: "Не могу предоставить ссылку"}];
  const {format, correction} = evidenceResponse(question.inlineEvidence, answers);
  const formatChosen = options.some(option => option.value === format);
  const direction = id === 'churnReport' ? 'оттока' : id === 'usageReport' ? 'использования' : 'привлечения';
  return <section className={`survey-inline-evidence ${previousLinks ? 'survey-previous-evidence' : ''}`} aria-label={label || `Материалы по воронке ${direction}`}>
    {previousLinks ? <>
      <h2>{question.reportMonitoring ? 'Приложенные ранее ссылки:' : `При предыдущем прохождении опроса вы направили ссылку на воронку ${direction}:`}</h2>
      <ol>{previousLinks.map(link => <li key={link}><a href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ol>
      {!question.reportMonitoring && <p>Если в приложенной отчетности есть не все выбранные метрики, добавьте дополнительные ссылки.</p>}
    </> : <h2>{formats ? title || 'Пожалуйста, приложите ссылки' : 'Пожалуйста, приложите ссылки'}</h2>}
    {previousLinks && <div className="survey-correction-actions">
      {(!question.reportMonitoring || correction === 'edit') && <Button type="button" size="l" view={correction === 'keep' ? 'outlined-action' : 'outlined'} selected={correction === 'keep'} onClick={() => update(`${id}Correction`, 'keep')}>Не требуется корректировки</Button>}
      <Button type="button" size="l" view={correction === 'edit' ? 'outlined-action' : 'outlined'} selected={correction === 'edit'} onClick={() => update(`${id}Correction`, 'edit')}>Скорректировать</Button>
    </div>}
    {(!previousLinks || correction === 'edit') && <>
    <div className={`survey-radio survey-evidence-options ${invalid && !formatChosen ? "survey-field-error" : ""}`} aria-invalid={invalid && !formatChosen || undefined} role="radiogroup" aria-label={label ? `Формат: ${label}` : `Формат материалов по воронке ${direction}`}>
      {options.map((option, index) => <React.Fragment key={option.value}>
        {index > 0 && <span className="survey-evidence-or" aria-hidden="true">ИЛИ</span>}
        <Radio size="l" name={formatId} value={option.value} checked={format === option.value} onUpdate={checked => {if (checked) {update(formatId, option.value); if (formats && format !== option.value) update(id, '');}}}>{option.label}</Radio>
        {format === option.value && ['link', 'jira', 'confluence'].includes(option.value) && <EvidenceLinks id={id} value={answers[id]} update={update} invalid={invalid} />}
        {format === option.value && option.value === 'unavailable' && <section className="survey-metric-comment"><label htmlFor={`${id}Comment`}>Комментарий при необходимости</label><TextArea id={`${id}Comment`} autoFocus size="l" minRows={2} placeholder="Введите комментарий" value={answers[`${id}Comment`] || ''} onUpdate={value => update(`${id}Comment`, value)} /></section>}
        {format === option.value && option.value === 'other' && <TextArea validationState={invalid ? 'invalid' : undefined} autoFocus size="l" minRows={2} aria-label="Другие материалы по мероприятиям" placeholder="Опишите материалы или укажите, где их найти" value={answers[id] || ''} onUpdate={value => update(id, value)} />}
      </React.Fragment>)}
    </div>
    {format === 'excel' && <ExcelNotice product={answers.product} />}
    </>}
  </section>;
}

function InlineProof({question, answers, update}) {
  const proof = question.inlineProof;
  const attempted = useContext(ValidationContext);
  if (question.action) return isOptionSelected(question, answers, question.actionOption)
    ? <InlineEvidence question={question.action} answers={{...answers, [question.action.id]: 'Да'}} update={update} /> : null;
  if (!needsProof(question, answers)) return null;
  if (proof.kind === 'metricSource') {
    const id = proof.id;
    const source = answers[id] || '';
    const invalid = attempted && !hasMetricSource(proof, answers);
    return <section className="survey-inline-question" aria-label={proof.title}>
      <h2>{proof.title}</h2>
      <div className={`survey-radio ${invalid && !metricSourceOptions.includes(source) ? "survey-field-error" : ""}`} aria-invalid={invalid && !metricSourceOptions.includes(source) || undefined} role="group" aria-label={proof.title}>{metricSourceOptions.map((option, optionIndex) => <div className="survey-source-option" key={option}>
      <Radio size="l" name={id} value={option} checked={source === option} onUpdate={checked => {if (checked) update(id, option);}}>{optionIndex === 1 ? `${option} (Clickstream, QlikSense, Excel...)` : option}</Radio>
      {source === option && <>
      {optionIndex === 0 && <section className="survey-inline-evidence"><h2>Приложите ссылки или названия дашбордов</h2><EvidenceLinks id={`${id}Link`} value={answers[`${id}Link`]} update={update} invalid={invalid} allowNames label="Ссылка или название дашборда" /></section>}
      {optionIndex === 1 && <InlineEvidence question={{id, inlineEvidence: {id: `${id}Link`, formatId: `${id}Format`, title: 'Пожалуйста, приложите ссылки', label: 'Источники показателя'}}} answers={answers} update={update} />}
      {optionIndex === 3 && <div className="survey-other-answer"><TextArea validationState={invalid ? "invalid" : undefined} autoFocus id={`${id}Other`} size="l" minRows={2} aria-label="Свой источник показателя" placeholder="Опишите, где вы смотрите показатель" value={answers[`${id}Other`] || ''} onUpdate={value => update(`${id}Other`, value)} /></div>}
      </>}
      </div>)}</div>
    </section>;
  }
  return <section className={`${proof.appearance === 'base' ? 'survey-inline-question' : 'survey-inline-evidence'} ${proof.kind === 'backlog' ? 'survey-backlog-link' : ''}`} aria-label={`Материалы: ${question.title}`}>
    <h2><label htmlFor={proof.id}>{proof.title}</label></h2>
    <TextArea validationState={attempted && (proof.kind === 'backlog' ? !hasBacklogLinks(answers[proof.id]) : blank(answers[proof.id])) ? "invalid" : undefined} id={proof.id} autoFocus={proof.autoFocus !== false} size="l" minRows={2} maxRows={8} aria-label={proof.title} placeholder={proof.placeholder} value={answers[proof.id] || ''} onUpdate={value => update(proof.id, value)} />
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

function Finish({name, back, showCrossSell}) {
  return <main className="survey-finish">
    <div className="finish-top"><SurveyBrand /><Label theme="success" size="m"><Icon data={Check} size={14} /> Опрос завершён</Label></div>
    <section className="finish-result" aria-labelledby="finish-result-title"><p className="survey-eyebrow">Data Driven · 3Q26</p><h1 id="finish-result-title">Спасибо{name?.trim() ? `, ${name.trim()}` : ''}!<br />Вы прошли опрос.</h1><p>Итоги будут подведены <strong>до 31 октября</strong>.</p><p>Результат сможете посмотреть в Навигаторе по ссылке ниже.</p><Button view="action" size="xl" href="https://navigator.sigma.sbrf.ru/gdash/1000006647#eyJmdWxsc2NyZWVuV2lkZ2V0SUQiOjEwMDA1NDQ2MjB9" target="_blank" rel="noreferrer">Посмотреть результат оценки <Icon data={ArrowUpRight} size={18} /></Button></section>
    <section className="finish-hero"><p className="survey-eyebrow">От ответов — к действиям</p><h2>Следующий шаг — новые идеи.</h2><p>Вы находитесь на платформе <b>LossHunter</b>.<br />Здесь можно изучить рынок, разобрать клиентский путь и найти точки роста продукта.</p><Button view="action" size="xl" href="https://losshunter.ru/" target="_blank" rel="noreferrer">Открыть LossHunter <Icon data={ArrowUpRight} size={18} /></Button></section>
    {showCrossSell && <Card view="outlined" className="finish-crosssell" aria-labelledby="finish-crosssell-title"><div><p className="survey-eyebrow">Cross-sell · цифровые следы</p><h2 id="finish-crosssell-title">Не забудьте посмотреть статус Cross-sell по ссылке</h2><p>Наличие механики во время оформления вашего продукта — на платформе LossHunter.</p></div><Button view="action" size="xl" href={CROSS_SELL_URL} target="_blank" rel="noreferrer">Посмотреть статус Cross-sell <Icon data={ArrowUpRight} size={18} /></Button></Card>}
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
  const [validationAttempted, setValidationAttempted] = useState(false);
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
  function go(id) {setError(''); setValidationAttempted(false); setActiveId(id);}
  function edit(id) {setEditingFromReview(true); go(['name', 'product'].includes(id) ? 'cover' : id);}
  function returnToReview() {setEditingFromReview(false); go('review');}
  function advance() {go(flow[index + 1]?.id || 'review');}
  function next(event) {
    event?.preventDefault();
    if (review) {
      const missing = all.find(q => !hasAnswer(q, answers));
      if (missing) {edit(missing.id); setValidationAttempted(true); setError(requiredMessage); return;}
      window.DDI_SURVEY_RESULT_JSON = JSON.stringify(buildSurveyResult(answers, backlogAnalyzed));
      setFinished(true);
      return;
    }
    if (!canContinue) {
      setValidationAttempted(true);
      setError(requiredMessage);
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
    if (q.type === 'links') return answers[`${q.id}Unknown`] === true || answers[`${q.id}Format`] === 'unknown' ? 'Затрудняюсь ответить'
      : answers[`${q.id}Format`] === 'excel' ? 'Отчетность в формате Excel'
      : !hasAnswer(q, answers) ? (value || 'Не заполнено') : String(value || '').split(/\r?\n/).map(link => link.trim()).filter(Boolean).map((link, index) => <React.Fragment key={`${index}-${link}`}><a href={link} target="_blank" rel="noreferrer">{link}</a><br /></React.Fragment>);
    if (q.id === 'product') return teams.find(team => team.id === value)?.name || 'Не заполнено';
    if (q.type === 'numeric') return <>{allowsMissingMetric(q, answers) && blank(value) ? 'Затрудняюсь ответить' : `${formatNumericAnswer(value)}${q.unit ? ` ${q.unit}` : ''}`}{!blank(answers[q.optionalCommentId]) && <span className="review-inline-evidence review-metric-comment">Комментарий: {String(answers[q.optionalCommentId]).trim()}</span>}</>;
    const known = knownMechanics(q, answers);
    const knownText = known.length ? `${known.join('; ')} — указано ранее. ` : '';
    const base = Array.isArray(value) ? value.map(correctTypos).join('; ') : ['radio', 'select'].includes(q.type) ? correctTypos(value || 'Не заполнено') : value || 'Не заполнено';
    if (needsReason(q, answers) && String(answers[q.reasonId] || '').trim()) return `${base}. ${answers[q.reasonId]}`;
    if (needsComment(q, answers)) return `${knownText}${base}. ${answers[q.commentId]}`;
    if (showsOptionalComment(q, answers) && !blank(answers[q.optionalCommentId])) return `${knownText}${base}. ${q.optionalCommentTitles?.[value] || q.optionalCommentTitle || 'Комментарий'}: ${String(answers[q.optionalCommentId]).trim()}`;
    const otherSelected = (Array.isArray(value) ? value : [value]).some(option => /Свой вариант|Что-то ещ[её]|^Другое$/.test(option || ''));
    return otherSelected && answers[`${q.id}Other`] ? `${base}. ${answers[`${q.id}Other`]}` : `${knownText}${base}`;
  }
  function reviewEvidence(q, values = answers) {
    if (q.action && isOptionSelected(q, values, q.actionOption)) return reviewEvidence(q.action, {...values, [q.action.id]: 'Да'});
    const proof = needsProof(q, values) ? <><p className="review-inline-evidence">{q.inlineProof.title}: {q.inlineProof.kind === 'metricSource' ? metricSourceEvidence(q.inlineProof, answers) : values[q.inlineProof.id]}</p>{q.action && reviewEvidence({...q.action, inlineProof: undefined}, {...values, [q.action.id]: 'Да'})}</> : null;
    if (!needsEvidence(q, values)) return proof;
    const {id, formatId} = q.inlineEvidence;
    const {format, value, comment} = evidenceResponse(q.inlineEvidence, values);
    if (format === 'unavailable') return <>{proof}<p className="review-inline-evidence">Материалы: Не могу предоставить ссылку{comment ? `. Комментарий: ${comment}` : ''}</p></>;
    if (format === 'excel') return <>{proof}<p className="review-inline-evidence">Материалы: Отчетность в формате Excel</p></>;
    if (q.inlineEvidence.formats && format === 'other') return <>{proof}<p className="review-inline-evidence">Материалы: Другое — {value}</p></>;
    if (format === 'link' || q.inlineEvidence.formats?.some(option => option.value === format)) return <>{proof}<p className="review-inline-evidence">Материалы: {q.inlineEvidence.formats?.find(option => option.value === format)?.label || 'Ссылка на отчёт'} — {hasEvidence(q, values) ? value.split(/\r?\n/).filter(Boolean).map(link => <React.Fragment key={link}><a href={link.trim()} target="_blank" rel="noreferrer">{link.trim()}</a><br /></React.Fragment>) : (values[id] || 'Не заполнено')}</p></>;
    return <>{proof}<p className="review-inline-evidence">Материалы: Не заполнено</p></>;
  }
  if (finished) return <Finish name={answers.name} showCrossSell={shouldShowCrossSellReminder(answers)} back={() => {setFinished(false); go('review');}} />;
  return <div className="survey-shell">
    <header className="survey-header"><SurveyBrand /><span className="survey-progress-label">{review ? `Проверка ответов · ${flow.length} вопросов` : `Шаг ${index + 1} из ${flow.length}`}</span></header>
    <div className="survey-top-progress"><ProgressNavigator flow={flow} index={index} review={review} editingFromReview={editingFromReview} visitedIds={visitedIds} go={go} edit={edit} /></div>
    <main className={`survey-main ${review ? 'is-review' : ''} ${isCover ? 'is-cover' : ''}`}>
      {review ? <>
        <p className="survey-eyebrow">Последний шаг</p><h1 ref={heading} tabIndex={-1}>Всё готово.<br />Проверьте ответы.</h1><p className="survey-intro-copy">Можно уточнить любой ответ перед завершением.</p>
        <div className="survey-review">{sections.filter(section => section.questions.some(q => q.type !== 'info' || inlineQuestions(q, answers).length)).map(section => <Card view="outlined" className="review-section" key={section.id}><h2>{section.title}</h2>{visibleQuestions(section, backlogAnalyzed, answers).filter(q => q.type !== 'info' || inlineQuestions(q, answers).length).map(q => <div className="review-answer" key={q.id}><div><b>{correctTypos(q.title)}</b><p>{answerText(q)}</p>{reviewEvidence(q)}{inlineQuestions(q, answers).map(field => <div key={field.id}><b>{field.title}</b><p>{answerText(field)}</p>{reviewEvidence(field)}</div>)}</div><Button view="flat" size="m" onClick={() => edit(q.id)}>Изменить</Button></div>)}</Card>)}</div>
      </> : <ValidationContext.Provider value={validationAttempted}><form noValidate onSubmit={next} className="survey-single-form" onKeyDown={e => {
        if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.defaultPrevented || e.target.closest('.g-select, button, a, summary')) return;
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
            <p>{question.sectionDescription || question.section.description || 'Механики Cross-sell во время оформления продукта и после него.'}</p>
            {question.section.introNote && <p>{question.section.introNote}</p>}
          </div>}
          {question.proof && <p className="survey-proof-label"><Icon data={FileText} size={16} /> Источники</p>}
          {question.inlineEvidence?.previousLinks && !question.reportMonitoring && <InlineEvidence question={question} answers={answers} update={update} />}
          {question.introInfo && <section className="survey-crosssell-intro" aria-label={question.introInfo.title}>
            <h2>{question.introInfo.title}</h2>
            <Answer question={question.introInfo} answers={answers} update={update} autoFocus={false} />
          </section>}
          {question.type !== 'numeric' && !question.questionCards && <h1 id="survey-title" ref={heading} tabIndex={-1}>{question.title}</h1>}
          {isCover ? <>
            <p className="survey-cover-lead">Вы проходите опрос в рамках оценки Data Driven 3Q26.</p>
            <p className="survey-intro-copy">В этом опросе учтена информация, которая была собрана при оценке за второй квартал и цифровые следы из систем по продукту.</p>
            <div className="survey-cover-fields survey-answer">{introQuestions.map(q => <div key={q.id}><label>{q.title}</label><Answer question={q} answers={answers} update={update} autoFocus={false} /></div>)}</div>
            {introSummary ? <>
              <p className="survey-cover-count" aria-live="polite">В опросе участвует {sectionCountText(introSummary.sectionCount)}.</p>
              <table className="survey-source-table"><thead><tr><th scope="col">В опросе остаются метрики</th><th scope="col">По цифровым следам забираем</th></tr></thead><tbody><tr>{[introSummary.surveyGroups, introSummary.digitalGroups].map((groups, column) => <td key={column}>{groups.map(group => <section className="survey-source-group" key={group.id} aria-label={group.title}><h3>{group.title}</h3>{group.metrics.some(metric => metric !== group.title) && <ul>{group.metrics.filter(metric => metric !== group.title).map(metric => <li key={metric}>{metric}</li>)}</ul>}</section>)}{!groups.length && <p>Нет применимых метрик</p>}</td>)}</tr></tbody></table>
            </> : <p className="survey-cover-placeholder">Выберите команду, чтобы увидеть число разделов и состав метрик.</p>}
          </> : <>
          {question.type !== 'numeric' && !question.questionCards && <p className="question-hint">{question.hint || (!isSectionStart && question.sectionDescription) || (question.type === 'multi' ? 'Можно выбрать несколько вариантов' : question.proof ? 'Добавьте ссылку или описание, если ссылки нет' : '')}</p>}
          {question.reportMonitoring && !question.evidenceAfterOptions && <><InlineEvidence question={question} answers={answers} update={update} /><p className="survey-selection-hint">Можно выбрать несколько вариантов</p></>}
          <div className="survey-answer">{question.type === 'numeric' ? <section className="survey-metric-card" aria-labelledby="survey-title"><h1 id="survey-title" ref={heading} tabIndex={-1}>{question.title}</h1>{question.detail && <p className="survey-metric-detail">{question.detail}</p>}<p className="question-hint">{question.hint}</p><Answer question={question} answers={answers} update={update} />{question.optionalCommentId && <section className="survey-metric-comment"><label htmlFor={question.optionalCommentId}>Комментарий при необходимости</label><TextArea id={question.optionalCommentId} size="l" minRows={2} placeholder="Введите комментарий" value={answers[question.optionalCommentId] || ''} onUpdate={value => update(question.optionalCommentId, value)} /></section>}</section> : question.questionCards ? <section className="survey-inline-question survey-goals-question survey-goals-first-question" aria-labelledby="survey-title"><h1 id="survey-title" ref={heading} tabIndex={-1}>{question.title}</h1><Answer question={question} answers={answers} update={update} /></section> : <Answer question={question} answers={answers} update={update} />}<InlineProof question={question} answers={answers} update={update} />{((!question.inlineEvidence?.previousLinks && !question.reportMonitoring) || question.evidenceAfterOptions) && <InlineEvidence question={question} answers={answers} update={update} />}{inlineQuestions(question, answers).filter(field => !field.inlineAtOption).map(field => <section className={`survey-inline-question${(question.questionCards || field.questionCards) ? ' survey-goals-question' : ''}`} key={field.id} aria-label={field.title}><h2>{field.title}</h2><Answer question={field} answers={answers} update={update} autoFocus={false} /><InlineProof question={field} answers={answers} update={update} /><InlineEvidence question={field} answers={answers} update={update} /></section>)}</div>
          </>}
        </section>
        <div className="survey-error" role="alert">{validationAttempted && !canContinue ? requiredMessage : error}</div>
        <footer className="survey-actions"><Button type="button" view="flat" size="l" disabled={!editingFromReview && index === 0} onClick={() => editingFromReview ? returnToReview() : go(flow[index - 1].id)}><Icon data={ArrowLeft} size={16} /> {editingFromReview ? 'К проверке' : 'Назад'}</Button><div><Button type="submit" view="action" size="xl" aria-disabled={!canContinue}>{editingFromReview ? 'Сохранить и вернуться' : 'Далее'} <Icon data={ArrowRight} size={17} /></Button></div></footer>
        <div className="survey-under-form"><span>{editingFromReview ? 'Enter — сохранить' : 'Enter — далее'}{question.type === 'text' ? ' · Shift + Enter — новая строка' : ''}</span><span>{index === 0 ? 'Ответы только в этой вкладке' : 'Ваш ответ можно изменить, вернувшись назад'}</span></div>
      </form></ValidationContext.Provider>}
      {review && <footer className="survey-actions"><Button view="flat" size="l" onClick={() => edit(flow.at(-1).id)}><Icon data={ArrowLeft} size={16} /> Назад</Button><Button view="action" size="xl" onClick={next}>Завершить опрос <Icon data={ArrowRight} size={17} /></Button></footer>}
    </main>
    <footer className="survey-page-footer"><span>LossHunter · аналитика для продуктовых решений</span><span>Ваша команда. Ваш продукт. Ваш следующий шаг.</span></footer>
  </div>;
}
