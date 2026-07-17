import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ChevronRight, CircleDollar, CircleInfo, NodesRight, Persons} from '@gravity-ui/icons';
import {Button, Card, Dialog, Icon, Label, Select, Text, TextInput} from '@gravity-ui/uikit';
import {Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip} from 'recharts';
import {resolveStaticLink} from '../domain/linkRules.js';
import {antiTopBlockLabel} from '../domain/report.js';
import {ApplicableRadarDot, ApplicableRadarShape, CatalogDialogFiltered, compareNames, isUnitFilterOption, maturityTheme, radarBlockPercent, typeTone} from '../features/catalog/Catalog.jsx';

export function DashboardPage({products, rows, summaryFilters, onSummaryFiltersChange, onOpen, onAbout, linkRules = []}) {
  const [catalogType, setCatalogType] = useState('');
  const [catalogMaturity, setCatalogMaturity] = useState(null);
  const [teamContactOpen, setTeamContactOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const [teamSearchOpen, setTeamSearchOpen] = useState(false);
  const teamSearchRef = useRef(null);
  const periods = useMemo(() => [...new Set(products.map((item) => item.period).filter(Boolean))].sort(compareNames), [products]);
  const period = summaryFilters?.period || periods[0] || '';
  const unit = summaryFilters?.unit || '';
  const [hoveredBlock, setHoveredBlock] = useState('');
  const units = useMemo(() => [...new Set(products.filter((item) => !period || item.period === period).map((item) => item.unit).filter((item) => item && isUnitFilterOption(item)))].sort(compareNames), [products, period]);
  const periodProducts = useMemo(() => products.filter((item) => !period || item.period === period), [products, period]);
  const scopedProducts = useMemo(() => periodProducts.filter((item) => !unit || item.unit === unit), [periodProducts, unit]);
  useEffect(() => {
    if (unit && !units.includes(unit)) onSummaryFiltersChange({unit: ''});
  }, [onSummaryFiltersChange, unit, units]);
  useEffect(() => {
    const closeTeamSearch = (event) => {
      if (!teamSearchRef.current?.contains(event.target)) setTeamSearchOpen(false);
    };
    document.addEventListener('pointerdown', closeTeamSearch);
    return () => document.removeEventListener('pointerdown', closeTeamSearch);
  }, []);
  const teamMatches = useMemo(() => {
    const normalizedQuery = teamQuery.trim().toLowerCase();
    return scopedProducts.filter((item) => [item.name, item.type, item.unit, item.tribe]
      .filter(Boolean)
      .some((value) => !normalizedQuery || value.toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => compareNames(a.name, b.name));
  }, [scopedProducts, teamQuery]);
  const teamContactLink = resolveStaticLink(linkRules, 'dashboard.team-contact');
  const rowForProduct = (product) => rows.find((row) => row.product_id === product.id)
    || rows.find((row) => row.name === product.name && row.unit === product.unit);
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
        .map(radarBlockPercent)
        .filter((value) => value !== null);
      return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    };
    return {name: block.name, b2c: averageFor(periodProducts), unit: averageFor(scopedProducts)};
  });
  const radarScoreValues = periodProducts
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
      if (!metricGroups.has(key)) metricGroups.set(key, {name: metric.name, block: block.name, teams: new Set(), incompleteTeams: new Set()});
      const group = metricGroups.get(key);
      group.teams.add(product.name);
      if (Number(metric.value || 0) / Number(metric.max_value) < 1) group.incompleteTeams.add(product.name);
    })));
    return [...metricGroups.values()].map((item) => ({
      name: item.name,
      block: item.block,
      teams: item.teams.size,
      incompleteTeams: item.incompleteTeams.size,
      incompleteShare: item.teams.size ? Math.round(item.incompleteTeams.size / item.teams.size * 100) : 0,
    })).sort((a, b) => (b.incompleteTeams - a.incompleteTeams) || (b.incompleteShare - a.incompleteShare) || (b.teams - a.teams) || compareNames(a.name, b.name)).slice(0, 7);
  }, [scopedProducts]);

  return (
    <main className="content dashboard-page">
      <header className="dashboard-header">
        <div><h1>Summary</h1><Text variant="body-1" color="secondary">Сводный профиль Data-Driven Index по B2C</Text></div>
        <div className="dashboard-header-actions">
          <label className="dashboard-unit-filter"><span>Юнит</span><Select value={unit ? [unit] : []} onUpdate={(value) => onSummaryFiltersChange({unit: value[0] || ''})} placeholder="Все юниты" width={190}><Select.Option value="">Все юниты</Select.Option>{units.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}</Select></label>
          <div ref={teamSearchRef} className="dashboard-team-search" onFocusCapture={() => setTeamSearchOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') setTeamSearchOpen(false); }}>
            <div className="dashboard-team-search-head">
              <Text variant="subheader-1">Найти свою команду</Text>
              <Button view="flat-danger" size="s" onClick={() => { setTeamSearchOpen(false); setTeamContactOpen(true); }}>Не нашли свою команду?</Button>
            </div>
            <TextInput value={teamQuery} onUpdate={setTeamQuery} placeholder={unit ? `Команды юнита ${unit}` : 'Все команды'} size="m" hasClear />
            {teamSearchOpen && <div className="dashboard-team-search-menu" role="listbox" aria-label={unit ? `Команды юнита ${unit}` : 'Все команды'}>
              <div className="dashboard-team-search-menu-meta">{unit ? `Юнит ${unit}` : 'Все юниты'} · {teamMatches.length} команд</div>
              {teamMatches.length ? teamMatches.map((item) => <Button key={item.id} view="flat" width="max" role="option" onClick={() => { setTeamSearchOpen(false); setTeamQuery(''); onOpen(item); }}><span className="dashboard-team-search-result"><b>{item.name}</b><small>{item.type} · {item.unit}</small></span></Button>) : <Text color="secondary">Команда не найдена</Text>}
            </div>}
          </div>
          <label className="dashboard-period"><span>Период</span><Select value={period ? [period] : []} onUpdate={(value) => onSummaryFiltersChange({period: value[0] || ''})} width={190}>{periods.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}</Select></label>
        </div>
      </header>

      <Dialog open={teamContactOpen} onClose={() => setTeamContactOpen(false)} hasCloseButton maxWidth="s">
        <Dialog.Header caption="Не нашли свою команду?" />
        <Dialog.Body className="team-contact-dialog-body">
          <Text variant="body-2">Для добавления команды или уточнения статуса напишите</Text>
          {teamContactLink && <Button view="action" size="m" href={teamContactLink.url}>{teamContactLink.label}</Button>}
        </Dialog.Body>
      </Dialog>

      <section className="dashboard-category-grid" aria-label="Сводка по типам команд">
        {categoryCards.map((category) => <Card key={category.key} className={`dashboard-category-card dashboard-category-${category.tone}${category.items.length ? '' : ' is-empty'}`} view="outlined">
          <div className="dashboard-category-head"><div className="dashboard-category-icon"><Icon data={category.icon} size={20} /></div><h2>{category.label}</h2></div>
          <div className="dashboard-category-score"><div>{category.average === null ? <Text variant="subheader-2" color="secondary">Нет данных</Text> : <><strong>{category.average}%</strong><span>/100</span></>}</div><span className="dashboard-category-caption">Средний Data-Driven Index</span><small>Оценено команд: <b>{category.items.length}</b></small></div>
          <div className="dashboard-maturity"><span>По уровню зрелости</span><div className="dashboard-maturity-grid">{category.maturityCounts.map((level) => <button type="button" className="dashboard-maturity-counter" key={level.theme} disabled={!level.count} onClick={() => { setCatalogMaturity(level); setCatalogType(category.typeLabel); }}><span>{level.label}</span><strong>{level.count}</strong><Icon data={ChevronRight} size={13} /></button>)}</div></div>
          <Button className="dashboard-category-footer" view="flat-info" disabled={!category.items.length} onClick={() => { setCatalogMaturity(null); setCatalogType(category.typeLabel); }}>Все {category.label.toLowerCase()}</Button>
        </Card>)}
      </section>

      <CatalogDialogFiltered openType={catalogType} openMaturity={catalogMaturity} products={scopedProducts} rows={rows} onOpen={onOpen} onClose={() => { setCatalogType(''); setCatalogMaturity(null); }} />

      <section className="dashboard-analysis-grid">
        <Card className="dashboard-radar-card" view="outlined"><div className="dashboard-card-title"><div><h2>Профиль B2C</h2></div><div className="dashboard-radar-score" aria-label={`Средний Data-Driven Index B2C: ${radarAverage === null ? 'нет данных' : `${radarAverage}%`}`}><div><strong>{radarAverage === null ? '—' : radarAverage}</strong>{radarAverage !== null && <span>%</span>}</div><small>Средний Data-Driven Index</small></div></div><div className="dashboard-radar"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="62%"><PolarGrid stroke="var(--g-color-line-generic)" /><PolarAngleAxis dataKey="name" tick={(props) => { const active = props.payload.value === hoveredBlock; const dx = props.x - props.cx; const dy = props.y - props.cy; const distance = Math.hypot(dx, dy) || 1; const radius = Number(props.radius) || distance * 0.78; const endX = props.cx + dx * radius / distance; const endY = props.cy + dy * radius / distance; return <g>{active && <line className="dashboard-radar-spoke-active" x1={props.cx} y1={props.cy} x2={endX} y2={endY} />}<text x={props.x} y={props.y} className={active ? 'dashboard-radar-axis-active' : 'dashboard-radar-axis'} textAnchor={props.textAnchor} dominantBaseline="central">{props.payload.value}</text></g>; }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Tooltip formatter={(value, name) => [value == null ? 'Не применимо' : `${value}%`, name]} /><Legend /><Radar name="B2C" dataKey="b2c" stroke="var(--g-color-text-secondary)" fill="var(--g-color-base-generic-medium)" fillOpacity={0.08} strokeWidth={2} strokeDasharray="4 3" shape={<ApplicableRadarShape />} dot={<ApplicableRadarDot dotFill="var(--g-color-text-secondary)" dotRadius={2} />} />{unit && <Radar name={unit} dataKey="unit" stroke="var(--g-color-text-info-heavy)" fill="var(--g-color-base-info-heavy)" fillOpacity={0.18} strokeWidth={2} shape={<ApplicableRadarShape />} dot={<ApplicableRadarDot dotFill="var(--g-color-base-info-heavy)" dotRadius={2} />} />}</RadarChart></ResponsiveContainer></div></Card>
        <Card className="dashboard-antitop-card" view="outlined"><div className="dashboard-card-title"><div><h2>Ключевые западающие зоны</h2><span>Отклонения по метрикам всех команд</span></div><Label theme="danger">Антитоп</Label></div><div className="dashboard-antitop-list">{antiTop.map((item, index) => <div className="dashboard-antitop-row" key={`${item.block}-${item.name}`} onMouseEnter={() => setHoveredBlock(item.block)} onMouseLeave={() => setHoveredBlock('')}><span>{index + 1}</span><div><b>{item.name}</b><small className="dashboard-antitop-block" title={antiTopBlockLabel(item.block)}>{antiTopBlockLabel(item.block)}</small></div><div className="dashboard-antitop-result"><strong>{item.incompleteShare}%</strong><small>{item.incompleteTeams} из {item.teams} команд</small></div></div>)}</div></Card>
      </section>

      <Card
        className="dashboard-about-card"
        type="action"
        aria-label="О Data Driven: открыть методологию"
        onClick={onAbout}
      >
        <div className="dashboard-about-icon"><Icon data={CircleInfo} size={24} /></div>
        <div className="dashboard-about-copy">
          <Text variant="subheader-2">О Data Driven</Text>
          <Text variant="body-1" color="secondary">Формула индекса, критерии и баллы, правила применимости и шкала зрелости команд.</Text>
        </div>
        <span className="dashboard-about-action">Методология <Icon data={ChevronRight} size={14} /></span>
      </Card>
    </main>
  );
}
