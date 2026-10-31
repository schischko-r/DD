import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ab_tests_assessments', ROOT / 'scripts/generate-ab-tests-assessments.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def test_exact_ab_regeneration_and_source_aliases():
    report = ROOT / 'gravity-app/public/report-data.json'
    before = report.read_bytes()
    data = generator.build(report)
    assert data == json.loads((ROOT / 'gravity-app/src/data/ab-tests-user-assessments-q3-2026.json').read_text())
    assert len(data['products']) == len({p['id'] for p in data['products']}) == 38
    assert data['counts']['byRawValue'] == {'1.0': 29, '0.25': 6, '0.0': 1, '0.5': 2}
    facts = {p['name']: p['metrics']['hyp.ab_tests'] for p in data['products']}
    assert facts['Дебетовая карта']['source']['sourceName'] == 'Дебетовые карты'
    assert facts['Переводы по РФ']['source']['sourceName'] == 'Переводы по России'
    assert facts['Дети']['source']['sourceName'] == 'Дети'
    assert facts['SberPay Вжух']['source']['sourceName'] == 'Вжух'
    for name in ['Пенсионный продукт', 'SberPay Вжух', 'Страхование жизни', 'БПИФ', 'ЗПИФ', 'ОПИФ', 'ПДС']:
        assert facts[name]['rawValue'] == 1
    assert facts['ИнвестКопилка']['rawValue'] == 1
    assert facts['ЗЛС']['rawValue'] == .25
    assert facts['ВЗР']['rawValue'] == .25
    assert facts['ВЗР']['source']['sourceName'] == 'Страхование путешественников'
    assert report.read_bytes() == before
