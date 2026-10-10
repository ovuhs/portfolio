# Shuvo Ibn Alam · Portfolio

Personal portfolio website for Shuvo Ibn Alam, Senior Data Analyst.

## Features

- **Live Site**: `index.html` (interactive portfolio with dark/light mode, project showreel, animations)
- **Real addresses**: each section has its own URL (`/projects`, `/skills`, `/certifications`, `/experience`, `/recommendations`, `/reviews`, `/hobbies`, `/contact`). Old `/#projects` style links still work.
- **Search and link previews**: crawlers that do not run JavaScript (LinkedIn, WhatsApp, Bing, AI assistants) receive a complete text version of each page (`api/seo.js`, routed by `middleware.js`). `/sitemap.xml` is generated from the live content (`api/sitemap.js`).
- **Admin Panel**: `/admin` (in-browser content editor with Supabase integration). It also holds the **Messages** inbox (contact form), **Analytics**, and **Settings -> Version history** (automatic copies, restore points, one-click restore).
- **Contact form**: visitors can message you from `/contact`; messages are saved in Supabase and read in the admin.
- **Privacy note**: footer link on `/contact`, with an opt-out from visit counting.
- **Security headers**: set in `vercel.json` (Content-Security-Policy and others). If you add a new outside service (scripts, fonts, APIs, video hosts), allow it there or the browser will block it.
- **Configuration**: `config.js` and `content.js`
- **Setup Guide**: See `SETUP.md` for full instructions on Supabase & deployment.

## Run it locally

```
node scripts/dev-server.js
```

Open http://localhost:5173. This behaves like the Vercel deployment: section addresses work, crawlers get the text version
(try `curl -A "LinkedInBot/1.0" http://localhost:5173/projects`), and `/sitemap.xml` is served.

## One-time Supabase setup files

Run these in Supabase -> SQL Editor (each is safe to run again; the admin can also copy them for you):

- `supabase/site_activities.sql`: visitor analytics
- `supabase/contact_messages.sql`: contact form inbox
- `supabase/site_content_history.sql`: version history

Details are in `SETUP.md`.

## Hosting notes

The routing (`vercel.json`, `middleware.js`, `api/`) is written for Vercel. On another host you need two things:
every section address above must serve `index.html`, and `/sitemap.xml` is only available where the `api/` functions run.
Without the first, a direct visit to `/projects` shows a "not found" page (the site itself still works from `/`).

## Before and after you push

```
node scripts/preflight.js       # catches config mistakes that would fail the Vercel build
node scripts/deploy-status.js   # waits for Vercel's result for the latest commit (exit 0 = deployed)
```
