#!/usr/bin/env python3
"""Persist the confirmed Q3 PO rules, keeping LT baseline and survey provenance separate."""
import csv
import hashlib
import ipaddress
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PERIOD = 'III кв. 2026'
QUESTIONS = {'goals.po_monitoring': 'goalsMonitoring', 'goals.po_forecast': 'goalsForecast',
             'goals.po_factor_analysis': 'goalsFactorAnalysis'}
LT_CODES = {'goals.po_monitoring': 'goals.monitored', 'goals.po_forecast': 'goals.forecast',
            'goals.po_factor_analysis': 'goals.factor_analysis_l1_l2'}
ALIASES = {'Трансграничные переводы #B2C': 'Трансграничные переводы',
           'Сберчаевые #B2C': 'СберЧаевые', 'Трансграничный эквайринг #B2C': 'Трансграничный эквайринг'}


def has_dashboard_link(report_evidence):
    entries = report_evidence if isinstance(report_evidence, list) else [report_evidence]
    for entry in entries:
        for token in str(entry or '').replace('\\n', '\n').replace('\\r', '\r').splitlines():
            token = token.strip()
            if not token or re.search(r'\s', token):
                continue
            # Accept a whole HTTP(S) URL or a whole bare-domain URL, not URL
            # substrings inside prose or a different URI scheme.
            if '://' not in token:
                if not re.match(r'^(?:[\w-]+\.)+[\w-]+(?::\d+)?(?:[/#?]|$)', token):
                    continue
                token = 'https://' + token
            try:
                parsed = urlsplit(token)
                host = parsed.hostname
                if parsed.scheme.lower() not in {'http', 'https'} or not host or parsed.username or parsed.password:
                    continue
                _ = parsed.port  # Invalid/non-numeric/out-of-range ports raise.
                try:
                    ipaddress.ip_address(host)
                except ValueError:
                    ascii_host = host.rstrip('.').encode('idna').decode('ascii')
                    if len(ascii_host) > 253 or not all(re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?', label)
                                                        for label in ascii_host.split('.')):
                        continue
                return True
            except (ValueError, UnicodeError):
                continue
    return False


def score(question, answer, report_format, report_evidence=None):
    full = 'Да (включены все цели)' if question == 'goalsMonitoring' else 'Да, >90%'
    partial = 'Частично (мониторинг не по всем целям)' if question == 'goalsMonitoring' else 'Частично, <90%'
    if answer in [partial, 'Нет']:
        return 0
    if answer == full:
        if report_format == 'excel':
            return .5
        return 1 if report_format == 'link' and has_dashboard_link(report_evidence) else None
    return None


def survey_score(team, evidence, policy):
    values = {r['rawValue'] for r in evidence}
    if team['name'] in policy['maximumSurveyTeams'] and evidence and None not in values:
        return max(values), 'maximumAcrossConfirmedRespondents'
    if team['name'] == 'Зарплатный продукт' and policy['salarySurveyPolicy'] == 'confirmedB2c':
        selected = [r['rawValue'] for r in evidence if 'королева' in r['respondent'].lower()]
        if len(selected) == 1:
            return selected[0], 'userConfirmedB2cResponse'
    if team['name'] == 'Зарплатный продукт' and policy['salarySurveyPolicy'] == 'averageWithUnknownZero':
        cohorts = {('b2b' if 'сауткин' in r['respondent'].lower() else 'b2c' if 'королева' in r['respondent'].lower() else None): r['rawValue'] for r in evidence}
        if set(cohorts) == {'b2b', 'b2c'}:
            return sum(value if value is not None else 0 for value in cohorts.values())/2, 'averageWithUnknownSourceZero'
    if len(values) == 1 and None not in values:
        return next(iter(values)), 'consistentSurveyAnswers'
    return None, 'conflictingAnswers' if len(values) > 1 else 'missingAnswerOrSource'


