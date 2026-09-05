# FeedMe – To Do

## Google Calendar sync (top priority — see PRD Roadmap)

- [ ] **Push weekly plan to Google Calendar (one-off push)**
  Button on the Plan page: for the currently viewed week, create a Google Calendar event per meal slot that has a recipe assigned — breakfast 9:00, lunch 12:30, dinner 18:00, titled with the recipe name. Re-running it for the same week overwrites/recreates that week's pushed events (not live sync — no tracking of edits made after the push).
  - Needs: Calendar scope added to the existing Google OAuth (NextAuth) consent; a way to map "this week's plan" to calendar event start/end times per day; a new API route to create the events.
  - Out of scope for this pass: two-way sync, editing a plan slot after it's been pushed, Google Tasks integration.

## Pantry Search

- [x] **Add clear button to pantry search bar**
  `×` button inside the search input, visible when query is non-empty. `app/suggest/page.tsx`.

- [x] **"Use what I have" mode for recipe search**
  Replace the clunky pill-tapping flow with a toggle that auto-builds a Tavily search query from the top pantry ingredients (safe/moderate, top ~6) and fires the search immediately. Manual text input is disabled while the toggle is on. Results are real web recipes — no AI-written content.
  - **File:** `app/suggest/page.tsx`
  - ~~Superseded~~ — see "Pantry recipe idea chips" below.

- [x] **Pantry recipe idea chips (replaces the toggle above)**
  The toggle sent only the top 6 pantry items into 2 generic Claude-written search phrases, and required remembering to flip a switch — still left the user guessing at combinations. Replaced with a "Recipe ideas from my pantry" button that asks Claude (from the *full* safe/moderate pantry) for 8 varied search phrases (different cuisines/meal types), shown as tappable chips. Tapping a chip fills the search bar and runs a normal `/api/search` (Tavily) lookup — Claude only ever suggests search terms, it never writes recipe content. A "More ideas" action regenerates a fresh batch, excluding ones already shown. Manual search input is no longer disabled by any mode.
  - **Files:** `app/api/pantry-ideas/route.ts` (new, replaces `app/api/pantry-search/route.ts`), `app/suggest/page.tsx`
  - [x] **Fix:** ideas were skewing toward single-component preps/sides (e.g. "roasted cashews") instead of full meals. Prompt now explicitly asks for complete main courses and grants permission to assume basic staples (oil, salt, garlic, rice, pasta, stock) are on hand, so it isn't limited to sparse 2-item pairings from a pantry that's mostly raw ingredients.
  - [x] **Fix:** the "combine several ingredients" instruction from the fix above backfired — Claude was inventing fake mashup titles by literally stringing pantry items together (e.g. "Tomato sauce pasta with cuttlefish ink and garlic") instead of naming real dishes, which don't search well on Tavily. Prompt now asks for genuine, well-known recipe names where at least one pantry ingredient stars, and explicitly allows a dish to need ingredients beyond the pantry — the point of pantry-search is discovery, not full pantry coverage; gaps get filled by the shopping list.

- [ ] **Speed up FODMAP analysis on the Adapt page**
  ~~Speed up recipe search~~ → focus is on the adapt flow.
  - [x] Step 1: Remove `instructions` from Claude's tool schema; cut `max_tokens` 3000→2000; fill instructions from original recipe text on client. (`app/api/adapt/route.ts`, `app/adapt/page.tsx`)
  - [x] Step 2: Switch adapt route to `claude-haiku-4-5-20251001`. Evaluate FODMAP classification quality on a real recipe — revert if precision suffers, implement streaming as fallback.
  - ~~Bug: "fatoush" stale sessionStorage~~ (no longer using sessionStorage for query persistence)

## Saved Recipes

- [x] **Auto-tag saved recipes by meal type, cuisine, and effort**
  On-demand "Auto-tag all" button on the Saved page. New `POST /api/recipes/tag` route calls Claude Haiku with recipe title + first few ingredients → returns `{ meal_type, cuisine, effort }` via tool_use → PATCHes recipe. Only processes untagged recipes. Tags: meal_type (breakfast/lunch/dinner/snack), cuisine (open string), effort (quick/moderate/involved).
  - **Files:** `app/saved/page.tsx`, `app/api/recipes/tag/route.ts`

