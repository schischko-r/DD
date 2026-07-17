import React, {useEffect, useMemo, useRef, useState} from 'react';
import {shouldInvalidateReadyForInput} from '../../domain/constructorWorkflow.js';
import './constructor.css';

const TABS = [
  {id: 'team', label: 'Команда'},
  {id: 'layout', label: 'Метрики и layout'},
  {id: 'links', label: 'Ссылки'},
];

const LINK_SURFACES = [
  {value: 'report-action', label: 'Действие отчёта'},
  {value: 'metric-button', label: 'Кнопка метрики'},
  {value: 'tool', label: 'Инструмент'},
  {value: 'ai', label: 'AI-действие'},
  {value: 'feedback', label: 'Обратная связь'},
  {value: 'contact', label: 'Контакт'},
  {value: 'instruction', label: 'Инструкция'},
  {value: 'access', label: 'Запрос доступа'},
];

function array(value) {
  return Array.isArray(value) ? value : [];
}

function productId(product) {
  return String(product?.id || '');
}

function blocksFor(product) {
  return array(product?.metrics);
}

function metricsFor(block) {
  return array(block?.metrics);
}

function findMetric(product, code) {
  for (const block of blocksFor(product)) {
    const metric = metricsFor(block).find((item) => item?.code === code);
    if (metric) return {block, metric};
  }
  return null;
}

function call(handler, ...args) {
  if (typeof handler === 'function') handler(...args);
}

