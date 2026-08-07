import React, {useEffect, useMemo, useState} from 'react';
import {Button, Card, Dialog, HelpMark, Label, Link, Spin, Text, TextInput} from '@gravity-ui/uikit';
import happyMascot from '../assets/mascot/happy.png';

const HELP_POPOVER_PROPS = {trigger: 'all', openDelay: 0, closeDelay: 80, rest: 0};

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
  if (!deadline) return 'Срок не указан';
  return deadline
    .replace(/^1\s*пг\s*(\d{4})\s*г?\.?$/iu, 'I полугодие $1')
    .replace(/^2\s*пг\s*(\d{4})\s*г?\.?$/iu, 'II полугодие $1');
}

function CompactText({value, onOpen}) {
  const dashboardUrl = String(value || '').match(/дашборд[\s\S]*?(https?:\/\/[^\s<]+)/iu)?.[1]?.replace(/[.,;:!?)\]]+$/u, '');
  return <div className="initiatives-cell-text"><RichText value={value} /><div className="initiatives-cell-actions">{dashboardUrl && <Link className="initiatives-dashboard-link" href={dashboardUrl} target="_blank" rel="noreferrer">Дашборд</Link>}<Button view="flat" size="s" onClick={onOpen}>Подробнее</Button></div></div>;
}

function PeopleList({value}) {
  const people = String(value || 'Не указано')
    .split(/[\n,/]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
  return <Text className="initiatives-people" variant="body-2">{people.map((person) => <span key={person}>{person}</span>)}</Text>;
}

function InitiativeInfo({item}) {
  return <HelpMark className="initiatives-info-mark" aria-label={`Ответственные и ожидаемый эффект: ${item.metric}`} popoverProps={HELP_POPOVER_PROPS}><div className="initiatives-info-box">
    <section><Text variant="caption-2" color="secondary">ПОДРАЗДЕЛЕНИЕ</Text><Text variant="body-2">{item.department || 'Не указано'}</Text></section>
    <section><Text variant="caption-2" color="secondary">ФИО</Text><PeopleList value={item.owner} /></section>
    {item.effect && <section><Text variant="caption-2" color="secondary">ОЖИДАЕМЫЙ ЭФФЕКТ</Text><RichText value={item.effect} /></section>}
  </div></HelpMark>;
}

export function InitiativesBacklogPage() {
  const [data, setData] = useState(null);
  const [block, setBlock] = useState('Все блоки');
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  useEffect(() => { fetch('./initiatives-backlog.json', {cache: 'no-store'}).then((response) => response.json()).then(setData); }, []);
  const blocks = useMemo(() => ['Все блоки', ...new Set((data || []).map((item) => item.block))], [data]);
  const items = useMemo(() => (data || []).filter((item) => (block === 'Все блоки' || item.block === block) && `${item.metric} ${item.asIs} ${item.toBe} ${item.department} ${item.owner}`.toLocaleLowerCase('ru-RU').includes(query.toLocaleLowerCase('ru-RU'))), [data, block, query]);
  const groups = useMemo(() => items.reduce((result, item) => {
    const group = result.find((entry) => entry.block === item.block);
    if (group) group.items.push(item);
    else result.push({block: item.block, items: [item]});
    return result;
  }, []), [items]);
  if (!data) return <main className="content initiatives-page"><Spin size="xl" /></main>;
  return <main className="content initiatives-page"><div className="initiatives-document">
    <section className="initiatives-hero"><div><Text variant="caption-2" color="secondary">DATA-DRIVEN B2C</Text><h1>Развитие инструмента</h1><Text variant="body-2" color="secondary">Централизованные мероприятия по развитию практик и повышению Data-Driven Index.</Text></div><img src={happyMascot} alt="" aria-hidden="true" /></section>
    <Card className="initiatives-controls" view="outlined" type="container" size="l"><div><Text variant="subheader-1">Бэклог мероприятий</Text><Text color="secondary">{items.length} из {data.length} направлений</Text></div><TextInput value={query} onUpdate={setQuery} placeholder="Поиск" hasClear /></Card>
    <div className="initiatives-filter" role="group" aria-label="Блок DD">{blocks.map((value) => <Button key={value} view="flat" size="m" selected={block === value} onClick={() => setBlock(value)}>{value}</Button>)}</div>
    <div className="initiatives-groups">
      {groups.map((group) => <Card className="initiatives-group" key={group.block} view="outlined" type="container">
        <div className="initiatives-group-header"><div><Text variant="caption-2" color="secondary">КЛЮЧЕВОЙ БЛОК DD-РЕЙТИНГА</Text><Text variant="subheader-2">{group.block}</Text></div><Label theme="info">{group.items.length}</Label></div>
        <div className="initiatives-group-list">{group.items.map((item) => <button className="initiatives-group-row" type="button" key={item.id} onClick={() => setSelectedItem(item)}>
          <span className="initiatives-group-metric">{item.metric}</span><span className="initiatives-group-deadline">{formatDeadline(item.deadline)}</span><span className="initiatives-open-hint">Открыть →</span>
        </button>)}</div>
      </Card>)}
      {!groups.length && <Card className="initiatives-empty" view="outlined" type="container"><Text color="secondary">Ничего не найдено</Text></Card>}
    </div>
    <Dialog className="initiatives-dialog" open={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} hasCloseButton maxWidth="l" fullWidth contentOverflow="auto">
      {selectedItem && <><Dialog.Header caption={selectedItem.metric} /><Dialog.Body><div className="initiatives-detail">
        <div className={`initiatives-detail-columns${!(selectedItem.asIs && selectedItem.toBe) ? ' initiatives-detail-columns_single' : ''}`}>
          {selectedItem.asIs && <section><Text variant="subheader-1">Реализовано AS IS</Text><RichText value={selectedItem.asIs} /></section>}
          {selectedItem.toBe && <section><Text variant="subheader-1">Мероприятия TO BE</Text><RichText value={selectedItem.toBe} /></section>}
        </div>
        {selectedItem.effect && <section><Text variant="subheader-1">Ожидаемый эффект</Text><RichText value={selectedItem.effect} /></section>}
        {(selectedItem.department || selectedItem.owner || selectedItem.deadline) && <div className="initiatives-detail-meta">
          {selectedItem.department && <section><Text variant="caption-2" color="secondary">ПОДРАЗДЕЛЕНИЕ</Text><Text variant="body-2">{selectedItem.department}</Text></section>}
          {selectedItem.owner && <section><Text variant="caption-2" color="secondary">ОТВЕТСТВЕННЫЕ</Text><PeopleList value={selectedItem.owner} /></section>}
          {selectedItem.deadline && <section><Text variant="caption-2" color="secondary">СРОК</Text><Text variant="body-2">{formatDeadline(selectedItem.deadline)}</Text></section>}
        </div>}
      </div></Dialog.Body></>}
    </Dialog>
  </div></main>;
}
