# FeedMe – To Do

## Pantry Search

- [x] **Add clear button to pantry search bar**
  `×` button inside the search input, visible when query is non-empty. `app/suggest/page.tsx`.

- [ ] **"Use what I have" mode for recipe search**
  Replace the clunky pill-tapping flow with a toggle that auto-builds a Tavily search query from the top pantry ingredients (safe/moderate, top ~6) and fires the search immediately. Manual text input is disabled while the toggle is on. Results are real web recipes — no AI-written content.
  - **File:** `app/suggest/page.tsx`

- [ ] **Speed up FODMAP analysis on the Adapt page**
  ~~Speed up recipe search~~ → focus is on the adapt flow.
  - [x] Step 1: Remove `instructions` from Claude's tool schema; cut `max_tokens` 3000→1000; fill instructions from original recipe text on client. (`app/api/adapt/route.ts`, `app/adapt/page.tsx`)
  - [x] Step 2: Switch adapt route to `claude-haiku-4-5-20251001`. Evaluate FODMAP classification quality on a real recipe — revert if precision suffers, implement streaming as fallback.
  - ~~Bug: "fatoush" stale sessionStorage~~ (no longer using sessionStorage for query persistence)

## Saved Recipes

- [ ] **Auto-tag saved recipes by meal type, cuisine, and effort**
  On-demand "Auto-tag all" button on the Saved page. New `POST /api/recipes/tag` route calls Claude Haiku with recipe title + first few ingredients → returns `{ meal_type, cuisine, effort }` via tool_use → PATCHes recipe. Only processes untagged recipes. Tags: meal_type (breakfast/lunch/dinner/snack), cuisine (open string), effort (quick/moderate/involved).
  - **Files:** `app/saved/page.tsx`, new `app/api/recipes/tag/route.ts`

## Shopping List

- [ ] **Consolidate cross-references pantry**
  Pass the user's pantry to the consolidate Claude call alongside shopping items. Claude returns a `pantry_note` per item if it thinks the user already has it. UI shows a "you may have this" flag — nothing is auto-removed, user decides.
  - **Files:** `app/shopping/page.tsx`, `app/api/shopping/consolidate/route.ts`
