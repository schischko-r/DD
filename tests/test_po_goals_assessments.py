import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('po_goals', ROOT/'scripts/generate-po-goals-assessments.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


@pytest.mark.parametrize('question,answer,fmt,expected', [
    ('goalsMonitoring', 'Да (включены все цели)', 'link', 1),
    ('goalsMonitoring', 'Да (включены все цели)', 'excel', .5),
    ('goalsMonitoring', 'Частично (мониторинг не по всем целям)', 'link', 0),
    ('goalsMonitoring', 'Частично (мониторинг не по всем целям)', 'excel', 0),
    ('goalsMonitoring', 'Нет', 'link', 0),
    ('goalsForecast', 'Да, >90%', 'link', 1),
    ('goalsForecast', 'Да, >90%', 'excel', .5),
    ('goalsForecast', 'Частично, <90%', 'link', 0),
    ('goalsForecast', 'Нет', 'excel', 0),
    ('goalsFactorAnalysis', 'Да, >90%', 'link', 1),
    ('goalsFactorAnalysis', 'Да, >90%', 'excel', .5),
    ('goalsFactorAnalysis', 'Частично, <90%', 'excel', 0),
    ('goalsFactorAnalysis', 'Нет', 'link', 0),
    ('goalsForecast', 'Да, >90%', 'unknown', None),
    ('goalsForecast', None, 'link', None),
])
def test_explicit_po_score_table(question, answer, fmt, expected):
    assert generator.score(question, answer, fmt, 'https://example.ru/report') == expected


def test_regeneration_complete_scope_and_confirmed_resolutions():
    data = generator.build()
    assert data == json.loads((ROOT/'gravity-app/src/data/po-goals-survey-assessments-q3-2026.json').read_text())
    assert data['counts'] == {'teams': 76, 'directSurveyTeams': 25, 'responses': 79,
        'scoredFacts': 218, 'notApplicableFacts': 10, 'pendingFacts': 0,
        'byRawValue': {'1': 198, '0.5': 2, '0': 18, 'None': 10},
        'bySourceKind': {'directSurvey': 75, 'ltBaseline': 114, 'surveyAfterLtZero': 29, 'notApplicableFromLt': 10}}
    assert data['pending'] == []
    for name in ['ОМС', 'Слитки']:
        fact = next(p for p in data['products'] if p['name'] == name)['metrics']['goals.po_factor_analysis']
        assert fact['rawValue'] == 1
        assert fact['source']['resolution'] == 'maximumAcrossConfirmedRespondents'
        assert {r['rawValue'] for r in fact['source']['responses']} == {0, 1}
    for p in data['products']:
        for fact in p['metrics'].values():
            assert fact['source']['responses']
            assert all('чикин' not in r['respondent'].lower() for r in fact['source']['responses'])
            if fact['source']['sourceKind'] == 'ltBaseline':
                assert fact['source']['ltRawValue'] == 1
                assert 'formatAdjustment' not in fact['source']
                assert fact['rawValue'] == 1
            if fact['source']['sourceKind'] == 'notApplicableFromLt':
                assert fact.get('applicable') is False and fact['rawValue'] is None
    salary = next(p for p in data['products'] if p['name'] == 'Зарплатный продукт')['metrics']
    assert salary['goals.po_monitoring']['rawValue'] == .5
    assert salary['goals.po_forecast']['applicable'] is False
    assert salary['goals.po_factor_analysis']['rawValue'] == 1


def test_salary_unknown_source_average_and_oms_maximum_are_scoped_explicitly():
    policy = json.loads((ROOT/'gravity-app/src/data/po-goals-policy-q3-2026.json').read_text())
    evidence = [{'respondent': 'Сауткин Андрей', 'rawValue': None},
                {'respondent': 'Королева Александра Дмитриевна', 'rawValue': 1}]
    assert generator.survey_score({'name': 'Зарплатный продукт'}, evidence, policy) == (.5, 'averageWithUnknownSourceZero')
    assert generator.survey_score({'name': 'Другая команда'}, evidence, policy)[0] is None
    evidence = [{'respondent': 'А', 'rawValue': 0}, {'respondent': 'Б', 'rawValue': 1}]
    assert generator.survey_score({'name': 'ОМС'}, evidence, policy)[0] == 1
    assert generator.survey_score({'name': 'Слитки'}, evidence, policy)[0] == 1
    assert generator.survey_score({'name': 'Другая команда'}, evidence, policy)[0] is None


@pytest.mark.parametrize('base,response_score,report_format,expected', [
    (1, .5, 'excel', 1),
    (1, 0, 'excel', 1),
    (0, .5, 'excel', 0),
    (None, .5, 'excel', None),
    (1, 0, 'link', 1),
])
def test_positive_lt_base_is_preserved_without_excel_cap_or_raising_zero_or_enabling_na(base, response_score, report_format, expected):
    policy = json.loads((ROOT/'gravity-app/src/data/po-goals-policy-q3-2026.json').read_text())
    evidence = [{'respondent': 'Респондент', 'rawValue': response_score, 'reportFormat': report_format}]
    assert generator.apply_excel_rule({'name': 'Другая команда'}, base, evidence, policy) == expected


@pytest.mark.parametrize('evidence,expected', [
    (None,None), ('',None), ('   ',None), ('отчёт отсутствует',None),
    ('https:///',None), ('javascript:alert(https://x)',None), ('Смотрите https://example.ru/report',None),
    ('https://example.ru/report',1), ('navigator.example.ru/report',1),
    ('https://one.example.ru/a\nhttps://two.example.ru/b',1),
    (r'https://one.example.ru/a\nhttps://two.example.ru/b',1),
])
def test_full_survey_response_requires_an_actual_dashboard_link(evidence, expected):
    for question, answer in [('goalsMonitoring', 'Да (включены все цели)'), ('goalsForecast', 'Да, >90%'), ('goalsFactorAnalysis', 'Да, >90%')]:
        assert generator.score(question, answer, 'link', evidence) == expected
        assert generator.score(question, answer, 'excel', evidence) == .5
        assert generator.score(question, 'Нет', 'link', evidence) == 0


def test_zero_lt_can_use_the_actual_full_survey_and_link_without_changing_direct_scope():
    policy=json.loads((ROOT/'gravity-app/src/data/po-goals-policy-q3-2026.json').read_text())
    assert policy['excelUseSurveyAnswersForAllTeams'] is False
    assert policy['preservePositiveLtScores'] is True
    actual=generator.score('goalsFactorAnalysis','Да, >90%','link','https://example.ru/dashboard')
    assert actual==1
    assert generator.survey_score({'name':'Торговый Эквайринг'},[{'respondent':'Респондент','rawValue':actual}],policy)[0]==1
    direct=json.loads((ROOT/'gravity-app/src/data/goals-informational-q3-2026.json').read_text())['products']
    assert len(direct)==25


def test_direct_scope_cannot_reactivate_a_non_applicable_lt_criterion(tmp_path, monkeypatch):
    import csv
    data_dir=tmp_path/'gravity-app/src/data'
    data_dir.mkdir(parents=True)
    filenames=['goals-tribe-source-q3-2026.json','po-goals-policy-q3-2026.json','goals-informational-q3-2026.json','goals-tribe-assessments-q3-2026.json','goals-tribe-applicability-q3-2026.json']
    originals={name:(ROOT/'gravity-app/src/data'/name).read_bytes() for name in filenames}
    data={name:json.loads(value) for name,value in originals.items()}
    team=next(p for p in data['goals-informational-q3-2026.json']['products'] if p['name']=='БПИФ')
    lt_code='goals.factor_analysis_l1_l2'
    next(p for p in data['goals-tribe-assessments-q3-2026.json']['products'] if p['id']==team['id'])['metrics'].pop(lt_code)
    data['goals-tribe-applicability-q3-2026.json']['products'].append({'id':team['id'],'metrics':{lt_code:{'applicable':False,'source':{'fixture':True}}}})
    for name,value in data.items():
        (data_dir/name).write_text(json.dumps(value,ensure_ascii=False))
    csv_dir=tmp_path/'ddi_3q_response'
    csv_dir.mkdir()
    payload={'team':{k:team[k] for k in ['id','name','unit']},'respondent':{'name':'Респондент'},'answers':{'goalsMonitoring':'Нет','goalsForecast':'Нет','goalsFactorAnalysis':'Да, >90%','goalsDashboardsFormat':'link','goalsDashboards':'https://example.ru/dashboard'}}
    with (csv_dir/'questionare-responses(11).csv').open('w',encoding='utf-8',newline='') as handle:
        writer=csv.DictWriter(handle,fieldnames=['Год опроса','Квартал опроса','Результат опроса (JSON)'],delimiter=';')
        writer.writeheader();writer.writerow({'Год опроса':2026,'Квартал опроса':3,'Результат опроса (JSON)':json.dumps(payload,ensure_ascii=False)})
    monkeypatch.setattr(generator,'ROOT',tmp_path)
    result=generator.build()
    fact=next(p for p in result['products'] if p['id']==team['id'])['metrics']['goals.po_factor_analysis']
    assert fact['rawValue'] is None and fact['applicable'] is False and fact['hiddenFromProfile'] is True
    assert fact['source']['sourceKind']=='notApplicableFromLt'
    assert fact['source']['responses'][0]['rawValue']==1
    assert all((ROOT/'gravity-app/src/data'/name).read_bytes()==value for name,value in originals.items())
