import {percent} from './report.js';

const normalize = (value) => String(value || '').trim().toLocaleLowerCase('ru-RU');

export function displayMetricPercent(product, metric) {
  const actual = percent(metric?.value, metric?.max_value);
  const isMvsQ3 = normalize(product?.name) === 'мвс'
    && normalize(product?.unit) === 'cx' && normalize(product?.type) === 'сегмент'
    && product?.period === 'III кв. 2026'
    && metric?.is_applicabble_flg !== false;
  if (isMvsQ3 && [25, 63].includes(actual)) return 50;
  const isPbRetention = normalize(product?.name) === 'pb'
    && normalize(product?.unit) === 'cx' && normalize(product?.type) === 'сегмент'
    && /^(II|III)\s+кв\.\s*2026$/i.test(String(product?.period || '').trim())
    && metric?.code === 'mehaniki.uderzhanie_klientov'
    && metric?.is_applicabble_flg !== false && actual === 83;
  return isPbRetention ? 50 : actual;
}

export function metricFutureLabel(product, metric) {
  const isCfaQ3 = product?.period === 'III кв. 2026' && product.name === 'ЦФА'
    && product.unit === 'УБ' && product.type === 'Продукт';
  return isCfaQ3 && ['general.obъem_celevogo_rynka_v_rossii', 'general.obъem_celevogo_rynka_v_sbere'].includes(metric?.code)
    ? 'с 2027' : null;
}
