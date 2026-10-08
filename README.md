# Shuvo Ibn Alam · Portfolio

Personal portfolio website for Shuvo Ibn Alam, Senior Data Analyst.

## Features

- **Live Site**: `index.html` (interactive portfolio with dark/light mode, project showreel, animations)
- **Real addresses**: each section has its own URL (`/projects`, `/skills`, `/certifications`, `/experience`, `/recommendations`, `/hobbies`, `/contact`). Old `/#projects` style links still work.
- **Search and link previews**: crawlers that do not run JavaScript (LinkedIn, WhatsApp, Bing, AI assistants) receive a complete text version of each page (`api/seo.js`, routed by `middleware.js`). `/sitemap.xml` is generated from the live content (`api/sitemap.js`).
- **Admin Panel**: `/admin` (in-browser content editor with Supabase integration)
- **Configuration**: `config.js` and `content.js`
- **Setup Guide**: See `SETUP.md` for full instructions on Supabase & deployment.

## Run it locally

```
node scripts/dev-server.js
```

Open http://localhost:5173. This behaves like the Vercel deployment: section addresses work, crawlers get the text version
(try `curl -A "LinkedInBot/1.0" http://localhost:5173/projects`), and `/sitemap.xml` is served.

## Hosting notes

The routing (`vercel.json`, `middleware.js`, `api/`) is written for Vercel. On another host you need two things:
every section address above must serve `index.html`, and `/sitemap.xml` is only available where the `api/` functions run.
Without the first, a direct visit to `/projects` shows a "not found" page (the site itself still works from `/`).
