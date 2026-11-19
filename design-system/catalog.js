(() => {
  const root = document.documentElement;
  if (!root.classList.contains('ddi')) return;
  const names = new Map([['deposits', 'Вклады'], ['prime', 'Прайм']]);
  const mobileQuery = '(max-width:' + getComputedStyle(root).getPropertyValue('--ddi-layout-breakpoint-mobile').trim() + ')';
  const states = new Map([...names.keys()].map(id => [id, {identified: '', url: '', checked: false}]));
  const product = document.getElementById('ddi-product');
  const identified = document.getElementById('ddi-identified');
  const sam = document.getElementById('ddi-sam');
  const checkbox = document.getElementById('ddi-evidence-check');
  const evidenceLink = document.getElementById('ddi-evidence-link');
  const openButton = document.getElementById('ddi-evidence-open');
  const dialog = document.getElementById('ddi-evidence-dialog');
  const form = document.getElementById('ddi-evidence-form');
  const evidenceInput = document.getElementById('ddi-evidence-url');
  const removeButton = document.getElementById('ddi-evidence-remove');
  let selected = 'deposits';
  let editing = null;
  const current = () => states.get(selected);
  function validUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try { const parsed = new URL(value.trim()); return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname ? parsed.href : ''; } catch { return ''; }
  }
  function formatNumber(value) {
    const compact = value.replace(/\s/g, '');
    const match = compact.match(/^(\d+)([.,]\d*)?$/);
    return match ? match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (match[2] || '') : value;
  }
  function formatInput(input) {
    const before = input.value;
    const formatted = formatNumber(before);
    if (before === formatted) return formatted;
    const start = input.selectionStart, end = input.selectionEnd, direction = input.selectionDirection;
    function position(offset) {
      const prefix = before.slice(0, offset);
      const logical = prefix.replace(/\s/g, '').length;
      let seen = 0, index = 0;
      while (index < formatted.length && seen < logical) { if (!/\s/.test(formatted[index])) seen += 1; index += 1; }
      if (/\s$/.test(prefix)) while (index < formatted.length && /\s/.test(formatted[index])) index += 1;
      return index;
    }
    input.value = formatted;
    if (start !== null && end !== null) input.setSelectionRange(position(start), position(end), direction);
    return formatted;
  }
  function volume(value) {
    const compact = value.replace(/\s/g, '').replace(',', '.');
    if (!compact) return null;
    if (!/^\d+(?:\.\d+)?$/.test(compact)) return NaN;
    const number = Number(compact);
    return Number.isFinite(number) ? number : NaN;
  }
  function renderMetric() {
    const number = volume(current().identified);
    let state = 'neutral', value = '—', title = 'Нет данных для оценки';
    let description = 'Введите идентифицированный объём. Светофор и пояснение обновятся вместе.';
    let error = '';
    if (Number.isNaN(number)) { error = 'Введите неотрицательное число; допустимы пробелы и десятичная запятая.'; description = 'Проверьте введённое значение. Оценка пока не рассчитывается.'; }
    else if (number !== null && number > 1000) { error = 'Значение не должно превышать учебный объём SAM: 1 000.'; description = 'Идентифицированный объём не может быть больше SAM.'; }
    else if (number !== null) {
      const coverage = Number((number / 1000 * 100).toFixed(1));
      state = coverage >= 95 ? 'success' : coverage >= 80 ? 'warning' : 'danger';
      value = coverage.toLocaleString('ru-RU', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' %';
      title = state === 'success' ? 'В норме' : state === 'warning' ? 'Требует внимания' : 'Ниже нормы';
      description = state === 'success' ? 'Демонстрационное покрытие достигло 95%. Цвет пояснения совпадает со светофором.' : state === 'warning' ? 'Демонстрационное покрытие от 80% до 95%. Сначала проверьте неполный охват.' : 'Демонстрационное покрытие ниже 80%. Пояснение использует тот же статус, что индикатор.';
    }
    identified.setAttribute('aria-invalid', String(Boolean(error)));
    document.getElementById('ddi-metric-error').textContent = error;
    document.getElementById('ddi-coverage').textContent = value;
    document.getElementById('ddi-status-label').textContent = title;
    document.querySelector('[data-component="status"]').dataset.state = state;
    const insight = document.getElementById('ddi-insight');
    insight.dataset.state = state;
    document.getElementById('ddi-insight-title').textContent = title;
    document.getElementById('ddi-insight-body').textContent = description;
    document.querySelectorAll('.ddi-lights [data-status]').forEach(dot => dot.dataset.active = String(dot.dataset.status === state));
  }
  function render() {
    product.value = selected;
    document.getElementById('ddi-context-product').textContent = names.get(selected);
    current().identified = formatNumber(current().identified);
    if (identified.value !== current().identified) identified.value = current().identified;
    sam.value = '1 000'; sam.readOnly = true;
    const url = validUrl(current().url);
    checkbox.disabled = !url;
    checkbox.checked = Boolean(url && current().checked);
    evidenceLink.hidden = !url;
    if (url) evidenceLink.href = url; else evidenceLink.removeAttribute('href');
    openButton.textContent = url ? 'Изменить ссылку' : 'Приложить ссылку';
    document.getElementById('ddi-evidence-help').textContent = url ? 'Ссылка приложена. Отметку можно изменить.' : 'Для отметки нужна ссылка на подтверждение.';
    document.getElementById('ddi-evidence-state').textContent = checkbox.checked ? 'Пункт отмечен. Ссылка на подтверждение приложена.' : url ? 'Ссылка приложена; пункт не отмечен.' : 'Подтверждение не приложено.';
    renderMetric();
  }
  product.addEventListener('change', () => { if (!states.has(product.value)) { product.value = selected; return; } selected = product.value; render(); });
  checkbox.addEventListener('change', () => { current().checked = Boolean(validUrl(current().url) && checkbox.checked); render(); });
  function updateNumber() { current().identified = formatInput(identified); renderMetric(); }
  identified.addEventListener('input', updateNumber);
  identified.addEventListener('beforeinput', event => {
    const caret = identified.selectionStart, text = identified.value;
    if (!event.cancelable || event.isComposing || caret === null || caret !== identified.selectionEnd) return;
    if (!/^\d+(?:[.,]\d*)?$/.test(text.replace(/\s/g, '')) || formatNumber(text) !== text) return;
    let start = caret, end = caret;
    if (event.inputType === 'deleteContentForward' && /\s/.test(text[caret] || '')) { while (end < text.length && /\s/.test(text[end])) end += 1; if (!/\d/.test(text[end] || '')) return; end += 1; }
    else if (event.inputType === 'deleteContentBackward' && /\s/.test(text[caret - 1] || '')) { while (start > 0 && /\s/.test(text[start - 1])) start -= 1; if (!/\d/.test(text[start - 1] || '')) return; start -= 1; }
    else return;
    event.preventDefault(); identified.setRangeText('', start, end, 'start'); updateNumber();
  });
  function restoreSource() { sam.value = '1 000'; sam.readOnly = true; renderMetric(); }
  sam.addEventListener('input', restoreSource);
  sam.addEventListener('change', restoreSource);
  openButton.addEventListener('click', () => {
    editing = selected;
    evidenceInput.value = states.get(editing).url;
    evidenceInput.setCustomValidity(''); evidenceInput.setAttribute('aria-invalid', 'false');
    document.getElementById('ddi-url-error').textContent = '';
    document.getElementById('ddi-evidence-context').textContent = names.get(editing);
    removeButton.hidden = !validUrl(states.get(editing).url);
    dialog.showModal();
  });
  evidenceInput.addEventListener('input', () => { evidenceInput.setCustomValidity(''); evidenceInput.setAttribute('aria-invalid', 'false'); document.getElementById('ddi-url-error').textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault(); if (!editing) return;
    const url = validUrl(evidenceInput.value);
    if (!url) { const message = 'Укажите полную ссылку с протоколом http:// или https://.'; evidenceInput.setCustomValidity(message); evidenceInput.setAttribute('aria-invalid', 'true'); document.getElementById('ddi-url-error').textContent = message; evidenceInput.reportValidity(); return; }
    states.get(editing).url = url; states.get(editing).checked = true; render(); dialog.close();
  });
  document.getElementById('ddi-evidence-cancel').addEventListener('click', () => dialog.close());
  removeButton.addEventListener('click', () => { if (!editing) return; states.get(editing).url = ''; states.get(editing).checked = false; render(); dialog.close(); });
  dialog.addEventListener('close', () => { editing = null; openButton.focus(); });
  const feedback = document.getElementById('ddi-button-feedback');
  document.getElementById('ddi-demo-primary').addEventListener('click', () => feedback.textContent = 'Демонстрация: основное действие выполнено локально.');
  document.getElementById('ddi-demo-secondary').addEventListener('click', () => feedback.textContent = 'Демонстрация: вторичное действие выполнено локально.');
  document.getElementById('ddi-demo-toggle').addEventListener('click', event => { const button = event.currentTarget; const pressed = button.getAttribute('aria-pressed') !== 'true'; button.setAttribute('aria-pressed', String(pressed)); button.textContent = pressed ? 'Выбрано' : 'Выбрать'; feedback.textContent = pressed ? 'Состояние выбрано.' : 'Выбор снят.'; });
  const tabs = [...document.querySelectorAll('#ddi-tabs [role="tab"]')];
  function activate(tab, focus = false) { tabs.forEach(item => { const active = item === tab; item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; document.getElementById(item.getAttribute('aria-controls')).hidden = !active; }); if (focus) tab.focus(); }
  tabs.forEach((tab, index) => { tab.addEventListener('click', () => activate(tab)); tab.addEventListener('keydown', event => { let next; if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length]; else if (event.key === 'ArrowLeft') next = tabs[(index + tabs.length - 1) % tabs.length]; else if (event.key === 'Home') next = tabs[0]; else if (event.key === 'End') next = tabs[tabs.length - 1]; else return; event.preventDefault(); activate(next, true); }); });
  const sections = [...document.querySelectorAll('.ddi-main section[id]')];
  const links = [...document.querySelectorAll('.ddi-nav a[data-ddi-section]')];
  let pending = false;
  function navigation() { pending = false; const marker = Math.max(170, innerHeight * .27); const active = sections.reduce((current, section) => section.getBoundingClientRect().top <= marker ? section : current, sections[0]); links.forEach(link => { if (link.dataset.ddiSection === active.id) { const fresh = !link.hasAttribute('aria-current'); link.setAttribute('aria-current', 'location'); if (fresh && matchMedia(mobileQuery).matches) { const nav = link.closest('.ddi-nav'), bounds = link.getBoundingClientRect(); if (bounds.left < 12) nav.scrollLeft += bounds.left - 12; else if (bounds.right > innerWidth - 12) nav.scrollLeft += bounds.right - innerWidth + 12; } } else link.removeAttribute('aria-current'); }); }
  addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(navigation); } }, {passive: true}); addEventListener('resize', navigation); addEventListener('hashchange', navigation);
  render(); navigation();
})();
