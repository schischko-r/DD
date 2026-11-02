"""Read-only extraction of segment survey history; run from repository root with Python 3.11.

Only numeric 1 in the adjacent mark column confirms an option. Repeated answer
labels and processed/score columns never imply selection. Respondent row 7 is
intentionally absent. The source workbook is never modified.
"""
from pathlib import Path
import hashlib
import json
import re
from urllib.parse import urlsplit
import openpyxl

ROOT = Path(__file__).resolve().parents[4]
BOOK = ROOT / 'Книга1(3).xlsx'
DEST = Path(__file__).resolve().parents[1] / 'previous-segments.js'
SHEET = 'свод_сегменты'
COLUMNS = [('Дети', 'I', 'J', 'K'), ('Молодежь', 'N', 'O', 'P'), ('Рабочий возраст', 'S', 'T', 'U'), ('Зрелость', 'X', 'Y', 'Z'), ('Top Affluent', 'AC', 'AD', 'AE'), ('PB', 'AH', 'AI', 'AJ'), ('МВС', 'AM', 'AN', 'AO')]
URL_RE = re.compile(r'https?://[^\s<>"\u00ab\u00bb]+|(?:[A-Za-z0-9-]+\.)+(?:ru|com|org|net|рф)(?::[0-9]+)?(?:/[^\s<>"\u00ab\u00bb]*)?', re.I)
BACKLOG_HOSTS = {'jira.sberbank.ru', 'jira.delta.sbrf.ru', 'jira.sberned.ru', 'sbertrack.sberbank.ru'}

def links(*values):
    result = []
    for value in values:
        if not isinstance(value, str):
            continue
        for match in URL_RE.finditer(value):
            candidate = match.group().rstrip('.,;')
            try:
                parsed = urlsplit(candidate if re.match('https?://', candidate, re.I) else 'https://' + candidate)
                valid = parsed.scheme.lower() in {'http', 'https'} and parsed.hostname and '.' in parsed.hostname
            except ValueError:
                valid = False
            if valid and candidate not in result:
                result.append(candidate)
    return result

def is_backlog(value):
    try:
        return urlsplit(value if re.match('https?://', value, re.I) else 'https://' + value).hostname in BACKLOG_HOSTS
    except ValueError:
        return False

def confirmed(value):
    return type(value) in (int, float) and value == 1

def cell_data(cell):
    result = {'cell': cell.coordinate, 'value': cell.value}
    if cell.hyperlink:
        result['hyperlink'] = cell.hyperlink.target or cell.hyperlink.location
    return result

