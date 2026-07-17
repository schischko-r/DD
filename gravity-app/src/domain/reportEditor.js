import {isSafeLinkPath, isValidLinkPlacement, isValidLinkScope} from './linkRules.js';

const CONSTRUCTOR_FORMAT = 'data-driven-constructor';
const CONSTRUCTOR_VERSION = 1;
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const METRIC_DEFINITION_FIELDS = new Set([
  'name',
  'footer',
  'button',
  'buttons',
  'zero_button',
  'links',
  'actions',
]);

const SHA256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rotateRight(value, shift) {
  return (value >>> shift) | (value << (32 - shift));
}

function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const sigma0 = rotateRight(words[index - 15], 7)
        ^ rotateRight(words[index - 15], 18)
        ^ (words[index - 15] >>> 3);
      const sigma1 = rotateRight(words[index - 2], 17)
        ^ rotateRight(words[index - 2], 19)
        ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((value) => value.toString(16).padStart(8, '0')).join('');
}

function sourceFingerprint(report) {
  const source = {...report};
  delete source.constructor;
  return `sha256:${sha256Hex(JSON.stringify(source))}`;
}

function documentIdForFingerprint(fingerprint) {
  const hex = String(fingerprint).replace(/^sha256:/, '').padEnd(32, '0');
  const variant = ((Number.parseInt(hex[16], 16) || 0) & 0x3) | 0x8;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant.toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function validIsoDate(value) {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

export function ensureConstructorDocument(report) {
  if (!isObject(report)) throw new TypeError('Отчёт должен быть JSON-объектом.');
  const current = isObject(report.constructor) ? report.constructor : {};
  const fingerprint = typeof current.sourceFingerprint === 'string' && current.sourceFingerprint.trim()
    ? current.sourceFingerprint
    : sourceFingerprint(report);
  const next = {
    ...current,
    format: CONSTRUCTOR_FORMAT,
    version: CONSTRUCTOR_VERSION,
    documentId: typeof current.documentId === 'string' && current.documentId.trim()
      ? current.documentId
      : documentIdForFingerprint(fingerprint),
    sourceFingerprint: fingerprint,
    savedAt: validIsoDate(current.savedAt) ? current.savedAt : new Date().toISOString(),
    linkRules: Array.isArray(current.linkRules) ? current.linkRules : [],
  };
  const unchanged = isObject(report.constructor)
    && Object.keys(next).every((key) => next[key] === report.constructor[key])
    && Object.keys(report.constructor).every((key) => Object.hasOwn(next, key));
  return unchanged ? report : {...report, constructor: next};
}

function numberValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  const normalized = value.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

function editableNumber(value, fieldLabel) {
  const parsed = numberValue(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RangeError(`${fieldLabel} должно быть конечным неотрицательным числом.`);
  }
  return parsed;
}

function isIndexMetric(metric) {
  return metric?.is_applicabble_flg !== false
    && metric?.excluded_from_index !== true
    && Number(metric?.dd_calculation_flg ?? 1) !== 0;
}

function roundHalfEven(value) {
  if (!Number.isFinite(value)) return 0;
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (Math.abs(fraction - 0.5) <= 1e-12) return lower % 2 === 0 ? lower : lower + 1;
  return Math.round(value);
}

function productScore(product) {
  let value = 0;
  let maximum = 0;
  (product?.metrics || []).forEach((block) => {
    (block?.metrics || []).forEach((metric) => {
      if (!isIndexMetric(metric)) return;
      const metricValue = numberValue(metric.value);
      const metricMaximum = numberValue(metric.max_value);
      if (!Number.isFinite(metricMaximum) || metricMaximum <= 0) return;
      if (Number.isFinite(metricValue)) value += metricValue;
      maximum += metricMaximum;
    });
  });
  if (!(maximum > 0)) return 0;
  return Math.max(0, Math.min(100, roundHalfEven((value / maximum) * 100)));
}

function groupForScore(score) {
  if (score <= 39) return 'Требуют внимания';
  if (score <= 60) return 'Развивающиеся';
  if (score <= 80) return 'Зрелые';
  return 'Лидеры';
}

function titleType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'продукт' || normalized === 'product') return 'продукт';
  if (normalized === 'сегмент' || normalized === 'segment') return 'Сегмент';
  if (normalized === 'канал' || normalized === 'channel') return 'Канал';
  return String(type || '').trim();
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'ru-RU');
}

