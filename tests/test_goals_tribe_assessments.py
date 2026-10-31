import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('goals_tribe', ROOT / 'scripts/generate-goals-tribe-assessments.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def test_goal_tribe_regeneration_is_exact_and_leaves_original_report_unchanged():
    report = ROOT / 'gravity-app/public/report-data.json'
    before = report.read_bytes()
    scored, excluded = generator.build(report)
    assert scored == json.loads((ROOT / 'gravity-app/src/data/goals-tribe-assessments-q3-2026.json').read_text())
    assert excluded == json.loads((ROOT / 'gravity-app/src/data/goals-tribe-applicability-q3-2026.json').read_text())
    assert scored['counts'] == {'teams': 76, 'facts': 218}
    assert excluded['counts'] == {'teams': 9, 'facts': 10}
    assert all(f['rawValue'] in [0, 1] for p in scored['products'] for f in p['metrics'].values())
    assert all(f['applicable'] is False and f['source']['zeroDenominator'] is True
               for p in excluded['products'] for f in p['metrics'].values())
    assert report.read_bytes() == before
