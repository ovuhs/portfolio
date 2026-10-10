/* Shared by api/seo.js and api/sitemap.js (the leading underscore keeps Vercel from exposing it as an endpoint).
   Loads the portfolio content the same way the site does: Supabase first, the bundled content.js as fallback. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FETCH_TIMEOUT_MS = 3500;

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

// Resolves { data, live, updatedAt }. Never rejects: a database problem falls back to the bundled content.
async function loadContent() {
  const cfg = readConfig();
  const defaults = bundledDefaults(cfg);
  const url = (cfg.supabaseUrl || '').replace(/\/$/, '');
  if (!url || !cfg.supabaseAnonKey) return { data: defaults, live: false, updatedAt: null };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    const r = await fetch(url + '/rest/v1/site_content?id=eq.1&select=data,updated_at', {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey }, signal: ctl.signal
    });
    clearTimeout(t);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rows = await r.json();
    const row = rows && rows[0];
    const remote = row && row.data;
    return {
      data: Object.assign({}, defaults, remote && typeof remote === 'object' ? remote : {}),   // same merge the site uses
      live: !!remote, updatedAt: row && row.updated_at || null
    };
  } catch (e) {
    return { data: defaults, live: false, updatedAt: null };
  }
}

const arr = (v) => Array.isArray(v) ? v : [];

// LinkedIn recommendations and Fiverr reviews live on separate pages. Fiverr entries that were saved in the
// recommendations list before the Reviews page existed still count as reviews.
const recsOf = (c) => arr(c.recommendations).filter((r) => r && (r.text || r.name) && r.source !== 'fiverr');
const reviewsOf = (c) => arr(c.reviews).filter((r) => r && (r.text || r.name || r.shot))
  .concat(arr(c.recommendations).filter((r) => r && (r.text || r.name) && r.source === 'fiverr'));

// The pages that have their own address. "has" says whether the section currently has anything to show.
const SECTIONS = [
  { slug: 'projects', label: 'Projects', has: (c) => arr(c.projects).some((p) => p && p.title) },
  { slug: 'skills', label: 'Skills', has: (c) => arr(c.skills).length > 0 || arr(c.badges).length > 0 },
  { slug: 'certifications', label: 'Certifications', has: (c) => arr(c.certifications).some((x) => x && x.title) },
  { slug: 'experience', label: 'Experience', has: (c) => arr(c.jobs).length > 0 || arr(c.education).length > 0 },
  { slug: 'recommendations', label: 'Recommendations', has: (c) => recsOf(c).length > 0 },
  { slug: 'reviews', label: 'Reviews', has: (c) => reviewsOf(c).length > 0 },
  { slug: 'hobbies', label: 'Hobbies', has: (c) => arr(c.photos).some((x) => x && x.image) },
  { slug: 'contact', label: 'Contact', has: () => true }
];
const SECTION_SLUGS = SECTIONS.map((s) => s.slug);

function siteUrlFor(req) {
  const host = String((req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '').split(',')[0].trim();
  return (process.env.SITE_URL || (host ? 'https://' + host : 'https://shuvoia.vercel.app')).replace(/\/$/, '');
}

module.exports = { ROOT, loadContent, SECTIONS, SECTION_SLUGS, siteUrlFor, recsOf, reviewsOf };