export function deriveTitle(report) {
  const currentTitle = isObject(report?.title) ? report.title : {};
  const currentRows = Array.isArray(currentTitle.rows) ? currentTitle.rows : [];
  const rowsByProductId = new Map();
  const legacyRows = new Map();
  currentRows.forEach((row) => {
    if (!isObject(row)) return;
    if (row.product_id !== undefined && row.product_id !== null) {
      rowsByProductId.set(String(row.product_id), row);
    }
    const key = `${String(row.name || '')}\u0000${String(row.unit || '')}`;
    if (!legacyRows.has(key)) legacyRows.set(key, []);
    legacyRows.get(key).push(row);
  });
  const usedRows = new Set();
  const products = Array.isArray(report?.products) ? report.products : [];
  const rows = products.map((product, index) => {
    const productId = String(product?.id ?? '');
    let current = rowsByProductId.get(productId);
    if (current && usedRows.has(current)) current = undefined;
    if (!current) {
      const legacyKey = `${String(product?.name || '')}\u0000${String(product?.unit || '')}`;
      current = (legacyRows.get(legacyKey) || []).find((candidate) => !usedRows.has(candidate));
    }
    if (current) usedRows.add(current);
    const score = productScore(product);
    return {
      ...(current || {}),
      id: current?.id || `upload-title-${index + 1}`,
      product_id: product?.id,
      order: index,
      unit: product?.unit || '',
      name: product?.name || '',
      score,
      group: groupForScore(score),
      type: titleType(product?.type),
    };
  });
  const units = [...new Set(rows.map((row) => row.unit).filter(Boolean))].sort(compareText);
  const types = [...new Set(rows.map((row) => row.type).filter(Boolean))].sort(compareText);
  const avgScore = rows.length
    ? roundHalfEven(rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length)
    : 0;
  return {...currentTitle, rows, units, types, avgScore};
}

function validationError(path, code, message) {
  return {path, code, message};
}

function isAllowedUrl(value) {
  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateStructuredLinks(value, path, errors) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateStructuredLinks(item, `${path}[${index}]`, errors));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const itemPath = path ? `${path}.${key}` : key;
    if ((key === 'url' || key === 'link') && item !== null && item !== undefined && item !== '') {
      const text = typeof item === 'string' ? item.trim() : '';
      if (!text || (!text.startsWith('#') && !isAllowedUrl(text))) {
        errors.push(validationError(itemPath, 'unsafe_url', 'Разрешены только внутренние #-якоря, http, https и mailto ссылки.'));
      }
    }
    validateStructuredLinks(item, itemPath, errors);
  }
}

