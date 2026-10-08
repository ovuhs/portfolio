/* sitemap.xml, built from the live content so it only lists pages that have something to show,
   with a real "last modified" date from the database. vercel.json maps /sitemap.xml here. */
'use strict';
const { loadContent, SECTIONS, siteUrlFor } = require('./_content');

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildSitemap(content, site, updatedAt) {
  const last = updatedAt && !isNaN(Date.parse(updatedAt)) ? new Date(updatedAt).toISOString().slice(0, 10) : '';
  const entry = (loc, priority, freq) => '  <url>\n    <loc>' + esc(loc) + '</loc>\n' + (last ? '    <lastmod>' + last + '</lastmod>\n' : '') +
    '    <changefreq>' + freq + '</changefreq>\n    <priority>' + priority + '</priority>\n  </url>';
  const urls = [entry(site + '/', '1.0', 'monthly')].concat(
    SECTIONS.filter((s) => s.has(content)).map((s) => entry(site + '/' + s.slug, s.slug === 'projects' ? '0.9' : '0.7', 'monthly')));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
}

module.exports = async function handler(req, res) {
  const site = siteUrlFor(req);
  try {
    const { data, live, updatedAt } = await loadContent();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', live ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'public, s-maxage=60');
    res.end(buildSitemap(data, site, updatedAt));
  } catch (e) {
    res.statusCode = 500;
    res.end('Temporarily unavailable');
  }
};

module.exports.buildSitemap = buildSitemap;
