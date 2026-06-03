# FeedMe — Handoff

Low-FODMAP meal planner. Built with Next.js, Supabase, NextAuth, Claude API, Google Custom Search.

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
| Recipe search | Google Custom Search API (Programmable Search Engine) |
| Styles | Tailwind CSS 4 |
| Hosting | Vercel |

---

## Routes

| Path | Nav tab | Purpose |
|---|---|---|
| `/` | — | Home — today's meals, quick action tiles (no nav tab) |
| `/pantry` | Pantry | Add/remove ingredients with FODMAP status tags |
| `/suggest` | Find | Search real recipes from trusted sites by pantry ingredients |
| `/adapt` | Adapt | Fetch from URL or paste text; pick per-ingredient FODMAP substitutions before saving |
| `/saved` | Saved | Browse all saved recipes; add to meal plan or delete |
| `/plan` | Plan | Weekly meal planner — assign saved recipes to meal slots |
| `/shopping` | Shop | Shopping list — generate from plan or add manually |

Bottom navigation bar (fixed, mobile-first, 6 tabs): Pantry → Find → Adapt → Saved → Plan → Shop.

---

## Project structure

```
app/
  layout.tsx                    # Root layout, PWA metadata, bottom nav
  page.tsx                      # Home (no nav tab)
  pantry/page.tsx
  suggest/page.tsx              # Find page — real recipe search
  adapt/page.tsx                # 2-step: fetch/paste → substitution picker → save
  saved/page.tsx                # Saved recipes list with Add to plan
  plan/page.tsx
  shopping/page.tsx
  api/
    auth/[...nextauth]/route.ts
    pantry/route.ts             # GET/POST/DELETE pantry_items
    recipes/route.ts            # GET/POST/DELETE recipes (is_saved=true)
    recipes/search/route.ts     # GET — Google Custom Search for recipes
    scrape/route.ts             # POST — fetch URL, extract recipe via JSON-LD
    plan/route.ts               # GET/POST/DELETE meal_plan
    shopping/route.ts           # GET/POST/PATCH/DELETE shopping_items
    adapt/route.ts              # POST — Claude analysis with per-ingredient subs
    suggest/route.ts            # POST — legacy Claude suggestions (superseded by /find)
components/
  BottomNav.tsx
  Providers.tsx                 # SessionProvider wrapper
  SignInPrompt.tsx
lib/
  auth.ts                       # NextAuth config
  supabase.ts                   # createServerClient() — service role, server-side only
  types.ts                      # TypeScript types (incl. SubstitutionOption)
  fodmap-prompt.ts              # Claude system prompt (cached)
schema.sql                      # Run once in Supabase SQL editor
public/manifest.json            # PWA manifest
```

---

## Environment variables

Set in Vercel project settings (Settings → Environment Variables):

```
NEXTAUTH_URL=https://feedme-gules.vercel.app
NEXTAUTH_SECRET=<random string>
GOOGLE_CLIENT_ID=<from Google Console — OAuth>
GOOGLE_CLIENT_SECRET=<from Google Console — OAuth>
NEXT_PUBLIC_SUPABASE_URL=<from Supabase project settings>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase project settings>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase project settings — never expose to client>
ANTHROPIC_API_KEY=<from console.anthropic.com>
GOOGLE_SEARCH_API_KEY=<from Google Cloud Console — Custom Search API>
GOOGLE_SEARCH_ENGINE_ID=<from programmablesearchengine.google.com — the cx value>
```

For local dev: copy these into `.env.local` (already gitignored).

---

## Database

Run `schema.sql` once in the Supabase SQL editor. Four tables:

- `pantry_items` — user's fridge/cupboard ingredients
- `recipes` — saved recipes; `is_saved=true` filter on GET; `source_url` stores original recipe URL
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

- `/api/adapt` uses `claude-sonnet-4-6` with prompt caching on the FODMAP system prompt
- Returns per-ingredient analysis: `fodmap_status` + `substitution_options[]` for problematic ingredients
- User picks which substitutions to apply on the adapt page before saving
- FODMAP profile: **moderate sensitivity** — flag triggers, don't be overly restrictive
- **Partner shellfish allergy** — never suggest shellfish under any circumstances

---

## Recipe search (Google Custom Search)

- `/api/recipes/search` calls the Google Custom Search JSON API
- Search engine is restricted to trusted sites: BBC Good Food, MOB Kitchen, Ottolenghi, delicious., Olive, Jamie Oliver, Nigella, Serious Eats
- Free tier: 100 queries/day. Each search = 1 query.
- To add/remove trusted sites: update the Programmable Search Engine at programmablesearchengine.google.com (no code change needed)
- The trusted sites list is also hardcoded in `/app/api/recipes/search/route.ts` for display names

### Setting up Google Custom Search (one-time)
1. Go to [programmablesearchengine.google.com](https://programmablesearchengine.google.com) → Create search engine
2. Add trusted domains (e.g. `bbcgoodfood.com`, `mobkitchen.co.uk`, `ottolenghi.co.uk`)
3. Copy the **Search engine ID** (`cx` value)
4. In the same Google Cloud project as OAuth: APIs & Services → enable **Custom Search API**
5. Add `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` to Vercel env vars

---

## URL scraper (`/api/scrape`)

- Fetches a recipe URL server-side, extracts recipe data from JSON-LD (`application/ld+json` with `@type: Recipe`)
- Works on most major recipe sites (BBC Good Food, MOB, Ottolenghi, etc.) — they all include schema.org Recipe markup
- Does NOT work on JS-rendered sites (e.g. NYT Cooking) — returns a friendly 422 with "try pasting instead"
- No external API or npm dependencies — pure fetch + JSON parsing

---

## Adapt page flow

1. User arrives (possibly with `?url=` pre-filled from Find page "Fetch & Adapt" button)
2. Enter URL → "Fetch" → recipe text auto-populates the textarea
3. Click "Analyse for FODMAP" → Claude returns ingredient-by-ingredient analysis
4. For each `avoid`/`moderate` ingredient: substitution chips appear (pre-selected to first option)
5. User picks preferred substitute or "Keep original" for each
6. "Save adapted recipe" → constructs final ingredients with chosen subs → saves to Supabase

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

- [x] All 7 pages built and functional
- [x] All 9 API routes (auth, pantry, recipes, recipes/search, scrape, plan, shopping, adapt, suggest)
- [x] Supabase schema deployed
- [x] Google OAuth working
- [x] Deployed to Vercel (feedme-gules.vercel.app)
- [x] Clean build — 0 errors
- [x] Adapt page: URL scraper + interactive per-ingredient substitution picker
- [x] Find page: real recipes from trusted sites (needs GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID set)
- [x] Saved recipes tab with Add to plan modal

## Not yet done

- [ ] Google Search env vars not yet set in Vercel (Find page returns "not configured" until done)
- [ ] No PWA install prompt / offline support (web-only)
- [ ] No FODMAP status auto-tagging when adding pantry items
- [ ] No push notifications for meal reminders