export function validateReport(report) {
  const errors = [];
  if (!isObject(report)) {
    return [validationError('', 'invalid_report', 'Отчёт должен быть JSON-объектом.')];
  }
  if (!Array.isArray(report.products)) {
    return [validationError('products', 'invalid_products', 'Поле products должно быть массивом.')];
  }

  const productIds = new Set();
  report.products.forEach((product, productIndex) => {
    const productPath = `products[${productIndex}]`;
    if (!isObject(product)) {
      errors.push(validationError(productPath, 'invalid_product', 'Команда должна быть объектом.'));
      return;
    }
    const productId = String(product.id ?? '').trim();
    if (!productId) errors.push(validationError(`${productPath}.id`, 'required', 'У команды отсутствует стабильный id.'));
    else if (productIds.has(productId)) errors.push(validationError(`${productPath}.id`, 'duplicate', `Повторяющийся id команды: ${productId}.`));
    else productIds.add(productId);
    if (!String(product.name ?? '').trim()) errors.push(validationError(`${productPath}.name`, 'required', 'Название команды обязательно.'));
    if (!String(product.unit ?? '').trim()) errors.push(validationError(`${productPath}.unit`, 'required', 'Юнит команды обязателен.'));
    if (!Array.isArray(product.metrics)) {
      errors.push(validationError(`${productPath}.metrics`, 'invalid_blocks', 'Поле metrics команды должно быть массивом блоков.'));
      return;
    }

    const blockCodes = new Set();
    const metricCodes = new Set();
    product.metrics.forEach((block, blockIndex) => {
      const blockPath = `${productPath}.metrics[${blockIndex}]`;
      if (!isObject(block)) {
        errors.push(validationError(blockPath, 'invalid_block', 'Блок должен быть объектом.'));
        return;
      }
      const blockCode = String(block.code ?? '').trim();
      if (!blockCode) errors.push(validationError(`${blockPath}.code`, 'required', 'У блока отсутствует код.'));
      else if (blockCodes.has(blockCode)) errors.push(validationError(`${blockPath}.code`, 'duplicate', `Код блока ${blockCode} повторяется у команды.`));
      else blockCodes.add(blockCode);
      if (!String(block.name ?? '').trim()) errors.push(validationError(`${blockPath}.name`, 'required', 'Название блока обязательно.'));
      if (!Array.isArray(block.metrics)) {
        errors.push(validationError(`${blockPath}.metrics`, 'invalid_metrics', 'Поле metrics блока должно быть массивом.'));
        return;
      }
      block.metrics.forEach((metric, metricIndex) => {
        const metricPath = `${blockPath}.metrics[${metricIndex}]`;
        if (!isObject(metric)) {
          errors.push(validationError(metricPath, 'invalid_metric', 'Метрика должна быть объектом.'));
          return;
        }
        const metricCode = String(metric.code ?? '').trim();
        if (!metricCode) errors.push(validationError(`${metricPath}.code`, 'required', 'У метрики отсутствует код.'));
        else if (metricCodes.has(metricCode)) errors.push(validationError(`${metricPath}.code`, 'duplicate', `Код метрики ${metricCode} повторяется у команды.`));
        else metricCodes.add(metricCode);
        if (!String(metric.name ?? '').trim()) errors.push(validationError(`${metricPath}.name`, 'required', 'Название метрики обязательно.'));
        const value = numberValue(metric.value);
        const maximum = numberValue(metric.max_value);
        if (!Number.isFinite(value) || value < 0) {
          errors.push(validationError(`${metricPath}.value`, 'invalid_number', 'Фактический балл должен быть конечным неотрицательным числом.'));
        }
        if (!Number.isFinite(maximum) || maximum < 0) {
          errors.push(validationError(`${metricPath}.max_value`, 'invalid_number', 'Максимальный балл должен быть конечным неотрицательным числом.'));
        }
        if (isIndexMetric(metric) && Number.isFinite(value) && Number.isFinite(maximum) && value > maximum) {
          errors.push(validationError(`${metricPath}.value`, 'above_maximum', 'Фактический балл не может превышать максимальный.'));
        }
      });
    });
    validateStructuredLinks(product, productPath, errors);
  });

  if (Object.hasOwn(report, 'constructor')) {
    if (!isObject(report.constructor)) {
      errors.push(validationError('constructor', 'invalid_constructor', 'Metadata конструктора должна быть объектом.'));
    } else {
      if (report.constructor.format !== CONSTRUCTOR_FORMAT) {
        errors.push(validationError('constructor.format', 'unsupported_format', 'Неподдерживаемый формат конструктора.'));
      }
      if (report.constructor.version !== CONSTRUCTOR_VERSION) {
        errors.push(validationError('constructor.version', 'unsupported_version', 'Неподдерживаемая версия конструктора.'));
      }
      if (report.constructor.linkRules !== undefined && !Array.isArray(report.constructor.linkRules)) {
        errors.push(validationError('constructor.linkRules', 'invalid_link_rules', 'linkRules должен быть массивом.'));
      } else {
        (report.constructor.linkRules || []).forEach((rule, index) => {
          if (!isObject(rule)) {
            errors.push(validationError(`constructor.linkRules[${index}]`, 'invalid_link_rule', 'Правило ссылки должно быть объектом.'));
            return;
          }
          const operation = rule.effect || rule.operation || rule.op || 'upsert';
          if (!['upsert', 'hide'].includes(operation)) {
            errors.push(validationError(`constructor.linkRules[${index}].effect`, 'invalid_link_effect', 'Разрешены только upsert и hide для ссылок.'));
          }
          if (!isValidLinkScope(rule.scope)) {
            errors.push(validationError(`constructor.linkRules[${index}].scope`, 'invalid_link_scope', 'Некорректная область действия ссылки.'));
          }
          if (!isValidLinkPlacement(rule.placement)) {
            errors.push(validationError(`constructor.linkRules[${index}].placement`, 'invalid_link_placement', 'Некорректная позиция ссылки.'));
          } else if (rule.placement.kind === 'report' && !isSafeLinkPath(rule.placement.path || [])) {
            errors.push(validationError(`constructor.linkRules[${index}].placement.path`, 'unsafe_link_path', 'Некорректный путь ссылки.'));
          }
          if (operation !== 'hide' && (!String(rule.url || '').trim() || !isAllowedUrl(rule.url))) {
            errors.push(validationError(`constructor.linkRules[${index}].url`, 'unsafe_url', 'Разрешены только http, https и mailto ссылки.'));
          } else if (String(rule.url || '').trim() && !isAllowedUrl(rule.url)) {
            errors.push(validationError(`constructor.linkRules[${index}].url`, 'unsafe_url', 'Разрешены только http, https и mailto ссылки.'));
          }
        });
      }
    }
  }
  return errors;
}

