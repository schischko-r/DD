#!/usr/bin/env python3
"""Generate the Q3 cross-sell overlay from the local LossHunter snapshot only."""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CODE = 'mehaniki.cross_sell'
PERIOD = 'III кв. 2026'
CRITERION = 'own observed cross-sell OR seen_in_n > 1'
CRITERION_VERSION = 'own-observed-or-incoming-v3'
CRITERION_DESCRIPTION = ('Собственное видео-наблюдение цели в judgements.seen засчитывается самостоятельно, '
                         'даже без пары cross-sell/seen. Строгие пары cross-sell/seen также требуют собственного '
                         'видео-свидетельства. Если все пары той же цели явно имеют nature=activation, '
                         'самостоятельное judgement не засчитывается. Цели между ветками дедуплицируются. '
                         'Дополнительно по указанию пользователя засчитывается seen_in_n > 1 '
                         'в той же сопоставленной строке продукта, без требования собственного исходящего видео.')
OWN_DEFINITION = ('Та же собственная строка продукта содержит judgements.seen для того же нормализованного target; '
                  'связанный ev имеет g=vid/cjx, непустые i/fk и идентификатор aid или run. '
                  'who конкурентов, рыночные ссылки и confirm без собственного видео-свидетельства не считаются подтверждением.')


def mapping_functions(path: Path) -> dict:
    """Evaluate only the existing pure name-mapping definitions; no env/API imports."""
    wanted = {'normalize_crosssell_key', 'crosssell_items_by_name', 'find_crosssell_item', 'CROSSSELL_PRODUCT_NAME_ALIASES',
              'clean_number', 'normalize_lookup_key', 'parse_ai_light', 'unique_non_empty',
              'crosssell_top_action_texts', 'crosssell_count_phrase', 'crosssell_recommendation_texts',
              'crosssell_analytics_link'}
    tree = ast.parse(path.read_text())
    nodes = [node for node in tree.body if (
        isinstance(node, ast.FunctionDef) and node.name in wanted
        or isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in wanted for t in node.targets)
    )]
    import pandas as pd
    namespace = {'Any': Any, 're': re, 'unicodedata': unicodedata, '_PD': pd,
                 'quote': quote, 'urlsplit': urlsplit, 'CROSSSELL_SHOWCASE_URL': 'https://losshunter.ru/showcase/crosssell/',
                 'clean_text': lambda value: '' if value is None else str(value).strip()}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(path), 'exec'), namespace)
    return namespace


def own_evidence(product: dict, target: Any, product_path: str, normalize) -> list[dict]:
    """Link a target to actual observations in this own product row."""
    target_key = normalize(target)
    if not target_key:
        return []
    result = []
    for j, judgement in enumerate(product.get('judgements') or []):
        if judgement.get('k') != 'seen' or normalize(judgement.get('t')) != target_key:
            continue
        for i, evidence in enumerate(judgement.get('ev') or []):
            if (evidence.get('g') in {'vid', 'cjx'} and normalize(evidence.get('i'))
                    and normalize(evidence.get('fk')) and (normalize(evidence.get('aid')) or normalize(evidence.get('run')))):
                result.append({'pointer': f'{product_path}/judgements/{j}/ev/{i}', 'evidence': evidence})
    return result


