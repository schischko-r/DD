import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('selected_carry', ROOT / 'scripts/generate-selected-carry-forward.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def test_exact_q2_assessments_are_carried_including_zeros_and_fractional_maxima():
    overlay = generator.build()
    assert overlay == json.loads(generator.OUTPUT.read_text(encoding='utf-8'))
    assert overlay['counts'] == {'teams': 75, 'facts': 142, 'byMetric': {
        'mehaniki.gibkoe_izmenenie_usloviy_produkta': 72, 'hyp.extra_initiatives': 70}}
    prior = json.loads(generator.SOURCE.read_text(encoding='utf-8'))['products']
    zero = partial = 0
    for team in overlay['products']:
        old = next(p for p in prior if p['id'] == team['id'])
        for code, fact in team['metrics'].items():
            metric = next(m for b in old['metrics'] for m in b['metrics'] if m['code'] == code)
            assert fact['rawValue'] * metric['max_value'] == metric['value']
            assert fact['source']['sourceValue'] == metric['value']
            assert fact['source']['sourceMaxValue'] == metric['max_value']
            zero += fact['rawValue'] == 0
            partial += fact['rawValue'] == 0.5
    assert zero == 92
    assert partial == 18
