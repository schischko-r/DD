function dispatchValueEvents(element, document) {
  const EventConstructor = document?.defaultView?.Event;
  if (!EventConstructor) return;
  element.dispatchEvent(new EventConstructor('input', {bubbles: true}));
  element.dispatchEvent(new EventConstructor('change', {bubbles: true}));
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru-RU');
}

function setNativeValue(element, value, document) {
  const valueDescriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(element) || {},
    'value',
  );
  if (valueDescriptor?.set) {
    valueDescriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  dispatchValueEvents(element, document);
}

function nativeControl(element) {
  if (!element) return null;
  const tagName = String(element.tagName || '').toLowerCase();
  if (tagName === 'input' || tagName === 'select') return element;
  return element.querySelector?.('select, input[list], input') || null;
}

function nativeExpectedValue(control, value) {
  if (!control?.options) return value;
  const normalizedValue = normalizeText(value);
  const option = Array.from(control.options).find((candidate) => (
    normalizeText(candidate.value) === normalizedValue
    || normalizeText(candidate.textContent || candidate.label) === normalizedValue
  ));
  return option?.value ?? value;
}

function applyNativeValue(document, container, control, value, markerKey) {
  const expectedValue = String(value ?? '');
  const normalizedExpected = normalizeText(expectedValue);
  if (
    container[markerKey] === normalizedExpected
    && normalizeText(control.value) === normalizedExpected
  ) {
    return true;
  }
  setNativeValue(control, expectedValue, document);
  container[markerKey] = normalizedExpected;
  return false;
}

const RUSSIAN_MONTH_PREFIXES = new Map([
  ['янв', 0],
  ['фев', 1],
  ['мар', 2],
  ['апр', 3],
  ['май', 4],
  ['мая', 4],
  ['июн', 5],
  ['июл', 6],
  ['авг', 7],
  ['сен', 8],
  ['окт', 9],
  ['ноя', 10],
  ['дек', 11],
]);

function periodTimestamp(option) {
  const text = `${option?.value ?? ''} ${option?.textContent ?? option?.label ?? ''}`;
  const timestamps = [];
  for (const match of text.matchAll(/\b(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?\b/g)) {
    timestamps.push(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1)));
  }
  for (const match of text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)) {
    timestamps.push(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  }
  for (const match of normalizeText(text).matchAll(
    /(янв\p{L}*|фев\p{L}*|мар\p{L}*|апр\p{L}*|ма[йя]|июн\p{L}*|июл\p{L}*|авг\p{L}*|сен\p{L}*|окт\p{L}*|ноя\p{L}*|дек\p{L}*)\.?\s+(\d{4})/gu,
  )) {
    timestamps.push(Date.UTC(
      Number(match[2]),
      RUSSIAN_MONTH_PREFIXES.get(match[1].slice(0, 3)),
      1,
    ));
  }
  return timestamps.length ? Math.max(...timestamps) : Number.NEGATIVE_INFINITY;
}

function latestPeriodOption(options) {
  return Array.from(options || [])
    .filter((option) => (
      !option.disabled
      && option.getAttribute?.('aria-disabled') !== 'true'
      && (option.value || normalizeText(option.textContent || option.label))
    ))
    .reduce((latest, option) => {
      if (!latest) return option;
      const latestTimestamp = periodTimestamp(latest);
      const optionTimestamp = periodTimestamp(option);
      if (optionTimestamp !== latestTimestamp) {
        return optionTimestamp > latestTimestamp ? option : latest;
      }
      const latestText = String(latest.value || latest.textContent || latest.label || '');
      const optionText = String(option.value || option.textContent || option.label || '');
      return optionText.localeCompare(latestText, 'ru') > 0 ? option : latest;
    }, null);
}

export function latestPeriodValue(options) {
  const latest = latestPeriodOption(options);
  return latest?.value || '';
}

function gravitySelectControl(element) {
  if (!element) return null;
  if (element.getAttribute?.('role') === 'combobox') return element;
  return element.querySelector?.('[role="combobox"]') || null;
}

function gravityOptions(document, control) {
  const listboxId = control.getAttribute?.('aria-controls');
  const listbox = (listboxId && document.getElementById?.(listboxId))
    || document.querySelector?.('[role="listbox"]');
  return {
    listbox,
    options: Array.from(listbox?.querySelectorAll?.('[role="option"]') || []),
  };
}

function openGravitySelect(control) {
  if (control.getAttribute?.('aria-expanded') !== 'true') {
    control.click();
  }
}

function applyGravityValue(document, container, value) {
  const control = gravitySelectControl(container);
  if (!control) return false;
  const normalizedValue = normalizeText(value);
  if (normalizeText(control.textContent) === normalizedValue) {
    return true;
  }

  openGravitySelect(control);
  const {listbox, options} = gravityOptions(document, control);
  if (!listbox || !options.length) return false;

  let option = options.find((candidate) => normalizeText(candidate.textContent) === normalizedValue);
  if (!option) {
    const filter = document.querySelector?.(
      `input[role="combobox"][aria-controls="${listbox.id}"]`,
    );
    if (filter && normalizeText(filter.value) !== normalizedValue) {
      setNativeValue(filter, value, document);
      return false;
    }
    option = options.find((candidate) => normalizeText(candidate.textContent) === normalizedValue);
  }
  if (!option) return false;

  option.click();
  return false;
}

function applyFieldValue(document, container, value) {
  const control = nativeControl(container);
  if (control) {
    return applyNativeValue(
      document,
      container,
      control,
      nativeExpectedValue(control, value),
      '__ddiBridgeNativeValue',
    );
  }
  return applyGravityValue(document, container, value);
}

function applyLatestPeriod(document, container) {
  const control = nativeControl(container);
  if (control?.options) {
    const latestValue = latestPeriodValue(control.options);
    if (!latestValue) return false;
    return applyNativeValue(
      document,
      container,
      control,
      latestValue,
      '__ddiBridgeNativeLatestPeriod',
    );
  }

  const gravityControl = gravitySelectControl(container);
  if (!gravityControl) return false;
  if (
    container.__ddiBridgeLatestPeriod
    && normalizeText(gravityControl.textContent) === container.__ddiBridgeLatestPeriod
  ) {
    return true;
  }

  openGravitySelect(gravityControl);
  const {listbox, options} = gravityOptions(document, gravityControl);
  if (!listbox || !options.length) return false;
  const latest = latestPeriodOption(options);
  if (!latest) return false;

  latest.click();
  container.__ddiBridgeLatestPeriod = normalizeText(latest.textContent);
  return false;
}

export function applyHtmlPageBridge(document, bridge = {}, context = {}) {
  if (!document) return {ready: false, showTriggered: false};

  for (const field of bridge.fields || []) {
    const container = document.querySelector(field.selector);
    const value = context[field.contextKey] ?? '';
    if (!container || (field.required && !value)) {
      if (field.required) return {ready: false, showTriggered: false};
      continue;
    }
    if (!applyFieldValue(document, container, value)) {
      return {ready: false, showTriggered: false};
    }
  }

  if (bridge.latestPeriodSelector) {
    const periodContainer = document.querySelector(bridge.latestPeriodSelector);
    if (!periodContainer || !applyLatestPeriod(document, periodContainer)) {
      return {ready: false, showTriggered: false};
    }
  }

  const showControl = bridge.showSelector
    ? document.querySelector(bridge.showSelector)
    : null;
  const ready = Boolean(showControl);
  const showTriggered = ready;
  if (showTriggered) showControl.click();

  return {ready, showTriggered};
}
