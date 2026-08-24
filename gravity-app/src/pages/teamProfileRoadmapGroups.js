const naturalRussianCollator = new Intl.Collator('ru-RU', {
  numeric: true,
  sensitivity: 'base',
});

const RUSSIAN_MONTHS = [
  ['январ', 1],
  ['феврал', 2],
  ['март', 3],
  ['апрел', 4],
  ['май', 5],
  ['мая', 5],
  ['июн', 6],
  ['июл', 7],
  ['август', 8],
  ['сентябр', 9],
  ['октябр', 10],
  ['ноябр', 11],
  ['декабр', 12],
];

export function roadmapGroupLabel(value) {
  return String(value ?? '').trim() || 'Не указано';
}

function roadmapValueRank(parts, text) {
  if (parts) return parts.year == null ? 1 : 0;
  return text === 'Не указано' ? 3 : 2;
}

function compareRoadmapParts(leftText, rightText, leftParts, rightParts, keys) {
  const rankDifference = roadmapValueRank(leftParts, leftText)
    - roadmapValueRank(rightParts, rightText);
  if (rankDifference) return rankDifference;

  if (leftParts && rightParts) {
    for (const key of keys) {
      const difference = (leftParts[key] ?? 0) - (rightParts[key] ?? 0);
      if (difference) return difference;
    }
  }
  return naturalRussianCollator.compare(leftText, rightText);
}

function quarterParts(value) {
  const text = String(value ?? '').trim().toLocaleUpperCase('ru-RU');
  const normalized = text
    .replace(/[КК]\s*\u0412\u0410\u0420\u0422\u0410\u041B(?:\u0410|\u0415)?/giu, 'Q')
    .replace(/\s+/g, ' ');
  const yearFirst = normalized.match(/^(\d{4})\s*[-./ ]?\s*(?:Q\s*([1-4])|([1-4])\s*Q)$/u);
  const quarterFirst = normalized.match(/^(?:Q\s*([1-4])|([1-4])\s*Q)\s*[-./ ]?\s*(\d{2,4})?$/u);
  const match = yearFirst || quarterFirst;
  if (!match) return null;

  const quarter = Number(yearFirst ? (match[2] || match[3]) : (match[1] || match[2]));
  const rawYear = yearFirst ? match[1] : match[3];
  const year = rawYear ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear) : null;
  return {quarter, year};
}

export function compareRoadmapQuarters(left, right) {
  const leftText = roadmapGroupLabel(left);
  const rightText = roadmapGroupLabel(right);
  const leftQuarter = quarterParts(leftText);
  const rightQuarter = quarterParts(rightText);
  return compareRoadmapParts(
    leftText,
    rightText,
    leftQuarter,
    rightQuarter,
    ['year', 'quarter'],
  );
}

function dueDateParts(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/u);
  if (iso) return {year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3])};

  const dotted = text.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/u);
  if (dotted) {
    const rawYear = dotted[3];
    return {
      year: rawYear ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear) : null,
      month: Number(dotted[2]),
      day: Number(dotted[1]),
    };
  }

  const quarter = quarterParts(text);
  if (quarter) return {year: quarter.year, month: quarter.quarter * 3 - 2, day: 1};

  const normalized = text.toLocaleLowerCase('ru-RU');
  const monthMatch = RUSSIAN_MONTHS
    .map(([stem, month]) => ({index: normalized.indexOf(stem), month}))
    .filter(({index}) => index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  if (!monthMatch) return null;
  const yearMatch = normalized.match(/\b(20\d{2})\b/u);
  const dayPrefix = normalized.slice(Math.max(0, monthMatch.index - 4), monthMatch.index).match(/(\d{1,2})\s*$/u);
  return {
    year: yearMatch ? Number(yearMatch[1]) : null,
    month: monthMatch.month,
    day: dayPrefix ? Number(dayPrefix[1]) : 1,
  };
}

export function compareRoadmapDueDates(left, right) {
  const leftText = roadmapGroupLabel(left);
  const rightText = roadmapGroupLabel(right);
  const leftDate = dueDateParts(leftText);
  const rightDate = dueDateParts(rightText);
  return compareRoadmapParts(
    leftText,
    rightText,
    leftDate,
    rightDate,
    ['year', 'month', 'day'],
  );
}

function groupedBy(items, valueFor) {
  const groups = new Map();
  items.forEach((item) => {
    const label = roadmapGroupLabel(valueFor(item));
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  });
  return [...groups].map(([label, groupedItems]) => ({label, items: groupedItems}));
}

export function groupRoadmapItems(items) {
  return groupedBy(Array.isArray(items) ? items : [], (item) => item?.development_block)
    .map((block) => ({
      label: block.label,
      quarters: groupedBy(block.items, (item) => item?.quarter)
        .sort((left, right) => compareRoadmapQuarters(left.label, right.label))
        .map((quarter) => ({
          label: quarter.label,
          dueDates: groupedBy(quarter.items, (item) => item?.due_date)
            .sort((left, right) => compareRoadmapDueDates(left.label, right.label)),
        })),
    }));
}

export function flattenRoadmapItems(items) {
  return groupRoadmapItems(items).flatMap((block) => {
    const blockRowSpan = block.quarters.reduce(
      (total, quarter) => total + quarter.dueDates.reduce(
        (quarterTotal, dueDate) => quarterTotal + dueDate.items.length,
        0,
      ),
      0,
    );

    return block.quarters.flatMap((quarter, quarterIndex) => {
      const quarterRowSpan = quarter.dueDates.reduce(
        (total, dueDate) => total + dueDate.items.length,
        0,
      );

      return quarter.dueDates.flatMap((dueDate, dueDateIndex) => dueDate.items.map((item, itemIndex) => ({
        item,
        blockLabel: block.label,
        blockRowSpan: quarterIndex === 0 && dueDateIndex === 0 && itemIndex === 0 ? blockRowSpan : 0,
        quarterLabel: quarter.label,
        quarterRowSpan: dueDateIndex === 0 && itemIndex === 0 ? quarterRowSpan : 0,
        dueDateLabel: dueDate.label,
        dueDateRowSpan: itemIndex === 0 ? dueDate.items.length : 0,
      })));
    });
  });
}
