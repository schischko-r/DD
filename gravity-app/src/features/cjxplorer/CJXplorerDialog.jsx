import React from 'react';
import {ArrowUpRightFromSquare, CircleInfo} from '@gravity-ui/icons';
import {Button, Dialog, Icon, Label, Text} from '@gravity-ui/uikit';

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
        <header className="cjx-dialog-hero"><div><Text variant="caption-2" color="secondary">CJXPLORER · КЛИЕНТСКИЙ ПУТЬ</Text><h2>{product.name}</h2><Text variant="body-2" color="secondary">{product.category || 'Категория не указана'} · {product.own_org || 'Организация не указана'}</Text></div><div className="cjx-rating"><span>Рейтинг</span><strong>{rating.now ?? '—'}</strong><small className={delta < 0 ? 'cjx-delta-negative' : 'cjx-delta-positive'}>{Number.isFinite(delta) ? `${delta > 0 ? '+' : ''}${delta}` : 'нет сравнения'} к прошлой оценке</small></div></header>
        <div className="cjx-stats"><div><span>Позиция</span><b>{rating.place ? `${rating.place} из ${rating.of_orgs}` : '—'}</b><small>{rating.leader_org ? `Лидер — ${rating.leader_org}` : 'Нет сравнения'}</small></div><div><span>Находки</span><b>{issues.count ?? acceptedIssues.length}</b><small>{issues.accepted ? 'Акцептованные' : 'Без акцепта'}</small></div><div><span>Критичные</span><b>{counts.critical ?? 0}</b><small>Требуют внимания</small></div><div><span>Сценарии</span><b>{scenarios.scenarios_with_runs ?? scenarios.with_runs ?? 0}</b><small>{scenarios.stale ? `${scenarios.stale} устарело` : 'Все актуальны'}</small></div></div>
        <div className="cjx-dialog-note"><Icon data={CircleInfo} size={16} /><Text variant="body-2">Данные — ночной снимок CJXplorer.</Text></div>
        {issues.accepted && acceptedIssues.length > 0 && <section className="cjx-issues"><Text variant="subheader-2">Акцептованные проблемы</Text>{[...groups.entries()].map(([journey, journeyIssues]) => <section className="cjx-journey" key={journey}><Text variant="subheader-3">{journey} · {journeyIssues.length} шт.</Text>{journeyIssues.map((issue, index) => { const meta = severity[issue.severity] || {label: issue.severity || 'Без уровня', theme: 'normal'}; return <article className="cjx-issue" key={`${issue.run_url || journey}-${index}`}><div className="cjx-issue-meta"><Label theme={meta.theme} size="s">{meta.label}</Label>{issue.criterion && <Text variant="caption-2" color="secondary">{issue.criterion}</Text>}</div><Text variant="body-2">{issue.text}</Text>{issue.recommendation && <div className="cjx-issue-recommendation"><Text variant="caption-2" color="secondary">Рекомендация</Text><Text variant="body-2">{issue.recommendation}</Text></div>}<div className="cjx-issue-footer"><Text variant="caption-2" color="secondary">{[issue.app, issue.screen].filter(Boolean).join(' · ')}</Text>{issue.run_url && <Button view="flat-info" size="s" href={issue.run_url} target="_blank">Открыть прогон <Icon data={ArrowUpRightFromSquare} size={13} /></Button>}</div></article>; })}</section>)}</section>}
        <div className="cjx-dialog-actions"><Button view="action" size="l" href={product.url} target="_blank">Открыть карточку в CJXplorer <Icon data={ArrowUpRightFromSquare} size={15} /></Button></div>
      </section>
    </Dialog.Body>
  </Dialog>;
}