function throwValidation(errors) {
  const error = new Error(`Отчёт не прошёл валидацию: ${errors.map((item) => item.message).join(' ')}`);
  error.name = 'ReportValidationError';
  error.validationErrors = errors;
  throw error;
}

function touchChangedReport(report, products, shouldDeriveTitle) {
  const ensured = ensureConstructorDocument(report);
  let next = {
    ...ensured,
    products,
    constructor: {...ensured.constructor, savedAt: new Date().toISOString()},
  };
  if (shouldDeriveTitle) {
    const seededTitle = deriveTitle(report);
    next = {...next, title: deriveTitle({...next, title: seededTitle})};
  }
  return next;
}

function normalizeScope(scope) {
  if (!isObject(scope)) throw new TypeError('Не указан scope операции.');
  if (!['teams', 'types', 'all'].includes(scope.kind)) throw new RangeError(`Неподдерживаемый scope: ${scope.kind}.`);
  if (scope.values !== undefined && !Array.isArray(scope.values)) throw new TypeError('scope.values должен быть массивом.');
  return {kind: scope.kind, values: scope.values || []};
}

export function scopeProductIds(report, scope) {
  const normalized = normalizeScope(scope);
  const products = Array.isArray(report?.products) ? report.products : [];
  if (normalized.kind === 'all') return products.map((product) => product.id);
  if (normalized.kind === 'teams') {
    const ids = new Set(normalized.values.map(String));
    return products.filter((product) => ids.has(String(product.id))).map((product) => product.id);
  }
  const types = new Set(normalized.values.map((value) => String(value).trim().toLowerCase()));
  return products
    .filter((product) => types.has(String(product.type || '').trim().toLowerCase()))
    .map((product) => product.id);
}

function selectedProductIds(report, scope) {
  return new Set(scopeProductIds(report, scope).map(String));
}

function updateScopedProducts(report, scope, updater, shouldDeriveTitle = false) {
  const selected = selectedProductIds(report, scope);
  if (!selected.size) return report;
  let changed = false;
  const products = report.products.map((product) => {
    if (!selected.has(String(product.id))) return product;
    const next = updater(product);
    if (next !== product) changed = true;
    return next;
  });
  return changed ? touchChangedReport(report, products, shouldDeriveTitle) : report;
}

function normalizedText(value, label, allowEmpty = false) {
  if (typeof value !== 'string') throw new TypeError(`${label} должно быть строкой.`);
  const text = value.trim();
  if (!allowEmpty && !text) throw new RangeError(`${label} не может быть пустым.`);
  return text;
}

