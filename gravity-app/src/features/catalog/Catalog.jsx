import React, {useEffect, useMemo, useState} from 'react';
import {ArrowDown, ChevronDown, ChevronRight} from '@gravity-ui/icons';
import {Button, Dialog, Icon, Label, Progress, SegmentedRadioGroup, Text, TextInput} from '@gravity-ui/uikit';
import {blockPercent, difficultyMeta, filterCampaigningLinks, filterDraftLinks, filterInapplicableMetricGroups, filterInapplicableMetricSubgroups, filterMetricsForBlock, groupFor, inapplicableMetricLabel, isCampaigningRelevant, isCrossSellDigitallyConfirmed, isDraftsRelevant, isInformationalMetric, isTbdMetric, metricDomId, percent, scoreFor, teamHelpAudience} from '../../domain/report.js';
import {PRODUCT_KEY_METRIC_LINKS, SEGMENT_KEY_METRIC_LINKS, contextualBlockLinksForTeam, isLegacyProductKeyMetricLink, isProductSatelliteLink, keyMetricLinksForTeam} from './keyMetricLinks.js';

export {blockPercent, difficultyMeta, filterCampaigningLinks, filterDraftLinks, filterInapplicableMetricGroups, filterInapplicableMetricSubgroups, filterMetricsForBlock, groupFor, inapplicableMetricLabel, isCampaigningRelevant, isCrossSellDigitallyConfirmed, isDraftsRelevant, isInformationalMetric, isTbdMetric, metricDomId, percent, scoreFor, teamHelpAudience};

export const REPORT_ACCESS_REQUEST_URL = 'https://sberfriend.sberbank.ru/deeplink-hash-catcher/?path=L3NiZXJmcmllbmQv&callback=L2RlZXBsaW5rLWtlZXBlci8=#/application/F3C76EADA61AB8EBE053F7E9740A44EF?sberfriend.searchQuery=%D0%94%D1%80%D1%83%D0%B3%D0%B5%20%D0%BE%D1%84%D0%BE%D1%80%D0%BC%D0%B8%D1%82%D1%8C%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%20%D0%BA%20%D1%81%D1%82%D0%B5%D0%BD%D0%B4%D0%B0%D0%BC%20%D1%80%D0%B0%D0%B7%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BA%D0%B8%20%D0%B8%20%D1%82%D0%B5%D1%81%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F';
export const COMPLEX_REPORT_URL = 'http://tvlds-mvp001760.cloud.delta.sbrf.ru:8014/complex-report';
export const HELP_POPOVER_PROPS = {trigger: 'all', openDelay: 0, closeDelay: 80, rest: 0};
export const TEAM_CONTACT_MAILTO = 'mailto:MYCherkova@sberbank.ru?cc=yspetukhova%40sberbank.ru';
export {PRODUCT_KEY_METRIC_LINKS, SEGMENT_KEY_METRIC_LINKS};

export function wrapRadarLabel(value, maxLength = 15) {
  const words = String(value || '').replace(/([/–—-])/g, '$1 ').trim().split(/\s+/);
  return words.reduce((lines, word) => {
    const current = lines[lines.length - 1];
    if (!current || `${current} ${word}`.length > maxLength) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
    return lines;
  }, []);
}

export function ProductRadarTick({x, y, cx, payload}) {
  const lines = wrapRadarLabel(payload?.value);
  const anchor = x < cx - 4 ? 'end' : x > cx + 4 ? 'start' : 'middle';
  const adjustedX = x + (anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0);
  const lineHeight = 11;
  return (
    <text className="product-radar-axis" x={adjustedX} y={y} textAnchor={anchor} dominantBaseline="central">
      {lines.map((line, index) => <tspan key={`${line}-${index}`} x={adjustedX} dy={index === 0 ? -((lines.length - 1) * lineHeight) / 2 : lineHeight}>{line}</tspan>)}
    </text>
  );
}

export function progressTheme(value) {
  if (value >= 60) return 'success';
  if (value >= 40) return 'warning';
  return 'danger';
}

export function maturityTheme(group) {
  const value = String(group || '').toLowerCase();
  if (value.includes('лидер')) return 'success';
  if (value.includes('зрел')) return 'info';
  if (value.includes('развива')) return 'warning';
  if (value.includes('вниман')) return 'danger';
  return 'default';
}

export function metricGroup(metric) {
  if (/^churn\.(?:funnel_analysis|deviation_actions|benchmarks)$/i.test(String(metric.code || ''))) return 'Анализ';
  return String(metric.metric_subgroup || '').trim();
}

