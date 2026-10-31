#!/usr/bin/env python3
"""Persist confirmed Q3 tribe goal scores and exclude zero-denominator metrics."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'gravity-app/src/data/goals-tribe-source-q3-2026.json'
CODES = {'goals.monitored', 'goals.forecast', 'goals.factor_analysis_l1_l2'}


def build(report_path):
    config = json.loads(SOURCE.read_text())
    report = json.loads(report_path.read_text())['products']
    rows = {(r['unit'], r['tribe']): r for r in config['rows']}
    assert len(rows) == len(config['rows'])
    scores, applicability = [], []
    identities = set()
    for assignment in config['assignments']:
        identity = {k: assignment[k] for k in ['id', 'name', 'unit', 'type']}
        assert assignment['id'] not in identities
        identities.add(assignment['id'])
        matches = [p for p in report if all(p[k] == v for k, v in identity.items())]
        assert len(matches) == 1, identity
        row = rows[(assignment['sourceUnit'], assignment['sourceTribe'])]
        assert set(row['scores']) == CODES
        scored, excluded = {}, {}
        for code, value in row['scores'].items():
            source = {**{k: config['source'][k] for k in ['origin', 'confirmedBy', 'date']},
                      'period': config['period'],
                      'sourceFile': str(SOURCE.relative_to(ROOT)),
                      'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                      'sourceUnit': row['unit'], 'sourceTribe': row['tribe'],
                      'catalogTribe': assignment['catalogTribe'], 'metricCode': code}
            if value is None:
                excluded[code] = {'applicable': False, 'hiddenFromProfile': True,
                                  'source': {**source, 'zeroDenominator': True}}
            else:
                assert value in [0, 1]
                scored[code] = {'rawValue': value, 'source': source}
        if scored:
            scores.append({**identity, 'metrics': scored})
        if excluded:
            applicability.append({**identity, 'metrics': excluded})
    def batch(scope, products):
        return {'period': config['period'], 'scope': scope, 'source': config['source'],
                'products': products, 'counts': {'teams': len(products),
                    'facts': sum(len(p['metrics']) for p in products)}}
    return (batch('goals-assessment', scores),
            batch('metric-applicability-assessment', applicability))


if __name__ == '__main__':
    scores, applicability = build(ROOT / 'gravity-app/public/report-data.json')
    for filename, data in [('goals-tribe-assessments-q3-2026.json', scores),
                           ('goals-tribe-applicability-q3-2026.json', applicability)]:
        (ROOT / 'gravity-app/src/data' / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        print(filename, data['counts'])
