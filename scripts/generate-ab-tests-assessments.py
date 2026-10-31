#!/usr/bin/env python3
"""Persist the 38 explicit Q3 A/B assessments with exact DDI identities."""
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = '''Персональная рекомендация\t1
SberID\t1
Сделка ИЖС\t1
Сделка с Первичным жильём\t1
Сделка вторичка\t1
Чат\t1
Колл-центр\t1
Телемаркетинг\t1
Выписки, справки\t1
Автокредит\t0.25
Вклады+НС\t0.25
POS-кредиты\t0.25
Top Affluent\t0
СберСпасибо\t1
МВС\t1
СберПрайм\t0.5
Рабочий возраст\t1
Дети\t1
Зрелость\t0.5
Дебетовые карты\t1
Кредитные карты\t1
Переводы по России\t1
Платежи\t1
Брокерский счет\t1
СберKids\t0.25
СБОЛ\t1
СберИнвестор\t1
Уведомления\t1
Пенсионный продукт\t1
Вжух\t1
Страхование жизни\t1
БПИФ\t1
ЗПИФ\t1
ОПИФ\t1
ПДС\t1
ЗЛС\t0.25
Страхование путешественников\t0.25
ИнвестКопилка\t1'''
ALIASES = {'Страхование путешественников': 'ВЗР', 'Вжух': 'SberPay Вжух', 'Дебетовые карты': 'Дебетовая карта', 'Переводы по России': 'Переводы по РФ'}


def build(report_path):
    report = json.loads(report_path.read_text())['products']
    products = []
    for row, line in enumerate(INPUT.splitlines(), 1):
        source_name, raw = line.split('\t')
        name = ALIASES.get(source_name, source_name)
        matches = [p for p in report if p['name'] == name]
        assert len(matches) == 1, source_name
        team = matches[0]
        value = float(raw)
        assert value in [0, .25, .5, 1]
        products.append({**{key: team[key] for key in ['id', 'name', 'unit', 'type']},
            'metrics': {'hyp.ab_tests': {'rawValue': value, 'source': {
                'origin': 'userConfirmedAbTestsAssessment', 'confirmedBy': 'user', 'period': 'III кв. 2026',
                'date': '2026-10-30', 'sourceRow': row, 'sourceName': source_name,
                'rule': 'Скорректированная пользовательская оценка A/B-тестов за III квартал. Максимум 0.25 для балла 0.25, иначе 1; применимость и включение в DDI восстанавливаются.'}}}})
    return {'period': 'III кв. 2026', 'scope': 'ab-tests-assessment',
            'source': {'origin': 'userConfirmedAbTestsAssessment', 'inputRows': INPUT,
                       'aliases': ALIASES, 'reportFile': str(report_path.relative_to(ROOT)),
                       'reportSha256': hashlib.sha256(report_path.read_bytes()).hexdigest(),
                       'maxRule': 'Явное указание пользователя от 2026-10-30: только в III квартале для оценки A/B 0.25 максимальный балл также 0.25 (100%); для оценок 0/0.5/1 максимум остаётся 1. Оценки абсолютные, не умножаются на новый максимум. II квартал не меняется.'},
            'products': products, 'counts': {'teams': len(products), 'facts': len(products),
                'byRawValue': dict(Counter(str(p['metrics']['hyp.ab_tests']['rawValue']) for p in products))}}


if __name__ == '__main__':
    data = build(ROOT / 'gravity-app/public/report-data.json')
    (ROOT / 'gravity-app/src/data/ab-tests-user-assessments-q3-2026.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(data['counts'], ensure_ascii=False))
