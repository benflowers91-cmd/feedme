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
| AI | Anthropic SDK, claude-sonnet-4-6, prompt caching, tool_use for structured output |
| Search | Tavily API (web recipe search) |
| Styles | Tailwind CSS 4 |
| Tests | Vitest 4 |
| Hosting | Vercel |

---

## Routes

| Path | Nav tab | Purpose |
|---|---|---|
| `/` | — | Home — today's meals, quick action tiles (no nav tab) |
| `/pantry` | Pantry | Add/remove ingredients with FODMAP status tags |
| `/suggest` | Find | AI recipe suggestions from pantry + Tavily web search |
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
  suggest/page.tsx              # Find page — Claude suggestions + Tavily web search
  adapt/page.tsx                # 2-step: fetch/paste → substitution picker → save
  saved/page.tsx                # Saved recipes list with Add to plan
  plan/page.tsx
  shopping/page.tsx
  api/
    auth/[...nextauth]/route.ts
    pantry/route.ts             # GET/POST/DELETE pantry_items
    recipes/route.ts            # GET/POST/PATCH/DELETE recipes (is_saved=true; PATCH toggles is_favourite)
    scrape/route.ts             # POST — fetch URL, extract recipe via JSON-LD
    search/route.ts             # GET — Tavily web recipe search (?q=query)
    plan/route.ts               # GET/POST/DELETE meal_plan
    shopping/route.ts           # GET/POST/PATCH/DELETE shopping_items
    adapt/route.ts              # POST — Claude analysis with per-ingredient subs (tool_use)
    suggest/route.ts            # POST — Claude recipe suggestions from pantry (tool_use)
components/
  BottomNav.tsx
  Providers.tsx                 # SessionProvider wrapper
  SignInPrompt.tsx
lib/
  auth.ts                       # NextAuth config
  supabase.ts                   # createServerClient() — service role, server-side only
  types.ts                      # TypeScript types (incl. SubstitutionOption)
  fodmap-prompt.ts              # Claude system prompt (cached)
  scrape-utils.ts               # Pure JSON-LD extraction logic (also used in tests)
__tests__/
  api/adapt.test.ts             # Route smoke tests — auth, validation, Claude mock
  api/suggest.test.ts           # Route smoke tests — auth, Claude mock
  lib/scrape-utils.test.ts      # Pure extraction tests — no mocks, no network
