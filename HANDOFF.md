# FeedMe — Handoff

Low-FODMAP meal planner. Built with Next.js, Supabase, NextAuth, Claude API.

---

## Live app

**URL:** https://feedme-gules.vercel.app  
**GitHub:** https://github.com/benflowers91-cmd/feedme  
**Vercel project:** feedme (benflowers91-cmd's projects)

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.7, App Router, no `src/` dir |
| Auth | NextAuth v4, Google OAuth |
| Database | Supabase (Postgres) |
| AI | Anthropic SDK, claude-sonnet-4-6, prompt caching |
| Styles | Tailwind CSS 4 |
| Hosting | Vercel |

---

## Routes

| Path | Purpose |
|---|---|
| `/` | Home — today's meals, quick action tiles |
| `/pantry` | Add/remove ingredients with FODMAP status tags |
| `/suggest` | Claude generates 3 recipes from pantry contents |
| `/adapt` | Paste any recipe; Claude adapts it for low-FODMAP |
| `/plan` | Weekly meal planner — assign saved recipes to meal slots |
| `/shopping` | Shopping list — generate from plan or add manually |

Bottom navigation bar (fixed, mobile-first, 6 tabs).

---

## Project structure

```
app/
  layout.tsx          # Root layout, PWA metadata, bottom nav
  page.tsx            # Home
  pantry/page.tsx
  suggest/page.tsx
  adapt/page.tsx
  plan/page.tsx
  shopping/page.tsx
  api/
    auth/[...nextauth]/route.ts
    pantry/route.ts
    recipes/route.ts
    plan/route.ts
    shopping/route.ts
    suggest/route.ts
    adapt/route.ts
components/
  BottomNav.tsx
  Providers.tsx       # SessionProvider wrapper
  SignInPrompt.tsx
lib/
  auth.ts             # NextAuth config
  supabase.ts         # createServerClient() — service role, server-side only
  types.ts            # TypeScript types for all DB entities
  fodmap-prompt.ts    # Claude system prompt (cached)
schema.sql            # Run once in Supabase SQL editor
public/manifest.json  # PWA manifest
```

---

## Environment variables

Set in Vercel project settings (Settings → Environment Variables):

```
NEXTAUTH_URL=https://feedme-gules.vercel.app
NEXTAUTH_SECRET=<random string>
GOOGLE_CLIENT_ID=<from Google Console>
GOOGLE_CLIENT_SECRET=<from Google Console>
NEXT_PUBLIC_SUPABASE_URL=<from Supabase project settings>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase project settings>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase project settings — never expose to client>
ANTHROPIC_API_KEY=<from console.anthropic.com>
```

For local dev: copy these into `.env.local` (already gitignored).

---

## Database

Run `schema.sql` once in the Supabase SQL editor. Four tables:

- `pantry_items` — user's fridge/cupboard ingredients
- `recipes` — saved recipes (AI-generated or adapted); `is_saved=true` filter used on GET
- `meal_plan` — unique constraint on `(user_id, plan_date, meal_type)`; upsert on POST
- `shopping_items` — manual or plan-generated; `is_checked` toggled via PATCH

`user_id` in every table = session user email (from NextAuth).  
Supabase service role key bypasses RLS — all filtering is done manually in API routes.

---

## Auth

- NextAuth v4 Google provider
- No extra scopes (no Calendar, no Tasks)
- Session email used as `user_id` in all DB queries
- All API routes check `getServerSession(authOptions)` and return 401 if no session
- Google OAuth redirect URI: `https://feedme-gules.vercel.app/api/auth/callback/google`

---

## AI (Claude)

- Both `/api/suggest` and `/api/adapt` use `claude-sonnet-4-6`
- FODMAP system prompt is in `lib/fodmap-prompt.ts`, passed with `cache_control: { type: 'ephemeral' }` for prompt caching
- FODMAP profile: **moderate sensitivity** — flag triggers, don't be overly restrictive
- **Partner shellfish allergy** — never suggest shellfish under any circumstances
- Both routes return structured JSON only (instructions in the system prompt)

---

## Deploying changes

1. `git add <files> && git commit -m "..."` 
2. `git push origin main`
3. Vercel auto-deploys on push to main

---

## If you need to re-set up OAuth (e.g. new Vercel URL)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth client
2. Add new Authorized redirect URI: `https://<new-url>/api/auth/callback/google`
3. Update `NEXTAUTH_URL` in Vercel env vars to `https://<new-url>`
4. Redeploy

---

## What's complete

- [x] All 6 pages built and functional
- [x] All 7 API routes (auth, pantry, recipes, plan, shopping, suggest, adapt)
- [x] Supabase schema deployed
- [x] Google OAuth working
- [x] Deployed to Vercel (feedme-gules.vercel.app)
- [x] Clean build — 0 errors

## Not yet done

- [ ] No PWA install prompt / offline support (it's web-only for now)
- [ ] No recipe URL scraper for `/adapt` (paste-only)
- [ ] No FODMAP status auto-tagging when adding pantry items
- [ ] No push notifications for meal reminders
