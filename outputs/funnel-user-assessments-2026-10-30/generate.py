"""Reproduce literal user-supplied normalized funnel assessments, 2026-10-30.

source-scores.tsv is a compact six-column transcription (dash = no instruction),
additional-scores.tsv holds the other funnels. Questions are expanded from the
literal common strings and the explicit per-row overrides below.
"""
from __future__ import annotations
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
REPORT = ROOT / 'gravity-app/public/report-data.json'
OUTPUT = ROOT / 'gravity-app/src/data/funnel-user-assessments-q3-2026.json'
PERIOD = 'III кв. 2026'
DATE = '2026-10-30'
EXCLUDED = {'Зарплатный продукт', 'ОМС', 'Слитки'}
ALIASES = {'Вжух': 'SberPay Вжух', 'Кредитная карта': 'Кредитные карты',
           'Дети/подростки': 'Дети', 'Страхование путешественников': 'ВЗР',
           'Персональная рекомендация (кампейнинг)': 'Персональная рекомендация',
           'Сберчаевые #B2C': 'СберЧаевые', 'Трансграничные переводы #B2C': 'Трансграничные переводы',
           'Трансграничный эквайринг #B2C': 'Трансграничный эквайринг'}
DIRECTIONS = {'churn': 'оттока', 'attract': 'привлечения', 'usage': 'использования',
              'onboarding': 'онбординга', 'entry': 'входа в канал', 'sales': 'продаж'}
BLOCKS = {'churn': 'churn', 'attract': 'attract', 'usage': 'voronka_ispolьzovaniya',
          'onboarding': 'voronka_onbordinga', 'entry': 'voronka_vhoda_v_kanal',
          'sales': 'voronka_prodazh', 'metrics': 'analiz_effektivnostь'}
REGULARITY = {
    ('Брокерский счет', 'attract'), ('ДСЖ КК', 'churn'), ('ДСЖ ПК', 'churn'), ('ДСЖ ПК', 'attract'),
    ('ЗПИФ', 'attract'), ('МВС', 'attract'), ('ОПИФ', 'attract'), ('Оплата улыбкой', 'churn'),
    ('Оплата улыбкой', 'attract'), ('Пакет услуг СберПервый', 'attract'), ('Пакет услуг СберПремьер', 'attract'),
    ('Рабочий возраст', 'churn'), ('Рабочий возраст', 'attract'), ('СберСова', 'attract'),
    ('Страхование путешественников', 'churn'), ('Страхование путешественников', 'attract'),
    ('Торговый Эквайринг', 'attract'), ('Уведомления', 'churn'), ('SberPay NFC', 'churn'),
}
ABSENT = {
    ('Колл-центр', 'entry', 'reporting'), ('Кредитная карта', 'attract', 'completeness'),
    ('ПДС', 'attract', 'completeness'), ('Персональная рекомендация (кампейнинг)', 'metrics', 'reporting'),
    ('СберИнвестор', 'onboarding', 'reporting'), ('СберИнвестор', 'attract', 'completeness'),
    ('СБОЛ', 'attract', 'completeness'), ('Телемаркетинг', 'sales', 'reporting'),
    ('Телемаркетинг', 'sales', 'completeness'), ('Уведомления', 'onboarding', 'completeness'),
    ('Уведомления', 'attract', 'completeness'), ('Чат', 'entry', 'reporting'), ('Чат', 'entry', 'completeness'),
}
INCLUDES_QUESTION = {('КАСКО', 'attract'), ('Конверсия', 'attract'), ('Много денег (НКПЗН)', 'attract'),
                     ('Образовательный кредит', 'churn'), ('Образовательный кредит', 'attract'),
                     ('Оплата улыбкой', 'attract'), ('ОСАГО', 'attract'), ('Пакет услуг СберПремьер', 'attract'),
                     ('Потребительский кредит', 'attract'), ('Сделка ИЖС', 'attract')}
CHANNEL_CHURN = {'СберИнвестор', 'СберKids', 'СБОЛ', 'Уведомления'}
CHANNEL_ATTRACT_ANALYSIS = {'СберKids', 'СБОЛ', 'Уведомления'}
CHANNEL_ATTRACT_REPORTING = {'СберИнвестор', 'Уведомления'}


