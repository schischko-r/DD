import React, {useEffect, useRef} from 'react';
import {ChevronRight} from '@gravity-ui/icons';
import {HelpMark, Icon, Label} from '@gravity-ui/uikit';
import afterPurchase from '../data/crosssell-after-purchase-q3-2026.json';
import {crossSellAfterPurchaseResponses, crossSellAfterPurchaseStatus} from '../domain/crossSellDecomposition.js';
import {inapplicableMetricLabel, percent} from '../domain/report.js';
import {HELP_POPOVER_PROPS} from '../features/catalog/Catalog.jsx';

export function CrossSellDecomposition({product, metric, highlighted, children, analytics, growthBadge}) {
  const disclosure = useRef(null);
  useEffect(() => { if (highlighted && disclosure.current) disclosure.current.open = true; }, [highlighted]);
  const responses = crossSellAfterPurchaseResponses(product, afterPurchase);
  const components = metric.crossSellComponents;
  const afterStatus = components?.after?.applicable === false
    ? {label: 'Не применимо', theme: 'normal'}
    : components?.after
    ? {label: `${percent(components.after.rawValue, 1)}%`, theme: components.after.rawValue >= 1 ? 'success' : components.after.rawValue > 0 ? 'warning' : 'danger'}
    : crossSellAfterPurchaseStatus(responses);
  const duringMetric = components?.during
    ? {...metric, value: components.during.value, source: components.during.source}
    : metric;
  const duringMax = Number(duringMetric.max_value) > 0 ? duringMetric.max_value / 2 : duringMetric.max_value;
  const duringDisplayValue = Number.isFinite(duringMetric.value) ? Math.min(duringMetric.value, duringMax) : duringMetric.value;
  const applicable = metric.is_applicabble_flg !== false;
  const known = Number.isFinite(metric.value) && Number(metric.max_value) > 0;
  const label = !applicable ? inapplicableMetricLabel(metric) : known ? `${percent(metric.value, metric.max_value)}%` : '—';
  const theme = !applicable || !known ? 'normal'
    : metric.value >= metric.max_value ? 'success' : metric.value > 0 ? 'warning' : 'danger';

  return <details className="cross-sell-decomposition" ref={disclosure}>
    <summary className="cross-sell-decomposition-summary">
      <Icon data={ChevronRight} size={14} />
      <i className={`metric-light metric-light-${theme === 'normal' ? 'default' : theme}`} aria-hidden="true" />
      <b>Cross-sell</b>
      <div className="metric-value-group">{growthBadge}<Label className={theme === 'normal' ? 'metric-status-label metric-status-label-text' : 'metric-status-label'} size="xs" theme={theme}>{label}</Label></div>
    </summary>
    <div className="cross-sell-decomposition-content">
      {React.cloneElement(children, {metric: {...duringMetric, value: duringDisplayValue, max_value: duringMax, name: 'Cross-sell во время оформления', footer: 'Предложение другого продукта банка в процессе оформления вашего продукта.'}, nested: true, grouped: false, hideAnalytics: true, ...(components ? {maxIndexPoints: 0} : {})})}
      <div className="metric-row metric-row-status metric-row-nested cross-sell-after-purchase">
        <div className="metric-copy">
          <i className={`metric-light metric-light-${['success', 'warning', 'danger'].includes(afterStatus.theme) ? afterStatus.theme : 'default'}`} aria-hidden="true" />
          <div><div className="metric-name-line"><b>Cross-sell после оформления</b></div><span>Предложение другого продукта банка как дополнения к уже оформленному продукту.</span></div>
        </div>
        <div className="metric-value"><div className="metric-status-with-confirmation">
          <span className="mechanics-metric-help"><HelpMark aria-label="Критерии оценки: Cross-sell после оформления" popoverProps={HELP_POPOVER_PROPS}>
            <div className="goals-help-content mechanics-metric-help-content">
              <p>Клиенту, уже оформившему ваш продукт, предлагается другой продукт банка как дополнение к нему в рамках настроенной механики кросс-продаж.</p>
              <p>Данные собираются из опроса команды.</p>
            </div>
          </HelpMark></span>
          <div className="metric-value-group"><Label className={afterStatus.theme === 'normal' ? 'metric-status-label metric-status-label-text' : 'metric-status-label'} size="xs" theme={afterStatus.theme}>{afterStatus.label}</Label></div>
        </div></div>
      </div>
      {analytics && <div className="cross-sell-decomposition-analytics">{analytics}</div>}
    </div>
  </details>;
}
