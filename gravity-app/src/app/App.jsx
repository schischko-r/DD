import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {BarsAscendingAlignLeft, ChartColumn, ChartMixed, CircleInfo} from '@gravity-ui/icons';
import {Icon, Spin} from '@gravity-ui/uikit';
import {AsideHeader} from '@gravity-ui/navigation';
import {AboutPage} from '../pages/AboutPage.jsx';
import {DashboardPage} from '../pages/DashboardPage.jsx';
import {SummaryPage} from '../pages/SummaryPage.jsx';
import {TeamProfilePage} from '../pages/TeamProfilePage.jsx';
import {ConstructorPanel} from '../features/constructor/ConstructorPanel.jsx';
import {CATALOG_STATIC_LINK_DEFINITIONS} from '../features/catalog/keyMetricLinks.js';
import {
  addBlock,
  applyMetricDefinition,
  changedProductCount,
  deleteEmptyBlock,
  deriveTitle,
  ensureConstructorDocument,
  moveMetric,
  parseReportJson,
  renameBlock,
  reorderBlock,
  scopeProductIds,
  serializeReport,
  updateMetricValues,
  updateTeam,
  validateReport,
} from '../domain/reportEditor.js';
import {createReportEml} from '../domain/emailDraft.js';
import {assertWorkflowReady, workflowState} from '../domain/constructorWorkflow.js';
import {
  extractReportLinkCatalog,
  materializeReportLinks,
  normalizeLinkScope,
  staticLinkCatalog,
  upsertLinkRule,
} from '../domain/linkRules.js';
import {
  clearConstructorDraft,
  draftStorageKey,
  loadConstructorDraft,
  saveConstructorDraft,
} from '../domain/constructorStorage.js';
import ocb2cLogo from '../assets/ocb2c.png';

const RECIPIENT = 'rgshishko@sberbank.ru';
const CONSTRUCTOR_MODE = typeof document !== 'undefined'
  && document.querySelector('meta[name="dd-app-mode"]')?.content === 'constructor';

function canonicalReport(report) {
  const ensured = ensureConstructorDocument(report);
  return {...ensured, title: deriveTitle(ensured)};
}

function preferredProduct(products = []) {
  return products.find((item) => /^вклады$/i.test(String(item.name || '').trim()))
    || products.find((item) => /^вклады\s*\+\s*нс$/i.test(String(item.name || '').trim()))
    || products[0]
    || null;
}

function comparableReport(report) {
  if (!report) return null;
  const constructor = {...(report.constructor || {})};
  delete constructor.savedAt;
  return {...report, constructor};
}

function reportsDiffer(baseline, current) {
  if (!baseline || !current) return false;
  if (baseline === current) return false;
  return JSON.stringify(comparableReport(baseline)) !== JSON.stringify(comparableReport(current));
}

function catalogRule(definition) {
  return {
    id: `catalog-${definition.key}`,
    origin: 'baseline',
    effect: 'upsert',
    placement: {kind: 'ui', key: definition.key, slot: definition.key},
    scope: {kind: 'all', values: []},
    label: definition.label,
    url: definition.url,
  };
}

function mergeLinkCatalog(baselineRules, overrides) {
  const merged = new Map();
  baselineRules.forEach((rule) => merged.set(rule.id, rule));
  overrides.forEach((rule) => merged.set(rule.id, rule));
  return [...merged.values()];
}

function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], {type: mimeType});
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function findMetric(product, metricCode) {
  for (const block of product?.metrics || []) {
    const metric = (block.metrics || []).find((item) => item.code === metricCode);
    if (metric) return {block, metric};
  }
  return null;
}

function reportLinkTarget(product, placement) {
  const block = (product?.metrics || []).find((item) => item.code === placement?.blockCode);
  if (!block) return null;
  const root = placement.metricCode
    ? (block.metrics || []).find((metric) => metric.code === placement.metricCode)
    : block;
  if (!root) return null;
  const target = (placement.path || []).reduce((current, segment) => current?.[segment], root);
  if (!target || typeof target !== 'object') return null;
  const urlField = placement.urlField
    ? (Object.hasOwn(target, placement.urlField) ? placement.urlField : '')
    : (Object.hasOwn(target, 'url') ? 'url' : Object.hasOwn(target, 'link') ? 'link' : '');
  return urlField ? target : null;
}

