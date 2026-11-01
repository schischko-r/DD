#!/usr/bin/env python3
"""Collect every survey CSV record with lossless field values and inspectable provenance.

No respondent, period or duplicate is removed. csvRow uses logical CSV records,
matching the repository's existing survey provenance; physical line bounds are
also kept for records containing quoted newlines.
"""
from __future__ import annotations

import argparse
import ast
import csv
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JSON_COLUMN = 'Результат опроса (JSON)'
URL = re.compile(r'https?://[^\s<>"\']+', re.IGNORECASE)


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def urls(value):
    if isinstance(value, dict):
        return [url for child in value.values() for url in urls(child)]
    if isinstance(value, list):
        return [url for child in value for url in urls(child)]
    return URL.findall(value) if isinstance(value, str) else []


def normalize(value):
    return ' '.join(str(value or '').strip().lower().split())


def mappings(root: Path):
    generator = root / 'scripts' / 'generate-reporting-regularity-missing.py'
    tree = ast.parse(generator.read_text(encoding='utf-8'))
    aliases = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.Assign)
                   and any(isinstance(target, ast.Name) and target.id == 'ALIASES' for target in node.targets))
    catalog = json.loads((root / 'gravity-app/public/report-data.json').read_text(encoding='utf-8'))['products']
    salary = json.loads((root / 'gravity-app/src/data/salary-products-q3-2026.json').read_text(encoding='utf-8'))
    vetted = json.loads((root / 'gravity-app/src/data/reporting-regularity-missing-q3-2026.json').read_text(encoding='utf-8'))
    excluded = []
    for item in vetted['source'].get('excludedRespondents', []):
        path = root / item['file']
        if path.exists() and item.get('reason') == 'excluded_test_respondent_by_user':
            excluded.append({**item, 'sha256': digest(path.read_bytes()),
                             'evidence': 'gravity-app/src/data/reporting-regularity-missing-q3-2026.json.source.excludedRespondents'})
    return catalog, aliases, salary, excluded


def map_team(record, catalog, aliases, salary):
    raw = record['team']
    respondent = normalize(record['respondent'])
    cohort = next((item for item in salary['products'] if raw.get('id') == item['baseTeamId']
                   and respondent == normalize(item.get('respondent'))), None)
    if cohort:
        parent = next(item for item in catalog if item['id'] == cohort['baseTeamId'])
        return {'canonicalTeam': {key: parent[key] for key in ['id', 'name', 'unit', 'type']},
                'cohort': cohort['cohort'], 'cohortTeamId': cohort['id'], 'mappingMethod': 'salaryExactRespondent',
                'mappingSource': 'gravity-app/src/data/salary-products-q3-2026.json'}
    exact = [item for item in catalog if item['id'] == raw.get('id')]
    method = 'exactTeamId'
    if not exact:
        name = aliases.get(raw.get('name'), raw.get('name'))
        exact = [item for item in catalog if normalize(item['name']) == normalize(name)
                 and normalize(item['unit']) == normalize(raw.get('unit'))
                 and (not raw.get('type') or normalize(item['type']) == normalize(raw['type']))]
        method = 'explicitProductionAlias' if raw.get('name') in aliases else 'exactNameUnitType'
    if len(exact) != 1:
        return {'canonicalTeam': None, 'mappingMethod': 'unmapped' if not exact else 'ambiguous',
                'mappingCandidates': [{key: item[key] for key in ['id', 'name', 'unit', 'type']} for item in exact]}
    return {'canonicalTeam': {key: exact[0][key] for key in ['id', 'name', 'unit', 'type']},
            'mappingMethod': method, 'mappingSource': 'scripts/generate-reporting-regularity-missing.py.ALIASES' if method == 'explicitProductionAlias' else 'gravity-app/public/report-data.json.products'}


