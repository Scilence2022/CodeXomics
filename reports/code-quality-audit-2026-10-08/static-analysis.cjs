// Repository source inventory and exact-token clone scan; no production files are written.
// Run from the repository root after npm ci --ignore-scripts.
const fs = require('fs'),
  cp = require('child_process'),
  crypto = require('crypto'),
  espree = require(process.cwd() + '/node_modules/espree');
const tracked = cp.execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
const source = tracked.filter(
  p => /^(src|tools_registry|scripts|packages)\//.test(p) && p.endsWith('.js') && !p.includes('/vendor/')
);
const texts = new Map(
  tracked
    .filter(
      p =>
        /^(src|tools_registry|scripts|packages|test|\.github)\//.test(p) &&
        /\.(js|html|json|yaml|yml|css)$/.test(p) &&
        !p.includes('/vendor/')
    )
    .map(p => [p, fs.readFileSync(p, 'utf8')])
);
const methods = [],
  dupes = [],
  parseErrors = [],
  stats = [],
  orphans = [];
for (const file of source) {
  const text = fs.readFileSync(file, 'utf8');
  let ast;
  stats.push({ file, lines: text.split('\n').length - Number(text.endsWith('\n')), bytes: Buffer.byteLength(text) });
  try {
    ast = espree.parse(text, { ecmaVersion: 'latest', sourceType: 'module', range: true, loc: true, tokens: true });
  } catch (e) {
    parseErrors.push({ file, error: e.message });
    continue;
  }
  function walk(n, className = '') {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') {
      className = n.id?.name || '<anonymous>';
      const keys = new Map();
      for (const m of n.body.body) {
        if (m.type !== 'MethodDefinition' || m.computed) continue;
        const key = [m.static, m.kind, m.key.name || m.key.value].join(':');
        if (keys.has(key))
          dupes.push({
            file,
            className,
            name: m.key.name || m.key.value,
            first: keys.get(key).loc.start.line,
            later: m.loc.start.line,
          });
        keys.set(key, m);
      }
    }
    if (n.type === 'MethodDefinition' && n.value?.body) {
      const b = n.value.body;
      const tokens = ast.tokens.filter(t => t.range[0] >= b.range[0] && t.range[1] <= b.range[1]);
      const normalized = tokens.map(t => [t.type, t.value]);
      methods.push({
        file,
        className,
        name: n.key.name || n.key.value || '<computed>',
        start: n.loc.start.line,
        end: n.loc.end.line,
        lines: n.loc.end.line - n.loc.start.line + 1,
        bodyStart: b.range[0],
        bodyEnd: b.range[1],
        hash: crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),
      });
    }
    for (const [k, v] of Object.entries(n)) {
      if (['loc', 'range', 'tokens'].includes(k)) continue;
      if (Array.isArray(v)) v.forEach(c => walk(c, className));
      else if (v && typeof v === 'object') walk(v, className);
    }
  }
  walk(ast);
  if (file.startsWith('src/renderer/modules/')) {
    const base = file.split('/').pop(),
      id = base.slice(0, -3);
    const refs = [];
    for (const [p, t] of texts) {
      if (p !== file && (t.includes(base) || new RegExp('\\b' + id + '\\b').test(t))) refs.push(p);
    }
    if (!refs.some(p => !p.startsWith('test/'))) orphans.push({ ...stats.at(-1), references: refs });
  }
}
const groups = new Map();
for (const m of methods) {
  if (m.lines < 12) continue;
  const g = groups.get(m.hash) || [];
  g.push(m);
  groups.set(m.hash, g);
}
const duplicateBodies = [...groups.values()]
  .filter(g => g.length > 1)
  .map(g => g.map(({ hash, bodyStart, bodyEnd, ...v }) => v))
  .sort((a, b) => b.reduce((n, m) => n + m.lines, 0) - a.reduce((n, m) => n + m.lines, 0));
const summary = {
  files: source.length,
  lines: stats.reduce((n, s) => n + s.lines, 0),
  bytes: stats.reduce((n, s) => n + s.bytes, 0),
  methods: methods.length,
  parseErrors,
  dupes,
  orphans,
  topFiles: stats.sort((a, b) => b.lines - a.lines).slice(0, 20),
  largestMethods: methods.sort((a, b) => b.lines - a.lines).slice(0, 20),
  duplicateBodies,
};
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