def literal_metric(direction, kind):
    if kind == 'reporting': return 'Настроена отчетность'
    if kind == 'completeness': return 'Полнота отчета'
    if direction == 'metrics': return 'Проведение комплексного анализа по метрикам'
    return 'Проведение комплексного анализа воронки ' + DIRECTIONS[direction]


def literal_question(name, direction, kind, team_type):
    if (name, direction, kind) in ABSENT:
        return 'Отдельный вопрос в ответах отсутствует'
    if direction == 'metrics':
        return 'Проводился ли за последний квартал анализ отклонений по метрикам?'
    label = DIRECTIONS[direction]
    if kind == 'analysis':
        if direction == 'churn' and name in CHANNEL_CHURN:
            label += ' (снижения активности в канале)'
        elif direction == 'churn' and name == 'Почта, Диск, Календарь':
            label += ' (снижения активности в продукте)'
        elif direction == 'attract' and name in CHANNEL_ATTRACT_ANALYSIS:
            label += '/оформления'
        return f'Проводился ли за последний квартал анализ воронки {label}?'
    if kind == 'reporting':
        if (name, direction) in REGULARITY:
            return f'С какой регулярностью настроен мониторинг по воронке {label}?'
        if direction == 'attract' and name in CHANNEL_ATTRACT_REPORTING:
            return 'С какой регулярностью настроен мониторинг по воронке привлечения/оформления?'
        return f'Настроена ли регулярная отчётность по воронке {label}?'
    if direction == 'usage' and name in {'Почта, Диск, Календарь', 'SberID'}:
        return 'Какую отчетность вы используете для мониторинга метрик ниже?'
    if (name, direction) in INCLUDES_QUESTION:
        return f'Какие метрики включает отчёт по воронке {label}?'
    if direction == 'attract' and name == 'СберKids': label += '/оформления'
    entity = {'Канал': 'каналу', 'Сегмент': 'сегменту'}.get(team_type, 'продукту')
    return f'Какие метрики вы мониторите в рамках воронки {label} по вашему {entity}?'


def load_source_rows():
    rows = []
    with (HERE / 'source-scores.tsv').open() as handle:
        for line, record in enumerate(csv.DictReader(handle, delimiter='\t'), 2):
            for field, value in record.items():
                if field == 'product' or value == '-': continue
                direction, kind = field.split('_')
                rows.append({'product': record['product'], 'direction': direction, 'kind': kind,
                             'rawValue': float(value), 'inputFile': 'source-scores.tsv', 'inputLine': line, 'inputColumn': field})
    with (HERE / 'additional-scores.tsv').open() as handle:
        for line, record in enumerate(csv.DictReader(handle, delimiter='\t'), 2):
            rows.append({'product': record['product'], 'direction': record['direction'], 'kind': record['kind'],
                         'rawValue': float(record['value']), 'inputFile': 'additional-scores.tsv', 'inputLine': line, 'inputColumn': 'value'})
    return rows


