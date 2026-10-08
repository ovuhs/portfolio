#!/usr/bin/env node
/* Checks the things that have broken a Vercel deploy before, without needing Vercel:
     node scripts/preflight.js
   Exits with an error if anything would make the build fail. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const problems = [];
const ok = (msg) => console.log('  ok   ' + msg);
const bad = (msg) => { problems.push(msg); console.log('  FAIL ' + msg); };

console.log('Preflight');

// 1. middleware: Vercel reads `config` statically, so the matcher must be a plain list of strings.
try {
  const m = read('middleware.js').match(/export const config\s*=\s*\{([\s\S]*?)\};/);
  if (!m) bad('middleware.js: no "export const config" found');
  else if (/\(|\)|\.map|\.concat|\.\.\.|\$\{/.test(m[1])) bad('middleware.js: config must be a plain literal (no calls, spreads or template strings): ' + m[1].trim());
  else if (!/matcher\s*:\s*\[\s*('[^']*'|"[^"]*")(\s*,\s*('[^']*'|"[^"]*"))*\s*,?\s*\]/.test(m[1])) bad('middleware.js: matcher must be a list of plain strings');
  else ok('middleware.js config is a plain literal');
} catch (e) { bad('middleware.js: ' + e.message); }

// 2. vercel.json parses and points at real files
try {
  const cfg = JSON.parse(read('vercel.json'));
  ok('vercel.json is valid JSON');
  Object.keys(cfg.functions || {}).forEach((f) => (fs.existsSync(path.join(ROOT, f)) ? ok('function file exists: ' + f) : bad('vercel.json: function file missing: ' + f)));
  (cfg.rewrites || []).forEach((r) => {
    const dest = String(r.destination || '');
    const file = dest.startsWith('/api/') ? 'api' + dest.slice(4) + '.js' : dest.replace(/^\//, '');
    if (/^https?:/.test(dest)) return;
    fs.existsSync(path.join(ROOT, file)) ? ok('rewrite target exists: ' + dest) : bad('vercel.json: rewrite target missing: ' + dest + ' (' + file + ')');
  });
} catch (e) { bad('vercel.json: ' + e.message); }

// 2b. image service: every width the page asks for must be allowed, and the allowed host must be the Supabase project
try {
  const cfg = JSON.parse(read('vercel.json'));
  const img = cfg.images;
  if (!img) bad('vercel.json: "images" config is missing (the page requests /_vercel/image)');
  else {
    const asked = new Set();
    (read('index.html').match(/data-w="[0-9,]+"/g) || []).forEach((a) => a.slice(8, -1).split(',').forEach((n) => asked.add(Number(n))));
    const missing = [...asked].filter((w) => !(img.sizes || []).includes(w));
    missing.length ? bad('vercel.json images.sizes is missing widths used by index.html: ' + missing.join(', ')) : ok('image widths used by the page are all allowed (' + [...asked].sort((a, b) => a - b).join(', ') + ')');
    const host = (read('config.js').match(/supabaseUrl:\s*'https?:\/\/([^/']+)/) || [])[1];
    const pat = (img.remotePatterns || [])[0];
    if (host && pat && !new RegExp(pat.hostname).test(host)) bad('vercel.json images.remotePatterns hostname does not match ' + host);
    else if (host) ok('image host pattern matches ' + host);
    if (!/^\d+$/.test(String((img.qualities || [])[0])) || !(img.qualities || []).includes(75)) bad('vercel.json images.qualities must include 75 (the page asks for q=75)');
  }
} catch (e) { bad('image config check: ' + e.message); }

// 3. every function parses (underscore files are helpers, not endpoints, but must still be valid)
fs.readdirSync(path.join(ROOT, 'api')).filter((f) => f.endsWith('.js')).forEach((f) => {
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, 'api', f)], { stdio: 'pipe' }); ok('api/' + f + ' parses'); }
  catch (e) { bad('api/' + f + ' has a syntax error: ' + String(e.stderr || e.message).split('\n').slice(0, 3).join(' ')); }
});

// 4. middleware parses as a module
try {
  const tmp = path.join(ROOT, '_preflight_mw.mjs');
  fs.writeFileSync(tmp, read('middleware.js'));
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok('middleware.js parses'); }
  finally { fs.unlinkSync(tmp); }
} catch (e) { bad('middleware.js has a syntax error: ' + String(e.stderr || e.message).split('\n').slice(0, 3).join(' ')); }

// 5. no stray control characters (backspace, escape...) in source files
['index.html', 'admin/index.html', 'tracker.js', 'content.js', 'middleware.js', 'vercel.json'].concat(fs.readdirSync(path.join(ROOT, 'api')).map((f) => 'api/' + f)).forEach((f) => {
  const n = [...read(f)].filter((c) => c.charCodeAt(0) < 32 && !'\n\r\t'.includes(c)).length;
  if (n) bad(f + ' contains ' + n + ' control character(s)');
});
if (!problems.length) ok('no stray control characters');

console.log(problems.length ? '\n' + problems.length + ' problem(s). Do not deploy yet.' : '\nAll checks passed.');
process.exit(problems.length ? 1 : 0);
