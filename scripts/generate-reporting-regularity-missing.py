#!/usr/bin/env python3
"""Fill only unscored Q3 reporting/regularity from explicit survey answers; audit existing scores."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERIOD = 'III кв. 2026'
RULE = ('Автоматическая отчётность: наличие=1, регулярность=1; по запросу: наличие=1, '
        'регулярность=0.5; Нет/Затрудняюсь ответить: оба=0. '
        'Заполняются только отсутствующие оценки; ранее выставленные значения сохраняются.')
ALIASES = {'Дети/подростки': 'Дети', 'Персональная рекомендация (кампейнинг)': 'Персональная рекомендация',
           'Вжух': 'SberPay Вжух', 'Страхование путешественников': 'ВЗР',
           'Сберчаевые #B2C': 'СберЧаевые', 'Трансграничные переводы #B2C': 'Трансграничные переводы',
           'Трансграничный эквайринг #B2C': 'Трансграничный эквайринг'}
QUESTION_IDS = {'attract': 'attractConfigured', 'churn': 'churnConfigured',
                'voronka_onbordinga': 'onboardingConfigured', 'voronka_ispolьzovaniya': 'usageConfigured',
                'voronka_vhoda_v_kanal': 'entryConfigured', 'voronka_prodazh': 'salesConfigured',
                'analiz_effektivnostь': 'campaignConfigured'}


def normalize(value):
    return ' '.join(str(value or '').strip().lower().split())


def classify_answer(answer):
    text = normalize(answer)
    if text in {'нет', 'затрудняюсь ответить'}:
        return 0, 0
    if text == 'да, по запросу':
        return 1, .5
    if text.startswith('да, автоматическая'):
        return 1, 1
    return None


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def short_id(product):
    return product['id'].split('::empty::')[0]


def load_responses(csv_paths):
    responses, excluded = [], []
    for path in csv_paths:
        with path.open(encoding='utf-8-sig', newline='') as stream:
            for row, record in enumerate(csv.DictReader(stream, delimiter=';'), 2):
                if str(record.get('Год опроса')) != '2026' or str(record.get('Квартал опроса')) != '3':
                    continue
                payload = json.loads(record['Результат опроса (JSON)'])
                if 'чикин' in normalize(payload.get('respondent', {}).get('name')):
                    excluded.append({'file': str(path.relative_to(ROOT)), 'csvRow': row,
                        'respondent': payload.get('respondent', {}).get('name'),
                        'team': payload['team']['name'], 'reason': 'excluded_test_respondent_by_user'})
                    continue
                responses.append((payload, {'file': str(path.relative_to(ROOT)), 'sha256': sha(path),
                    'csvRow': row, 'surveyId': payload.get('surveyId'), 'completedAt': payload.get('completedAt'),
                    'respondent': payload.get('respondent', {}).get('name'),
                    'originalTeamId': payload['team'].get('id'), 'originalTeamName': payload['team']['name']}))
    return responses, excluded


def matched_responses(product, responses, salary, before):
    cohort = next((team for team in salary['products'] if team['id'] == short_id(product)), None)
    matched = []
    for payload, provenance in responses:
        team = payload['team']
        if cohort:
            match = team['id'] == cohort['baseTeamId'] and normalize(provenance['respondent']) == normalize(cohort['respondent'])
        else:
            match = normalize(ALIASES.get(team['name'], team['name'])) == normalize(product['name']) \
                and normalize(team.get('unit')) == normalize(product['unit']) \
                and (team.get('type') == product['type'] if team.get('type') else sum(
                    normalize(p['name']) == normalize(product['name']) and normalize(p['unit']) == normalize(product['unit'])
                    for p in before) == 1)
        if match:
            matched.append((payload, provenance))
    return matched


def build(snapshot_path, csv_paths, salary_path):
    before = json.loads(snapshot_path.read_text())
    salary = json.loads(salary_path.read_text())
    responses, excluded = load_responses(csv_paths)
    products, mismatches, pending, verified = [], [], [], []
    for product in before:
        identity = {key: product[key] for key in ['name', 'unit', 'type']}
        identity['id'] = short_id(product)
        matched = matched_responses(product, responses, salary, before)
        facts = {}
        for block in product['metrics']:
            report = next((m for m in block['metrics'] if m['code'].endswith('.nastroena_otchetnostь')), None)
            if not report:
                continue
            regularity = next((m for m in block['metrics'] if 'регулярность' in normalize(m.get('name'))), None)
            context = {**identity, 'blockCode': block['code'], 'reportingCode': report['code']}
            if len(matched) != 1:
                pending.append({**context, 'reason': 'ambiguous_response' if matched else 'missing_response',
                                'sources': [source for _, source in matched]})
                continue
            payload, provenance = matched[0]
            reported = next((m for m in payload.get('result', {}).get('metrics', []) if m['code'] == report['code']), {})
            question_id = reported.get('questionId') or QUESTION_IDS.get(block['code'])
            if block['code'] == 'attract' and product['unit'] == 'Data' and 'usageConfigured' in payload['answers']:
                question_id = 'usageConfigured'
            answer = payload['answers'].get(question_id)
            classified = classify_answer(answer)
            source = {**provenance, 'questionId': question_id, 'answer': answer,
                      'questionSource': payload.get('questionSources', {}).get(question_id),
                      'reportFormat': payload['answers'].get(str(question_id or '').replace('Configured', 'ReportFormat')),
                      'reportEvidence': payload['answers'].get(str(question_id or '').replace('Configured', 'Report'))}
            if classified is None:
                pending.append({**context, 'reason': 'missing_answer' if answer is None else 'unsupported_answer', 'source': source})
                continue
            for metric, expected_raw in [(report, classified[0]), (regularity, classified[1])]:
                if not metric:
                    continue
                if metric.get('is_applicabble_flg') is False or not (metric.get('max_value') or 0) > 0:
                    pending.append({**context, 'code': metric['code'], 'reason': 'not_applicable', 'source': source})
                    continue
                context_metric = {**context, 'code': metric['code'], 'metricName': metric.get('name'),
                                  'maxValue': metric['max_value'], 'expectedRawValue': expected_raw,
                                  'expectedValue': expected_raw * metric['max_value'], 'source': source}
                old = metric.get('value')
                if old is None:
                    facts[metric['code']] = {'rawValue': expected_raw, 'expectedMissingValue': None,
                        'expectedMaxValue': metric['max_value'], 'source': {
                            'origin': 'userConfirmedReportingMissingRule', 'confirmedBy': 'user', 'period': PERIOD,
                            **source, 'rule': RULE}}
                elif abs(old / metric['max_value'] - expected_raw) > 1e-9:
                    mismatches.append({**context_metric, 'currentValue': old,
                        'currentRawValue': old / metric['max_value'], 'currentSource': metric.get('source'),
                        'action': 'preserve_existing_score'})
                else:
                    verified.append({**context_metric, 'currentValue': old, 'currentRawValue': old / metric['max_value']})
        if facts:
            products.append({**identity, 'metrics': facts})
    counts = {'teams': len(products), 'fills': sum(len(p['metrics']) for p in products),
              'byRawValue': dict(Counter(str(f['rawValue']) for p in products for f in p['metrics'].values())),
              'mismatches': len(mismatches), 'mismatchTeams': len({r['id'] for r in mismatches}),
              'verified': len(verified), 'pending': len(pending)}
    return {'period': PERIOD, 'scope': 'reporting-regularity-missing-assessment',
            'source': {'rule': RULE, 'snapshotFile': str(snapshot_path.relative_to(ROOT)),
                       'snapshotSha256': sha(snapshot_path), 'csvFiles': [{'file': str(p.relative_to(ROOT)), 'sha256': sha(p)} for p in csv_paths],
                       'salaryFile': str(salary_path.relative_to(ROOT)), 'salarySha256': sha(salary_path),
                       'excludedRespondents': excluded},
            'counts': counts, 'products': products, 'mismatches': mismatches, 'verified': verified, 'pending': pending}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, default=ROOT / 'outputs/reporting-regularity-2026-10-30/before.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'gravity-app/src/data/reporting-regularity-missing-q3-2026.json')
    args = parser.parse_args()
    result = build(args.snapshot, [ROOT / 'questionare-responses(11).csv',
        ROOT / 'analysis/1/questionare-responses(8).csv', ROOT / 'analysis/1/questionare-responses(9).csv'],
        ROOT / 'gravity-app/src/data/salary-products-q3-2026.json')
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    audit_dir = ROOT / 'outputs/reporting-regularity-2026-10-30'
    (audit_dir / 'mismatches.json').write_text(json.dumps(result['mismatches'], ensure_ascii=False, indent=2) + '\n')
    lines = ['# Ранее выставленные оценки сохранены', '',
             '| Команда | Юнит | Воронка | Метрика | Сейчас | По новому правилу | Ответ |',
             '|---|---|---|---|---:|---:|---|']
    labels = {'attract': 'Привлечение', 'churn': 'Отток', 'voronka_onbordinga': 'Онбординг',
              'voronka_ispolьzovaniya': 'Использование', 'voronka_vhoda_v_kanal': 'Вход в канал',
              'voronka_prodazh': 'Продажи', 'analiz_effektivnostь': 'Анализ эффективности'}
    for row in result['mismatches']:
        name = 'Сберчаевые #B2C' if row['name'] == 'СберЧаевые' else row['name']
        lines.append(f"| {name} | {row['unit']} | {labels.get(row['blockCode'], row['blockCode'])} | {row['metricName']} | {row['currentRawValue']} | {row['expectedRawValue']} | {row['source']['answer']} |")
    (audit_dir / 'mismatches.md').write_text('\n'.join(lines) + '\n')
    print(json.dumps(result['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
