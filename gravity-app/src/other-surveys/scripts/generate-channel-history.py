"""Extract prior channel answers without modifying the source workbook.

Run from repository root with Python 3.11. Only explicit numeric 1 in each
sheet's selection column confirms an option; score/max columns are evidence
metadata, never selection. Campaigning uses G for selection and F for comments.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import openpyxl

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('segment_history_helpers', HERE / 'generate-segment-history.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
ROOT = HERE.parents[3]
BOOK = ROOT / 'Книга1(3).xlsx'
DEST = HERE.parent / 'previous-channels.js'

PC_RANGES = [(29, 38), (39, 55), (57, 71), (73, 75), (77, 88), (90, 101), (103, 142), (144, 149), (152, 159)]
DP_RANGES = [(33, 62), (64, 77), (79, 91), (93, 95), (97, 108), (110, 121), (123, 133), (138, 164), (166, 176), (179, 186)]
CAMPAIGN_RANGES = [(33, 42), (43, 56), (64, 78), (80, 82), (84, 86), (88, 90), (94, 99), (101, 109)]
TEAM_SOURCES = [
    ('Чат', 'свод_каналы (2)', 'E', 'F', 'G', 'C', 21, 160, PC_RANGES),
    ('Колл-центр', 'свод_каналы (2)', 'J', 'K', 'L', 'C', 21, 160, PC_RANGES),
    ('Телемаркетинг', 'свод_каналы (2)', 'O', 'P', 'Q', 'C', 21, 160, PC_RANGES),
    ('СберKids', 'свод_каналы', 'F', 'G', 'H', 'D', 19, 187, DP_RANGES),
    ('СберИнвестор', 'свод_каналы', 'K', 'L', 'M', 'D', 19, 187, DP_RANGES),
    ('СБОЛ', 'свод_каналы', 'P', 'Q', 'R', 'D', 19, 187, DP_RANGES),
    ('Уведомления', 'свод_каналы', 'U', 'V', 'W', 'D', 19, 187, DP_RANGES),
    ('Персональная рекомендация', 'Кампейнинг', 'E', 'G', 'H', 'D', 17, 110, CAMPAIGN_RANGES),
]

def main():
    workbook = openpyxl.load_workbook(BOOK, data_only=True)
    profile_text = (HERE.parent / 'other-team-profiles.js').read_text()
    profiles = json.loads(profile_text[profile_text.index('{'):].rstrip().removesuffix(';'))
    ids = {profile['name']: key for key, profile in profiles.items() if profile['type'] == 'Канал'}
    history = {}
    summaries = []
    for name, sheet_name, answer_column, mark_column, processed_column, question_column, first_row, last_row, option_ranges in TEAM_SOURCES:
        sheet = workbook[sheet_name]
        campaign = sheet_name == 'Кампейнинг'
        comment_column = 'F' if campaign else mark_column
        option_rows = {row for start, stop in option_ranges for row in range(start, stop + 1)}
        starts = [row for row in range(first_row, last_row + 1) if sheet[f'{question_column}{row}'].value is not None]
        raw = {}
        for index, start in enumerate(starts):
            stop = starts[index + 1] if index + 1 < len(starts) else last_row + 1
            source_cells, selected, comments, text_entries, all_links = [], [], [], [], []
            for row in range(start, stop):
                answer, mark, processed, comment = (sheet[f'{column}{row}'] for column in [answer_column, mark_column, processed_column, comment_column])
                if all(cell.value is None and cell.hyperlink is None for cell in [answer, mark, processed, comment]):
                    continue
                entry = {'row': row, 'answer': helpers.cell_data(answer), 'mark': helpers.cell_data(mark), 'processed': helpers.cell_data(processed)}
                if campaign:
                    entry['comment'] = helpers.cell_data(comment)
                source_cells.append(entry)
                if row in option_rows and helpers.confirmed(mark.value) and isinstance(answer.value, str):
                    selected.append(answer.value.strip())
                if isinstance(comment.value, str) and comment.value.strip():
                    comments.append({'cell': comment.coordinate, 'value': comment.value})
                if answer.value is not None and row not in option_rows:
                    text_entries.append({'cell': answer.coordinate, 'value': answer.value})
                for url in helpers.links(answer.value, comment.value,
                        answer.hyperlink.target if answer.hyperlink else None, comment.hyperlink.target if comment.hyperlink else None):
                    if url not in all_links:
                        all_links.append(url)
            raw[str(start)] = {'question': sheet[f'{question_column}{start}'].value, 'selectedOptions': selected,
                'comments': comments, 'links': all_links, 'sourceCells': source_cells,
                **({'text': sheet[f'{answer_column}{start}'].value} if start not in option_rows and sheet[f'{answer_column}{start}'].value is not None else {}),
                **({'textEntries': text_entries} if text_entries else {})}

        def selected_rows(start, stop):
            return [str(sheet[f'{answer_column}{row}'].value).strip() for row in range(start, stop + 1)
                if helpers.confirmed(sheet[f'{mark_column}{row}'].value) and isinstance(sheet[f'{answer_column}{row}'].value, str)]

        def row_links(rows):
            found = []
            for row in rows:
                for column in dict.fromkeys([answer_column, comment_column]):
                    cell = sheet[f'{column}{row}']
                    for url in helpers.links(cell.value, cell.hyperlink.target if cell.hyperlink else None):
                        if not any(previous.rstrip('#') == url.rstrip('#') for previous in found):
                            found.append(url)
            return found

        if campaign:
            funnel_elements = {'campaignReporting': selected_rows(64, 67)}
            report_links = {'campaignReport': row_links([*range(64, 68), *range(76, 92)])}
            mechanics = []
            known_sub = {'qualityTools': raw['43'], 'industrialData': raw['50']}
            backlog_row = 100
            source_ui_aliases = {}
        elif sheet_name == 'свод_каналы':
            funnel_elements = {'attractIncludes': selected_rows(52, 58), 'onboardingIncludes': selected_rows(68, 73), 'churnIncludes': selected_rows(83, 87)}
            report_links = {'attractReport': row_links([63]), 'onboardingReport': row_links([78]), 'churnReport': row_links([92])}
            mechanics = selected_rows(150, 154)
            known_sub = {'otherMechanicuderzhanie_klientov': raw['157'], 'otherMechanicvozvrat_klientov': raw['161'], 'channelFlexibleOptions': raw['166']}
            backlog_row = 177
            source_ui_aliases = {}
        else:
            if name == 'Телемаркетинг':
                funnel_elements = {'salesIncludes': selected_rows(61, 66)}
                report_links = {'salesReport': row_links([72])}
                mechanics = selected_rows(119, 122)
            else:
                funnel_elements = {'entryIncludes': selected_rows(43, 50)}
                report_links = {'entryReport': row_links([56])}
                mechanics = selected_rows(111, 115)
            known_sub = {'otherMechanicpersonalizaciya': raw['129'], 'otherMechanickontrolya_kachestva_rechi': raw['134']}
            if name == 'Телемаркетинг':
                known_sub['otherMechanicnailuchshego_vremeni_zvonka'] = raw['125']
            else:
                known_sub['otherMechanicuderzhaniya_klienta'] = raw['139']
            backlog_row = 150
            source_ui_aliases = {}

        review_flags = [{'questionRow': int(row), **comment} for row, group in raw.items() for comment in group['comments']
            if re.search(r'из[е]?м[е]?нил|не\s*релев', comment['value'], re.I)]
        accepted_backlog = [url for url in row_links([backlog_row]) if helpers.is_backlog(url)]
        history[ids[name]] = {
            'source': {'file': BOOK.name, 'sheet': sheet_name, 'answerColumn': answer_column, 'markColumn': mark_column,
                'commentColumn': comment_column, 'processedColumn': processed_column,
                'selectionRule': 'Only numeric 1 in markColumn confirms an option; comments/score/max columns never imply selection.'},
            'funnelElements': funnel_elements, 'reportLinks': report_links, 'acceptedBacklogLinks': accepted_backlog,
            'mechanics': mechanics, 'knownSubanswers': known_sub, 'rawAnswers': raw, 'uiAliases': source_ui_aliases,
            'reviewFlags': review_flags, 'requiresReview': bool(review_flags),
        }
        summaries.append({'name': name, 'sheet': sheet_name, 'funnelCounts': {key: len(value) for key, value in funnel_elements.items()},
            'reportUrls': sum(map(len, report_links.values())), 'acceptedBacklogUrls': len(accepted_backlog), 'mechanics': mechanics})
    header = '// Generated read-only by scripts/generate-channel-history.py from Книга1(3).xlsx.\n'
    header += '// SHA-256: ' + hashlib.sha256(BOOK.read_bytes()).hexdigest() + '\n'
    header += '// Explicit numeric marks only. No respondent rows or invented ELK history. Past quarter answers are not current answers.\n'
    DEST.write_text(header + 'export const previousChannels = ' + json.dumps(history, ensure_ascii=False, indent=2) + ';\n')
    print(json.dumps(summaries, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
