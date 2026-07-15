import React, {useMemo, useState} from 'react';
import {ArrowDown} from '@gravity-ui/icons';
import {Button, Icon, Label, Progress, SegmentedRadioGroup, Select} from '@gravity-ui/uikit';
import {CatalogDialog, compareNames, groupFor, isUnitFilterOption, scoreFor, typeTone} from '../features/catalog/Catalog.jsx';

export function SummaryPage({products, rows, initialType = ''}) {
  const [unit, setUnit] = useState([]);
  const [type, setType] = useState(initialType ? [initialType] : []);
  const [sort, setSort] = useState('name');
  const units = useMemo(() => [...new Set(products.map((item) => item.unit).filter((item) => item && isUnitFilterOption(item)))].sort(compareNames), [products]);
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
