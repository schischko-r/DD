import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('goals_navigator_update', ROOT / 'scripts/generate-goals-navigator-update.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def test_market_qualification_is_normalized_full_score_and_requires_applicability():
    for maximum in [.2, 1, 4]:
        assert generator.full_score({'value': maximum, 'max_value': maximum})
        assert not generator.full_score({'value': maximum / 2, 'max_value': maximum})
    for metric in [None, {'value': None, 'max_value': .2}, {'value': 0, 'max_value': .2},
                   {'value': 1, 'max_value': .2}, {'value': 0, 'max_value': 0},
                   {'value': .2, 'max_value': .2, 'is_applicabble_flg': False}]:
        assert not generator.full_score(metric)


def test_exact_regeneration_preserves_snapshot_and_q2_sources():
    snapshot = ROOT / 'outputs/goals-navigator-update-2026-10-30/before.json'
    report = ROOT / 'gravity-app/public/report-data.json'
    hashes = {path: generator.sha(path) for path in [snapshot, report]}
    goals, navigator = generator.build(snapshot, report)
    assert goals == json.loads((ROOT / 'gravity-app/src/data/goals-user-carry-forward-q3-2026.json').read_text())
    assert navigator == json.loads((ROOT / 'gravity-app/src/data/navigator-market-knowledge-q3-2026.json').read_text())
    assert goals['counts'] == {'teams': 1, 'facts': 3}
    assert [goals['products'][0]['metrics'][code]['rawValue'] for code in generator.GOAL_CODES] == [1, 0, 0]
    assert navigator['counts'] == {'qualifyingTeams': 45, 'teams': 17, 'facts': 17, 'alreadyFull': 28, 'mismatches': 0}
    for product in navigator['products']:
        fact = product['metrics'][generator.NAVIGATOR_CODE]
        assert fact['rawValue'] == 1
        assert fact['source']['sourceValue'] == fact['source']['sourceMaxValue'] == .2
        assert fact['source']['sourceRawValue'] == 1
    assert hashes == {path: generator.sha(path) for path in hashes}
