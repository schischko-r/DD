import json
import math
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

directory = Path(__file__).parent
snapshot = json.loads((directory / 'snapshot.json').read_text())
filename = directory / 'DDI_финальные_II_III_кварталы_2026.xlsx'
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(filename) as archive:
    workbook = ET.fromstring(archive.read('xl/workbook.xml'))
    assert [s.attrib['name'] for s in workbook.findall('s:sheets/s:sheet', ns)] == ['Команды', 'Метрики']
    shared = ET.fromstring(archive.read('xl/sharedStrings.xml'))
    strings = [''.join(t.text or '' for t in item.findall('.//s:t', ns)) for item in shared]
    def cells(path):
        xml = ET.fromstring(archive.read(path))
        result = {}
        for cell in xml.findall('.//s:sheetData/s:row/s:c', ns):
            assert cell.attrib.get('t') != 'e', cell.attrib['r']
            value = cell.find('s:v', ns)
            if value is None or value.text is None:
                continue
            if cell.attrib.get('t') == 's':
                result[cell.attrib['r']] = strings[int(value.text)]
            elif cell.attrib.get('t') == 'str':
                result[cell.attrib['r']] = value.text
            else:
                result[cell.attrib['r']] = float(value.text)
        pane = xml.find('s:sheetViews/s:sheetView/s:pane', ns)
        assert pane is not None and pane.attrib['xSplit'] == '2' and pane.attrib['ySplit'] == '6'
        return result
    for index, key in [(1, 'summary'), (2, 'detail')]:
        actual = cells(f'xl/worksheets/sheet{index}.xml')
        for row_index, row in enumerate(snapshot[key], 7):
            for column_index, expected in enumerate(row):
                if expected is None:
                    continue
                address = f'{chr(65+column_index)}{row_index}'
                value = actual[address]
                if isinstance(expected, (int, float)):
                    assert isinstance(value, float) and math.isclose(value, expected, abs_tol=1e-9), (key, address, value, expected)
                else:
                    assert value == expected, (key, address, value, expected)
        if index == 1:
            for row_index, control in enumerate(snapshot['controls'], 7):
                value = actual[f'E{row_index}']
                if control['delta'] is not None:
                    assert math.isclose(value, control['delta'], abs_tol=1e-8)
                else:
                    assert value == '—'
    tables = [path for path in archive.namelist() if path.startswith('xl/tables/table') and path.endswith('.xml')]
    assert len(tables) == 2
    for table in tables:
        assert ET.fromstring(archive.read(table)).find('s:autoFilter', ns) is not None
print(json.dumps({'saved_xlsx_verified': True, 'summary_rows': len(snapshot['summary']),
                  'metric_rows': len(snapshot['detail']), 'all_cells_match_snapshot': True,
                  'summary_cached_formulas_match': True, 'two_filter_tables': True}, ensure_ascii=False))
