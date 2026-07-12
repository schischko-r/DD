import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUpRightFromSquare,
  BarsAscendingAlignLeft,
  ChartColumn,
  ChartMixed,
  CircleDollar,
  ChevronDown,
  ChevronRight,
  CircleInfo,
  Magnifier,
  NodesRight,
  Persons,
} from '@gravity-ui/icons';
import {
  Alert,
  Button,
  Card,
  Dialog,
  HelpMark,
  Icon,
  Label,
  Progress,
  Select,
  Spin,
  Text,
  TextInput,
  ThemeProvider,
} from '@gravity-ui/uikit';
import {AsideHeader} from '@gravity-ui/navigation';
import {Legend, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip} from 'recharts';
import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';
import './theme.css';
import './styles.css';
import ocb2cLogo from './assets/ocb2c.png';

const REPORT_ACCESS_REQUEST_URL = 'https://sberfriend.sberbank.ru/deeplink-hash-catcher/?path=L3NiZXJmcmllbmQv&callback=L2RlZXBsaW5rLWtlZXBlci8=#/application/F3C76EADA61AB8EBE053F7E9740A44EF?sberfriend.searchQuery=%D0%94%D1%80%D1%83%D0%B3%D0%B5%20%D0%BE%D1%84%D0%BE%D1%80%D0%BC%D0%B8%D1%82%D1%8C%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%20%D0%BA%20%D1%81%D1%82%D0%B5%D0%BD%D0%B4%D0%B0%D0%BC%20%D1%80%D0%B0%D0%B7%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BA%D0%B8%20%D0%B8%20%D1%82%D0%B5%D1%81%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F';
const COMPLEX_REPORT_URL = 'http://tvlds-mvp001760.cloud.delta.sbrf.ru:8014/complex-report';
const HELP_POPOVER_PROPS = {trigger: 'all', openDelay: 0, closeDelay: 80, rest: 0};
const TEAM_CONTACT_EMAIL = 'MYCherkova@sberbank.ru';

function scoreFor(product, rows) {
  return rows.find((row) => row.name === product.name && row.unit === product.unit)?.score ?? 0;
}

function groupFor(product, rows) {
  return rows.find((row) => row.name === product.name && row.unit === product.unit)?.group || 'Нет данных';
}

function progressTheme(value) {
  if (value >= 60) return 'success';
  if (value >= 40) return 'warning';
  return 'danger';
}

function maturityTheme(group) {
  const value = String(group || '').toLowerCase();
  if (value.includes('лидер')) return 'success';
  if (value.includes('зрел')) return 'info';
  if (value.includes('развива')) return 'warning';
  if (value.includes('вниман')) return 'danger';
  return 'default';
}

function percent(value, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(value) / Number(max)) * 100)));
}

function blockPercent(block) {
  const metrics = block.metrics || [];
  const value = metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
  const max = metrics.reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
  return percent(value, max);
}

function metricGroup(metric) {
  return String(metric.metric_subgroup || '').trim();
}

function collectBlockLinks(block) {
  const links = [];
  const add = (item, fallbackLabel) => {
    const url = item?.url || item?.link || item?.button?.link;
    const label = item?.label || item?.button?.label || fallbackLabel;
    if (url && label) links.push({label, url});
  };

  (block.actions || []).forEach((item) => add(item));
  (block.metrics || []).forEach((metric) => {
    add(metric.button, metric.name);
    (metric.buttons || []).forEach((item) => add(item, metric.name));
  });
  if (block.info?.button) add({...block.info.button, label: block.info.title || block.info.button.label});
  (block.info?.links || []).forEach((item) => add(item));

  return links.filter((item, index) => links.findIndex((candidate) => candidate.label === item.label && candidate.url === item.url) === index);
}

function linksForBlock(block, allBlocks = []) {
  const draftLinks = allBlocks.flatMap(collectBlockLinks).filter((item) => /черновик/i.test(item.label));
  const ownLinks = collectBlockLinks(block).filter((item) => block.code === 'attract' || !/черновик/i.test(item.label));
  const relocatedLinks = block.code === 'attract' ? [...ownLinks, ...draftLinks] : ownLinks;
  const uniqueLinks = relocatedLinks.filter((item, index) => relocatedLinks.findIndex((candidate) => candidate.label === item.label && candidate.url === item.url) === index);
  return block.code === 'cx'
    ? uniqueLinks.filter((item) => /^(открыть )?(cx|ux) score$/i.test(item.label))
    : uniqueLinks;
}

const nameCollator = new Intl.Collator('en', {sensitivity: 'base', numeric: true});
const compareNames = (a, b) => nameCollator.compare(String(a || ''), String(b || ''));

function typeTone(type) {
  const value = String(type || '').toLowerCase();
  if (value.includes('сегмент')) return 'segment';
  if (value.includes('канал')) return 'channel';
  return 'product';
}

function radarSeries(type) {
  const tone = typeTone(type);
  if (tone === 'segment') return {label: 'Сегмент', stroke: 'var(--g-color-text-warning-heavy)', fill: 'var(--g-color-base-warning-heavy)'};
  if (tone === 'channel') return {label: 'Канал', stroke: 'var(--g-color-text-info-heavy)', fill: 'var(--g-color-base-info-heavy)'};
  return {label: 'Продукт', stroke: 'var(--g-color-text-positive-heavy)', fill: 'var(--g-color-base-positive-heavy)'};
}

function metricWord(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'метрика';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'метрики';
  return 'метрик';
}

function difficultyMeta(value) {
  if (value <= 3) return {label: 'Легко', theme: 'success'};
  if (value <= 6) return {label: 'Средне', theme: 'warning'};
  return {label: 'Сложно', theme: 'danger'};
}

const catalogGroups = [
  {type: 'Продукт', label: 'Продукты', tone: 'product'},
  {type: 'Сегмент', label: 'Сегменты', tone: 'segment'},
  {type: 'Канал', label: 'Каналы', tone: 'channel'},
];