def build(report_path: Path, export_path: Path, mapping_path: Path) -> dict:
    report = json.loads(report_path.read_text())
    export = json.loads(export_path.read_text())
    mapping = mapping_functions(mapping_path)
    normalize = mapping['normalize_crosssell_key']
    catalog = export['products_response']['products']
    index = mapping['crosssell_items_by_name'](catalog)
    marker_index = mapping['crosssell_items_by_name'](export.get('markers_response', {}).get('markers') or [])
    details = export.get('market_items_response') or {}
    detail_index = {}
    for key, item in details.items():
        name = normalize(item.get('product', {}).get('name'))
        detail_index.setdefault(name, []).append((key, item))
    products = []
    for team in report['products']:
        if normalize(team.get('type')) != 'продукт':
            continue
        metric = next((m for b in team.get('metrics', []) for m in b.get('metrics', []) if m.get('code') == CODE), None)
        own = mapping['find_crosssell_item'](index, team['name'], team.get('unit'))
        catalog_index = next((i for i, item in enumerate(catalog) if item is own), None)
        own_path = f'/products_response/products/{catalog_index}' if own else None
        pairs = own.get('pairs', []) if own else []
        evidence_by_target, excluded = {}, []
        for i, pair in enumerate(pairs):
            strict_pair = pair.get('nature') == 'cross-sell' and pair.get('status') == 'seen'
            linked = own_evidence(own, pair.get('target'), own_path, normalize) if strict_pair else []
            if strict_pair and linked:
                key = normalize(pair.get('target'))
                item = evidence_by_target.setdefault(key, {'kind': 'pair', 'target': pair.get('target'),
                    'pointer': f'{own_path}/pairs/{i}', 'pair': pair, 'ownEvidence': linked, 'pairEvidence': []})
                item['pairEvidence'].append({'pointer': f'{own_path}/pairs/{i}', 'pair': pair})
            else:
                excluded.append({'pointer': f'{own_path}/pairs/{i}', 'pair': pair,
                                 'reason': 'Missing own video observation for the same target' if strict_pair else 'Does not satisfy both strict pair fields'})
        for i, judgement in enumerate(own.get('judgements', []) if own else []):
            if judgement.get('k') == 'seen':
                key = normalize(judgement.get('t'))
                linked = own_evidence(own, judgement.get('t'), own_path, normalize)
                matching_pairs = [pair for pair in pairs if normalize(pair.get('target')) == key]
                activation_only = bool(matching_pairs) and all(pair.get('nature') == 'activation' for pair in matching_pairs)
                if not linked or activation_only:
                    excluded.append({'pointer': f'{own_path}/judgements/{i}', 'judgement': judgement,
                                     'reason': 'All matching pairs explicitly classify this target as activation' if activation_only else 'Missing valid own video observation'})
                    continue
                item = evidence_by_target.setdefault(key, {'kind': 'judgement', 'target': judgement.get('t'),
                    'pointer': f'{own_path}/judgements/{i}', 'judgement': judgement, 'ownEvidence': linked})
                item.setdefault('judgementEvidence', []).append({'pointer': f'{own_path}/judgements/{i}', 'judgement': judgement})
        evidence = list(evidence_by_target.values())
        incoming_count = mapping['clean_number'](own.get('seen_in_n')) if own else None
        incoming_qualifies = incoming_count is not None and incoming_count > 1
        qualifies = bool(evidence) or incoming_qualifies
        detail_hits = detail_index.get(normalize(own.get('name')), []) if own else []
        detail = {}
        if len(detail_hits) == 1:
            key, detail = detail_hits[0]
            for i, candidate in enumerate(detail.get('candidates', [])):
                if candidate.get('status') == 'already':
                    excluded.append({'pointer': f'/market_items_response/{key}/candidates/{i}', 'reason': 'Research already verdict is not a pairs nature/status confirmation', 'candidate': candidate})
        applicable = metric is not None and metric.get('is_applicabble_flg') is not False and float(metric.get('max_value') or 0) > 0
        status = 'missingMetric' if metric is None else 'notApplicable' if not applicable else 'positive' if qualifies else 'zero'
        source = {'file': str(export_path.relative_to(ROOT)), 'system': 'LossHunter', 'criterion': CRITERION,
                  'criterionVersion': CRITERION_VERSION, 'criterionDescription': CRITERION_DESCRIPTION,
                  'ownDefinition': OWN_DEFINITION,
                  'qualifyingCount': len(evidence) + int(incoming_qualifies),
                  'incomingCount': incoming_count, 'incomingQualifies': incoming_qualifies,
                  'incomingEvidence': {'pointer': f'{own_path}/seen_in_n', 'value': own.get('seen_in_n'),
                                       'rule': 'seen_in_n > 1', 'confirmedBy': 'user'} if incoming_qualifies else None,
                  'matched': own is not None, 'catalogName': own.get('name') if own else None,
                  'catalogKey': own.get('key') if own else None, 'catalogUid': own.get('uid') if own else None,
                  'pointer': own_path, 'evidence': evidence, 'evidenceExcluded': excluded,
                  'link': 'https://losshunter.ru/showcase/crosssell/#product=' + quote(str(own.get('uid') or own.get('name')), safe='') if own else None,
                  'zeroMeaning': 'Нет валидного собственного видео-свидетельства и не выполнено seen_in_n > 1; это не утверждение об отсутствии кроссов вообще.',
                  'matchWarning': None if own else 'Продукт не сопоставлен с каталогом LossHunter; отсутствие evidence не подтверждает отсутствие связок.'}
        output_product = {'id': team['id'], 'name': team['name'], 'unit': team['unit'], 'type': team['type'],
                         'status': status, 'matched': own is not None,
                         'baseline': {key: metric.get(key) for key in ['max_value', 'is_applicabble_flg']} if metric else None,
                         'metrics': {CODE: {'rawValue': 0.5 if qualifies else 0, 'source': source}} if applicable else {},
                         'diagnostics': source if not applicable else {'evidenceCount': len(evidence)}}
        marker = mapping['find_crosssell_item'](marker_index, team['name'], team.get('unit'))
        if own is not None:
            marker_block = marker.get('cross_sell') or {} if marker else {}
            number = mapping['clean_number']
            waiting = number(own.get('ai_wait_n'))
            market = detail.get('market') if isinstance(detail.get('market'), dict) else None
            candidates = detail.get('candidates') or []
            if waiting is None and market is not None:
                waiting = float(sum(normalize(candidate.get('status')) == 'wait' for candidate in candidates))
            link = mapping['crosssell_analytics_link'](marker, own)
            light = mapping['parse_ai_light'](marker_block.get('traffic_light')) or mapping['parse_ai_light'](own.get('light')) or 'gray'
            light = 'yellow' if light == 'red' else light
            def api_number(field: str) -> float | None:
                value = number(marker_block.get(field))
                return value if value is not None else number(own.get(field))
            current_value = (0.5 if qualifies else 0) * float(metric['max_value']) if applicable else None
            recommendation = {
                'id': 'cross_sell-1', 'skill_key': 'cross_sell', 'skill_name': 'Cross-sell',
                'block_code': 'mehaniki', 'row_type': 'светофор', 'is_traffic_light': True,
                'indicator': 'Cross-sell: покрытие и рекомендованные действия', 'traffic_light': light,
                'recommendations': mapping['crosssell_recommendation_texts'](marker, own, waiting),
                'month': '', 'is_stale': False, 'stale_tooltip': '', 'ai_products': [own['name']],
                'product_group': team['name'], 'source': 'Product Lens', 'crosssell_marker': bool(marker),
                'dd_crosssell_value': current_value, 'dd_crosssell_max': metric.get('max_value') if metric else None,
                'api_implemented': api_number('implemented'), 'api_crosssell_count': api_number('seen_out_n'),
                'api_seen_out_n': api_number('seen_out_n'), 'api_seen_in_n': api_number('seen_in_n'),
                'api_seen_around_n': api_number('seen_around_n'), 'api_potential_n': api_number('potential_n'),
                'candidates_waiting_decision': waiting,
                'crosssell_top_actions': mapping['crosssell_top_action_texts'](marker),
                'crosssell_uid': own.get('uid') or (marker or {}).get('uid'),
                'crosssell_market': market, 'crosssell_candidates': candidates,
                'crosssell_sources': detail.get('sources') or [],
                'requires_manual_validation': bool(current_value == 0 and metric.get('max_value') == 1
                                                  and (api_number('seen_out_n') or 0) > 1) if metric else False,
            }
            output_product.update({
                'crosssellRecommendations': [recommendation],
                'crosssellTool': {'name': 'Cross-sell', 'kind': 'ai', 'ai_tool_key': 'cross_sell',
                                 'ai_tool_product_name': team['name'], 'traffic_light': light, 'active': light,
                                 'button': {'type': 'general', 'label': 'Перейти', 'link': link},
                                 'footer': 'Product Lens · раунд ' + export['products_response']['meta'].get('round_id', ''),
                                 'crosssell_export': True},
                'crosssell_uid': recommendation['crosssell_uid'], 'crosssell_market': market,
                'crosssell_candidates': candidates, 'crosssell_sources': recommendation['crosssell_sources'],
            })
        products.append(output_product)
    counts = {status: sum(p['status'] == status for p in products) for status in ['positive', 'zero', 'notApplicable', 'missingMetric']}
    counts.update(products=len(products), unmatched=sum(not p['matched'] for p in products))
    return {'period': PERIOD, 'source': {'file': str(export_path.relative_to(ROOT)),
            'sha256': hashlib.sha256(export_path.read_bytes()).hexdigest(),
            'reportFile': str(report_path.relative_to(ROOT)), 'reportSha256': hashlib.sha256(report_path.read_bytes()).hexdigest(),
            'mappingFile': str(mapping_path.relative_to(ROOT)), 'mappingSha256': hashlib.sha256(mapping_path.read_bytes()).hexdigest(),
            'snapshot': export['products_response'].get('meta'), 'criterion': CRITERION, 'ownDefinition': OWN_DEFINITION,
            'criterionVersion': CRITERION_VERSION, 'criterionDescription': CRITERION_DESCRIPTION,
            'scoring': 'Есть цель с валидным собственным видео-свидетельством ИЛИ seen_in_n > 1 в сопоставленной строке продукта: 0.5 прежнего max; иначе 0. Это 100% компонента во время оформления. Максимумы и применимость не меняются.',
            'excludedSignals': 'market already, sc_rows, implemented и who конкурентов не создают баллы. Standalone judgements.seen разрешены пользователем без nature; явно известная activation исключается.',
            'identity': 'Каталог сопоставляется существующими DDI name aliases; собственные пары сохраняются по строке продукта, не по неуникальному key. Research details only unique exact normalized product.name.'},
            'counts': counts, 'recommendationCounts': {
                'products': sum(bool(p.get('crosssellRecommendations')) for p in products),
                'productsWithTopActions': sum(bool(p.get('crosssellRecommendations', [{}])[0].get('crosssell_top_actions')) for p in products),
            }, 'products': products,
            'zeroProducts': [p['name'] for p in products if p['status'] == 'zero'],
            'unmatchedProducts': [p['name'] for p in products if not p['matched']]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'gravity-app/src/data/crosssell-metrics-q3-2026.json')
    args = parser.parse_args()
    result = build(ROOT/'gravity-app/public/report-data.json', ROOT/'crosssell_export.json', ROOT/'build_calc_report.py')
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
