// Local-only helper: turns the official AliExpress apidoc JSON payloads
// (downloaded with scripts/fetch-aliexpress-contracts.cjs) into readable markdown.
// No network, no credentials, no writes outside backend/docs/api-contracts.
const fs = require('node:fs');
const path = require('node:path');

const sourceDir = path.resolve(__dirname, '../.tmp-contracts');
const targetDir = path.resolve(__dirname, '../docs/api-contracts');

function roots(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  return [];
}

function flatten(value, prefix, out) {
  const nodes = roots(value);
  if (!nodes.length) return out;
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const name = String(node.name || '').trim();
    if (!name) continue;
    const key = prefix ? `${prefix}.${name}` : name;
    const required = node.required === true ? 'required' : 'optional';
    const type = String(node.type || '').replace(/[\r\n]+/g, ' ').trim();
    const desc = String(node.desc || '').replace(/[\r\n]+/g, ' ').trim();
    out.push(`| \`${key}\` | ${type || '—'} | ${required} | ${desc || '—'} |`);
    flatten(node.children, key, out);
  }
  return out;
}

function readApi(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = raw?.data?.apiList;
  if (!Array.isArray(list) || !list.length) return null;
  return list[0];
}

fs.mkdirSync(targetDir, { recursive: true });
const files = fs.readdirSync(sourceDir).filter(name => name.endsWith('.json'));
const summary = [];
for (const file of files.sort()) {
  const api = readApi(path.join(sourceDir, file));
  const method = path.basename(file, '.json');
  if (!api) {
    summary.push(`| ${method} | NOT_FOUND | — | — |`);
    continue;
  }
  const inputs = flatten(api.parameters, '', []);
  const outputs = flatten(api.outputParameters, '', []);
  const errors = roots(api.errorCodes);
  const lines = [
    `# ${method}`,
    '',
    `- title: ${api.title || '—'}`,
    `- method: ${api.method || '—'}`,
    `- path: ${api.path || '—'}`,
    `- docId: ${api.docId ?? '—'}`,
    `- lastModified: ${api.lastModified || '—'}`,
    '',
    '## Request parameters (official)',
    '',
    '| Parameter | Type | Presence | Description |',
    '|---|---|---|---|',
    ...inputs,
    '',
    '## Response fields (official)',
    '',
    '| Field | Type | Presence | Description |',
    '|---|---|---|---|',
    ...outputs,
    '',
    '## Error codes (official)',
    '',
    errors.length ? '```json\n' + JSON.stringify(errors, null, 2) + '\n```' : '_none listed_',
    '',
  ];
  fs.writeFileSync(path.join(targetDir, `${method}.md`), lines.join('\n'), 'utf8');
  const requiredInputs = inputs.filter(line => line.includes('| required |')).length;
  summary.push(`| ${method} | OK | ${inputs.length} (${requiredInputs} required) | ${outputs.length} |`);
}
fs.writeFileSync(path.join(targetDir, 'INDEX.md'),
  ['# Official AliExpress API contracts (captured)', '',
    'Source: https://open.aliexpress.com/handler/share/apidoc/getApi.json (public API reference payloads).',
    '', '| Method | Status | Request params (required) | Response fields |', '|---|---|---|---|',
    ...summary, ''].join('\n'), 'utf8');
console.log(JSON.stringify({ files: files.length, targetDir }));
