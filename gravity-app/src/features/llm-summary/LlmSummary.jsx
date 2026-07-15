import React, {useEffect, useState} from 'react';
import {ChevronDown, ChevronRight} from '@gravity-ui/icons';
import {Alert, Button, Card, Disclosure, Icon, Label, Link, SegmentedRadioGroup, Text} from '@gravity-ui/uikit';
import {filterInapplicableMetricGroups} from '../../domain/report.js';
import {BUTTON_INTENT, SemanticButton} from '../../shared/ui/SemanticButton.jsx';
import {digestStatus, digestTheme, worstDigestLight} from './digestPresentation.js';

export {digestStatus, digestTheme, worstDigestLight} from './digestPresentation.js';

function displaySkillName(name) {
  return String(name || '').replace(/^Навык\s+[«"]Ключевые метрики[»"]$/i, 'Ключевые метрики');
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

export function ProductMetricRecommendations({product, onOpenReport}) {
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
        <SemanticButton intent={BUTTON_INTENT.primary} onClick={onOpenReport}>Перейти <Icon data={ChevronRight} size={14} /></SemanticButton>
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

export function recommendationBlockCode(product, requestedCode) {
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

export function ProductMetricBlocks({product, onOpenReport, focusBlock, focusSkill}) {
  const [detailMode, setDetailMode] = useState('compact');
  const [open, setOpen] = useState(() => new Set());
  const recommendations = product.metric_recommendations || [];
  const itemsByBlock = recommendations.reduce((result, item) => {
    const key = recommendationBlockCode(product, item.block_code || 'other');
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
    return result;
  }, new Map());
  const visibleBlocks = filterInapplicableMetricGroups(product.metrics || [], itemsByBlock.keys());
  const activeBlockCodes = visibleBlocks.filter((block) => itemsByBlock.has(block.code)).map((block) => block.code);
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
        <SemanticButton intent={BUTTON_INTENT.primary} onClick={onOpenReport}>Перейти <Icon data={ChevronRight} size={14} /></SemanticButton>
      </Card>

      <section className="metrics-section product-metrics-section">
        <div className="metrics-title"><h2>Ключевые блоки DD-рейтинга</h2><div className="detail-mode" role="group" aria-label="Вид продуктовых метрик"><Button selected={detailMode === 'detailed'} onClick={() => { setDetailMode('detailed'); setOpen(new Set(activeBlockCodes)); }}>Подробно</Button><Button selected={detailMode === 'compact'} onClick={() => { setDetailMode('compact'); setOpen(new Set()); }}>Компактно</Button></div></div>
        <div className="metrics-grid product-metrics-grid">
          {visibleBlocks.map((block) => {
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
