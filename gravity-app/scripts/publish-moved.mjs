import {copyFile, rm} from 'node:fs/promises';
import {resolve} from 'node:path';

const source = resolve(import.meta.dirname, '..', 'dist-moved', 'moved-standalone.html');
const target = resolve(import.meta.dirname, '..', '..', 'moved-standalone.html');

await copyFile(source, target);
await rm(resolve(import.meta.dirname, '..', 'dist-moved'), {recursive: true, force: true});
console.log(target);
