const ALL_DATA_ASSIGNMENT = /\bvar\s+_ALL_DATA\s*=\s*/g;

export const CLICKSTREAM_TRAFFIC_LABELS = Object.freeze({
  green: Object.freeze({
    label: 'Рост',
    description: 'Количество событий на последнем шаге растёт относительно прошлого периода',
  }),
  yellow: Object.freeze({
    label: 'Нейтрально',
    description: 'Незначительное снижение или недостаточно данных для устойчивого тренда',
  }),
  red: Object.freeze({
    label: 'Снижение',
    description: 'На протяжении 3+ периодов наблюдается последовательное снижение',
  }),
});

export const CLICKSTREAM_ANALYTICS_LABELS = Object.freeze({
  local: 'Локальный барьер',
  distributed: 'Системное снижение',
  cascade: 'Каскадное падение',
  traffic: 'Падение трафика',
  stable: 'CR стабилен',
});

function findJsonObjectEnd(source, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }

  return -1;
}

export function extractClickstreamData(html) {
  const source = String(html || '');
  ALL_DATA_ASSIGNMENT.lastIndex = 0;
  const assignment = ALL_DATA_ASSIGNMENT.exec(source);
  if (!assignment) {
    throw new Error('Clickstream source does not contain var _ALL_DATA');
  }

  const objectStart = source.indexOf('{', assignment.index + assignment[0].length);
  if (objectStart < 0) {
    throw new Error('Clickstream _ALL_DATA assignment does not contain a JSON object');
  }
  const objectEnd = findJsonObjectEnd(source, objectStart);
  if (objectEnd < 0) {
    throw new Error('Clickstream _ALL_DATA JSON object is not closed');
  }

  let data;
  try {
    data = JSON.parse(source.slice(objectStart, objectEnd));
  } catch (error) {
    throw new Error(`Clickstream _ALL_DATA is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(data?.funnels) || !Array.isArray(data?.periods) || !data?.data) {
    throw new Error('Clickstream _ALL_DATA has an unexpected shape');
  }
  return data;
}

export function clickstreamPeriodValue(period) {
  if (!period?.date_from || !period?.date_to) return '';
  return `${period.date_from}|${period.date_to}`;
}

export function latestClickstreamPeriod(periods) {
  return (periods || []).reduce((latest, period) => {
    const value = clickstreamPeriodValue(period);
    if (!value) return latest;
    return !latest || value.localeCompare(clickstreamPeriodValue(latest)) > 0
      ? period
      : latest;
  }, null);
}

export function createFunnelNameIndex(funnels) {
  const result = new Map();
  for (const funnel of funnels || []) {
    result.set(String(funnel?.funnel_name || ''), String(funnel?.funnel_id || ''));
  }
  return result;
}

export function resolveClickstreamFunnelId(data, funnelNameOrId) {
  const value = String(funnelNameOrId ?? '').trim();
  if (!value) return '';

  const idMatch = (data?.funnels || []).find(
    (funnel) => String(funnel?.funnel_id ?? '') === value,
  );
  if (idMatch) return String(idMatch.funnel_id);

  return createFunnelNameIndex(data?.funnels).get(value) || '';
}

export function getClickstreamCatalogFromData(data) {
  const periods = (data?.periods || []).map((period) => ({
    value: clickstreamPeriodValue(period),
    label: `${period.date_from} — ${period.date_to}`,
    dateFrom: period.date_from,
    dateTo: period.date_to,
  }));
  const latestPeriod = latestClickstreamPeriod(data?.periods);
  return {
    funnels: (data?.funnels || []).map((funnel) => ({
      id: String(funnel.funnel_id),
      name: funnel.funnel_name,
    })),
    periods,
    latestPeriodValue: clickstreamPeriodValue(latestPeriod),
  };
}

function numericStepEntries(funnel) {
  return Object.entries(funnel || {})
    .map(([stepNumber, step]) => [Number(stepNumber), step])
    .filter(([stepNumber]) => Number.isFinite(stepNumber))
    .sort(([left], [right]) => left - right);
}

function roundedPercent(value) {
  return Number((Number(value || 0) * 100).toFixed(1));
}

export function buildClickstreamSteps(report) {
  const funnel = report?.funnel || {};
  const previousFunnel = report?.prev_funnel || {};
  const entries = numericStepEntries(funnel);
  const firstStep = entries[0]?.[1];

  return entries.map(([number, step]) => {
    const previousStep = previousFunnel[number];
    const previousInCurrentFunnel = funnel[number - 1] || firstStep;
    const conversionFromPrevious = step.conv_from_prev == null
      ? null
      : roundedPercent(step.conv_from_prev);
    const previousConversionFromPrevious = previousStep?.conv_from_prev == null
      ? null
      : roundedPercent(previousStep.conv_from_prev);
    const conversionDelta = previousConversionFromPrevious == null
      || conversionFromPrevious == null
      ? null
      : Number((conversionFromPrevious - previousConversionFromPrevious).toFixed(1));
    const lost = step.conv_from_prev == null || !previousInCurrentFunnel
      ? null
      : Number(previousInCurrentFunnel.count || 0) - Number(step.count || 0);

    return {
      number,
      id: step.step_id,
      name: step.step_name,
      count: Number(step.count || 0),
      countDelta: previousStep
        ? Number(step.count || 0) - Number(previousStep.count || 0)
        : null,
      conversionFromPrevious,
      conversionFromStart: roundedPercent(step.conv_from_start),
      previousConversionFromPrevious,
      conversionDelta,
      lost,
      lostPercent: previousInCurrentFunnel?.count && conversionFromPrevious != null
        ? Number((100 - conversionFromPrevious).toFixed(1))
        : null,
      eventActions: step.event_actions || [],
      nrtMatches: report?.nrt_matches?.[String(number)] || [],
      raw: step,
    };
  });
}

export function selectTopClickstreamDrops(steps, limit = 2) {
  return (steps || [])
    .filter((step) => step.conversionFromPrevious != null)
    .sort((left, right) => (
      left.conversionFromPrevious - right.conversionFromPrevious
      || left.number - right.number
    ))
    .slice(0, limit);
}

export function buildClickstreamSummary(report, funnelName, periodValue) {
  const entries = numericStepEntries(report?.funnel);
  if (!entries.length) return null;

  const [firstNumber, firstStep] = entries[0];
  const [lastNumber, lastStep] = entries.at(-1);
  const [dateFrom = '', dateTo = ''] = String(periodValue || '').split('|');
  return {
    funnelName,
    dateFrom,
    dateTo,
    incoming: Number(firstStep.count || 0),
    incomingStep: {number: firstNumber, name: firstStep.step_name},
    final: Number(lastStep.count || 0),
    finalStep: {number: lastNumber, name: lastStep.step_name},
    totalConversion: roundedPercent(lastStep.conv_from_start),
  };
}

function stripNrtPrefix(value) {
  return String(value || '').replace(/^[a-zA-Z][\w\s]* \/ /, '').trim();
}

export function computeClickstreamNrtCoverage(report) {
  if (!report?.nrt_configured) return null;

  const steps = numericStepEntries(report.funnel)
    .filter(([, step]) => (step.event_actions || []).length > 0);
  if (!steps.length) return null;

  const notCovered = [];
  const partial = [];
  const extra = [];
  let fullyCovered = 0;

  for (const [number, step] of steps) {
    const groups = report.nrt_matches?.[String(number)] || [];
    if (!groups.length) {
      notCovered.push(step.step_name);
      continue;
    }

    const coveredEvents = new Set();
    let hasExtra = false;
    for (const group of groups) {
      for (const event of group.events || []) {
        if (event.matched) {
          coveredEvents.add(stripNrtPrefix(event.original));
        } else {
          hasExtra = true;
        }
      }
    }

    if ((step.event_actions || []).every((action) => coveredEvents.has(action))) {
      fullyCovered += 1;
    } else {
      partial.push(step.step_name);
    }
    if (hasExtra) extra.push(step.step_name);
  }

  const total = steps.length;
  return {
    notCovered,
    partial,
    extra,
    fullyCovered,
    total,
    coveredPercent: total > 0 ? Math.round(fullyCovered / total * 100) : 0,
  };
}

function worstRecommendationStep(report) {
  const analytics = report?.analytics || {};
  const stepDrops = analytics.step_drops || [];
  if (analytics.barrier) return {...analytics.barrier, comparison: 'period'};

  const negativeDrops = stepDrops.filter((step) => step.delta_cr < 0);
  if (negativeDrops.length) {
    return {
      ...negativeDrops.reduce(
        (worst, step) => (worst.delta_cr < step.delta_cr ? worst : step),
      ),
      comparison: 'period',
    };
  }

  const fallback = numericStepEntries(report?.funnel)
    .map(([number, step]) => ({
      step: number,
      step_name: step.step_name,
      conv_from_prev: step.conv_from_prev,
    }))
    .filter((step) => step.conv_from_prev != null && step.conv_from_prev < 1)
    .reduce(
      (worst, step) => (
        !worst || step.conv_from_prev <= worst.conv_from_prev ? step : worst
      ),
      null,
    );
  return fallback ? {...fallback, delta_cr: null, comparison: 'conversion'} : null;
}

export function buildClickstreamRecommendations(report) {
  const trafficLight = report?.traffic_light || 'yellow';
  if (trafficLight === 'green') {
    return [{
      kind: 'positive',
      text: 'Продажи растут. Так держать!',
    }];
  }

  const recommendations = [];
  const worstStep = worstRecommendationStep(report);
  if (worstStep) {
    const detail = worstStep.delta_cr != null
      ? ` — здесь наибольшая потеря CR (−${Math.abs(worstStep.delta_cr).toFixed(1)} пп) и отрицательная динамика М/М`
      : ' — наименьшая конверсия к предыдущему шагу';
    recommendations.push({
      kind: 'step',
      step: Number(worstStep.step),
      stepName: worstStep.step_name,
      text: `Проверьте шаг ${worstStep.step} «${worstStep.step_name}»${detail}.`,
    });
  } else {
    recommendations.push({
      kind: 'step',
      text: 'Проверьте динамику конверсии по шагам воронки — найдите этап с наибольшим снижением.',
    });
  }

  const stepReference = worstStep
    ? `На шаге ${worstStep.step} «${worstStep.step_name}» — `
    : '';
  recommendations.push({
    kind: 'research',
    text: `${stepReference}проведите исследование CJ в агенте или посмотрите уже готовые рекомендации.`,
    link: {
      label: 'CJXplorer',
      href: 'https://cjxplorer.com/invite/b6eb223a-90b9-42bd-ae6a-d5f57f727f09',
    },
  });

  const funnelReport = report?.funnel_report || {};
  const negativeChannels = (funnelReport.channel_top_changes || [])
    .filter((channel) => channel.delta < 0)
    .slice(0, 3);
  if (
    funnelReport.sales_delta != null
    && funnelReport.sales_delta < 0
    && funnelReport.sales_current != null
    && funnelReport.sales_prev != null
  ) {
    recommendations.push({
      kind: 'campaigns',
      salesCurrent: funnelReport.sales_current,
      salesPrevious: funnelReport.sales_prev,
      salesDelta: funnelReport.sales_delta,
      salesPercentChange: funnelReport.sales_pct_change,
      negativeChannels,
      text: 'Продажи от кампаний коммуникаций снизились относительно прошлого периода.',
    });
  } else {
    recommendations.push({
      kind: 'campaigns',
      text: 'Проверьте кампании по продажам.',
      link: {label: 'Отчёт по воронке продаж кампейнинга', href: '/funnel'},
    });
  }

  const nrtCoverage = computeClickstreamNrtCoverage(report);
  if (
    nrtCoverage
    && (
      nrtCoverage.notCovered.length
      || nrtCoverage.partial.length
      || nrtCoverage.extra.length
    )
  ) {
    recommendations.push({
      kind: 'nrt',
      text: 'NRT-покрытие требует внимания.',
      details: {
        notCovered: nrtCoverage.notCovered,
        partial: nrtCoverage.partial,
        extra: nrtCoverage.extra,
      },
    });
  }

  return recommendations;
}

export function buildClickstreamTraffic(report) {
  const status = report?.traffic_light || 'yellow';
  const metadata = CLICKSTREAM_TRAFFIC_LABELS[status] || {
    label: status,
    description: '',
  };
  const previousPeriod = report?.prev_period || null;
  return {
    status,
    ...metadata,
    previousPeriod,
    previousPeriodLabel: previousPeriod
      ? `${previousPeriod.date_from} — ${previousPeriod.date_to}`
      : '—',
  };
}

export function buildClickstreamConclusion(report) {
  const analytics = report?.analytics;
  if (!analytics) return null;
  return {
    pattern: analytics.pattern,
    label: CLICKSTREAM_ANALYTICS_LABELS[analytics.pattern] || analytics.pattern,
    text: analytics.text || '',
    periodMark: 'м/м',
    barrier: analytics.barrier || null,
    significantDrops: analytics.significant_drops || [],
  };
}

export function getClickstreamReportFromData(data, funnelNameOrId, periodValue) {
  const funnelId = resolveClickstreamFunnelId(data, funnelNameOrId);
  if (!funnelId || !periodValue) return null;

  const raw = data?.data?.[funnelId]?.[periodValue];
  if (!raw) return null;
  const funnel = (data?.funnels || []).find(
    (item) => String(item.funnel_id) === funnelId,
  );
  const funnelName = funnel?.funnel_name || String(funnelNameOrId || '').trim();
  const [dateFrom = '', dateTo = ''] = String(periodValue).split('|');
  const steps = buildClickstreamSteps(raw);
  return {
    funnelId,
    funnelName,
    period: {value: periodValue, dateFrom, dateTo, label: `${dateFrom} — ${dateTo}`},
    raw,
    summary: buildClickstreamSummary(raw, funnelName, periodValue),
    steps,
    topCrDrops: selectTopClickstreamDrops(steps),
    traffic: buildClickstreamTraffic(raw),
    recommendations: buildClickstreamRecommendations(raw),
    nrtCoverage: computeClickstreamNrtCoverage(raw),
    conclusion: buildClickstreamConclusion(raw),
  };
}
