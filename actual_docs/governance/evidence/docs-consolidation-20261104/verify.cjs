const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const exists = p => fs.existsSync(path.join(root, p));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const errors = [];
const manifest = JSON.parse(read('actual_docs/history/archive/2026-11-04-docs/manifest.json'));
const coverage = JSON.parse(read('actual_docs/governance/evidence/docs-consolidation-20261104/coverage.json'));
const roadmap = 'actual_docs/MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md';
const questions = 'actual_docs/OPEN_QUESTIONS.md';
const anchors = new Map();
function getAnchors(file) {
  if (anchors.has(file)) return anchors.get(file);
  const result = new Set();
  if (!file.endsWith('.md')) return result;
  const text = read(file).replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
  for (const m of text.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) result.add(m[1]);
  const used = new Map();
  for (const m of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const slug = m[1].replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/ /g, '-');
    const count = used.get(slug) || 0;
    used.set(slug, count + 1);
    result.add(slug + (count ? '-' + count : ''));
  }
  anchors.set(file, result);
  return result;
}
function checkTarget(from, target, isRoot = false) {
  if (/^(?:[a-z]+:|\/\/)/i.test(target)) return;
  let clean = target.replace(/^<|>$/g, '').replace(/\s+"[^"]*"$/, '');
  try { clean = decodeURIComponent(clean); } catch { return 'malformed URL'; }
  const [name, anchor] = clean.split('#');
  const file = (name ? path.normalize(isRoot ? name : path.join(path.dirname(from), name)) : from).replaceAll('\\', '/').split('?')[0];
  if (!exists(file)) return 'missing file: ' + file;
  if (anchor && file.endsWith('.md') && !getAnchors(file).has(anchor)) return 'missing anchor: ' + file + '#' + anchor;
}
for (const f of manifest.files) if (!exists(f.archive) || hash(f.archive) !== f.sha256) errors.push({source: f.source, error: 'archive hash'});
const keys = new Set();
for (const r of coverage.records) {
  const key = r.kind + ':' + r.id;
  if (keys.has(key)) errors.push({source: key, error: 'duplicate coverage'});
  keys.add(key);
  if (r.sourceSha256 !== manifest.files.find(f => f.source === r.source)?.sha256) errors.push({source: key, error: 'source provenance'});
  for (const target of Array.isArray(r.target) ? r.target : [r.target]) {
    const error = checkTarget('', target, true);
    if (error) errors.push({source: key, target, error});
  }
}
const originalRoadmap = read(manifest.files.find(f => f.source === roadmap).archive);
const currentRoadmap = read(roadmap);
const checks = text => [...text.matchAll(/^- \[([ x])\] \*\*(R\d(?:\.\d+)*)(?:\*\*|\s)/gm)].map(m => [m[2], m[1]]);
for (const [id, mark] of checks(originalRoadmap)) if (!checks(currentRoadmap).some(c => c[0] === id && c[1] === mark)) errors.push({source: id, error: 'checkbox changed or missing'});
const config = JSON.parse(read('actual_docs/governance/evidence/docs-consolidation-20261104/verification-inputs.json'));
const preexisting = [];
for (const file of config.files) {
  for (const m of read(file).replace(/^```[^\n]*\n[\s\S]*?^```/gm, '').matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const error = checkTarget(file, m[1]);
    if (!error) continue;
    const entry = {source: file, target: m[1], error};
    if (config.preexistingBroken.some(p => p.source === file && p.target === m[1])) preexisting.push(entry);
    else errors.push(entry);
  }
}
for (const id of ['V01', 'V03', 'V04', 'V07', 'V08', 'V10', 'V11', 'V15']) {
  if (new RegExp('^## '+id+'(?:\\s|[.—])','m').test(read(questions))) errors.push({source:id,error:'closed question still active'});
}
for (const p of ['AGENTS.md', 'actual_docs/governance/DEVELOPMENT_WORKFLOW.md']) {
  if (/(?:UNIFIED_SPEC_MARKET_REQUIREMENTS[^\s)]*|FUNCTIONAL_AUDIT_AND_ROADMAP[^\s)]*|BUSINESS_RULES_AND_IMPLEMENTATION|PROJECT_OVERVIEW)\.md/.test(read(p))) errors.push({source:p,error:'retired mandatory route'});
}
const retired = manifest.files.filter(f => /PROJECT_OVERVIEW|FUNCTIONAL_AUDIT|UNIFIED_SPEC|BUSINESS_RULES|QUESTIONNAIRE|QUESTIONS-AND|BUSINESS-LOGIC/.test(f.source)).map(f => f.source);
for (const file of config.inboundFiles || []) {
  for (const m of read(file).matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const targetFile = path.normalize(path.join(path.dirname(file), m[1].split('#')[0])).replaceAll('\\', '/');
    if (!retired.includes(targetFile)) continue;
    const error = checkTarget(file, m[1]);
    if (error) errors.push({source:file,target:m[1],error});
  }
}
const result = {ok: errors.length === 0, archiveFiles: manifest.files.length, coverageRecords: coverage.records.length, filesChecked: config.files.length, preexistingBroken: preexisting, errors};
fs.writeFileSync(path.join(__dirname, 'verification-result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({...result, errors: errors.slice(0, 18), preexistingBroken: preexisting.length}, null, 2));
process.exitCode = errors.length ? 1 : 0;
