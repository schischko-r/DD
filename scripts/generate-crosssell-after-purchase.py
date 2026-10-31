"""Extract post-purchase cross-sell answers without assigning DDI scores."""
from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'questionare-uplifts(7).csv'
OUTPUT = ROOT / 'gravity-app/src/data/crosssell-after-purchase-q3-2026.json'
QUESTION = 'Настроена ли у вас механика Cross-sell после оформления продукта?'


def build(source: Path = SOURCE, report: Path = ROOT / 'gravity-app/public/report-data.json') -> dict:
    products = json.loads(report.read_text(encoding='utf-8'))['products']
    groups: dict[str, dict] = {}
    unmatched = []
    with source.open(encoding='utf-8-sig', newline='') as stream:
        for record, row in enumerate(csv.DictReader(stream, delimiter=';'), 2):
            if row['Вопрос'].strip() != QUESTION:
                continue
            source_name = row['Команда'].strip()
            name = {'Вжух': 'SberPay Вжух'}.get(source_name, source_name)
            matches = [p for p in products if p['name'] == name and p['type'] == 'Продукт']
            response = {'answer': row['Ответ участника'].strip(), 'respondent': row['ФИО'].strip(),
                        'respondentId': row['Участник'].strip(), 'confirmation': row['Подтверждение'].strip(),
                        'comment': row['Комментарий'].strip(), 'sourceName': source_name, 'sourceRecord': record}
            if len(matches) != 1:
                unmatched.append(response)
                continue
            product = matches[0]
            group = groups.setdefault(product['id'], {key: product[key] for key in ('id', 'name', 'unit', 'type')})
            group.setdefault('responses', []).append(response)
    return {'period': 'III кв. 2026', 'question': QUESTION,
            'source': {'file': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()},
            'products': list(groups.values()), 'unmatchedResponses': unmatched}


if __name__ == '__main__':
    OUTPUT.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