function actionCompatibility(report, action, currentProductId) {
  if (!action.scope) return {total: 1, compatible: 1};
  const scope = normalizeLinkScope(action.scope, currentProductId);
  const selected = new Set(scopeProductIds(report, scope).map(String));
  const products = (report.products || []).filter((product) => selected.has(String(product.id)));
  const compatible = products.filter((product) => {
    if (action.type === 'metric/update-definition') return Boolean(findMetric(product, action.metricCode));
    if (action.type === 'block/add') return Array.isArray(product.metrics);
    if (action.type === 'block/rename') return (product.metrics || []).some((block) => block.code === action.blockCode);
    if (action.type === 'block/delete') {
      const block = (product.metrics || []).find((item) => item.code === action.blockCode);
      return Boolean(block && (block.metrics || []).length === 0);
    }
    if (action.type === 'block/reorder') {
      const codes = new Set((product.metrics || []).map((block) => block.code));
      return codes.has(action.blockCode) && codes.has(action.targetBlockCode);
    }
    if (action.type === 'metric/move') {
      const source = (product.metrics || []).find((block) => block.code === action.sourceBlockCode);
      const target = (product.metrics || []).find((block) => block.code === action.targetBlockCode);
      return Boolean(source && target && (source.metrics || []).some((metric) => metric.code === action.metricCode));
    }
    if (action.type === 'link/upsert' || action.type === 'link/hide') {
      const placement = action.rule?.placement;
      if (placement?.kind !== 'report') return true;
      return Boolean(reportLinkTarget(product, placement));
    }
    return true;
  }).length;
  return {total: products.length, compatible};
}

function changedTeamIds(baseline, current) {
  const result = new Set();
  const baselineProducts = new Map((baseline?.products || []).map((product) => [String(product.id), product]));
  (current?.products || []).forEach((product) => {
    const before = baselineProducts.get(String(product.id));
    if (!before || JSON.stringify(before) !== JSON.stringify(product)) result.add(String(product.id));
  });

  const beforeRules = new Map((baseline?.constructor?.linkRules || []).map((rule) => [rule.id, rule]));
  const afterRules = new Map((current?.constructor?.linkRules || []).map((rule) => [rule.id, rule]));
  const ruleIds = new Set([...beforeRules.keys(), ...afterRules.keys()]);
  ruleIds.forEach((id) => {
    const before = beforeRules.get(id);
    const after = afterRules.get(id);
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    const rule = after || before;
    const scoped = new Set(scopeProductIds(current, normalizeLinkScope(rule?.scope)).map(String));
    (current?.products || []).forEach((product) => {
      if (!scoped.has(String(product.id))) return;
      if (rule?.placement?.kind === 'report' && !reportLinkTarget(product, rule.placement)) return;
      result.add(String(product.id));
    });
  });
  return result;
}

function prepareReport(report) {
  const timestamped = {
    ...report,
    title: deriveTitle(report),
    constructor: {...report.constructor, savedAt: new Date().toISOString()},
  };
  return materializeReportLinks(timestamped, timestamped.constructor?.linkRules || []);
}

function confirmBulkAction(impact) {
  if (impact.total <= 1) return true;
  const incompatible = Math.max(0, impact.total - impact.compatible);
  return typeof globalThis.confirm !== 'function' || globalThis.confirm(
    `Будет изменено команд: ${impact.compatible}. Несовместимых команд: ${incompatible}. Продолжить?`,
  );
}

