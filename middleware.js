/* Routing middleware: send known search and link-preview crawlers to the complete text version of the
   portfolio (api/seo.js), for "/" and for each section address. Everyone else passes straight through to the
   normal site. Runs before static files, which is why this is not a vercel.json rewrite (a real index.html at "/"
   would win over a rewrite). */
const SECTIONS = ['projects', 'skills', 'certifications', 'experience', 'recommendations', 'hobbies', 'contact'];

// Vercel reads this statically at build time: it must stay a plain literal (no calls such as .map or .concat).
export const config = { matcher: ['/', '/projects', '/skills', '/certifications', '/experience', '/recommendations', '/hobbies', '/contact'] };

const BOTS = /googlebot|google-inspectiontool|googleother|storebot-google|bingbot|bingpreview|msnbot|duckduckbot|baiduspider|yandex|slurp|applebot|facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|slack-imgproxy|discordbot|pinterest|embedly|redditbot|skypeuripreview|vkshare|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|claude-user|claude-searchbot|anthropic-ai|perplexitybot|perplexity-user|ccbot|bytespider|amazonbot|petalbot|cohere-ai|youbot/i;

export default function middleware(request) {
  try {
    if (BOTS.test(request.headers.get('user-agent') || '')) {
      const target = new URL('/api/seo', request.url);
      const slug = new URL(request.url).pathname.replace(/^\/+|\/+$/g, '');
      if (SECTIONS.indexOf(slug) !== -1) target.searchParams.set('section', slug);
      return new Response(null, { headers: { 'x-middleware-rewrite': target.toString() } });
    }
  } catch (e) { /* never block a visitor */ }
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}
