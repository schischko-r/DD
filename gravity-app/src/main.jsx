import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUpRightFromSquare,
  BarsAscendingAlignLeft,
  ChartColumn,
  ChartLinePoints,
  ChartMixed,
  CircleDollar,
  ChevronDown,
  ChevronRight,
  CircleInfo,
  NodesRight,
  Persons,
} from '@gravity-ui/icons';
import {
  Accordion,
  Alert,
  Button,
  Card,
  Dialog,
  Disclosure,
  HelpMark,
  Icon,
  Label,
  Link,
  Progress,
  Select,
  SegmentedRadioGroup,
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
const PRODUCT_KEY_METRIC_LINKS = [
  {label: 'Воронки активности продуктов', url: 'https://navigator.sigma.sbrf.ru/gdash/12215/1000034254'},
  {label: 'Продукты-спутники', url: 'https://navigator.sigma.sbrf.ru/gdash/12215/1000030917'},
];
const SEGMENT_KEY_METRIC_LINKS = [
  {label: 'Отчет "Активная клиентская база"', url: 'https://navigator.sigma.sbrf.ru/gdash/1000000301'},
  {label: 'Отчет "Major"', url: 'https://navigator.sigma.sbrf.ru/gdash/1000002349?type_of_view=1'},
  {label: 'Отчет "Клиенты с 1+2+"', url: 'https://navigator.sigma.sbrf.ru/gdash/1000001389'},
];

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

function metricDomId(code) {
  return `dd-metric-${encodeURIComponent(String(code || ''))}`;
}

function isVisibleMetric(metric) {
  const isOwnMechanics = /(?:^|\.)nalichie_sobstvennyh_mehanik$/i.test(String(metric.code || ''))
    || /^наличие собственных механик$/i.test(String(metric.name || '').trim());
  return !isOwnMechanics || metric.is_applicabble_flg !== false;
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

function linksForBlock(block, allBlocks = [], entityType = 'Продукт') {
  const draftLinks = allBlocks.flatMap(collectBlockLinks).filter((item) => /черновик/i.test(item.label));
  const isKeyMetricsBlock = block.code === 'general' || /знание ключевых метрик/i.test(String(block.name || ''));
  const keyMetricLinks = isKeyMetricsBlock
    ? (String(entityType).toLowerCase().includes('сегмент') ? SEGMENT_KEY_METRIC_LINKS : PRODUCT_KEY_METRIC_LINKS)
    : [];
  const ownLinks = [...collectBlockLinks(block), ...keyMetricLinks].filter((item) => block.code === 'attract' || !/черновик/i.test(item.label));
  const relocatedLinks = block.code === 'attract' ? [...ownLinks, ...draftLinks] : ownLinks;
  const uniqueLinks = relocatedLinks
    .filter((item) => !/библиотек[ау] решений/i.test(item.label))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label && candidate.url === item.url) === index);
  return block.code === 'cx'
    ? uniqueLinks.filter((item) => /^(?:(?:открыть )?(?:cx|ux) score|cjxplorer|losshunter)$/i.test(item.label))
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

function CatalogDialogFiltered({openType, openMaturity, products, rows, onOpen, onClose}) {
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
      if (openMaturity && maturityTheme(row?.group) !== openMaturity.theme) return;
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
  }, [products, rows, selectedType, openMaturity]);
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
  }, [openType, openMaturity, units]);

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
      <Dialog.Header caption={`${'\u0412\u0441\u0435'} ${(selectedType?.label || '').toLowerCase()}${openMaturity ? ` · ${openMaturity.label}` : ''}`} />
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
            const unitOpen = Boolean(visibleUnits.length === 1 || normalizedQuery || expandedUnits[unit.name]);
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

function Summary({products, rows, initialType = ''}) {
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
            const tone = maturityTheme(row.group);
            return <div className={`report-row tone-${tone}`} key={row.id}>
              <div className="team-cell"><span className={`type-label type-label-${typeTone(row.type)}`}>{row.type}</span><b title={row.name}>{row.name}</b></div>
              <div className="score-cell"><strong>{row.score}%</strong><Progress value={row.score} theme={tone} size="xs" /></div>
              <div><Label theme={tone}>{row.group}</Label></div>
              <div><Button view="outlined-info" disabled>Перейти</Button></div>
            </div>;
          })}
        </section>)}
      </Card>
    </main>
  );
}

