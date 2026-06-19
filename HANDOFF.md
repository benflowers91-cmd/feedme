# FeedMe — Handoff

Low-FODMAP meal planner. Built with Next.js, Supabase, NextAuth, Claude API, Tavily.

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
| AI | Anthropic SDK, Claude (Sonnet for suggest/pantry scan, Haiku for adapt/tag/consolidate/pantry-search), prompt caching, tool_use for structured output |
| Search | Tavily API (web recipe search) |
| Styles | Tailwind CSS 4 |
| Tests | Vitest 4 |
| Hosting | Vercel |

---

## Pages

| Path | Nav tab | Purpose |
|---|---|---|
| `/` | — | Home — today's meals, quick action tiles (no nav tab) |
| `/pantry` | Pantry | Add/remove ingredients with FODMAP status tags; photo scan |
| `/suggest` | Find | AI recipe suggestions from pantry + Tavily web search + "Use what I have" mode |
| `/adapt` | Adapt | Fetch from URL or paste text; pick per-ingredient FODMAP substitutions before saving |
| `/saved` | Saved | Browse all saved recipes; favourite toggle, tag filter, auto-tag button, add to meal plan |
| `/plan` | Plan | Weekly meal planner — assign saved recipes to meal slots |
| `/shopping` | Shop | Shopping list — generate from plan, consolidate with Claude, add manually, check off |

Bottom navigation bar (fixed, mobile-first, 6 tabs): Pantry → Find → Adapt → Saved → Plan → Shop.

---

## Project structure

```
app/
  layout.tsx                    # Root layout, PWA metadata, bottom nav
  page.tsx                      # Home (today's meals + quick action tiles)
  pantry/page.tsx               # Pantry CRUD + photo scan
  suggest/page.tsx              # Find — Claude suggestions + Tavily web search + "Use what I have"
  adapt/page.tsx                # 2-step: fetch/paste → substitution picker → save
  saved/page.tsx                # Saved recipes list — filter, tag, add to plan, delete
  plan/page.tsx                 # Weekly calendar — assign recipes to meal slots
  shopping/page.tsx             # Shopping list — generate, consolidate, check off
  api/
    auth/[...nextauth]/route.ts  # NextAuth Google OAuth
    pantry/route.ts              # GET/POST/DELETE pantry_items
    pantry/analyze/route.ts      # POST — Claude vision identifies food items from photo
    pantry-search/route.ts       # POST — Claude generates queries from pantry → 2× Tavily search
    recipes/route.ts             # GET/POST/PATCH/DELETE recipes (is_saved=true; PATCH toggles is_favourite/tags)
    recipes/tag/route.ts         # POST — Claude auto-tags untagged recipes (meal_type, cuisine, effort)
    scrape/route.ts              # POST — fetch URL, extract recipe via JSON-LD
    search/route.ts              # GET — Tavily web recipe search (?q=query)
    plan/route.ts                # GET/POST/DELETE meal_plan
    shopping/route.ts            # GET/POST/PATCH/DELETE shopping_items (single or bulk POST)
    shopping/consolidate/route.ts # POST — Claude merges similar items, flags pantry cross-references
    adapt/route.ts               # POST — Claude per-ingredient FODMAP analysis (tool_use)
    suggest/route.ts             # POST — Claude generates 3 FODMAP-safe recipes from pantry (tool_use)
components/
  BottomNav.tsx                  # Fixed 6-tab navigation bar
  Providers.tsx                  # NextAuth SessionProvider wrapper
  SignInPrompt.tsx               # Google OAuth sign-in UI
  ServiceWorkerRegistration.tsx  # Registers /public/sw.js on mount
lib/
  auth.ts                        # NextAuth config
  supabase.ts                    # createServerClient() — service role, server-side only
  types.ts                       # TypeScript types (PantryItem, RecipeIngredient, SubstitutionOption, etc.)
  fodmap-prompt.ts               # Claude system prompt (cached via cache_control: ephemeral)
  scrape-utils.ts                # Pure JSON-LD extraction logic (also tested independently)
__tests__/
  api/adapt.test.ts              # Route smoke tests — auth, validation, Claude mock
  api/suggest.test.ts            # Route smoke tests — auth, Claude mock
  lib/scrape-utils.test.ts       # Pure extraction tests — no mocks, no network
schema.sql                       # Run once in Supabase SQL editor
public/
  manifest.json                  # PWA manifest
  sw.js                          # Service worker (cache-first for static assets)
  icons/                         # PWA icons
SCOPE_RECIPE_SEARCH.md           # Tavily integration spec
SCOPE_SHOPPING_INTEGRATIONS.md   # Future shopping list share/export scope
TODO.md                          # Open tasks and known bugs
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

Run `schema.sql` once in the Supabase SQL editor to create the tables. **If the database already exists**, apply schema changes as individual migrations — do not re-run the full schema.

### Tables

**`pantry_items`** — user's fridge/cupboard ingredients
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id text NOT NULL                          -- session email
name text NOT NULL
fodmap_status text NOT NULL DEFAULT 'unknown'  -- 'safe' | 'moderate' | 'avoid' | 'unknown'
quantity text
updated_at timestamptz NOT NULL DEFAULT now()
```