def main():
    book = openpyxl.load_workbook(BOOK, data_only=True)
    sheet = book[SHEET]
    profiles_text = (DEST.parent / 'other-team-profiles.js').read_text()
    profiles = json.loads(profiles_text[profiles_text.index('{'):].rstrip().removesuffix(';'))
    ids = {p['name']: team_id for team_id, p in profiles.items() if p['type'] == 'Сегмент'}
    starts = [row for row in range(25, 217) if sheet[f'D{row}'].value is not None]
    history = {}
    for name, answer_column, mark_column, processed_column in COLUMNS:
        assert sheet[f'{processed_column}3'].value == name
        raw = {}
        for index, start in enumerate(starts):
            stop = starts[index + 1] if index + 1 < len(starts) else 217
            rows = []
            selected = []
            comments = []
            text_entries = []
            all_links = []
            for row in range(start, stop):
                answer = sheet[f'{answer_column}{row}']
                mark = sheet[f'{mark_column}{row}']
                processed = sheet[f'{processed_column}{row}']
                template = sheet[f'E{row}'].value
                if answer.value is None and mark.value is None and processed.value is None:
                    continue
                rows.append({'row': row, 'templateOption': template, 'answer': cell_data(answer), 'mark': cell_data(mark), 'processed': cell_data(processed)})
                if confirmed(mark.value) and template is not None and not str(template).startswith('Введите значение') and isinstance(answer.value, str):
                    selected.append(answer.value.strip())
                if isinstance(mark.value, str) and mark.value.strip():
                    comments.append({'cell': mark.coordinate, 'value': mark.value})
                if answer.value is not None and (template is None or str(answer.value).strip() != str(template).strip()):
                    text_entries.append({'cell': answer.coordinate, 'value': answer.value})
                for url in links(answer.value, mark.value, answer.hyperlink.target if answer.hyperlink else None, mark.hyperlink.target if mark.hyperlink else None):
                    if url not in all_links:
                        all_links.append(url)
            raw[str(start)] = {'question': sheet[f'D{start}'].value, 'selectedOptions': selected, 'comments': comments,
                'links': all_links, 'sourceCells': rows,
                **({'text': sheet[f'{answer_column}{start}'].value} if sheet[f'E{start}'].value is None and sheet[f'{answer_column}{start}'].value is not None else {}),
                **({'textEntries': text_entries} if text_entries else {})}
        def selected_rows(start, stop):
            return [str(sheet[f'{answer_column}{row}'].value).strip() for row in range(start, stop + 1)
                if confirmed(sheet[f'{mark_column}{row}'].value)]
        income = name in {'PB', 'Top Affluent', 'МВС'}
        mechanics = selected_rows(141, 146) if income else selected_rows(135, 138)
        known_sub = {
            'otherMechanicpersonalizaciya_klientskogo_opyta': raw['149'],
            'otherMechanicprivlechenie_klientov': raw['156' if name in {'PB', 'Top Affluent'} else '163'],
            'otherMechanicuderzhanie_klientov': raw['169' if income else '164'],
            'segmentRetentionBasis': raw['175'],
            'otherMechanicreagirovanie_na_zhiznennye_sobytiya': raw['195'],
        }
        if income:
            known_sub.update({'otherMechanicvozvrat_klientov': raw['180'], 'otherMechanicpovyshenie_urovnya_klienta': raw['185'], 'segmentUpgradeBasis': raw['190']})
        review_flags = []
        relevance = {}
        for direction, starts_for_direction in [('attract', [75, 79, 86, 89]), ('churn', [90, 94, 101, 104])]:
            not_relevant = []
            for row in starts_for_direction:
                for comment in raw[str(row)]['comments']:
                    if re.search(r'не\s*релев', comment['value'], re.I):
                        not_relevant.append(comment)
            relevance[direction] = {'notRelevantEvidence': not_relevant, 'requiresReview': bool(not_relevant)}
        for group_row, group in raw.items():
            for comment in group['comments']:
                if re.search(r'из[е]?м[е]?нил|не\s*релев', comment['value'], re.I):
                    review_flags.append({'questionRow': int(group_row), **comment})
        history[ids[name]] = {
            'source': {'file': BOOK.name, 'sheet': SHEET, 'answerColumn': answer_column, 'markColumn': mark_column, 'processedColumn': processed_column,
                'selectionRule': 'Only numeric 1 in markColumn confirms an option; processed values are never selection marks.'},
            'funnelElements': {'attractIncludes': selected_rows(79, 84), 'churnIncludes': selected_rows(94, 99)},
            'reportLinks': {'attractReport': raw['89']['links'], 'churnReport': raw['104']['links']},
            'acceptedBacklogLinks': [url for url in raw['206']['links'] if is_backlog(url)],
            'mechanics': mechanics, 'knownSubanswers': known_sub, 'rawAnswers': raw,
            'directionRelevance': relevance, 'reviewFlags': review_flags, 'requiresReview': bool(review_flags),
        }
    header = '// Generated by scripts/generate-segment-history.py from Книга1(3).xlsx, свод_сегменты.\n'
    header += '// Source workbook SHA-256: ' + hashlib.sha256(BOOK.read_bytes()).hexdigest() + '\n'
    header += '// No respondent names; source rows 25–216 only. Historical information is not a current-quarter answer.\n'
    DEST.write_text(header + 'export const previousSegments = ' + json.dumps(history, ensure_ascii=False, indent=2) + ';\n')
    print(json.dumps([{'name': name, 'funnelCounts': {k: len(v) for k, v in history[ids[name]]['funnelElements'].items()}, 'reportUrls': sum(map(len, history[ids[name]]['reportLinks'].values())), 'acceptedBacklogUrls': len(history[ids[name]]['acceptedBacklogLinks']), 'confirmedMechanics': history[ids[name]]['mechanics']} for name, *_ in COLUMNS], ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