function DashboardSummary({products, rows, onOpen, onAbout}) {
  const [catalogType, setCatalogType] = useState('');
  const [catalogMaturity, setCatalogMaturity] = useState(null);
  const [teamContactOpen, setTeamContactOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const periods = useMemo(() => [...new Set(products.map((item) => item.period).filter(Boolean))].sort(compareNames), [products]);
  const [period, setPeriod] = useState(() => periods[0] || '');
  const [unit, setUnit] = useState('');
  const [hoveredBlock, setHoveredBlock] = useState('');
  const units = useMemo(() => [...new Set(products.filter((item) => !period || item.period === period).map((item) => item.unit).filter(Boolean))].sort(compareNames), [products, period]);
  const periodProducts = useMemo(() => products.filter((item) => !period || item.period === period), [products, period]);
  const scopedProducts = useMemo(() => periodProducts.filter((item) => !unit || item.unit === unit), [periodProducts, unit]);
  useEffect(() => {
    if (unit && !units.includes(unit)) setUnit('');
  }, [unit, units]);
  const teamMatches = useMemo(() => {
    const normalizedQuery = teamQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return scopedProducts.filter((item) => [item.name, item.type, item.unit]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => compareNames(a.name, b.name))
      .slice(0, 10);
  }, [scopedProducts, teamQuery]);
  const rowForProduct = (product) => rows.find((row) => row.name === product.name && row.unit === product.unit);
  const categoryMeta = [
    {key: 'product', label: 'Продукты', typeLabel: 'Продукт', icon: CircleDollar, tone: 'product'},
    {key: 'segment', label: 'Сегменты', typeLabel: 'Сегмент', icon: Persons, tone: 'segment'},
    {key: 'channel', label: 'Каналы', typeLabel: 'Канал', icon: NodesRight, tone: 'channel'},
  ];
  const maturityLevels = [
    {theme: 'success', label: 'Лидеры'},
    {theme: 'info', label: 'Зрелые'},
    {theme: 'warning', label: 'Развивающиеся'},
    {theme: 'danger', label: 'Требуют внимания'},
  ];
  const categoryCards = categoryMeta.map((category) => {
    const items = scopedProducts
      .filter((item) => typeTone(item.type) === category.key)
      .map((item) => {
        const row = rowForProduct(item);
        return {...item, score: Number(row?.score || 0), maturity: maturityTheme(row?.group)};
      })
      .sort((a, b) => (b.score - a.score) || compareNames(a.name, b.name));
    const average = items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : null;
    const maturityCounts = maturityLevels.map((level) => ({...level, count: items.filter((item) => item.maturity === level.theme).length}));
    return {...category, items, average, maturityCounts};
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
          <label className="dashboard-unit-filter"><span>Юнит</span><Select value={unit ? [unit] : []} onUpdate={(value) => setUnit(value[0] || '')} placeholder="Все юниты" width={190}><Select.Option value="">Все юниты</Select.Option>{units.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}</Select></label>
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
          <div className="dashboard-maturity"><span>По уровню зрелости</span><div className="dashboard-maturity-grid">{category.maturityCounts.map((level) => <button type="button" className="dashboard-maturity-counter" key={level.theme} disabled={!level.count} onClick={() => { setCatalogMaturity(level); setCatalogType(category.typeLabel); }}><span>{level.label}</span><strong>{level.count}</strong><Icon data={ChevronRight} size={13} /></button>)}</div></div>
          <Button className="dashboard-category-footer" view="flat-info" onClick={() => { setCatalogMaturity(null); setCatalogType(category.typeLabel); }}>Все {category.label.toLowerCase()}</Button>
        </Card>)}
      </section>

      <CatalogDialogFiltered openType={catalogType} openMaturity={catalogMaturity} products={scopedProducts} rows={rows} onOpen={onOpen} onClose={() => { setCatalogType(''); setCatalogMaturity(null); }} />

      <section className="dashboard-analysis-grid">
        <Card className="dashboard-radar-card" view="outlined"><div className="dashboard-card-title"><div><h2>Профиль B2C</h2><span>Средний Data Driven Index · {radarAverage === null ? '—' : `${radarAverage}%`}</span></div></div><div className="dashboard-radar"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="62%"><PolarGrid stroke="var(--g-color-line-generic)" /><PolarAngleAxis dataKey="name" tick={(props) => { const active = props.payload.value === hoveredBlock; const dx = props.x - props.cx; const dy = props.y - props.cy; const distance = Math.hypot(dx, dy) || 1; const radius = Number(props.radius) || distance * 0.78; const endX = props.cx + dx * radius / distance; const endY = props.cy + dy * radius / distance; return <g>{active && <line className="dashboard-radar-spoke-active" x1={props.cx} y1={props.cy} x2={endX} y2={endY} />}<text x={props.x} y={props.y} className={active ? 'dashboard-radar-axis-active' : 'dashboard-radar-axis'} textAnchor={props.textAnchor} dominantBaseline="central">{props.payload.value}</text></g>; }} /><Tooltip formatter={(value, name) => [`${value}%`, name]} /><Legend /><Radar name="B2C" dataKey="b2c" stroke="var(--g-color-text-secondary)" fill="var(--g-color-base-generic-medium)" fillOpacity={0.08} strokeWidth={2} strokeDasharray="4 3" dot={{r: 2, fill: 'var(--g-color-text-secondary)'}} />{unit && <Radar name={unit} dataKey="unit" stroke="var(--g-color-text-info-heavy)" fill="var(--g-color-base-info-heavy)" fillOpacity={0.18} strokeWidth={2} dot={{r: 2, fill: 'var(--g-color-base-info-heavy)'}} />}</RadarChart></ResponsiveContainer></div></Card>
        <Card className="dashboard-antitop-card" view="outlined"><div className="dashboard-card-title"><div><h2>Ключевые западающие зоны</h2><span>Процент команд, закрывающих метрику</span></div><Label theme="danger">Антитоп</Label></div><div className="dashboard-antitop-list">{antiTop.map((item, index) => <div className="dashboard-antitop-row" key={`${item.block}-${item.name}`} onMouseEnter={() => setHoveredBlock(item.block)} onMouseLeave={() => setHoveredBlock('')}><span>{index + 1}</span><div><b>{item.name}</b><small>{item.block} · {item.teams} команд</small></div><div><strong>{item.score}%</strong><Progress value={item.score} theme={progressTheme(item.score)} size="xs" /></div></div>)}</div></Card>
      </section>

      <Card className="dashboard-about-card" view="outlined">
        <div className="dashboard-about-icon"><Icon data={CircleInfo} size={24} /></div>
        <div className="dashboard-about-copy">
          <Text variant="subheader-2">О Data Driven</Text>
          <Text variant="body-1" color="secondary">Что такое Data Driven, какие практики оценивает индекс, как читать рейтинг зрелости и выбирать следующие шаги для команды.</Text>
        </div>
        <Button view="outlined-info" onClick={onAbout}>Открыть методологию <Icon data={ChevronRight} size={14} /></Button>
      </Card>
    </main>
  );
}

