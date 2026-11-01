import {writeFileSync} from 'node:fs';
import {getSections} from '../gravity-app/src/deposits-survey/questions.js';
import {teams} from '../gravity-app/src/deposits-survey/teams.js';
const all = {};
for (const team of teams) {
  const questions = [];
  for (const section of getSections({product: team.id})) {
    const visit = (q, parent = null) => {
      questions.push({...q, sectionId: section.id, sectionTitle: section.title, parentId: parent?.id});
      for (const child of [...q.inlineQuestions || [], ...[q.inlineEvidence, q.inlineProof, q.benchmark, q.action].filter(Boolean)]) visit(child, q);
    };
    for (const q of section.questions || []) visit(q);
  }
  all[team.id] = {team, questions};
}
writeFileSync(new URL('./export-questions.json', import.meta.url), JSON.stringify(all, null, 2));
const unique = new Map(Object.values(all).flatMap(t => t.questions).map(q => [q.id, q]));
console.log([...unique.values()].filter(q => q.type !== 'info' && !q.parentId).map(q => `${q.id}: ${q.title}`).join('\n'));