**`recipes`** — saved recipes
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id text NOT NULL
title text NOT NULL
ingredients jsonb    -- [{ name, amount, unit, fodmap_status }]
instructions text    -- full recipe text (raw paste or scraped text, not AI-extracted steps)
source_url text      -- original recipe URL if scraped
fodmap_notes text    -- Claude's FODMAP summary from adapt route
is_saved boolean NOT NULL DEFAULT false
is_favourite boolean NOT NULL DEFAULT false
tags text[]          -- auto-tagged: ['breakfast', 'Italian', 'quick'] etc.
created_at timestamptz NOT NULL DEFAULT now()
```

**`meal_plan`** — weekly calendar entries
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id text NOT NULL
plan_date date NOT NULL
meal_type text NOT NULL            -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL
recipe_title text                  -- denormalised for display without JOIN
notes text
UNIQUE (user_id, plan_date, meal_type)  -- upsert on POST
```

**`shopping_items`** — shopping list
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id text NOT NULL
name text NOT NULL
quantity text
is_checked boolean NOT NULL DEFAULT false
source_recipe_id uuid
created_at timestamptz NOT NULL DEFAULT now()
```

### Pending migrations

Run these in the Supabase SQL editor if picking up on a fresh environment:

```sql
-- Add favourites support (run once if column doesn't exist)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_favourite boolean NOT NULL DEFAULT false;
```

### Notes

- `user_id` in every table = session user email (from NextAuth).
- Supabase service role key bypasses RLS — all row filtering is done manually in API routes.
- No RLS policies are set. Safe for personal use; would need RLS before multi-user deployment.

---

## Auth

- NextAuth v4 Google provider.
- No extra OAuth scopes (no Calendar, no Tasks).
- Session email used as `user_id` in all DB queries.
- All API routes check `getServerSession(authOptions)` and return 401 if no session.
- Google OAuth redirect URI: `https://feedme-gules.vercel.app/api/auth/callback/google`

---

## AI (Claude)

All Claude routes use `tool_use` with a typed schema to force structured JSON output — no text parsing or regex cleanup. The FODMAP system prompt is cached via `cache_control: ephemeral` to save tokens on repeated calls.

**FODMAP profile:** moderate sensitivity — flag triggers, don't be overly restrictive.  
**Shellfish allergy** — never suggest shellfish under any circumstances.

### Routes using Claude

| Route | Model | What it does |
|---|---|---|
| `/api/adapt` | Haiku 4.5 | Per-ingredient FODMAP analysis; returns `fodmap_status` + `substitution_options[]` for each ingredient. Recipe text capped at 8,000 chars. max_tokens: 2000. |
| `/api/suggest` | Sonnet 4.6 | Generates 3 complete FODMAP-safe recipes from pantry items + optional preferences. Full ingredients (with quantities) and step-by-step instructions. max_tokens: 2500. |
| `/api/pantry/analyze` | Sonnet 4.6 | Vision: identifies food items from a photo. Returns list of `{ name, quantity, fodmap_status }`. Accepts JPEG/PNG/GIF/WebP up to 10MB. |
| `/api/pantry-search` | Haiku 4.5 | Generates 2 recipe search query strings from top pantry items, calls Tavily twice, deduplicates by URL. |
| `/api/recipes/tag` | Haiku 4.5 | Auto-tags untagged recipes: `meal_type` (breakfast/lunch/dinner/snack), `cuisine` (open string), `effort` (quick/moderate/involved). Processes all untagged in one call. |
| `/api/shopping/consolidate` | Haiku 4.5 | Merges similar shopping items, calculates combined quantities, flags items already in pantry with a `pantry_note`. UK English, metric units. |

---

## Find page — two sections

**AI suggestions (top):** Auto-loads on page mount using pantry items. Claude Sonnet generates 3 complete FODMAP-safe recipes. Preferences input ("quick and easy", "Italian") and Refresh button. Results can be saved directly to the recipe library without going through the adapt flow.

**Web search (bottom):** Two modes:
- **Manual search** — user types a query, Tavily returns up to 8 results from trusted recipe domains.
- **"Use what I have" toggle** — when enabled, Claude Haiku generates 2 intelligent search queries from the user's top pantry items and fires both Tavily searches automatically. Results are merged and deduplicated. Manual input is disabled while the toggle is on.

Each web result shows a pantry match count and matching ingredient names. "Fetch & Adapt" sends the URL to `/adapt?url=...` to scrape and analyse.

---

## Adapt page flow

1. User arrives (optionally with `?url=` pre-filled from Find page "Fetch & Adapt" button).
2. **URL fetch:** Enter URL → "Fetch" → recipe text auto-populates the textarea via `/api/scrape`.
3. **Or paste:** User pastes raw recipe text directly into the textarea.
4. Select dietary requirements (Shellfish allergy pre-selected).
5. Click "Analyse for FODMAP" → `/api/adapt` → Claude returns ingredient-by-ingredient analysis.
6. For each `avoid`/`moderate` ingredient: substitution chips appear (pre-selected to first option).
7. User picks preferred substitute or "Keep original" for each ingredient.
8. "Save adapted recipe" → constructs final ingredient list with chosen subs → saves to Supabase.
9. On success: shows "✓ Saved to your recipes" + "Adapt another recipe" button (resets all state).

**Note on saved instructions:** `instructions` stored in the DB is the original raw recipe text (the paste/fetch content), not AI-extracted cooking steps. On the Adapt page result screen this is labelled "Original recipe". On the Saved page it appears under "Method" — this is a known mismatch (see TODO.md).

---

## Pantry page

- Add items by name with optional quantity and FODMAP status (safe/moderate/avoid/unknown). Manual selection — no auto-detection on add.
- **Photo scan:** Upload or capture a photo → `/api/pantry/analyze` → Claude vision identifies food items with FODMAP status. Results shown as chips to confirm before adding.
- Remove items individually.
- All items listed alphabetically with status badges.

---

## Shopping list page

- **Generate from plan:** Pulls all ingredients from the current week's planned recipes, bulk-inserts into `shopping_items`.
- **Consolidate:** Claude Haiku merges near-duplicates, converts units, and cross-references the pantry. Items already in pantry get a "you may have this" note — nothing is auto-removed, user decides.
- **Manual add:** Free-text name + optional quantity.
- **Tesco links:** Each unchecked item has a Tesco search link.
- **Check off / clear:** PATCH toggles `is_checked`; separate clear-checked and clear-all controls.

---

## URL scraper (`/api/scrape`)

- Fetches a recipe URL server-side (10s timeout, 2MB limit), extracts recipe from JSON-LD (`application/ld+json` with `@type: Recipe`).
- Pure extraction logic in `lib/scrape-utils.ts` (tested independently, no mocks).
- Works on most major recipe sites (BBC Good Food, MOB, Ottolenghi, Serious Eats, etc.).
- Does **not** work on JS-rendered sites (NYT Cooking, most influencer blogs) — returns a friendly 422 "try pasting instead".
- Immediately blocks YouTube, Instagram, TikTok, Pinterest, Twitter with "This doesn't look like a recipe page."

---

## Web search (`/api/search`)

- `GET /api/search?q=<query>` — calls Tavily, appends "recipe" to query, returns up to 8 results.
- Results: `{ title, url, snippet, source }` — snippet is first 180 chars of Tavily content.
- Searches only trusted recipe domains (BBC Good Food, MOB, etc.).
- Requires `TAVILY_API_KEY`; returns 503 "Search not configured" if missing (graceful degradation).
- Free tier: 1,000 searches/month at basic depth — sufficient for personal use.

---

## Tests

```bash
npm test            # run all tests once
npm run test:watch  # watch mode for development
```

25 tests across 3 files. All mock external services (Claude, NextAuth) — no network calls, no API spend.

| File | What it covers |
|---|---|
| `__tests__/lib/scrape-utils.test.ts` | JSON-LD extraction: nested recipes, @graph, string vs array instructions, edge cases |
| `__tests__/api/adapt.test.ts` | Auth (401), validation (400), success path with mocked Claude, unexpected Claude response |
| `__tests__/api/suggest.test.ts` | Auth (401), success with pantry items, success with empty pantry |

---

## Deploying changes

1. `git add <files> && git commit -m "..."`
2. `git push origin main`
3. Vercel auto-deploys on push to `main`.
4. If new env vars were added: Vercel → Settings → Environment Variables → add → **Redeploy manually** (Vercel does not redeploy on env var changes alone).

---

## Re-setting up OAuth (e.g. new Vercel URL)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth client.
2. Add new Authorized redirect URI: `https://<new-url>/api/auth/callback/google`
3. Update `NEXTAUTH_URL` in Vercel env vars.
4. Redeploy.

---

## What's complete

- [x] All 7 pages built and working
- [x] Google OAuth, Supabase, Vercel deployment
- [x] Adapt page: URL scraper + interactive per-ingredient substitution picker
- [x] Adapt page: "Adapt another recipe" button after saving
- [x] Adapt page: save error correctly shown on POST failure (false confirmation bug fixed)
- [x] Adapt page: result screen labels raw text "Original recipe" (not "Method")
- [x] Find page: Claude suggestions from pantry
- [x] Find page: Tavily web recipe search with pantry match counts
- [x] Find page: "Use what I have" toggle — Claude generates intelligent search queries from pantry
- [x] Find page: clear button on search bar
- [x] Saved recipes: favourites toggle + filter
- [x] Saved recipes: tag filter + manual add/remove tags
- [x] Saved recipes: auto-tag button (meal type, cuisine, effort via Claude)
- [x] Saved recipes: "Add to plan" modal
- [x] Weekly meal planner with prev/next/this-week navigation
- [x] Shopping list: generate from plan, manual add, check off, clear
- [x] Shopping list: consolidate with Claude — merges near-duplicates, cross-references pantry
- [x] Pantry: photo scan via Claude vision
- [x] Claude routes use tool_use — structured output, no JSON parsing
- [x] Adapt route switched to Haiku for faster responses
- [x] Error handling on all mutations (non-optimistic, inline error messages)
- [x] Timezone bug fixed on home, plan, shopping pages
- [x] 25 Vitest smoke tests — scrape utils, adapt route, suggest route
- [x] PWA manifest + service worker (static asset caching)

---

## Known gaps / open bugs

See `TODO.md` for the full list with file paths.

**Active bugs:**
- [ ] Saved page: "Method" heading shows raw recipe text (paste/scrape content, not extracted cooking steps)
- [ ] Pantry: no FODMAP status auto-detection when adding items manually (must select from dropdown)

**Missing features:**
- [ ] No PWA install prompt / add-to-home-screen banner
- [ ] No offline support (service worker caches static assets only; API routes require network)
- [ ] No recipe editing — must delete and re-adapt to change a saved recipe
- [ ] No push notifications for meal reminders
- [ ] Shopping list: no copy/share to notes app or supermarket trolley export (see SCOPE_SHOPPING_INTEGRATIONS.md)
- [ ] Supabase has no RLS policies — safe for personal use, would need RLS for multi-user

---

## Considered next steps

Roughly ordered by effort.

---

### 1. Fix "Method" label on Saved page
**What:** When a recipe is saved from the Adapt page, `instructions` contains the raw input text (full paste/scrape content). The Adapt page result screen correctly labels this "Original recipe", but the Saved page shows the same content under the heading "Method". Fix: rename the heading in `app/saved/page.tsx` to "Original recipe", or make a separate lightweight Claude call during save to extract just the cooking method steps.  
**Effort:** Tiny (rename heading) or small (extract steps).  
**Files:** `app/saved/page.tsx` line 393; optionally `app/adapt/page.tsx`.

---

### 2. Dietary profile / allergy customisation
**What:** The FODMAP system prompt in `lib/fodmap-prompt.ts` hardcodes "moderate FODMAP sensitivity + shellfish allergy." Replace with a user-configurable profile stored in Supabase. A `/settings` page with toggles for sensitivity level, named allergies, dietary preferences (dairy-free, vegan, etc.). Claude routes read the profile at request time.  
**Effort:** Medium.  
**Files:** `schema.sql`, `lib/fodmap-prompt.ts`, `app/api/adapt/route.ts`, `app/api/suggest/route.ts`, new `app/settings/page.tsx`.

---

### 3. Improve URL scrape hit rate
**What:** The JSON-LD scraper fails on JS-rendered sites and sites without schema.org markup. Possible improvements: expand the trusted-domain allowlist in `lib/scrape-utils.ts`; or add a fallback that extracts recipe text via Claude vision (screenshot the page).  
**Effort:** Small (allowlist expansion) to large (vision fallback).  
**Files:** `lib/scrape-utils.ts`, `app/api/scrape/route.ts`.

---

### 4. Recipe editing
**What:** No way to edit a saved recipe in place. User must delete and re-adapt. Add an edit mode to the Saved page that lets the user change the title, ingredient list, and notes.  
**Effort:** Medium.  
**Files:** `app/saved/page.tsx`, `app/api/recipes/route.ts` (PATCH needs to accept ingredient/instruction updates).

---

### 5. Supermarket trolley / shopping export
**What:** Export the shopping list to a supermarket trolley or copy in a shareable format. Ocado deep-link search is feasible without an API key. See `SCOPE_SHOPPING_INTEGRATIONS.md` for full options.  
**Effort:** Small (copy/export plaintext) to large (true cart injection).  
**Files:** `app/shopping/page.tsx`.

---

### 6. Streaming on Adapt page
**What:** The adapt flow waits for Claude to complete the full analysis before showing anything. Switch `/api/adapt` to `anthropic.messages.stream()` and stream the tool_use response — ingredients appear progressively as Claude analyses them.  
**Effort:** Medium-large (requires ReadableStream on the route + streaming consumer in the page).  
**Files:** `app/api/adapt/route.ts`, `app/adapt/page.tsx`.
