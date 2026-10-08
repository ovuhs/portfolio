// Google Search Console ownership check. It is served from a function (not a static file) because
// cleanUrls would redirect /googlec229be52c8fbbeca.html to /googlec229be52c8fbbeca, and Google wants the exact address.
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.statusCode = 200;
  res.end('google-site-verification: googlec229be52c8fbbeca.html');
};
