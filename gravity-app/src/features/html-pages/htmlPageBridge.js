function dispatchValueEvents(element, document) {
  const EventConstructor = document?.defaultView?.Event;
  if (!EventConstructor) return;
  element.dispatchEvent(new EventConstructor('input', {bubbles: true}));
  element.dispatchEvent(new EventConstructor('change', {bubbles: true}));
}

export function latestPeriodValue(options) {
  const latest = Array.from(options || [])
    .filter((option) => !option.disabled && option.value)
    .reduce((latest, option) => (
      !latest || String(option.value).localeCompare(String(latest.value)) > 0
        ? option
        : latest
    ), null);
  return latest?.value || '';
}

export function applyHtmlPageBridge(document, bridge = {}, context = {}) {
  if (!document) return {ready: false, showTriggered: false};

  let ready = true;
  for (const field of bridge.fields || []) {
    const control = document.querySelector(field.selector);
    const value = context[field.contextKey] ?? '';
    if (!control || (field.required && !value)) {
      if (field.required) ready = false;
      continue;
    }
    control.value = value;
    dispatchValueEvents(control, document);
  }

  if (bridge.latestPeriodSelector) {
    const periodSelect = document.querySelector(bridge.latestPeriodSelector);
    const latestValue = latestPeriodValue(periodSelect?.options);
    if (!periodSelect || !latestValue) {
      ready = false;
    } else {
      periodSelect.value = latestValue;
      dispatchValueEvents(periodSelect, document);
    }
  }

  const showControl = bridge.showSelector
    ? document.querySelector(bridge.showSelector)
    : null;
  const showTriggered = Boolean(ready && showControl);
  if (showTriggered) showControl.click();

  return {ready, showTriggered};
}
