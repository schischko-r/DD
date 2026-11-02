import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {summarizeRows} from './report-model.js';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const sourcePath = 'outputs/ddi-funnel-analysis-2026-10-20/standalone-data.json';
const sourceText = await readFile(resolve(root, sourcePath), 'utf8');
const source = JSON.parse(sourceText);
const cohort = JSON.parse(await readFile(resolve(directory, 'report-data.json'), 'utf8'));
const definitions = {
  cohort: 'Для каждого блока используются ID исходной выборки отчёта: 77 команд. Равные оценки разных команд сохраняются.',
  percentage: 'Math.round(100 × сумма баллов / сумма максимумов), с ограничением 0–100. Отсутствующие, неприменимые метрики и метрики с нулевым максимумом не становятся нулями.',
  reporting: 'Все метрики подгруппы «Отчетность» соответствующего блока; флаг dd_calculation_flg не отсекает регулярность, поскольку этот срез повторяет подгруппу интерфейса DDI.',
  completeness: 'Только точный код attract.report_completeness либо churn.report_completeness. Другие коды полноты не подменяют выбранную метрику.',
};
const scopes = {
  reporting: {title: 'Отчётность', description: 'Настроена отчётность, Регулярность, Полнота отчёта и, где присутствует в подгруппе «Отчетность», использование автоматизированной отчётности.', blocks: {}},
  completeness: {title: 'Полнота отчёта', description: 'Только отдельная метрика полноты отчёта по воронке, без настройки и регулярности.', blocks: {}},
};
const validMetric = metric => metric.is_applicabble_flg !== false
  && typeof metric.max_value === 'number' && Number.isFinite(metric.max_value) && metric.max_value > 0
  && typeof metric.value === 'number' && Number.isFinite(metric.value);
for (const [scopeName, scope] of Object.entries(scopes)) {
  for (const code of ['attract', 'churn']) {
    const includedIds = new Set(cohort.blocks[code].rows.map(row => row.id));
    const rows = [];
    const excluded = [];
    for (const team of source.products) {
      const base = {id: team.id, team: team.name, unit: team.unit, type: team.type, period: team.period};
      if (!includedIds.has(team.id)) {excluded.push({...base, reason: 'Вне исходной выборки блока'}); continue;}
      const block = team.metrics.find(item => item.code === code);
      const candidates = (block?.metrics || []).filter(metric => scopeName === 'reporting'
        ? metric.metric_subgroup === 'Отчетность' : metric.code === `${code}.report_completeness`);
      const metrics = candidates.filter(validMetric);
      if (!metrics.length) {
        excluded.push({...base, reason: !candidates.length ? 'Метрика или подгруппа отсутствует' : 'Нет применимых метрик с заполненным значением и положительным максимумом'});
        continue;
      }
      const earned = metrics.reduce((sum, metric) => sum + metric.value, 0);
      const max = metrics.reduce((sum, metric) => sum + metric.max_value, 0);
      const rawPct = 100 * earned / max;
      const pct = Math.max(0, Math.min(100, Math.round(rawPct)));
      rows.push({...base, earned, max, rawPct, pct, status: pct < 40 ? 'Плохо' : pct > 80 ? 'Хорошо' : 'Посередине'});
    }
    scope.blocks[code] = {rows, excluded};
  }
}
const output = {source: {file: sourcePath, sha256: createHash('sha256').update(sourceText).digest('hex'), cohort: 'gravity-app/src/funnel-report/report-data.json'}, definitions, scopes};
await writeFile(resolve(directory, 'detail-data.json'), `${JSON.stringify(output, null, 2)}\n`);
for (const [scope, data] of Object.entries(scopes)) for (const [code, block] of Object.entries(data.blocks)) {
  const summary = summarizeRows(block.rows);
  process.stdout.write(`${scope}/${code}: n=${summary.n}; excluded=${block.excluded.length}; ${summary.levels.map(level => `${level.label}=${level.count}`).join('; ')}\n`);
}
