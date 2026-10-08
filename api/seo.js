/* Search-engine / link-preview version of the portfolio.

   Crawlers that do not run JavaScript (LinkedIn, WhatsApp, Bing, AI assistants...) cannot read the interactive
   site, so vercel.json sends them here. This builds a complete, plain HTML page from the same content the site
   shows (your Supabase data, falling back to the bundled content.js). People never see this page. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FETCH_TIMEOUT_MS = 3500;

/* ---------- content ---------- */

function readConfig() {
  const sandbox = { window: {} };
  try { vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'), sandbox, { timeout: 500 }); } catch (e) {}
  return sandbox.window.PORTFOLIO_CONFIG || {};
}

function bundledDefaults(cfg) {
  const sandbox = { window: { PORTFOLIO_CONFIG: cfg }, localStorage: {}, sessionStorage: {}, Event: function () {}, console };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8'), sandbox, { timeout: 1000 });
  return sandbox.window.PortfolioContent.DEFAULTS;
}

async function loadContent() {
  const cfg = readConfig();
  const defaults = bundledDefaults(cfg);
  const url = (cfg.supabaseUrl || '').replace(/\/$/, '');
  if (!url || !cfg.supabaseAnonKey) return { data: defaults, live: false };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    const r = await fetch(url + '/rest/v1/site_content?id=eq.1&select=data', {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey }, signal: ctl.signal
    });
    clearTimeout(t);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rows = await r.json();
    const remote = rows && rows[0] && rows[0].data;
    // Same merge the site uses: remote keys replace defaults.
    return { data: Object.assign({}, defaults, remote && typeof remote === 'object' ? remote : {}), live: !!remote };
  } catch (e) {
    return { data: defaults, live: false };
  }
}

/* ---------- small helpers ---------- */

const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toArr = (v) => Array.isArray(v) ? v : String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
const toLines = (v) => Array.isArray(v) ? v : String(v || '').split('\n').map((x) => x.trim()).filter(Boolean);
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };

// Only http(s), mailto and tel links (and site-relative paths) are ever emitted.
function safeHref(u, base) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';
  try { return new URL(u, base).href; } catch (e) { return ''; }
}
function absUrl(u, base) {
  u = String(u || '').trim();
  if (!u) return '';
  try { const h = new URL(u, base); return /^https?:$/.test(h.protocol) ? h.href : ''; } catch (e) { return ''; }
}

// Paragraphs, bullet lists and bold lead-ins, the same way the project popup formats descriptions.
function richText(text) {
  const leadOf = (t) => {
    const m = t.match(/^(.{2,60}?)(\s[–—-]\s|:\s)([\s\S]+)$/);
    return m && !/[.!?]/.test(m[1]) ? '<strong>' + esc(m[1] + (m[2].trim() === ':' ? ':' : ' –')) + '</strong> ' + esc(m[3]) : esc(t);
  };
  const out = []; let para = [], list = null;
  const flushP = () => { if (para.length) { out.push('<p>' + para.map(leadOf).join('<br>') + '</p>'); para = []; } };
  const flushL = () => { if (list) { out.push('<ul>' + list.map((i) => '<li>' + leadOf(i) + '</li>').join('') + '</ul>'); list = null; } };
  String(text || '').replace(/\r/g, '').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) { flushP(); flushL(); return; }
    const b = line.match(/^(?:[•●▪‣*–-]|\d+[.)])\s+([\s\S]*)$/);
    if (b) { flushP(); (list = list || []).push(b[1]); return; }
    flushL(); para.push(line);
  });
  flushP(); flushL();
  return out.join('');
}