export function updateTeam(report, productId, patch) {
  if (!isObject(patch)) throw new TypeError('Изменения команды должны быть объектом.');
  const allowed = new Set(['name', 'unit', 'tribe']);
  const unsupported = Object.keys(patch).filter((key) => !allowed.has(key));
  if (unsupported.length) throw new RangeError(`Нельзя изменять поля команды: ${unsupported.join(', ')}.`);
  const index = (report.products || []).findIndex((product) => String(product.id) === String(productId));
  if (index < 0 || !Object.keys(patch).length) return report;
  const current = report.products[index];
  const normalizedPatch = {};
  if (Object.hasOwn(patch, 'name')) normalizedPatch.name = normalizedText(patch.name, 'Название команды');
  if (Object.hasOwn(patch, 'unit')) normalizedPatch.unit = normalizedText(patch.unit, 'Юнит');
  if (Object.hasOwn(patch, 'tribe')) normalizedPatch.tribe = patch.tribe == null ? '' : normalizedText(patch.tribe, 'Трайб', true);
  if (Object.keys(normalizedPatch).every((key) => normalizedPatch[key] === current[key])) return report;
  const products = [...report.products];
  products[index] = {...current, ...normalizedPatch};
  return touchChangedReport(report, products, true);
}

function metricTrafficLight(metric, value, maximum) {
  if (metric.is_applicabble_flg === false || !(maximum > 0)) return 'gray';
  if (value <= 0) return 'red';
  if (Math.abs(value - maximum) < 1e-9) return 'green';
  return 'yellow';
}

function rounded(value) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(12));
}

function updateRecommendationItems(items, value, maximum) {
  if (!Array.isArray(items) || !items.length) return items;
  const oldMaximums = items.map((item) => {
    const itemMaximum = numberValue(item?.max_value);
    return Number.isFinite(itemMaximum) && itemMaximum > 0 ? itemMaximum : 0;
  });
  const oldTotal = oldMaximums.reduce((sum, item) => sum + item, 0);
  const completion = maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0;
  let changed = false;
  const next = items.map((item, index) => {
    const weight = oldTotal > 0 ? oldMaximums[index] / oldTotal : 1 / items.length;
    const itemMaximum = rounded(maximum * weight);
    const itemValue = rounded(itemMaximum * completion);
    const gap = rounded(Math.max(0, itemMaximum - itemValue));
    if (item.max_value === itemMaximum && item.value === itemValue && item.gap === gap) return item;
    changed = true;
    return {...item, max_value: itemMaximum, value: itemValue, gap};
  });
  return changed ? next : items;
}

export function updateMetricValues(report, productId, metricCode, values) {
  if (!isObject(values)) throw new TypeError('Значения метрики должны быть объектом.');
  const allowed = new Set(['value', 'max_value']);
  const unsupported = Object.keys(values).filter((key) => !allowed.has(key));
  if (unsupported.length) throw new RangeError(`Нельзя изменять поля метрики: ${unsupported.join(', ')}.`);
  const productIndex = (report.products || []).findIndex((product) => String(product.id) === String(productId));
  if (productIndex < 0) return report;
  const product = report.products[productIndex];
  const blockIndex = (product.metrics || []).findIndex((block) => (block.metrics || []).some((metric) => metric.code === metricCode));
  if (blockIndex < 0) return report;
  const block = product.metrics[blockIndex];
  const metricIndex = block.metrics.findIndex((metric) => metric.code === metricCode);
  const metric = block.metrics[metricIndex];
  const value = Object.hasOwn(values, 'value') ? editableNumber(values.value, 'Фактический балл') : editableNumber(metric.value, 'Фактический балл');
  const maximum = Object.hasOwn(values, 'max_value') ? editableNumber(values.max_value, 'Максимальный балл') : editableNumber(metric.max_value, 'Максимальный балл');
  if (isIndexMetric(metric) && value > maximum) {
    throw new RangeError('Фактический балл не может превышать максимальный.');
  }
  const recommendationItems = updateRecommendationItems(metric.recommendation_items, value, maximum);
  const trafficLight = metricTrafficLight(metric, value, maximum);
  if (metric.value === value
    && metric.max_value === maximum
    && metric.traffic_light === trafficLight
    && metric.recommendation_items === recommendationItems) return report;
  const nextMetric = {
    ...metric,
    value,
    max_value: maximum,
    traffic_light: trafficLight,
    ...(recommendationItems === undefined ? {} : {recommendation_items: recommendationItems}),
  };
  const metrics = [...block.metrics];
  metrics[metricIndex] = nextMetric;
  const blocks = [...product.metrics];
  blocks[blockIndex] = {...block, metrics};
  const products = [...report.products];
  products[productIndex] = {...product, metrics: blocks};
  return touchChangedReport(report, products, true);
}

function cloneJsonValue(value) {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)]));
  return value;
}

