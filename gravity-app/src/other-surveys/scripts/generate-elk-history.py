"""Extract only ELK history from Книга1(4).xlsx without changing other histories.

Run from repository root with Python 3.11. D answers, E comments, F explicit
selection marks, G processed metadata. Only numeric F=1 confirms an option.
Respondent/identity rows before 20 and other teams' columns are excluded.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import openpyxl

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('history_helpers', HERE / 'generate-segment-history.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
ROOT = HERE.parents[3]
BOOK = ROOT / 'Книга1(4).xlsx'
DEST = HERE.parent / 'previous-elk.js'
TEAM_ID = '4a1bd6b8-c295-50fd-b4c6-14d4873c6bb0¦Единый личный кабинет (ЕЛК)'
ALIASES = {'Стимулирование клиента (геймификация, пуши,Nudging механики)': 'Стимулирование клиента (геймификация, пуши, Nudging-механики)'}
OPTION_RANGES = [(21,21), (23,23), (25,25), (27,27), (29,29), (31,31), (33,33),
    (34,39), (40,46), (47,53), (54,57), (58,61), (62,69), (70,72),
    (90,93), (94,99), (102,104), (106,108), (120,128), (129,131), (133,140), (141,143),
    (145,146), (148,151), (152,155), (156,159), (160,166), (175,175), (176,179),
    (180,183), (187,191), (192,197), (200,207)]

def main():
    workbook = openpyxl.load_workbook(BOOK, data_only=True)
    sheet = workbook['Лист1']
    assert sheet['E4'].value == 'Единый личный кабинет (ЕЛК)'
    option_rows = {r for start,stop in OPTION_RANGES for r in range(start,stop+1)}
    starts = [r for r in range(20,209) if sheet[f'C{r}'].value is not None]
    raw = {}
    for index,start in enumerate(starts):
        stop = starts[index+1] if index+1<len(starts) else 209
        source_cells,selected,comments,text_entries,urls = [],[],[],[],[]
        for row in range(start,stop):
            answer,comment,mark,processed = (sheet[f'{col}{row}']for col in ['D','E','F','G'])
            if all(cell.value is None and cell.hyperlink is None for cell in [answer,comment,mark,processed]):
                continue
            source_cells.append({'row':row,'answer':helpers.cell_data(answer),'comment':helpers.cell_data(comment),
                'mark':helpers.cell_data(mark),'processed':helpers.cell_data(processed)})
            if row in option_rows and helpers.confirmed(mark.value) and isinstance(answer.value,str):
                selected.append(answer.value.strip())
            if comment.value is not None:
                comments.append({'cell':comment.coordinate,'value':comment.value})
            if answer.value is not None and row not in option_rows:
                text_entries.append({'cell':answer.coordinate,'value':answer.value})
            for cell in [answer,comment,mark,processed]:
                for url in helpers.links(cell.value,cell.hyperlink.target if cell.hyperlink else None):
                    if url not in urls:
                        urls.append(url)
        raw[str(start)]={'question':sheet[f'C{start}'].value,'selectedOptions':selected,'comments':comments,
            'links':urls,'sourceCells':source_cells,
            **({'text':sheet[f'D{start}'].value}if start not in option_rows and sheet[f'D{start}'].value is not None else {}),
            **({'textEntries':text_entries}if text_entries else {})}
    def selected_rows(start,stop):
        return [str(sheet[f'D{row}'].value).strip()for row in range(start,stop+1)
            if helpers.confirmed(sheet[f'F{row}'].value) and isinstance(sheet[f'D{row}'].value,str)]
    def links_at(rows):
        result=[]
        for row in rows:
            for col in ['D','E','F','G']:
                cell=sheet[f'{col}{row}']
                for url in helpers.links(cell.value,cell.hyperlink.target if cell.hyperlink else None):
                    if not any(previous.rstrip('#')==url.rstrip('#')for previous in result):
                        result.append(url)
        return result
    mechanics_raw=selected_rows(160,164)
    review_flags=[{'questionRow':int(row),**comment}for row,group in raw.items()for comment in group['comments']
        if isinstance(comment['value'],str) and re.search(r'не\s*релев|из[е]?м[е]?нил',comment['value'],re.I)]
    history={TEAM_ID:{
        'source':{'file':BOOK.name,'sheet':'Лист1','answerColumn':'D','commentColumn':'E','markColumn':'F','processedColumn':'G',
            'selectionRule':'Only numeric 1 in column F confirms an option. Comments E and processed metadata G never imply selection.'},
        'funnelElements':{'usageIncludes':selected_rows(62,68),'churnIncludes':selected_rows(94,98)},
        'reportLinks':{'usageReport':links_at([58,70,73]),'churnReport':links_at([90,102,105])},
        'acceptedBacklogLinks':[url for url in links_at([198])if helpers.is_backlog(url)],
        'mechanics':[ALIASES.get(option,option)for option in mechanics_raw],
        'uiAliases':ALIASES,
        'knownSubanswers':{'qualityTools':raw['40'],'industrialData':raw['47'],
            'otherMechanicuderzhanie_klientov':raw['176'],'otherMechanicvozvrat_klientov':raw['180'],
            'channelFlexibleOptions':raw['187'],'mechanicsMonitoring':raw['186'],'customNudgingMechanics':raw['160']},
        'rawAnswers':raw,'reviewFlags':review_flags,'requiresReview':bool(review_flags),
        'notes':['Custom Nudging option F165 is preserved in raw history, not counted as a second static mechanic.',
            'Conflicting previous Discovery choices F195 and F196 are both preserved; only the accepted Jira URL controls question exclusion.'],
    }}
    header='// Generated read-only by scripts/generate-elk-history.py; only ELK, Книга1(4).xlsx, Лист1.\n'
    header+='// SHA-256: '+hashlib.sha256(BOOK.read_bytes()).hexdigest()+'\n'
    header+='// Raw D/E/F/G cells remain unchanged. Source labels and explicit UI aliases are stored separately.\n'
    DEST.write_text(header+'export const previousElk = '+json.dumps(history,ensure_ascii=False,indent=2)+';\n')
    h=history[TEAM_ID]
    print(json.dumps({'team':TEAM_ID,'rawQuestionGroups':len(raw),'rawRows':sum(len(g['sourceCells'])for g in raw.values()),
        'components':h['funnelElements'],'reports':h['reportLinks'],'backlog':h['acceptedBacklogLinks'],'mechanics':h['mechanics']},ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