function CatalogDialog({openType, products, rows, onOpen, onClose}) {
  const [expandedUnits, setExpandedUnits] = useState({});
  const [expandedTypes, setExpandedTypes] = useState({});
  const units = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      const row = rows.find((item) => item.name === product.name && item.unit === product.unit);
      const unitName = product.unit || 'Без юнита';
      if (!map.has(unitName)) map.set(unitName, {name: unitName, items: []});
      map.get(unitName).items.push({
        ...product,
        type: product.type || row?.type || 'Продукт',
        score: Number(row?.score || 0),
        group: row?.group || groupFor(product, rows),
      });
    });
    return [...map.values()]
      .map((unit) => ({
        ...unit,
        items: unit.items.sort((a, b) => compareNames(a.name, b.name)),
        avg: Math.round(unit.items.reduce((sum, item) => sum + item.score, 0) / Math.max(unit.items.length, 1)),
      }))
      .sort((a, b) => compareNames(a.name, b.name));
  }, [products, rows]);
  const orderedGroups = useMemo(() => {
    const selected = catalogGroups.find((group) => group.type === openType);
    if (!selected) return catalogGroups;
    return [selected, ...catalogGroups.filter((group) => group.type !== openType)];
  }, [openType]);
  const isFlatSegmentCatalog = openType === catalogGroups.find((group) => group.tone === 'segment')?.type;
  const flatItems = useMemo(() => units
    .flatMap((unit) => unit.items.map((item) => ({...item, unit: unit.name})))
    .filter((item) => item.type === openType)
    .sort((a, b) => compareNames(a.name, b.name)), [units, openType]);

  useEffect(() => {
    if (!openType) return;
    setExpandedUnits(Object.fromEntries(units.map((unit) => [unit.name, true])));
    setExpandedTypes(Object.fromEntries(units.map((unit) => [`${unit.name}:${openType}`, true])));
  }, [openType, units]);

  const toggleUnit = (unitName) => {
    const willOpen = !expandedUnits[unitName];
    setExpandedUnits((state) => ({...state, [unitName]: willOpen}));
    if (willOpen && openType) {
      setExpandedTypes((state) => ({...state, [`${unitName}:${openType}`]: true}));
    }
  };

  const toggleType = (key) => setExpandedTypes((state) => ({...state, [key]: !state[key]}));
  const openItem = (item) => {
    onClose();
    onOpen(item);
  };
  const renderItemRow = (item, key, className = '') => {
    const tone = maturityTheme(item.group);
    return (
      <button type="button" className={`catalog-row catalog-item-row ${className} tone-${tone}`} key={key} onClick={() => openItem(item)}>
        <span className="catalog-title"><span className={`type-label type-label-${typeTone(item.type)}`}>{item.type}</span><b title={item.name}>{item.name}</b></span>
        <span>{item.type}</span>
        <strong>{item.score}%</strong>
        <Label theme={tone}>{item.group}</Label>
      </button>
    );
  };

  return (
    <Dialog open={Boolean(openType)} onClose={onClose} hasCloseButton maxWidth="xl" fullWidth contentOverflow="auto">
      <Dialog.Body>
        <div className="catalog-table">
          <div className="catalog-table-head"><span>{isFlatSegmentCatalog ? 'Команда' : 'Юнит / команда'}</span><span>Тип</span><span>Data-Driven Index</span><span>Статус</span></div>
          {isFlatSegmentCatalog ? flatItems.map((item) => renderItemRow(item, `${item.unit}-${item.type}-${item.name}`, 'catalog-flat-row')) : units.map((unit) => {
            const unitOpen = Boolean(expandedUnits[unit.name]);
            return (
              <React.Fragment key={unit.name}>
                <button type="button" className="catalog-row catalog-unit-row" onClick={() => toggleUnit(unit.name)}>
                  <span className="catalog-title"><Icon data={unitOpen ? ChevronDown : ChevronRight} size={14} /><b>{unit.name}</b><small>{unit.items.length} команд</small></span>
                  <span>Юнит</span>
                  <strong>{unit.avg}%</strong>
                  <span>{catalogGroups.map((group) => `${group.label}: ${unit.items.filter((item) => item.type === group.type).length}`).join(' · ')}</span>
                </button>
                {unitOpen && orderedGroups.map((group) => {
                  const items = unit.items.filter((item) => item.type === group.type);
                  const typeKey = `${unit.name}:${group.type}`;
                  const typeOpen = Boolean(expandedTypes[typeKey]);
                  const avg = items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : null;
                  return (
                    <React.Fragment key={typeKey}>
                      <button type="button" className={`catalog-row catalog-type-row catalog-type-${group.tone}`} onClick={() => items.length && toggleType(typeKey)} disabled={!items.length}>
                        <span className="catalog-title"><Icon data={typeOpen ? ChevronDown : ChevronRight} size={14} /><b>{group.label}</b><small>{items.length ? `${items.length} команд` : 'Нет данных'}</small></span>
                        <span>{group.type}</span>
                        <strong>{avg === null ? '—' : `${avg}%`}</strong>
                        <span>{items.length ? 'средний DD-индекс' : 'Команды этого типа не добавлены'}</span>
                      </button>
                      {typeOpen && items.map((item) => {
                        return renderItemRow(item, `${unit.name}-${group.type}-${item.name}`);
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </Dialog.Body>
    </Dialog>
  );
}

function CatalogDialogFiltered({openType, products, rows, onOpen, onClose}) {
  const [expandedUnits, setExpandedUnits] = useState({});
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('score');
  const selectedType = useMemo(() => catalogGroups.find((group) => group.type === openType), [openType]);
  const units = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      const row = rows.find((item) => item.name === product.name && item.unit === product.unit);
      const type = product.type || row?.type || catalogGroups[0].type;
      if (!selectedType || type !== selectedType.type) return;
      const unitName = product.unit || '\u0411\u0435\u0437 \u044e\u043d\u0438\u0442\u0430';
      if (!map.has(unitName)) map.set(unitName, {name: unitName, items: []});
      map.get(unitName).items.push({
        ...product,
        type,
        score: Number(row?.score || 0),
        group: row?.group || groupFor(product, rows),
      });
    });
    return [...map.values()]
      .map((unit) => ({
        ...unit,
        items: unit.items.sort((a, b) => compareNames(a.name, b.name)),
        avg: Math.round(unit.items.reduce((sum, item) => sum + item.score, 0) / Math.max(unit.items.length, 1)),
      }))
      .sort((a, b) => compareNames(a.name, b.name));
  }, [products, rows, selectedType]);
  const isFlatCatalog = selectedType?.tone !== 'product';
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleUnits = useMemo(() => units
    .map((unit) => {
      const unitMatches = normalizedQuery && unit.name.toLocaleLowerCase().includes(normalizedQuery);
      const items = !normalizedQuery || unitMatches
        ? unit.items
        : unit.items.filter((item) => item.name.toLocaleLowerCase().includes(normalizedQuery));
      return {...unit, items, avg: items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0};
    })
    .filter((unit) => unit.items.length > 0)
    .sort((a, b) => sort === 'score' ? (b.avg - a.avg) || compareNames(a.name, b.name) : compareNames(a.name, b.name)), [units, normalizedQuery, sort]);
  const flatItems = useMemo(() => visibleUnits.flatMap((unit) => unit.items.map((item) => ({...item, unit: unit.name}))).sort((a, b) => sort === 'score' ? (b.score - a.score) || compareNames(a.name, b.name) : compareNames(a.name, b.name)), [visibleUnits, sort]);

  useEffect(() => {
    if (!openType) return;
    setExpandedUnits({});
    setQuery('');
    setSort('score');
  }, [openType, units]);

  const renderItemRow = (item, key, flat = false) => {
    const tone = maturityTheme(item.group);
    return (
      <button type="button" className={`catalog-row catalog-item-row tone-${tone}`} key={key} onClick={() => { onClose(); onOpen(item); }}>
        <span className="catalog-title"><b title={item.name}>{item.name}</b></span>
        {flat && <span>{item.unit}</span>}
        <strong>{item.score}%</strong>
        <Label theme={tone}>{item.group}</Label>
      </button>
    );
  };

  return (
    <Dialog open={Boolean(openType)} onClose={onClose} hasCloseButton maxWidth="l" fullWidth className="catalog-dialog" contentOverflow="auto">
      <Dialog.Header caption={`${'\u0412\u0441\u0435'} ${(selectedType?.label || '').toLowerCase()}`} />
      <Dialog.Body className="catalog-dialog-body">
        <div className="catalog-toolbar">
          <div className="catalog-search">
            <div className="catalog-search-copy"><b>Поиск команды</b></div>
            <TextInput value={query} onUpdate={setQuery} placeholder="Начните вводить название" size="m" />
          </div>
          <div className="catalog-toolbar-actions">
            <div className="catalog-sort" role="group" aria-label={'\u0421\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u043a\u0430'}>
              <Button selected={sort === 'name'} onClick={() => setSort('name')}>{'\u041f\u043e \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044e'}</Button>
              <Button selected={sort === 'score'} onClick={() => setSort('score')}>{'\u041f\u043e Data-Driven Index'}<Icon data={ArrowDown} size={14} /></Button>
            </div>
          </div>
        </div>
        <div className={`catalog-table ${isFlatCatalog ? 'catalog-table-flat' : 'catalog-table-product'}`}>
          <div className="catalog-table-head"><span>{isFlatCatalog ? (selectedType?.label || '') : `${'\u042e\u043d\u0438\u0442'} / ${selectedType?.label || ''}`}</span><span>{isFlatCatalog ? '\u042e\u043d\u0438\u0442' : 'Data-Driven Index'}</span><span>{isFlatCatalog ? 'Data-Driven Index' : '\u0421\u0442\u0430\u0442\u0443\u0441'}</span><span>{isFlatCatalog ? '\u0421\u0442\u0430\u0442\u0443\u0441' : '\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435'}</span></div>
          {isFlatCatalog ? flatItems.map((item) => renderItemRow(item, `${item.unit}-${openType}-${item.name}`, true)) : visibleUnits.map((unit) => {
            const unitOpen = Boolean(normalizedQuery || expandedUnits[unit.name]);
            return (
              <React.Fragment key={unit.name}>
                <button type="button" className="catalog-row catalog-unit-row" onClick={() => setExpandedUnits((state) => ({...state, [unit.name]: !unitOpen}))}>
                  <span className="catalog-title"><Icon data={unitOpen ? ChevronDown : ChevronRight} size={14} /><b>{unit.name}</b><small>{unit.items.length} {'\u043a\u043e\u043c\u0430\u043d\u0434'}</small></span>
                  <strong>{unit.avg}%</strong>
                  <span>{selectedType?.label || ''}</span>
                  <span>{unitOpen ? '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c' : '\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c'}</span>
                </button>
                {unitOpen && unit.items.map((item) => renderItemRow(item, `${unit.name}-${openType}-${item.name}`))}
              </React.Fragment>
            );
          })}
          {!visibleUnits.length && <div className="catalog-empty">{'\u0412 \u0442\u0435\u043a\u0443\u0449\u0435\u043c \u043f\u0435\u0440\u0438\u043e\u0434\u0435 \u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u043f\u043e \u0442\u0438\u043f\u0443 \u00ab'}{selectedType?.label || ''}{'\u00bb.'}</div>}
        </div>
      </Dialog.Body>
    </Dialog>
  );
}

function Summary({products, rows, onOpen, initialType = ''}) {
  const [unit, setUnit] = useState([]);
  const [type, setType] = useState(initialType ? [initialType] : []);
  const [sort, setSort] = useState('name');
  const units = useMemo(() => [...new Set(products.map((item) => item.unit).filter(Boolean))].sort(compareNames), [products]);
  const types = useMemo(() => [...new Set(rows.map((item) => item.type).filter(Boolean))].sort(compareNames), [rows]);
  const filteredRows = rows.filter((item) => (!unit.length || unit.includes(item.unit)) && (!type.length || type.includes(item.type)));
  const filteredUnits = new Set(filteredRows.map((item) => item.unit).filter(Boolean));
  const avg = Math.round(filteredRows.reduce((sum, row) => sum + Number(row.score || 0), 0) / Math.max(filteredRows.length, 1));
  const grouped = useMemo(() => {
    const groups = new Map();
    filteredRows.forEach((row) => {
      if (!groups.has(row.unit)) groups.set(row.unit, []);
      groups.get(row.unit).push(row);
    });
    const result = [...groups.entries()].map(([name, items]) => ({
      name,
      items: [...items].sort((a, b) => sort === 'score' ? (b.score - a.score) || compareNames(a.name, b.name) : compareNames(a.name, b.name)),
      avg: Math.round(items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length),
    }));
    return result.sort((a, b) => sort === 'score' ? (b.avg - a.avg) || compareNames(a.name, b.name) : compareNames(a.name, b.name));
  }, [filteredRows, sort]);
  const productByRow = (row) => products.find((item) => item.name === row.name && item.unit === row.unit);

  return (
    <main className="content">
      <header className="page-header">
        <div><h1>Data-Driven Index</h1></div>
        <div className="summary-stats">
          <Card view="outlined"><strong>{filteredRows.length}</strong><span>команд</span></Card>
          <Card view="outlined"><strong>{filteredUnits.size}</strong><span>юнитов</span></Card>
          <Card view="outlined"><strong>{avg}%</strong><span>средний Data-Driven Index</span></Card>
        </div>
      </header>

      <section className="report-controls" aria-label="Фильтры">
        <label><span>Юнит</span><Select value={unit} onUpdate={setUnit} placeholder="Все юниты" size="m" width={190}>
          {units.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}
        </Select></label>
        <label><span>Тип</span><Select value={type} onUpdate={setType} placeholder="Все типы" size="m" width={160}>
          {types.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}
        </Select></label>
        <div className="sort-control" role="group" aria-label="Сортировка">
          <Button selected={sort === 'name'} onClick={() => setSort('name')}>По названию</Button>
          <Button selected={sort === 'score'} onClick={() => setSort('score')}>По Data-Driven Index{sort === 'score' && <Icon data={ArrowDown} size={14} />}</Button>
        </div>
      </section>

      <Card className="report-table" view="outlined">
        <div className="report-table-head"><span>Команда</span><span>Data-Driven Index</span><span>Группа</span><span>Действие</span></div>
        {grouped.map((group) => <section className="unit-group" key={group.name}>
          <div className="unit-row"><div><i /> <b>{group.name}</b><span>{group.items.length} команд</span></div><span>средний Data-Driven Index <b>{group.avg}%</b></span></div>
          {group.items.map((row) => {
            const product = productByRow(row);
            const tone = maturityTheme(row.group);
            const openRow = () => product && onOpen(product);
            return <div className={`report-row tone-${tone}${product ? ' report-row-action' : ''}`} key={row.id} role={product ? 'button' : undefined} tabIndex={product ? 0 : undefined} onClick={openRow} onKeyDown={(event) => { if (product && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openRow(); } }}>
              <div className="team-cell"><span className={`type-label type-label-${typeTone(row.type)}`}>{row.type}</span><b title={row.name}>{row.name}</b></div>
              <div className="score-cell"><strong>{row.score}%</strong><Progress value={row.score} theme={tone} size="xs" /></div>
              <div><Label theme={tone}>{row.group}</Label></div>
              <div><Button view="outlined-info" disabled={!product} onClick={(event) => { event.stopPropagation(); openRow(); }}>Перейти</Button></div>
            </div>;
          })}
        </section>)}
      </Card>
    </main>
  );
}

function DashboardSummary({products, rows, onOpen}) {
  const [catalogType, setCatalogType] = useState('');
  const [teamContactOpen, setTeamContactOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const periods = useMemo(() => [...new Set(products.map((item) => item.period).filter(Boolean))].sort(compareNames), [products]);
  const [period, setPeriod] = useState(() => periods[0] || '');
  const [unit, setUnit] = useState('');
  const [hoveredBlock, setHoveredBlock] = useState('');
  const units = useMemo(() => [...new Set(products.filter((item) => !period || item.period === period).map((item) => item.unit).filter(Boolean))].sort(compareNames), [products, period]);
  const periodProducts = useMemo(() => products.filter((item) => !period || item.period === period), [products, period]);
  const teamMatches = useMemo(() => {
    const normalizedQuery = teamQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return periodProducts.filter((item) => [item.name, item.type, item.unit]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => compareNames(a.name, b.name))
      .slice(0, 10);
  }, [periodProducts, teamQuery]);
  const scopedProducts = useMemo(() => products.filter((item) => (!period || item.period === period) && (!unit || item.unit === unit)), [products, period, unit]);
  const rowForProduct = (product) => rows.find((row) => row.name === product.name && row.unit === product.unit);
  const categoryMeta = [
    {key: 'product', label: 'Продукты', typeLabel: 'Продукт', icon: CircleDollar, tone: 'product'},
    {key: 'segment', label: 'Сегменты', typeLabel: 'Сегмент', icon: Persons, tone: 'segment'},
    {key: 'channel', label: 'Каналы', typeLabel: 'Канал', icon: NodesRight, tone: 'channel'},
  ];
  const categoryCards = categoryMeta.map((category) => {
    const items = scopedProducts
      .filter((item) => typeTone(item.type) === category.key)
      .map((item) => ({...item, score: Number(rowForProduct(item)?.score || 0)}))
      .sort((a, b) => (b.score - a.score) || compareNames(a.name, b.name));
    const average = items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : null;
    return {...category, items, average};
  });
  const blockNames = scopedProducts[0]?.metrics?.map((block) => ({code: block.code, name: block.name})) || [];
  const radarData = blockNames.map((block) => {
    const averageFor = (source) => {
      const values = source
        .map((product) => product.metrics?.find((item) => item.code === block.code))
        .filter((item) => item && (item.metrics || []).some((metric) => metric.is_applicabble_flg !== false))
        .map(blockPercent);
      return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    };
    return {name: block.name, b2c: averageFor(periodProducts), unit: averageFor(scopedProducts)};
  });
  const radarScoreValues = (unit ? scopedProducts : periodProducts)
    .map((product) => rowForProduct(product)?.score)
    .filter((score) => Number.isFinite(Number(score)))
    .map(Number);
  const radarAverage = radarScoreValues.length
    ? Math.round(radarScoreValues.reduce((sum, score) => sum + score, 0) / radarScoreValues.length)
    : null;
  const antiTop = useMemo(() => {
    const metricGroups = new Map();
    scopedProducts.forEach((product) => (product.metrics || []).forEach((block) => (block.metrics || []).forEach((metric) => {
      if (metric.is_applicabble_flg === false || !Number(metric.max_value)) return;
      const key = `${block.code}:${metric.code}`;
      if (!metricGroups.has(key)) metricGroups.set(key, {name: metric.name, block: block.name, values: [], teams: new Set()});
      const group = metricGroups.get(key);
      group.values.push(percent(metric.value, metric.max_value));
      group.teams.add(product.name);
    })));
    return [...metricGroups.values()].map((item) => ({
      name: item.name,
      block: item.block,
      teams: item.teams.size,
      score: Math.round(item.values.reduce((sum, value) => sum + value, 0) / item.values.length),
    })).sort((a, b) => (a.score - b.score) || compareNames(a.name, b.name)).slice(0, 7);
  }, [scopedProducts]);

  return (
    <main className="content dashboard-page">
      <header className="dashboard-header">
        <div><h1>Summary</h1><Text variant="body-1" color="secondary">Сводный профиль Data-Driven Index по B2C</Text></div>
        <div className="dashboard-header-actions">
          <div className="dashboard-team-search">
            <div className="dashboard-team-search-head">
              <Text variant="subheader-1">Найти свою команду</Text>
              <Button view="flat-danger" size="s" onClick={() => setTeamContactOpen(true)}>Не нашли свою команду?</Button>
            </div>
            <TextInput value={teamQuery} onUpdate={setTeamQuery} placeholder="Начните вводить название" size="m" hasClear />
            {teamQuery && <div className="dashboard-team-search-menu">{teamMatches.length ? teamMatches.map((item) => <Button key={item.id} view="flat" width="max" onClick={() => { setTeamQuery(''); onOpen(item); }}><span className="dashboard-team-search-result"><b>{item.name}</b><small>{item.type} · {item.unit}</small></span></Button>) : <Text color="secondary">Команда не найдена</Text>}</div>}
          </div>
          <label className="dashboard-period"><span>Период</span><Select value={period ? [period] : []} onUpdate={(value) => setPeriod(value[0] || '')} width={190}>{periods.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}</Select></label>
        </div>
      </header>

      <Dialog open={teamContactOpen} onClose={() => setTeamContactOpen(false)} hasCloseButton maxWidth="s">
        <Dialog.Header caption="Не нашли свою команду?" />
        <Dialog.Body>
          <Text variant="body-2">Для добавления команды или уточнения статуса напишите Марии Черковой:</Text>
          <a className="team-contact-email" href={`mailto:${TEAM_CONTACT_EMAIL}`}>{TEAM_CONTACT_EMAIL}</a>
        </Dialog.Body>
      </Dialog>

      <section className="dashboard-category-grid" aria-label="Сводка по типам команд">
        {categoryCards.map((category) => <Card key={category.key} className={`dashboard-category-card dashboard-category-${category.tone}`} view="outlined">
          <div className="dashboard-category-head"><div className="dashboard-category-icon"><Icon data={category.icon} size={20} /></div><h2>{category.label}</h2></div>
          <div className="dashboard-category-score"><div>{category.average === null ? <Text variant="subheader-2" color="secondary">Нет данных</Text> : <><strong>{category.average}%</strong><span>/100</span></>}</div><span className="dashboard-category-caption">Средний Data-Driven Index</span><small>Оценено команд: <b>{category.items.length}</b></small></div>
          <div className="dashboard-examples"><span>Топ команд</span>{category.items.length ? category.items.slice(0, 3).map((item) => <button type="button" className="dashboard-example" key={`${item.unit}-${item.name}`} onClick={() => onOpen(item)}><b title={item.name}>{item.name}</b><Progress value={item.score} theme={progressTheme(item.score)} size="xs" /><strong>{item.score}</strong></button>) : <Text variant="body-1" color="secondary">Команды этого типа не добавлены</Text>}</div>
          <Button className="dashboard-category-footer" view="flat-info" onClick={() => setCatalogType(category.typeLabel)}>Все {category.label.toLowerCase()}</Button>
        </Card>)}
      </section>

      <CatalogDialogFiltered openType={catalogType} products={scopedProducts} rows={rows} onOpen={onOpen} onClose={() => setCatalogType('')} />

      <section className="dashboard-analysis-grid">
        <Card className="dashboard-radar-card" view="outlined"><div className="dashboard-card-title"><div><h2>Профиль B2C</h2><span>Средний Data Driven Index · {radarAverage === null ? '—' : `${radarAverage}%`}</span></div><label className="dashboard-unit"><span>Юнит</span><Select value={unit ? [unit] : []} onUpdate={(value) => setUnit(value[0] || '')} placeholder="B2C" width={170}><Select.Option value="">B2C</Select.Option>{units.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}</Select></label></div><div className="dashboard-radar"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="62%"><PolarGrid stroke="var(--g-color-line-generic)" /><PolarAngleAxis dataKey="name" tick={(props) => { const active = props.payload.value === hoveredBlock; const dx = props.x - props.cx; const dy = props.y - props.cy; const distance = Math.hypot(dx, dy) || 1; const radius = Number(props.radius) || distance * 0.78; const endX = props.cx + dx * radius / distance; const endY = props.cy + dy * radius / distance; return <g>{active && <line className="dashboard-radar-spoke-active" x1={props.cx} y1={props.cy} x2={endX} y2={endY} />}<text x={props.x} y={props.y} className={active ? 'dashboard-radar-axis-active' : 'dashboard-radar-axis'} textAnchor={props.textAnchor} dominantBaseline="central">{props.payload.value}</text></g>; }} /><Tooltip formatter={(value, name) => [`${value}%`, name]} /><Legend /><Radar name="B2C" dataKey="b2c" stroke="var(--g-color-text-secondary)" fill="var(--g-color-base-generic-medium)" fillOpacity={0.08} strokeWidth={2} strokeDasharray="4 3" dot={{r: 2, fill: 'var(--g-color-text-secondary)'}} />{unit && <Radar name={unit} dataKey="unit" stroke="var(--g-color-text-info-heavy)" fill="var(--g-color-base-info-heavy)" fillOpacity={0.18} strokeWidth={2} dot={{r: 2, fill: 'var(--g-color-base-info-heavy)'}} />}</RadarChart></ResponsiveContainer></div></Card>
        <Card className="dashboard-antitop-card" view="outlined"><div className="dashboard-card-title"><div><h2>Ключевые западающие зоны</h2><span>Процент команд, закрывающих метрику</span></div><Label theme="danger">Антитоп</Label></div><div className="dashboard-antitop-list">{antiTop.map((item, index) => <div className="dashboard-antitop-row" key={`${item.block}-${item.name}`} onMouseEnter={() => setHoveredBlock(item.block)} onMouseLeave={() => setHoveredBlock('')}><span>{index + 1}</span><div><b>{item.name}</b><small>{item.block} · {item.teams} команд</small></div><div><strong>{item.score}%</strong><Progress value={item.score} theme={progressTheme(item.score)} size="xs" /></div></div>)}</div></Card>
      </section>
    </main>
  );
}

function MetricRow({metric}) {
  const value = percent(metric.value, metric.max_value);
  const theme = metric.max_value ? progressTheme(value) : 'default';
  const isTbd = /a\s*\/\s*b/i.test(String(metric.name || ''));
  const isIrrelevant = metric.is_applicabble_flg === false && !isTbd;
  const isMissingCxTeam = isIrrelevant && /^cx score$/i.test(String(metric.name || '').trim());
  const valueLabel = isTbd
    ? 'TBD'
    : isIrrelevant
    ? (isMissingCxTeam ? 'Команда еще не добавлена' : 'Нерелевантно')
    : metric.max_value
      ? `Набрано ${metric.value} баллов из ${metric.max_value}`
      : 'Нет данных';
  return (
    <div className={`metric-row${isIrrelevant ? ' metric-row-irrelevant' : ''}${isTbd ? ' metric-row-tbd' : ''}`}>
      <div className="metric-copy"><i className={`metric-light metric-light-${isTbd ? 'default' : theme}`} aria-hidden="true" /><div><b>{metric.name}</b>{metric.footer && <span>{metric.footer}</span>}</div></div>
      <div className="metric-value"><span>{valueLabel}</span>{metric.is_applicabble_flg !== false && !isTbd && <Progress value={value} theme={theme} size="xs" />}</div>
    </div>
  );
}

function Detail({product, products, rows, onBack, onProduct}) {
  const score = scoreFor(product, rows);
  const maturity = groupFor(product, rows);
  const maturityTone = maturityTheme(maturity);
  const profileSeries = radarSeries(product.type);
  const applicableMetrics = (product.metrics || []).flatMap((block) => block.metrics || []).filter((metric) => metric.is_applicabble_flg !== false);
  const earnedPoints = applicableMetrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
  const maxPoints = applicableMetrics.reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
  const nextLevel = score < 40
    ? {name: 'Развивающиеся', threshold: 40}
    : score < 60
      ? {name: 'Зрелые', threshold: 60}
      : score < 80
        ? {name: 'Лидеры Data Driven', threshold: 80}
        : null;
  const percentToNextLevel = nextLevel ? Math.max(0, nextLevel.threshold - score) : 0;
  const pointsToNextLevel = nextLevel ? Math.max(0.05, maxPoints * nextLevel.threshold / 100 - earnedPoints) : 0;
  const [detailMode, setDetailMode] = useState('compact');
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [reportAccessOpen, setReportAccessOpen] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const toggle = (code) => setOpen((current) => {
    const next = new Set(current);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });
  const recommendations = useMemo(() => {
    const groups = new Map();
    (product.metrics || []).forEach((block) => (block.metrics || []).forEach((metric) => (metric.recommendation_items || []).forEach((item) => {
      const gap = Number(item.gap || 0);
      if (!item.recommendation || gap <= 0) return;
      const key = `${block.name}|${item.recommendation}`;
      const current = groups.get(key) || {recommendation: item.recommendation, block: block.name, count: 0, gap: 0, difficulty: item.recommendation_difficulty || item.group || 1};
      current.count += 1;
      current.gap += gap;
      groups.set(key, current);
    })));
    return [...groups.values()].map((item) => ({...item, indexUplift: maxPoints ? item.gap / maxPoints * 100 : 0})).sort((a, b) => a.difficulty - b.difficulty || b.gap - a.gap);
  }, [product, maxPoints]);
  const radarData = useMemo(() => {
    const benchmarkProducts = products.filter((item) => /продукт|сегмент|product|segment/i.test(String(item.type || '')));
    return (product.metrics || []).map((block) => {
      const benchmarkValues = benchmarkProducts.flatMap((item) => {
        const benchmarkBlock = (item.metrics || []).find((candidate) => candidate.code === block.code);
        if (!benchmarkBlock) return [];
        const benchmarkMetrics = benchmarkBlock.metrics || [];
        const allIrrelevant = benchmarkMetrics.length > 0 && benchmarkMetrics.every((metric) => metric.is_applicabble_flg === false);
        return allIrrelevant ? [] : [blockPercent(benchmarkBlock)];
      });
      return {
        name: block.name,
        product: blockPercent(block),
        benchmark: benchmarkValues.length ? Math.round(benchmarkValues.reduce((sum, value) => sum + value, 0) / benchmarkValues.length) : 0,
      };
    });
  }, [product, products]);

  return (
    <main className="content detail-page">
      <Button view="flat" onClick={onBack}><Icon data={ArrowLeft} size={16} />Назад к Summary</Button>
      <header className="detail-header">
        <div><h1>{product.name}</h1><div className="detail-meta">{product.unit} · {product.period} · <Label size="xs">{product.type}</Label><Button view="outlined-danger" size="s" href="https://public.oprosso.sberbank.ru/p/6yyb40xa" target="_blank">Нашли ошибку?</Button></div></div>
        <div className="detail-controls"><label className="product-select"><span>Команда</span><Select filterable filterPlaceholder="Найти команду" value={[product.id]} onUpdate={(value) => onProduct(products.find((item) => item.id === value[0]))} width={300}>
          {[...products].sort((a, b) => compareNames(a.name, b.name)).map((item) => <Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>)}
        </Select></label></div>
      </header>

      <div className="notice"><div className="notice-copy"><b>Значение индекса может корректироваться в зависимости от валидации источников и точечного аудита</b><span>Расчет не включает A/B тесты. Добавление – после 15 июля</span></div></div>
      <section className="detail-overview">
        <Card className={`index-profile-card tone-${maturityTone}`} view="outlined"><div className={`index-card tone-${maturityTone}`}><span>{product.name}</span><div className="index-score"><strong>{score}%</strong><b>/ 100</b><em>{maturity}</em></div><Progress value={score} theme={maturityTone} size="s" /><div className="scale"><span>Требуют внимания</span><span>Развивающиеся</span><span>Зрелые</span><span>Лидеры Data Driven</span></div><div className="index-next-level"><Text variant="body-1" color={nextLevel ? 'primary' : 'positive'}>{nextLevel ? `До уровня «${nextLevel.name}» — ${percentToNextLevel}%` : 'Максимальный уровень достигнут'}</Text></div><div className="index-points"><Text variant="caption-1" color="secondary">Набрано {earnedPoints.toFixed(2)} баллов из {maxPoints.toFixed(2)}</Text>{nextLevel && <Text variant="caption-1" color="secondary">До следующего уровня — {pointsToNextLevel.toFixed(2)} балла</Text>}</div></div><div className="profile-card"><Text variant="subheader-1">Профиль DD-индекса</Text><div className="profile-radar"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="62%"><PolarGrid stroke="var(--g-color-line-generic)" /><PolarAngleAxis dataKey="name" tick={{fill: 'var(--g-color-text-secondary)', fontSize: 10}} /><Tooltip formatter={(value, name) => [`${value}%`, name]} /><Radar name="B2C" dataKey="benchmark" stroke="var(--g-color-text-secondary)" fill="var(--g-color-base-generic-medium)" fillOpacity={0.25} strokeWidth={2} strokeDasharray="4 3" /><Radar name={profileSeries.label} dataKey="product" stroke={profileSeries.stroke} fill={profileSeries.fill} fillOpacity={0.2} strokeWidth={2} dot={{r: 2, fill: profileSeries.fill}} /><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize: 11, color: 'var(--g-color-text-secondary)'}} /></RadarChart></ResponsiveContainer></div></div></Card>
        <Card className="top-recommendations" view="outlined"><h2>Рекомендации и фокусы для повышения DD-индекса</h2>{recommendations.slice(0, 4).map((item, index) => { const difficulty = difficultyMeta(item.difficulty); return <div className="top-recommendation" key={`${item.block}-${item.recommendation}`}><div className="recommendation-marker"><span>{index + 1}</span><Label theme={difficulty.theme} size="xs">{difficulty.label}</Label></div><div><b>{item.recommendation}</b><small>{item.count} {metricWord(item.count)} · {item.block}</small></div><div className="recommendation-side"><div className="recommendation-uplift"><b>+{item.indexUplift.toFixed(1)} п.п. DD-индекса</b><span>+{item.gap.toFixed(2)} балла</span></div></div></div>; })}<Button view="flat-info" onClick={() => setRecommendationsOpen(true)}>Все рекомендации <Label size="xs">{recommendations.length}</Label><Icon data={ChevronRight} size={14} /></Button></Card>
      </section>
      <Dialog open={recommendationsOpen} onClose={() => setRecommendationsOpen(false)} hasCloseButton maxWidth="m" fullWidth contentOverflow="auto">
        <Dialog.Header caption={`Все рекомендации · ${recommendations.length}`} />
        <Dialog.Body>
          <div className="recommendations-dialog-list">
            {recommendations.map((item, index) => { const difficulty = difficultyMeta(item.difficulty); return <div className="dialog-recommendation" key={`${item.block}-${item.recommendation}-${index}`}><div className="recommendation-marker"><span>{index + 1}</span><Label theme={difficulty.theme} size="xs">{difficulty.label}</Label></div><div><b>{item.recommendation}</b><small>{item.count} {metricWord(item.count)} · {item.block}</small></div><div className="recommendation-side"><div className="recommendation-uplift"><b>+{item.indexUplift.toFixed(1)} п.п. DD-индекса</b><span>+{item.gap.toFixed(2)} балла</span></div></div></div>; })}
          </div>
        </Dialog.Body>
      </Dialog>
      <Dialog open={reportAccessOpen} onClose={() => setReportAccessOpen(false)} hasCloseButton maxWidth="m" fullWidth>
        <Dialog.Header caption="Доступ к системе" />
        <Dialog.Body>
          <div className="report-access-content">
            <Text variant="body-2">Для доступа непосредственно к системе необходимо в АС Друг в поисковой строке ввести «Доступ к стендам разработки и тестирования», далее:</Text>
            <ul>
              <li><Text variant="body-1">В поле «Стенд» указать «ТС AI Навыки Штаба B2C (CI09261834) (DEV) (CI09933741)»</Text></li>
              <li><Text variant="body-1">В обосновании указать «Для разработки и тестирования инструмента AI суммаризации»</Text></li>
            </ul>
            <div className="report-access-actions"><Button view="outlined" size="m" href={REPORT_ACCESS_REQUEST_URL} target="_blank">Завести заявку на доступ</Button><Button view="action" size="m" href={COMPLEX_REPORT_URL} target="_blank">Перейти</Button></div>
          </div>
        </Dialog.Body>
      </Dialog>

      <section className="metrics-section">
        <div className="metrics-title"><h2>Ключевые блоки DD-рейтинга</h2><div className="detail-mode" role="group" aria-label="Вид деталей"><Button selected={detailMode === 'detailed'} onClick={() => { setDetailMode('detailed'); setOpen(new Set((product.metrics || []).map((item) => item.code))); }}>Подробно</Button><Button selected={detailMode === 'compact'} onClick={() => { setDetailMode('compact'); setOpen(new Set()); }}>Компактно</Button></div></div>
        <div className="metrics-grid">
          {(product.metrics || []).map((block) => {
            const metrics = block.metrics || [];
            const blockScore = blockPercent(block);
            const allIrrelevant = metrics.length > 0 && metrics.every((metric) => metric.is_applicabble_flg === false);
            const isOpen = open.has(block.code);
            const value = metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
            const max = metrics.reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
            const blockLinks = linksForBlock(block, product.metrics || []);
            const instructions = (block.tools || []).filter((tool) => tool.kind === 'instruction' && tool.button?.link);
            return (
              <Card key={block.code} className={`metric-block tone-${allIrrelevant ? 'default' : progressTheme(blockScore)}`} view="outlined">
                <button className="metric-block-head" onClick={() => toggle(block.code)} aria-expanded={isOpen}>
                  <Icon data={isOpen ? ChevronDown : ChevronRight} size={14} />
                  <div><h3>{block.name}</h3><span>Набрано {value.toFixed(2)} баллов из {max.toFixed(2)}</span></div>
                  {allIrrelevant ? <span className="metric-block-na">Нерелевантно</span> : <strong>{blockScore}%</strong>}
                </button>
                {block.code === 'goals' && <HelpMark className="metric-block-help" aria-label="Учитываемые поверхности" popoverProps={HELP_POPOVER_PROPS}>Вывод в Навигатор &gt;90%</HelpMark>}
                {block.code === 'general' && <HelpMark className="metric-block-help metric-block-help-general" aria-label="Источник оценки" popoverProps={HELP_POPOVER_PROPS}>На основании пройденной самооценки в Oprosso</HelpMark>}
                {isOpen && <div className="metric-list">{metrics.map((metric, index) => { const group = metricGroup(metric); const previousGroup = index > 0 ? metricGroup(metrics[index - 1]) : ''; return <React.Fragment key={metric.code}>{group && group !== previousGroup && <div className="metric-group-title"><span>{group}</span>{group.toLowerCase() === 'отчетность' && <HelpMark aria-label="Учитываемые поверхности" popoverProps={HELP_POPOVER_PROPS}>Учитываются поверхности: Навигатор, Clickstream, приложенные к отчету</HelpMark>}</div>}{!group && previousGroup && <div className="metric-group-break" aria-hidden="true" />}<MetricRow metric={metric} /></React.Fragment>; })}</div>}
                {isOpen && instructions.length > 0 && <div className="block-instructions">{instructions.map((instruction) => <Alert key={instruction.button.link} theme="info" view="outlined" size="s" title={instruction.name} message={instruction.name === 'Инструкция' ? 'по настройке алертов к бизнес-метрикам' : instruction.footer} layout="horizontal" actions={<Alert.Actions><Alert.Action href={instruction.button.link} target="_blank">{instruction.button.label}</Alert.Action></Alert.Actions>} />)}</div>}
                {blockLinks.length > 0 && isOpen && <div className="block-links"><div className="block-links-title">Полезные ссылки</div><div className="block-actions">{blockLinks.map((action) => <Button key={`${action.label}-${action.url}`} view="outlined-info" size="s" width="auto" href={action.url} target="_blank">{action.label}<Icon data={ArrowUpRightFromSquare} size={13} /></Button>)}</div></div>}
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard');
  const [selected, setSelected] = useState(null);
  useEffect(() => { fetch('./report-data.json').then((response) => response.json()).then(setData); }, []);
  if (!data) return <div className="loading"><Spin size="xl" /></div>;
  const rows = data.title?.rows || [];
  const product = selected || data.products[0];
  const openProduct = (item) => { setSelected(item); setView('detail'); window.scrollTo(0, 0); };
  const menuItems = [
    {
      id: 'dashboard',
      title: 'Summary',
      tooltipText: 'Summary',
      icon: ChartMixed,
      current: view === 'dashboard',
      onItemClick: () => setView('dashboard'),
    },
    {
      id: 'detail',
      title: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043a\u043e\u043c\u0430\u043d\u0434\u044b',
      tooltipText: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043a\u043e\u043c\u0430\u043d\u0434\u044b',
      icon: BarsAscendingAlignLeft,
      current: view === 'detail',
      onItemClick: () => setView('detail'),
    },
    {
      id: 'summary',
      title: '\u0421\u0432\u043e\u0434\u043d\u0430\u044f \u0442\u0430\u0431\u043b\u0438\u0446\u0430',
      tooltipText: '\u0421\u0432\u043e\u0434\u043d\u0430\u044f \u0442\u0430\u0431\u043b\u0438\u0446\u0430',
      icon: ChartColumn,
      current: view === 'summary',
      onItemClick: () => setView('summary'),
    },
  ];
  const content = view === 'summary'
    ? <Summary products={data.products} rows={rows} onOpen={openProduct} />
    : view === 'dashboard'
      ? <DashboardSummary products={data.products} rows={rows} onOpen={openProduct} />
      : <Detail product={product} products={data.products} rows={rows} onBack={() => setView('dashboard')} onProduct={setSelected} />;
  return (
    <AsideHeader
      compact
      className="dd-navigation"
      logo={{text: 'Data-Driven Index', iconSrc: ocb2cLogo, iconSize: 30, iconClassName: 'dd-navigation-logo', 'aria-label': 'Data-Driven Index'}}
      menuItems={menuItems}
      hideCollapseButton
      renderFooter={() => <div className="navigation-period" title="II кв. 2026"><Icon data={CircleInfo} size={16} /></div>}
      renderContent={() => content}
    />
  );
}

createRoot(document.getElementById('root')).render(<ThemeProvider theme="light"><App /></ThemeProvider>);