function jsonEqual(left, right) {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

export function applyMetricDefinition(report, metricCode, patch, scope) {
  if (!isObject(patch)) throw new TypeError('Изменения метрики должны быть объектом.');
  const unsupported = Object.keys(patch).filter((key) => !METRIC_DEFINITION_FIELDS.has(key));
  if (unsupported.length) throw new RangeError(`Нельзя сквозным редактированием изменять поля: ${unsupported.join(', ')}.`);
  if (Object.hasOwn(patch, 'name')) normalizedText(patch.name, 'Название метрики');
  if (Object.hasOwn(patch, 'footer') && typeof patch.footer !== 'string') throw new TypeError('Footer метрики должен быть строкой.');
  if (!Object.keys(patch).length) return report;
  const normalizedPatch = Object.fromEntries(Object.entries(patch).map(([key, value]) => {
    if (key === 'name') return [key, value.trim()];
    return [key, cloneJsonValue(value)];
  }));
  return updateScopedProducts(report, scope, (product) => {
    let productChanged = false;
    const blocks = product.metrics.map((block) => {
      let blockChanged = false;
      const metrics = block.metrics.map((metric) => {
        if (metric.code !== metricCode) return metric;
        const hasChanges = Object.entries(normalizedPatch).some(([key, value]) => !jsonEqual(metric[key], value));
        if (!hasChanges) return metric;
        blockChanged = true;
        return {...metric, ...cloneJsonValue(normalizedPatch)};
      });
      if (!blockChanged) return block;
      productChanged = true;
      return {...block, metrics};
    });
    return productChanged ? {...product, metrics: blocks} : product;
  });
}

function nextBlockCode(report) {
  const codes = new Set((report.products || []).flatMap((product) => (product.metrics || []).map((block) => String(block.code))));
  let index = 1;
  while (codes.has(`constructor-block-${index}`)) index += 1;
  return `constructor-block-${index}`;
}

export function addBlock(report, {name, scope} = {}) {
  const blockName = normalizedText(name, 'Название блока');
  const code = nextBlockCode(report);
  return updateScopedProducts(report, scope, (product) => {
    if (!Array.isArray(product.metrics)) return product;
    return {
      ...product,
      metrics: [...product.metrics, {type: 'block', code, name: blockName, metrics: []}],
    };
  });
}

export function renameBlock(report, {blockCode, name, scope} = {}) {
  const code = normalizedText(blockCode, 'Код блока');
  const blockName = normalizedText(name, 'Название блока');
  return updateScopedProducts(report, scope, (product) => {
    let changed = false;
    const blocks = product.metrics.map((block) => {
      if (block.code !== code || block.name === blockName) return block;
      changed = true;
      return {...block, name: blockName};
    });
    return changed ? {...product, metrics: blocks} : product;
  });
}

export function deleteEmptyBlock(report, {blockCode, scope} = {}) {
  const code = normalizedText(blockCode, 'Код блока');
  return updateScopedProducts(report, scope, (product) => {
    const target = product.metrics.find((block) => block.code === code);
    if (!target || (target.metrics || []).length) return product;
    return {...product, metrics: product.metrics.filter((block) => block !== target)};
  });
}

export function reorderBlock(report, {blockCode, targetBlockCode, position, scope} = {}) {
  const code = normalizedText(blockCode, 'Код перемещаемого блока');
  const targetCode = normalizedText(targetBlockCode, 'Код целевого блока');
  if (!['before', 'after'].includes(position)) throw new RangeError('position должен быть before или after.');
  if (code === targetCode) return report;
  return updateScopedProducts(report, scope, (product) => {
    const sourceIndex = product.metrics.findIndex((block) => block.code === code);
    const originalTargetIndex = product.metrics.findIndex((block) => block.code === targetCode);
    if (sourceIndex < 0 || originalTargetIndex < 0) return product;
    const blocks = [...product.metrics];
    const [source] = blocks.splice(sourceIndex, 1);
    const targetIndex = blocks.findIndex((block) => block.code === targetCode);
    blocks.splice(targetIndex + (position === 'after' ? 1 : 0), 0, source);
    if (blocks.every((block, index) => block === product.metrics[index])) return product;
    return {...product, metrics: blocks};
  });
}

function synchronizeSort(metrics) {
  let changed = false;
  const next = metrics.map((metric, index) => {
    const sort = index + 1;
    if (Number(metric.sort) === sort && typeof metric.sort === 'number') return metric;
    changed = true;
    return {...metric, sort};
  });
  return changed ? next : metrics;
}

export function moveMetric(report, {
  metricCode,
  sourceBlockCode,
  targetBlockCode,
  targetIndex,
  scope,
} = {}) {
  const code = normalizedText(metricCode, 'Код метрики');
  const sourceCode = normalizedText(sourceBlockCode, 'Исходный блок');
  const targetCode = normalizedText(targetBlockCode, 'Целевой блок');
  if (!Number.isInteger(targetIndex) || targetIndex < 0) throw new RangeError('targetIndex должен быть неотрицательным целым числом.');
  return updateScopedProducts(report, scope, (product) => {
    const sourceIndex = product.metrics.findIndex((block) => block.code === sourceCode);
    const targetBlockIndex = product.metrics.findIndex((block) => block.code === targetCode);
    if (sourceIndex < 0 || targetBlockIndex < 0) return product;
    const sourceBlock = product.metrics[sourceIndex];
    const metricIndex = sourceBlock.metrics.findIndex((metric) => metric.code === code);
    if (metricIndex < 0) return product;

    if (sourceIndex === targetBlockIndex) {
      const reordered = [...sourceBlock.metrics];
      const [metric] = reordered.splice(metricIndex, 1);
      reordered.splice(Math.min(targetIndex, reordered.length), 0, metric);
      const metrics = synchronizeSort(reordered);
      if (metrics.every((item, index) => item === sourceBlock.metrics[index])) return product;
      const blocks = [...product.metrics];
      blocks[sourceIndex] = {...sourceBlock, metrics};
      return {...product, metrics: blocks};
    }

    const targetBlock = product.metrics[targetBlockIndex];
    if (targetBlock.metrics.some((metric) => metric.code === code)) return product;
    const sourceMetrics = [...sourceBlock.metrics];
    const [metric] = sourceMetrics.splice(metricIndex, 1);
    const targetMetrics = [...targetBlock.metrics];
    targetMetrics.splice(Math.min(targetIndex, targetMetrics.length), 0, metric);
    const blocks = [...product.metrics];
    blocks[sourceIndex] = {...sourceBlock, metrics: synchronizeSort(sourceMetrics)};
    blocks[targetBlockIndex] = {...targetBlock, metrics: synchronizeSort(targetMetrics)};
    return {...product, metrics: blocks};
  });
}

export function serializeReport(report) {
  const ensured = ensureConstructorDocument(report);
  const materialized = {...ensured, title: deriveTitle(ensured)};
  const errors = validateReport(materialized);
  if (errors.length) throwValidation(errors);
  return `${JSON.stringify(materialized, null, 2)}\n`;
}

export function parseReportJson(text) {
  if (typeof text !== 'string') throw new TypeError('JSON отчёта должен быть строкой.');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    const error = new SyntaxError(`Не удалось разобрать JSON отчёта: ${cause.message}`);
    error.cause = cause;
    throw error;
  }
  const errors = validateReport(parsed);
  if (errors.length) throwValidation(errors);
  const ensured = ensureConstructorDocument(parsed);
  return {...ensured, title: deriveTitle(ensured)};
}

function productIdentity(product, index) {
  const id = String(product?.id ?? '').trim();
  return id || `legacy:${String(product?.name || '')}\u0000${String(product?.unit || '')}\u0000${index}`;
}

export function changedProductCount(baseline, current) {
  const baselineProducts = Array.isArray(baseline?.products) ? baseline.products : [];
  const currentProducts = Array.isArray(current?.products) ? current.products : [];
  const baselineMap = new Map(baselineProducts.map((product, index) => [productIdentity(product, index), product]));
  const currentMap = new Map(currentProducts.map((product, index) => [productIdentity(product, index), product]));
  const identities = new Set([...baselineMap.keys(), ...currentMap.keys()]);
  let count = 0;
  identities.forEach((identity) => {
    const before = baselineMap.get(identity);
    const after = currentMap.get(identity);
    if (!before || !after || (before !== after && JSON.stringify(before) !== JSON.stringify(after))) count += 1;
  });
  return count;
}
