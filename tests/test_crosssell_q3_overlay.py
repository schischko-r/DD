import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('crosssell_q3_generator', ROOT / 'scripts/generate-crosssell-q3-overlay.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def test_real_regeneration_matches_overlay_and_preserves_sources():
    paths = [ROOT / 'gravity-app/public/report-data.json', ROOT / 'crosssell_export.json', ROOT / 'build_calc_report.py']
    hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in paths]
    generated = generator.build(*paths)
    saved = json.loads((ROOT / 'gravity-app/src/data/crosssell-metrics-q3-2026.json').read_text())
    assert generated == saved
    assert hashes[0] == '7bc87923fb0c187cb63c436a279d2434cbba969958359473e2757aed8594322b'
    assert hashes == [hashlib.sha256(path.read_bytes()).hexdigest() for path in paths]


def test_diagnostics_already_and_competitor_examples_never_count_as_own_strict_pairs(tmp_path, monkeypatch):
    monkeypatch.setattr(generator, 'ROOT', tmp_path)
    mapping = tmp_path / 'mapping.py'
    mapping.write_bytes((ROOT / 'build_calc_report.py').read_bytes())
    teams = []
    for name in ['Only diagnostics', 'Own positive', 'Not applicable', 'No metric']:
        metric = {'code': generator.CODE, 'value': 0, 'max_value': 1, 'is_applicabble_flg': True}
        if name == 'Not applicable':
            metric.update(max_value=0, is_applicabble_flg=False)
        teams.append({'id': name, 'name': name, 'unit': 'DB', 'type': 'Продукт', 'metrics': [{'code': 'mehaniki', 'metrics': [] if name == 'No metric' else [metric]}]})
    diagnostic_pairs = [
        {'target': 'Competitor example', 'status': 'market', 'nature': 'cross-sell', 'who': [{'p': 'Competitor'}]},
        {'target': 'Activation', 'status': 'seen', 'nature': 'activation'},
        {'target': 'Already verdict', 'status': 'already', 'nature': 'cross-sell'},
        {'target': 'Missing nature', 'status': 'seen'},
        {'target': 'Competitor-only seen cross', 'status': 'seen', 'nature': 'cross-sell', 'who': [{'p': 'Competitor'}]},
    ]
    products = [
        {'name': 'Only diagnostics', 'unit': 'DB', 'uid': 'diagnostic', 'key': 'shared-key', 'pairs': diagnostic_pairs, 'judgements': [{'k': 'seen', 't': 'Judgement only'}], 'sc_rows': [{'group': 'work'}], 'implemented': 9},
        {'name': 'Own positive', 'unit': 'DB', 'uid': 'positive', 'key': 'shared-key', 'pairs': [{'target': 'Own observed target', 'nature': 'cross-sell', 'status': 'seen'}], 'judgements': [{'k': 'seen', 't': 'Own observed target', 'ev': [{'g': 'vid', 'fk': 'own-frame', 'aid': 'own-clip', 'i': 'Seen in own product'}]}]},
        {'name': 'Not applicable', 'unit': 'DB', 'uid': 'NA', 'key': 'NA', 'pairs': [{'target': 'Seen but irrelevant', 'nature': 'cross-sell', 'status': 'seen'}]},
    ]
    payload = {'products_response': {'products': products, 'meta': {'round_id': 'fixture'}}, 'market_items_response': {'diagnostic': {'product': {'name': 'Only diagnostics'}, 'candidates': [{'target': 'Research only', 'status': 'already'}]}}}
    report = tmp_path / 'report.json'
    export = tmp_path / 'api.json'
    report.write_text(json.dumps({'products': teams}))
    export.write_text(json.dumps(payload))
    result = generator.build(report, export, mapping)
    records = {p['name']: p for p in result['products']}
    zero = records['Only diagnostics']['metrics'][generator.CODE]
    assert zero['rawValue'] == 0
    assert zero['source']['evidence'] == []
    assert len(zero['source']['evidenceExcluded']) == 7
    assert records['Only diagnostics']['status'] == 'zero'
    assert records['Own positive']['metrics'][generator.CODE]['rawValue'] == 0.5
    assert records['Own positive']['metrics'][generator.CODE]['source']['catalogUid'] == 'positive'
    assert records['Not applicable']['metrics'] == {}
    assert records['Not applicable']['status'] == 'notApplicable'
    assert records['No metric']['status'] == 'missingMetric'
    assert records['No metric']['matched'] is False
    assert records['No metric']['diagnostics']['matchWarning']


