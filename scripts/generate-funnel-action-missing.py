#!/usr/bin/env python3
"""Fill two Q3 action metrics from self-reported answers, preserving all assigned scores."""
from __future__ import annotations

import argparse
import importlib.util
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('reporting_survey_sources', ROOT / 'scripts/generate-reporting-regularity-missing.py')
survey = importlib.util.module_from_spec(spec)
spec.loader.exec_module(survey)
PERIOD = 'III кв. 2026'
CODE_QUESTIONS = {'attract.initiatives_list': 'attractDeviations', 'churn.deviation_actions': 'deviations'}
RULE = ('Доверяем самооценке: Да=1, Нет/Затрудняюсь ответить=0; отсутствие ответа или пригодной анкеты=0. '
        'Ссылки не обязательны. Заполняются только пропуски; выставленные оценки сохраняются. '
        'Несовпадающие ответы нескольких респондентов остаются на проверке.')


def score(answer):
    text = survey.normalize(answer)
    if text == 'да':
        return 1
    if text in {'', 'нет', 'затрудняюсь ответить'}:
        return 0
    return None


def build(snapshot_path, csv_paths, salary_path):
    before = json.loads(snapshot_path.read_text())
    salary = json.loads(salary_path.read_text())
    responses, excluded = survey.load_responses(csv_paths)
    products, mismatches, verified, pending = [], [], [], []
    for product in before:
        identity = {key: product[key] for key in ['name', 'unit', 'type']}
        identity['id'] = survey.short_id(product)
        matched = survey.matched_responses(product, responses, salary, before)
        facts = {}
        for block in product['metrics']:
            for metric in block['metrics']:
                code = metric['code']
                if code not in CODE_QUESTIONS:
                    continue
                context = {**identity, 'code': code, 'metricName': metric['name'], 'blockCode': block['code']}
                if metric.get('is_applicabble_flg') is False or not (metric.get('max_value') or 0) > 0:
                    pending.append({**context, 'reason': 'not_applicable'})
                    continue
                sources = []
                for payload, provenance in matched:
                    question_id = CODE_QUESTIONS[code]
                    if code == 'churn.deviation_actions' and product['type'] in {'Канал', 'Сегмент'}:
                        question_id = 'churnDeviations'
                    evidence_id = 'attractDeviationExampleReport' if code.startswith('attract.') else (
                        'churnDeviationExampleReport' if question_id == 'churnDeviations' else 'deviationExampleReport')
                    answer = payload['answers'].get(question_id)
                    sources.append({**provenance, 'questionId': question_id, 'answer': answer,
                        'questionSource': payload.get('questionSources', {}).get(question_id),
                        'evidence': payload['answers'].get(evidence_id),
                        'evidenceFormat': payload['answers'].get(evidence_id + 'Format')})
                answers = {survey.normalize(source['answer']) for source in sources}
                if len(answers) > 1:
                    pending.append({**context, 'reason': 'conflicting_responses', 'sources': sources})
                    continue
                answer = sources[0]['answer'] if sources else None
                raw_value = score(answer)
                if raw_value is None:
                    pending.append({**context, 'reason': 'unsupported_answer', 'sources': sources})
                    continue
                source = {'origin': 'userConfirmedFunnelActionMissingRule', 'confirmedBy': 'user', 'period': PERIOD,
                          'rule': RULE, 'answer': answer, 'sources': sources,
                          'missingReason': 'missing_response' if not sources else 'missing_answer' if not survey.normalize(answer) else None}
                old = metric.get('value')
                if old is None:
                    facts[code] = {'rawValue': raw_value, 'expectedMissingValue': None,
                                   'expectedMaxValue': metric['max_value'], 'source': source}
                else:
                    audit = {**context, 'currentValue': old, 'currentRawValue': old / metric['max_value'],
                             'expectedValue': raw_value * metric['max_value'], 'expectedRawValue': raw_value,
                             'maxValue': metric['max_value'], 'currentSource': metric.get('source'), 'source': source}
                    if abs(audit['currentRawValue'] - raw_value) > 1e-9:
                        mismatches.append({**audit, 'action': 'preserve_existing_score'})
                    else:
                        verified.append(audit)
        if facts:
            products.append({**identity, 'metrics': facts})
    counts = {'teams': len(products), 'fills': sum(len(p['metrics']) for p in products),
              'byRawValue': dict(Counter(str(f['rawValue']) for p in products for f in p['metrics'].values())),
              'byMetricCode': dict(Counter(code for p in products for code in p['metrics'])),
              'missingAsZero': sum(f['source']['missingReason'] is not None for p in products for f in p['metrics'].values()),
              'mismatches': len(mismatches), 'verified': len(verified), 'pending': len(pending)}
    return {'period': PERIOD, 'scope': 'funnel-action-missing-assessment',
            'source': {'rule': RULE, 'snapshotFile': str(snapshot_path.relative_to(ROOT)),
                       'snapshotSha256': survey.sha(snapshot_path),
                       'csvFiles': [{'file': str(p.relative_to(ROOT)), 'sha256': survey.sha(p)} for p in csv_paths],
                       'salaryFile': str(salary_path.relative_to(ROOT)), 'salarySha256': survey.sha(salary_path),
                       'excludedRespondents': excluded},
            'counts': counts, 'products': products, 'mismatches': mismatches, 'verified': verified, 'pending': pending}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, default=ROOT / 'outputs/initiative-actions-2026-10-30/before.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'gravity-app/src/data/funnel-action-missing-q3-2026.json')
    args = parser.parse_args()
    result = build(args.snapshot, [ROOT / 'questionare-responses(11).csv',
        ROOT / 'analysis/1/questionare-responses(8).csv', ROOT / 'analysis/1/questionare-responses(9).csv'],
        ROOT / 'gravity-app/src/data/salary-products-q3-2026.json')
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    folder = ROOT / 'outputs/initiative-actions-2026-10-30'
    (folder / 'mismatches.json').write_text(json.dumps(result['mismatches'], ensure_ascii=False, indent=2) + '\n')
    (folder / 'pending.json').write_text(json.dumps(result['pending'], ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
