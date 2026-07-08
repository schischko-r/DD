#!/usr/bin/env python3
"""Build a standalone Data-Driven Index title page from a simple Excel list."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd


DEFAULT_INPUT = Path("Расчет_список(1).xlsx")
DEFAULT_SHEET = "титул"
DEFAULT_OUTPUT = Path("final_title_from_excel.html")

BASE_REQUIRED_COLUMNS = ("Юнит", "Продукт", "Оценка", "Группа")
TYPE_COLUMNS = ("type", "тип")
NAME_FIXES = {
    "Молодеж": "Молодежь",
}


def clean_text(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def clean_type(value: Any) -> str:
    entity_type = clean_text(value).lower()
    if entity_type in {"product", "продукт"}:
        return "продукт"
    if entity_type in {"segment", "сегмент"}:
        return "сегмент"
    return entity_type or "продукт"


def clean_name(value: Any) -> str:
    name = clean_text(value)
    return NAME_FIXES.get(name, name)


def score_to_percent(value: Any) -> int:
    score = pd.to_numeric(value, errors="coerce")
    if pd.isna(score):
        raise ValueError(f"Некорректная оценка: {value!r}")
    if score <= 1:
        score *= 100
    return max(0, min(100, int(round(float(score)))))


def read_rows(path: Path, sheet_name: str) -> list[dict[str, Any]]:
    if path.name.startswith("~$"):
        raise ValueError("Временный Excel-файл Office нельзя использовать как источник")

    try:
        df = pd.read_excel(path, sheet_name=sheet_name)
    except ValueError:
        upload_rows = read_rows_from_upload_workbook(path)
        if upload_rows is not None:
            return upload_rows
        raise
    type_column = next((column for column in TYPE_COLUMNS if column in df.columns), None)
    missing = [column for column in BASE_REQUIRED_COLUMNS if column not in df.columns]
    if type_column is None:
        missing.append("type/тип")
    if missing:
        raise ValueError("В Excel нет обязательных колонок: " + ", ".join(missing))

    required_columns = (*BASE_REQUIRED_COLUMNS, type_column)
    source = df.loc[:, required_columns].copy()
    nulls = {
        column: int(source[column].isna().sum())
        for column in required_columns
        if int(source[column].isna().sum())
    }
    if nulls:
        raise ValueError("В обязательных колонках есть пропуски: " + json.dumps(nulls, ensure_ascii=False))

    rows: list[dict[str, Any]] = []
    for order, row in source.iterrows():
        unit = clean_text(row["Юнит"])
        name = clean_name(row["Продукт"])
        group = clean_text(row["Группа"])
        entity_type = clean_type(row[type_column])
        if not unit or not name:
            continue
        rows.append(
            {
                "id": f"row-{len(rows) + 1}",
                "order": int(order),
                "unit": unit,
                "name": name,
                "score": score_to_percent(row["Оценка"]),
                "group": group,
                "type": entity_type,
            }
        )

    if not rows:
        raise ValueError("После очистки в Excel не осталось строк для отчета")
    return rows


def read_rows_from_upload_workbook(path: Path) -> list[dict[str, Any]] | None:
    try:
        from build_calc_report import (
            DEFAULT_DETAIL_SHEET,
            DEFAULT_PERIOD,
            DEFAULT_TITLE_SHEET,
            read_upload_workbook,
        )
    except Exception:
        return None

    upload_data = read_upload_workbook(
        path,
        DEFAULT_PERIOD,
        DEFAULT_TITLE_SHEET,
        DEFAULT_DETAIL_SHEET,
    )
    if upload_data is None:
        return None

    combined, _, _ = upload_data
    title_payload = combined.get("title") or {}
    rows = title_payload.get("rows") or []
    if not rows:
        return None
    return rows


def build_payload(rows: list[dict[str, Any]]) -> dict[str, Any]:
    units = sorted({row["unit"] for row in rows}, key=str.casefold)
    types = sorted({row["type"] for row in rows}, key=str.casefold)
    avg_score = round(sum(row["score"] for row in rows) / len(rows))
    return {
        "rows": rows,
        "units": units,
        "types": types,
        "avgScore": avg_score,
    }


HTML_TEMPLATE = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Data-Driven Index - титульная витрина</title>
  <style>
    :root {
      --bg: #f5f5f7;
      --surface: #fff;
      --ink: #1d1d1f;
      --muted: #86868b;
      --line: rgba(0,0,0,.08);
      --line-strong: rgba(0,0,0,.12);
      --blue: #007aff;
      --green: #34c759;
      --yellow: #ffcc00;
      --orange: #ff9500;
      --red: #ff3b30;
      --gray-dot: #c7c7cc;
    }

    * { box-sizing: border-box; }
    html { background: var(--bg); }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    button, select { font: inherit; }
    button { border: 0; }

    .app { min-height: 100vh; }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 16px 40px;
      background: rgba(255,255,255,.78);
      border-bottom: 1px solid var(--line);
      backdrop-filter: saturate(180%) blur(18px);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .brand-mark {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: linear-gradient(150deg,#2bb84a,#178a2c);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0;
      box-shadow: 0 6px 16px rgba(23,138,44,.22);
    }

    .brand-title { min-width: 0; }

    .brand-title strong {
      display: block;
      overflow: hidden;
      font-size: 15px;
      letter-spacing: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .brand-title span {
      display: block;
      margin-top: 2px;
      overflow: hidden;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .top-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 7px 13px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #fff;
      color: #6e6e73;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0;
      white-space: nowrap;
    }

    .page {
      width: min(1180px, calc(100vw - 56px));
      margin: 0 auto;
      padding: 34px 0 76px;
    }

    .hero {
      display: grid;
      grid-template-columns: 1.3fr .7fr;
      gap: 24px;
      align-items: end;
      margin-bottom: 26px;
    }

    .hero h1 {
      margin: 0;
      max-width: 720px;
      color: var(--ink);
      font-size: 42px;
      line-height: 1.04;
      font-weight: 760;
      letter-spacing: 0;
    }

    .hero p {
      margin: 12px 0 0;
      max-width: 740px;
      color: #6e6e73;
      font-size: 16px;
      line-height: 1.45;
      letter-spacing: 0;
    }

    .hero-stat-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .hero-stat {
      min-width: 0;
      padding: 14px 14px 13px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
    }

    .hero-stat b {
      display: block;
      font-size: 28px;
      line-height: 1;
      font-weight: 760;
      letter-spacing: 0;
    }

    .hero-stat span {
      display: block;
      margin-top: 7px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
    }

    .toolbar-controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .filter-wrap {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 36px;
      padding: 3px 5px 3px 11px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fff;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .filter-wrap select {
      min-width: 132px;
      min-height: 28px;
      border: 0;
      border-radius: 8px;
      outline: none;
      background: #f5f5f7;
      color: var(--ink);
      cursor: pointer;
      font-size: 13px;
      font-weight: 650;
      letter-spacing: 0;
      text-transform: none;
    }

    .segmented {
      display: inline-flex;
      gap: 3px;
      padding: 3px;
      border-radius: 10px;
      background: #e9e9eb;
    }

    .segmented button {
      min-height: 30px;
      padding: 6px 12px;
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 13px;
      font-weight: 650;
      letter-spacing: 0;
    }

    .segmented button.active {
      background: #fff;
      color: var(--ink);
      box-shadow: 0 1px 3px rgba(0,0,0,.12);
    }

    .caption {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .02em;
      text-transform: uppercase;
    }

    .message {
      margin: 18px 0 0;
      padding: 18px 20px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      color: #6e6e73;
      font-size: 14px;
      font-weight: 650;
    }

    .table {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 18px 40px -24px rgba(0,0,0,.16);
    }

    .table-head,
    .product-row {
      display: grid;
      grid-template-columns: minmax(240px, 1.5fr) minmax(150px, .7fr) minmax(150px, .7fr) minmax(120px, .45fr);
      align-items: center;
      column-gap: 18px;
      padding: 0 28px;
    }

    .table-head {
      min-height: 46px;
      border-bottom: 1px solid var(--line);
      background: #fcfcfe;
      color: #86868b;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .05em;
      text-transform: uppercase;
    }

    .table-head > div { text-align: center; }
    .table-head > div:first-child { text-align: left; }

    .unit-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 13px 28px;
      border-top: 1px solid var(--line);
      background: #fbfbfd;
    }

    .unit-row.first { border-top: 0; }

    .unit-name {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
    }

    .unit-dot {
      width: 9px;
      height: 9px;
      flex: none;
      border-radius: 999px;
    }

    .unit-name b {
      min-width: 0;
      overflow: hidden;
      color: var(--ink);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .unit-name span,
    .unit-avg {
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0;
      white-space: nowrap;
    }

    .unit-count {
      flex: none;
    }

    .unit-row.hide-unit-count .unit-count {
      display: none;
    }

    .unit-row.hide-unit-count .unit-avg-label {
      display: none;
    }

    .unit-avg b {
      color: var(--ink);
      font-size: 14px;
      letter-spacing: 0;
    }

    .product-row {
      min-height: 88px;
      border-top: 1px solid var(--line);
      justify-items: center;
      transition: background .18s ease;
    }

    .product-row:hover { background: #f7f8fa; }

    .product-name {
      justify-self: stretch;
      min-width: 0;
    }

    .product-name b {
      display: block;
      overflow: hidden;
      color: var(--ink);
      font-size: 16px;
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .product-name span {
      display: block;
      margin-bottom: 4px;
      color: #a1a1a6;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .02em;
      text-transform: uppercase;
    }

    .dd-cell {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      justify-items: center;
      align-content: center;
      row-gap: 6px;
      width: 176px;
      min-height: 56px;
      padding: 6px 12px;
      border-radius: 14px;
      background: transparent;
    }

    .status-label {
      grid-column: 1;
      grid-row: 2;
      justify-self: center;
      max-width: 100%;
      overflow: hidden;
      font-size: 11px;
      font-weight: 650;
      line-height: 1.15;
      letter-spacing: .01em;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .score-label {
      grid-column: 1;
      grid-row: 1;
      justify-self: center;
      color: currentColor;
      font-size: 30px;
      font-weight: 780;
      line-height: 1;
      letter-spacing: 0;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .progress {
      grid-column: 1;
      grid-row: 3;
      width: 100%;
      max-width: 148px;
      height: 6px;
      justify-self: center;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(0,0,0,.07);
    }

    .progress i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: currentColor;
      transition: width .5s cubic-bezier(.2,.8,.2,1);
    }

    .group-cell {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      min-height: 30px;
      padding: 6px 11px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 12%, white);
      color: #6e6e73;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.15;
      text-align: center;
      white-space: normal;
    }

    .go-cell {
      display: flex;
      justify-self: center;
      justify-content: center;
    }

    .go-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(142,142,147,.14);
      color: #8e8e93;
      cursor: not-allowed;
      font-size: 13px;
      font-weight: 650;
      line-height: 1.1;
      white-space: nowrap;
    }

    .hidden { display: none !important; }

    @media (max-width: 900px) {
      .topbar { padding: 14px 20px; }
      .page {
        width: min(100% - 28px, 1180px);
        padding-top: 22px;
      }
      .hero {
        grid-template-columns: 1fr;
        align-items: start;
      }
      .hero h1 { font-size: 34px; }
      .toolbar {
        align-items: flex-start;
        flex-direction: column;
      }
      .toolbar-controls {
        justify-content: flex-start;
        width: 100%;
      }
      .unit-row {
        gap: 12px;
        padding: 13px 18px;
      }
      .table-head { display: none; }
      .product-row {
        grid-template-columns: 1fr;
        justify-items: stretch;
        row-gap: 14px;
        padding: 18px 18px;
      }
      .dd-cell {
        justify-items: start;
        width: min(100%, 240px);
        padding-left: 0;
      }
      .status-label,
      .score-label,
      .progress {
        justify-self: start;
        text-align: left;
      }
      .group-cell {
        justify-content: flex-start;
        width: fit-content;
      }
      .go-cell {
        justify-self: start;
        justify-content: flex-start;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">Data</div>
        <div class="brand-title">
          <strong>Data-Driven Index</strong>
          <span>Титульная витрина</span>
        </div>
      </div>
      <div class="top-actions">
        <span class="pill" id="periodPill">Расчетный список</span>
      </div>
    </header>

    <main class="page">
      <section id="titleView">
        <div class="hero">
          <div>
            <h1>Data-Driven Index</h1>
          </div>
          <div class="hero-stat-grid">
            <div class="hero-stat"><b id="statProducts">0</b><span>команд</span></div>
            <div class="hero-stat"><b id="statUnits">0</b><span>юнитов</span></div>
            <div class="hero-stat"><b id="statAvg">0%</b><span>средний Data-Driven Index</span></div>
          </div>
        </div>

        <div class="toolbar">
          <div class="caption">Продукты, сегменты и Data-Driven Index</div>
          <div class="toolbar-controls">
            <label class="filter-wrap">Юнит <select id="unitFilter"></select></label>
            <label class="filter-wrap">Тип <select id="typeFilter"></select></label>
            <div class="segmented" role="group" aria-label="Сортировка">
              <button id="sortUnitBtn" type="button" class="active">По юнитам</button>
              <button id="sortIndexBtn" type="button">По Data-Driven Index</button>
            </div>
          </div>
        </div>

        <div id="titleMessage" class="message hidden"></div>
        <div id="productTable" class="table hidden"></div>
      </section>
    </main>
  </div>

  <script id="data-driven-title-data" type="application/json">
__DATA_JSON__
  </script>
  <script>
    const $ = (id) => document.getElementById(id);
    const MODEL = JSON.parse($('data-driven-title-data').textContent);
    const UNIT_COLORS = {
      'CBP': '#007aff',
      'PC': '#007aff',
      'ДомКлик': '#007aff',
      'УБ': '#007aff',
      'СХ': '#007aff',
      'DB': '#007aff',
      'default': '#007aff',
    };
    const state = {
      sort: 'unit',
      unit: 'all',
      type: 'all',
    };

    function esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[ch]));
    }

    function compareText(a, b) {
      return String(a || '').localeCompare(String(b || ''), 'ru', { sensitivity: 'base' });
    }

    function normalizeGroup(group) {
      return String(group || '').trim().replace(/\\s+/g, ' ').toLowerCase();
    }

    function groupTheme(group) {
      const normalized = normalizeGroup(group);
      if (normalized === 'требуют внимания') {
        return { accent: '#f3a6a0', text: '#9f2a25', bg: '#fff1f0', border: '#f5c2bd' };
      }
      if (normalized === 'развивающиеся') {
        return { accent: '#f4b183', text: '#9a4a16', bg: '#fff4e8', border: '#f7cfaa' };
      }
      if (normalized === 'зрелые') {
        return { accent: '#e8c46a', text: '#7a5a10', bg: '#fff8df', border: '#efd98d' };
      }
      if (normalized === 'лидеры') {
        return { accent: '#8fd6b0', text: '#1f7a4d', bg: '#eefaf3', border: '#bde8cf' };
      }
      return { accent: '#c7c7cc', text: '#6e6e73', bg: '#f5f5f7', border: '#d1d1d6' };
    }

    function averageGroup(rows) {
      if (!rows.length) return '';
      const rank = {
        'требуют внимания': 1,
        'развивающиеся': 2,
        'зрелые': 3,
        'лидеры': 4,
      };
      const labels = {
        1: 'Требуют внимания',
        2: 'Развивающиеся',
        3: 'Зрелые',
        4: 'Лидеры',
      };
      const avg = Math.round(rows.reduce((sum, row) => sum + (rank[normalizeGroup(row.group)] || 0), 0) / rows.length);
      return labels[avg] || '';
    }

    function pluralTeam(n) {
      const m = n % 10;
      const h = n % 100;
      if (m === 1 && h !== 11) return 'команда';
      if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return 'команды';
      return 'команд';
    }

    function filteredRows() {
      return MODEL.rows.filter((row) => {
        const unitOk = state.unit === 'all' || row.unit === state.unit;
        const typeOk = state.type === 'all' || row.type === state.type;
        return unitOk && typeOk;
      });
    }

    function sortedRows(rows) {
      const copy = [...rows];
      if (state.sort === 'index') {
        return copy.sort((a, b) => (b.score - a.score) || compareText(a.name, b.name));
      }
      return copy.sort((a, b) => compareText(a.unit, b.unit) || compareText(a.name, b.name));
    }

    function avgScore(rows) {
      if (!rows.length) return 0;
      return Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length);
    }

    function renderFilters() {
      $('unitFilter').innerHTML = [
        '<option value="all">Все юниты</option>',
        ...MODEL.units.map((unit) => `<option value="${esc(unit)}">${esc(unit)}</option>`),
      ].join('');
      $('typeFilter').innerHTML = [
        '<option value="all">Все типы</option>',
        ...MODEL.types.map((type) => `<option value="${esc(type)}">${esc(type)}</option>`),
      ].join('');
    }

    function renderStats(rows) {
      const units = new Set(rows.map((row) => row.unit));
      $('statProducts').textContent = rows.length;
      $('statUnits').textContent = units.size;
      $('statAvg').textContent = avgScore(rows) + '%';
    }

    function tableHeadHTML() {
      return `
        <div class="table-head">
          <div>Продукт / сегмент</div>
          <div>Data-Driven Index</div>
          <div>Группа</div>
          <div>Действие</div>
        </div>
      `;
    }

    function unitRowHTML(unit, rows, isFirst) {
      const color = UNIT_COLORS[unit] || UNIT_COLORS.default;
      const avg = avgScore(rows);
      const avgGroup = averageGroup(rows);
      return `
        <div class="unit-row ${isFirst ? 'first' : ''}">
          <div class="unit-name">
            <i class="unit-dot" style="background:${color}"></i>
            <b>${esc(unit)}</b>
            <span class="unit-count">${rows.length} ${pluralTeam(rows.length)}</span>
          </div>
          <div class="unit-avg"><span class="unit-avg-label">средний Data-Driven Index</span> <b style="color:${groupTheme(avgGroup).text}">${avg}%</b></div>
        </div>
      `;
    }

    function fitUnitHeaders() {
      const narrow = window.matchMedia('(max-width: 900px)').matches;
      document.querySelectorAll('.unit-row').forEach((row) => {
        const name = row.querySelector('.unit-name b');
        row.classList.remove('hide-unit-count');
        if (!narrow || !name) return;
        if (name.scrollWidth > name.clientWidth + 1) {
          row.classList.add('hide-unit-count');
        }
      });
    }

    function productRowHTML(row, showUnit) {
      const group = row.group || 'Без группы';
      const theme = groupTheme(group);
      const subline = showUnit ? `${row.unit} · ${row.type}` : row.type;
      return `
        <div class="product-row">
          <div class="product-name">
            <span>${esc(subline)}</span>
            <b title="${esc(row.name)}">${esc(row.name)}</b>
          </div>
          <div class="dd-cell" style="color:${theme.accent}">
            <span class="status-label" style="color:${theme.text}">${esc(group)}</span>
            <span class="score-label">${row.score}%</span>
            <span class="progress"><i style="width:${row.score}%"></i></span>
          </div>
          <div class="group-cell" style="color:${theme.text};background:${theme.bg};border-color:${theme.border}">${esc(group)}</div>
          <div class="go-cell">
            <button type="button" class="go-button" disabled>Перейти</button>
          </div>
        </div>
      `;
    }

    function renderTable() {
      const rows = filteredRows();
      const sorted = sortedRows(rows);
      const table = $('productTable');
      const message = $('titleMessage');
      renderStats(rows);

      if (!sorted.length) {
        table.classList.add('hidden');
        message.classList.remove('hidden');
        message.textContent = 'Нет данных по выбранным фильтрам';
        return;
      }

      message.classList.add('hidden');
      table.classList.remove('hidden');

      if (state.sort === 'index') {
        table.innerHTML = tableHeadHTML() + sorted.map((row) => productRowHTML(row, true)).join('');
        fitUnitHeaders();
        return;
      }

      const chunks = [];
      const units = [...new Set(sorted.map((row) => row.unit))];
      units.forEach((unit, index) => {
        const unitRows = sorted.filter((row) => row.unit === unit);
        chunks.push(unitRowHTML(unit, unitRows, index === 0));
        unitRows.forEach((row) => chunks.push(productRowHTML(row, false)));
      });
      table.innerHTML = tableHeadHTML() + chunks.join('');
      fitUnitHeaders();
    }

    function setSort(sort) {
      state.sort = sort;
      $('sortUnitBtn').classList.toggle('active', sort === 'unit');
      $('sortIndexBtn').classList.toggle('active', sort === 'index');
      renderTable();
    }

    function init() {
      renderFilters();
      $('unitFilter').addEventListener('change', (event) => {
        state.unit = event.target.value;
        renderTable();
      });
      $('typeFilter').addEventListener('change', (event) => {
        state.type = event.target.value;
        renderTable();
      });
      $('sortUnitBtn').addEventListener('click', () => setSort('unit'));
      $('sortIndexBtn').addEventListener('click', () => setSort('index'));
      window.addEventListener('resize', fitUnitHeaders);
      renderTable();
    }

    init();
  </script>
</body>
</html>
"""


def build_html(payload: dict[str, Any]) -> str:
    data_json = json.dumps(payload, ensure_ascii=False, indent=2).replace("</", "<\\/")
    return HTML_TEMPLATE.replace("__DATA_JSON__", data_json)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate standalone Data-Driven Index title page from Расчет_список.xlsx")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Path to source .xlsx")
    parser.add_argument("--sheet", default=DEFAULT_SHEET, help="Sheet name")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output standalone HTML path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = read_rows(args.input, args.sheet)
    payload = build_payload(rows)
    args.output.write_text(build_html(payload), encoding="utf-8")

    summary = {
        "html": str(args.output),
        "rows": len(rows),
        "units": len(payload["units"]),
        "types": len(payload["types"]),
        "missing_required_values": 0,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
