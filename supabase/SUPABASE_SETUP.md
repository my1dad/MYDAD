# Supabase Cloud Sync — My Dollar A Day

This app syncs all workspace data to Supabase so members and admins see the same profiles, pool state, contributions, wallet data, and community content from any device.

**Project URL:** `https://payamrkwesnejaruenhm.supabase.co`

## 1. Run the database schema

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Paste and run the full contents of [`schema.sql`](./schema.sql)
3. Enable **Realtime** for these tables:  
   **Database → Replication** (or Publications) → add `dad_bins`, `dad_profiles`, `dad_kv`

## 2. Get API keys

1. **Project Settings → API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

## 3. Local development

Add to `.env` in the project root:

```env
VITE_SUPABASE_URL=https://payamrkwesnejaruenhm.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
MASSIVE_API_KEY=your_massive_key_if_used
```

Restart the dev server after changing env vars.

## 4. Vercel (`my1dad`)

1. Import/connect the GitHub repo `my1dad`
2. **Project Settings → Environment Variables** — add for **Production** and **Preview**:
   - `VITE_SUPABASE_URL` = `https://payamrkwesnejaruenhm.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (anon key from Supabase)
   - `MASSIVE_API_KEY` = (if using live stock quotes)
3. Redeploy after saving env vars

## What syncs to the cloud

| Data | Supabase table | Who sees it |
|------|----------------|-------------|
| Members, contributions, pool, settings bins, community, admin captures | `dad_bins` | Shared workspace — master admin sees **all** |
| Login profiles (every member + admin) | `dad_profiles` | Shared worldwide — any device can log in |
| App settings, notifications read state, DM read state, locale | `dad_kv` | Shared workspace defaults |

**Worldwide login:** when a member creates an account or signs in from any device, their profile is stored in `dad_profiles`. The next device pulls that directory on startup (and every ~45s / via Realtime).

**Master admin visibility:** the admin Members page and detail modals read from the shared profile directory + shared bins (contributions, wallets in settings, community posts, activity). After cloud sync, every member’s created data is visible to master admin.

## GitHub

Push this repo to `github.com/your-org/my1dad`. Vercel will build from the connected branch.

## Security note

Current RLS policies allow the anon key to read/write workspace data (shared community model). Before public launch, consider migrating to **Supabase Auth** and tightening RLS per user.