function AboutDataDriven({onBack}) {
  const elements = [
    {title: 'Данные', text: 'Качественная и актуальная основа для анализа и решений.', icon: ChartColumn},
    {title: 'Отчётность', text: 'Система зрения и информирования организации.', icon: ChartMixed},
    {title: 'Исследования и инструменты', text: 'Инсайты и доказательства, которые можно встроить в промышленные решения.', icon: BarsAscendingAlignLeft},
    {title: 'Люди', text: 'Команды с необходимыми навыками и компетенциями.', icon: Persons},
  ];
  const zones = [
    {title: 'Цели, драйверы и прогнозы', text: 'Метрические цели, факторный анализ (драйверы 1–2 уровня), прогноз по целям и драйверам выведены на мониторинг и доступны ЛТ/ЛЮ.', criteria: [{name: 'Мониторинг в Навигаторе; учитывается, если выведено более 90% целей и лидер продукта знает про BI-дашборд.', points: '1 балл (100%)'}, {name: 'Мониторинг в локальной отчётности, не в Навигаторе.', points: '0,5 балла (50%)'}, {name: 'Мониторинг отсутствует.', points: '0 баллов (0%)'}]},
    {title: 'Воронки привлечения и оттока', text: 'Полнота и регулярность отчётности, анализ гэпов и мероприятия по улучшению.', criteria: [{name: 'Регулярная отчётность по воронке', points: '0,5 балла'}, {name: 'Полнота отчёта', points: '0,5 балла'}, {name: 'Анализ воронки', points: '1 балл'}, {name: 'Инициативы или мероприятия по отклонениям', points: '1 балл'}]},
    {title: 'Механики', text: 'Удержание, возврат, cross-sell, upsell и персонализация вместе с метриками эффективности.', criteria: [{name: 'Каждая применимая механика', points: '1 балл'}, {name: 'Мониторинг механик', points: '0,25 балла'}]},
    {title: 'Черновики', text: 'Покрытие потенциала продукта механиками работы с брошенными корзинами.', criteria: [{name: 'Покрытие черновиков в СБОЛ ≥70%', points: '1 балл'}]},
    {title: 'Алерты', text: 'Настроены автоматические алерты по системным сбоям — событиям в IT-инфраструктуре, которые приводят к недоступности или некорректной работе продукта для клиентов, — и алерты по бизнес-метрикам.', criteria: [{name: 'Настроены алерты по системным сбоям и бизнес-метрикам.', points: '1 балл (100%)'}, {name: 'Алерты настроены частично: по системным сбоям или бизнес-метрикам.', points: '0,5 балла (50%)'}]},
    {title: 'Кампейнинг', text: 'Запуски кампаний, успешные бизнес-запуски и использование self-service.', criteria: [{name: 'Запуски кампаний за квартал', points: '0,5 балла'}, {name: 'Успешные бизнес-запуски', points: '0,5 балла'}, {name: 'Наличие Self-service', points: '0,5 балла'}]},
    {title: 'Инициативы и исследования', text: 'Доля исследований в бэклоге аналитиков и инициативы сверх бизнес-плана.', criteria: [{name: 'Discovery ≥40% бэклога', points: '1 балл'}, {name: 'Оценка исследований ≥7,5', points: '1 балл'}, {name: 'Дополнительные инициативы сверх БП', points: '1 балл'}]},
    {title: 'A/B-тесты', text: 'Практика экспериментов; в текущей методике показатель не влияет на индекс.', criteria: [{name: 'Проведение A/B-тестов', points: 'Не входит в индекс', excluded: true}]},
  ];
  const levels = [
    {range: '<40%', title: 'Требуют внимания', note: 'Нет устойчивого фундамента', tone: 'attention'},
    {range: '40–60%', title: 'Развивающиеся', note: 'База формируется', tone: 'developing'},
    {range: '61–80%', title: 'Зрелые', note: 'Практики работают регулярно', tone: 'mature'},
    {range: '81–100%', title: 'Лидеры Data-Driven', note: 'Ориентир для экосистемы', tone: 'leader'},
  ];
  return (
    <main className="content about-page">
      <Button className="about-back" view="flat" onClick={onBack}><Icon data={ArrowLeft} size={16} /> К Summary</Button>
      <section className="about-hero">
        <div className="about-hero-main">
          <div className="about-eyebrow"><Icon data={CircleInfo} size={16} /><span>Методология Data Driven B2C</span></div>
          <h1>Как команда принимает решения на данных</h1>
          <Text variant="body-2" color="secondary">Индекс показывает, насколько данные встроены в ежедневную работу: от постановки целей и мониторинга до экспериментов и измеримого результата.</Text>
          <div className="about-hero-actions">
            <Button view="action" size="l" onClick={onBack}>Открыть рейтинг <Icon data={ChevronRight} size={16} /></Button>
            <Button view="flat" size="l" href="#assessment">Как считается индекс</Button>
          </div>
        </div>
        <div className="about-system-map" role="img" aria-label="Четыре элемента Data Driven системы">
          <div className="about-system-core"><strong>Data Driven</strong><span>единый контур решений</span></div>
          {elements.map((item) => <div className="about-system-node" key={item.title}><span><Icon data={item.icon} size={18} /></span><b>{item.title}</b></div>)}
        </div>
      </section>

      <nav className="about-nav" aria-label="Разделы методологии">
        <a href="#system">Система</a>
        <a href="#assessment">Оценка</a>
        <a href="#practices">Практики</a>
      </nav>

      <section className="about-section" id="system">
        <div className="about-section-heading"><Text variant="caption-2" color="secondary">ОСНОВА</Text><h2>Data Driven работает как система</h2><Text color="secondary">Сильный результат появляется, когда четыре элемента связаны общим процессом принятия решений.</Text></div>
        <div className="about-elements">{elements.map((item) => <Card view="outlined" type="container" size="l" key={item.title}><div className="about-element-icon"><Icon data={item.icon} size={20} /></div><h3>{item.title}</h3><Text color="secondary">{item.text}</Text></Card>)}</div>
      </section>

      <section className="about-section about-diagnosis" id="assessment">
        <div className="about-maturity">
          <div className="about-maturity-head"><div><h2>Уровни зрелости</h2><Text color="secondary">По возрастанию Data-Driven Index команды</Text></div></div>
          <ul className="about-levels">{levels.map((level) => <li className={`about-level about-level-${level.tone}`} key={level.title}><b>{level.range}</b><span>{level.title}</span><small>{level.note}</small></li>)}</ul>
        </div>
      </section>

      <section className="about-section" id="practices">
        <div className="about-practices-layout">
          <div className="about-practices-intro">
            <h2>Восемь практик<br />в одном профиле</h2>
            <Text className="about-practices-lead" color="secondary">Индекс помогает быстро локализовать зону развития, не смешивая разные типы работы с данными.</Text>
            <div className="about-scoring-method"><span>Расчёт индекса</span><b>Data-Driven Index = Σ баллов по блокам / Σ максимальных применимых баллов × 100%</b><small>Нерелевантные критерии исключаются и из набранных баллов, и из максимального балла продукта.</small></div>
          </div>
          <div className="about-accordion-card">
            <Accordion view="top-bottom" size="l">
              {zones.map((zone, index) => <Accordion.Item key={zone.title} summary={<div className="about-zone-summary"><Label theme="utility">{String(index + 1).padStart(2, '0')}</Label><b>{zone.title}</b></div>}><div className="about-zone-detail"><Text color="secondary">{zone.text}</Text><div className="about-zone-criteria">{zone.criteria.map((criterion) => <div className="about-zone-criterion" key={criterion.name}><Label theme={criterion.excluded ? 'normal' : 'info'} size="xs">{criterion.points}</Label><span>{criterion.name}</span></div>)}</div></div></Accordion.Item>)}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="about-summary-cta">
        <div><Text variant="subheader-2">Посмотрите Data-Driven Index своей команды</Text><Text color="secondary">Найдите профиль, сравните практики и определите ближайший фокус развития.</Text></div>
        <Button view="action" size="l" onClick={onBack}>Открыть рейтинг <Icon data={ChevronRight} size={16} /></Button>
      </section>
    </main>
  );
}

function MetricInlineAction({title, subtitle, href, onClick, tone = 'info', actionLabel = 'Перейти'}) {
  const className = `metric-inline-instruction metric-inline-instruction-button metric-inline-instruction-${tone}`;
  const content = <><span className="metric-inline-instruction-icon"><Icon data={CircleInfo} size={15} /></span><span className="metric-inline-instruction-copy"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span><span className="metric-inline-instruction-action">{actionLabel} <Icon data={ChevronRight} size={13} /></span></>;
  return href
    ? <Link className={className} href={href} target="_blank" rel="noreferrer">{content}</Link>
    : <button className={className} type="button" onClick={onClick}>{content}</button>;
}

function metricAiInsight(subject, onClick) {
  const labels = {
    'динамике MAU': 'Динамика MAU',
    'черновикам в СБОЛ': 'Черновики в СБОЛ',
    'воронке кампейнинга': 'Воронка кампейнинга',
    'воронке оформления в СБОЛ': 'Оформление в СБОЛ',
    'CSI': 'CSI',
    'жалобам и обращениям': 'Жалобы и обращения',
  };
  return {
    title: `AI-анализ по ${subject}`,
    label: labels[subject] || subject,
    tone: 'info',
    onClick,
  };
}

function MetricAiActions({insights}) {
  if (!insights.length) return null;
  return <div className="metric-ai-actions"><span className="metric-ai-actions-title"><Icon data={ChartLinePoints} size={15} /><strong>AI-анализ</strong></span><div className="metric-ai-actions-buttons">{insights.map((insight) => <button type="button" onClick={insight.onClick} key={insight.title}>{insight.label}<Icon data={ChevronRight} size={13} /></button>)}</div></div>;
}

function GoalsHelpContent() {
  return <div className="goals-help-content"><p>Метрические цели, факторный анализ (драйверы 1–2 уровня), прогноз по целям и драйверам выведены на мониторинг и доступны ЛТ/ЛЮ.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — мониторинг в Навигаторе; учитывается, если выведено более 90% целей и лидер продукта знает про BI-дашборд.</li><li><b>0,5 балла (50%)</b> — мониторинг в локальной отчётности, не в Навигаторе.</li><li><b>0 баллов (0%)</b> — мониторинг отсутствует.</li></ul></div>;
}

function AlertsHelpContent() {
  return <div className="goals-help-content"><p>Настроены автоматические алерты по системным сбоям — событиям в IT-инфраструктуре, которые приводят к недоступности или некорректной работе продукта для клиентов, — и алерты по бизнес-метрикам.</p><strong>Оценка:</strong><ul><li><b>1 балл (100%)</b> — настроены алерты по системным сбоям и бизнес-метрикам.</li><li><b>0,5 балла (50%)</b> — алерты настроены частично: по системным сбоям или бизнес-метрикам.</li></ul></div>;
}

function AttractReportingHelpContent() {
  return <div className="goals-help-content attract-reporting-help-content">
    <section>
      <p>Настроена регулярная отчётность по воронке привлечения.</p>
      <strong>Оценка:</strong>
      <ul>
        <li><b>0,5 балла (100%)</b> — формируется автоматически.</li>
        <li><b>0,25 балла (50%)</b> — формируется по запросу.</li>
        <li><b>0 баллов (0%)</b> — отчётность отсутствует.</li>
      </ul>
    </section>
    <section>
      <p>Полнота отчёта по воронке привлечения.</p>
      <strong>Оценка:</strong>
      <ul>
        <li><b>0,5 балла (100%)</b> — комплексный отчёт: источники привлечения, пошаговая воронка, CR (% конверсии), объёмы, механики, сегментный или когортный разрез, UX/UI.</li>
        <li><b>0,25 балла (50%)</b> — неполный отчёт.</li>
      </ul>
    </section>
  </div>;
}

