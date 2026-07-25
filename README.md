# Greenroom — AI Interview Prep (demo)

## Run it

```
npm install
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

## Setting up sign in

1. Create a free project at https://supabase.com
2. Project Settings > API — copy the **Project URL** and the **anon public** key
3. Paste them into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. In Supabase, open **SQL Editor > New query**, paste the contents of
   `supabase/schema.sql`, and run it. This creates the two tables the app
   needs (`user_settings`, `practice_sessions`) with row-level security so
   each person can only see their own data.
5. Restart `npm run dev`
6. For quick local testing, go to Authentication > Settings in Supabase and turn
   off "Confirm email" so new sign-ups don't need to click an email link. Leave
   it on for anything real.

Without the two env vars set, the app shows a setup screen instead of the
sign-in form — it won't silently let anyone in.

## Getting a Groq API key

Claude can't hand you a working key — Groq keys are tied to a personal
account, so you'll need to grab your own (it takes under a minute and is
free):

1. Go to https://console.groq.com and sign in
2. Left sidebar > **API Keys** > **Create API Key**
3. Copy it (it's only shown once)
4. In the app: sign in, click **Settings**, paste it into "Groq API key," **Save**

Once Supabase is set up, that key is saved to your account (scoped to only
you by row-level security) so you won't need to re-enter it next time you
sign in. Without Supabase configured, it just lives in memory for the
session instead.

## A note on CORS

This demo calls Groq directly from the browser. If your key saves but
requests fail with a network error, that's Groq's API declining a direct
browser call from this origin, not a bad key. The fix is routing the
request through a small backend (Node + Express) instead. Ask for the
full codebase version if you want that wired up, along with real PDF
export and email sending.