export function isVisibleMetric(metric) {
  const isOwnMechanics = /(?:^|\.)nalichie_sobstvennyh_mehanik$/i.test(String(metric.code || ''))
    || /^наличие собственных механик$/i.test(String(metric.name || '').trim());
  return !isOwnMechanics || metric.is_applicabble_flg !== false;
}

export function pilotToolLinks(block) {
  if (!isCampaigningRelevant(block)) return [];
  const links = [];
  const collect = (tool) => {
    if (/^(?:пилотные кампании|поиск по пилотам)$/i.test(String(tool?.name || '').trim()) && tool.button?.link) {
      links.push({label: tool.name, href: tool.button.link});
    }
    (tool?.buttons || []).forEach(collect);
    (tool?.tools || []).forEach(collect);
  };
  (block.tools || []).forEach(collect);
  return links.filter((item, index) => links.findIndex((candidate) => candidate.label === item.label && candidate.href === item.href) === index);
}

export function collectBlockLinks(block) {
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

export function linksForBlock(block, allBlocks = [], product = {type: 'Продукт'}) {
  const draftLinks = allBlocks.flatMap(collectBlockLinks).filter((item) => /черновик/i.test(item.label));
  const isKeyMetricsBlock = block.code === 'general' || /знание ключевых метрик/i.test(String(block.name || ''));
  const productDescriptor = typeof product === 'string' ? {type: product} : product;
  const audience = teamHelpAudience(productDescriptor);
  const isPhygitalChannel = audience === 'service-channel' || audience === 'telemarketing';
  const isDpDigitalChannel = audience === 'digital-channel' && String(productDescriptor?.unit || '').trim().toLowerCase() === 'dp';
  const keyMetricLinks = isKeyMetricsBlock ? keyMetricLinksForTeam(productDescriptor, audience) : [];
  const contextualLinks = contextualBlockLinksForTeam(productDescriptor, block);
  const collectedLinks = collectBlockLinks(block)
    .filter((item) => !(isKeyMetricsBlock && isPhygitalChannel && isLegacyProductKeyMetricLink(item)))
    .filter((item) => !(isKeyMetricsBlock && isDpDigitalChannel && isProductSatelliteLink(item)));
  const ownLinks = [...collectedLinks, ...keyMetricLinks, ...contextualLinks].filter((item) => block.code === 'attract' || !/черновик/i.test(item.label));
  const relocatedLinks = block.code === 'attract' ? [...ownLinks, ...draftLinks] : ownLinks;
  const uniqueLinks = filterDraftLinks(block, filterCampaigningLinks(block, relocatedLinks))
    .filter((item) => !/библиотек[ау] решений/i.test(item.label))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label && candidate.url === item.url) === index);
  return block.code === 'cx'
    ? uniqueLinks.filter((item) => /^(?:(?:открыть )?(?:cx|ux) score|cjxplorer|losshunter)$/i.test(item.label))
    : uniqueLinks;
}

const nameCollator = new Intl.Collator('en', {sensitivity: 'base', numeric: true});
export const compareNames = (a, b) => nameCollator.compare(String(a || ''), String(b || ''));
export const isUnitFilterOption = (value) => String(value || '').trim().toLowerCase() !== 'каналы';

export function typeTone(type) {
  const value = String(type || '').toLowerCase();
  if (value.includes('сегмент')) return 'segment';
  if (value.includes('канал')) return 'channel';
  return 'product';
}

export function radarSeries(type) {
  const tone = typeTone(type);
  const label = tone === 'segment' ? 'Сегмент' : tone === 'channel' ? 'Канал' : 'Продукт';
  return {label, stroke: 'var(--g-color-base-brand)', fill: 'var(--g-color-base-brand)'};
}

export function metricWord(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'метрика';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'метрики';
  return 'метрик';
}

export const catalogGroups = [
  {type: 'Продукт', label: 'Продукты', tone: 'product'},
  {type: 'Сегмент', label: 'Сегменты', tone: 'segment'},
  {type: 'Канал', label: 'Каналы', tone: 'channel'},
];

export function CatalogDialog({openType, products, rows, onOpen, onClose}) {
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

export function CatalogDialogFiltered({openType, openMaturity, products, rows, onOpen, onClose}) {
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
      const sortedItems = [...items].sort((a, b) => sort === 'score'
        ? (b.score - a.score) || compareNames(a.name, b.name)
        : compareNames(a.name, b.name));
      return {...unit, items: sortedItems, avg: items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0};
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