schema.sql                      # Run once in Supabase SQL editor
public/manifest.json            # PWA manifest
SCOPE_RECIPE_SEARCH.md          # Tavily integration spec
SCOPE_SHOPPING_INTEGRATIONS.md  # Future shopping list share/export scope
```

---

## Environment variables

Set in Vercel project settings (Settings → Environment Variables).  
For local dev: copy into `.env.local` (already gitignored).

```
NEXTAUTH_URL=https://feedme-gules.vercel.app
NEXTAUTH_SECRET=<random string>
GOOGLE_CLIENT_ID=<from Google Console — OAuth>
GOOGLE_CLIENT_SECRET=<from Google Console — OAuth>
NEXT_PUBLIC_SUPABASE_URL=<from Supabase project settings>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase project settings>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase project settings — never expose to client>
ANTHROPIC_API_KEY=<from console.anthropic.com>
TAVILY_API_KEY=<from app.tavily.com — web recipe search>
```

---

## Database

Run `schema.sql` once in the Supabase SQL editor to create the tables. **If the database already exists**, apply schema changes as individual migrations (see below) — do not re-run the full schema.

### Tables
- `pantry_items` — user's fridge/cupboard ingredients
- `recipes` — saved recipes; `is_saved=true` filter on GET; `source_url` stores original recipe URL; `is_favourite` for tried-and-loved recipes
- `meal_plan` — unique constraint on `(user_id, plan_date, meal_type)`; upsert on POST
- `shopping_items` — manual or plan-generated; `is_checked` toggled via PATCH

`user_id` in every table = session user email (from NextAuth).  
Supabase service role key bypasses RLS — all filtering is done manually in API routes.

### Pending migrations

If picking up this project on a new machine or environment, run these in the Supabase SQL editor in order:

```sql
-- Add favourites support (run once if is_favourite column doesn't exist)
alter table recipes add column if not exists is_favourite boolean not null default false;
```

---

## Auth

- NextAuth v4 Google provider
- No extra scopes (no Calendar, no Tasks)
- Session email used as `user_id` in all DB queries
- All API routes check `getServerSession(authOptions)` and return 401 if no session
- Google OAuth redirect URI: `https://feedme-gules.vercel.app/api/auth/callback/google`

---

## AI (Claude)

Both Claude routes (`/api/adapt`, `/api/suggest`) use `tool_use` with a typed schema to force structured output — no text parsing or JSON cleanup. The FODMAP system prompt is cached via `cache_control: ephemeral`.

**`/api/adapt`**
- Model: `claude-sonnet-4-6`
- Returns per-ingredient analysis: `fodmap_status` + `substitution_options[]`
- User picks substitutions on the adapt page before saving
- Recipe text capped at 8,000 characters

**`/api/suggest`**
- Model: `claude-sonnet-4-6`
- Returns 3 complete FODMAP-safe recipes based on pantry items + optional preferences
- Recipes include full ingredients (with quantities) and step-by-step instructions
- Can be saved directly without going through the adapt flow

**FODMAP profile:** moderate sensitivity — flag triggers, don't be overly restrictive.  
**Partner shellfish allergy** — never suggest shellfish under any circumstances.

---

## URL scraper (`/api/scrape`)

- Fetches a recipe URL server-side, extracts recipe data from JSON-LD (`application/ld+json` with `@type: Recipe`)
- Pure extraction logic lives in `lib/scrape-utils.ts` (tested independently)
- Works on most major recipe sites (BBC Good Food, MOB, Ottolenghi, etc.)
- Does NOT work on JS-rendered sites (e.g. NYT Cooking) — returns a friendly 422 with "try pasting instead"
- 10-second timeout, 2MB page size limit

---

## Web search (`/api/search`)

- GET `/api/search?q=<query>` — calls Tavily, appends "recipe" to query, returns up to 8 results
- Results: `{ title, url, snippet, source }` — snippet is first 180 chars of Tavily content
- Requires `TAVILY_API_KEY` env var; returns 503 "Search not configured" if missing (graceful degradation)
- Free tier: 1,000 searches/month at basic depth — sufficient for personal use
- See `SCOPE_RECIPE_SEARCH.md` for full integration spec

---

## Find page — two sections

**AI suggestions (top):** Auto-loads on page mount using pantry items. Claude generates 3 complete FODMAP-safe recipes. Preferences input ("quick and easy", "Italian") and Refresh button. Results can be saved directly to the recipe library.

**Web search (bottom):** User-triggered Tavily search. Finds real recipe pages from the web. Each result has a "Fetch & Adapt" button that sends the URL to `/adapt?url=...` — the adapt flow scrapes and analyses the recipe.

---

## Adapt page flow

1. User arrives (possibly with `?url=` pre-filled from Find page "Fetch & Adapt" button)
2. Enter URL → "Fetch" → recipe text auto-populates the textarea
3. Click "Analyse for FODMAP" → Claude returns ingredient-by-ingredient analysis
4. For each `avoid`/`moderate` ingredient: substitution chips appear (pre-selected to first option)
5. User picks preferred substitute or "Keep original" for each
6. "Save adapted recipe" → constructs final ingredients with chosen subs → saves to Supabase

---

## Tests

```bash
npm test          # run all tests once (used in CI/pre-deploy checks)
npm run test:watch  # watch mode for development
```

25 tests across 3 files. All tests mock external services (Claude, NextAuth) — no network calls, no API spend.

| File | What it covers |
|---|---|
| `__tests__/lib/scrape-utils.test.ts` | JSON-LD extraction: nested recipes, @graph, string vs array instructions, edge cases |
| `__tests__/api/adapt.test.ts` | Auth (401), validation (400), success path with mocked Claude, unexpected Claude response |
| `__tests__/api/suggest.test.ts` | Auth (401), success with pantry items, success with empty pantry |

---

## Deploying changes

1. `git add <files> && git commit -m "..."`
2. `git push origin main`
3. Vercel auto-deploys on push to main
4. If new env vars were added: Vercel → Settings → Environment Variables → add → **Redeploy manually** (Vercel does not redeploy automatically when env vars change)

---

## If you need to re-set up OAuth (e.g. new Vercel URL)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth client
2. Add new Authorized redirect URI: `https://<new-url>/api/auth/callback/google`
3. Update `NEXTAUTH_URL` in Vercel env vars to `https://<new-url>`
4. Redeploy

---

## What's complete

- [x] All 7 pages built and working
- [x] Google OAuth, Supabase, Vercel deployment
- [x] Adapt page: URL scraper + interactive per-ingredient substitution picker
- [x] Find page: Claude suggestions from pantry + Tavily web recipe search
- [x] Saved recipes with Add to plan modal and favourites (heart toggle + filter)
- [x] Weekly meal planner with navigation
- [x] Shopping list: generate from plan, manual add, check off, clear
- [x] Claude routes use tool_use — structured output, no JSON parsing
- [x] Error handling on all mutations (non-optimistic, inline error messages)
- [x] Timezone bug fixed on home, plan, shopping pages
- [x] 25 Vitest smoke tests — scrape utils, adapt route, suggest route

## Known gaps / not yet done

- [ ] No PWA install prompt / offline support
- [ ] No FODMAP status auto-tagging when adding pantry items (must select manually)
- [ ] No push notifications for meal reminders
- [ ] Shopping list: no copy/share to notes app (see SCOPE_SHOPPING_INTEGRATIONS.md)
- [ ] No recipe edit — must delete and re-adapt to change a saved recipe
- [ ] Supabase has no RLS policies — safe for personal use, would need RLS before sharing with other users
