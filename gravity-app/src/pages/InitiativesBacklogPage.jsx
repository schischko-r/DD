import React, {useEffect, useMemo, useState} from 'react';
import {ArrowLeft, ChevronDown, ChevronRight, CircleInfo} from '@gravity-ui/icons';
import {Button, Card, Icon, Label, Link, Spin, Text, TextInput} from '@gravity-ui/uikit';
import {BUTTON_INTENT, SemanticButton} from '../shared/ui/SemanticButton.jsx';
import happyMascot from '../assets/mascot/happy.png';


function RichText({value}) {
  const source = String(value || '');
  const dashboardUrl = source.match(/дашборд[\s\S]*?(https?:\/\/[^\s<]+)/iu)?.[1]?.replace(/[.,;:!?)\]]+$/u, '');
  const renderPlainText = (part, index) => dashboardUrl && /дашборд/iu.test(part)
    ? part.split(/(дашборд)/giu).map((chunk, chunkIndex) => /^дашборд$/iu.test(chunk)
      ? <Link key={`${index}-${chunkIndex}`} href={dashboardUrl} target="_blank" rel="noreferrer">{chunk}</Link>
      : chunk)
    : part;
  const renderLine = (line, lineIndex) => {
    const hiddenDocumentLink = line.match(/^(.*?)(Изменения от 14\.01\.2026 N 2478-6\/1 в Сборник методик)([^()]*)\s*\((https?:\/\/[^\s<]+)\)(.*)$/u);
    if (hiddenDocumentLink) {
      const [, prefix, title, suffix, url, tail] = hiddenDocumentLink;
      return <>{renderPlainText(prefix, `${lineIndex}-prefix`)}<Link href={url} target="_blank" rel="noreferrer">{title}</Link>{renderPlainText(suffix, `${lineIndex}-suffix`)}{renderPlainText(tail, `${lineIndex}-tail`)}</>;
    }
    const namedLink = line.match(/^(.*?)([«"][^»"]+[»"])\s+(https?:\/\/[^\s<]+)$/u);
    if (namedLink) {
      const [, prefix, title, url] = namedLink;
      return <>{renderPlainText(prefix, `${lineIndex}-prefix`)}<Link href={url} target="_blank" rel="noreferrer">{title}</Link></>;
    }
    return line.split(/(https?:\/\/[^\s<]+)/gu).map((part, index) => {
    const url = part.replace(/[.,;:!?)\]]+$/u, '');
    if (/^https?:\/\//u.test(part)) return url === dashboardUrl ? null : <Link key={`${url}-${lineIndex}-${index}`} href={url} target="_blank" rel="noreferrer">{part}</Link>;
    return renderPlainText(part, `${lineIndex}-${index}`);
  });
  };
  const lines = source.split(/\n+/u).map((line) => ({
    value: line.trim(),
    indent: Math.min(3, Math.floor((line.match(/^\s*/u)?.[0].length || 0) / 2)),
  })).filter((line) => line.value);
  const lineKind = (line) => {
    if (/^[А-ЯA-Z][^.!?]{1,48}:$/u.test(line)) return ' initiatives-rich-text-heading';
    if (/^(?:\d+[.)]|[а-яa-z][.)]|[-•])/iu.test(line)) return ' initiatives-rich-text-item';
    if (/^лист\s/iu.test(line)) return ' initiatives-rich-text-item initiatives-rich-text-continuation';
    return '';
  };
  return <Text className="initiatives-rich-text" variant="body-2">{lines.map((line, index) => <span className={`${lineKind(line.value)}${line.indent ? ' initiatives-rich-text-nested' : ''}`} data-indent={line.indent} key={`${line.value}-${index}`}>{renderLine(line.value, index)}</span>)}</Text>;
}

function formatDeadline(value) {
  const deadline = String(value || '').trim();
  if (!deadline) return '';
  return deadline
    .replace(/^1\s*пг\s*(\d{4})\s*г?\.?$/iu, 'I полугодие $1')
    .replace(/^2\s*пг\s*(\d{4})\s*г?\.?$/iu, 'II полугодие $1');
}

