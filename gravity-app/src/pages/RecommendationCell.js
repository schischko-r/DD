import React from 'react';

export function RecommendationCell({children}) {
  return React.createElement('div', {className: 'backlog-recommendation-cell'}, children);
}

export function isMetricAbove(value, benchmark) {
  return value !== null && value !== undefined && value !== ''
    && benchmark !== null && benchmark !== undefined && benchmark !== ''
    && Number.isFinite(Number(value)) && Number.isFinite(Number(benchmark))
    && Number(value) > Number(benchmark);
}
