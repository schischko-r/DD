
<script>
// ── внутренняя страница «Сценарии оттока» ────────────────────────────────
// Живёт в этом же файле: плашка в рекомендациях прячет отчёт и показывает
// эту страницу, адрес получает #scenarios — «Назад» в браузере возвращает.
// Всё обёрнуто в IIFE, чтобы имена не пересеклись с кодом отчёта.
window.ScenariosPage = (() => {
  // ── синтетика ───────────────────────────────────────────────────────────
  // Доли, распределение по дням и покрытие выдуманы для макета. Когда
  // появится выгрузка, заменить SCENARIOS — разметка от них не зависит.
  const MEASURES = [
    {id: 'clnt', label: 'Клиенты'},
    {id: 'rur', label: 'Объёмы (руб)'},
  ];
  const DEFAULT_TOTAL = {rur: 219.48, clnt: 299379};
  // Интервалы не пересекаются: t+3 — это дни 2–3, а не всё до третьего дня.
  const BUCKETS = [
    {id: 't+1', days: 'день 1'},
    {id: 't+3', days: 'дни 2–3'},
    {id: 't+7', days: 'дни 4–7'},
    {id: 't+14', days: 'дни 8–14'},
    {id: 't+30', days: 'дни 15–30'},
  ];
  const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'];

  const SCENARIOS = [
    {
      id: 'partial', name: 'Частичное закрытие вклада', color: '#4DA2F1', ink: '#fff',
      about: 'Клиент снимает часть суммы и оставляет вклад работать',
      share: {rur: 34, clnt: 29},
      // Доля оттока сценария в каждом интервале, в сумме 100.
      dist: [18, 16, 18, 22, 26],
      service: [84, 85, 86, 86, 87, 88.4],
      promoNs: [27, 28, 30, 31, 31, 32.5],
      promoDep: [30, 30, 31, 33, 34, 35.2],
      oms: [4.1, 4.3, 4.8, 5.0, 5.4, 5.9],
      invest: [7.2, 7.5, 7.1, 7.9, 8.3, 8.8],
    },
    {
      id: 'm2m', name: 'Вывод M2M в другие банки', color: '#FF3D64', ink: '#fff',
      about: 'Перевод между своими счетами в другой банк — чаще всего за ставкой',
      share: {rur: 27, clnt: 21},
      dist: [31, 24, 18, 15, 12],
      service: [81, 82, 82, 83, 84, 83.1],
      promoNs: [22, 23, 23, 24, 25, 24.1],
      promoDep: [33, 34, 36, 37, 37, 38.6],
      oms: [2.1, 2.4, 2.2, 2.6, 2.8, 3.0],
      invest: [4.5, 4.4, 4.9, 5.1, 5.0, 5.4],
    },
    {
      id: 'invest', name: 'Вывод в инвестиции', color: '#8AD554', ink: 'rgba(0,0,0,.8)',
      about: 'Деньги уходят на брокерский счёт или в ПИФы',
      share: {rur: 16, clnt: 9},
      dist: [22, 19, 19, 20, 20],
      service: [86, 87, 88, 88, 89, 90.2],
      promoNs: [18, 19, 19, 20, 21, 21.7],
      promoDep: [24, 25, 25, 26, 27, 26.4],
      oms: [6.2, 6.8, 7.1, 7.4, 7.9, 8.5],
      invest: [14.0, 15.1, 16.2, 16.8, 18.0, 19.3],
    },
    {
      id: 'loans', name: 'Закрытие кредитов', color: '#FFC636', ink: 'rgba(0,0,0,.8)',
      about: 'Досрочное погашение ипотеки или потребкредита',
      share: {rur: 13, clnt: 15},
      dist: [9, 11, 18, 25, 37],
      service: [83, 84, 84, 85, 85, 86.0],
      promoNs: [25, 25, 26, 26, 27, 27.8],
      promoDep: [28, 28, 29, 29, 30, 29.5],
      oms: [1.8, 2.0, 2.1, 2.1, 2.4, 2.5],
      invest: [3.1, 3.0, 3.3, 3.2, 3.6, 3.7],
    },
    {
      id: 'pos', name: 'POS-оборот', color: '#BA74B3', ink: '#fff',
      about: 'Остаток тратится покупками по карте',
      share: {rur: 10, clnt: 26},
      dist: [6, 9, 16, 26, 43],
      service: [79, 80, 80, 81, 82, 82.4],
      promoNs: [31, 32, 33, 33, 34, 35.1],
      promoDep: [19, 20, 20, 21, 21, 20.6],
      oms: [1.2, 1.3, 1.3, 1.5, 1.6, 1.7],
      invest: [1.9, 2.0, 2.2, 2.1, 2.4, 2.6],
    },
  ];

  const S = {measure: 'clnt', pick: null, sankey: false, period: 'Июнь 2026', total: {...DEFAULT_TOTAL}};

  // ── утилиты ─────────────────────────────────────────────────────────────
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const mk = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const svg = (tag, attrs = {}) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  };
  const fmt = (value, digits = 0) => new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
  const money = () => S.measure === 'rur';
  const amount = (v) => (money()
    ? `${fmt(v, v < 10 ? 2 : 1)} млрд ₽`
    : v >= 1000 ? `${fmt(v / 1000, 1)} тыс.` : fmt(v));
  const axis = (v) => (money()
    ? fmt(v, v && v < 10 ? 1 : 0)
    : v >= 1000 ? `${fmt(v / 1000, v < 10000 && v % 1000 ? 1 : 0)}к` : fmt(v));
  const last = (list) => list[list.length - 1];
  const scenarioTotal = (s) => S.total[S.measure] * s.share[S.measure] / 100;

  function delta(series) {
    const d = last(series) - series[series.length - 2];
    const tone = d > 0.05 ? ' is-good' : d < -0.05 ? ' is-bad' : '';
    const arrow = d > 0.05 ? '↑' : d < -0.05 ? '↓' : '→';
    return mk('span', 'scn-delta' + tone, `${arrow} ${d > 0 ? '+' : ''}${fmt(d, 1)} п.п. м/м`);
  }
  function niceScale(value) {
    const pow = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= value / 4) * pow;
    return {max: Math.ceil(value / step) * step, step};
  }

  function spark(series, color) {
    const W = 232, H = 34, pad = 4;
    const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
    const x = (i) => pad + i * (W - pad * 2) / (series.length - 1);
    const y = (v) => pad + (1 - (v - min) / span) * (H - pad * 2);
    const pts = series.map((v, i) => `${x(i)},${y(v)}`);
    const label = series.map((v, i) => `${MONTHS[i]}: ${fmt(v, 1)}%`).join('; ');
    const root = svg('svg', {class: 'scn-spark', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none',
      role: 'img', 'aria-label': label});
    root.append(svg('path', {d: `M${x(0)},${H} L${pts.join(' L')} L${x(series.length - 1)},${H} Z`,
      fill: color, 'fill-opacity': '.1'}));
    root.append(svg('polyline', {points: pts.join(' '), fill: 'none', stroke: color, 'stroke-opacity': '.55',
      'stroke-width': 2, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke'}));
    root.append(svg('circle', {cx: x(series.length - 1), cy: y(last(series)), r: 3.5, fill: color}));
    const title = svg('title');
    title.textContent = label;
    root.append(title);
    return root;
  }

  // ── переключатель и полоса 100% ────────────────────────────────────────
  function renderSwitch() {
    const host = $('scnMeasure');
    host.innerHTML = '';
    MEASURES.forEach((m) => {
      const b = mk('button', null, m.label);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(m.id === S.measure));
      b.addEventListener('click', () => { S.measure = m.id; render(); });
      host.append(b);
    });
  }

  function pick(id) {
    S.pick = S.pick === id ? null : id;
    S.sankey = false;
    render();
    if (S.pick) $('scnDetail').scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }

  function renderBar() {
    const total = S.total[S.measure];
    $('scnTotal').innerHTML = `Весь отток за ${S.period.toLowerCase()}: <b>${amount(total)}</b>`;
    const bar = $('scnBar'), legend = $('scnLegend');
    bar.innerHTML = '';
    legend.innerHTML = '';
    bar.classList.toggle('has-pick', !!S.pick);

    SCENARIOS.slice().sort((a, b) => b.share[S.measure] - a.share[S.measure]).forEach((s) => {
      const share = s.share[S.measure];
      const seg = mk('button');
      seg.type = 'button';
      seg.style.flex = `${share} 1 0`;
      seg.style.background = s.color;
      seg.style.color = s.ink;
      seg.title = `${s.name}: ${share}% · ${amount(total * share / 100)}`;
      seg.setAttribute('aria-label', seg.title);
      seg.setAttribute('aria-pressed', String(S.pick === s.id));
      // В узком сегменте только процент — имя есть в легенде.
      seg.append(mk('span', null, share >= 12 ? `${s.name} · ${share}%` : `${share}%`));
      seg.addEventListener('click', () => pick(s.id));
      bar.append(seg);

      const item = mk('button');
      item.type = 'button';
      item.setAttribute('aria-pressed', String(S.pick === s.id));
      const dot = mk('i');
      dot.style.background = s.color;
      const name = mk('span', null, s.name);
      name.append(mk('small', null, amount(total * share / 100)));
      item.append(dot, name, mk('b', null, `${share}%`));
      item.addEventListener('click', () => pick(s.id));
      const li = mk('li');
      li.append(item);
      legend.append(li);
    });
  }

  // ── распределение по дням: интервалы по вертикали, объём по горизонтали ─
  function distribution(s) {
    const total = scenarioTotal(s);
    const values = s.dist.map((p) => total * p / 100);
    const {max, step} = niceScale(Math.max(...values));
    const ticks = [];
    for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v);

    const box = mk('div');
    const rows = mk('div', 'scn-rows');
    values.forEach((v, i) => {
      const row = mk('div', 'scn-row');
      const label = mk('div', 'scn-row-label', BUCKETS[i].id);
      label.append(mk('small', null, BUCKETS[i].days));
      const track = mk('div', 'scn-track');
      const lines = mk('div', 'scn-grid-lines');
      ticks.slice(1).forEach((t) => {
        const line = mk('i');
        line.style.left = `${t / max * 100}%`;
        lines.append(line);
      });
      const fill = mk('div', 'scn-fill');
      const width = v / max * 100;
      fill.style.width = `${width}%`;
      fill.style.background = s.color;
      const text = mk('div', 'scn-fill-label');
      text.innerHTML = `<b>${fmt(s.dist[i])}%</b> · ${amount(v)}`;
      // Подпись справа от столбика, а у самого длинного — внутри, чтобы не
      // вылезать за край карточки.
      if (width > 78) {
        text.style.right = `${100 - width}%`;
        text.style.paddingRight = '10px';
        text.style.color = s.ink;
        text.querySelector('b').style.color = s.ink;
      } else {
        text.style.left = `calc(${width}% + 8px)`;
      }
      track.title = `${BUCKETS[i].id} (${BUCKETS[i].days}): ${fmt(s.dist[i])}% · ${amount(v)}`;
      track.append(lines, fill, text);
      row.append(label, track);
      rows.append(row);
    });

    const axisRow = mk('div', 'scn-axis');
    const scale = mk('div');
    ticks.forEach((t, i) => {
      const tick = mk('span', null, axis(t));
      if (i) tick.style.left = `${t / max * 100}%`;
      else tick.style.left = '0';
      if (i === ticks.length - 1) tick.style.transform = 'translateX(-100%)';
      scale.append(tick);
    });
    axisRow.append(mk('div'), scale);
    axisRow.firstChild.style.borderTop = '0';
    box.append(rows, axisRow);
    return box;
  }

  // ── карточки покрытия ───────────────────────────────────────────────────
  function tile({label, series, color, button, extra}) {
    const card = mk(button ? 'button' : 'div', 'scn-tile');
    if (button) card.type = 'button';
    const head = mk('div', 'scn-tile-label');
    head.append(mk('span', null, label));
    if (extra) head.append(extra);
    const row = mk('div', 'scn-tile-row');
    row.append(mk('span', 'scn-tile-value', `${fmt(last(series), 1)}%`), delta(series));
    const foot = mk('div', 'scn-tile-foot');
    foot.append(mk('span', null, MONTHS[0]), mk('span', null, last(MONTHS)));
    card.append(head, row, spark(series, color), foot);
    return card;
  }

  function subRow(label, series, color) {
    const li = mk('li');
    const head = mk('div', 'row-head');
    head.append(mk('span', null, label), mk('b', null, `${fmt(last(series), 1)}%`));
    const track = mk('div', 'scn-mini');
    const fill = mk('i');
    fill.style.width = `${Math.min(100, last(series))}%`;
    fill.style.background = color;
    track.append(fill);
    const meta = mk('div', 'row-meta');
    meta.append(delta(series));
    li.append(head, track, meta);
    return li;
  }

  function cards(s) {
    const box = mk('div', 'scn-cards');
    box.append(mk('div', 'scn-cards-title', 'Покрытие коммуникациями'));
    box.append(tile({label: 'Сервисные', series: s.service, color: 'var(--service)'}));

    // Промо = НС + Вклад: в синтетике предложения не пересекаются. На
    // реальных данных здесь нужен union из куба, а не сумма.
    const promo = s.promoNs.map((v, i) => v + s.promoDep[i]);
    const promoTile = tile({label: 'Промо', series: promo, color: 'var(--promo)', button: true,
      extra: mk('em', null, S.sankey ? 'Свернуть ←' : 'Раскрыть →')});
    promoTile.setAttribute('aria-expanded', String(S.sankey));
    promoTile.addEventListener('click', () => { S.sankey = !S.sankey; renderDetail(); });
    box.append(promoTile);

    const other = mk('div', 'scn-tile');
    const head = mk('div', 'scn-tile-label');
    head.append(mk('span', null, 'Промо других продуктов'));
    const rows = mk('ul', 'scn-sub');
    rows.append(subRow('Предлагаем ОМС', s.oms, 'var(--other)'),
      subRow('Предлагаем инвестиции', s.invest, 'var(--other)'));
    other.append(head, rows);
    box.append(other);
    return box;
  }

  // ── санки: отток сценария → промо / без промо → НС / Вклад ─────────────
  function sankey(s) {
    const box = mk('div', 'scn-sankey');
    const head = mk('div', 'scn-sankey-head');
    head.append(mk('b', null, 'Промо: что предлагаем'));
    const close = mk('button', 'scn-sankey-close', 'Свернуть');
    close.type = 'button';
    close.addEventListener('click', () => { S.sankey = false; renderDetail(); });
    head.append(close);
    box.append(head);

    const ns = last(s.promoNs), dep = last(s.promoDep);
    const promo = ns + dep, none = 100 - promo;
    const W = 300, H = 250, nw = 10, gap = 10, top = 10;
    const k = (H - top * 2 - gap) / 100;
    const root = svg('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': `Промо ${fmt(promo, 1)}%: НС ${fmt(ns, 1)}%, вклад ${fmt(dep, 1)}%; без промо ${fmt(none, 1)}%`});
    const x0 = 4, x1 = 128, x2 = W - 124;
    const pr = {y: top, h: promo * k};
    const no = {y: top + promo * k + gap, h: none * k};
    const nsN = {y: top, h: ns * k};
    const depN = {y: top + ns * k + gap, h: dep * k};

    const link = (xa, ya, ha, xb, yb, hb, color, opacity) => {
      const mx = (xa + xb) / 2;
      root.append(svg('path', {
        d: `M${xa},${ya} C${mx},${ya} ${mx},${yb} ${xb},${yb} L${xb},${yb + hb} `
          + `C${mx},${yb + hb} ${mx},${ya + ha} ${xa},${ya + ha} Z`,
        fill: color, 'fill-opacity': opacity,
      }));
    };
    link(x0 + nw, top, promo * k, x1, pr.y, pr.h, 'var(--promo)', .22);
    link(x0 + nw, top + promo * k + gap, none * k, x1, no.y, no.h, '#000', .06);
    link(x1 + nw, pr.y, ns * k, x2, nsN.y, nsN.h, '#4DA2F1', .3);
    link(x1 + nw, pr.y + ns * k, dep * k, x2, depN.y, depN.h, '#8AD554', .4);

    const node = (x, n, color) => root.append(svg('rect', {x, y: n.y, width: nw, height: Math.max(n.h, 1), rx: 2, fill: color}));
    node(x0, {y: top, h: H - top * 2}, s.color);
    node(x1, pr, 'var(--promo)');
    node(x1, no, 'rgba(0,0,0,.25)');
    node(x2, nsN, '#4DA2F1');
    node(x2, depN, '#8AD554');

    const text = (x, y, main, sub, anchor = 'start') => {
      const t = svg('text', {x, y, 'text-anchor': anchor, 'font-size': 11, fill: 'rgba(0,0,0,.8)'});
      const a = svg('tspan', {'font-weight': 600});
      a.textContent = main;
      const b = svg('tspan', {x, dy: 13, fill: 'rgba(0,0,0,.5)'});
      b.textContent = sub;
      t.append(a, b);
      root.append(t);
    };
    text(x1 - 6, pr.y + pr.h / 2 - 2, 'Промо', `${fmt(promo, 1)}%`, 'end');
    text(x1 - 6, no.y + no.h / 2 - 2, 'Без промо', `${fmt(none, 1)}%`, 'end');
    text(x2 + nw + 6, nsN.y + nsN.h / 2 - 2, 'Предлагаем НС', `${fmt(ns, 1)}% покрытия`);
    text(x2 + nw + 6, depN.y + depN.h / 2 - 2, 'Предлагаем Вклад', `${fmt(dep, 1)}% покрытия`);
    box.append(root);

    const rows = mk('ul', 'scn-sub');
    rows.append(subRow('Предлагаем НС', s.promoNs, '#4DA2F1'), subRow('Предлагаем Вклад', s.promoDep, '#8AD554'));
    box.append(rows, mk('div', 'scn-sankey-note',
      'Доли от клиентов сценария. В макете предложения НС и Вклада не пересекаются.'));
    return box;
  }

  // ── детализация ─────────────────────────────────────────────────────────
  function renderDetail() {
    const host = $('scnDetail');
    host.innerHTML = '';
    const s = SCENARIOS.find((x) => x.id === S.pick);
    if (!s) {
      host.append(mk('div', 'scn-empty',
        'Нажмите на сценарий в полосе или легенде — покажем, когда уходят деньги и чем их покрываем'));
      return;
    }
    const card = mk('section', 'card');
    const title = mk('div', 'scn-title');
    const dot = mk('i');
    dot.style.background = s.color;
    const share = s.share[S.measure];
    title.append(dot, mk('h2', null, s.name), mk('span', null, `${share}% оттока · ${amount(scenarioTotal(s))}`));
    card.append(title, mk('p', 'scn-about', s.about));

    const grid = mk('div', 'scn-grid' + (S.sankey ? ' is-open' : ''));
    const chart = mk('div');
    const head = mk('div', 'scn-chart-title', 'Отток по дням после пролонгации ');
    head.append(mk('span', null, money() ? '· оборот, млрд ₽' : '· клиенты'));
    chart.append(head, distribution(s),
      mk('div', 'scn-note', 'Распределение, не накопленный итог: каждая строка — отток только в своём интервале, в сумме 100% сценария.'));
    grid.append(chart, cards(s));
    if (S.sankey) grid.append(sankey(s));
    card.append(grid);
    host.append(card);
  }

  function render() {
    renderSwitch();
    renderBar();
    renderDetail();
    $('scnSub').textContent = `Куда уходят деньги из вкладов после пролонгации · ${S.period}`;
    $('scnNote').textContent = 'Доли сценариев, распределение по дням и покрытие — синтетика для согласования '
      + 'макета. Объём оттока — факт из книги метрик. Дельты покрытия — п.п. к предыдущему месяцу, '
      + 'микрочарт — последние 6 месяцев.';
  }

  // ── навигация ───────────────────────────────────────────────────────────
  const HASH = '#scenarios';
  const report = () => document.querySelector('main.content:not(#scenariosView)');

  function show(on) {
    $('scenariosView').hidden = !on;
    report().hidden = on;
    window.scrollTo(0, 0);
  }

  function open(view = {}) {
    if (view.measure && MEASURES.some((m) => m.id === view.measure)) S.measure = view.measure;
    if (view.period) S.period = view.period;
    S.total = {...DEFAULT_TOTAL, ...(view.total || {})};
    S.pick = null;
    S.sankey = false;
    render();
    show(true);
    if (location.hash !== HASH) history.pushState(null, '', HASH);
    $('scnBack').focus();
  }

  function close() {
    if (location.hash === HASH) history.back();
    else show(false);
  }

  $('scnBack').addEventListener('click', close);
  window.addEventListener('popstate', () => {
    if (location.hash !== HASH && !$('scenariosView').hidden) show(false);
    else if (location.hash === HASH && $('scenariosView').hidden && typeof openSheet === 'function') openSheet('scenarios');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || $('scenariosView').hidden) return;
    if (S.sankey) { S.sankey = false; renderDetail(); } else close();
  });

  return {open, close};
})();

// Ссылку с #scenarios открываем сразу на странице сценариев.
if (location.hash === '#scenarios') openSheet('scenarios');
</script>