function InitiativeRow({item}) {
  const [open, setOpen] = useState(false);
  const deadline = formatDeadline(item.deadline);
  const meta = [item.department, item.owner].filter(Boolean).join(' · ');
  return (
    <div className={`metric-row initiatives-row${open ? ' initiatives-row_open' : ''}`}>
      <button className="initiatives-row-main" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Icon data={open ? ChevronDown : ChevronRight} size={13} />
        <div className="initiatives-row-copy">
          <b>{item.metric}</b>
        </div>
      </button>
      {deadline && <Label className="initiatives-row-deadline" theme="normal">{deadline}</Label>}
      {open && <div className="initiatives-row-detail">
        {item.asIs && <section><Text variant="subheader-1">Реализовано AS IS</Text><RichText value={item.asIs} /></section>}
        {item.toBe && <section><Text variant="subheader-1">Мероприятия TO BE</Text><RichText value={item.toBe} /></section>}
        {meta && <p className="initiatives-row-meta">{meta}</p>}
      </div>}
    </div>
  );
}

export function InitiativesBacklogPage({onBack}) {
  const [data, setData] = useState(null);
  const [block, setBlock] = useState('Все блоки');
  const [query, setQuery] = useState('');
  // Blocks start open: hiding rows behind a second click buried the content.
  const [closedBlocks, setClosedBlocks] = useState(() => new Set());
  useEffect(() => { fetch('./initiatives-backlog.json', {cache: 'no-store'}).then((response) => response.json()).then(setData); }, []);
  const toggleBlock = (value) => setClosedBlocks((current) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  });
  const blocks = useMemo(() => ['Все блоки', ...new Set((data || []).map((item) => item.block))], [data]);
  const items = useMemo(() => (data || []).filter((item) => (block === 'Все блоки' || item.block === block) && `${item.metric} ${item.asIs} ${item.toBe} ${item.department} ${item.owner}`.toLocaleLowerCase('ru-RU').includes(query.toLocaleLowerCase('ru-RU'))), [data, block, query]);
  const groups = useMemo(() => items.reduce((result, item) => {
    const group = result.find((entry) => entry.block === item.block);
    if (group) group.items.push(item);
    else result.push({block: item.block, items: [item]});
    return result;
  }, []), [items]);
  // A narrowed list is already one block deep, so its rows stay open.
  const filtered = block !== 'Все блоки' || Boolean(query.trim());
  if (!data) return <main className="content initiatives-page"><div className="initiatives-document"><SemanticButton className="initiatives-back" intent={BUTTON_INTENT.navigation} onClick={onBack}><Icon data={ArrowLeft} size={16} /> К Summary</SemanticButton><Spin size="xl" /></div></main>;
  return <main className="content initiatives-page"><div className="initiatives-document"><SemanticButton className="initiatives-back" intent={BUTTON_INTENT.navigation} onClick={onBack}><Icon data={ArrowLeft} size={16} /> К Summary</SemanticButton>
    <section className="initiatives-hero"><div><div className="initiatives-eyebrow"><Icon data={CircleInfo} size={16} /><span>Data-Driven B2C</span></div><h1>Развитие инструмента</h1><Text variant="body-2" color="secondary">Централизованные мероприятия по развитию практик и повышению Data-Driven Index.</Text></div><img src={happyMascot} alt="" aria-hidden="true" /></section>
    <Card className="initiatives-controls" view="outlined" type="container" size="l"><div><Text variant="subheader-1">Бэклог мероприятий</Text><Text color="secondary">{items.length} из {data.length} направлений</Text></div><TextInput value={query} onUpdate={setQuery} placeholder="Поиск" hasClear /></Card>
    <div className="initiatives-filter" role="group" aria-label="Блок DD">{blocks.map((value) => <Button key={value} view="flat" size="m" selected={block === value} onClick={() => setBlock(value)}>{value}</Button>)}</div>
    <div className="metrics-grid initiatives-grid">
      {groups.map((group) => {
        const isOpen = filtered || !closedBlocks.has(group.block);
        return (
          <Card className="metric-block initiatives-block" key={group.block} view="outlined">
            <div className="dd-metric-block-head">
              <button className="dd-metric-block-main" type="button" onClick={() => toggleBlock(group.block)} aria-expanded={isOpen} disabled={filtered}>
                {!filtered && <Icon data={isOpen ? ChevronDown : ChevronRight} size={14} />}
                <div><h3>{group.block}</h3></div>
              </button>
              <div className="dd-metric-block-help" />
              <div className="dd-metric-block-score"><strong>{group.items.length}</strong></div>
            </div>
            {isOpen && <div className="metric-list">
              {group.items.map((item) => <InitiativeRow key={item.id} item={item} />)}
            </div>}
          </Card>
        );
      })}
      {!groups.length && <Card className="initiatives-empty" view="outlined" type="container"><Text color="secondary">Ничего не найдено</Text></Card>}
    </div>
  </div></main>;
}