export function App() {
  const [baseline, setBaseline] = useState(null);
  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [detailScore, setDetailScore] = useState(false);
  const [summaryFilters, setSummaryFilters] = useState({period: '', unit: ''});
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageKey, setStorageKey] = useState('');
  const [autosaveAvailable, setAutosaveAvailable] = useState(true);
  const [autosaveStatus, setAutosaveStatus] = useState({status: 'idle'});
  const [loadError, setLoadError] = useState('');
  const [constructorCollapsed, setConstructorCollapsed] = useState(false);

  const updateSummaryFilters = useCallback((patch) => {
    setSummaryFilters((current) => ({...current, ...patch}));
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('./report-data.json', {cache: 'no-store'});
        if (response.ok === false) throw new Error(`Не удалось загрузить report-data.json (${response.status}).`);
        const source = canonicalReport(await response.json());
        let current = source;
        const key = draftStorageKey(source);
        if (CONSTRUCTOR_MODE) {
          try {
            const draft = await loadConstructorDraft(key);
            if (draft) {
              const candidate = canonicalReport(draft);
              const errors = validateReport(candidate);
              if (!errors.length) current = candidate;
              else setAutosaveStatus({status: 'error', error: 'Сохранённый черновик повреждён и не был загружен.'});
            }
          } catch (error) {
            setAutosaveAvailable(false);
            setAutosaveStatus({status: 'unavailable', error: `Автосохранение недоступно: ${error.message}`});
          }
        }
        if (!active) return;
        setBaseline(source);
        setData(current);
        // The pointer remains scoped to the embedded source even when the
        // restored/imported document has its own constructor.documentId.
        setStorageKey(key);
        setDirty(reportsDiffer(source, current));
        setSelectedProductId(String(preferredProduct(current.products)?.id || ''));
      } catch (error) {
        if (active) setLoadError(error.message || String(error));
      }
    };
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!CONSTRUCTOR_MODE || !data || !storageKey || !autosaveAvailable) return undefined;
    if (!dirty) {
      clearConstructorDraft(storageKey)
        .then(() => setAutosaveStatus({status: 'idle'}))
        .catch((error) => {
          setAutosaveAvailable(false);
          setAutosaveStatus({status: 'unavailable', error: `Автосохранение недоступно: ${error.message}`});
        });
      return undefined;
    }
    setAutosaveStatus({status: 'saving'});
    const timer = setTimeout(() => {
      saveConstructorDraft(storageKey, data)
        .then(() => setAutosaveStatus({status: 'saved', message: 'Изменения сохранены в браузере'}))
        .catch((error) => {
          setAutosaveAvailable(false);
          setAutosaveStatus({status: 'unavailable', error: `Автосохранение недоступно: ${error.message}`});
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [autosaveAvailable, data, dirty, storageKey]);

  useEffect(() => {
    if (!data?.products?.length) return;
    if (!(data.products || []).some((product) => String(product.id) === selectedProductId)) {
      setSelectedProductId(String(data.products[0].id));
    }
  }, [data, selectedProductId]);

  const linkRules = data?.constructor?.linkRules || [];
  const effectiveData = useMemo(
    () => data ? materializeReportLinks(data, linkRules) : null,
    [data, linkRules],
  );
  const panelData = useMemo(() => {
    if (!data) return null;
    const baselineRules = [
      ...staticLinkCatalog(),
      ...CATALOG_STATIC_LINK_DEFINITIONS.map(catalogRule),
      ...extractReportLinkCatalog(data, selectedProductId ? [selectedProductId] : null),
    ];
    return {
      ...data,
      constructor: {
        ...data.constructor,
        linkRules: mergeLinkCatalog(baselineRules, linkRules),
      },
    };
  }, [data, linkRules, selectedProductId]);
  const validationErrors = useMemo(() => data ? validateReport(data) : [], [data]);

  if (loadError) return <main className="content"><h1>Не удалось открыть отчёт</h1><p>{loadError}</p></main>;
  if (!data || !effectiveData) return <div className="loading"><Spin size="xl" /></div>;

  const commit = (next) => {
    if (next === data) return;
    setData(next);
    setDirty(reportsDiffer(baseline, next));
    setReady(false);
  };

  const handleAction = (action) => {
    try {
      const impact = actionCompatibility(data, action, selectedProductId);
      let next = data;
      if (action.type === 'team/update') next = updateTeam(data, action.productId, action.patch);
      else if (action.type === 'metric/update-values') {
        next = updateMetricValues(data, action.productId, action.metricCode, action.patch || {
          value: action.value,
          max_value: action.max_value,
        });
      } else if (action.type === 'metric/update-definition') {
        next = applyMetricDefinition(data, action.metricCode, action.patch, normalizeLinkScope(action.scope, selectedProductId));
      } else if (action.type === 'block/add') {
        next = addBlock(data, {name: action.name, scope: normalizeLinkScope(action.scope, selectedProductId)});
      } else if (action.type === 'block/rename') {
        next = renameBlock(data, {...action, scope: normalizeLinkScope(action.scope, selectedProductId)});
      } else if (action.type === 'block/delete') {
        next = deleteEmptyBlock(data, {...action, scope: normalizeLinkScope(action.scope, selectedProductId)});
      } else if (action.type === 'block/reorder') {
        next = reorderBlock(data, {...action, scope: normalizeLinkScope(action.scope, selectedProductId)});
      } else if (action.type === 'metric/move') {
        next = moveMetric(data, {...action, scope: normalizeLinkScope(action.scope, selectedProductId)});
      } else if (action.type === 'link/upsert' || action.type === 'link/hide') {
        const rules = upsertLinkRule(linkRules, {
          ...action.rule,
          effect: action.type === 'link/hide' ? 'hide' : 'upsert',
          scope: normalizeLinkScope(action.scope || action.rule?.scope, selectedProductId),
        }, selectedProductId);
        next = {
          ...data,
          constructor: {...data.constructor, linkRules: rules, savedAt: new Date().toISOString()},
        };
      }
      if (next === data) return;
      if (!confirmBulkAction(impact)) return;
      commit(next);
    } catch (error) {
      globalThis.alert?.(error.message || String(error));
    }
  };

  const handleImport = async (file) => {
    try {
      const imported = parseReportJson(await file.text());
      if (autosaveAvailable) {
        try {
          const sourceKey = storageKey || draftStorageKey(baseline);
          await saveConstructorDraft(sourceKey, imported);
          setAutosaveStatus({status: 'saved', message: 'Импортированный документ сохранён в браузере'});
        } catch (error) {
          setAutosaveAvailable(false);
          setAutosaveStatus({status: 'unavailable', error: `Автосохранение недоступно: ${error.message}`});
        }
      }
      setData(imported);
      setDirty(reportsDiffer(baseline, imported));
      setReady(false);
      setSelectedProductId(String(preferredProduct(imported.products)?.id || ''));
    } catch (error) {
      const detail = error.validationErrors?.map((item) => item.message).join('\n');
      globalThis.alert?.(`${error.message}${detail ? `\n\n${detail}` : ''}`);
    }
  };

  const handleExport = () => {
    try {
      downloadText(serializeReport(prepareReport(data)), 'report-data.json', 'application/json;charset=utf-8');
    } catch (error) {
      globalThis.alert?.(error.message || String(error));
    }
  };

  const validatedSendReport = () => {
    const prepared = prepareReport(data);
    return assertWorkflowReady(workflowState(prepared, {dirty, ready}));
  };

  const handleSend = () => {
    try {
      const prepared = validatedSendReport();
      const draft = createReportEml(prepared, {
        baselineReport: baseline,
        changedProductCount: changedTeamIds(baseline, prepared).size,
      });
      downloadText(draft.content, draft.filename, draft.mimeType);
      globalThis.alert?.('Черновик скачан. Откройте файл .eml в Outlook, проверьте адрес, текст и вложение, затем вручную нажмите «Отправить».');
    } catch (error) {
      setReady(false);
      globalThis.alert?.(error.message || String(error));
    }
  };

  const handleFallbackSend = () => {
    try {
      const prepared = validatedSendReport();
      const json = serializeReport(prepared);
      const draft = createReportEml(prepared, {
        baselineReport: baseline,
        changedProductCount: changedTeamIds(baseline, prepared).size,
      });
      downloadText(json, 'report-data.json', 'application/json;charset=utf-8');
      globalThis.alert?.('Файл report-data.json скачан отдельно. Сейчас откроется письмо без вложения — прикрепите скачанный файл вручную.');
      window.location.href = `mailto:${RECIPIENT}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    } catch (error) {
      setReady(false);
      globalThis.alert?.(error.message || String(error));
    }
  };

  const handleReset = () => {
    if (!baseline) return;
    clearConstructorDraft(storageKey).catch((error) => {
      setAutosaveAvailable(false);
      setAutosaveStatus({status: 'unavailable', error: `Не удалось удалить черновик: ${error.message}`});
    });
    setData(baseline);
    setStorageKey(draftStorageKey(baseline));
    setDirty(false);
    setReady(false);
    setSelectedProductId(String(preferredProduct(baseline.products)?.id || ''));
    if (autosaveAvailable) setAutosaveStatus({status: 'idle'});
  };

  const rows = effectiveData.title?.rows || [];
  const defaultProduct = preferredProduct(effectiveData.products);
  const product = effectiveData.products.find((item) => String(item.id) === selectedProductId) || defaultProduct;
  const openProduct = (item) => {
    setSelectedProductId(String(item.id));
    setView('detail');
    window.scrollTo(0, 0);
  };
  const selectProduct = (value) => {
    const id = typeof value === 'object' ? value?.id : value;
    setSelectedProductId(String(id || ''));
  };
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
      title: 'Профиль команды',
      tooltipText: 'Профиль команды',
      icon: BarsAscendingAlignLeft,
      current: view === 'detail',
      onItemClick: () => setView('detail'),
    },
    ...(detailScore ? [{
      id: 'summary',
      title: 'Сводная таблица',
      tooltipText: 'Сводная таблица',
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
    ? <SummaryPage products={effectiveData.products} rows={rows} />
    : view === 'dashboard'
      ? <DashboardPage products={effectiveData.products} rows={rows} summaryFilters={summaryFilters} onSummaryFiltersChange={updateSummaryFilters} onOpen={openProduct} onAbout={() => { setView('about'); window.scrollTo(0, 0); }} linkRules={linkRules} />
      : view === 'about'
        ? <AboutPage onBack={() => { setView('dashboard'); window.scrollTo(0, 0); }} />
        : <TeamProfilePage product={product} products={effectiveData.products} rows={rows} detailScore={detailScore} onBack={() => setView('dashboard')} onProduct={selectProduct} linkRules={linkRules} />;

  return (
    <>
      <div className={CONSTRUCTOR_MODE ? `dd-constructor-preview${constructorCollapsed ? ' dd-constructor-preview-collapsed' : ''}` : undefined}>
        <AsideHeader
          compact
          className="dd-navigation"
          logo={{text: 'Data-Driven Index', iconSrc: ocb2cLogo, iconSize: 30, iconClassName: 'dd-navigation-logo', href: '#', onClick: (event) => { event.preventDefault(); setView('dashboard'); window.scrollTo(0, 0); }, 'aria-label': 'Открыть Summary'}}
          menuItems={menuItems}
          hideCollapseButton
          renderFooter={() => <button type="button" className="navigation-period" aria-pressed={detailScore} title={detailScore ? 'Скрыть служебный режим' : 'Показать служебный режим'} onClick={toggleDetailScore}><Icon data={CircleInfo} size={16} /></button>}
          renderContent={() => content}
        />
      </div>
      {CONSTRUCTOR_MODE && panelData && (
        <ConstructorPanel
          data={panelData}
          baseline={baseline}
          selectedProductId={selectedProductId}
          onSelectProductId={(id) => { setSelectedProductId(String(id)); setView('detail'); }}
          onAction={handleAction}
          dirty={dirty}
          ready={ready}
          onReadyChange={setReady}
          validationErrors={validationErrors}
          autosaveStatus={autosaveStatus}
          onImportFile={handleImport}
          onExport={handleExport}
          onSend={handleSend}
          onFallbackSend={handleFallbackSend}
          onReset={handleReset}
          onCollapsedChange={setConstructorCollapsed}
        />
      )}
    </>
  );
}
