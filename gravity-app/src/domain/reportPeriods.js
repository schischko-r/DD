const periodCollator = new Intl.Collator('en', {sensitivity: 'base', numeric: true});

export function getReportPeriods(products) {
  return [...new Set([...products.map((item) => item.period).filter(Boolean), 'III кв. 2026'])]
    .sort((a, b) => periodCollator.compare(a, b));
}
