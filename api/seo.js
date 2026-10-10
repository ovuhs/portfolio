/* Search-engine / link-preview version of the portfolio.

   Crawlers that do not run JavaScript (LinkedIn, WhatsApp, Bing, AI assistants...) cannot read the interactive
   site, so middleware.js sends them here. This builds a complete, plain HTML page from the same content the site
   shows: the whole portfolio for "/", or one section for "/projects", "/skills" and so on. People never see it. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, loadContent, SECTIONS, siteUrlFor, recsOf, reviewsOf } = require('./_content');

/* ---------- small helpers ---------- */

const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toArr = (v) => Array.isArray(v) ? v : String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
const toLines = (v) => Array.isArray(v) ? v : String(v || '').split('\n').map((x) => x.trim()).filter(Boolean);
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const unique = (a) => Array.from(new Set(a));

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
const plainCompany = (r) => String(r || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const stripArrow = (s) => String(s || '').replace(/\s*[↗→]\s*$/, '').trim();

/* ---------- page ---------- */

// section: '' / 'home' for the whole portfolio, or one of the SECTION slugs.
function buildPage(c, site, section) {
  section = section && section !== 'home' ? section : '';
  const hero = c.hero || {};
  const jobs = Array.isArray(c.jobs) ? c.jobs : [];
  const projects = (Array.isArray(c.projects) ? c.projects : []).filter((p) => p && p.title);
  const skills = Array.isArray(c.skills) ? c.skills : [];
  const badges = Array.isArray(c.badges) ? c.badges : [];
  const certs = (Array.isArray(c.certifications) ? c.certifications : []).filter((x) => x && x.title);
  const recs = recsOf(c);
  const reviews = reviewsOf(c);
  const photos = (Array.isArray(c.photos) ? c.photos : []).filter((x) => x && x.image);
  const education = Array.isArray(c.education) ? c.education : [];
  const links = (Array.isArray(c.links) ? c.links : []).filter((l) => l && safeHref(l.href, site));
  const stats = Array.isArray(c.stats) ? c.stats : [];
  const marquee = (Array.isArray(c.marquee) ? c.marquee : []).map((m) => typeof m === 'string' ? m : m && m.text).filter(Boolean);
  const contact = c.contact || {};

  const name = hero.brand || 'Portfolio';
  const role = plainRole(jobs[0] && jobs[0].role) || 'Data Analyst';
  const company = jobs[0] && jobs[0].company ? plainCompany(jobs[0].company) : '';
  const stat0 = stats[0] ? (stats[0].prefix || '') + stats[0].value + (stats[0].suffix || '') + ' ' + (stats[0].label || '') : '';
  const sec = SECTIONS.find((s) => s.slug === section);
  const pageUrl = site + (section ? '/' + section : '/');
  const homeUrl = site + '/';
  const image = absUrl(c.ogImage || 'assets/og-image.jpg', site + '/');
  const photo = absUrl(hero.photo, site + '/');
  const sameAs = links.map((l) => safeHref(l.href, site)).filter((h) => /^https?:/i.test(h));
  const knows = unique(marquee.concat(skills.flatMap((s) => toArr(s.tags)))).slice(0, 30);

  /* title + description, specific to the page */
  let title, description;
  const cats = unique(projects.map((p) => p.cat).filter(Boolean));
  const photoCats = unique(photos.map((x) => x.category).filter(Boolean));
  switch (section) {
    case 'projects':
      title = 'Projects · ' + name;
      description = name + "'s " + projects.length + ' projects' + (cats.length ? ' (' + cats.join(', ') + ')' : '') + ', including ' + projects.slice(0, 3).map((p) => p.title).join(', ') + '.'; break;
    case 'skills':
      title = 'Skills · ' + name;
      description = 'What ' + name + ' works with: ' + (skills.map((s) => s.name).join(', ') || marquee.join(', ')) + '.'; break;
    case 'certifications':
      title = 'Certifications · ' + name;
      description = certs.length + ' professional certifications held by ' + name + ', including ' + certs.slice(0, 3).map((x) => x.title).join(', ') + '.'; break;
    case 'experience':
      title = 'Experience · ' + name;
      description = 'Work experience of ' + name + ': ' + jobs.map((j) => plainRole(j.role) + ' at ' + plainCompany(j.company).replace(/\s+(Pvt\.?|Private|Ltd\.?|Limited)\b.*$/i, '')).slice(0, 3).join('; ') + '.'; break;
    case 'recommendations':
      title = 'Recommendations · ' + name;
      description = recs.length + ' LinkedIn recommendations for ' + name + ' from managers and colleagues' + (recs[0] && recs[0].name ? ', including ' + recs.slice(0, 2).map((r) => r.name).join(' and ') : '') + '.'; break;
    case 'reviews':
      title = 'Reviews · ' + name;
      description = reviews.length + ' client reviews for ' + name + ' from Fiverr' + (reviews[0] && reviews[0].name ? ', including ' + reviews.slice(0, 2).map((r) => r.name).join(' and ') : '') + '.'; break;
    case 'hobbies':
      title = 'Photography · ' + name;
      description = 'Photography by ' + name + ': ' + photos.length + ' photos' + (photoCats.length ? ' (' + photoCats.join(', ') + ')' : '') + '.'; break;
    case 'contact':
      title = 'Contact · ' + name;
      description = 'Get in touch with ' + name + (contact.location ? ' in ' + contact.location : '') + ': email and professional profiles.'; break;
    default:
      title = name + ' · ' + role;
      description = [name + ' is a ' + role + (company ? ' at ' + company : '') + '.', stat0 ? stat0 + '.' : '', marquee.slice(0, 5).join(', ') + '.'].filter((x) => x && x !== '.').join(' ');
  }
  description = clip(description.replace(/\.{2,}/g, '.'), 158);

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Person', '@id': homeUrl + '#person', name, jobTitle: role, description: clip(hero.intro, 300),
      url: homeUrl, image: photo || image || undefined, sameAs: sameAs.length ? sameAs : undefined,
      worksFor: company ? { '@type': 'Organization', name: company } : undefined,
      address: contact.location ? { '@type': 'PostalAddress', addressLocality: contact.location } : undefined,
      alumniOf: education.filter((e) => e && e.school).map((e) => ({ '@type': 'EducationalOrganization', name: String(e.school).split('·')[0].trim() })),
      knowsAbout: knows.length ? knows : undefined
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', '@id': homeUrl + '#website', url: homeUrl, name, inLanguage: 'en', about: { '@id': homeUrl + '#person' } }
  ];
  if (sec) {
    jsonLd.push({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: homeUrl }, { '@type': 'ListItem', position: 2, name: sec.label, item: pageUrl }]
    });
    jsonLd.push({ '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': pageUrl + '#page', url: pageUrl, name: title, description, isPartOf: { '@id': homeUrl + '#website' }, about: { '@id': homeUrl + '#person' } });
  }
  const jsonLdHtml = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  /* section bodies */
  const block = (id, heading, inner, tagline) => {
    const h = section === id ? 1 : 2;
    return '<section id="' + id + '"><h' + h + '>' + esc(heading) + '</h' + h + '>' + (tagline ? '<p class="meta">' + esc(tagline) + '</p>' : '') + inner + '</section>';
  };
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

  const regionName = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { return null; } })();
  const reviewsHtml = reviews.map((r) => {
    const cc = String(r.country || '').trim().toUpperCase();
    let country = ''; if (/^[A-Z]{2}$/.test(cc) && regionName) { try { country = regionName.of(cc) || ''; } catch (e) { country = ''; } }
    const stars = Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0)));
    const href = safeHref(r.link, site);
    return '<blockquote>' + (r.text ? '<p>' + esc(r.text) + '</p>' : '') + '<footer>— <strong>' + esc(r.name) + '</strong>' + (country ? ', ' + esc(country) : '') +
      (stars ? ' · ' + stars + '/5 stars' : '') + (r.relation ? ' (' + esc(r.relation) + ')' : '') + ' · Fiverr review' +
      (href ? ' · <a href="' + esc(href) + '" rel="noopener">View on Fiverr</a>' : '') + '</footer></blockquote>';
  }).join('');

  const hobbiesHtml = (c.hobbiesHead && c.hobbiesHead.intro ? '<p>' + esc(c.hobbiesHead.intro) + '</p>' : '') + photos.map((x) => {
    const u = absUrl(x.image, site + '/');
    return u ? '<figure><img src="' + esc(u) + '" alt="' + esc(x.title || (name + ' photo')) + '" loading="lazy" width="640">' +
      (x.title || x.place || x.date ? '<figcaption>' + esc([x.title, x.place, x.date].filter(Boolean).join(' · ')) + '</figcaption>' : '') + '</figure>' : '';
  }).join('');

  const contactHtml = '<ul>' + (contact.email ? '<li>Email: <a href="mailto:' + esc(contact.email) + '">' + esc(contact.email) + '</a></li>' : '') +
    links.filter((l) => !/^mailto:/i.test(l.href)).map((l) => '<li>' + esc(l.label) + ': <a href="' + esc(safeHref(l.href, site)) + '" rel="noopener me">' + esc(stripArrow(l.value) || l.href) + '</a></li>').join('') +
    (contact.location ? '<li>Location: ' + esc(contact.location) + '</li>' : '') + '</ul>';

  const blocks = {
    projects: () => block('projects', 'Projects', projectsHtml, head(c.work)),
    skills: () => block('skills', 'Skills', skillsHtml, head(c.skillsHead)),
    certifications: () => block('certifications', 'Certifications', certsHtml, head(c.certsHead)),
    experience: () => block('experience', 'Experience', jobsHtml, head(c.expHead)),
    recommendations: () => block('recommendations', 'Recommendations', recsHtml, head(c.recsHead)),
    reviews: () => block('reviews', 'Reviews', reviewsHtml, head(c.reviewsHead)),
    hobbies: () => block('hobbies', 'Photography', hobbiesHtml, head(c.hobbiesHead)),
    contact: () => block('contact', 'Contact', contactHtml, '')
  };
  const navLinks = SECTIONS.filter((s) => s.has(c)).map((s) => '<a href="' + esc(site + '/' + s.slug) + '">' + esc(s.label) + '</a>').join(' · ');

  let body;
  if (!section) {
    body = '<header><h1>' + esc(name) + '</h1><p class="role">' + esc(role) + (company ? ' · ' + esc(company) : '') + '</p>' +
      (photo ? '<img class="me" src="' + esc(photo) + '" alt="' + esc(name) + '" width="220">' : '') +
      (hero.intro ? '<p>' + esc(hero.intro) + '</p>' : '') +
      (stats.length ? '<ul class="stats">' + stats.map((s) => '<li><strong>' + esc((s.prefix || '') + s.value + (s.suffix || '')) + '</strong> ' + esc(s.label) + '</li>').join('') + '</ul>' : '') +
      (marquee.length ? '<p class="meta">' + esc(marquee.join(' · ')) + '</p>' : '') +
      '<p><a href="' + esc(homeUrl) + '">Open the interactive portfolio</a></p><nav aria-label="Sections">' + navLinks + '</nav></header><main>' +
      SECTIONS.filter((s) => s.has(c)).map((s) => blocks[s.slug]()).join('') + '</main>';
  } else {
    body = '<header><p class="role"><a href="' + esc(homeUrl) + '">' + esc(name) + '</a> · ' + esc(role) + '</p><nav aria-label="Sections">' + navLinks + '</nav></header><main>' +
      blocks[section]() + '<p><a href="' + esc(pageUrl) + '">Open the interactive version of this page</a></p></main>';
  }
  body += '<footer><p>' + esc(contact.footer || ('© ' + new Date().getFullYear() + ' ' + name)) + '</p></footer>';

  const css = 'body{margin:0;background:#0A0F1E;color:#E9EDF7;font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    'header,main,footer{max-width:860px;margin:0 auto;padding:24px 20px}a{color:#22D3EE}h1{font-size:2.4rem;margin:.2em 0}h2{margin-top:2.2em;border-bottom:1px solid #26304d;padding-bottom:.3em}' +
    'h3{margin:1.4em 0 .2em}.role{font-size:1.2rem;color:#AEB6CC;margin:0}.meta{color:#9DA6BE;font-size:.9rem;margin:.2em 0}img{max-width:100%;height:auto;border-radius:12px;margin:.6em 0}' +
    'img.me{display:block;border-radius:50%}blockquote{margin:1.2em 0;padding:.2em 1em;border-left:3px solid #22D3EE;background:#111830}blockquote footer{padding:0;color:#AEB6CC}' +
    'figure{margin:1.2em 0}figcaption{color:#9DA6BE;font-size:.9rem}.stats{list-style:none;padding:0;display:flex;gap:1.4em;flex-wrap:wrap}nav a{white-space:nowrap}';

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

function sectionFromRequest(req) {
  let s = req.query && req.query.section;
  if (!s) { try { s = new URL(req.url, 'http://x').searchParams.get('section'); } catch (e) {} }
  s = Array.isArray(s) ? s[0] : s;
  return s && SECTIONS.some((x) => x.slug === s) ? s : '';
}

module.exports = async function handler(req, res) {
  const site = siteUrlFor(req);
  const section = sectionFromRequest(req);
  try {
    const { data, live } = await loadContent();
    const sec = SECTIONS.find((s) => s.slug === section);
    // A section with nothing in it is not a page worth indexing.
    if (sec && !sec.has(data)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'noindex');
      res.end('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Nothing here yet</title></head><body><p>Nothing here yet. <a href="' + esc(site + '/') + '">Go to the portfolio</a>.</p></body></html>');
      return;
    }
    const html = buildPage(data, site, section);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', live ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'public, s-maxage=60');
    res.setHeader('X-Robots-Tag', 'index, follow');
    res.setHeader('X-Seo-Render', (live ? 'live' : 'bundled') + (section ? ':' + section : ''));
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
