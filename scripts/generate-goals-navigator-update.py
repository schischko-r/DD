#!/usr/bin/env python3
"""Persist BNPL Q2 goals and fill Q3 Navigator blanks for fully assessed Russian market knowledge."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERIOD = 'III кв. 2026'
MARKET_CODE = 'general.obъem_celevogo_rynka_v_rossii'
NAVIGATOR_CODE = 'general.navigator_reporting_knowledge'
GOAL_CODES = ['goals.monitored', 'goals.factor_analysis_l1_l2', 'goals.forecast']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metrics(product):
    return {metric['code']: metric for block in product['metrics'] for metric in block['metrics']}


def identity(product):
    return {**{key: product[key] for key in ['name', 'unit', 'type']},
            'id': product['id'].split('::empty::')[0]}


def full_score(metric):
    return bool(metric and metric.get('is_applicabble_flg') is not False
                and isinstance(metric.get('value'), (int, float)) and math.isfinite(metric['value'])
                and isinstance(metric.get('max_value'), (int, float)) and math.isfinite(metric['max_value'])
                and metric['max_value'] > 0 and metric['value'] == metric['max_value'])


def build(snapshot_path, report_path):
    before = json.loads(snapshot_path.read_text())
    q2 = json.loads(report_path.read_text())['products']
    bnpl = next(p for p in before if p['name'] == 'BNPL' and p['unit'] == 'CBP' and p['type'] == 'Продукт')
    prior_matches = [p for p in q2 if identity(p) == identity(bnpl) and p['period'] == 'II кв. 2026']
    assert len(prior_matches) == 1
    prior = prior_matches[0]
    goal_facts = {}
    for code in GOAL_CODES:
        current, previous = metrics(bnpl)[code], metrics(prior)[code]
        assert current['value'] is None, (code, 'An assigned score must not be overwritten')
        assert current.get('is_applicabble_flg') is not False and previous.get('is_applicabble_flg') is not False
        assert current['max_value'] == previous['max_value'] > 0
        raw = previous['value'] / previous['max_value']
        assert raw in [0, .5, 1]
        goal_facts[code] = {'rawValue': raw, 'source': {
            'origin': 'userConfirmedBnplGoalsCarryForward', 'confirmedBy': 'user', 'period': PERIOD,
            'fromPeriod': prior['period'], 'file': str(report_path.relative_to(ROOT)), 'sha256': sha(report_path),
            'sourceTeamId': prior['id'], 'sourceMetricCode': code,
            'sourceValue': previous['value'], 'sourceMaxValue': previous['max_value'],
            'rule': 'Для BNPL три оценки целей III квартала переносятся без изменений из II квартала.'}}
    common = {'snapshotFile': str(snapshot_path.relative_to(ROOT)), 'snapshotSha256': sha(snapshot_path),
              'confirmedBy': 'user', 'date': '2026-10-30'}
    goals = {'period': PERIOD, 'scope': 'goals-assessment', 'source': common,
             'products': [{**identity(bnpl), 'metrics': goal_facts}], 'counts': {'teams': 1, 'facts': len(goal_facts)}}
    nav_products, verified, mismatches = [], [], []
    qualified = 0
    for product in before:
        rubric = metrics(product)
        market, navigator = rubric.get(MARKET_CODE), rubric.get(NAVIGATOR_CODE)
        if not full_score(market) or not navigator or navigator.get('is_applicabble_flg') is False or not navigator['max_value'] > 0:
            continue
        qualified += 1
        proof = {'sourceMetricCode': MARKET_CODE, 'sourceValue': market['value'],
                 'sourceMaxValue': market['max_value'], 'sourceRawValue': market['value'] / market['max_value'],
                 'sourcePeriod': product['period'], 'marketSource': market.get('source')}
        if navigator['value'] is not None:
            record = {**identity(product), 'currentValue': navigator['value'],
                      'currentRawValue': navigator['value'] / navigator['max_value'], **proof}
            (verified if full_score(navigator) else mismatches).append(record)
            continue
        nav_products.append({**identity(product), 'metrics': {NAVIGATOR_CODE: {'rawValue': 1, 'source': {
            'origin': 'userConfirmedNavigatorMarketKnowledgeRule', 'confirmedBy': 'user', 'period': PERIOD,
            'file': str(snapshot_path.relative_to(ROOT)), 'sha256': sha(snapshot_path), **proof,
            'rule': 'Полная нормированная оценка объёма целевого рынка в России означает 1 по знанию отчётности в Навигаторе. Заполняются только пропуски; максимум метрики сохраняется.'}}}})
    navigator = {'period': PERIOD, 'scope': 'key-metrics-assessment', 'source': common,
                 'products': nav_products, 'verified': verified, 'mismatches': mismatches,
                 'counts': {'qualifyingTeams': qualified, 'teams': len(nav_products), 'facts': len(nav_products),
                            'alreadyFull': len(verified), 'mismatches': len(mismatches)}}
    return goals, navigator


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, default=ROOT / 'outputs/goals-navigator-update-2026-10-30/before.json')
    args = parser.parse_args()
    goals, navigator = build(args.snapshot, ROOT / 'gravity-app/public/report-data.json')
    for name, value in [('goals-user-carry-forward-q3-2026.json', goals),
                        ('navigator-market-knowledge-q3-2026.json', navigator)]:
        (ROOT / 'gravity-app/src/data' / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'goals': goals['counts'], 'navigator': navigator['counts']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