function AttractAnalysisHelpContent() {
  return <div className="goals-help-content attract-reporting-help-content">
    <section>
      <p>Анализ воронки привлечения.</p>
      <strong>Оценка:</strong>
      <ul>
        <li><b>1 балл (100%)</b> — комплексный анализ: анализ процесса оформления продукта, сравнение с конкурентами, кампании продаж, ключевые точки потери клиентов.</li>
        <li><b>0,5 балла (50%)</b> — неполный анализ.</li>
      </ul>
    </section>
    <section>
      <p>Перечень инициатив по отклонениям.</p>
      <strong>Оценка:</strong>
      <ul>
        <li><b>1 балл (100%)</b> — составлен перечень инициатив.</li>
        <li><b>0,5 балла (50%)</b> — перечень отсутствует.</li>
      </ul>
    </section>
    <section>
      <p>Бенчмарки по показателям воронки: цели, динамика, рыночный бенчмарк.</p>
      <strong>Оценка:</strong>
      <ul>
        <li><b>1 балл (100%)</b> — есть бенчмарки.</li>
        <li><b>0 баллов (0%)</b> — бенчмарки отсутствуют.</li>
      </ul>
    </section>
  </div>;
}

function IndexFormulaHelp() {
  return <div className="index-formula-help"><div>Data-Driven Index = Σ баллов по блокам / Σ максимальных применимых баллов × 100%</div><p>Нерелевантные критерии исключаются и из набранных баллов, и из максимального балла продукта.</p></div>;
}

function MetricRow({metric, detailScore, instruction, library, aiMetricInsight, aiMetricInsights = [], grouped}) {
  const value = percent(metric.value, metric.max_value);
  const theme = metric.max_value ? progressTheme(value) : 'default';
  const isTbd = /a\s*\/\s*b/i.test(String(metric.name || ''));
  const isIrrelevant = metric.is_applicabble_flg === false && !isTbd;
  const isNotApplicable = metric.is_applicabble_flg === false;
  const isMissingCxTeam = isNotApplicable && /^cx score$/i.test(String(metric.name || '').trim());
  const status = isTbd
    ? {label: 'TBD', theme: 'normal'}
    : isNotApplicable
      ? {label: isMissingCxTeam ? 'Команда еще не добавлена' : 'Неприменимо', theme: 'normal'}
    : Number(metric.max_value) > 0
      ? {
          label: `${value}%`,
          theme: Number(metric.value) >= Number(metric.max_value) ? 'success' : Number(metric.value) > 0 ? 'warning' : 'danger',
        }
      : {label: 'Нет данных', theme: 'normal'};
  const valueLabel = isTbd
    ? 'TBD'
    : isIrrelevant
    ? (isMissingCxTeam ? 'Команда еще не добавлена' : 'Нерелевантно')
    : metric.max_value
      ? `Набрано ${metric.value} баллов из ${metric.max_value}`
      : 'Нет данных';
  const lightTheme = detailScore ? (isTbd ? 'default' : theme) : (status.theme === 'normal' ? 'default' : status.theme);
  const insights = [...(aiMetricInsight ? [aiMetricInsight] : []), ...aiMetricInsights];
  return (
    <div id={metricDomId(metric.code)} className={`metric-row${detailScore ? '' : ' metric-row-status'}${grouped ? ' metric-row-grouped' : ''}${isIrrelevant ? ' metric-row-irrelevant' : ''}${isTbd ? ' metric-row-tbd' : ''}`}>
      <div className="metric-copy"><i className={`metric-light metric-light-${lightTheme}`} aria-hidden="true" /><div><b>{metric.name}</b>{metric.footer && <span>{metric.footer}</span>}</div></div>
      <div className="metric-value">{detailScore ? <><span>{valueLabel}</span>{metric.is_applicabble_flg !== false && !isTbd && <Progress value={value} theme={theme} size="xs" />}</> : <Label className="metric-status-label" theme={status.theme}>{status.label}</Label>}</div>
      {instruction && <MetricInlineAction title="Инструкция" subtitle="по настройке алертов к бизнес-метрикам" href={instruction.button.link} />}
      {library && <MetricInlineAction title="Библиотека решений" subtitle="Практики для повышения оценки исследований" href={library.link} actionLabel="Открыть" />}
      <MetricAiActions insights={insights} />
    </div>
  );
}

function digestTheme(light) {
  if (light === 'red') return 'danger';
  if (light === 'yellow') return 'warning';
  if (light === 'green') return 'success';
  return 'normal';
}

function digestStatus(light) {
  if (light === 'red') return 'Требует внимания';
  if (light === 'yellow') return 'Наблюдать';
  if (light === 'green') return 'Стабильно';
  return 'Нет оценки';
}

function displaySkillName(name) {
  return String(name || '').replace(/^Навык\s+[«"]Ключевые метрики[»"]$/i, 'Ключевые метрики');
}

function worstDigestLight(items) {
  const order = ['red', 'yellow', 'green', 'gray'];
  return order.find((light) => items.some((item) => (item.traffic_light || 'gray') === light)) || 'gray';
}

