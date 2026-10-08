# Shuvo Ibn Alam · Portfolio

Upload everything in this folder to any static host (Netlify, Vercel, GitHub Pages, cPanel…).

- Site: `https://your-domain/`
- Admin: `https://your-domain/admin/`

## 1. Before going live
1. In `index.html`, replace `YOUR-DOMAIN` (2 places) with your real domain so LinkedIn/WhatsApp show the preview image.
2. Upload the folder. The site works immediately in **local mode**:
   admin edits save in your browser only; publish them with *Admin → Settings → Download content.js* and replace `content.js` on your host.
   Local-mode default password is `admin` — change it right away (Settings).

## 2. Connect Supabase (edits go live instantly)
1. Create a free project at https://supabase.com.
2. **Authentication → Users → Add user**: create your admin account (email + password). Then **Authentication → Sign In / Providers → turn off "Allow new users to sign up"**.
3. **SQL Editor → New query**, paste this, replace `you@example.com` with your admin email (3 places), run:

```sql
create table if not exists site_content (
  id int primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table site_content enable row level security;

create policy "public can read" on site_content
  for select using (true);
create policy "admin can write" on site_content
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'you@example.com')
  with check ((auth.jwt() ->> 'email') = 'you@example.com');

insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;
create policy "public can view media" on storage.objects
  for select using (bucket_id = 'media');
create policy "admin can upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (auth.jwt() ->> 'email') = 'you@example.com');
```

4. **Project Settings → API**: copy the *Project URL* and the *anon public* key into `config.js`, upload it.
5. Open `/admin/`, sign in with the account from step 2, and click any field once so your current content is saved to the database.
6. **Visitor analytics (needed to count visits):** SQL Editor → New query, paste the contents of `supabase/site_activities.sql`, run. It creates the `site_activities` table and its access rules, and is safe to run again. Without it, visits are not saved and the admin Analytics page can only show activity from your own browser. The admin Analytics page shows a setup banner with a *Copy setup SQL* button if the table is missing.

   Your own visits are not counted: tracking is skipped on localhost, for bots, and in any browser where you have signed in to the admin (switch it with *Counting my visits* on the Analytics page).

The anon key is meant to be public. Only your email can change content, enforced by the database rules above, not by the browser.

## 3. Google Analytics (optional)
Create a GA4 property at https://analytics.google.com, copy the Measurement ID (`G-…`), paste it in *Admin → Settings → Google Analytics*.

## 3b. Contact form (optional)

The Contact page has a "Send me a message" form. Messages are saved in your Supabase project and appear in the admin under **Messages**.

1. Admin -> Messages -> **Copy the setup SQL** (or open `supabase/contact_messages.sql`).
2. Supabase -> SQL Editor -> New query -> paste -> Run. It is safe to run again.

Visitors can only add messages; only you (signed in) can read, mark or delete them. Spam is limited by a hidden field, a minimum fill time, a one-minute pause per browser and length limits in the table. You are not emailed automatically; check the Messages tab (the unread count shows next to it).

## Security notes
- Local mode password is hashed and locks for 1 minute after 5 wrong tries, but it only protects your own browser's draft. Real protection comes from Supabase.
- Your phone number is no longer shown publicly.
- `robots.txt` keeps search engines out of `/admin/`.
