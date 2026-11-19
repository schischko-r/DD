import {copyFile, rm} from 'node:fs/promises';
import {resolve} from 'node:path';

const buildDirectory = resolve(import.meta.dirname, '..', 'dist-about');
const target = resolve(import.meta.dirname, '..', '..', 'Что_такое_Data_Driven.html');

await copyFile(resolve(buildDirectory, 'about-standalone.html'), target);
await rm(buildDirectory, {recursive: true, force: true});
console.log(target);
