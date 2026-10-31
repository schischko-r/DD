import csv
import importlib.util
import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('crosssell_after', ROOT / 'scripts/generate-crosssell-after-purchase.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)

pytestmark = pytest.mark.skipif(
    not generator.SOURCE.is_file(),
    reason='The source questionnaire export questionare-uplifts(7).csv is not present in this checkout',
)


def test_snapshot_preserves_all_answers_and_separates_new_teams():
    actual = generator.build()
    assert actual == json.loads(generator.OUTPUT.read_text(encoding='utf-8'))
    assert len(actual['products']) == 33
    assert len(actual['unmatchedResponses']) == 4
    assert sum(len(p['responses']) for p in actual['products']) == 37
    with generator.SOURCE.open(encoding='utf-8-sig', newline='') as stream:
        source = list(csv.DictReader(stream, delimiter=';'))
    responses = [r for p in actual['products'] for r in p['responses']] + actual['unmatchedResponses']
    assert len({r['sourceRecord'] for r in responses}) == 41
    for row in responses:
        original = source[row['sourceRecord'] - 2]
        assert original['Вопрос'].strip() == generator.QUESTION
        for key, field in [('answer', 'Ответ участника'), ('respondent', 'ФИО'),
                           ('respondentId', 'Участник'), ('confirmation', 'Подтверждение'), ('comment', 'Комментарий')]:
            assert row[key] == original[field].strip()
        assert not ({'rawValue', 'value', 'max_value', 'uplift'} & row.keys())
