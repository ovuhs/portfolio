#!/usr/bin/env node
/* Local preview server that behaves like the Vercel deployment:
     node scripts/dev-server.js            (then open http://localhost:5173)

   - /projects, /skills ... serve the same page as "/" (the page reads the path itself)
   - crawlers (matched by middleware.js) get the text version from api/seo.js
   - /sitemap.xml comes from api/sitemap.js
   Use  curl -A "LinkedInBot/1.0" http://localhost:5173/projects  to see what a crawler receives. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 5173;
const SECTIONS = ['projects', 'skills', 'certifications', 'experience', 'recommendations', 'hobbies', 'contact'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

// One source of truth for which user agents count as crawlers: the regex in middleware.js.
const BOTS = new RegExp(fs.readFileSync(path.join(ROOT, 'middleware.js'), 'utf8').match(/const BOTS = \/(.*)\/i;/)[1], 'i');
const seo = require('../api/seo.js');
const sitemap = require('../api/sitemap.js');

function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; res.end('Not found'); return; }
    res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(buf);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  const slug = pathname.replace(/^\//, '');
  const isBot = BOTS.test(req.headers['user-agent'] || '');

  if (pathname === '/api/seo') { req.query = Object.fromEntries(url.searchParams); return seo(req, res); }
  if (pathname === '/api/sitemap' || pathname === '/sitemap.xml') return sitemap(req, res);
  // Stand-in for Vercel's image service: passes the original image through (no resizing), so the page logic can be tested.
  // The page only uses /_vercel/image locally when localStorage has shuvo_opt=1.
  if (pathname === '/_vercel/image') {
    const target = url.searchParams.get('url') || '';
    if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(target)) { res.statusCode = 400; return res.end('url not allowed'); }
    return fetch(target).then(async (r) => { res.statusCode = r.status; res.setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream'); res.setHeader('X-Dev-Image-Proxy', 'w=' + url.searchParams.get('w')); res.end(Buffer.from(await r.arrayBuffer())); }).catch(() => { res.statusCode = 502; res.end('bad gateway'); });
  }
  if (pathname === '/' || SECTIONS.includes(slug)) {
    if (isBot) { req.query = SECTIONS.includes(slug) ? { section: slug } : {}; return seo(req, res); }
    return sendFile(res, path.join(ROOT, 'index.html'));
  }
  // static files, never outside the project folder
  let file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end('Forbidden'); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  sendFile(res, file);
}).listen(PORT, () => console.log('Portfolio dev server on http://localhost:' + PORT));
