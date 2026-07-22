import {filterCampaigningLinks, filterDraftLinks, filterMetricRelevantLinks, teamHelpAudience} from '../../domain/report.js';
import {contextualBlockLinksForTeam, isKeyMetricLinkVisibleForTeam, isLegacyProductKeyMetricLink, isProductSatelliteLink, keyMetricLinksForTeam, reportMetricBindingForLink} from './keyMetricLinks.js';

export function collectBlockLinks(block) {
  const links = [];
  const add = (item, fallbackLabel) => {
    const url = item?.url || item?.link || item?.button?.link;
    const label = item?.label || item?.button?.label || fallbackLabel;
    if (url && label) links.push({
      label,
      url,
      ...(item?.notice ? {notice: item.notice} : {}),
      ...(item?.requiresAnyMetric ? {requiresAnyMetric: true} : {}),
      ...(item?.metricCodes?.length ? {metricCodes: item.metricCodes} : {}),
      ...(item?.metricNames?.length ? {metricNames: item.metricNames} : {}),
    });
  };

  (block.actions || []).forEach((item) => add(item));
  (block.metrics || []).forEach((metric) => {
    add(metric.button && {...metric.button, metricCodes: [metric.code]}, metric.name);
    (metric.buttons || []).forEach((item) => add({...item, metricCodes: [metric.code]}, metric.name));
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
  const boundLinks = relocatedLinks.map((item) => ({...item, ...reportMetricBindingForLink(block, item)}));
  const uniqueLinks = filterMetricRelevantLinks(block, filterDraftLinks(block, filterCampaigningLinks(block, boundLinks)))
    .filter((item) => !isKeyMetricsBlock || isKeyMetricLinkVisibleForTeam(productDescriptor, item))
    .filter((item) => !/библиотек[ау] решений/i.test(item.label))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label && candidate.url === item.url) === index);
  return block.code === 'cx'
    ? uniqueLinks.filter((item) => /^(?:(?:открыть )?(?:cx|ux) score|cjxplorer|losshunter)$/i.test(item.label))
    : uniqueLinks;
}
