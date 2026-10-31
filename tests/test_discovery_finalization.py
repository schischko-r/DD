import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'outputs/discovery-answers-2026-10-30/generate-assessments.py'


def scoring_functions():
    tree = ast.parse(SCRIPT.read_text())
    definitions = [node for node in tree.body if isinstance(node, ast.FunctionDef)
                   and node.name in {'score_explicit', 'score_decomposition'}]
    namespace = {'inside': ['Собственный бэклог в Jira/SberTrack', 'Задачи ведет Штаб в Jira/SberTrack']}
    exec(compile(ast.Module(body=definitions, type_ignores=[]), str(SCRIPT), 'exec'), namespace)
    return namespace['score_explicit'], namespace['score_decomposition']


def test_explicit_answer_scoring_and_exact_decomposition_thresholds():
    explicit, decomposition = scoring_functions()
    for location in [None, 'Собственный бэклог в Jira/SberTrack', 'Задачи ведет Штаб в Jira/SberTrack',
                     'Бэклог ведется вне Jira/SberTrack']:
        assert explicit('От 20 до 39%', location) == .5
        assert explicit('Меньше 20%', location) == 0
    assert explicit('От 40 до 79%', 'Собственный бэклог в Jira/SberTrack') == 1
    assert explicit('Больше 80%', 'Бэклог ведется вне Jira/SberTrack') == .5
    assert explicit(None, None) is None
    assert decomposition(4000, 10000) == 1
    assert decomposition(3999, 10000) == .5
    assert decomposition(2000, 10000) == .5
    assert decomposition(1999, 10000) == 0
    assert decomposition(0, 10000) == 0
    for discovery, created in [(None, 10), (0, 0), (-1, 10), (11, 10)]:
        assert decomposition(discovery, created) is None


def test_saved_backlog_proofs_are_exact_q3_source_records_and_shared_members_stay_shared():
    _, score = scoring_functions()
    overlay = json.loads((ROOT / 'gravity-app/src/data/discovery-metrics-q3-2026.json').read_text())
    backlog = json.loads((ROOT / 'gravity-app/public/backlog-data.json').read_text())
    facts = [p for p in overlay['products'] if p['metrics']['hyp.discovery_40_backlog']['source']['origin']
             == 'userConfirmedDiscoveryDecompositionAssessment']
    assert len(facts) == 11
    assert {p['name'] for p in facts} == set(overlay['source']['decompositionFallbackNames'])
    for product in facts:
        fact = product['metrics']['hyp.discovery_40_backlog']
        evidence = fact['source']
        node = backlog
        for key in evidence['pointer'].strip('/').split('/'):
            node = node[int(key)] if isinstance(node, list) else node[key]
        assert node['key'] == evidence['quarterKey'] == '2026-Q3'
        assert node['createdCount'] == evidence['createdCount']
        assert node['discoveryCount'] == evidence['discoveryCount']
        assert fact['rawValue'] == score(node['discoveryCount'], node['createdCount'])
        assert product['name'] in evidence['memberTeams']
        assert evidence['sharedAssessment'] == (len(evidence['memberTeams']) > 1)
        assert evidence['explicitAnswerPresent'] is False
        assert all(row['answer'] in [None, ''] for row in evidence['surveyResponses'])
    source = {p['name']: p['metrics']['hyp.discovery_40_backlog'] for p in overlay['products']}
    assert source['SberID']['rawValue'] == .5
    assert source['SberID']['source']['origin'] == 'userConfirmedDiscoveryAssessment'
    assert overlay['pending'] == []
    assert {p['name'] for p in overlay['resolvedConflicts']} == {'ОМС', 'Слитки'}
    for name in ['ОМС', 'Слитки', 'Пакет услуг СберПервый', 'Единый личный кабинет (ЕЛК)']:
        assert source[name]['rawValue'] == 1
        assert source[name]['source']['origin'] == 'userConfirmedDiscoveryManualAssessment'
