import {previousSegments} from './previous-segments.js';
import {previousChannels} from './previous-channels.js';
import {previousElk} from './previous-elk.js';
import {supplementarySegmentLinks} from './supplementary-segment-links.js';

const supplementedSegments = Object.fromEntries(Object.entries(supplementarySegmentLinks).map(([teamId, sources]) => {
  const history = previousSegments[teamId];
  const reportLinks = {...history.reportLinks};
  let acceptedBacklogLinks = [...history.acceptedBacklogLinks];
  for (const {target, url} of sources) {
    if (target === 'backlog') acceptedBacklogLinks = [...new Set([...acceptedBacklogLinks, url])];
    else reportLinks[target] = [...new Set([...(reportLinks[target] || []), url])];
  }
  return [teamId, {...history, reportLinks, acceptedBacklogLinks, supplementalSources: sources}];
}));

export const getPreviousHistory = teamId => supplementedSegments[teamId] || previousSegments[teamId] || previousChannels[teamId] || previousElk[teamId];