const plainRole = (r) => String(r || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const stripArrow = (s) => String(s || '').replace(/\s*[↗→]\s*$/, '').trim();

/* ---------- page ---------- */

function buildPage(c, site) {
  const hero = c.hero || {};
  const jobs = Array.isArray(c.jobs) ? c.jobs : [];
  const projects = (Array.isArray(c.projects) ? c.projects : []).filter((p) => p && p.title);
  const skills = Array.isArray(c.skills) ? c.skills : [];
  const badges = Array.isArray(c.badges) ? c.badges : [];
  const certs = (Array.isArray(c.certifications) ? c.certifications : []).filter((x) => x && x.title);
  const recs = (Array.isArray(c.recommendations) ? c.recommendations : []).filter((r) => r && (r.text || r.name));
  const education = Array.isArray(c.education) ? c.education : [];
  const links = (Array.isArray(c.links) ? c.links : []).filter((l) => l && safeHref(l.href, site));
  const stats = Array.isArray(c.stats) ? c.stats : [];
  const marquee = (Array.isArray(c.marquee) ? c.marquee : []).map((m) => typeof m === 'string' ? m : m && m.text).filter(Boolean);
  const contact = c.contact || {};

  const name = hero.brand || 'Portfolio';
  const role = plainRole(jobs[0] && jobs[0].role) || 'Data Analyst';
  const company = jobs[0] && jobs[0].company ? String(jobs[0].company).replace(/\s*\(.*?\)\s*/g, ' ').trim() : '';
  const title = name + ' · ' + role;
  const stat0 = stats[0] ? (stats[0].prefix || '') + stats[0].value + (stats[0].suffix || '') + ' ' + (stats[0].label || '') : '';
  const description = clip([name + ' is a ' + role + (company ? ' at ' + company : '') + '.', stat0 ? stat0 + '.' : '', marquee.slice(0, 5).join(', ') + '.'].filter((x) => x && x !== '.').join(' ').replace(/\.{2,}/g, '.'), 158);
  const pageUrl = site + '/';
  const image = absUrl(c.ogImage || 'assets/og-image.jpg', site + '/');
  const photo = absUrl(hero.photo, site + '/');
  const sameAs = links.map((l) => safeHref(l.href, site)).filter((h) => /^https?:/i.test(h));
  const knows = Array.from(new Set(marquee.concat(skills.flatMap((s) => toArr(s.tags))))).slice(0, 30);

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Person', '@id': pageUrl + '#person', name, jobTitle: role, description: clip(hero.intro, 300),
      url: pageUrl, image: photo || image || undefined, sameAs: sameAs.length ? sameAs : undefined,
      worksFor: company ? { '@type': 'Organization', name: company } : undefined,
      address: contact.location ? { '@type': 'PostalAddress', addressLocality: contact.location } : undefined,
      alumniOf: education.filter((e) => e && e.school).map((e) => ({ '@type': 'EducationalOrganization', name: String(e.school).split('·')[0].trim() })),
      knowsAbout: knows.length ? knows : undefined
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', '@id': pageUrl + '#website', url: pageUrl, name, inLanguage: 'en', about: { '@id': pageUrl + '#person' } }
  ];
  const jsonLdHtml = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  const section = (id, heading, inner, tagline) => '<section id="' + id + '"><h2>' + esc(heading) + '</h2>' + (tagline ? '<p class="meta">' + esc(tagline) + '</p>' : '') + inner + '</section>';
  const head = (h) => h && (h.title || h.italic) ? [h.title, h.italic].filter(Boolean).join(' ') : '';

  const projectsHtml = projects.map((p) => {
    const imgs = (Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : [])).map((u) => absUrl(u, site + '/')).filter(Boolean);
    const link = safeHref(p.link, site);
    return '<article><h3>' + esc(p.title) + '</h3>' +
      '<p class="meta">' + esc(p.cat || '') + (toArr(p.tags).length ? ' · ' + esc(toArr(p.tags).join(', ')) : '') + '</p>' +
      (imgs[0] ? '<img src="' + esc(imgs[0]) + '" alt="' + esc(p.title + ' screenshot') + '" loading="lazy" width="640">' : '') +
      (p.summary ? '<p><em>' + esc(p.summary) + '</em></p>' : '') + richText(p.desc) +
      (p.dashboard ? '<p class="meta">An interactive demo of this project is available on the website.</p>' : '') +
      (link ? '<p><a href="' + esc(link) + '" rel="noopener">' + esc(link) + '</a></p>' : '') + '</article>';
  }).join('');

  const skillsHtml = skills.map((s) => '<article><h3>' + esc(s.name) + '</h3>' + (s.area ? '<p class="meta">' + esc(s.area) + '</p>' : '') + (s.desc ? '<p>' + esc(s.desc) + '</p>' : '') +
    (toArr(s.tags).length ? '<p class="meta">' + esc(toArr(s.tags).join(', ')) + '</p>' : '') + '</article>').join('') +
    (badges.length ? '<ul>' + badges.map((b) => '<li><strong>' + esc([b.value, b.title].filter(Boolean).join(' ')) + '</strong> ' + esc(b.text) + '</li>').join('') + '</ul>' : '');

  const certsHtml = '<ul>' + certs.map((x) => {
    const href = safeHref(x.url, site);
    return '<li><strong>' + esc(x.title) + '</strong>' + (x.issuer || x.date ? ' – ' + esc([x.issuer, x.date].filter(Boolean).join(', ')) : '') +
      (x.note ? '. ' + esc(x.note) : '') + (x.credentialId ? ' (ID ' + esc(x.credentialId) + ')' : '') +
      (href ? ' <a href="' + esc(href) + '" rel="noopener">Verify</a>' : '') + '</li>';
  }).join('') + '</ul>';

  const jobsHtml = jobs.map((j) => '<article><h3>' + esc(j.role) + '</h3><p class="meta">' + esc([j.company, j.dates].filter(Boolean).join(' · ')) + '</p>' +
    '<ul>' + toLines(j.points).map((pt) => '<li>' + esc(pt) + '</li>').join('') + '</ul></article>').join('') +
    (education.length ? '<h3>Education</h3><ul>' + education.map((e) => '<li><strong>' + esc(e.degree) + '</strong> – ' + esc(e.school) + (e.period ? ' (' + esc(e.period) + ')' : '') + '</li>').join('') + '</ul>' : '');

  const recsHtml = recs.map((r) => {
    const href = safeHref(r.link, site);
    return '<blockquote><p>' + esc(r.text) + '</p><footer>— <strong>' + esc(r.name) + '</strong>' + (r.role ? ', ' + esc(r.role) : '') + (r.relation ? ' (' + esc(r.relation) + ')' : '') +
      (href ? ' · <a href="' + esc(href) + '" rel="noopener">LinkedIn profile</a>' : '') + '</footer></blockquote>';
  }).join('');

  const contactHtml = '<ul>' + (contact.email ? '<li>Email: <a href="mailto:' + esc(contact.email) + '">' + esc(contact.email) + '</a></li>' : '') +
    links.filter((l) => !/^mailto:/i.test(l.href)).map((l) => '<li>' + esc(l.label) + ': <a href="' + esc(safeHref(l.href, site)) + '" rel="noopener me">' + esc(stripArrow(l.value) || l.href) + '</a></li>').join('') +
    (contact.location ? '<li>Location: ' + esc(contact.location) + '</li>' : '') + '</ul>';

  const nav = [['projects', 'Projects', projects.length], ['skills', 'Skills', skills.length], ['certifications', 'Certifications', certs.length],
    ['experience', 'Experience', jobs.length], ['recommendations', 'Recommendations', recs.length], ['contact', 'Contact', 1]].filter((n) => n[2]);

  const body =
    '<header><h1>' + esc(name) + '</h1><p class="role">' + esc(role) + (company ? ' · ' + esc(company) : '') + '</p>' +
    (photo ? '<img class="me" src="' + esc(photo) + '" alt="' + esc(name) + '" width="220">' : '') +
    (hero.intro ? '<p>' + esc(hero.intro) + '</p>' : '') +
    (stats.length ? '<ul class="stats">' + stats.map((s) => '<li><strong>' + esc((s.prefix || '') + s.value + (s.suffix || '')) + '</strong> ' + esc(s.label) + '</li>').join('') + '</ul>' : '') +
    (marquee.length ? '<p class="meta">' + esc(marquee.join(' · ')) + '</p>' : '') +
    '<p><a href="' + esc(pageUrl) + '">Open the interactive portfolio</a></p>' +
    '<nav aria-label="Sections">' + nav.map((n) => '<a href="#' + n[0] + '">' + esc(n[1]) + '</a>').join(' · ') + '</nav></header><main>' +
    (projects.length ? section('projects', 'Projects', projectsHtml, head(c.work)) : '') +
    (skills.length ? section('skills', 'Skills', skillsHtml, head(c.skillsHead)) : '') +
    (certs.length ? section('certifications', 'Certifications', certsHtml, head(c.certsHead)) : '') +
    (jobs.length ? section('experience', 'Experience', jobsHtml, head(c.expHead)) : '') +
    (recs.length ? section('recommendations', 'Recommendations', recsHtml, head(c.recsHead)) : '') +
    section('contact', 'Contact', contactHtml) + '</main><footer><p>' + esc(contact.footer || ('© ' + new Date().getFullYear() + ' ' + name)) + '</p></footer>';

  const css = 'body{margin:0;background:#0A0F1E;color:#E9EDF7;font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    'header,main,footer{max-width:860px;margin:0 auto;padding:24px 20px}a{color:#22D3EE}h1{font-size:2.4rem;margin:.2em 0}h2{margin-top:2.2em;border-bottom:1px solid #26304d;padding-bottom:.3em}' +
    'h3{margin:1.4em 0 .2em}.role{font-size:1.2rem;color:#AEB6CC;margin:0}.meta{color:#9DA6BE;font-size:.9rem;margin:.2em 0}img{max-width:100%;height:auto;border-radius:12px;margin:.6em 0}' +
    'img.me{display:block;border-radius:50%}blockquote{margin:1.2em 0;padding:.2em 1em;border-left:3px solid #22D3EE;background:#111830}blockquote footer{padding:0;color:#AEB6CC}' +
    '.stats{list-style:none;padding:0;display:flex;gap:1.4em;flex-wrap:wrap}nav a{white-space:nowrap}';

  const meta = [
    '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + esc(title) + '</title>', '<meta name="description" content="' + esc(description) + '">',
    '<meta name="robots" content="index, follow, max-image-preview:large">', '<link rel="canonical" href="' + esc(pageUrl) + '">',
    '<meta property="og:type" content="website">', '<meta property="og:site_name" content="' + esc(name) + '">', '<meta property="og:locale" content="en_US">',
    '<meta property="og:title" content="' + esc(title) + '">', '<meta property="og:description" content="' + esc(description) + '">', '<meta property="og:url" content="' + esc(pageUrl) + '">',
    image ? '<meta property="og:image" content="' + esc(image) + '"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="' + esc(title) + '">' : '',
    '<meta name="twitter:card" content="summary_large_image">', '<meta name="twitter:title" content="' + esc(title) + '">', '<meta name="twitter:description" content="' + esc(description) + '">',
    image ? '<meta name="twitter:image" content="' + esc(image) + '">' : '', '<meta name="theme-color" content="#0A0F1E">',
    '<link rel="icon" href="' + esc(site + '/assets/favicon.svg') + '" type="image/svg+xml">',
    '<script type="application/ld+json">' + jsonLdHtml + '</script>', '<style>' + css + '</style>'
  ].filter(Boolean).join('\n');

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' + meta + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
}

/* ---------- handler ---------- */

module.exports = async function handler(req, res) {
  const host = String((req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '').split(',')[0].trim();
  const site = (process.env.SITE_URL || (host ? 'https://' + host : 'https://shuvoia.vercel.app')).replace(/\/$/, '');
  try {
    const { data, live } = await loadContent();
    const html = buildPage(data, site);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', live ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'public, s-maxage=60');
    res.setHeader('X-Robots-Tag', 'index, follow');
    res.setHeader('X-Seo-Render', live ? 'live' : 'bundled');
    res.end(html);
  } catch (e) {
    // Never leave a crawler empty-handed: fall back to the normal page.
    try {
      const fallback = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(fallback);
    } catch (e2) {
      res.statusCode = 500;
      res.end('Temporarily unavailable');
    }
  }
};

module.exports.buildPage = buildPage;
