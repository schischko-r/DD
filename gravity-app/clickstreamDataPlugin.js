import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {extractClickstreamData} from './src/clickstream/clickstreamDataCore.js';

const CLICKSTREAM_SOURCE = resolve(
  import.meta.dirname,
  '..',
  'Кликстрим_Месячный_все_воронки.html',
);
const CLICKSTREAM_DATA_MODULE = 'virtual:clickstream-data';
const RESOLVED_CLICKSTREAM_DATA_MODULE = `\0${CLICKSTREAM_DATA_MODULE}`;

export function clickstreamDataPlugin() {
  return {
    name: 'extract-clickstream-data',
    buildStart() {
      this.addWatchFile(CLICKSTREAM_SOURCE);
    },
    resolveId(id) {
      return id === CLICKSTREAM_DATA_MODULE
        ? RESOLVED_CLICKSTREAM_DATA_MODULE
        : null;
    },
    load(id) {
      if (id !== RESOLVED_CLICKSTREAM_DATA_MODULE) return null;
      const source = readFileSync(CLICKSTREAM_SOURCE, 'utf8');
      const serialized = JSON.stringify(extractClickstreamData(source))
        .replaceAll('<', '\\u003c');
      return `export default ${serialized};`;
    },
  };
}
