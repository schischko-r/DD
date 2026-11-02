#!/usr/bin/env python3
"""Import only nonempty correction cells for the UB unit, never existing workbook scores."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import openpyxl

PERIOD = 'III кв. 2026'
SHEET = 'Метрики'
UNIT = 'УБ'
SCOPE = 'ub-workbook-corrections'
ORIGIN = 'userConfirmedUbWorkbookCorrections'


def normalize(value):
    return ' '.join(str(value or '').strip().casefold().replace('ё', 'е').split())


def build(workbook_path, profiles, date='2026-11-02'):
    workbook_path = Path(workbook_path)
    workbook = openpyxl.load_workbook(workbook_path, data_only=False, read_only=True)
    try:
        sheet = workbook[SHEET]
        if normalize(sheet['F6'].value) != normalize('Корректировка'):
            raise ValueError('Expected correction header in F6')
        products, cells, pending = {}, [], []
        for row in sheet.iter_rows(min_row=7, max_col=6):
            # Reject other units before reading their correction value.
            if normalize(row[0].value) != normalize(UNIT):
                continue
            correction = row[5].value
            if correction is None or isinstance(correction, str) and not correction.strip():
                continue
            unit, name, block_name, metric_name = [cell.value for cell in row[:4]]
            cell = row[5].coordinate
            if correction == '?':
                pending.append({'cell': cell, 'team': name, 'metric': metric_name, 'reason': 'no_numeric_correction'})
                continue
            not_applicable = normalize(correction) in {'не релевантно', 'не применимо', 'неприменимо'}
            if not not_applicable and (isinstance(correction, bool) or not isinstance(correction, (int, float))
                                       or not 0 <= correction <= 1):
                raise ValueError(f'{cell}: unsupported correction {correction!r}')
            teams = [p for p in profiles if p['unit'] == UNIT and normalize(p['name']) == normalize(name)
                     and p.get('period') == PERIOD]
            if len(teams) != 1:
                raise ValueError(f'{cell}: ambiguous team {name!r}')
            team = teams[0]
            metrics = [m for block in team['metrics'] if normalize(block['name']) == normalize(block_name)
                       for m in block['metrics']]
            component = {'Cross-sell во время продажи': 'during', 'Cross-sell после оформления': 'after'}.get(metric_name)
            matches = [m for m in metrics if m['code'] == 'mehaniki.cross_sell'] if component else [
                m for m in metrics if normalize(m['name']) == normalize(metric_name)]
            if len(matches) != 1:
                raise ValueError(f'{cell}: ambiguous metric {name!r} / {block_name!r} / {metric_name!r}')
            metric = matches[0]
            if not not_applicable and (metric.get('is_applicabble_flg') is False or not metric.get('max_value', 0) > 0):
                raise ValueError(f'{cell}: numeric correction to a non-applicable metric requires explicit activation')
            code = metric['code'] + ('.' + component if component else '')
            identity = {key: team[key] for key in ['name', 'unit', 'type']}
            identity['id'] = team['id'].split('::empty::')[0]
            record = products.setdefault(identity['id'], {**identity, 'metrics': {}})
            if code in record['metrics']:
                raise ValueError(f'{cell}: duplicate correction for {name!r} / {code}')
            source = {'origin': ORIGIN, 'confirmedBy': 'user', 'date': date, 'period': PERIOD,
                      'file': workbook_path.name, 'sheet': SHEET, 'column': 'F', 'columnLabel': 'Корректировка',
                      'cell': cell, 'sourceUnit': UNIT, 'sourceTeam': name, 'sourceBlock': block_name,
                      'sourceMetric': metric_name, 'rawCorrection': correction}
            fact = {'applicable': False, 'source': source} if not_applicable else {'rawValue': correction, 'source': source}
            record['metrics'][code] = fact
            cells.append(cell)
        return {'period': PERIOD, 'scope': SCOPE, 'unit': UNIT,
                'source': {'origin': ORIGIN, 'confirmedBy': 'user', 'date': date, 'file': workbook_path.name,
                           'sha256': hashlib.sha256(workbook_path.read_bytes()).hexdigest(), 'sheet': SHEET,
                           'column': 'F', 'columnLabel': 'Корректировка', 'unitFilter': UNIT,
                           'rule': 'Только непустые корректировки столбца F юнита УБ. Остальные строки и юниты не импортируются.'},
                'products': list(products.values()), 'pending': pending,
                'counts': {'teams': len(products), 'corrections': len(cells), 'pending': len(pending)},
                'importedCells': cells}
    finally:
        workbook.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--profiles', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = build(args.input, json.loads(args.profiles.read_text()))
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
