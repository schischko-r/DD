import {copyFile, mkdir, rm} from 'node:fs/promises';
import {resolve} from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const source = resolve(appRoot, 'dist-clickstream/clickstream.html');
const target = resolve(appRoot, '../Кликстрим_Месячный_все_воронки_zeroed_gravity.html');

await mkdir(resolve(target, '..'), {recursive: true});
await copyFile(source, target);
await rm(resolve(appRoot, 'dist-clickstream'), {recursive: true, force: true});
console.log(`Published ${target}`);
