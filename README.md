# Ground Truth Estimator

A first-principles cost estimator for Australian civil infrastructure projects,
now a real multi-user product: sign-up/login, a shared rate library per
company, unlimited projects, an itemised risk register, and a live
weather/climate risk lookup.

Stack: **Next.js 14** (App Router) + **Supabase** (Postgres + Auth) + **Vercel** (hosting).

---

## Before you start

This project was written in an environment with no access to the npm
registry, so `npm install` has **not** been run here and the app has not
been built or started locally yet. The code is complete and was
syntax-checked with the TypeScript compiler, but the very first `npm
install` you (or Vercel) run is also the first real compile. If that
throws an error, paste it back to me and I'll fix it — nothing here has
been guessed at a shape level, but a stray typo is always possible in a
project this size written without a live build loop.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), sign up (free), and create a new project.
   Pick a region close to your users (e.g. Sydney).
2. Once it's provisioned, open **SQL Editor** in the left sidebar → **New query**.
3. Paste in the entire contents of `supabase/schema.sql` from this project and click **Run**.
   This creates every table, security policy, and the trigger that gives each new
   signup their own workspace and starter rate library.
4. Go to **Authentication → Providers → Email** and confirm Email is enabled.
   For the fastest way to try this yourself, you can turn **off** "Confirm email"
   under **Authentication → Settings** while testing — turn it back on before
   giving real customers accounts.
5. Go to **Project Settings → API**. You'll need two values from this page in a moment:
   **Project URL** and the **anon public** key.

## 2. Run it locally (optional, but recommended before deploying)

```bash
npm install
cp .env.local.example .env.local
# edit .env.local and paste in your Supabase Project URL + anon key
npm run dev
```

Open http://localhost:3000, sign up, and you should land on an empty dashboard
with a pre-seeded rate library. Click **Load example project** to see the full
estimator working end to end.

## 3. Deploy to Vercel

1. Push this project to a new GitHub repository (Vercel deploys from git).
2. Go to [vercel.com](https://vercel.com), sign up (free), and **Add New → Project**,
   then import that GitHub repo.
3. In the import screen, expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon public key
4. Click **Deploy**. Vercel installs dependencies and builds the app on its own
   infrastructure — this is the first place the project will actually be
   compiled and run, since it wasn't possible in the sandbox that wrote it.
5. Once it's live, go to **Authentication → URL Configuration** in Supabase and
   add your new `https://your-app.vercel.app` URL as a **Redirect URL** (needed
   for the email confirmation link to come back to the right place).

## 4. Point your own domain at it

1. In your Vercel project, go to **Settings → Domains** and add the domain you
   registered (e.g. `groundtruthestimator.com.au`).
2. Vercel gives you either an A record or CNAME to add at your domain
   registrar (GoDaddy: **DNS Management** on the domain). Add it there.
3. Vercel issues an HTTPS certificate automatically once DNS propagates
   (usually minutes, occasionally longer).
4. Add the final domain to Supabase's **Redirect URLs** too (step 3.5 above),
   alongside the vercel.app one.

## What's actually built

- **Auth** — email/password signup and login (`app/login`, `app/signup`),
  session refresh via `middleware.ts`, protected routes.
- **Multi-tenancy** — every signup gets its own `organizations` row; all data
  (rates, projects, categories, line items, risks) is scoped to that
  organization via Postgres Row Level Security, so one company can never see
  another's data. See `supabase/schema.sql`.
- **Rate Library** (`app/dashboard/rates`) — shared labour/plant/material
  rates for the whole company, editable inline, seeded with indicative
  Australian civil rates on signup. **These are placeholders — replace them
  with your own supplier and subcontractor pricing.**
- **Projects & Estimate** (`app/dashboard/projects/[id]`) — the original
  first-principles calculator (Earthworks, Roads & Pavements, Drainage,
  Structures), now backed by a real database instead of browser storage.
- **Risk & Location** — an itemised risk register (probability × cost impact,
  expected-value method) plus a weather-risk lookup backed by
  [Open-Meteo](https://open-meteo.com) (free, no API key): it geocodes the
  project location, pulls 5 years of historical daily climate data, and
  surfaces the wettest months, average hot days, and a rule-of-thumb tropical
  cyclone season flag (latitude-based — always cross-check the live Bureau of
  Meteorology outlook, this is a planning heuristic, not a forecast).
- **Summary** — the full cost cascade: Direct cost → Preliminaries → Risk
  allowance (from the register) → Contingency → Overhead → Margin → subtotal
  ex GST → GST → **Contract price** (what you'd tender), then
  **Principal's administrative cost** added separately to produce the
  **Total project cost** — since that line is the client's own cost, not
  part of your price.

## Known limitations / good next steps

- **No multi-member invites yet.** The schema supports more than one user per
  organization (`org_members`), but there's no UI to invite a teammate —
  today, whoever signs up first is the only member. Worth adding before
  giving this to a whole team.
- **No password reset flow.** Supabase supports it; a "forgot password" page
  just hasn't been built yet.
- **Weather lookup calls Open-Meteo on every click**, with no caching. Fine
  for personal/small-team use; add a cache (e.g. a `weather_cache` table
  keyed by rounded lat/lon) if this gets heavy use.
- **No billing.** If you want this to be a paid product, Stripe + Vercel has
  a well-trodden integration path — ask me when you're ready for it.