def generate():
    catalog = json.loads(REPORT.read_text())['products']
    by_name = {}
    for team in catalog: by_name.setdefault(team['name'], []).append(team)
    products, source_rows, pending, excluded = {}, [], [], []
    for number, row in enumerate(load_source_rows(), 1):
        assert row['rawValue'] in {0, 0.5, 1}
        hits = by_name.get(ALIASES.get(row['product'], row['product']), [])
        assert len(hits) == 1, (row['product'], len(hits))
        team = hits[0]
        identity = {key: team[key] for key in ['id', 'name', 'unit', 'type']}
        row = {**row, 'row': number, 'metric': literal_metric(row['direction'], row['kind']),
               'question': literal_question(row['product'], row['direction'], row['kind'], team['type']),
               'date': DATE, 'origin': 'userConfirmedFunnelAssessment'}
        if row['product'] in EXCLUDED:
            row['status'] = 'excludedByUser'; excluded.append(row); source_rows.append(row); continue
        block_code = BLOCKS[row['direction']]
        if team['name'] == 'Почта, Диск, Календарь' and row['direction'] == 'usage': block_code = 'attract'
        block = next((item for item in team['metrics'] if item['code'] == block_code), None)
        candidates = [metric for metric in (block or {}).get('metrics', []) if metric['name'] == row['metric']]
        if len(candidates) != 1:
            row.update(status='pending', reason='metricNotUniquelyMapped', candidates=[m['code'] for m in candidates])
            pending.append(row); source_rows.append(row); continue
        metric = candidates[0]
        row['metricCode'] = metric['code']
        applicability_override = None
        if metric.get('is_applicabble_flg') is False or metric['max_value'] <= 0:
            if (team['name'], metric['code']) in {
                ('Трансграничные переводы', 'attract.report_completeness'),
                ('Трансграничный эквайринг', 'churn.nastroena_otchetnostь'),
            }:
                applicability_override = {'applicable': True, 'maxValue': 0.5, 'reason': 'explicitUserQ3Assessment'}
                row['applicabilityOverride'] = applicability_override
                row['baselineApplicable'] = metric.get('is_applicabble_flg')
                row['baselineMax'] = metric['max_value']
            else:
                row.update(status='pending', reason='metricNotApplicableInBaseline')
                pending.append(row); source_rows.append(row); continue
        row['status'] = 'applied'
        target = products.setdefault(team['id'], {**identity, 'metrics': {}})
        existing = target['metrics'].get(metric['code'])
        if existing:
            assert existing['rawValue'] == row['rawValue'], ('conflicting row', row)
            existing['source']['sourceRows'].append(number)
        else:
            target['metrics'][metric['code']] = {'rawValue': row['rawValue'], 'source': {
                'origin': 'userConfirmedFunnelAssessment', 'confirmedBy': 'user', 'date': DATE, 'period': PERIOD,
                'sourceName': row['product'], 'sourceMetricName': row['metric'], 'question': row['question'],
                'sourceRows': [number], 'rule': 'Явная оценка пользователя 0/0.5/1 умножается на максимум метрики. II квартал сохраняется; две явно оценённые ранее неприменимые метрики активируются только в III квартале со стандартным весом 0.5.'}}
            if applicability_override:
                target['metrics'][metric['code']]['applicabilityOverride'] = applicability_override
                target['metrics'][metric['code']]['source'].update(baselineApplicable=metric.get('is_applicabble_flg'), baselineMax=metric['max_value'])
        source_rows.append(row)
    by_metric = Counter(code for p in products.values() for code in p['metrics'])
    out = {'period': PERIOD, 'scope': 'funnel-user-assessment', 'source': {
        'origin': 'userConfirmedFunnelAssessment', 'confirmedBy': 'user', 'date': DATE,
        'reportFile': str(REPORT.relative_to(ROOT)), 'reportSha256': hashlib.sha256(REPORT.read_bytes()).hexdigest(),
        'aliases': ALIASES, 'excludedTeams': sorted(EXCLUDED),
        'rule': 'Только явно перечисленные оценки пользователя. Пустое место в таблице не создаёт оценки. Зарплатный продукт, ОМС и Слитки полностью исключены пользователем. Максимумы применимых метрик сохраняются. Две явно оценённые ранее неприменимые метрики активируются только в III квартале: Трансграничные переводы — attract.report_completeness; Трансграничный эквайринг — churn.nastroena_otchetnostь. Для обеих используется стандартный вес 0.5.',
        'transcriptionFiles': [str((HERE / name).relative_to(ROOT)) for name in ['source-scores.tsv', 'additional-scores.tsv']],
    }, 'products': list(products.values()), 'sourceRows': source_rows, 'pending': pending, 'excludedRows': excluded,
        'counts': {'sourceRows': len(source_rows), 'teams': len(products), 'facts': sum(by_metric.values()),
                   'excludedRows': len(excluded), 'pendingRows': len(pending), 'applicabilityOverrides': sum('applicabilityOverride' in fact for p in products.values() for fact in p['metrics'].values()), 'byMetric': dict(by_metric)}}
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
    (HERE / 'mapping.json').write_text(json.dumps({'counts': out['counts'], 'pending': pending, 'excludedTeams': sorted(EXCLUDED)}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'counts': out['counts'], 'pending': pending}, ensure_ascii=False, indent=2))


if __name__ == '__main__': generate()
