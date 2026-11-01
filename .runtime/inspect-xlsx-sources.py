from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

root = Path(__file__).resolve().parents[1]
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for p in root.glob('*.xlsx'):
    if p.name.startswith('~$'):
        continue
    with ZipFile(p) as z:
        tree = ET.fromstring(z.read('xl/workbook.xml'))
        print(p.name, [x.attrib['name'] for x in tree.findall('s:sheets/s:sheet', ns)])
