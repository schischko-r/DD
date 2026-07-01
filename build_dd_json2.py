#!/usr/bin/env python3
"""Build nested dd-data2.json and the embedded final_report_v2.html."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
SOURCE_JSON = ROOT / "dd-data.json"
OUTPUT_JSON = ROOT / "dd-data2.json"
SOURCE_HTML = ROOT / "final_report.html"
OUTPUT_HTML = ROOT / "final_report_v2.html"
OUTPUT_STANDALONE_HTML = ROOT / "final_report_standalone.html"
DEFAULT_ENTITY_TYPE = "Продукт"


BLOCKS: list[dict[str, Any]] = [
    {
        "code": "general",
        "name": "Самооценка знания продуктовых метрик",
        "tools": [
            {
                "name": "Ключевые метрики",
                "footer": "Общий светофор",
                "button": "Перейти",
                "traffic_metric": "general_traffic_light",
            }
        ],
        "metrics": [
            {
                "code": "general.market_ru",
                "name": "Объем целевого рынка в России",
                "footer": "Оценка потенциала рынка в России",
                "max_value": 0.2,
                "group": "Знание собственных метрик",
            },
            {
                "code": "general.market_sber",
                "name": "Объем целевого рынка в Сбере",
                "footer": "Оценка потенциала внутри клиентской базы Сбера",
                "max_value": 0.2,
                "group": "Знание собственных метрик",
            },
            {
                "code": "general.clients_with_product",
                "name": "Клиенты с продуктом",
                "footer": "Фактическая база клиентов продукта",
                "max_value": 0.2,
                "group": "Знание собственных метрик",
            },
            {
                "code": "general.product_mau",
                "name": "MAU продукта",
                "footer": "Активная месячная аудитория продукта",
                "max_value": 0.2,
                "group": "Знание собственных метрик",
            },
            {
                "code": "general.satellite_products_knowledge",
                "name": "Знание продуктов спутников",
                "footer": "Понимание связанных продуктов и сценариев",
                "max_value": 0.2,
                "group": "Знание собственных метрик",
            },
            {
                "code": "general.navigator_reporting_knowledge",
                "name": "Знание об отчетности в Навигаторе",
                "footer": "Понимание доступной отчетности и регулярного мониторинга",
                "max_value": 0.5,
                "group": "Инструменты мониторинга",
            },
        ],
    },
    {
        "code": "goals",
        "name": "Цели",
        "tools": [
            {
                "name": "Цели",
                "footer_dynamic": "green_count",
                "button": "Перейти",
                "traffic_metric": "goals_traffic_light",
            }
        ],
        "metrics": [
            {
                "code": "goals.monitored",
                "name": "Цели выведены на мониторинг",
                "footer": "Регулярное обновление, Навигатор",
                "max_value": 1,
                "link_types": ["navigator"],
            },
            {
                "code": "goals.factor_analysis_l1_l2",
                "name": "Факторный анализ - драйверы 1-2 ур.",
                "footer": "Согласно модели бизнес-процесса",
                "max_value": 1,
            },
            {
                "code": "goals.forecast",
                "name": "Прогноз по целям",
                "footer": "Прогноз выведен в Навигатор",
                "max_value": 1,
            },
        ],
    },
    {
        "code": "alerts",
        "name": "Алерты",
        "tools": [
            {
                "name": "Инструкция",
                "footer": "по настройке алертов по отчету",
                "button": "Перейти",
                "traffic_metric": "alerts_traffic_light",
                "variant": "blue",
            }
        ],
        "metrics": [
            {
                "code": "alerts.system_failures",
                "name": "Оповещения по системным сбоям",
                "footer": "Авто-алерты по IT-инфраструктуре",
                "max_value": 1,
            },
            {
                "code": "alerts.business_metrics",
                "name": "Оповещения по бизнес-метрикам",
                "footer": "Светофоры целей, драйверов, воронок",
                "max_value": 1,
            },
        ],
    },
    {
        "code": "cx",
        "name": "Клиентский опыт",
        "tools": [
            {
                "name": "Анализ Score",
                "footer": "Жалобы, обращения, CSI",
                "button": "Перейти",
                "traffic_metric": "cx_traffic_light",
            }
        ],
        "info": {
            "type": "losshunter",
            "count_metric": "cx_losshunter_analytics_count",
            "title": "аналитики в LossHunter",
            "footer": "проведено за квартал по продукту",
        },
        "metrics": [
            {
                "code": "cx.product_mechanics",
                "name": "Наличие продуктовых механик",
                "footer": "Механики, влияющие на клиентский опыт",
                "max_value": 1,
            },
            {
                "code": "cx.score",
                "name": "CX Score",
                "footer": "Зеленая зона клиентского пути",
                "max_value": 1,
            },
        ],
    },
    {
        "code": "attract",
        "name": "Воронка привлечения",
        "tools": [
            {
                "name": "Привлечение",
                "footer": "Общий светофор",
                "button": "Перейти",
                "traffic_metric": "attract_traffic_light",
            }
        ],
        "metrics": [
            {
                "code": "attract.regular_reporting",
                "name": "Регулярная отчетность",
                "footer": "Настроена по воронке",
                "max_value": 0.5,
                "group": "Отчетность",
                "link_types": ["campaigning", "drafts", "pilot_campaigns"],
            },
            {
                "code": "attract.report_completeness",
                "name": "Полнота отчета",
                "footer": "Источники, CR, объемы, сегменты",
                "max_value": 0.5,
                "group": "Отчетность",
                "link_types": ["campaigning", "drafts", "pilot_campaigns"],
            },
            {
                "code": "attract.auto_regularity",
                "name": "Регулярность (авто)",
                "footer": "Daily / weekly",
                "max_value": 1,
                "group": "Отчетность",
                "excluded_from_index": True,
                "link_types": ["campaigning", "drafts", "pilot_campaigns"],
            },
            {
                "code": "attract.benchmarks",
                "name": "Наличие бенчмарков",
                "footer": "Цели / динамика / рынок",
                "max_value": 1,
            },
            {
                "code": "attract.cross_sell",
                "name": "Cross-sell",
                "footer": "В оформлении и после покупки",
                "max_value": 1,
            },
            {
                "code": "attract.funnel_analysis",
                "name": "Проведение анализа воронки привлечения",
                "footer": "Оценка эффективности",
                "max_value": 0.25,
            },
            {
                "code": "attract.initiatives_list",
                "name": "Составлен перечень инициатив по привлечению",
                "footer": "План действий по росту",
                "max_value": 0.25,
            },
            {
                "code": "attract.drafts_70",
                "name": "Черновики в СБОЛ >=70%",
                "footer": "Покрытие потенциала продукта",
                "max_value": 1,
                "link_types": ["drafts"],
            },
            {
                "code": "attract.campaign_launches",
                "name": "Запуски кампаний за квартал",
                "footer": "Self-service / централизованный, покрытие",
                "max_value": 1,
                "link_types": ["campaigning", "pilot_campaigns"],
                "zero_button": "Запустить первый пилот Self-Service",
            },
        ],
    },
    {
        "code": "churn",
        "name": "Воронка оттока",
        "tools": [
            {
                "name": "Анализ оттока",
                "footer": "Общий светофор",
                "button": "TBD",
                "traffic_metric": "churn_traffic_light",
                "variant": "gray",
            }
        ],
        "metrics": [
            {
                "code": "churn.regular_reporting",
                "name": "Регулярная отчетность",
                "footer": "Настроена по воронке",
                "max_value": 0.5,
                "group": "Отчетность",
                "link_types": ["churn"],
            },
            {
                "code": "churn.report_completeness",
                "name": "Полнота отчета",
                "footer": "Retention, CR, удержание",
                "max_value": 0.5,
                "group": "Отчетность",
                "link_types": ["churn"],
            },
            {
                "code": "churn.auto_regularity",
                "name": "Регулярность (авто)",
                "footer": "Daily / weekly",
                "max_value": 1,
                "group": "Отчетность",
                "excluded_from_index": True,
                "link_types": ["churn"],
            },
            {
                "code": "churn.funnel_analysis",
                "name": "Проведение анализа воронки оттока",
                "footer": "Оценка причин и узких мест",
                "max_value": 0.25,
            },
            {
                "code": "churn.deviation_actions",
                "name": "Мероприятия по работе с отклонениями",
                "footer": "План действий по отклонениям",
                "max_value": 0.25,
            },
            {
                "code": "churn.mechanics_metrics_knowledge",
                "name": "Знание метрик для мониторинга механик",
                "footer": "Понимание метрик эффективности механик",
                "max_value": 1,
            },
            {
                "code": "churn.client_retention",
                "name": "Удержание клиентов",
                "footer": "Коммуникация + ценность",
                "max_value": 1,
            },
            {
                "code": "churn.client_return",
                "name": "Возврат клиентов",
                "footer": "Активная механика за квартал",
                "max_value": 1,
            },
            {
                "code": "churn.flexible_terms",
                "name": "Гибкое изменение условий",
                "footer": "Персонализация без IT",
                "max_value": 1,
            },
            {
                "code": "churn.benchmarks",
                "name": "Наличие бенчмарков",
                "footer": "Цели / динамика / рынок",
                "max_value": 1,
            },
        ],
    },
    {
        "code": "hyp",
        "name": "Гипотезы и инициативы",
        "tools": [],
        "metrics": [
            {
                "code": "hyp.discovery_40_backlog",
                "name": "Discovery >=40% бэклога",
                "footer": "Доля исследовательских задач DA",
                "max_value": 1,
                "button": "Посмотреть бэклог",
            },
            {
                "code": "hyp.ab_tests",
                "name": "A/B-тесты",
                "footer": "Доля от подходящих инициатив",
                "max_value": 1,
                "tbd": True,
            },
            {
                "code": "hyp.datadriven_rating_7_5",
                "name": "Рейтинг DataDriven >=7,5",
                "footer": "Среднее место за квартал",
                "max_value": 1,
                "button": "Открыть библиотеку решений",
            },
            {
                "code": "hyp.extra_initiatives",
                "name": "Доп. инициативы сверх БП",
                "footer": "В реестре инициатив",
                "max_value": 1,
            },
        ],
    },
]


EXTRA_CSS = """

    .block-note {
      gap: 12px;
      margin-bottom: 14px;
      padding: 11px 13px;
      border-radius: 12px;
      border-color: rgba(0,122,255,.18);
      background: #eef5ff;
    }

    .block-note.tool-group {
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      padding: 10px 12px;
    }

    .note-copy {
      display: flex;
      align-items: center;
      gap: 11px;
      min-width: 0;
    }

    .note-badge {
      flex: none;
      min-width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: rgba(0,122,255,.12);
      color: #0066cc;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0;
    }

    .block-note.blue .note-badge {
      background: rgba(0,122,255,.12);
      color: #0066cc;
    }

    .note-badge.instruction {
      background: rgba(0,122,255,.12);
      color: #0066cc;
      font-family: Georgia, serif;
      font-style: italic;
      font-size: 14px;
      font-weight: 700;
    }

    .block-note.gray .note-badge {
      background: #fff;
      color: #8e8e93;
    }

    .block-note .note-metric {
      color: #0066cc;
    }

    .note-action {
      border-color: rgba(0,122,255,.22);
      background: #fff;
      color: var(--blue);
    }

    .block-note.gray .note-metric {
      color: #6e6e73;
    }

    .block-note.gray .note-action {
      border-color: rgba(0,0,0,.16);
      background: #fff;
      color: #8e8e93;
    }

    body.report-modal-open {
      overflow: hidden;
    }

    .report-action-wrap {
      margin-bottom: 16px;
    }

    .report-action-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-width: 0;
      padding: 14px 16px;
      border: 1px solid rgba(0,0,0,.06);
      border-radius: 18px;
      background: rgba(255,255,255,.86);
      box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 14px 30px -24px rgba(0,0,0,.18);
      backdrop-filter: saturate(180%) blur(18px);
    }

    .report-action-copy {
      min-width: 0;
    }

    .report-action-copy b {
      display: block;
      color: var(--ink);
      font-size: 13.5px;
      font-weight: 760;
      line-height: 1.25;
      letter-spacing: -.01em;
    }

    .report-action-copy span {
      display: block;
      margin-top: 3px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
      letter-spacing: -.01em;
    }

    .report-action-buttons,
    .report-modal-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
      flex: none;
    }

    .report-action-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 8px 14px;
      border: 1px solid transparent;
      border-radius: 999px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -.01em;
      text-decoration: none;
      white-space: nowrap;
      transition: background .16s ease, transform .12s ease;
    }

    .report-action-button.primary {
      border-color: rgba(0,122,255,.18);
      background: rgba(0,122,255,.12);
      color: var(--blue);
    }

    .report-action-button.secondary {
      border-color: rgba(0,0,0,.08);
      background: #fff;
      color: #3a3a3c;
    }

    .report-action-button.danger {
      border-color: rgba(255,59,48,.24);
      background: rgba(255,59,48,.10);
      color: #d70015;
    }

    .report-action-button:hover {
      transform: translateY(-1px);
    }

    .report-action-button.primary:hover {
      background: rgba(0,122,255,.18);
    }

    .report-action-button.secondary:hover {
      background: #f5f5f7;
    }

    .report-action-button.danger:hover {
      background: rgba(255,59,48,.16);
    }

    .report-modal {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .report-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(29,29,31,.34);
      backdrop-filter: blur(10px);
    }

    .report-modal-card {
      position: relative;
      z-index: 1;
      width: min(100%, 560px);
      padding: 24px;
      border: 1px solid rgba(0,0,0,.08);
      border-radius: 22px;
      background: rgba(255,255,255,.96);
      box-shadow: 0 24px 70px -32px rgba(0,0,0,.45);
    }

    .report-modal-close {
      position: absolute;
      top: 14px;
      right: 14px;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: #f2f2f7;
      color: #6e6e73;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
    }

    .report-modal-close:hover {
      background: #e8e8ed;
    }

    .report-modal-kicker {
      color: var(--blue);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .04em;
      text-transform: uppercase;
    }

    .report-modal-card h2 {
      margin: 7px 42px 14px 0;
      color: var(--ink);
      font-size: 24px;
      line-height: 1.1;
      font-weight: 780;
      letter-spacing: -.02em;
    }

    .report-modal-text {
      color: #3a3a3c;
      font-size: 14px;
      line-height: 1.48;
      letter-spacing: -.01em;
    }

    .report-modal-text p {
      margin: 0 0 9px;
    }

    .report-modal-actions {
      justify-content: flex-start;
      margin-top: 18px;
    }

    .tool-items {
      display: grid;
      gap: 6px;
      padding-top: 6px;
    }

    .tool-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 9px;
      min-width: 0;
      padding-top: 7px;
      border-top: 1px solid rgba(0,122,255,.14);
    }

    .tool-light {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #d1d1d6;
    }

    .tool-item-copy {
      min-width: 0;
    }

    .tool-item-name {
      overflow: hidden;
      color: var(--ink);
      font-size: 13px;
      font-weight: 760;
      line-height: 1.2;
      letter-spacing: -.01em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tool-stage {
      display: block;
      margin-bottom: 2px;
      color: #0066cc;
      font-size: 10.5px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: .03em;
      text-transform: uppercase;
    }

    .tool-item-footer {
      margin-top: 2px;
      color: #0066cc;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.25;
      letter-spacing: -.01em;
    }

    .block-advisory {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      margin: 0 0 12px;
      padding: 13px 14px;
      border: 1px solid rgba(0,122,255,.14);
      border-radius: 14px;
      background: #eef5ff;
    }

    .block-advisory-badge {
      width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: rgba(0,122,255,.12);
      color: #0066cc;
      font-family: Georgia, serif;
      font-style: italic;
      font-size: 14px;
      font-weight: 700;
    }

    .block-advisory-text {
      color: #335f91;
      font-size: 13px;
      font-weight: 650;
      line-height: 1.35;
      letter-spacing: -.01em;
    }

    .block-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      padding-top: 13px;
      border-top: 1px solid rgba(0,0,0,.07);
    }

    .block-actions .data-link {
      min-height: 32px;
      padding: 8px 14px;
      border: 1px solid rgba(0,122,255,.18);
      border-radius: 999px;
      background: rgba(0,122,255,.10);
      color: var(--blue);
      font-size: 12px;
      font-weight: 760;
      line-height: 1.2;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.62);
    }

    .block-actions .data-link:hover {
      background: rgba(0,122,255,.16);
      text-decoration: none;
    }

    a.metric-button,
    .block-infobox a.metric-button {
      border-color: rgba(0,122,255,.22);
      border-radius: 999px;
      background: rgba(0,122,255,.08);
      color: var(--blue);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
    }

    a.metric-button:hover,
    .block-infobox a.metric-button:hover {
      background: rgba(0,122,255,.14);
    }

    .block-infobox {
      border-color: rgba(0,122,255,.12);
      background: #eef5ff;
    }

    .block-infobox .info-count,
    .block-infobox .info-text b {
      color: #0066cc;
    }

    .block-infobox .info-text span {
      color: #6e8bb3;
    }

    .tool-footer,
    .tool-links,
    .criterion-links {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
    }

    .tool-footer,
    .tool-links {
      padding-top: 2px;
    }

    .criterion-links {
      grid-column: 2 / -1;
      margin-top: 2px;
    }

    .criterion-extra {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: 7px;
      min-width: 0;
    }

    .criterion-extra .metric-button {
      min-height: 28px;
      padding: 6px 11px;
    }

    .data-link {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 6px 10px;
      border-radius: 9px;
      border: 1px solid rgba(0,122,255,.18);
      background: rgba(0,122,255,.08);
      color: var(--blue);
      font-size: 12px;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -.01em;
      text-decoration: none;
      white-space: nowrap;
    }

    a.note-action,
    a.metric-button {
      text-decoration: none;
    }

    .data-link:hover {
      background: rgba(0,122,255,.14);
    }

    .criterion-points {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 76px;
      min-height: 28px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 12px;
      font-weight: 760;
      line-height: 1;
      letter-spacing: -.01em;
    }

    .criterion-points.green {
      border-color: rgba(52,199,89,.24);
      background: rgba(52,199,89,.12);
      color: #248a3d;
    }

    .criterion-points.yellow {
      border-color: rgba(255,204,0,.34);
      background: rgba(255,204,0,.18);
      color: #8a6d1f;
    }

    .criterion-points.red {
      border-color: rgba(255,59,48,.22);
      background: rgba(255,59,48,.10);
      color: #c2252b;
    }

    .criterion-points.gray {
      border-color: rgba(0,0,0,.08);
      background: #f2f2f7;
      color: #8e8e93;
    }

    .product-name .entity-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 5px;
      margin-bottom: 0;
    }

    .product-name .entity-unit {
      display: inline-flex;
      margin: 0;
      color: #a1a1a6;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .02em;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .product-name .entity-type {
      display: inline-flex;
      align-items: center;
      min-height: 20px;
      margin: 0;
      padding: 3px 9px;
      border: 1px solid var(--line-strong);
      border-radius: 999px;
      background: #f5f5f7;
      color: #6e6e73;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0;
      line-height: 1;
      text-transform: none;
    }

    .detail-subline {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }

    .detail-entity-type {
      display: inline-flex;
      align-items: center;
      min-height: 21px;
      padding: 4px 9px;
      border: 1px solid var(--line-strong);
      border-radius: 999px;
      background: #f5f5f7;
      color: #6e6e73;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0;
    }

    @media (max-width: 980px) {
      .report-action-panel {
        align-items: flex-start;
        flex-direction: column;
      }

      .report-action-buttons,
      .report-modal-actions {
        justify-content: flex-start;
        width: 100%;
      }
    }

    @media (max-width: 560px) {
      .report-action-button,
      .report-action-buttons,
      .report-modal-actions {
        width: 100%;
      }

      .report-modal {
        padding: 14px;
      }

      .report-modal-card {
        padding: 20px;
      }

      .block-advisory {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .block-advisory .metric-button {
        grid-column: 1 / -1;
        width: 100%;
      }
    }
"""


V2_SCRIPT = r"""    const EMBEDDED_DATA_SOURCE = document.getElementById('dd-data2').textContent;

    const COLORS = {
      green: '#34c759',
      yellow: '#ffcc00',
      orange: '#ff9500',
      red: '#ff3b30',
      gray: '#c7c7cc',
      blue: '#007aff',
    };

    const UNIT_COLORS = {
      'CBP': '#007aff',
      'УБ': '#5e5ce6',
      'ДомКлик': '#248a3d',
      'Без юнита': '#8e8e93',
    };

    const state = {
      model: null,
      sort: 'unit',
      selectedId: null,
      compact: false,
      expandedBlocks: {},
    };

    const $ = (id) => document.getElementById(id);

    function readEmbeddedData() {
      try {
        return JSON.parse(EMBEDDED_DATA_SOURCE);
      } catch (jsonError) {
        try {
          return Function('"use strict"; return (' + EMBEDDED_DATA_SOURCE + ');')();
        } catch (literalError) {
          const message = jsonError && jsonError.message ? jsonError.message : String(jsonError);
          throw new Error('ошибка JSON: ' + message);
        }
      }
    }

    function esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[ch]));
    }

    function parseNumber(value, fallback = 0) {
      if (value === null || value === undefined || value === '') return fallback;
      const parsed = Number(String(value).replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    function parseApplicable(value) {
      if (value === undefined || value === null || value === '') return true;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      const s = String(value).trim().toLowerCase();
      if (['false', '0', 'no', 'n', 'нет', 'н', '-'].includes(s)) return false;
      if (['true', '1', 'yes', 'y', 'да', 'д'].includes(s)) return true;
      return Boolean(value);
    }

    function parseLight(value) {
      const s = String(value ?? '').trim().toLowerCase();
      if (!s) return null;
      if (['green', 'g', 'зеленый', 'зелёный', 'зеленая', 'зелёная'].includes(s)) return 'green';
      if (['yellow', 'y', 'amber', 'orange', 'желтый', 'жёлтый', 'оранжевый'].includes(s)) return 'yellow';
      if (['red', 'r', 'красный', 'красная'].includes(s)) return 'red';
      if (['gray', 'grey', 'n', 'none', 'na', 'n/a', 'серый', 'серая', 'не применимо'].includes(s)) return 'gray';
      return null;
    }

    function statusOf(score) {
      if (score >= 81) return { text: 'Лидеры DD', color: COLORS.green };
      if (score >= 61) return { text: 'Зрелые', color: '#e0a100' };
      if (score >= 40) return { text: 'Развивающиеся', color: COLORS.orange };
      return { text: 'Требуют внимания', color: '#d70015' };
    }

    function dotClass(dot) {
      return dot === 'g' ? 'green' : dot === 'y' ? 'yellow' : dot === 'r' ? 'red' : 'gray';
    }

    function dotColor(dot) {
      return dot === 'g' ? COLORS.green : dot === 'y' ? COLORS.yellow : dot === 'r' ? COLORS.red : COLORS.gray;
    }

    function dotFromLight(light) {
      const normalized = parseLight(light);
      if (!normalized) return null;
      if (normalized === 'green') return 'g';
      if (normalized === 'yellow') return 'y';
      if (normalized === 'red') return 'r';
      return 'n';
    }

    function metricLight(value, max, applicable) {
      if (!applicable || max <= 0) return 'n';
      if (value === max) return 'g';
      return value > 0 ? 'y' : 'r';
    }

    function pointsTone(value, max, applicable, tbd) {
      if (tbd || !applicable || max <= 0) return 'gray';
      if (value === max) return 'green';
      return value > 0 ? 'yellow' : 'red';
    }

    function fmt(value) {
      if (!Number.isFinite(value)) return '0';
      const rounded = Math.round(value * 100) / 100;
      return String(rounded).replace('.', ',');
    }

    function pluralEntity(n) {
      const m = n % 10;
      const h = n % 100;
      if (m === 1 && h !== 11) return 'сущность';
      if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return 'сущности';
      return 'сущностей';
    }

    function normalizeLinks(links) {
      const source = Array.isArray(links) ? links : (links ? [links] : []);
      return source
        .map((link) => {
          if (typeof link === 'string') return { label: 'Открыть', url: normalizeUrl(link) };
          const url = link && (link.url || link.href || link.link);
          if (!url) return null;
          return {
            label: link.label || link.name || link.title || 'Открыть',
            url: normalizeUrl(url),
          };
        })
        .filter(Boolean);
    }

    function normalizeButton(button, fallback = {}) {
      if (!button && !fallback.label && !fallback.link) return null;

      if (typeof button === 'string') {
        return {
          type: fallback.type || 'general',
          label: button || fallback.label || '',
          link: normalizeUrl(fallback.link || ''),
        };
      }

      const source = button && typeof button === 'object' ? button : {};
      const label = source.label || source.name || source.text || fallback.label || '';
      const link = source.link || source.url || source.href || fallback.link || '';

      if (!label && !link) return null;

      return {
        type: source.type || fallback.type || 'general',
        label,
        link: normalizeUrl(link),
      };
    }

    function buttonLabel(button) {
      if (!button) return '';
      if (button.type === 'general' && button.label !== 'TBD') return button.label + ' ›';
      if (button.link && button.type !== 'general') return button.label + ' ↗';
      return button.label;
    }

    function actionButtonHTML(button, className) {
      if (!button || !button.label) return '';
      const label = esc(buttonLabel(button));
      if (button.link) {
        return `<a class="${className}" href="${esc(button.link)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      }
      return `<span class="${className} disabled">${label}</span>`;
    }

    function normalizeUrl(url) {
      const clean = String(url || '').trim();
      if (!clean) return '';
      if (/^(https?:|mailto:|tel:|#|\/)/i.test(clean)) return clean;
      return 'https://' + clean;
    }

    function normalizeConstructedData(data) {
      const productsRaw = Array.isArray(data.products) ? data.products : [];
      if (!productsRaw.length) throw new Error('нет сущностей в dd-data2');

      const dotOrder = { g: 0, y: 1, r: 2, n: 3 };
      const products = productsRaw.map((rawProduct, order) => {
        let earned = 0;
        let max = 0;
        let greens = 0;
        const dots = [];
        const entityName = rawProduct.name || rawProduct.product || rawProduct.product_name || 'Без названия';
        const entityType = rawProduct.type || rawProduct.entity_type || 'Продукт';

        const blocks = (rawProduct.metrics || []).map((rawBlock) => {
          let blockEarned = 0;
          let blockMax = 0;
          let greenCount = 0;

          const criteria = (rawBlock.metrics || []).map((metric) => {
            const applicable = parseApplicable(metric.is_applicabble_flg);
            const metricMax = applicable ? Math.max(0, parseNumber(metric.max_value, 0)) : 0;
            const value = applicable ? Math.max(0, Math.min(metricMax, parseNumber(metric.value, 0))) : 0;
            const excluded = metric.excluded_from_index === true || isIndexExcludedMetric(rawBlock, metric);
            const displayDot = metric.tbd ? 'n' : (dotFromLight(metric.traffic_light) || metricLight(value, metricMax, applicable));
            const titleDot = metricLight(value, metricMax, applicable);
            const gap = (!metric.tbd && !excluded && applicable && metricMax > 0) ? Math.max(0, metricMax - value) : 0;

            dots.push(titleDot);
            if (titleDot === 'g') greens += 1;

            if (!excluded) {
              blockEarned += value;
              blockMax += metricMax;
              if (applicable && metricMax > 0 && value === metricMax) greenCount += 1;
            }

            return {
              ...metric,
              applicable,
              value,
              max: metricMax,
              excluded,
              dot: displayDot,
              gap,
              points: metric.tbd ? 'TBD' : (applicable && metricMax > 0 ? fmt(value) + ' / ' + fmt(metricMax) : 'не применимо'),
              pointsTone: pointsTone(value, metricMax, applicable, metric.tbd),
              buttons: normalizeMetricButtons(metric, value),
              links: normalizeLinks(metric.links),
            };
          });

          earned += blockEarned;
          max += blockMax;

          const score = blockMax > 0 ? Math.round(blockEarned / blockMax * 100) : 0;
          const tools = normalizeTools(rawBlock.tools, rawBlock, criteria, greenCount);
          return {
            ...rawBlock,
            criteria,
            earned: blockEarned,
            max: blockMax,
            score,
            greenCount,
            status: statusOf(score),
            tools,
            actions: normalizeActions(rawBlock.actions),
            infobox: normalizeInfo(rawBlock.info),
          };
        });

        const score = max > 0 ? Math.round(earned / max * 100) : 0;
        dots.sort((a, b) => (dotOrder[a] ?? 9) - (dotOrder[b] ?? 9));
        const skillDots = titleSkillDots(blocks);
        const skillGreens = skillDots.filter((dot) => dot === 'g').length;

        return {
          id: rawProduct.id,
          groupId: rawProduct.product_group_uuid,
          name: entityName,
          type: entityType,
          unit: rawProduct.unit || 'Без юнита',
          order,
          earned,
          max,
          greens,
          dots,
          dotCount: dots.length,
          skillGreens,
          skillDots,
          skillDotCount: skillDots.length,
          score,
          status: statusOf(score),
          blocks: { blocks, earned, max, score },
        };
      });

      const units = Array.from(new Set(products.map((product) => product.unit)));
      const avgScore = Math.round(products.reduce((sum, product) => sum + product.score, 0) / products.length);
      const periods = Array.from(new Set(productsRaw.map((product) => product.period).filter(Boolean)));
      const metricCount = productsRaw.reduce((sum, product) => {
        return sum + (product.metrics || []).reduce((blockSum, block) => {
          return blockSum + (block.metrics || []).length;
        }, 0);
      }, 0);

      return {
        products,
        byId: Object.fromEntries(products.map((product) => [product.id, product])),
        period: periods.length ? periods[periods.length - 1] : 'период не указан',
        units,
        avgScore,
        source: {
          products: products.length,
          units: units.length,
          baseMetricRows: metricCount,
        },
      };
    }

    function normalizeToolButton(item, tool, criteria, greenCount) {
      const links = normalizeLinks(item.links);
      const normalizedButton = normalizeButton(item.button, {
        type: 'general',
        label: item.button_name || item.label || 'Перейти',
        link: item.link || (links[0] && links[0].url) || '',
      });
      const buttonLink = normalizedButton && normalizedButton.link;
      const extraLinks = links.filter((link) => link.url !== buttonLink);
      const missingLink = !normalizedButton || !normalizedButton.link;
      const footer = item.footer_dynamic === 'green_count'
        ? 'Выполняется ' + greenCount + ' из ' + criteria.length + ' целей'
        : item.footer;

      return {
        ...item,
        name: item.name || tool.name || 'Инструмент',
        active: missingLink ? 'gray' : (parseLight(item.traffic_light || tool.traffic_light) || 'gray'),
        footer,
        button: missingLink ? { type: 'general', label: 'TBD', link: '' } : normalizedButton,
        links: extraLinks,
        showDots: item.show_dots !== false && item.no_dots !== true,
      };
    }

    function normalizeTools(tools, block, criteria, greenCount) {
      return (tools || []).map((tool) => {
        const hasButtonGroup = Array.isArray(tool.buttons) && tool.buttons.length > 0;
        const items = hasButtonGroup
          ? tool.buttons
          : [{
              name: tool.name,
              footer: tool.footer,
              footer_dynamic: tool.footer_dynamic,
              traffic_light: tool.traffic_light,
              button: tool.button,
              link: tool.link,
              links: tool.links,
              show_dots: tool.show_dots,
              no_dots: tool.no_dots,
            }];
        const buttons = items.map((item) => normalizeToolButton(item, tool, criteria, greenCount));
        const missingLink = buttons.every((item) => !item.button || !item.button.link);
        const active = missingLink ? 'gray' : (parseLight(tool.traffic_light) || buttons[0]?.active || 'gray');
        const footer = hasButtonGroup ? '' : buttons[0]?.footer;
        const button = hasButtonGroup ? null : buttons[0]?.button;

        return {
          ...tool,
          name: tool.name || buttons[0]?.name || 'Инструмент',
          active,
          footer,
          button,
          buttons,
          isGroup: hasButtonGroup,
          links: hasButtonGroup ? [] : (buttons[0]?.links || []),
          kind: tool.kind || (tool.variant === 'blue' ? 'instruction' : 'ai'),
          showDots: tool.show_dots !== false && tool.no_dots !== true,
          variant: missingLink
            ? 'gray'
            : (tool.variant === 'gray' ? '' : (tool.variant || '')),
        };
      });
    }

    function titleSkillDots(blocks) {
      const order = { g: 0, y: 1, r: 2, n: 3 };
      const dots = [];

      blocks.forEach((block) => {
        (block.tools || []).forEach((tool) => {
          if (tool.kind !== 'ai') return;

          if (tool.isGroup && Array.isArray(tool.buttons) && tool.buttons.length) {
            tool.buttons.forEach((item) => {
              if (item.showDots === false) return;
              dots.push(dotFromLight(item.active) || 'n');
            });
            return;
          }

          if (tool.showDots === false) return;
          dots.push(dotFromLight(tool.active) || 'n');
        });
      });

      return dots.sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9));
    }

    function isIndexExcludedMetric(block, metric) {
      const code = String(metric.code || '');
      const name = String(metric.name || '').toLowerCase();
      if (code === 'hyp.ab_tests') return true;
      if (code === 'attract.auto_regularity' || code === 'churn.auto_regularity') return true;
      if (code.includes('auto_regularity')) return true;
      return ['attract', 'churn'].includes(block.code) && name.includes('регулярность');
    }

    function normalizeActions(actions) {
      return normalizeLinks(actions);
    }

    function normalizeMetricButton(metric, value) {
      const useZeroButton = metric.zero_button && value === 0;
      if (useZeroButton) {
        return normalizeButton(metric.zero_button, {
          type: 'metric',
          label: metric.zero_button_name || '',
          link: metric.zero_link || metric.link || '',
        });
      }

      return normalizeButton(metric.button, {
        type: 'metric',
        label: metric.button_name || '',
        link: metric.link || '',
      });
    }

    function normalizeMetricButtons(metric, value) {
      const buttons = [];
      const primary = normalizeMetricButton(metric, value);
      if (primary) buttons.push(primary);

      const extraButtons = Array.isArray(metric.buttons) ? metric.buttons : [];
      extraButtons.forEach((button) => {
        const normalized = normalizeButton(button, { type: 'metric' });
        if (normalized) buttons.push(normalized);
      });

      const seen = new Set();
      return buttons.filter((button) => {
        const key = `${button.label}|${button.link}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function normalizeInfo(info) {
      if (!info) return null;
      const count = Math.max(0, parseNumber(info.count, 0));
      const fallbackLabel = count > 0 ? 'Посмотреть инсайты' : 'Провести анализ';
      return {
        count: fmt(count),
        title: info.title || 'аналитики в LossHunter',
        sub: info.footer || info.sub || 'проведено за квартал по продукту',
        button: normalizeButton(info.button, {
          type: 'metric',
          label: fallbackLabel,
          link: info.link || '',
        }) || { type: 'metric', label: fallbackLabel, link: '' },
      };
    }

    function sortedProducts() {
      const products = state.model ? [...state.model.products] : [];
      if (state.sort === 'dd') {
        return products.sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name, 'ru'));
      }
      const unitOrder = new Map();
      products.forEach((product) => {
        if (!unitOrder.has(product.unit)) unitOrder.set(product.unit, unitOrder.size);
      });
      return products.sort((a, b) => (unitOrder.get(a.unit) - unitOrder.get(b.unit)) || a.order - b.order);
    }

    function renderTitle() {
      const model = state.model;
      const table = $('productTable');
      const message = $('titleMessage');
      if (!model) {
        table.classList.add('hidden');
        message.classList.remove('hidden');
        message.textContent = 'Данные пока не загружены.';
        return;
      }

      $('statProducts').textContent = model.products.length;
      $('statUnits').textContent = model.units.length;
      $('statAvg').textContent = model.avgScore + '%';

      message.classList.add('hidden');
      table.classList.remove('hidden');
      const products = sortedProducts();

      const head = `
        <div class="table-head">
          <div>Сущность</div>
          <div>DD%</div>
          <div>Светофор метрик</div>
          <div>Действие</div>
        </div>
      `;

      if (state.sort === 'dd') {
        table.innerHTML = head + products.map((product) => productRowHTML(product, true)).join('');
        return;
      }

      const chunks = [];
      const units = Array.from(new Set(products.map((product) => product.unit)));
      units.forEach((unit) => {
        const unitProducts = products.filter((product) => product.unit === unit);
        const avg = Math.round(unitProducts.reduce((sum, product) => sum + product.score, 0) / unitProducts.length);
        const color = UNIT_COLORS[unit] || '#8e8e93';

        chunks.push(`
          <div class="unit-row">
            <div class="unit-name">
              <i class="unit-dot" style="background:${color}"></i>
              <b>${esc(unit)}</b>
              <span>${unitProducts.length} ${pluralEntity(unitProducts.length)}</span>
            </div>
            <div class="unit-avg">средний DD <b style="color:${statusOf(avg).color}">${avg}%</b></div>
          </div>
        `);

        unitProducts.forEach((product) => chunks.push(productRowHTML(product, false)));
      });

      table.innerHTML = head + chunks.join('');
    }

    function productRowHTML(product, showUnit) {
      const st = product.status;
      const dots = product.skillDots.length ? product.skillDots : ['n'];
      const meta = `
        <span class="entity-meta">
          ${showUnit ? `<span class="entity-unit">${esc(product.unit)}</span>` : ''}
          <span class="entity-type">${esc(product.type || 'Продукт')}</span>
        </span>
      `;
      return `
        <div class="product-row">
          <div class="product-name">
            <b title="${esc(product.name)}">${esc(product.name)}</b>
            ${meta}
          </div>
          <div>
            <div class="dd-cell">
              <span class="status-label" style="color:${st.color}">${esc(st.text)}</span>
              <span class="score-label" style="color:${st.color}">${product.score}%</span>
              <span class="progress" style="color:${st.color}"><i style="width:${product.score}%"></i></span>
            </div>
          </div>
          <div class="lights">
            <div class="dotline">${dots.map((dot) => `<i class="dot ${dotClass(dot)}"></i>`).join('')}</div>
            <div class="light-caption">в зеленой зоне <b>${product.skillGreens} / ${product.skillDotCount}</b></div>
          </div>
          <div class="go-cell">
            <button type="button" class="go-button" data-product-id="${esc(product.id)}">Перейти ›</button>
          </div>
        </div>
      `;
    }

    function renderProductSelect() {
      const select = $('productSelect');
      const products = sortedProducts();
      select.innerHTML = products
        .map((product) => `<option value="${esc(product.id)}">${esc(product.name)}</option>`)
        .join('');
      select.value = state.selectedId || (products[0] && products[0].id) || '';
    }

    function detailSubtitleHTML(product, period) {
      return `
        <span class="detail-subline">
          <span>${esc(product.unit || 'Без юнита')} · ${esc(period || 'период не указан')} ·</span>
          <span class="detail-entity-type">${esc(product.type || 'Продукт')}</span>
        </span>
      `;
    }

    function renderDetail() {
      const model = state.model;
      const message = $('detailMessage');
      const content = $('detailContent');
      if (!model || !model.products.length) {
        message.classList.remove('hidden');
        content.classList.add('hidden');
        message.textContent = 'Нет данных для детального листа.';
        return;
      }

      const product = model.byId[state.selectedId] || model.products[0];
      state.selectedId = product.id;
      renderProductSelect();

      message.classList.add('hidden');
      content.classList.remove('hidden');

      const st = product.status;
      $('detailName').textContent = product.name;
      $('detailSub').innerHTML = detailSubtitleHTML(product, model.period);
      $('scoreKicker').textContent = product.name;
      $('detailScore').textContent = product.score;
      $('detailScore').style.color = st.color;
      $('detailStatus').textContent = st.text;
      $('detailStatus').style.color = st.color;
      $('rangePin').style.left = Math.max(0, Math.min(100, product.score)) + '%';
      $('rangePin').style.color = st.color;

      renderFocuses(product);
      renderBlocks(product);
    }

    function renderFocuses(product) {
      const rows = [];
      product.blocks.blocks.forEach((block) => {
        block.criteria.forEach((criterion) => {
          if (!criterion.excluded && criterion.applicable && criterion.max > 0 && criterion.gap > 0) {
            rows.push({
              block,
              criterion,
              gain: Math.round(criterion.gap / Math.max(product.blocks.max, 1) * 100),
            });
          }
        });
      });

      const focuses = aggregateRecommendationFocuses(rows, product.blocks.max)
        .slice(0, 3);

      if (!focuses.length) {
        $('focusList').innerHTML = `
          <div class="focus-row">
            <span class="focus-num">✓</span>
            <span class="focus-text"><b>Все применимые метрики без просадок</b><span>Сохранить текущий уровень и мониторить обновления JSON</span></span>
            <span class="gain">0 п.п.</span>
          </div>
        `;
        return;
      }

      $('focusList').innerHTML = focuses.map((item, index) => `
        <div class="focus-row">
          <span class="focus-num">${index + 1}</span>
          <span class="focus-text">
            <b>${esc(item.recommendation)}</b>
            <span>${esc(item.caption)}</span>
          </span>
          <span class="gain">+${item.gain} п.п.</span>
        </div>
      `).join('');
    }

    function aggregateRecommendationFocuses(rows, totalMax) {
      const groups = new Map();
      rows.forEach((item) => {
        recommendationTextsFor(item.criterion).forEach((recommendation) => {
          const key = normalizeRecommendationKey(recommendation);
          if (!key) return;
          if (!groups.has(key)) {
            groups.set(key, {
              recommendation,
              gap: 0,
              metrics: [],
              blocks: new Set(),
            });
          }

          const group = groups.get(key);
          group.gap += item.criterion.gap;
          group.metrics.push(item);
          group.blocks.add(item.block.name);
        });
      });

      return Array.from(groups.values())
        .map((group) => {
          const gain = Math.round(group.gap / Math.max(totalMax, 1) * 100);
          const count = group.metrics.length;
          const caption = count === 1
            ? `${group.metrics[0].block.name} · сейчас ${fmt(group.metrics[0].criterion.value)} / ${fmt(group.metrics[0].criterion.max)}`
            : `${count} метрик · ${Array.from(group.blocks).join(', ')} · суммарный гэп ${fmt(group.gap)}`;
          return {
            recommendation: group.recommendation,
            caption,
            gap: group.gap,
            gain,
          };
        })
        .sort((a, b) => (b.gap - a.gap) || (b.gain - a.gain) || a.recommendation.localeCompare(b.recommendation, 'ru'));
    }

    function recommendationTextsFor(row) {
      const excelRecommendations = uniqueRecommendationTexts(row);
      if (excelRecommendations.length) return excelRecommendations;
      return [fallbackRecommendationFor(row)];
    }

    function uniqueRecommendationTexts(row) {
      const source = Array.isArray(row.recommendations)
        ? row.recommendations
        : (row.recommendation ? [row.recommendation] : []);
      const seen = new Set();
      return source
        .map((item) => String(item || '').trim())
        .filter((item) => {
          if (!item) return false;
          const key = normalizeRecommendationKey(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }

    function normalizeRecommendationKey(value) {
      return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function recommendationFor(row) {
      return recommendationTextsFor(row).join(' · ');
    }

    function fallbackRecommendationFor(row) {
      const byCode = {
        'general.market_ru': 'Зафиксировать рынок РФ и источник.',
        'general.market_sber': 'Оценить потенциал базы Сбера.',
        'general.clients_with_product': 'Обновить базу клиентов с продуктом.',
        'general.product_mau': 'Вывести MAU в регулярный мониторинг.',
        'general.satellite_products_knowledge': 'Картировать продукты-спутники.',
        'general.navigator_reporting_knowledge': 'Выбрать основной отчет в Навигаторе.',
        'goals.monitored': 'Использовать мониторинг целей в Навигаторе.',
        'goals.factor_analysis_l1_l2': 'Разложить цели на L1/L2-драйверы.',
        'goals.forecast': 'Добавить прогноз по целям.',
        'alerts.system_failures': 'Настроить алерты по сбоям.',
        'alerts.business_metrics': 'Добавить алерты по бизнес-метрикам.',
        'cx.product_mechanics': 'Собрать продуктовые механики.',
        'cx.score': 'Разобрать CX в LossHunter.',
        'attract.regular_reporting': 'Настроить отчетность по привлечению.',
        'attract.report_completeness': 'Закрыть пробелы в отчете привлечения.',
        'attract.benchmarks': 'Добавить бенчмарки привлечения.',
        'attract.cross_sell': 'Проработать cross-sell-сценарии.',
        'attract.funnel_analysis': 'Провести анализ воронки привлечения.',
        'attract.initiatives_list': 'Приоритизировать инициативы привлечения.',
        'attract.drafts_70': 'Поднять покрытие черновиков.',
        'attract.campaign_launches': 'Увеличить запуск кампаний.',
        'churn.regular_reporting': 'Настроить отчетность по оттоку.',
        'churn.report_completeness': 'Закрыть пробелы в отчете оттока.',
        'churn.benchmarks': 'Добавить бенчмарки оттока.',
        'churn.funnel_analysis': 'Провести анализ воронки оттока.',
        'churn.deviation_actions': 'Назначить реакцию на отклонения.',
        'churn.mechanics_metrics_knowledge': 'Определить метрики механик оттока.',
        'churn.client_retention': 'Усилить механики удержания.',
        'churn.client_return': 'Запустить сценарии возврата.',
        'churn.flexible_terms': 'Настроить гибкие условия.',
        'hyp.discovery_40_backlog': 'Поднять долю discovery в бэклоге.',
        'hyp.ab_tests': 'Подготовить A/B-план после TBD.',
        'hyp.datadriven_rating_7_5': 'Разобрать просадку DataDriven.',
        'hyp.extra_initiatives': 'Добавить инициативы сверх БП.',
      };
      return byCode[row.code] || 'Назначить владельца и действие для "' + row.name + '".';
    }

    function renderBlocks(product) {
      const grid = $('blocksGrid');
      grid.innerHTML = product.blocks.blocks.map((block) => {
        const st = block.status;
        const hasOverride = Object.prototype.hasOwnProperty.call(state.expandedBlocks, block.code);
        const expanded = hasOverride ? state.expandedBlocks[block.code] : !state.compact;
        const criteria = block.criteria;

        return `
          <article class="block-card">
            <div class="block-top" data-block-key="${esc(block.code)}">
              <div>
                <div class="block-title-line">
                  <span class="block-chevron">${expanded ? '▾' : '▸'}</span>
                  <h2>${esc(block.name)}</h2>
                </div>
                <div class="block-meta">${esc(fmt(block.earned))} / ${esc(fmt(block.max))} · ${block.greenCount} выполнено</div>
                <div class="block-progress" style="color:${st.color}"><i style="width:${block.score}%"></i></div>
              </div>
              <div class="block-score" style="color:${st.color}">${block.score}%</div>
            </div>
            ${expanded ? `
              ${block.tools.map(blockToolHTML).join('')}
              ${block.infobox ? blockInfoHTML(block.infobox) : ''}
              <div class="criteria">
                ${criteria.map(criterionHTML).join('')}
              </div>
              ${blockAdvisoryHTML(block)}
              ${actionsHTML(block.actions)}
            ` : ''}
          </article>
        `;
      }).join('');
    }

    function noteDotHTML(active) {
      const light = parseLight(active);
      if (!light || light === 'gray') {
        return ['#d1d1d6', '#d1d1d6', '#d1d1d6']
          .map((color) => `<i class="note-dot" style="background:${color}"></i>`)
          .join('');
      }

      return [
        ['red', COLORS.red],
        ['yellow', COLORS.yellow],
        ['green', COLORS.green],
      ].map(([key, color]) => {
        const fill = light === key ? color : '#e4e4e7';
        return `<i class="note-dot" style="background:${fill}"></i>`;
      }).join('');
    }

    function toolLightHTML(active) {
      const light = parseLight(active) || 'gray';
      const dot = light === 'green' ? 'g' : light === 'yellow' ? 'y' : light === 'red' ? 'r' : 'n';
      return `<i class="tool-light" style="background:${dotColor(dot)}"></i>`;
    }

    function toolItemHTML(item) {
      return `
        <div class="tool-item">
          ${toolLightHTML(item.active)}
          <div class="tool-item-copy">
            ${item.stage ? `<span class="tool-stage">${esc(item.stage)}</span>` : ''}
            <div class="tool-item-name">${esc(item.name || 'Инструмент')}</div>
            ${item.footer ? `<div class="tool-item-footer">${esc(item.footer)}</div>` : ''}
          </div>
          ${actionButtonHTML(item.button, 'note-action')}
        </div>
      `;
    }

    function blockToolHTML(tool) {
      const mode = tool.variant ? ' ' + tool.variant : '';
      const toolItems = Array.isArray(tool.buttons) ? tool.buttons : [];
      const isGroup = tool.isGroup && toolItems.length > 0;
      const generalButton = tool.button && tool.button.type !== 'footer'
        ? actionButtonHTML(tool.button, 'note-action')
        : '';
      const isInstruction = tool.kind === 'instruction';
      const badge = isInstruction ? 'i' : 'AI';
      const badgeClass = isInstruction ? 'note-badge instruction' : 'note-badge';
      const dots = tool.showDots ? `<span class="note-dots">${noteDotHTML(tool.active)}</span>` : '';

      if (isGroup) {
        return `
          <div class="block-note tool-group${mode}">
            <div class="note-copy">
              <span class="${badgeClass}">${badge}</span>
              <div class="note-copy-text">
                <div class="note-skill">${esc(tool.name || 'Навык')}</div>
              </div>
            </div>
            <div class="tool-items">
              ${toolItems.map(toolItemHTML).join('')}
            </div>
          </div>
        `;
      }

      return `
        <div class="block-note${mode}">
          <div class="note-copy">
            <span class="${badgeClass}">${badge}</span>
            <div class="note-copy-text">
              <div class="note-skill">${esc(tool.name || 'Инструмент')}</div>
              ${tool.footer ? `<div class="note-metric">${esc(tool.footer)}</div>` : ''}
            </div>
          </div>
          <div class="note-side">
            ${dots}
            ${generalButton}
          </div>
        </div>
      `;
    }

    function actionsHTML(actions) {
      const cleanActions = normalizeActions(actions);
      if (!cleanActions.length) return '';

      return `
        <div class="block-actions">
          ${cleanActions.map((action) => `
            <a class="data-link" href="${esc(action.url)}" target="_blank" rel="noopener noreferrer">${esc(action.label)} ↗</a>
          `).join('')}
        </div>
      `;
    }

    function blockInfoHTML(info) {
      return `
        <div class="block-infobox">
          <div class="info-count">${esc(info.count)}</div>
          <div class="info-text">
            <b>${esc(info.title)}</b>
            <span>${esc(info.sub)}</span>
          </div>
          ${actionButtonHTML(info.button, 'metric-button')}
        </div>
      `;
    }

    function criterionByCode(block, code) {
      return (block.criteria || []).find((criterion) => criterion.code === code);
    }

    function criterionValueBelow(block, code, threshold) {
      const criterion = criterionByCode(block, code);
      return Boolean(criterion) && parseNumber(criterion.value, 0) < threshold;
    }

    function jiraDisabledButtonHTML() {
      return actionButtonHTML({ type: 'metric', label: 'Завести задачу в Jira', link: '' }, 'metric-button');
    }

    function blockAdvisoryHTML(block) {
      if (block.code !== 'goals' || !criterionValueBelow(block, 'goals.monitored', 1)) return '';

      return `
        <div class="block-advisory">
          <span class="block-advisory-badge">i</span>
          <div class="block-advisory-text">В вашем юните имеется мастер-деш, но целей вашего продукта в нем пока-что нет. Обратитесь в штаб Юнита</div>
          ${jiraDisabledButtonHTML()}
        </div>
      `;
    }

    function criterionJiraButtonHTML(criterion) {
      if (criterion.code !== 'alerts.business_metrics' || parseNumber(criterion.value, 0) >= 1) return '';
      return jiraDisabledButtonHTML();
    }

    function criterionHTML(criterion) {
      const color = dotColor(criterion.dot);
      const sub = criterion.group ? criterion.group + ' · ' + criterion.footer : criterion.footer;
      const metricButton = (criterion.buttons || []).map((button) => actionButtonHTML(button, 'metric-button')).join('') + criterionJiraButtonHTML(criterion);
      const links = linksHTML(criterion.links, 'criterion-links');
      const extra = metricButton ? `<div class="criterion-extra">${metricButton}</div>` : '';

      return `
        <div class="criterion">
          <i class="dot" style="background:${color}"></i>
          <span class="criterion-name">
            <b>${esc(criterion.name)}</b>
            <span>${esc(sub || '')}</span>
          </span>
          <span class="criterion-points ${esc(criterion.pointsTone)}">${esc(criterion.points)}</span>
          ${extra}
          ${links}
        </div>
      `;
    }

    function linksHTML(links, className) {
      const cleanLinks = normalizeLinks(links);
      if (!cleanLinks.length) return '';

      return `
        <div class="${className}">
          ${cleanLinks.map((link) => `
            <a class="data-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)} ↗</a>
          `).join('')}
        </div>
      `;
    }

    function showTitle(pushHash = true) {
      $('titleView').classList.remove('hidden');
      $('detailView').classList.add('hidden');
      if (pushHash) history.replaceState(null, '', location.pathname);
      renderTitle();
    }

    function showDetail(id, pushHash = true) {
      state.selectedId = id;
      $('titleView').classList.add('hidden');
      $('detailView').classList.remove('hidden');
      if (pushHash) history.replaceState(null, '', '#product=' + encodeURIComponent(id));
      renderDetail();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function applyHashRoute() {
      const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
      const productId = hash.get('product');
      if (productId && state.model && state.model.byId[productId]) showDetail(productId, false);
      else showTitle(false);
    }

    function updateTop() {
      const model = state.model;
      $('periodPill').textContent = model ? model.period : 'Загрузка данных';
      $('topSubtitle').textContent = model
        ? model.products.length + ' сущностей · ' + model.units.length + ' юнита'
        : 'Витрина DD';
    }

    function loadData() {
      try {
        state.model = normalizeConstructedData(readEmbeddedData());
        updateTop();
        renderTitle();
        applyHashRoute();
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        state.model = null;
        updateTop();
        $('productTable').classList.add('hidden');
        $('titleMessage').classList.remove('hidden');
        $('titleMessage').textContent = 'Не удалось прочитать встроенный dd-data2: ' + message;
      }
    }

    function setReportAccessModal(open) {
      const modal = $('reportAccessModal');
      if (!modal) return;

      modal.classList.toggle('hidden', !open);
      modal.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.classList.toggle('report-modal-open', open);

      if (open) {
        const closeButton = $('reportAccessClose');
        if (closeButton) closeButton.focus();
      }
    }

    function bindEvents() {
      $('sortUnitBtn').addEventListener('click', () => {
        state.sort = 'unit';
        $('sortUnitBtn').classList.add('active');
        $('sortDDBtn').classList.remove('active');
        renderTitle();
      });

      $('sortDDBtn').addEventListener('click', () => {
        state.sort = 'dd';
        $('sortDDBtn').classList.add('active');
        $('sortUnitBtn').classList.remove('active');
        renderTitle();
      });

      $('productTable').addEventListener('click', (event) => {
        const button = event.target.closest('[data-product-id]');
        if (button) showDetail(button.dataset.productId);
      });

      $('blocksGrid').addEventListener('click', (event) => {
        const header = event.target.closest('[data-block-key]');
        if (!header) return;
        const key = header.dataset.blockKey;
        const hasOverride = Object.prototype.hasOwnProperty.call(state.expandedBlocks, key);
        const current = hasOverride ? state.expandedBlocks[key] : !state.compact;
        state.expandedBlocks = { ...state.expandedBlocks, [key]: !current };
        renderDetail();
      });

      $('backBtn').addEventListener('click', () => showTitle(true));
      $('productSelect').addEventListener('change', (event) => showDetail(event.target.value));

      const complexReportBtn = $('complexReportBtn');
      if (complexReportBtn) {
        complexReportBtn.addEventListener('click', () => setReportAccessModal(true));
      }

      const reportAccessClose = $('reportAccessClose');
      if (reportAccessClose) {
        reportAccessClose.addEventListener('click', () => setReportAccessModal(false));
      }

      const reportModalBackdrop = document.querySelector('[data-report-modal-close]');
      if (reportModalBackdrop) {
        reportModalBackdrop.addEventListener('click', () => setReportAccessModal(false));
      }

      $('detailFullBtn').addEventListener('click', () => {
        state.compact = false;
        state.expandedBlocks = {};
        $('detailFullBtn').classList.add('active');
        $('detailCompactBtn').classList.remove('active');
        renderDetail();
      });

      $('detailCompactBtn').addEventListener('click', () => {
        state.compact = true;
        state.expandedBlocks = {};
        $('detailCompactBtn').classList.add('active');
        $('detailFullBtn').classList.remove('active');
        renderDetail();
      });

      window.addEventListener('hashchange', applyHashRoute);
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setReportAccessModal(false);
      });
    }

    bindEvents();
    loadData();
"""


def parse_number(value: Any, fallback: float = 0.0) -> float:
    if value is None or value == "":
        return fallback
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return fallback


def parse_applicable(value: Any) -> bool:
    if value is None or value == "":
        return True
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    normalized = str(value).strip().lower()
    if normalized in {"false", "0", "no", "n", "нет", "н", "-"}:
        return False
    if normalized in {"true", "1", "yes", "y", "да", "д"}:
        return True
    return bool(value)


def period_rank(value: Any) -> float | None:
    text = str(value or "").strip()
    roman = {"I": 1, "II": 2, "III": 3, "IV": 4}
    match = re.search(r"(IV|III|II|I|[1-4])\s*кв[.]?\s*([0-9]{4})", text, re.I)
    if match:
        quarter_raw = match.group(1).upper()
        quarter = roman[quarter_raw] if quarter_raw in roman else int(quarter_raw)
        return int(match.group(2)) * 12 + quarter * 3

    match = re.search(r"([0-9]{4})\s*(?:г[.]?)?\s*(IV|III|II|I|[1-4])\s*кв", text, re.I)
    if match:
        quarter_raw = match.group(2).upper()
        quarter = roman[quarter_raw] if quarter_raw in roman else int(quarter_raw)
        return int(match.group(1)) * 12 + quarter * 3

    return None


def latest_period(rows: list[dict[str, Any]]) -> str:
    if not rows:
        raise ValueError("dd-data.json is empty")

    periods: dict[str, dict[str, Any]] = {}
    for order, row in enumerate(rows):
        period = str(row.get("period") or "").strip()
        periods.setdefault(period, {"period": period, "order": order, "rank": period_rank(period)})

    has_rank = any(item["rank"] is not None for item in periods.values())

    def sort_key(item: dict[str, Any]) -> tuple[float, int]:
        rank = item["rank"] if item["rank"] is not None else float("-inf")
        return (rank if has_rank else item["order"], item["order"])

    return sorted(periods.values(), key=sort_key)[-1]["period"]


def unit_name(value: Any) -> str:
    unit = str(value or "").strip()
    return unit or "Без юнита"


def parse_light(value: Any) -> str | None:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return None
    if normalized in {"green", "g", "зеленый", "зелёный", "зеленая", "зелёная"}:
        return "green"
    if normalized in {"yellow", "y", "amber", "orange", "желтый", "жёлтый", "оранжевый"}:
        return "yellow"
    if normalized in {"red", "r", "красный", "красная"}:
        return "red"
    if normalized in {"gray", "grey", "n", "none", "na", "n/a", "серый", "серая", "не применимо"}:
        return "gray"
    return None


def metric_light(value: float, max_value: float, applicable: bool) -> str:
    if not applicable or max_value <= 0:
        return "gray"
    if abs(value - max_value) < 1e-9:
        return "green"
    if value > 0:
        return "yellow"
    return "red"


def normalize_links(value: Any) -> list[dict[str, str]]:
    raw_links = value if isinstance(value, list) else ([value] if value else [])
    links: list[dict[str, str]] = []

    for item in raw_links:
        if isinstance(item, str):
            links.append({"label": "Открыть", "url": item})
            continue
        if not isinstance(item, dict):
            continue

        url = item.get("url") or item.get("href") or item.get("link")
        if not url:
            continue

        links.append(
            {
                "label": str(item.get("label") or item.get("name") or item.get("title") or "Открыть"),
                "url": str(url),
            }
        )

    return links


def links_from_row(row: dict[str, Any] | None) -> list[dict[str, str]]:
    if not row:
        return []
    links = normalize_links(row.get("links"))
    if row.get("link") or row.get("url") or row.get("href"):
        links.extend(
            normalize_links(
                {
                    "label": row.get("link_label") or row.get("label") or "Открыть",
                    "url": row.get("link") or row.get("url") or row.get("href"),
                }
            )
        )
    return links


def make_button(button_type: str, label: Any, link: Any = "") -> dict[str, str] | None:
    label_text = str(label or "").strip()
    link_text = str(link or "").strip()
    if not label_text and not link_text:
        return None
    return {
        "type": str(button_type or "general").strip() or "general",
        "label": label_text or "Открыть",
        "link": link_text,
    }


def service_metric(metric: str) -> tuple[str, str] | None:
    traffic = re.match(r"^([a-z]+)_traffic_light$", metric or "")
    if traffic:
        return ("traffic", traffic.group(1))
    if metric == "cx_losshunter_analytics_count":
        return ("losshunter", "cx")
    return None


def product_id(row: dict[str, Any]) -> str:
    group_id = str(row.get("product_group_uuid") or "").strip()
    product = str(row.get("product_name") or group_id).strip() or group_id
    entity_type = str(row.get("type") or row.get("entity_type") or DEFAULT_ENTITY_TYPE).strip() or DEFAULT_ENTITY_TYPE
    if entity_type != DEFAULT_ENTITY_TYPE:
        return f"{group_id}¦{entity_type}¦{product}"
    return f"{group_id}¦{product}"


def build_product(
    raw_product: dict[str, Any],
    records: dict[str, dict[str, Any]],
    traffic_lights: dict[str, str],
    losshunter_count: float,
) -> dict[str, Any]:
    blocks: list[dict[str, Any]] = []

    for block in BLOCKS:
        tools = []
        for tool in block.get("tools", []):
            traffic_metric = tool.get("traffic_metric")
            tool_links = normalize_links(tool.get("links"))
            tool_link = str(tool.get("link") or (tool_links[0]["url"] if tool_links else "")).strip()
            button = make_button(
                tool.get("button_type", "general"),
                tool.get("button", "Перейти"),
                tool_link,
            )
            missing_link = not button or not button.get("link")
            tool_payload = {
                "name": tool["name"],
                "traffic_light": "gray" if missing_link else traffic_lights.get(block["code"], "gray"),
                "button": button if not missing_link else {"type": "general", "label": "TBD", "link": ""},
            }
            if tool.get("footer"):
                tool_payload["footer"] = tool["footer"]
            if tool.get("footer_dynamic"):
                tool_payload["footer_dynamic"] = tool["footer_dynamic"]
            if tool.get("variant"):
                tool_payload["variant"] = tool["variant"]
            if traffic_metric:
                tool_payload["source_metric"] = traffic_metric
            tools.append(tool_payload)

        metrics = []
        for metric in block["metrics"]:
            row = records.get(metric["code"])
            applicable = parse_applicable(row.get("is_metric_applicabble_flg")) if row else False
            default_max = parse_number(metric.get("max_value"), 0)
            max_value = parse_number(row.get("max_value"), default_max) if row else default_max
            max_value = max(0.0, max_value if applicable else 0.0)
            value = parse_number(row.get("value"), 0) if row else 0.0
            value = max(0.0, min(max_value, value if applicable else 0.0))
            links = links_from_row(row)
            link = links[0]["url"] if links else str(metric.get("link") or "")
            button = make_button(
                "metric",
                metric.get("button_name") or metric.get("button") or (links[0]["label"] if links else ""),
                link,
            )

            metric_payload: dict[str, Any] = {
                "code": metric["code"],
                "name": metric["name"],
                "footer": metric.get("footer", ""),
                "value": value if row else None,
                "max_value": max_value if row else metric.get("max_value"),
                "is_applicabble_flg": applicable,
                "traffic_light": metric_light(value, max_value, applicable),
            }

            if button:
                metric_payload["button"] = button

            if metric.get("zero_button"):
                zero_button = make_button("metric", metric["zero_button"], metric.get("zero_link") or "")
                if zero_button:
                    metric_payload["zero_button"] = zero_button

            for optional_key in (
                "group",
                "excluded_from_index",
                "tbd",
                "link_types",
            ):
                if optional_key in metric:
                    metric_payload[optional_key] = metric[optional_key]

            metrics.append(metric_payload)

        block_payload: dict[str, Any] = {
            "type": "block",
            "code": block["code"],
            "name": block["name"],
            "tools": tools,
            "metrics": metrics,
        }

        if block.get("info"):
            info = dict(block["info"])
            if info.get("type") == "losshunter":
                info["count"] = losshunter_count
            block_payload["info"] = info

        blocks.append(block_payload)

    return {
        "id": raw_product["id"],
        "type": raw_product.get("type") or DEFAULT_ENTITY_TYPE,
        "name": raw_product["name"],
        "unit": raw_product["unit"],
        "period": raw_product["period"],
        "product_group_uuid": raw_product["product_group_uuid"],
        "metrics": blocks,
    }


def build_dd_data2(rows: list[dict[str, Any]]) -> dict[str, Any]:
    period = latest_period(rows)
    current_rows = [row for row in rows if str(row.get("period") or "").strip() == period]

    products: dict[str, dict[str, Any]] = {}
    records_by_product: dict[str, dict[str, dict[str, Any]]] = {}
    traffic_by_product: dict[str, dict[str, str]] = {}
    losshunter_by_product: dict[str, float] = {}
    base_row_count = 0

    for order, row in enumerate(current_rows):
        metric = str(row.get("metric") or "").strip()
        group_id = str(row.get("product_group_uuid") or "").strip()
        product_name = str(row.get("product_name") or group_id).strip() or group_id
        entity_type = str(row.get("type") or row.get("entity_type") or DEFAULT_ENTITY_TYPE).strip() or DEFAULT_ENTITY_TYPE
        if not group_id or not product_name or not metric:
            continue

        pid = product_id(row)
        products.setdefault(
            pid,
            {
                "id": pid,
                "type": entity_type,
                "name": product_name,
                "unit": unit_name(row.get("unit")),
                "period": period,
                "product_group_uuid": group_id,
                "order": order,
            },
        )
        records_by_product.setdefault(pid, {})
        traffic_by_product.setdefault(pid, {})

        service = service_metric(metric)
        if service:
            service_type, key = service
            if service_type == "traffic":
                traffic_by_product[pid][key] = parse_light(row.get("value")) or "gray"
            if service_type == "losshunter":
                losshunter_by_product[pid] = parse_number(row.get("value"), 0)
            continue

        records_by_product[pid][metric] = row
        base_row_count += 1

    constructed_products = [
        build_product(
            raw_product,
            records_by_product.get(pid, {}),
            traffic_by_product.get(pid, {}),
            losshunter_by_product.get(pid, 0),
        )
        for pid, raw_product in sorted(products.items(), key=lambda item: item[1]["order"])
    ]

    return {"products": constructed_products}


def build_embedded_html(data: dict[str, Any], title: str) -> str:
    html = SOURCE_HTML.read_text(encoding="utf-8")
    before_script, rest = html.split("  <script>\n", 1)
    _, after_script = rest.split("  </script>", 1)

    before_script = before_script.replace(
        "<title>DD-Индекс - итоговый отчет</title>",
        f"<title>{title}</title>",
    )
    before_script = before_script.replace("</style>", EXTRA_CSS + "\n  </style>")

    data_json = json.dumps(data, ensure_ascii=False, indent=2).replace("</", "<\\/")
    return (
        before_script
        + '  <script id="dd-data2" type="application/json">\n'
        + data_json
        + "\n  </script>\n\n"
        + "  <script>\n"
        + V2_SCRIPT
        + "  </script>"
        + after_script
    )


def main() -> None:
    rows = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    data = build_dd_data2(rows)

    OUTPUT_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    OUTPUT_HTML.write_text(
        build_embedded_html(data, "DD-Индекс - итоговый отчет v2"),
        encoding="utf-8",
    )
    OUTPUT_STANDALONE_HTML.write_text(
        build_embedded_html(data, "DD-Индекс - standalone отчет"),
        encoding="utf-8",
    )

    print(
        "built "
        f"{OUTPUT_JSON.name}, {OUTPUT_HTML.name}, and {OUTPUT_STANDALONE_HTML.name}: "
        f"{len(data['products'])} products, "
        f"{sum(len(block['metrics']) for product in data['products'] for block in product['metrics'])} base metric rows"
    )


if __name__ == "__main__":
    main()
