"""Carry two explicitly requested metric assessments from Q2 to Q3."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'gravity-app/public/report-data.json'
OUTPUT = ROOT / 'gravity-app/src/data/selected-metrics-carry-forward-q3-2026.json'
METRICS = {'mehaniki.gibkoe_izmenenie_usloviy_produkta': 'mehaniki', 'hyp.extra_initiatives': 'hyp'}


def build(source: Path = SOURCE) -> dict:
    products = []
    counts = {code: 0 for code in METRICS}
    for product in json.loads(source.read_text(encoding='utf-8'))['products']:
        if product['period'] != 'II кв. 2026':
            continue
        facts = {}
        for block in product['metrics']:
            for metric in block['metrics']:
                code = metric['code']
                if METRICS.get(code) != block['code'] or metric.get('is_applicabble_flg') is False or metric['max_value'] <= 0:
                    continue
                value, maximum = metric['value'], metric['max_value']
                if not isinstance(value, (int, float)) or not 0 <= value <= maximum:
                    raise ValueError(f'Invalid Q2 assessment: {product["name"]} / {code}')
                facts[code] = {'rawValue': value / maximum, 'source': {
                    'origin': 'priorQuarterCarryForward', 'fromPeriod': 'II кв. 2026', 'period': 'III кв. 2026',
                    'confirmedBy': 'user', 'confirmedAt': '2026-10-29', 'sourceName': product['name'],
                    'sourceMetricCode': code, 'sourceValue': value, 'sourceMaxValue': maximum,
                }}
                counts[code] += 1
        if facts:
            products.append({**{key: product[key] for key in ('id', 'name', 'unit', 'type')}, 'metrics': facts})
    return {'period': 'III кв. 2026', 'scope': 'selected-metrics-carry-forward',
            'source': {'file': str(source.relative_to(ROOT)), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                       'rule': 'Preserve the exact Q2 assessment, including zero and partial scores. Applicability and weights are unchanged.'},
            'products': products, 'counts': {'teams': len(products), 'facts': sum(counts.values()), 'byMetric': counts}}


if __name__ == '__main__':
    OUTPUT.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