function parseNumber(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!normalized) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function numberText(value) {
  return value === null || value === undefined ? '' : String(value).replace('.', ',');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function initialScope(selectedProductId) {
  return {mode: 'current', productIds: selectedProductId ? [selectedProductId] : [], types: []};
}

function scopeSelection(scope, selectedProductId) {
  if (scope?.kind === 'all') return {mode: 'all', productIds: [], types: []};
  if (scope?.kind === 'types') return {mode: 'types', productIds: [], types: array(scope.values)};
  if (scope?.kind === 'teams') {
    const ids = array(scope.values);
    const current = ids.length === 1 && ids[0] === selectedProductId;
    return {mode: current ? 'current' : 'teams', productIds: ids, types: []};
  }
  const mode = scope?.mode || 'current';
  return {
    mode,
    productIds: mode === 'current'
      ? (selectedProductId ? [selectedProductId] : [])
      : mode === 'teams' ? array(scope?.productIds) : [],
    types: mode === 'types' ? array(scope?.types) : [],
  };
}

function scopePayload(scope, selectedProductId) {
  const selection = scopeSelection(scope, selectedProductId);
  if (selection.mode === 'types') return {kind: 'types', values: selection.types};
  if (selection.mode === 'all') return {kind: 'all', values: []};
  return {kind: 'teams', values: selection.productIds};
}

function productsInScope(products, scope, selectedProductId) {
  const normalized = scopePayload(scope, selectedProductId);
  if (normalized.kind === 'all') return products;
  if (normalized.kind === 'types') {
    const types = new Set(normalized.values);
    return products.filter((product) => types.has(product?.type));
  }
  const ids = new Set(normalized.values);
  return products.filter((product) => ids.has(productId(product)));
}

function changedProductCount(data, baseline) {
  if (!baseline || !Array.isArray(baseline.products)) return 0;
  const originals = new Map(baseline.products.map((product) => [productId(product), product]));
  let count = 0;
  array(data?.products).forEach((product) => {
    const original = originals.get(productId(product));
    if (!original || JSON.stringify(original) !== JSON.stringify(product)) count += 1;
  });
  return count;
}

function validationMessages(errors) {
  return array(errors).map((error, index) => {
    if (typeof error === 'string') return {key: `${error}-${index}`, text: error};
    return {
      key: String(error?.id || error?.code || index),
      text: String(error?.message || error?.text || error?.code || 'Ошибка валидации'),
    };
  });
}

function autosaveText(status) {
  if (!status) return 'Автосохранение включено';
  if (typeof status === 'string') return status;
  if (status.error) return String(status.error);
  if (status.message) return String(status.message);
  const labels = {
    idle: 'Автосохранение включено',
    saving: 'Сохраняем…',
    saved: 'Изменения сохранены',
    error: 'Не удалось сохранить черновик',
    unavailable: 'Автосохранение недоступно',
  };
  return labels[status.status] || 'Автосохранение включено';
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `link-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isSafeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function Impact({total, compatible = total}) {
  const skipped = Math.max(0, total - compatible);
  return (
    <div className="dd-constructor-impact" aria-live="polite">
      <span>Будет изменено: <b>{compatible}</b></span>
      <span>Пропущено: <b>{skipped}</b></span>
    </div>
  );
}

function Field({label, hint, children}) {
  return (
    <label className="dd-constructor-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ScopePicker({products, selectedProductId, value, onChange, compatible}) {
  const [query, setQuery] = useState('');
  const types = useMemo(() => unique(products.map((product) => product?.type)).sort(), [products]);
  const normalized = scopeSelection(value, selectedProductId);
  const scopedProducts = productsInScope(products, normalized, selectedProductId);
  const compatibleCount = compatible
    ? scopedProducts.filter((product) => compatible(product)).length
    : scopedProducts.length;
  const visibleProducts = products.filter((product) => {
    const haystack = `${product?.name || ''} ${product?.unit || ''} ${product?.tribe || ''}`.toLocaleLowerCase('ru');
    return haystack.includes(query.trim().toLocaleLowerCase('ru'));
  });

  const changeMode = (mode) => {
    const next = {...normalized, mode};
    if (mode === 'teams' && next.productIds.length === 0 && selectedProductId) {
      next.productIds = [selectedProductId];
    }
    if (mode === 'types' && next.types.length === 0) {
      const selected = products.find((product) => productId(product) === selectedProductId);
      if (selected?.type) next.types = [selected.type];
    }
    onChange(next);
  };

  const toggleTeam = (id) => {
    const ids = new Set(normalized.productIds);
    if (ids.has(id)) ids.delete(id); else ids.add(id);
    onChange({...normalized, productIds: [...ids]});
  };

  const toggleType = (type) => {
    const selectedTypes = new Set(normalized.types);
    if (selectedTypes.has(type)) selectedTypes.delete(type); else selectedTypes.add(type);
    onChange({...normalized, types: [...selectedTypes]});
  };

  return (
    <section className="dd-constructor-scope" aria-labelledby="dd-constructor-scope-title">
      <div className="dd-constructor-section-title">
        <h3 id="dd-constructor-scope-title">Область применения</h3>
        <span>{scopedProducts.length} команд</span>
      </div>
      <select aria-label="Область применения" value={normalized.mode} onChange={(event) => changeMode(event.target.value)}>
        <option value="current">Текущая команда</option>
        <option value="teams">Выбранные команды</option>
        <option value="types">Типы команд</option>
        <option value="all">Все команды</option>
      </select>
      {normalized.mode === 'teams' && (
        <div className="dd-constructor-scope-options">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти команду" aria-label="Найти команду для области применения" />
          <div className="dd-constructor-check-list">
            {visibleProducts.map((product) => {
              const id = productId(product);
              return (
                <label key={id}>
                  <input type="checkbox" checked={normalized.productIds.includes(id)} onChange={() => toggleTeam(id)} />
                  <span>{product.name}<small>{[product.unit, product.tribe].filter(Boolean).join(' · ')}</small></span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      {normalized.mode === 'types' && (
        <div className="dd-constructor-check-list dd-constructor-check-list-compact">
          {types.map((type) => (
            <label key={type}>
              <input type="checkbox" checked={normalized.types.includes(type)} onChange={() => toggleType(type)} />
              <span>{type}</span>
            </label>
          ))}
        </div>
      )}
      <Impact total={scopedProducts.length} compatible={compatibleCount} />
    </section>
  );
}

function TeamEditor({product, onAction}) {
  const [form, setForm] = useState({name: '', unit: '', tribe: ''});
  useEffect(() => {
    setForm({
      name: String(product?.name || ''),
      unit: String(product?.unit || ''),
      tribe: String(product?.tribe || ''),
    });
  }, [product]);

  if (!product) return <p className="dd-constructor-empty">Нет выбранной команды.</p>;
  const invalid = !form.name.trim() || !form.unit.trim();
  const unchanged = form.name === String(product.name || '')
    && form.unit === String(product.unit || '')
    && form.tribe === String(product.tribe || '');
  const update = (key, value) => setForm((current) => ({...current, [key]: value}));
  const save = (event) => {
    event.preventDefault();
    if (invalid || unchanged) return;
    onAction({
      type: 'team/update',
      productId: productId(product),
      patch: {name: form.name.trim(), unit: form.unit.trim(), tribe: form.tribe.trim()},
    });
  };

  return (
    <form className="dd-constructor-form" onSubmit={save}>
      <div className="dd-constructor-section-title">
        <h3>Реквизиты команды</h3>
        <code title={productId(product)}>{productId(product).slice(0, 10)}…</code>
      </div>
      <Field label="Название *">
        <input value={form.name} onChange={(event) => update('name', event.target.value)} required />
      </Field>
      <div className="dd-constructor-field-row">
        <Field label="Подразделение *">
          <input value={form.unit} onChange={(event) => update('unit', event.target.value)} required />
        </Field>
        <Field label="Трайб">
          <input value={form.tribe} onChange={(event) => update('tribe', event.target.value)} />
        </Field>
      </div>
      {invalid && <p className="dd-constructor-inline-error">Название и подразделение обязательны.</p>}
      <button className="dd-constructor-primary" type="submit" disabled={invalid || unchanged}>Применить</button>
    </form>
  );
}

function MetricEditor({product, metric, scope, scopedProducts, onAction}) {
  const [valueText, setValueText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [definition, setDefinition] = useState({name: '', footer: ''});

  useEffect(() => {
    setValueText(numberText(metric?.value));
    setMaxText(numberText(metric?.max_value));
    setDefinition({name: String(metric?.name || ''), footer: String(metric?.footer || '')});
  }, [metric]);

  if (!metric || !product) return <p className="dd-constructor-empty">Выберите метрику в layout ниже.</p>;
  const value = parseNumber(valueText);
  const max = parseNumber(maxText);
  const calculated = metric.is_applicabble_flg !== false
    && Number(metric.dd_calculation_flg ?? 1) !== 0
    && metric.excluded_from_index !== true;
  let numericError = '';
  if (value === null || max === null) numericError = 'Введите конечные числовые значения.';
  else if (value < 0 || max < 0) numericError = 'Значения не могут быть отрицательными.';
  else if (calculated && value > max) numericError = 'Для расчётной метрики факт не может превышать максимум.';
  const definitionInvalid = !definition.name.trim();
  const compatibleCount = scopedProducts.filter((item) => Boolean(findMetric(item, metric.code))).length;

  const saveValues = () => {
    if (numericError) return;
    onAction({
      type: 'metric/update-values',
      productId: productId(product),
      metricCode: metric.code,
      value,
      max_value: max,
      patch: {value, max_value: max},
    });
  };

  const saveDefinition = () => {
    if (definitionInvalid) return;
    onAction({
      type: 'metric/update-definition',
      metricCode: metric.code,
      patch: {name: definition.name.trim(), footer: definition.footer.trim()},
      scope,
    });
  };

  return (
    <section className="dd-constructor-metric-editor">
      <div className="dd-constructor-section-title">
        <h3>Выбранная метрика</h3>
        <code title={metric.code}>{metric.code}</code>
      </div>
      <div className="dd-constructor-field-row">
        <Field label="Факт">
          <input inputMode="decimal" value={valueText} onChange={(event) => setValueText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveValues(); } }} />
        </Field>
        <Field label="Максимум">
          <input inputMode="decimal" value={maxText} onChange={(event) => setMaxText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveValues(); } }} />
        </Field>
      </div>
      {numericError && <p className="dd-constructor-inline-error">{numericError}</p>}
      <button type="button" onClick={saveValues} disabled={Boolean(numericError)}>Применить значения к текущей команде</button>
      <hr />
      <Field label="Название">
        <input value={definition.name} onChange={(event) => setDefinition((current) => ({...current, name: event.target.value}))} />
      </Field>
      <Field label="Пояснение">
        <textarea rows="3" value={definition.footer} onChange={(event) => setDefinition((current) => ({...current, footer: event.target.value}))} />
      </Field>
      <Impact total={scopedProducts.length} compatible={compatibleCount} />
      <button className="dd-constructor-primary" type="button" onClick={saveDefinition} disabled={definitionInvalid || compatibleCount === 0}>Применить текст по области</button>
    </section>
  );
}

function MoveButtons({index, length, onMove}) {
  return (
    <span className="dd-constructor-move-buttons">
      <button type="button" aria-label="Переместить выше" title="Выше" disabled={index <= 0} onClick={() => onMove(index - 1)}>↑</button>
      <button type="button" aria-label="Переместить ниже" title="Ниже" disabled={index >= length - 1} onClick={() => onMove(index + 1)}>↓</button>
    </span>
  );
}

function BlockCard({
  block,
  index,
  blocks,
  product,
  scopedProducts,
  selectedMetricCode,
  scope,
  dragPayload,
  setDragPayload,
  onSelectMetric,
  onAction,
}) {
  const [name, setName] = useState(String(block?.name || ''));
  useEffect(() => setName(String(block?.name || '')), [block]);
  const metrics = metricsFor(block);
  const compatibleProducts = scopedProducts.filter((item) => blocksFor(item).some((candidate) => candidate.code === block.code));
  const emptyProducts = compatibleProducts.filter((item) => metricsFor(blocksFor(item).find((candidate) => candidate.code === block.code)).length === 0);
  const dispatchBlockMove = (sourceBlockCode, fromIndex, toIndex) => {
    if (toIndex === fromIndex || toIndex < 0 || toIndex >= blocks.length) return;
    const targetBlock = blocks[toIndex];
    if (!targetBlock || targetBlock.code === sourceBlockCode) return;
    onAction({
      type: 'block/reorder',
      productId: productId(product),
      blockCode: sourceBlockCode,
      targetBlockCode: targetBlock.code,
      position: toIndex < fromIndex ? 'before' : 'after',
      fromIndex,
      toIndex,
      scope,
    });
  };
  const moveBlock = (toIndex) => dispatchBlockMove(block.code, index, toIndex);
  const moveMetric = (metric, metricIndex, targetBlock, toIndex) => {
    onAction({
      type: 'metric/move',
      productId: productId(product),
      metricCode: metric.code,
      sourceBlockCode: block.code,
      targetBlockCode: targetBlock.code,
      targetIndex: toIndex,
      fromBlockCode: block.code,
      toBlockCode: targetBlock.code,
      fromIndex: metricIndex,
      toIndex,
      scope,
    });
  };
  const acceptMetricDrop = (event, toIndex = metrics.length) => {
    if (dragPayload?.kind !== 'metric') return;
    event.preventDefault();
    event.stopPropagation();
    onAction({
      type: 'metric/move',
      productId: productId(product),
      metricCode: dragPayload.metricCode,
      sourceBlockCode: dragPayload.blockCode,
      targetBlockCode: block.code,
      targetIndex: toIndex,
      fromBlockCode: dragPayload.blockCode,
      toBlockCode: block.code,
      fromIndex: dragPayload.index,
      toIndex,
      scope,
    });
    setDragPayload(null);
  };

  return (
    <article
      className="dd-constructor-block"
      data-selected={metrics.some((metric) => metric.code === selectedMetricCode) || undefined}
      onDragOver={(event) => { if (dragPayload?.kind === 'block') event.preventDefault(); }}
      onDrop={(event) => {
        if (dragPayload?.kind !== 'block') return;
        event.preventDefault();
        dispatchBlockMove(dragPayload.blockCode, dragPayload.index, index);
        setDragPayload(null);
      }}
    >
      <div className="dd-constructor-block-head" draggable onDragStart={(event) => {
        const payload = {kind: 'block', blockCode: block.code, index};
        setDragPayload(payload);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify(payload));
      }} onDragEnd={() => setDragPayload(null)}>
        <span className="dd-constructor-drag" aria-hidden="true">⋮⋮</span>
        <div><strong>{block.name || block.code}</strong><code>{block.code}</code></div>
        <span className="dd-constructor-block-order">
          <MoveButtons index={index} length={blocks.length} onMove={moveBlock} />
          <select aria-label={`Позиция блока ${block.name || block.code}`} value={index} onChange={(event) => moveBlock(Number(event.target.value))}>
            {blocks.map((item, position) => <option value={position} key={item.code || position}>#{position + 1}</option>)}
          </select>
        </span>
      </div>
      <div className="dd-constructor-block-actions">
        <input aria-label={`Название блока ${block.name || block.code}`} value={name} onChange={(event) => setName(event.target.value)} />
        <button type="button" disabled={!name.trim() || name.trim() === String(block.name || '')} onClick={() => onAction({type: 'block/rename', blockCode: block.code, name: name.trim(), scope})}>Переименовать</button>
        <button className="dd-constructor-danger" type="button" disabled={emptyProducts.length === 0} title={emptyProducts.length === 0 ? 'В выбранной области нет пустых копий блока' : `Удалить пустой блок у ${emptyProducts.length} команд`} onClick={() => onAction({type: 'block/delete', blockCode: block.code, scope})}>Удалить</button>
      </div>
      <div className="dd-constructor-block-impact">Блок найден: {compatibleProducts.length} из {scopedProducts.length} · пустой: {emptyProducts.length}</div>
      <div className="dd-constructor-metric-list" onDragOver={(event) => { if (dragPayload?.kind === 'metric') event.preventDefault(); }} onDrop={acceptMetricDrop}>
        {metrics.length === 0 && <p className="dd-constructor-drop-zone">Пустой блок · перетащите метрику сюда</p>}
        {metrics.map((metric, metricIndex) => (
          <div
            className="dd-constructor-metric-row"
            data-selected={metric.code === selectedMetricCode || undefined}
            draggable
            key={metric.code || metricIndex}
            onClick={() => onSelectMetric(metric.code)}
            onDragStart={(event) => {
              event.stopPropagation();
              const payload = {kind: 'metric', metricCode: metric.code, blockCode: block.code, index: metricIndex};
              setDragPayload(payload);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', JSON.stringify(payload));
            }}
            onDragOver={(event) => { if (dragPayload?.kind === 'metric') { event.preventDefault(); event.stopPropagation(); } }}
            onDrop={(event) => acceptMetricDrop(event, metricIndex)}
            onDragEnd={() => setDragPayload(null)}
          >
            <button className="dd-constructor-metric-select" type="button" onClick={(event) => { event.stopPropagation(); onSelectMetric(metric.code); }}>
              <span>{metric.name || metric.code}</span>
              <small>{numberText(metric.value)} / {numberText(metric.max_value)}</small>
            </button>
            <MoveButtons index={metricIndex} length={metrics.length} onMove={(toIndex) => moveMetric(metric, metricIndex, block, toIndex)} />
            <select aria-label={`Перенести метрику ${metric.name || metric.code} в блок`} value={block.code} onClick={(event) => event.stopPropagation()} onChange={(event) => {
              event.stopPropagation();
              const target = blocks.find((item) => item.code === event.target.value);
              if (target) moveMetric(metric, metricIndex, target, metricsFor(target).length);
            }}>
              {blocks.map((item) => <option value={item.code} key={item.code}>{item.name || item.code}</option>)}
            </select>
          </div>
        ))}
      </div>
    </article>
  );
}

function LayoutEditor({product, scope, scopedProducts, selectedMetricCode, onSelectMetric, onAction}) {
  const [newBlockName, setNewBlockName] = useState('');
  const [dragPayload, setDragPayload] = useState(null);
  const blocks = blocksFor(product);
  if (!product) return <p className="dd-constructor-empty">Нет выбранной команды.</p>;
  return (
    <section className="dd-constructor-layout">
      <form className="dd-constructor-add-block" onSubmit={(event) => {
        event.preventDefault();
        if (!newBlockName.trim()) return;
        onAction({type: 'block/add', name: newBlockName.trim(), scope});
        setNewBlockName('');
      }}>
        <input value={newBlockName} onChange={(event) => setNewBlockName(event.target.value)} placeholder="Название нового блока" aria-label="Название нового блока" />
        <button type="submit" disabled={!newBlockName.trim()}>Добавить блок</button>
      </form>
      <p className="dd-constructor-hint">Перетаскивайте блоки и метрики. Кнопки ↑/↓ и список блока выполняют те же действия с клавиатуры.</p>
      <div className="dd-constructor-block-list">
        {blocks.map((block, index) => (
          <BlockCard
            block={block}
            blocks={blocks}
            index={index}
            key={block.code || index}
            product={product}
            scopedProducts={scopedProducts}
            selectedMetricCode={selectedMetricCode}
            scope={scope}
            dragPayload={dragPayload}
            setDragPayload={setDragPayload}
            onSelectMetric={onSelectMetric}
            onAction={onAction}
          />
        ))}
      </div>
    </section>
  );
}

function linkPlacementLabel(rule) {
  const placement = rule?.placement;
  if (placement && typeof placement === 'object') {
    return String(placement.slot || placement.key || placement.metricCode || placement.blockCode || '');
  }
  return String(placement || rule?.target || '');
}

function linkSurface(rule) {
  if (LINK_SURFACES.some((surface) => surface.value === rule?.surface)) return rule.surface;
  if (rule?.placement?.kind === 'report') return 'metric-button';
  const key = String(rule?.placement?.key || '').toLowerCase();
  if (key.includes('contact')) return 'contact';
  if (key.includes('error') || key.includes('idea') || key.includes('feedback')) return 'feedback';
  if (key.includes('access')) return 'access';
  if (key.includes('course') || key.includes('demo') || key.includes('instruction')) return 'instruction';
  return 'report-action';
}

function reportLinkCompatible(product, rule) {
  const placement = rule?.placement;
  if (placement?.kind !== 'report') return true;
  const block = blocksFor(product).find((item) => item.code === placement.blockCode);
  if (!block) return false;
  const root = placement.metricCode
    ? metricsFor(block).find((metric) => metric.code === placement.metricCode)
    : block;
  if (!root) return false;
  const target = array(placement.path).reduce((current, segment) => current?.[segment], root);
  if (!target || typeof target !== 'object') return false;
  return placement.urlField
    ? Object.hasOwn(target, placement.urlField)
    : Object.hasOwn(target, 'url') || Object.hasOwn(target, 'link');
}

function LinkEditor({rules, scope, scopedProducts, products, onAction}) {
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({id: '', surface: LINK_SURFACES[0].value, placement: '', placementObject: null, label: '', url: ''});
  const selectedRule = rules.find((rule) => String(rule?.id || '') === selectedId);

  const loadRule = (rule) => setForm({
    id: String(rule?.id || ''),
    surface: linkSurface(rule),
    placement: linkPlacementLabel(rule),
    placementObject: rule?.placement && typeof rule.placement === 'object' ? rule.placement : null,
    label: String(rule?.label || ''),
    url: String(rule?.url || rule?.href || ''),
  });
  const cloneRule = () => {
    if (!selectedRule) return;
    setSelectedId('');
    setForm({
      id: '',
      surface: linkSurface(selectedRule),
      placement: linkPlacementLabel(selectedRule),
      placementObject: selectedRule.placement,
      label: String(selectedRule.label || ''),
      url: String(selectedRule.url || ''),
    });
  };
  const placement = selectedRule?.placement || form.placementObject;
  const globalOnly = placement?.kind === 'ui' && placement.key === 'dashboard.team-contact';
  const effectiveScope = globalOnly ? {kind: 'all', values: []} : scope;
  const impactedProducts = globalOnly ? products : scopedProducts;
  const compatibleCount = impactedProducts.filter((product) => reportLinkCompatible(product, {placement})).length;
  const placementLocked = Boolean(selectedRule || form.placementObject);
  const urlValid = isSafeUrl(form.url);
  const canTarget = Boolean(placement && form.label.trim());
  const save = (event) => {
    event.preventDefault();
    if (!canTarget || !urlValid) return;
    const rule = {
      ...(selectedRule || {}),
      id: form.id || makeId(),
      placement,
      label: form.label.trim(),
      url: form.url.trim(),
      effect: 'upsert',
      scope: effectiveScope,
    };
    onAction({type: 'link/upsert', rule, scope: effectiveScope});
    setSelectedId(rule.id);
    setForm((current) => ({...current, id: rule.id}));
  };
  const hide = () => {
    if (!canTarget) return;
    const rule = {
      ...(selectedRule || {}),
      id: form.id || makeId(),
      placement,
      label: form.label.trim(),
      url: form.url.trim(),
      effect: 'hide',
      scope: effectiveScope,
    };
    onAction({type: 'link/hide', ruleId: rule.id, rule, scope: effectiveScope});
  };

  return (
    <section className="dd-constructor-links">
      <div className="dd-constructor-section-title">
        <h3>Структурированные ссылки</h3>
        <button type="button" disabled={!selectedRule} onClick={cloneRule}>Другой scope</button>
      </div>
      {rules.length > 0 && (
        <Field label="Ссылка из отчёта или интерфейса">
          <select value={selectedId} onChange={(event) => {
            const id = event.target.value;
            setSelectedId(id);
            const rule = rules.find((item) => String(item?.id || '') === id);
            if (rule) loadRule(rule);
            else setForm({id: '', surface: LINK_SURFACES[0].value, placement: '', placementObject: null, label: '', url: ''});
          }}>
            <option value="">Выберите ссылку</option>
            {rules.map((rule, index) => (
              <option value={String(rule?.id || '')} key={String(rule?.id || index)}>
                {rule?.label || linkPlacementLabel(rule) || `Правило ${index + 1}`}{rule?.origin === 'baseline' ? ' · каталог' : ' · правило'}{rule?.effect === 'hide' ? ' · скрыто' : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
      <form className="dd-constructor-form" onSubmit={save}>
        <Field label="Поверхность">
          <select value={form.surface} disabled={placementLocked} onChange={(event) => setForm((current) => ({...current, surface: event.target.value}))}>
            {LINK_SURFACES.map((surface) => <option value={surface.value} key={surface.value}>{surface.label}</option>)}
          </select>
        </Field>
        <Field label="Позиция / код" hint={placementLocked ? `Позиция сохраняется.${globalOnly ? ' Это общее действие, поэтому scope — все команды.' : ''}` : 'Выберите ссылку из каталога выше'}>
          <input value={form.placement} disabled readOnly />
        </Field>
        <Field label="Подпись">
          <input value={form.label} onChange={(event) => setForm((current) => ({...current, label: event.target.value}))} />
        </Field>
        <Field label="URL" hint="Разрешены http, https и mailto">
          <input type="url" value={form.url} onChange={(event) => setForm((current) => ({...current, url: event.target.value}))} placeholder="https://…" />
        </Field>
        {form.url && !urlValid && <p className="dd-constructor-inline-error">Используйте только http, https или mailto.</p>}
        <Impact total={impactedProducts.length} compatible={compatibleCount} />
        <div className="dd-constructor-action-row">
          <button className="dd-constructor-primary" type="submit" disabled={!canTarget || !urlValid || compatibleCount === 0}>Сохранить ссылку</button>
          <button className="dd-constructor-danger" type="button" disabled={!canTarget || compatibleCount === 0} onClick={hide}>{selectedRule ? 'Скрыть правило' : 'Скрыть по области'}</button>
        </div>
      </form>
    </section>
  );
}

export function ConstructorPanel({
  data,
  baseline,
  selectedProductId,
  onSelectProductId,
  onAction,
  dirty = false,
  ready = false,
  onReadyChange,
  validationErrors = [],
  autosaveStatus,
  onImportFile,
  onExport,
  onSend,
  onFallbackSend,
  onReset,
  onCollapsedChange,
}) {
  const products = array(data?.products);
  const selectedProduct = products.find((product) => productId(product) === selectedProductId) || products[0] || null;
  const actualSelectedId = productId(selectedProduct);
  const [tab, setTab] = useState('team');
  const [collapsed, setCollapsed] = useState(false);
  const [scopeState, setScopeState] = useState(() => initialScope(actualSelectedId));
  const [selectedMetricCode, setSelectedMetricCode] = useState('');
  const importRef = useRef(null);
  const errors = validationMessages(validationErrors);
  const valid = errors.length === 0;
  const changedTeams = useMemo(() => changedProductCount(data, baseline), [data, baseline]);

  useEffect(() => {
    setScopeState((current) => current.mode === 'current'
      ? {...current, productIds: actualSelectedId ? [actualSelectedId] : []}
      : current);
  }, [actualSelectedId]);

  const firstMetricCode = blocksFor(selectedProduct).flatMap(metricsFor)[0]?.code || '';
  const selectedMetric = findMetric(selectedProduct, selectedMetricCode)?.metric
    || findMetric(selectedProduct, firstMetricCode)?.metric
    || null;
  useEffect(() => {
    if (selectedMetric?.code && selectedMetric.code !== selectedMetricCode) setSelectedMetricCode(selectedMetric.code);
  }, [selectedMetric?.code, selectedMetricCode]);

  const scope = scopePayload(scopeState, actualSelectedId);
  const scopedProducts = productsInScope(products, scope, actualSelectedId);
  const currentCompatible = tab === 'layout' && selectedMetric
    ? (product) => Boolean(findMetric(product, selectedMetric.code))
    : undefined;
  const rules = array(data?.constructor?.linkRules);
  const dispatch = (action) => {
    if (ready) call(onReadyChange, false);
    call(onAction, action);
  };
  const selectProduct = (id) => call(onSelectProductId, id);
  const reset = () => {
    const confirmed = typeof globalThis.confirm !== 'function'
      || globalThis.confirm('Сбросить все изменения и вернуть исходные данные?');
    if (confirmed) {
      if (ready) call(onReadyChange, false);
      call(onReset);
    }
  };
  const changeCollapsed = (value) => {
    setCollapsed(value);
    call(onCollapsedChange, value);
  };

  if (collapsed) {
    return (
      <aside className="dd-constructor dd-constructor-collapsed" aria-label="HTML-конструктор">
        <button type="button" onClick={() => changeCollapsed(false)} aria-label="Открыть конструктор" title="Открыть конструктор">✎</button>
        {dirty && <span aria-label="Есть несохранённые изменения" />}
      </aside>
    );
  }

  return (
    <aside className="dd-constructor" aria-label="HTML-конструктор" onInputCapture={(event) => {
      if (ready && shouldInvalidateReadyForInput(event.target)) call(onReadyChange, false);
    }}>
      <header className="dd-constructor-header">
        <div>
          <span className="dd-constructor-kicker">Standalone</span>
          <h2>Конструктор отчёта</h2>
        </div>
        <button className="dd-constructor-collapse" type="button" onClick={() => changeCollapsed(true)} aria-label="Свернуть конструктор" title="Свернуть">→</button>
      </header>

      <div className="dd-constructor-toolbar">
        <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            if (ready) call(onReadyChange, false);
            call(onImportFile, file);
          }
          event.target.value = '';
        }} />
        <button type="button" onClick={() => importRef.current?.click()}>Импорт</button>
        <button type="button" onClick={() => call(onExport)}>Экспорт JSON</button>
        <button className="dd-constructor-danger" type="button" onClick={reset}>Сброс</button>
      </div>

      <div className={`dd-constructor-autosave dd-constructor-autosave-${autosaveStatus?.status || 'idle'}`} role="status">
        <span />{autosaveText(autosaveStatus)}
      </div>

      <div className="dd-constructor-team-select">
        <Field label="Команда в preview">
          <select value={actualSelectedId} onChange={(event) => selectProduct(event.target.value)}>
            {products.map((product) => (
              <option value={productId(product)} key={productId(product)}>{product.name} · {product.unit}</option>
            ))}
          </select>
        </Field>
      </div>

      <nav className="dd-constructor-tabs" aria-label="Разделы конструктора">
        {TABS.map((item) => (
          <button type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id || undefined} onClick={() => setTab(item.id)} key={item.id}>{item.label}</button>
        ))}
      </nav>

      <div className="dd-constructor-scroll">
        {tab !== 'team' && (
          <ScopePicker
            products={products}
            selectedProductId={actualSelectedId}
            value={scopeState}
            onChange={setScopeState}
            compatible={currentCompatible}
          />
        )}
        {tab === 'team' && <TeamEditor product={selectedProduct} onAction={dispatch} />}
        {tab === 'layout' && (
          <>
            <MetricEditor product={selectedProduct} metric={selectedMetric} scope={scope} scopedProducts={scopedProducts} onAction={dispatch} />
            <LayoutEditor product={selectedProduct} scope={scope} scopedProducts={scopedProducts} selectedMetricCode={selectedMetric?.code || ''} onSelectMetric={setSelectedMetricCode} onAction={dispatch} />
          </>
        )}
        {tab === 'links' && <LinkEditor rules={rules} scope={scope} scopedProducts={scopedProducts} products={products} onAction={dispatch} />}
      </div>

      <footer className="dd-constructor-footer">
        {errors.length > 0 && (
          <details className="dd-constructor-errors" open>
            <summary>Ошибки валидации: {errors.length}</summary>
            <ul>{errors.map((error) => <li key={error.key}>{error.text}</li>)}</ul>
          </details>
        )}
        <div className="dd-constructor-change-status">
          <span>{dirty ? 'Есть изменения' : 'Изменений нет'}</span>
          {changedTeams > 0 && <span>Команд: {changedTeams}</span>}
        </div>
        <label className="dd-constructor-ready" data-constructor-ready-control>
          <input type="checkbox" checked={Boolean(ready)} disabled={!dirty || !valid} onChange={(event) => call(onReadyChange, event.target.checked)} />
          <span><b>Готово</b><small>Данные проверены и готовы к отправке</small></span>
        </label>
        <button className="dd-constructor-send" type="button" disabled={!dirty || !valid || !ready} onClick={() => call(onSend)}>Отправить</button>
        <button type="button" disabled={!dirty || !valid || !ready} onClick={() => call(onFallbackSend)}>Скачать JSON и открыть письмо без вложения</button>
        <p>Скачается черновик .eml с JSON-вложением. Откройте его в Outlook, проверьте и нажмите «Отправить».</p>
      </footer>
    </aside>
  );
}

export default ConstructorPanel;
