import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildDdiPeriodProducts} from '../../gravity-app/src/domain/quarterProfiles.js';
import {isDdIndexMetric} from '../../gravity-app/src/domain/report.js';
import {backlogTeamMatchesProduct} from '../../gravity-app/src/domain/backlogTeamSelection.js';

const root = new URL('../../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const source = read('gravity-app/public/report-data.json');
const app = readFileSync(new URL('gravity-app/src/app/App.jsx', root), 'utf8');
const imports = new Map([...app.matchAll(/import (\w+) from '\.\.\/data\/([^']+\.json)'/g)].map((match) => [match[1], match[2]]));
const overlays = app.match(/const Q3_OVERLAYS = \[([^\]]+)\]/)[1].split(',').map((key) => read(`gravity-app/src/data/${imports.get(key.trim())}`));
const salary = read('gravity-app/src/data/salary-products-q3-2026.json');
const policy = read('gravity-app/src/data/po-goals-policy-q3-2026.json');
const backlogFile = 'gravity-app/public/backlog-data.json';
const backlogBytes = readFileSync(new URL(backlogFile, root));
const backlog = JSON.parse(backlogBytes.toString('utf8'));
const backlogSha256 = createHash('sha256').update(backlogBytes).digest('hex');
const products = buildDdiPeriodProducts(source.products, salary.period, overlays, salary,
  read('gravity-app/src/data/reporting-regularity-missing-q3-2026.json'),
  read('gravity-app/src/data/funnel-action-missing-q3-2026.json'));
const responses = read('outputs/ddi-audit-2026-10-31/responses-lossless.json').responses
  .filter((record) => !record.excludedByConfirmedUserInstruction);
const metricMap = (product) => new Map((product?.metrics || []).flatMap((block) => block.metrics.map((metric) => [metric.code, metric])));
const id = (product) => String(product.id || '').replace(/::empty::.*/, '');
const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
const identity = (product) => ({id: id(product), name: product.name, unit: product.unit, type: product.type});
const fraction = (metric) => metric && metric.is_applicabble_flg !== false && Number(metric.max_value) > 0
  && Number.isFinite(metric.value) ? metric.value / metric.max_value : null;
const unique = (values) => [...new Map(values.map((value) => [JSON.stringify(value), value])).values()];
function sourceUrls(value) {
  if (typeof value === 'string') return value.match(/https?:\/\/[^\s<>"']+/g) || [];
  if (Array.isArray(value)) return value.flatMap(sourceUrls);
  return value && typeof value === 'object' ? Object.values(value).flatMap(sourceUrls) : [];
}

// Follow only active aggregation inputs. Historical previousAssessmentSource is
// retained in full provenance, but never used to classify the current source.
function activeSources(value) {
  if (!value) return [];
  if (value.origin === 'salaryCohortAverage' && value.cohorts) {
    return Object.values(value.cohorts).flatMap((cohort) => activeSources(cohort.source || cohort));
  }
  return [value];
}

function purePoSurvey(team, evidence) {
  const values = new Set(evidence.map((response) => response.rawValue ?? null));
  if (policy.maximumSurveyTeams.includes(team.name) && evidence.length && !values.has(null)) {
    return {value: Math.max(...values), resolution: 'maximumAcrossConfirmedRespondents'};
  }
  if (team.name === 'Зарплатный продукт' && policy.salarySurveyPolicy === 'averageWithUnknownZero') {
    const cohorts = Object.fromEntries(salary.products.map((cohort) => {
      const matches = evidence.filter((response) => normalize(response.respondent) === normalize(cohort.respondent));
      return [cohort.cohort, matches.length === 1 ? matches[0].rawValue ?? null : undefined];
    }));
    if (Object.values(cohorts).every((value) => value !== undefined)) {
      return {value: Object.values(cohorts).reduce((sum, value) => sum + (value ?? 0), 0) / Object.keys(cohorts).length,
        resolution: 'averageWithUnknownSourceZero', cohorts};
    }
  }
  if (values.size === 1 && !values.has(null)) return {value: [...values][0], resolution: 'consistentSurveyAnswers'};
  return {value: null, resolution: values.size > 1 ? 'conflictingAnswers' : 'missingAnswerOrSource'};
}

const pairs = [
  {key: 'monitoring', lt: 'goals.monitored', po: 'goals.po_monitoring', title: 'Мониторинг целей', questionId: 'goalsMonitoring'},
  {key: 'factor_analysis', lt: 'goals.factor_analysis_l1_l2', po: 'goals.po_factor_analysis', title: 'Факторный анализ', questionId: 'goalsFactorAnalysis'},
  {key: 'forecast', lt: 'goals.forecast', po: 'goals.po_forecast', title: 'Прогнозирование', questionId: 'goalsForecast'},
];
const goals = [], discovery = [];
const bothLevelsTeams = [];
for (const product of products) {
  const current = metricMap(product);
  const previousProduct = source.products.find((candidate) => candidate.id === id(product));
  const previous = metricMap(previousProduct);
  let hasBoth = false;
  for (const pair of pairs) {
    const lt = current.get(pair.lt), po = current.get(pair.po), old = previous.get(pair.lt);
    const sources = unique(activeSources(po?.source));
    const evidence = unique(sources.flatMap((item) => item.responses || []));
    const pureSurvey = {...purePoSurvey(product, evidence), responses: evidence};
    const included = [lt, po].filter(isDdIndexMetric);
    if (included.length === 2) hasBoth = true;
    const maxValue = included.reduce((sum, metric) => sum + Number(metric.max_value), 0);
    const value = maxValue > 0 && included.every((metric) => Number.isFinite(metric.value))
      ? included.reduce((sum, metric) => sum + metric.value, 0) : null;
    const exportCode = `goals.export_final_${pair.key}`;
    const componentNote = `Не входят в DDI напрямую в этой выгрузке; раскрытие итоговой метрики «${pair.title}». Не суммировать повторно. Веса и вклад текущего DDI сохранены в итоговой строке.`;
    const components = [[lt, 'ЛЮ/ЛТ'], [po, 'PO с действующим правилом интеграции']].map(([metric, level]) => ({
      code: metric?.code, level, title: `${pair.title} — ${level}`, oldValue: null, oldMaxValue: null, oldFraction: null,
      oldNote: 'В II квартале нет подтверждённого разделения исторической итоговой оценки на ЛЮ/ЛТ и PO. Значение не восстанавливалось предположением.',
      value: metric?.value ?? null, maxValue: metric?.max_value ?? null, fraction: fraction(metric),
      applicable: Boolean(metric && metric.is_applicabble_flg !== false && metric.max_value > 0),
      runtimeIncludedInDdi: isDdIndexMetric(metric), exportIncludedInDdi: false, integratedInto: exportCode,
      note: componentNote, declaredSourceType: level.startsWith('PO') ? 'Опрос' : 'Цифровые следы',
      source: metric?.source || null, indexExclusionSource: metric?.indexExclusionSource || null,
      ...(level.startsWith('PO') ? {questionId: pair.questionId, purePoSurvey: pureSurvey,
        integrationSources: sources, integrationComment: sources.map((item) => [item.sourceKind, item.resolution,
          item.ltRawValue !== undefined ? `База ЛЮ/ЛТ: ${item.ltRawValue}` : '', item.rule || ''].filter(Boolean).join('; ')).join('\n')} : {}),
    }));
    goals.push({...identity(product), key: pair.key, code: exportCode, title: `${pair.title} — итоговая метрика`,
      declaredSourceType: 'Цифровые следы', runtimeCodes: [pair.lt, pair.po],
      old: {code: pair.lt, value: old?.value ?? null, maxValue: old?.max_value ?? null,
        fraction: fraction(old), includedInDdi: isDdIndexMetric(old), source: old?.source || null,
        note: 'Историческая итоговая метрика II квартала, без выдуманного разделения на уровни.'},
      current: {value, maxValue, fraction: maxValue > 0 && value !== null ? value / maxValue : null,
        includedInDdi: maxValue > 0, effectiveWeight: maxValue,
        formula: 'Сумма значений текущих индексных ЛЮ/ЛТ и PO / сумма их максимумов. Неиндексные и неприменимые составляющие исключены.'},
      components, provenance: {lt: lt?.source || null, po: po?.source || null, integrationSources: sources,
        policyFile: 'gravity-app/src/data/po-goals-policy-q3-2026.json'},
    });
  }
  if (hasBoth) bothLevelsTeams.push(identity(product));
  const metric = current.get('hyp.discovery_40_backlog');
  const active = activeSources(metric?.source);
  const traces = active.filter((item) => item.origin === 'userConfirmedDiscoveryDecompositionAssessment'
    && item.explicitAnswerPresent === false && item.file === 'gravity-app/public/backlog-data.json'
    && item.quarterKey === '2026-Q3' && typeof item.pointer === 'string');
  const availableDecomposition = backlog.teams.flatMap((team, teamIndex) => {
    if (!backlogTeamMatchesProduct(team, product)) return [];
    const quarterIndex = team.quarters.findIndex((quarter) => quarter.key === '2026-Q3');
    if (quarterIndex < 0) return [];
    const quarter = team.quarters[quarterIndex];
    return [{file: backlogFile, sha256: backlogSha256, pointer: `/teams/${teamIndex}/quarters/${quarterIndex}`,
      teamKey: team.key, teamLabel: team.label, memberTeams: team.memberTeams || team.meta?.memberTeams || [],
      quarterKey: quarter.key, start: quarter.start, end: quarter.end, dataThrough: quarter.dataThrough,
      isComplete: quarter.isComplete, createdCount: quarter.createdCount, discoveryCount: quarter.discoveryCount,
      discoveryShare: quarter.discoveryShare,
      actualShare: Number(quarter.createdCount) > 0 ? 100 * quarter.discoveryCount / quarter.createdCount : null,
      sourceMetadata: team.meta || null, urls: [...new Set(sourceUrls({meta: team.meta, quarter}))]}];
  });
  const surveyResponses = responses.filter((response) => response.canonicalTeam?.id === id(product)).map((response) => ({
    file: response.file, sources: response.sources, csvRow: response.csvRow, respondent: response.respondent,
    completedAt: response.completedAt, questionId: 'discovery', answer: response.answers.discovery ?? null,
    backlogType: response.answers.discoveryBacklogType ?? null, backlogLink: response.answers.backlog ?? null,
    backlogComment: response.answers.discoveryBacklogComment ?? null,
  }));
  discovery.push({...identity(product), code: 'hyp.discovery_40_backlog', value: metric?.value ?? null,
    maxValue: metric?.max_value ?? null, fraction: fraction(metric),
    declaredSourceType: traces.length ? 'Цифровые следы'
      : availableDecomposition.length ? 'Цифровые следы; текущий балл — опрос' : 'Опрос с подтверждениями',
    hasEffectiveDecompositionSource: traces.length > 0, activeSourceOrigins: active.map((item) => item.origin),
    hasAvailableDecomposition: availableDecomposition.length > 0, availableDecomposition,
    manualOverride: active.some((item) => item.origin === 'userConfirmedDiscoveryManualAssessment'),
    source: metric?.source || null, decompositionEvidence: traces, surveyResponses,
    note: traces.length ? 'Для команды доступна декомпозиция III квартала, из неё взята действующая оценка Discovery.'
      : availableDecomposition.length ? `Для команды доступна декомпозиция III квартала (${availableDecomposition.map((item) => `${item.discoveryCount}/${item.createdCount} = ${item.discoveryShare}%; данные по ${item.dataThrough}${item.isComplete === false ? ', неполный квартал' : ''}`).join('; ')}), но текущий балл ${fraction(metric) === null ? 'не определён' : `${fraction(metric) * 100}%`} сохранён по опросу. Наличие цифровых следов не заменяет действующую оценку.`
        : 'Опрос с подтверждениями по классификации пользователя. При ручном переопределении итоговая оценка может отличаться от исходного ответа; provenance сохранён.',
  });
}

const result = {schemaVersion: 1, period: salary.period, counts: {teams: products.length, finalGoalRows: goals.length,
  componentGoalRows: goals.length * 2, teamsWithBothGoalLevelsInCurrentDdi: bothLevelsTeams.length,
  discoveryDecompositionTeams: discovery.filter((item) => item.hasEffectiveDecompositionSource).length,
  discoveryAvailableDecompositionTeams: discovery.filter((item) => item.hasAvailableDecomposition).length,
  discoveryAvailableButSurveyScoreTeams: discovery.filter((item) => item.hasAvailableDecomposition && !item.hasEffectiveDecompositionSource).length},
  interpretation: 'Три итоговые строки — виртуальное раскрытие текущего числителя и знаменателя DDI, без изменения бизнес-логики. Шесть составляющих повторно не суммируются. Исторические значения составляющих не выдумывались.',
  teamsWithBothGoalLevelsInCurrentDdi: bothLevelsTeams, goals, discovery};
const output = new URL('./goals-discovery.json', import.meta.url);
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({output: output.pathname, ...result.counts,
  decompositionTeams: discovery.filter((item) => item.hasEffectiveDecompositionSource).map((item) => item.name),
  availableButSurveyScoreTeams: discovery.filter((item) => item.hasAvailableDecomposition && !item.hasEffectiveDecompositionSource).map((item) => item.name)}));