def collect(root: Path):
    catalog, aliases, salary, excluded = mappings(root)
    paths = sorted(set([*root.glob('questionare-responses*.csv'),
                        *(root / 'ddi_3q_response').glob('questionare-responses*.csv'),
                        *(root / 'analysis' / '1').glob('questionare-responses*.csv')]),
                   key=lambda path: path.relative_to(root).as_posix())
    files, responses, errors = [], [], []
    canonical_payloads, duplicate_files = {}, {}
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    for path in paths:
        relative = path.relative_to(root).as_posix()
        sha = digest(path.read_bytes())
        metadata = {'file': relative, 'sha256': sha, 'bytes': path.stat().st_size,
                    'encoding': 'utf-8-sig', 'delimiter': ';', 'records': 0,
                    'duplicateBytesOf': duplicate_files.get(sha)}
        duplicate_files.setdefault(sha, relative)
        with path.open(encoding='utf-8-sig', newline='') as stream:
            reader = csv.reader(stream, delimiter=';')
            headers = next(reader, [])
            metadata['headers'] = headers
            metadata['duplicateHeaders'] = [key for key, count in Counter(headers).items() if count > 1]
            previous_end = reader.line_num
            for logical_row, cells in enumerate(reader, 2):
                physical_start, physical_end = previous_end + 1, reader.line_num
                previous_end = physical_end
                # rawCells + file headers retain duplicate columns, empty fields,
                # embedded newlines and even fields beyond the header length.
                raw_fields = {key: cells[index] if index < len(cells) else None
                              for index, key in enumerate(headers)}
                raw_json = raw_fields.get(JSON_COLUMN)
                payload, parse_error = None, None
                if raw_json:
                    try:
                        payload = json.loads(raw_json)
                    except (TypeError, ValueError) as exc:
                        parse_error = str(exc)
                        errors.append({'file': relative, 'csvRow': logical_row, 'error': parse_error})
                else:
                    parse_error = 'Missing survey result JSON'
                    errors.append({'file': relative, 'csvRow': logical_row, 'error': parse_error})
                structured = payload if isinstance(payload, dict) else {}
                answers = structured.get('answers') or {}
                result = structured.get('result') or {}
                respondent = structured.get('respondent') or {}
                canonical = (digest(json.dumps(payload, ensure_ascii=False, sort_keys=True,
                                               separators=(',', ':')).encode('utf-8'))
                             if payload is not None else None)
                key = f'{relative}:{logical_row}'
                duplicate_of = canonical_payloads.get(canonical) if canonical else None
                if canonical:
                    canonical_payloads.setdefault(canonical, key)
                record = {
                    'recordId': key, 'file': relative, 'sha256': sha, 'csvRow': logical_row,
                    'physicalLineStart': physical_start, 'physicalLineEnd': physical_end,
                    'year': raw_fields.get('Год опроса'), 'quarter': raw_fields.get('Квартал опроса'),
                    'team': structured.get('team') or {},
                    'respondent': respondent.get('name') if isinstance(respondent, dict) else respondent,
                    'completedAt': structured.get('completedAt'), 'surveyId': structured.get('surveyId'),
                    'answers': answers, 'metrics': result.get('metrics') or [] if isinstance(result, dict) else [],
                    'questionRows': structured.get('questionRows') or {},
                    'questionSources': structured.get('questionSources') or {},
                    'urls': sorted(set(urls(payload))), 'payloadSha256': canonical,
                    'duplicatePayloadOf': duplicate_of,
                    'payload': payload, 'rawFields': raw_fields, 'rawCells': cells,
                }
                if parse_error:
                    record['parseError'] = parse_error
                if len(cells) != len(headers):
                    record['fieldCountMismatch'] = {'headers': len(headers), 'fields': len(cells)}
                record.update(map_team(record, catalog, aliases, salary))
                exclusions = [item for item in excluded if item['sha256'] == sha and item['csvRow'] == logical_row
                              and normalize(item['respondent']) == normalize(record['respondent'])]
                record['excludedByConfirmedUserInstruction'] = bool(exclusions)
                if exclusions:
                    record['exclusionEvidence'] = exclusions
                responses.append(record)
                metadata['records'] += 1
        files.append(metadata)
    unique = {}
    for record in responses:
        key = record['payloadSha256'] or record['recordId']
        if key not in unique:
            unique[key] = {field: value for field, value in record.items() if field not in ['rawFields', 'rawCells', 'duplicatePayloadOf']}
            unique[key]['sources'] = []
        unique[key]['sources'].append({field: record[field] for field in ['file', 'sha256', 'csvRow', 'physicalLineStart', 'physicalLineEnd', 'recordId']})
    unique_responses = list(unique.values())
    return {'schemaVersion': 2, 'selectionPolicy': 'responses deduplicates identical full payloads only; rawResponses retains every CSV record. Confirmed test exclusions are flagged, not deleted. No fuzzy team or respondent matching.',
            'files': files, 'responses': unique_responses, 'rawResponses': responses, 'errors': errors,
            'counts': {'files': len(files), 'records': len(responses), 'parseErrors': len(errors),
                       'uniquePayloads': len(canonical_payloads),
                       'normalizedResponses': len(unique_responses),
                       'confirmedExcludedResponses': sum(bool(row['excludedByConfirmedUserInstruction']) for row in unique_responses),
                       'mappingMethods': dict(Counter(row['mappingMethod'] for row in unique_responses)),
                       'canonicalTeamIds': len({row['canonicalTeam']['id'] for row in unique_responses if row['canonicalTeam']}),
                       'duplicatePayloadRecords': sum(bool(row['duplicatePayloadOf']) for row in responses)}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--output', type=Path, default=Path(__file__).with_name('responses-lossless.json'))
    args = parser.parse_args()
    data = collect(args.root.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'output': str(args.output), **data['counts'],
                      'files': [{'file': entry['file'], 'records': entry['records'], 'sha256': entry['sha256'],
                                 'duplicateBytesOf': entry['duplicateBytesOf']} for entry in data['files']]},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()
