import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const aliasPattern = /^\{([^{}]+)\}$/;
const supported = new Set(['color', 'dimension', 'number', 'fontFamily', 'fontWeight', 'duration']);

// A deliberately small DTCG 2025.10 subset: these are the types used by this system.
export function flattenTokens(document) {
  const tokens = new Map();
  function visit(group, parts = [], inheritedType) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) throw new Error(`Invalid token group: ${parts.join('.')}`);
    for (const [name, value] of Object.entries(group)) {
      if (name.startsWith('$')) continue;
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error(`Unsupported CSS token name: ${name}`);
      const next = [...parts, name];
      if (value && typeof value === 'object' && Object.hasOwn(value, '$value')) {
        const type = value.$type ?? group.$type ?? inheritedType;
        if (!supported.has(type)) throw new Error(`Unsupported token type: ${next.join('.')} (${type})`);
        tokens.set(next.join('.'), {...value, $type: type});
      } else visit(value, next, group.$type ?? inheritedType);
    }
  }
  visit(document);
  return new Map([...tokens].sort(([a], [b]) => a.localeCompare(b, 'en')));
}

function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function validate(type, value, name) {
  let valid = false;
  if (type === 'color') valid = value?.colorSpace === 'srgb' && Array.isArray(value.components) && value.components.length === 3 && value.components.every(x => finite(x) && x >= 0 && x <= 1) && (value.alpha === undefined || (finite(value.alpha) && value.alpha >= 0 && value.alpha <= 1));
  if (type === 'dimension') valid = finite(value?.value) && ['px', 'rem'].includes(value.unit);
  if (type === 'duration') valid = finite(value?.value) && value.value >= 0 && ['ms', 's'].includes(value.unit);
  if (type === 'number') valid = finite(value);
  if (type === 'fontWeight') valid = Number.isInteger(value) && value >= 1 && value <= 1000;
  if (type === 'fontFamily') valid = (typeof value === 'string' && value.length > 0) || (Array.isArray(value) && value.length > 0 && value.every(x => typeof x === 'string' && x.length > 0));
  if (!valid) throw new Error(`Invalid ${type} value: ${name}`);
}

export function resolveTokens(document) {
  const tokens = flattenTokens(document);
  const resolved = new Map();
  const visiting = new Set();
  function resolve(name) {
    if (resolved.has(name)) return resolved.get(name);
    if (visiting.has(name)) throw new Error(`Circular token alias: ${name}`);
    const token = tokens.get(name);
    if (!token) throw new Error(`Missing token alias: ${name}`);
    visiting.add(name);
    const reference = typeof token.$value === 'string' && token.$value.match(aliasPattern);
    let value = token.$value;
    if (reference) {
      const target = resolve(reference[1]);
      if (target.type !== token.$type) throw new Error(`Alias type mismatch: ${name} -> ${reference[1]}`);
      value = target.value;
    }
    validate(token.$type, value, name);
    const result = {type: token.$type, value, token};
    resolved.set(name, result);
    visiting.delete(name);
    return result;
  }
  for (const name of tokens.keys()) resolve(name);
  return resolved;
}

export function cssVariable(name) { return `--ddi-${name.replaceAll('.', '-')}`; }
function cssValue(type, value) {
  if (type === 'color') {
    const channels = value.components.map(x => Math.round(x * 255));
    const alpha = value.alpha ?? 1;
    return alpha === 1 ? `#${channels.map(x => x.toString(16).padStart(2, '0')).join('')}` : `rgba(${channels.join(',')},${alpha})`;
  }
  if (type === 'dimension' || type === 'duration') return `${value.value}${value.unit}`;
  if (type === 'fontFamily') {
    const generic = new Set(['serif', 'sans-serif', 'monospace', 'system-ui', '-apple-system', 'BlinkMacSystemFont']);
    return (Array.isArray(value) ? value : [value]).map(name => generic.has(name) ? name : JSON.stringify(name)).join(',');
  }
  return String(value);
}

