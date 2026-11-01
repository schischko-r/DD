import json
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

root = Path(__file__).resolve().parents[1]
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for p in (root / 'outputs/ddi-audit-2026-10-31').glob('*.xlsx'):
    if p.name.startswith('~$'):
        continue
    with ZipFile(p) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
        print(p.name)
        for index in (1,2):
            name = f'xl/tables/table{index}.xml'
            if name not in z.namelist(): continue
            table = ET.fromstring(z.read(name))
            sheet = ET.fromstring(z.read(f'xl/worksheets/sheet{index}.xml'))
            headers = []
            for cell in sheet.findall('s:sheetData/s:row[@r="6"]/s:c', ns):
                value = cell.find('s:v',ns)
                headers.append(strings[int(value.text)] if cell.attrib.get('t')=='s' else value.text if value is not None else ''.join(cell.find('s:is',ns).itertext()) if cell.find('s:is',ns) is not None else '')
            columns = [c.attrib for c in table.findall('s:tableColumns/s:tableColumn',ns)]
            print(json.dumps({'table':name,'attrs':table.attrib,'filter':table.find('s:autoFilter',ns).attrib if table.find('s:autoFilter',ns) is not None else None,'columns':columns,'headers':headers,'match':[c['name'] for c in columns]==headers},ensure_ascii=False))
