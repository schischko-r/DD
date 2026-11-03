import {selectRows, summarizeRows} from './report-model.js';

// Snapshot IDs may add a suffix for an empty questionnaire period.
export function teamKey(row) {
  return String(row.sourceTeamId || row.id || '').split('::empty::')[0];
}

function uniqueIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    const key = teamKey(row);
    if (key) index.set(key, index.has(key) ? null : row);
  }
  return index;
}

export function matchedRows(baseline, current, code, filters = {}) {
  const before = uniqueIndex(selectRows(baseline, code, filters).filter(r => Number.isFinite(r.pct)));
  const after = uniqueIndex(selectRows(current, code, filters).filter(r => Number.isFinite(r.pct)));
  return [...after].flatMap(([key, row]) => {
    const old = before.get(key);
    return row && old ? [{baseline: old, current: row, deltaPp: row.pct - old.pct,
      relativeChange: old.pct === 0 ? null : 100 * (row.pct - old.pct) / old.pct}] : [];
  });
}

export function compareRows(baseline, current, code, filters = {}) {
  const pairs = matchedRows(baseline, current, code, filters);
  const before = summarizeRows(pairs.map(p => p.baseline));
  const after = summarizeRows(pairs.map(p => p.current));
  const metric = (label, a, b) => ({label, baseline: pairs.length ? a : null, current: pairs.length ? b : null,
    deltaPp: pairs.length ? b - a : null, relativeChange: pairs.length && a !== 0 ? 100 * (b - a) / a : null});
  return {pairs, before, after,
    baselineCount: selectRows(baseline, code, filters).filter(r => Number.isFinite(r.pct)).length,
    currentCount: selectRows(current, code, filters).filter(r => Number.isFinite(r.pct)).length,
    metrics: [metric('Среднее выполнение', before.mean, after.mean),
      metric('Медиана выполнения', before.percentiles.P50, after.percentiles.P50),
      ...before.levels.map((level, i) => metric(`Доля «${level.label.toLocaleLowerCase('ru')}»`, level.share, after.levels[i].share))],
  };
}