export function renderTokensCss(document) {
  const flat = flattenTokens(document);
  resolveTokens(document);
  const names = [...flat.keys()].map(cssVariable);
  if (new Set(names).size !== names.length) throw new Error('Token paths collide after CSS name conversion');
  const lines = [...flat].map(([name, token]) => {
    const reference = typeof token.$value === 'string' && token.$value.match(aliasPattern);
    return `  ${cssVariable(name)}: ${reference ? `var(${cssVariable(reference[1])})` : cssValue(token.$type, token.$value)};`;
  });
  const css = `/* Generated from tokens.json by build.mjs. Edit the JSON source. */\n.ddi {\n${lines.join('\n')}\n}\n`;
  if (/<\/style/i.test(css)) throw new Error('Token CSS contains an unsafe closing style tag');
  return css;
}

export function renderComponentsCss(source, document) {
  const resolved = resolveTokens(document);
  const css = source.replace(/\{\{DDI_BP_(MOBILE|TABLET|WIDE)\}\}/g, (_, size) => {
    const token = resolved.get(`layout.breakpoint.${size.toLowerCase()}`);
    if (!token || token.type !== 'dimension') throw new Error(`Invalid breakpoint token: ${size}`);
    return cssValue(token.type, token.value);
  });
  if (/\{\{DDI_/.test(css)) throw new Error('Unknown component CSS build marker');
  return css;
}

export async function build({check = false, base = directory} = {}) {
  const names = ['tokens.json', 'catalog.template.html', 'components.css', 'catalog.js'];
  const [json, template, componentSource, script] = await Promise.all(names.map(name => readFile(path.join(base, name), 'utf8')));
  const tokens = JSON.parse(json);
  const css = renderTokensCss(tokens);
  const components = renderComponentsCss(componentSource, tokens);
  const version = tokens.$extensions?.['org.dddev.design-system']?.version;
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('Set the design system version in tokens.json');
  let html = template;
  const blocks = {
    '<!-- DDI_TOKENS_CSS -->': `<style id="ddi-tokens">\n${css}</style>`,
    '<!-- DDI_COMPONENTS_CSS -->': `<style id="ddi-components">\n${components}\n</style>`,
    '<!-- DDI_CATALOG_JS -->': `<script id="ddi-catalog-script">\n${script}\n</script>`,
  };
  if (/<\/script/i.test(script) || /<\/style/i.test(components)) throw new Error('Inline asset contains an unsafe closing tag');
  for (const [marker, content] of Object.entries(blocks)) {
    if (html.split(marker).length !== 2) throw new Error(`Expected one template marker: ${marker}`);
    html = html.replace(marker, () => content);
  }
  html = html.replaceAll('{{DDI_VERSION}}', version);
  const resolved = resolveTokens(tokens);
  html = html.replace(/\{\{DDI_TOKEN:([a-zA-Z0-9_.-]+)\}\}/g, (_, name) => {
    const token = resolved.get(name);
    if (!token) throw new Error(`Unknown catalog token: ${name}`);
    return cssValue(token.type, token.value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  });
  if (/\{\{DDI_/.test(html)) throw new Error('Unresolved catalog build marker');
  const outputs = new Map([['tokens.css', css], ['ddi.css', `${css}\n${components.trimEnd()}\n`], ['index.html', html]]);
  for (const [name, content] of outputs) {
    const filename = path.join(base, name);
    if (check) {
      let current;
      try { current = await readFile(filename, 'utf8'); } catch { throw new Error(`Generated file missing: ${name}. Run node design-system/build.mjs`); }
      if (current !== content) throw new Error(`Generated file stale: ${name}. Run node design-system/build.mjs`);
    } else await writeFile(filename, content);
  }
  return {version, tokenCount: flattenTokens(tokens).size, outputs: [...outputs.keys()], check};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = process.argv.slice(2);
  if (flags.some(flag => flag !== '--check')) throw new Error('Usage: node design-system/build.mjs [--check]');
  console.log(JSON.stringify(await build({check: flags.includes('--check')})));
}
