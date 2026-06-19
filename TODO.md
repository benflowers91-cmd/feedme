# FeedMe – To Do

## Pantry Search

- [x] **Add clear button to pantry search bar**
  `×` button inside the search input, visible when query is non-empty. `app/suggest/page.tsx`.

- [ ] **"Use what I have" mode for recipe search**
  Replace the clunky pill-tapping flow with a toggle that auto-builds a Tavily search query from the top pantry ingredients (safe/moderate, top ~6) and fires the search immediately. Manual text input is disabled while the toggle is on. Results are real web recipes — no AI-written content.
  - **File:** `app/suggest/page.tsx`

- [ ] **Speed up FODMAP analysis on the Adapt page**
  ~~Speed up recipe search~~ → focus is on the adapt flow.
  - [x] Step 1: Remove `instructions` from Claude's tool schema; cut `max_tokens` 3000→2000; fill instructions from original recipe text on client. (`app/api/adapt/route.ts`, `app/adapt/page.tsx`)
  - [x] Step 2: Switch adapt route to `claude-haiku-4-5-20251001`. Evaluate FODMAP classification quality on a real recipe — revert if precision suffers, implement streaming as fallback.
  - ~~Bug: "fatoush" stale sessionStorage~~ (no longer using sessionStorage for query persistence)

## Saved Recipes

- [ ] **Auto-tag saved recipes by meal type, cuisine, and effort**
  On-demand "Auto-tag all" button on the Saved page. New `POST /api/recipes/tag` route calls Claude Haiku with recipe title + first few ingredients → returns `{ meal_type, cuisine, effort }` via tool_use → PATCHes recipe. Only processes untagged recipes. Tags: meal_type (breakfast/lunch/dinner/snack), cuisine (open string), effort (quick/moderate/involved).
  - **Files:** `app/saved/page.tsx`, new `app/api/recipes/tag/route.ts`

## Shopping List

- [x] **Consolidate cross-references pantry**
  Pass the user's pantry to the consolidate Claude call alongside shopping items. Claude returns a `pantry_note` per item if it thinks the user already has it. UI shows a "you may have this" flag — nothing is auto-removed, user decides.
  - **Files:** `app/shopping/page.tsx`, `app/api/shopping/consolidate/route.ts`

---

## Known bugs

- [ ] **Adapt page: raw recipe text stored as "Method"**
  When a recipe is saved from the Adapt page, the full raw input (ingredients + method mixed) is stored as `instructions` and shown under the "Method" heading on both the Adapt result screen and the Saved page. This is a regression — Claude previously extracted just the cooking steps. Options: (a) relabel the section "Original recipe" to set expectations, or (b) have Claude extract just the method in a separate lightweight call.
  - **Files:** `app/adapt/page.tsx` (line 105, 257), `app/saved/page.tsx`

- [ ] **Adapt page: false "Saved" confirmation on POST failure**
  `saveRecipe()` calls `setSaved(true)` unconditionally after the fetch, regardless of `res.ok`. If the `/api/recipes` POST fails (e.g., DB error, oversized payload), the user sees "✓ Saved to your recipes" but the recipe was not persisted. Fix: check `res.ok` before calling `setSaved(true)` and surface an error if false.
  - **File:** `app/adapt/page.tsx` (lines 143–154)