function linkifyRecommendation(text) {
  const value = String(text || '');
  const urlPattern = /\b((?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>()]*)?)/gi;
  const parts = [];
  let cursor = 0;
  for (const match of value.matchAll(urlPattern)) {
    const raw = match[0];
    const url = raw.replace(/[.,;:!?]+$/, '');
    const suffix = raw.slice(url.length);
    if (match.index > cursor) parts.push(value.slice(cursor, match.index));
    const href = /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^www\./i, '')}`;
    parts.push(<Link href={href} target="_blank" rel="noreferrer" key={`${match.index}-${url}`}>{url}</Link>);
    if (suffix) parts.push(suffix);
    cursor = match.index + raw.length;
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts.length ? parts : value;
}

function ProductMetricRecommendations({product, onOpenReport}) {
  const [filter, setFilter] = useState('all');
  const recommendations = product.metric_recommendations || [];
  const counts = recommendations.reduce((result, item) => {
    const light = item.traffic_light || 'gray';
    result[light] = (result[light] || 0) + 1;
    return result;
  }, {red: 0, yellow: 0, green: 0, gray: 0});
  const visible = recommendations.filter((item) => {
    if (filter === 'attention') return item.traffic_light === 'red' || item.traffic_light === 'yellow';
    if (filter === 'stable') return item.traffic_light === 'green';
    if (filter === 'unknown') return !item.traffic_light || item.traffic_light === 'gray';
    return true;
  });
  const blockNames = new Map((product.metrics || []).map((block) => [block.code, block.name]));
  const groups = visible.reduce((result, item) => {
    const key = item.block_code || 'other';
    if (!result.has(key)) result.set(key, {name: blockNames.get(key) || 'Другие показатели', items: []});
    result.get(key).items.push(item);
    return result;
  }, new Map());
  const months = [...new Set(recommendations.map((item) => item.month).filter(Boolean))];

  return (
    <section className="metric-recommendations-page">
      <header className="metric-recommendations-header">
        <div><h2>Рекомендации по продуктовым метрикам</h2></div>
        {months.length > 0 && <Label theme="info" size="s">{months.join(' · ')}</Label>}
      </header>

      <Card className="promo metric-report-promo" view="outlined">
        <div><Text variant="subheader-1">Посмотреть комплексный отчет по продукту</Text><Text variant="body-1" color="secondary">Мы подготовили для вас AI-рекомендации по вашим ключевым метрикам</Text></div>
        <Button view="action" size="m" onClick={onOpenReport}>Перейти <Icon data={ChevronRight} size={14} /></Button>
      </Card>

      {recommendations.length === 0 ? (
        <Card className="metric-recommendations-empty" view="outlined">
          <Text variant="subheader-1">Рекомендаций пока нет</Text>
          <Text variant="body-1" color="secondary">Для {product.type.toLowerCase()} «{product.name}» нет совпавших записей в ai_product_mapping и текущем AI Skill Digest.</Text>
        </Card>
      ) : (
        <>
          <div className="metric-recommendations-toolbar">
            <Text variant="subheader-1">Ключевые блоки DD-рейтинга</Text>
            <SegmentedRadioGroup value={filter} onUpdate={setFilter} size="m">
              <SegmentedRadioGroup.Option value="all">Все</SegmentedRadioGroup.Option>
              <SegmentedRadioGroup.Option value="attention">В фокусе</SegmentedRadioGroup.Option>
              <SegmentedRadioGroup.Option value="stable">Стабильно</SegmentedRadioGroup.Option>
              {counts.gray > 0 && <SegmentedRadioGroup.Option value="unknown">Без оценки</SegmentedRadioGroup.Option>}
            </SegmentedRadioGroup>
          </div>

          <div className="metric-recommendation-groups">
            {visible.length === 0 && <Card className="metric-recommendations-filter-empty" view="outlined"><Text variant="body-1" color="secondary">В выбранной категории нет сигналов.</Text></Card>}
            {[...groups.entries()].map(([blockCode, group]) => (
              <Card className={`metric-recommendation-block tone-${digestTheme(worstDigestLight(group.items))}`} view="outlined" key={blockCode}>
                <Disclosure
                  className="metric-recommendation-disclosure"
                  size="l"
                  defaultExpanded={worstDigestLight(group.items) === 'red'}
                  summary={<div className="metric-recommendation-block-head"><i className={`digest-light digest-light-${worstDigestLight(group.items)}`} aria-hidden="true" /><div><h3>{group.name}</h3><span>{digestStatus(worstDigestLight(group.items))}</span></div></div>}
                >
                  <div className="metric-recommendation-list">
                    {group.items.map((item) => (
                      <div className="metric-recommendation-row" key={item.id}>
                        <i className={`digest-light digest-light-${item.traffic_light || 'gray'}`} aria-hidden="true" />
                        <div className="metric-recommendation-copy">
                          <div className="metric-recommendation-row-title"><h4>{item.indicator}</h4><Label theme={digestTheme(item.traffic_light)} size="xs">{digestStatus(item.traffic_light)}</Label></div>
                          {(item.recommendations || []).map((text, index) => <Text variant="body-1" key={`${item.id}-${index}`}>{text}</Text>)}
                          <div className="metric-recommendation-meta"><Label theme="utility" size="xs">{displaySkillName(item.skill_name)}</Label>{item.month && <Text variant="caption-1" color="secondary">{item.month}</Text>}{item.ai_products?.length > 0 && <Text variant="caption-1" color="secondary">Источник: {item.ai_products.join(', ')}</Text>}</div>
                          {item.rule && <Text className="metric-recommendation-rule" variant="caption-1" color="secondary">Правило светофора: {item.rule}</Text>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Disclosure>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ProductMetricRows({items}) {
  return items.map((item) => <div className="metric-row product-metric-row" key={item.id}>
    <div className="metric-copy">{item.is_traffic_light ? <i className={`metric-light metric-light-${digestTheme(item.traffic_light)}${item.traffic_light === 'gray' ? ' product-metric-empty-light' : ''}`} aria-hidden="true" /> : <span className="product-metric-light-spacer" aria-hidden="true" />}<div><b>{item.indicator}</b>{(item.recommendations || []).map((text, index) => <span key={`${item.id}-${index}`}>{linkifyRecommendation(text)}</span>)}{item.is_traffic_light && item.rule && <small>Правило светофора: {item.rule}</small>}</div></div>
    <div className="product-metric-row-side">{item.month && <Text variant="caption-1" color="secondary">{item.month}</Text>}</div>
  </div>);
}

function recommendationBlockCode(product, requestedCode) {
  const blocks = product.metrics || [];
  if (blocks.some((block) => block.code === requestedCode)) return requestedCode;
  if (requestedCode === 'general') {
    return blocks.find((block) =>
      /знание ключевых метрик/i.test(String(block.name || ''))
      || (block.metrics || []).some((metric) => /\.mau_produkta$/i.test(String(metric.code || ''))),
    )?.code || requestedCode;
  }
  return requestedCode;
}

function ProductMetricBlocks({product, onOpenReport, focusBlock, focusSkill}) {
  const [detailMode, setDetailMode] = useState('compact');
  const [open, setOpen] = useState(() => new Set());
  const recommendations = product.metric_recommendations || [];
  const itemsByBlock = recommendations.reduce((result, item) => {
    const key = recommendationBlockCode(product, item.block_code || 'other');
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
    return result;
  }, new Map());
  const activeBlockCodes = (product.metrics || []).filter((block) => itemsByBlock.has(block.code)).map((block) => block.code);
  useEffect(() => {
    if (!focusBlock || !itemsByBlock.has(focusBlock)) return;
    setOpen((current) => new Set(current).add(focusBlock));
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      const skillTarget = focusSkill ? document.getElementById(`ai-recommendation-skill-${focusBlock}-${encodeURIComponent(focusSkill)}`) : null;
      (skillTarget || document.getElementById(`ai-recommendation-block-${focusBlock}`))?.scrollIntoView({behavior: 'smooth', block: 'start'});
    }));
    return () => cancelAnimationFrame(frame);
  }, [focusBlock, focusSkill, product.id]);
  const toggle = (code) => setOpen((current) => {
    const next = new Set(current);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });

  return (
    <section className="metric-recommendations-page">
      <Alert
        className="metric-recommendations-intro"
        theme="info"
        view="outlined"
        size="m"
        title="Рекомендации по продуктовым метрикам"
        message="К ключевым блокам Data Driven мы подтянули доступные продуктовые показатели из текущей отчётности и подготовили рекомендации по зонам внимания."
      />

      <Card className="promo metric-report-promo" view="outlined">
        <div><Text variant="subheader-1">Посмотреть комплексный отчет по продукту</Text><Text variant="body-1" color="secondary">Больше подробностей можно посмотреть в комплексном отчёте. Мы подготовили его на основе расширенного пула источников, которые вы можете использовать.</Text></div>
        <Button view="action" size="m" onClick={onOpenReport}>Перейти <Icon data={ChevronRight} size={14} /></Button>
      </Card>

      <section className="metrics-section product-metrics-section">
        <div className="metrics-title"><h2>Ключевые блоки DD-рейтинга</h2><div className="detail-mode" role="group" aria-label="Вид продуктовых метрик"><Button selected={detailMode === 'detailed'} onClick={() => { setDetailMode('detailed'); setOpen(new Set(activeBlockCodes)); }}>Подробно</Button><Button selected={detailMode === 'compact'} onClick={() => { setDetailMode('compact'); setOpen(new Set()); }}>Компактно</Button></div></div>
        <div className="metrics-grid product-metrics-grid">
          {(product.metrics || []).map((block) => {
            const items = itemsByBlock.get(block.code) || [];
            const hasRecommendations = items.length > 0;
            const isOpen = hasRecommendations && open.has(block.code);
            const light = hasRecommendations ? worstDigestLight(items) : 'gray';
            const toolGroups = items.reduce((result, item) => {
              const toolName = displaySkillName(item.skill_name) || 'Другие показатели';
              if (!result.has(toolName)) result.set(toolName, new Map());
              const productGroups = result.get(toolName);
              const productName = item.product_group || (item.ai_products?.length ? item.ai_products.join(' + ') : 'Продукт не указан');
              if (!productGroups.has(productName)) productGroups.set(productName, []);
              productGroups.get(productName).push(item);
              return result;
            }, new Map());
            return (
              <Card id={`ai-recommendation-block-${block.code}`} key={block.code} className={`metric-block product-metric-block tone-${hasRecommendations ? digestTheme(light) : 'default'}${hasRecommendations ? '' : ' product-metric-block-empty'}`} view="outlined">
                <button className="metric-block-head" onClick={() => hasRecommendations && toggle(block.code)} aria-expanded={isOpen} disabled={!hasRecommendations}>
                  <Icon data={isOpen ? ChevronDown : ChevronRight} size={14} />
                  <div><h3>{block.name}</h3><span>{hasRecommendations ? 'Продуктовые метрики и рекомендации' : 'Рекомендаций пока нет'}</span></div>
                  <span className="product-metric-block-status"><i className={`metric-light metric-light-${digestTheme(light)}${hasRecommendations ? '' : ' product-metric-empty-light'}`} aria-hidden="true" /></span>
                </button>
                {isOpen && <div className="metric-list product-metric-list">
                  {[...toolGroups.entries()].map(([toolName, productGroups]) => <section id={`ai-recommendation-skill-${block.code}-${encodeURIComponent(toolName)}`} className="product-metric-tool-section" key={toolName}>
                    <div className="metric-group-title product-metric-tool-title"><span>{toolName}</span></div>
                    <div className={`product-metric-tool-content${productGroups.size === 1 ? ' product-metric-tool-content-single' : ''}`}>
                      {productGroups.size === 1
                        ? <ProductMetricRows items={[...productGroups.values()][0]} />
                        : [...productGroups.entries()].map(([productName, productItems], productIndex) => <Disclosure className="product-metric-product-disclosure" size="m" defaultExpanded={productIndex === 0} summary={<span className="product-metric-product-title">{productName}</span>} key={`${toolName}-${productName}`}>
                          <ProductMetricRows items={productItems} />
                        </Disclosure>)}
                    </div>
                  </section>)}
                </div>}
              </Card>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function Detail({product, products, rows, detailScore, onBack, onProduct}) {
  const score = scoreFor(product, rows);
  const maturity = groupFor(product, rows);
  const maturityTone = maturityTheme(maturity);
  const aiRecommendations = product.metric_recommendations || [];
  const hasAiRecommendations = aiRecommendations.length > 0;
  const aiRecommendationLight = hasAiRecommendations ? worstDigestLight(aiRecommendations) : 'gray';
  const aiRecommendationTheme = aiRecommendationLight === 'gray' ? 'default' : digestTheme(aiRecommendationLight);
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
  const [lens, setLens] = useState('dd');
  const [aiFocusBlock, setAiFocusBlock] = useState(null);
  const [aiFocusSkill, setAiFocusSkill] = useState(null);
  const [aiReturnMetric, setAiReturnMetric] = useState(null);
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [reportAccessOpen, setReportAccessOpen] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const generalRecommendationBlock = recommendationBlockCode(product, 'general');
  const mauMetricCode = (product.metrics || []).flatMap((block) => block.metrics || []).find((metric) => /\.mau_produkta$/i.test(String(metric.code || '')))?.code || 'general.mau_produkta';
  useEffect(() => {
    if (!hasAiRecommendations && lens === 'metrics') setLens('dd');
  }, [hasAiRecommendations, lens, product.id]);
  useEffect(() => setAiReturnMetric(null), [product.id]);
  const mauAiRecommendation = (product.metric_recommendations || []).find((item) => item.block_code === 'general' && /\bMAU\b/i.test(String(item.indicator || '')) && !/\bYAU\b/i.test(String(item.indicator || '')))
    || (product.metric_recommendations || []).find((item) => item.block_code === 'general' && /\bMAU\b/i.test(String(item.indicator || '')));
  const hasMauAiRecommendation = Boolean(mauAiRecommendation);
  const funnelAiRecommendation = (product.metric_recommendations || []).find((item) => item.skill_key === 'clickstream_funnel' || item.skill_name === 'Воронка оформления в СБОЛ');
  const draftAiRecommendations = (product.metric_recommendations || []).filter((item) => item.skill_key === 'drafts' || item.skill_name === 'Черновики');
  const campaignFunnelAiRecommendations = (product.metric_recommendations || []).filter((item) => item.skill_key === 'funnel' || item.skill_name === 'Воронка кампейнинга');
  const csiAiRecommendations = (product.metric_recommendations || []).filter((item) => item.skill_key === 'csi' || item.skill_name === 'CSI');
  const complaintsAiRecommendations = (product.metric_recommendations || []).filter((item) => item.skill_key === 'complaints' || item.skill_name === 'Жалобы и обращения');
  const openMauAiRecommendation = () => {
    setAiFocusBlock(generalRecommendationBlock);
    setAiFocusSkill('Ключевые метрики');
    setAiReturnMetric(mauMetricCode);
    setLens('metrics');
  };
  const openFunnelAiRecommendation = () => {
    setAiFocusBlock('attract');
    setAiFocusSkill('Воронка оформления в СБОЛ');
    setAiReturnMetric('attract.funnel_analysis');
    setLens('metrics');
  };
  const openDraftAiRecommendation = () => {
    setAiFocusBlock('attract');
    setAiFocusSkill('Черновики');
    setAiReturnMetric('attract.chernoviki_v_sbol_70');
    setLens('metrics');
  };
  const openCampaignFunnelAiRecommendation = () => {
    setAiFocusBlock('attract');
    setAiFocusSkill('Воронка кампейнинга');
    setAiReturnMetric('attract.funnel_analysis');
    setLens('metrics');
  };
  const openCsiAiRecommendation = () => {
    setAiFocusBlock('cx');
    setAiFocusSkill('CSI');
    setAiReturnMetric('cx.score');
    setLens('metrics');
  };
  const openComplaintsAiRecommendation = () => {
    setAiFocusBlock('cx');
    setAiFocusSkill('Жалобы и обращения');
    setAiReturnMetric('cx.score');
    setLens('metrics');
  };
  const returnToDataDriven = () => {
    const target = aiReturnMetric;
    setLens('dd');
    setAiReturnMetric(null);
    setAiFocusBlock(null);
    setAiFocusSkill(null);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(metricDomId(target))?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }));
  };
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
        <div className="detail-controls">
          <div className="product-select detail-section-select">
            <span>Раздел</span>
            <SegmentedRadioGroup value={lens} onUpdate={(value) => { setLens(value); setAiFocusBlock(null); setAiFocusSkill(null); setAiReturnMetric(null); }} size="l">
              <SegmentedRadioGroup.Option value="dd">Data-Driven Index</SegmentedRadioGroup.Option>
              <SegmentedRadioGroup.Option value="metrics" disabled={!hasAiRecommendations}><span className="detail-lens-option" title={hasAiRecommendations ? digestStatus(aiRecommendationLight) : 'Рекомендаций пока нет'}>AI-рекомендации<i className={`metric-light metric-light-${aiRecommendationTheme}${aiRecommendationLight === 'gray' ? ' detail-lens-light-empty' : ''}`} aria-hidden="true" /><span className="visually-hidden">{hasAiRecommendations ? digestStatus(aiRecommendationLight) : 'Рекомендаций пока нет'}</span></span></SegmentedRadioGroup.Option>
            </SegmentedRadioGroup>
          </div>
          <label className="product-select"><span>Команда</span><Select filterable filterPlaceholder="Найти команду" value={[product.id]} onUpdate={(value) => onProduct(products.find((item) => item.id === value[0]))} width={300} size="l">
          {[...products].sort((a, b) => compareNames(a.name, b.name)).map((item) => <Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>)}
          </Select></label>
        </div>
      </header>

      <div className={lens === 'dd' ? 'detail-lens-content' : 'detail-lens-content detail-lens-hidden'}>
      <div className="notice"><div className="notice-copy"><b>Значение индекса может корректироваться в зависимости от валидации источников и точечного аудита</b><span>Расчет не включает A/B тесты. Добавление – после 15 июля</span></div></div>
      <section className="detail-overview">
        <Card className={`index-profile-card tone-${maturityTone}`} view="outlined"><div className={`index-card tone-${maturityTone}${detailScore ? '' : ' index-card-compact'}`}><div className="index-card-title"><span>{product.name}</span><HelpMark aria-label="Формула Data-Driven Index" popoverProps={HELP_POPOVER_PROPS}><IndexFormulaHelp /></HelpMark></div><div className="index-score"><strong>{score}%</strong><b>/ 100</b><em>{maturity}</em></div><Progress value={score} theme={maturityTone} size="s" /><div className="scale"><span>Требуют внимания</span><span>Развивающиеся</span><span>Зрелые</span><span>Лидеры Data Driven</span></div><div className="index-next-level"><Text variant="body-1" color={nextLevel ? 'primary' : 'positive'}>{nextLevel ? `До уровня «${nextLevel.name}» — ${percentToNextLevel}%` : 'Максимальный уровень достигнут'}</Text></div>{detailScore && <div className="index-points"><Text variant="caption-1" color="secondary">Набрано {earnedPoints.toFixed(2)} баллов из {maxPoints.toFixed(2)}</Text>{nextLevel && <Text variant="caption-1" color="secondary">До следующего уровня — {pointsToNextLevel.toFixed(2)} балла</Text>}</div>}</div><div className="profile-card"><Text variant="subheader-1">Профиль Data-Driven индекса</Text><div className="profile-radar"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="62%"><PolarGrid stroke="var(--g-color-line-generic)" /><PolarAngleAxis dataKey="name" tick={{fill: 'var(--g-color-text-secondary)', fontSize: 10}} /><Tooltip formatter={(value, name) => [`${value}%`, name]} /><Radar name="B2C" dataKey="benchmark" stroke="var(--g-color-text-secondary)" fill="var(--g-color-base-generic-medium)" fillOpacity={0.25} strokeWidth={2} strokeDasharray="4 3" /><Radar name={profileSeries.label} dataKey="product" stroke={profileSeries.stroke} fill={profileSeries.fill} fillOpacity={0.2} strokeWidth={2} dot={{r: 2, fill: profileSeries.fill}} /><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize: 11, color: 'var(--g-color-text-secondary)'}} /></RadarChart></ResponsiveContainer></div></div></Card>
        <Card className="top-recommendations" view="outlined"><h2>Рекомендации и фокусы для повышения DD-индекса</h2>{recommendations.slice(0, 4).map((item, index) => { const difficulty = difficultyMeta(item.difficulty); return <div className="top-recommendation" key={`${item.block}-${item.recommendation}`}><div className="recommendation-marker"><span>{index + 1}</span><Label theme={difficulty.theme} size="xs">{difficulty.label}</Label></div><div><b>{item.recommendation}</b><small>{item.block}</small></div><div className="recommendation-side"><div className="recommendation-uplift"><b>+{item.indexUplift.toFixed(1)} п.п. индекса</b>{detailScore && <span>+{item.gap.toFixed(2)} балла</span>}</div></div></div>; })}<Button view="flat-info" onClick={() => setRecommendationsOpen(true)}>Все рекомендации <Label size="xs">{recommendations.length}</Label><Icon data={ChevronRight} size={14} /></Button></Card>
      </section>
      <Dialog open={recommendationsOpen} onClose={() => setRecommendationsOpen(false)} hasCloseButton maxWidth="m" fullWidth contentOverflow="auto">
        <Dialog.Header caption={`Все рекомендации · ${recommendations.length}`} />
        <Dialog.Body>
          <div className="recommendations-dialog-list">
            {recommendations.map((item, index) => { const difficulty = difficultyMeta(item.difficulty); return <div className="dialog-recommendation" key={`${item.block}-${item.recommendation}-${index}`}><div className="recommendation-marker"><span>{index + 1}</span><Label theme={difficulty.theme} size="xs">{difficulty.label}</Label></div><div><b>{item.recommendation}</b><small>{item.count} {metricWord(item.count)} · {item.block}</small></div><div className="recommendation-side"><div className="recommendation-uplift"><b>+{item.indexUplift.toFixed(1)} п.п. индекса</b>{detailScore && <span>+{item.gap.toFixed(2)} балла</span>}</div></div></div>; })}
          </div>
        </Dialog.Body>
      </Dialog>
      <section className="metrics-section">
        <div className="metrics-title"><h2>Ключевые блоки DD-рейтинга</h2><div className="detail-mode" role="group" aria-label="Вид деталей"><Button selected={detailMode === 'detailed'} onClick={() => { setDetailMode('detailed'); setOpen(new Set((product.metrics || []).map((item) => item.code))); }}>Подробно</Button><Button selected={detailMode === 'compact'} onClick={() => { setDetailMode('compact'); setOpen(new Set()); }}>Компактно</Button></div></div>
        <div className="metrics-grid">
          {(product.metrics || []).map((block) => {
            const metrics = (block.metrics || []).filter(isVisibleMetric);
            const blockScore = blockPercent(block);
            const allIrrelevant = metrics.length > 0 && metrics.every((metric) => metric.is_applicabble_flg === false);
            const isOpen = open.has(block.code);
            const value = metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
            const max = metrics.reduce((sum, metric) => sum + Number(metric.max_value || 0), 0);
            const blockLinks = linksForBlock(block, product.metrics || [], product.type);
            const instructions = (block.tools || []).filter((tool) => tool.kind === 'instruction' && tool.button?.link);
            return (
              <Card key={block.code} className={`metric-block tone-${allIrrelevant ? 'default' : progressTheme(blockScore)}`} view="outlined">
                <div className="dd-metric-block-head">
                  <button className="dd-metric-block-main" onClick={() => toggle(block.code)} aria-expanded={isOpen}>
                    <Icon data={isOpen ? ChevronDown : ChevronRight} size={14} />
                    <div><h3>{block.name}</h3>{detailScore && <span>Набрано {value.toFixed(2)} баллов из {max.toFixed(2)}</span>}</div>
                  </button>
                  <div className="dd-metric-block-help">
                    {block.code === 'goals' && <HelpMark aria-label="Критерии оценки мониторинга целей" popoverProps={HELP_POPOVER_PROPS}><GoalsHelpContent /></HelpMark>}
                    {block.code === 'alerts' && <HelpMark aria-label="Критерии оценки алертов" popoverProps={HELP_POPOVER_PROPS}><AlertsHelpContent /></HelpMark>}
                    {block.code === 'general' && <HelpMark aria-label="Источник оценки" popoverProps={HELP_POPOVER_PROPS}>На основании пройденной самооценки в Oprosso</HelpMark>}
                  </div>
                  <div className="dd-metric-block-score">{allIrrelevant ? <span className="metric-block-na">Нерелевантно</span> : <strong>{blockScore}%</strong>}</div>
                </div>
                {isOpen && <div className="metric-list">{metrics.map((metric, index) => { const group = metricGroup(metric); const previousGroup = index > 0 ? metricGroup(metrics[index - 1]) : ''; const instruction = /^alerts\.business_metrics$/i.test(metric.code) ? instructions[0] : null; const library = /^hyp\.datadriven_rating_7_5$/i.test(metric.code) && metric.button?.link ? metric.button : null; let aiMetricInsight = null; if (hasMauAiRecommendation && /\.mau_produkta$/i.test(metric.code)) aiMetricInsight = metricAiInsight('динамике MAU', openMauAiRecommendation); if (draftAiRecommendations.length && /^attract\.chernoviki_v_sbol_70$/i.test(metric.code)) aiMetricInsight = metricAiInsight('черновикам в СБОЛ', openDraftAiRecommendation); if (campaignFunnelAiRecommendations.length && /^attract\.funnel_analysis$/i.test(metric.code)) aiMetricInsight = metricAiInsight('воронке кампейнинга', openCampaignFunnelAiRecommendation); const aiMetricInsights = []; if (funnelAiRecommendation && /^attract\.funnel_analysis$/i.test(metric.code)) aiMetricInsights.push(metricAiInsight('воронке оформления в СБОЛ', openFunnelAiRecommendation)); if (/^cx\.score$/i.test(metric.code) && csiAiRecommendations.length) aiMetricInsights.push(metricAiInsight('CSI', openCsiAiRecommendation)); if (/^cx\.score$/i.test(metric.code) && complaintsAiRecommendations.length) aiMetricInsights.push(metricAiInsight('жалобам и обращениям', openComplaintsAiRecommendation)); const normalizedGroup = group.toLowerCase(); const isReportingGroup = normalizedGroup === 'отчетность'; const isAnalysisGroup = normalizedGroup === 'анализ'; return <React.Fragment key={metric.code}>{group && group !== previousGroup && <div className="metric-group-title"><span>{group}</span>{isReportingGroup && (block.code === 'attract' ? <HelpMark aria-label="Критерии оценки отчётности по воронке привлечения" popoverProps={HELP_POPOVER_PROPS}><AttractReportingHelpContent /></HelpMark> : <HelpMark aria-label="Учитываемые поверхности" popoverProps={HELP_POPOVER_PROPS}>Учитываются поверхности: Навигатор, Clickstream, приложенные к опросу</HelpMark>)}{isAnalysisGroup && block.code === 'attract' && <HelpMark aria-label="Критерии оценки анализа воронки привлечения" popoverProps={HELP_POPOVER_PROPS}><AttractAnalysisHelpContent /></HelpMark>}</div>}{!group && previousGroup && <div className="metric-group-break" aria-hidden="true" />}<MetricRow metric={metric} detailScore={detailScore} instruction={instruction} library={library} aiMetricInsight={aiMetricInsight} aiMetricInsights={aiMetricInsights} grouped={Boolean(group)} /></React.Fragment>; })}</div>}
                {blockLinks.length > 0 && isOpen && <div className="block-links"><div className="block-links-title">Полезные ссылки</div><div className="block-actions">{blockLinks.map((action) => <Button key={`${action.label}-${action.url}`} view="outlined-info" size="s" width="auto" href={action.url} target="_blank">{action.label}<Icon data={ArrowUpRightFromSquare} size={13} /></Button>)}</div></div>}
              </Card>
            );
          })}
        </div>
      </section>
      </div>
      {lens === 'metrics' && <ProductMetricBlocks key={product.id} product={product} onOpenReport={() => setReportAccessOpen(true)} focusBlock={aiFocusBlock} focusSkill={aiFocusSkill} />}
      {lens === 'metrics' && aiReturnMetric && <div className="ai-return-action"><Button view="action" size="l" onClick={returnToDataDriven}><Icon data={ArrowLeft} size={16} />Назад к Data-Driven индексу</Button></div>}
      <Dialog open={reportAccessOpen} onClose={() => setReportAccessOpen(false)} hasCloseButton maxWidth="m" fullWidth>
        <Dialog.Header caption="Комплексный отчет" />
        <Dialog.Body>
          <div className="report-access-content">
            <Text variant="subheader-1">Доступ к системе</Text>
            <Text variant="body-2">Для доступа непосредственно к системе необходимо в АС Друг в поисковой строке ввести «Доступ к стендам разработки и тестирования», далее:</Text>
            <ul>
              <li><Text variant="body-1">В поле стенд указать «ТС AI Навыки Штаба B2C (CI09261834) (DEV) (CI09933741)»</Text></li>
              <li><Text variant="body-1">В обосновании — «Для разработки и тестирования инструмента AI суммаризации»</Text></li>
            </ul>
            <div className="report-access-actions"><Button view="outlined" size="m" href={REPORT_ACCESS_REQUEST_URL} target="_blank">Завести заявку на доступ</Button><Button view="action" size="m" href={COMPLEX_REPORT_URL} target="_blank">Перейти</Button></div>
          </div>
        </Dialog.Body>
      </Dialog>
    </main>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard');
  const [selected, setSelected] = useState(null);
  const [detailScore, setDetailScore] = useState(false);
  useEffect(() => { fetch('./report-data.json').then((response) => response.json()).then(setData); }, []);
  if (!data) return <div className="loading"><Spin size="xl" /></div>;
  const rows = data.title?.rows || [];
  const product = selected || data.products[0];
  const openProduct = (item) => { setSelected(item); setView('detail'); window.scrollTo(0, 0); };
  const toggleDetailScore = () => setDetailScore((value) => {
    const nextValue = !value;
    if (!nextValue && view === 'summary') setView('dashboard');
    return nextValue;
  });
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
    ...(detailScore ? [{
      id: 'summary',
      title: '\u0421\u0432\u043e\u0434\u043d\u0430\u044f \u0442\u0430\u0431\u043b\u0438\u0446\u0430',
      tooltipText: '\u0421\u0432\u043e\u0434\u043d\u0430\u044f \u0442\u0430\u0431\u043b\u0438\u0446\u0430',
      icon: ChartColumn,
      current: view === 'summary',
      onItemClick: () => setView('summary'),
    }] : []),
    {
      id: 'about',
      title: 'О Data Driven',
      tooltipText: 'О Data Driven',
      icon: CircleInfo,
      current: view === 'about',
      onItemClick: () => setView('about'),
    },
  ];
  const content = view === 'summary'
    ? <Summary products={data.products} rows={rows} />
    : view === 'dashboard'
      ? <DashboardSummary products={data.products} rows={rows} onOpen={openProduct} onAbout={() => { setView('about'); window.scrollTo(0, 0); }} />
      : view === 'about'
        ? <AboutDataDriven onBack={() => { setView('dashboard'); window.scrollTo(0, 0); }} />
        : <Detail product={product} products={data.products} rows={rows} detailScore={detailScore} onBack={() => setView('dashboard')} onProduct={setSelected} />;
  return (
    <AsideHeader
      compact
      className="dd-navigation"
      logo={{text: 'Data-Driven Index', iconSrc: ocb2cLogo, iconSize: 30, iconClassName: 'dd-navigation-logo', href: '#', onClick: (event) => { event.preventDefault(); setView('dashboard'); window.scrollTo(0, 0); }, 'aria-label': 'Открыть Summary'}}
      menuItems={menuItems}
      hideCollapseButton
      renderFooter={() => <button type="button" className="navigation-period" aria-pressed={detailScore} title={detailScore ? 'Скрыть служебный режим' : 'Показать служебный режим'} onClick={toggleDetailScore}><Icon data={CircleInfo} size={16} /></button>}
      renderContent={() => content}
    />
  );
}

createRoot(document.getElementById('root')).render(<ThemeProvider theme="light"><App /></ThemeProvider>);