## Shopping List

- [x] **Consolidate cross-references pantry**
  Pass the user's pantry to the consolidate Claude call alongside shopping items. Claude returns a `pantry_note` per item if it thinks the user already has it. UI shows a "you may have this" flag — nothing is auto-removed, user decides.
  - **Files:** `app/shopping/page.tsx`, `app/api/shopping/consolidate/route.ts`
  - [x] **Update:** now actually removes confident pantry matches instead of only flagging them. Claude returns a separate `removed_from_pantry` list (only for close, confident matches — uncertain ones still just get the `pantry_note` flag); the shopping page shows a dismissible "left off the list — looks like you already have: X, Y" banner so removals stay visible. Also fixed the pantry query only selecting `name` (not `quantity`), so Claude had no way to judge whether the pantry had *enough* of something.
  - [x] **Update:** merging was too conservative — different varieties/forms of the same ingredient (e.g. "1 small cucumber" + "1 Persian cucumber") were being left as separate near-identical lines instead of one. Prompt now explicitly merges varieties/cultivars/forms of the same base ingredient (unless the FODMAP-safety rule forbids it) and collapses mismatched quantity descriptors (small/large, count vs weight) into a single sensible combined amount rather than concatenating them.
  - **File:** `app/api/shopping/consolidate/route.ts`

---

## Known bugs

- [x] **Adapt page: "Failed to analyse (server error 200)" when analysing a recipe**
  The status code was a red herring. `analyseRecipe()` wrapped both the `res.json()` parse *and* the result-processing code in one try/catch, and the catch assumed any throw meant a non-JSON response. When the API returned a 200 whose payload was missing `ingredients`, `data.ingredients.forEach(...)` threw a TypeError, landed in that catch, and got reported as a server error with the successful status attached.
  - **Root cause on the server side:** `/api/adapt` returned `toolBlock.input` unvalidated and never checked `stop_reason`. With `max_tokens: 2000` and a forced tool call, a long recipe hit the output cap mid-JSON and came back as a partial input object. Nothing was logged, so Vercel showed no error.
  - **Fixes:** route now returns 502 with a specific message on `stop_reason: 'max_tokens'`, validates that the tool input actually has `title`, a non-empty `ingredients` array, and `fodmap_notes` before returning it, and raises `max_tokens` to 8000. Client splits the parse from the processing so the two failure modes report differently, and checks the ingredient list before using it.
  - **Files:** `app/api/adapt/route.ts`, `app/adapt/page.tsx`, `__tests__/api/adapt.test.ts`

- [x] **Adapt page: raw recipe text stored as "Method" on Saved page**
  Relabeled to "Original recipe" on the Saved page to match the Adapt result screen.
  - **File:** `app/saved/page.tsx`

- [x] **Adapt page: false "Saved" confirmation on POST failure**
  `saveRecipe()` now checks `res.ok` before calling `setSaved(true)` and surfaces a `saveError` message if the POST fails.
  - **File:** `app/adapt/page.tsx`

- [x] **Adapt page: previous recipe stuck in the URL field / state after "Fetch & Adapt" on a new result**
  The page only synced the `?url=` query param into `urlInput` — it never reset `recipeText`, `sourceUrl`, `result`, or `step`. Since Next only swaps the page segment (not a hard remount) when navigating between two `/adapt?url=...` URLs, clicking "Fetch & Adapt" on a second recipe could leave the first recipe's fetched text/analysis behind. Fixed properly per React's own guidance for "reset all state when a prop changes": the URL param is now read one level up and passed down as `key={url}`, forcing a full remount (and clean state) on every new URL — no manual reset-half-the-fields effect to keep in sync.
  - Also wrapped `fetchRecipe`, `analyseRecipe`, and `saveRecipe` in try/catch/finally — none of the three handled a thrown `fetch()` (offline, timeout, non-JSON error body), which left the button stuck in its loading state forever with no error shown.
  - **File:** `app/adapt/page.tsx`