def apply_excel_rule(team, value, evidence, policy):
    if not policy.get('excelUseSurveyAnswersForAllTeams') or value is None:
        return value
    # A separate dashboard response can still support the explicitly approved
    # maximum. All current Excel teams have one unambiguous survey response.
    if evidence and all(response.get('reportFormat') == 'excel' for response in evidence):
        assessed, _ = survey_score(team, evidence, policy)
        return min(value, assessed) if assessed is not None else None
    return value


def build():
    config = json.loads((ROOT/'gravity-app/src/data/goals-tribe-source-q3-2026.json').read_text())
    target = config['assignments']
    policy_file = ROOT/'gravity-app/src/data/po-goals-policy-q3-2026.json'
    policy = json.loads(policy_file.read_text())
    direct = json.loads((ROOT/'gravity-app/src/data/goals-informational-q3-2026.json').read_text())['products']
    direct_ids = {p['id'] for p in direct}
    expected = {p['id'] for p in target if p['unit'] == 'УБ' or p['unit'] == 'CBP' and p['catalogTribe'] == 'Комиссионные продукты'}
    assert direct_ids == expected and len(expected) == 25
    assert len(target) == len({p['id'] for p in target}) == 76
    baseline_file = ROOT/'gravity-app/src/data/goals-tribe-assessments-q3-2026.json'
    baseline = {p['id']: p['metrics'] for p in json.loads(baseline_file.read_text())['products']}
    applicability_file = ROOT/'gravity-app/src/data/goals-tribe-applicability-q3-2026.json'
    applicability = {p['id']: p['metrics'] for p in json.loads(applicability_file.read_text())['products']}
    responses = defaultdict(list)
    files, excluded = [], []
    for file in sorted((ROOT/'ddi_3q_response').glob('*.csv')):
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        files.append({'file': str(file.relative_to(ROOT)), 'sha256': digest})
        with file.open(encoding='utf-8-sig', newline='') as handle:
            for line, row in enumerate(csv.DictReader(handle, delimiter=';'), 2):
                payload = json.loads(row['Результат опроса (JSON)'])
                respondent = payload.get('respondent', {}).get('name', '').strip()
                if 'чикин' in respondent.lower():
                    excluded.append({'file': str(file.relative_to(ROOT)), 'csvRow': line,
                                     'respondent': respondent, 'reason': 'Excluded by user instruction'})
                    continue
                if str(row.get('Год опроса')) != '2026' or str(row.get('Квартал опроса')) != '3':
                    continue
                team = payload.get('team', {})
                matches = [p for p in target if p['id'] == team.get('id') and p['unit'] == team.get('unit')]
                if not matches:
                    name = ALIASES.get(team.get('name'), team.get('name'))
                    matches = [p for p in target if p['name'] == name and p['unit'] == team.get('unit')]
                if len(matches) != 1:
                    continue
                responses[matches[0]['id']].append({'file': str(file.relative_to(ROOT)), 'sha256': digest,
                    'csvRow': line, 'respondent': respondent, 'completedAt': payload.get('completedAt'),
                    'surveyId': payload.get('surveyId'), 'team': team, 'answers': payload['answers']})
    products, pending = [], []
    for team in target:
        metrics = {}
        for code, question in QUESTIONS.items():
            evidence = []
            for response in responses[team['id']]:
                answers = response['answers']
                answer, fmt = answers.get(question), answers.get('goalsDashboardsFormat')
                evidence.append({**{k: v for k, v in response.items() if k != 'answers'},
                    'questionId': question, 'answer': answer, 'reportFormat': fmt,
                    'reportEvidence': answers.get('goalsDashboards'), 'rawValue': score(question, answer, fmt, answers.get('goalsDashboards'))})
            lt = baseline.get(team['id'], {}).get(LT_CODES[code])
            lt_value = lt['rawValue'] if lt else None
            if lt is None:
                assert applicability.get(team['id'], {}).get(LT_CODES[code], {}).get('applicable') is False, (team['name'], code)
            lt_source_file = baseline_file if lt is not None else applicability_file
            is_direct = team['id'] in direct_ids
            if lt is None and policy['notApplicableLtPolicy'] == 'exclude':
                value, resolution, kind = None, 'notApplicableLtExcluded', 'notApplicableFromLt'
            elif is_direct:
                value, resolution = survey_score(team, evidence, policy)
                kind = 'directSurvey'
            elif lt_value is not None and lt_value > 0:
                value, resolution, kind = lt_value, 'positiveLtScorePreserved', 'ltBaseline'
            elif lt_value == 0 or policy['notApplicableLtPolicy'] == 'survey':
                value, resolution = survey_score(team, evidence, policy)
                kind = 'surveyAfterLtZero' if lt_value == 0 else 'surveyAfterNotApplicableLt'
            elif policy['notApplicableLtPolicy'] == 'exclude':
                value, resolution, kind = None, 'notApplicableLtExcluded', 'notApplicableFromLt'
            else:
                value, resolution, kind = None, 'notApplicableLtNeedsRule', 'unresolvedNotApplicableLt'
            before_format_cap = value
            value = apply_excel_rule(team, value, evidence, policy)
            source = {'origin': 'userConfirmedScopedPoGoalsSurvey' if is_direct else 'userConfirmedPoGoalsLtFallback',
                      'confirmedBy': 'user', 'period': PERIOD, 'date': '2026-10-30', 'questionId': question,
                      'sourceKind': kind, 'resolution': resolution, 'responses': evidence,
                      'policyFile': str(policy_file.relative_to(ROOT)), 'policySha256': hashlib.sha256(policy_file.read_bytes()).hexdigest(),
                      'ltMetricCode': LT_CODES[code], 'ltRawValue': lt_value,
                      'ltSourceFile': str(lt_source_file.relative_to(ROOT)), 'ltSourceSha256': hashlib.sha256(lt_source_file.read_bytes()).hexdigest()}
            if value != before_format_cap:
                source['formatAdjustment'] = {'type': 'excelSurveyTable', 'before': before_format_cap, 'after': value,
                                              'rule': 'For every PO Excel response: full=0.5, partial/no=0, including a positive LT base'}
                source['resolution'] = 'positiveLtScoreWithExcelSurveyTable'
            if resolution == 'averageWithUnknownSourceZero':
                source['cohortScores'] = {('B2B' if 'сауткин' in r['respondent'].lower() else 'B2C'): (r['rawValue'] if r['rawValue'] is not None else 0) for r in evidence}
                source['aggregation'] = '(B2B + B2C) / 2; unknown B2B source is zero by user confirmation'
            not_applicable = kind == 'notApplicableFromLt'
            if value is None and not not_applicable:
                source['pendingReason'] = resolution
                pending.append({'id': team['id'], 'name': team['name'], 'code': code, 'reason': resolution,
                                'responses': evidence})
            metrics[code] = {'rawValue': value, 'source': source,
                             **({'applicable': False, 'hiddenFromProfile': True} if not_applicable else {})}
        products.append({**{k: team[k] for k in ['id', 'name', 'unit', 'type']}, 'metrics': metrics})
    counts = Counter(str(f['rawValue']) for p in products for f in p['metrics'].values())
    kinds = Counter(f['source']['sourceKind'] for p in products for f in p['metrics'].values())
    return {'period': PERIOD, 'scope': 'po-goals-assessment',
            'source': {**policy['source'], 'files': files, 'policyFile': str(policy_file.relative_to(ROOT)),
                       'scope': 'Direct survey for 25 teams; positive LT retained and zero LT supplemented by survey for other teams',
                       'excludedRespondents': excluded}, 'products': products, 'pending': pending,
            'counts': {'teams': len(products), 'directSurveyTeams': len(direct_ids), 'responses': sum(map(len, responses.values())),
                       'scoredFacts': sum(f['rawValue'] is not None for p in products for f in p['metrics'].values()),
                       'notApplicableFacts': sum(f.get('applicable') is False for p in products for f in p['metrics'].values()),
                       'pendingFacts': len(pending), 'byRawValue': dict(counts),
                       'bySourceKind': dict(kinds)}}


if __name__ == '__main__':
    data = build()
    (ROOT/'gravity-app/src/data/po-goals-survey-assessments-q3-2026.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(data['counts'], ensure_ascii=False))
