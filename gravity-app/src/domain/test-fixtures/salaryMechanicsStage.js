import {readFileSync} from 'node:fs';

// Restore the frozen pre-confirmation salary metrics used by historical cohort tests.
export function salaryBeforeMechanicsConfirmation(config, {restoreLaterMau = true} = {}) {
  const before = JSON.parse(readFileSync(new URL('./salaryMechanicsBefore.json', import.meta.url)));
  const cohorts = before.salaryCohorts;
  return {...config, products: config.products.map((record) => {
    const previous = cohorts[record.cohort.toLowerCase()];
    const facts = Object.fromEntries(['mehaniki.vozvrat_klientov', 'mehaniki.doprodazhi_up_sell', ...(restoreLaterMau ? ['general.mau_produkta'] : [])].map((code) => {
      const metric = previous.metrics.flatMap((block) => block.metrics).find((item) => item.code === code);
      return [code, {rawValue: metric.value === null ? null : metric.value / metric.max_value, source: metric.source}];
    }));
    return {...record, metrics: {...record.metrics, ...facts}};
  })};
}
