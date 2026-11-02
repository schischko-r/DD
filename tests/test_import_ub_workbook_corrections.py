import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ub_import', ROOT / 'scripts/import-ub-workbook-corrections.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_real_file_imports_only_50_ub_correction_cells_and_matches_runtime_data():
    profiles = json.loads((ROOT / 'outputs/ub-workbook-corrections-2026-11-02/before.json').read_text())
    result = module.build(ROOT / 'Копия DDI_II_III_2026 УБ(1).xlsx', profiles)
    assert result == json.loads((ROOT / 'gravity-app/src/data/ub-workbook-corrections-q3-2026.json').read_text())
    assert result['counts'] == {'teams': 16, 'corrections': 50, 'pending': 0}
    assert all(p['unit'] == 'УБ' for p in result['products'])
    assert all(f['source']['column'] == 'F' and f['source']['sourceUnit'] == 'УБ'
               for p in result['products'] for f in p['metrics'].values())
    facts = [f for p in result['products'] for f in p['metrics'].values()]
    assert sum(f.get('applicable') is False for f in facts) == 1
    assert sum(f.get('rawValue') == 0 for f in facts) == 6


def test_other_units_and_existing_scores_are_not_even_read_and_blank_corrections_are_skipped(tmp_path, monkeypatch):
    class Forbidden:
        @property
        def value(self):
            raise AssertionError('Other units or existing-score cells must not be read')

    def cell(value, coordinate):
        return SimpleNamespace(value=value, coordinate=coordinate)

    def row(unit, correction, n):
        return [cell(unit, f'A{n}'), cell('Команда', f'B{n}'), cell('Механики', f'C{n}'),
                cell('Возврат клиентов', f'D{n}'), Forbidden(), correction]

    class Sheet:
        def __getitem__(self, key):
            assert key == 'F6'
            return cell('Корректировка', key)

        def iter_rows(self, **kwargs):
            return iter([row('CX', Forbidden(), 7), row('DB', Forbidden(), 8),
                         row('УБ', cell(None, 'F9'), 9), row('УБ', cell(0, 'F10'), 10)])

    class Workbook:
        def __getitem__(self, key):
            assert key == 'Метрики'
            return Sheet()

        def close(self):
            pass

    monkeypatch.setattr(module.openpyxl, 'load_workbook', lambda *args, **kwargs: Workbook())
    path = tmp_path / 'input.xlsx'
    path.write_bytes(b'test fixture; Excel loader is mocked')
    profiles = [{'id': 'id', 'name': 'Команда', 'unit': 'УБ', 'type': 'Продукт', 'period': module.PERIOD,
                 'metrics': [{'name': 'Механики', 'metrics': [{'name': 'Возврат клиентов',
                   'code': 'mehaniki.vozvrat_klientov', 'value': 1, 'max_value': 1}]}]}]
    result = module.build(path, profiles)
    assert result['importedCells'] == ['F10']
    assert result['products'][0]['metrics']['mehaniki.vozvrat_klientov']['rawValue'] == 0