def test_standalone_own_seen_qualifies_but_activation_and_invalid_proof_do_not(tmp_path, monkeypatch):
    monkeypatch.setattr(generator, 'ROOT', tmp_path)
    mapping = tmp_path / 'mapping.py'
    mapping.write_bytes((ROOT / 'build_calc_report.py').read_bytes())
    valid = {'g': 'vid', 'fk': 'frame', 'aid': 'clip', 'i': 'Own observed interface'}
    cases = [
        ('Standalone', [], [{'k': 'seen', 't': 'Own target', 'ev': [valid]}], .5, 1),
        ('Activation blocked', [{'target': 'Own target', 'nature': 'activation', 'status': 'seen'}], [{'k': 'seen', 't': 'Own target', 'ev': [valid]}], 0, 0),
        ('Duplicate target', [{'target': 'Own target', 'nature': 'cross-sell', 'status': 'seen'}], [{'k': 'seen', 't': '  OWN  target ', 'ev': [valid]}, {'k': 'seen', 't': 'Own target', 'ev': [valid]}], .5, 1),
        ('Missing frame', [], [{'k': 'seen', 't': 'Own target', 'ev': [{**valid, 'fk': ''}]}], 0, 0),
        ('Market only', [{'target': 'Own target', 'nature': 'cross-sell', 'status': 'market', 'who': [{'p': 'Competitor'}]}], [], 0, 0),
    ]
    teams = [{'id': name, 'name': name, 'unit': 'DB', 'type': 'Продукт', 'metrics': [{'code': 'mehaniki', 'metrics': [{'code': generator.CODE, 'value': 0, 'max_value': 1, 'is_applicabble_flg': True}]}]} for name, *_ in cases]
    products = [{'name': name, 'unit': 'DB', 'uid': name, 'key': name, 'pairs': pairs, 'judgements': judgements} for name, pairs, judgements, *_ in cases]
    report, export = tmp_path / 'report.json', tmp_path / 'api.json'
    report.write_text(json.dumps({'products': teams}))
    export.write_text(json.dumps({'products_response': {'products': products, 'meta': {}}}))
    records = {p['name']: p for p in generator.build(report, export, mapping)['products']}
    for name, _, _, value, count in cases:
        fact = records[name]['metrics'][generator.CODE]
        assert fact['rawValue'] == value, name
        assert fact['source']['qualifyingCount'] == count, name
    standalone = records['Standalone']['metrics'][generator.CODE]['source']['evidence'][0]
    assert standalone['kind'] == 'judgement'
    assert standalone['ownEvidence'][0]['evidence'] == valid
    duplicate = records['Duplicate target']['metrics'][generator.CODE]['source']['evidence'][0]
    assert duplicate['kind'] == 'pair'
    assert len(duplicate['judgementEvidence']) == 2


def test_incoming_threshold_is_strict_and_does_not_activate_irrelevant_metrics(tmp_path, monkeypatch):
    monkeypatch.setattr(generator, 'ROOT', tmp_path)
    mapping = tmp_path / 'mapping.py'
    mapping.write_bytes((ROOT / 'build_calc_report.py').read_bytes())
    cases = [('Missing', None, True, 0), ('Zero', 0, True, 0), ('One', 1, True, 0),
             ('Two', 2, True, .5), ('String two', '2', True, .5),
             ('Invalid', 'unknown', True, 0), ('Irrelevant', 3, False, None)]
    teams, products = [], []
    for name, count, applicable, _ in cases:
        teams.append({'id': name, 'name': name, 'unit': 'DB', 'type': 'Продукт',
                      'metrics': [{'code': 'mehaniki', 'metrics': [{'code': generator.CODE, 'value': 0,
                          'max_value': 1 if applicable else 0, 'is_applicabble_flg': applicable}]}]})
        products.append({'name': name, 'unit': 'DB', 'uid': name, 'key': name,
                         'seen_in_n': count, 'pairs': [], 'judgements': []})
    report, export = tmp_path / 'report.json', tmp_path / 'api.json'
    report.write_text(json.dumps({'products': teams}))
    export.write_text(json.dumps({'products_response': {'products': products, 'meta': {}}}))
    records = {p['name']: p for p in generator.build(report, export, mapping)['products']}
    for index, (name, count, applicable, expected) in enumerate(cases):
        record = records[name]
        if not applicable:
            assert record['status'] == 'notApplicable'
            assert record['metrics'] == {}
            continue
        fact = record['metrics'][generator.CODE]
        assert fact['rawValue'] == expected, name
        assert fact['source']['evidence'] == []
        incoming = fact['source']['incomingEvidence']
        if expected:
            assert incoming == {'pointer': f'/products_response/products/{index}/seen_in_n',
                                'value': count, 'rule': 'seen_in_n > 1', 'confirmedBy': 'user'}
        else:
            assert incoming is None
