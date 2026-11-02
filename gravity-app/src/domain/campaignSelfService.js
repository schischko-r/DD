const LAUNCHES = 'attract.campaign_launches';
const SELF_SERVICE = 'attract.nalichie_self_service';

export function isCampaignSelfServiceConfirmation(metric, period) {
  const source = metric.source;
  const basis = source?.basis;
  return period === 'III кв. 2026' && metric.code === LAUNCHES
    && metric.is_applicabble_flg !== false && metric.max_value > 0 && metric.value === metric.max_value
    && source?.origin === 'userConfirmedCampaignLaunchesFromSelfService20261102'
    && source.confirmedBy === 'user' && source.period === period && source.previousAssessmentValue === 0
    && basis?.code === SELF_SERVICE && basis.maxValue > 0 && basis.value === basis.maxValue;
}

export function applyCampaignSelfService(products, period) {
  if (period !== 'III кв. 2026') return products;
  return products.map(product => {
    const self = product.metrics.flatMap(block => block.metrics).find(metric => metric.code === SELF_SERVICE);
    if (!self || self.is_applicabble_flg === false || !(self.max_value > 0) || self.value !== self.max_value) return product;
    let changed = false;
    const metrics = product.metrics.map(block => ({...block, metrics: block.metrics.map(metric => {
      if (metric.code !== LAUNCHES || metric.value !== 0 || metric.is_applicabble_flg === false || !(metric.max_value > 0)) return metric;
      changed = true;
      const value = metric.max_value;
      return {...metric, value, source: {origin: 'userConfirmedCampaignLaunchesFromSelfService20261102',
        confirmedBy: 'user', date: '2026-11-02', period, rawValue: 1,
        rule: 'Если запуски кампаний равны 0, а применимый Self-service = 100%, запуски за III квартал = 100%.',
        previousAssessmentValue: metric.value, previousAssessmentSource: metric.source || null,
        basis: {code: self.code, value: self.value, maxValue: self.max_value, source: self.source || null}},
        ...(metric.recommendation_items ? {recommendation_items: metric.recommendation_items.map(item => ({
          ...item, value, max_value: metric.max_value, gap: 0,
        }))} : {})};
    })}));
    return changed ? {...product, metrics} : product;
  });
}
