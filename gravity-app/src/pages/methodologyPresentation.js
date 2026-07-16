export function groupMethodologySections(sections) {
  const groups = new Map();
  for (const section of sections || []) {
    if (!groups.has(section.title)) groups.set(section.title, {title: section.title, subsections: []});
    groups.get(section.title).subsections.push(section);
  }
  return [...groups.values()];
}

function scoreLine(line) {
  if (!/^\d+(?:[,.]\d+)?\s*балл/i.test(line)) return null;
  const match = line.match(/^(.+?\(\s*\d+\s*%\s*\))\s*-?\s*(.*)$/);
  if (!match) return {kind: 'score', label: 'Баллы', text: line};
  return {kind: 'score', label: match[1].trim(), text: match[2].trim()};
}

function needsContinuation(text) {
  const opening = (text.match(/\(/g) || []).length;
  const closing = (text.match(/\)/g) || []).length;
  return opening > closing || /[\/,]$/.test(text);
}

export function parseMethodologyContent(body) {
  const lines = String(body || '').replace(/\r\n?/g, '\n').split('\n');
  const tokens = [];
  let paragraphStart = true;
  let afterScore = false;
  let pendingScore = null;

  const flushScore = () => {
    if (!pendingScore) return;
    tokens.push(pendingScore);
    pendingScore = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\s+/g, ' ').trim();
    if (!line) {
      flushScore();
      if (tokens.length && tokens[tokens.length - 1].kind !== 'break') tokens.push({kind: 'break'});
      paragraphStart = true;
      afterScore = false;
      continue;
    }
    if (/^оценка\s*:?$/i.test(line)) continue;

    const score = scoreLine(line);
    if (score) {
      flushScore();
      pendingScore = score;
      paragraphStart = false;
      afterScore = true;
      continue;
    }

    if (pendingScore && needsContinuation(pendingScore.text)) {
      pendingScore.text = `${pendingScore.text} ${line}`.trim();
      continue;
    }

    flushScore();
    const isSupportingText = line.startsWith('(') || line.length > 180;
    tokens.push({kind: paragraphStart || afterScore ? (isSupportingText ? 'text' : 'heading') : 'text', text: line});
    paragraphStart = false;
    afterScore = false;
  }
  flushScore();
  if (tokens[tokens.length - 1]?.kind === 'break') tokens.pop();
  return tokens;
}

export function methodologyScoreTheme(label) {
  const percent = Number(String(label || '').match(/\((\d+)\s*%\)/)?.[1]);
  if (percent === 100) return 'success';
  if (percent === 50) return 'warning';
  if (percent === 0) return 'danger';
  return 'info';
}

export function methodologyCriteria(body) {
  const criteria = [];
  let current = null;
  const ensureCurrent = () => {
    if (!current) current = {title: 'Условие оценки', description: [], scores: []};
    return current;
  };
  const flush = () => {
    if (!current) return;
    if (current.description.length || current.scores.length || current.title !== 'Условие оценки') criteria.push(current);
    current = null;
  };

  for (const token of parseMethodologyContent(body)) {
    if (token.kind === 'break') {
      flush();
    } else if (token.kind === 'heading') {
      flush();
      current = {title: token.text, description: [], scores: []};
    } else if (token.kind === 'score') {
      ensureCurrent().scores.push({label: token.label, text: token.text});
    } else {
      ensureCurrent().description.push(token.text);
    }
  }
  flush();
  const normalized = criteria.map((criterion) => {
    if (criterion.title !== 'Условие оценки' || criterion.description.length === 0) return criterion;
    return {...criterion, title: criterion.description[0], description: criterion.description.slice(1)};
  });
  const result = [];
  for (const criterion of normalized) {
    const previous = result[result.length - 1];
    if (previous && previous.scores.length === 0 && criterion.title === 'Условие оценки') {
      previous.description.push(...criterion.description);
      previous.scores.push(...criterion.scores);
      continue;
    }
    result.push(criterion.title === 'Условие оценки' ? {...criterion, title: 'Дополнительные условия'} : criterion);
  }
  return result;
}
