import clickstreamData from 'virtual:clickstream-data';
import {
  getClickstreamCatalogFromData,
  getClickstreamReportFromData,
  resolveClickstreamFunnelId as resolveFunnelId,
} from './clickstreamDataCore.js';

export const CLICKSTREAM_DATA = clickstreamData;

export function getClickstreamCatalog() {
  return getClickstreamCatalogFromData(CLICKSTREAM_DATA);
}

export function resolveClickstreamFunnelId(funnelNameOrId) {
  return resolveFunnelId(CLICKSTREAM_DATA, funnelNameOrId);
}

export function getClickstreamReport(funnelNameOrId, periodValue) {
  return getClickstreamReportFromData(
    CLICKSTREAM_DATA,
    funnelNameOrId,
    periodValue,
  );
}
