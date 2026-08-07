import React from 'react';
import {ArrowUpRightFromSquare, CircleInfo} from '@gravity-ui/icons';
import {Button, Dialog, Disclosure, Icon, Label, Text} from '@gravity-ui/uikit';

const severity = {
  crit: {label: 'Критично', theme: 'danger'},
  mid: {label: 'Средне', theme: 'warning'},
  info: {label: 'Информация', theme: 'info'},
};

export function CJXplorerDialog({product, open, onClose}) {
  if (!product) return null;
  const rating = product.rating || {};
  const issues = product.issues || {};
  const scenarios = product.scenarios || {};
  const counts = product.counts || {};
  const staleDays = 30;
  const staleScenarios = (scenarios.items || []).filter((scenario) => Number(scenario.age_days) > staleDays).length;
  const acceptedIssues = issues.accepted ? (issues.items || []) : [];
  const groups = acceptedIssues.reduce((result, issue) => {
    const key = issue.journey || 'Сценарий не указан';
    result.set(key, [...(result.get(key) || []), issue]);
    return result;
  }, new Map());
  const delta = Number(rating.delta);
  return <Dialog open={open} onClose={onClose} hasCloseButton maxWidth="l" fullWidth contentOverflow="auto">
    <Dialog.Header caption="Навык «Оценка CJ»" />
    <Dialog.Body>
      <section className="cjx-dialog">
        <header className="cjx-dialog-hero"><div><Text variant="caption-2" color="secondary">CJXPLORER · КЛИЕНТСКИЙ ПУТЬ</Text><h2>{product.name}</h2><Text variant="body-2" color="secondary">{product.own_org || 'Организация не указана'}</Text></div><div className="cjx-rating"><span>Рейтинг</span><strong>{rating.now ?? '—'}</strong><small className={delta < 0 ? 'cjx-delta-negative' : 'cjx-delta-positive'}>{Number.isFinite(delta) ? `${delta > 0 ? '+' : ''}${delta}` : 'нет сравнения'} к прошлой оценке</small></div></header>
        <div className="cjx-stats"><div><span>Находки</span><b>{issues.count ?? acceptedIssues.length}</b><small>{issues.accepted ? 'Акцептованные' : 'Без акцепта'}</small></div><div><span>Критичные</span><b>{counts.critical ?? 0}</b><small>Требуют внимания</small></div><div><span>Сценарии</span><b>{scenarios.scenarios_with_runs ?? scenarios.with_runs ?? 0}</b><small>{staleScenarios ? `${staleScenarios} старше ${staleDays} дн.` : 'Все актуальны ≤ 30 дн.'}</small></div></div>
        <div className="cjx-dialog-note"><Icon data={CircleInfo} size={16} /><Text variant="body-2">Данные CJXplorer.</Text></div>
        <section className="cjx-issues" aria-labelledby="cjx-issues-title"><div className="cjx-issues-head"><div><Text variant="subheader-2" id="cjx-issues-title">Акцептованные проблемы</Text><Text variant="body-2" color="secondary">{acceptedIssues.length} шт. · сгруппированы по сценарию</Text></div>{issues.accepted && <Label theme="success" size="s">Акцептованы</Label>}</div>{issues.accepted ? <div className="cjx-issues-list">{[...groups.entries()].map(([journey, journeyIssues], groupIndex) => <Disclosure key={journey} className="cjx-journey" size="l" arrowPosition="start" defaultExpanded={groupIndex === 0} summary={`${journey} · ${journeyIssues.length} шт.`}><div className="cjx-journey-items">{journeyIssues.map((issue, index) => { const meta = severity[issue.severity] || {label: issue.severity || 'Без уровня', theme: 'normal'}; return <article className="cjx-issue" key={`${issue.run_url || journey}-${index}`}><div className="cjx-issue-meta"><Label theme={meta.theme} size="s">{meta.label}</Label>{issue.criterion && <Text variant="caption-2" color="secondary">{issue.criterion}</Text>}</div><Text variant="body-2" className="cjx-issue-text">{issue.text || 'Описание не указано'}</Text>{issue.recommendation && <div className="cjx-issue-recommendation"><Text variant="caption-2" color="secondary">Рекомендация</Text><Text variant="body-2">{issue.recommendation}</Text></div>}<div className="cjx-issue-footer"><Text variant="caption-2" color="secondary">{[issue.app, issue.screen].filter(Boolean).join(' · ')}</Text>{issue.run_url && <Button view="flat-info" size="s" href={issue.run_url} target="_blank">Открыть прогон <Icon data={ArrowUpRightFromSquare} size={13} /></Button>}</div></article>; })}</div></Disclosure>)}</div> : <Text variant="body-2" color="secondary">Для этого продукта нет акцептованных находок.</Text>}</section>
        <div className="cjx-dialog-actions"><Button view="action" size="l" href={product.url} target="_blank">Открыть карточку в CJXplorer <Icon data={ArrowUpRightFromSquare} size={15} /></Button></div>
      </section>
    </Dialog.Body>
  </Dialog>;
}
