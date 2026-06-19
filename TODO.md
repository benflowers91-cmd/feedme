# FeedMe – To Do

## Completed

- [x] **Add clear button to pantry search bar**
  `×` button inside the search input, visible when query is non-empty.
  `app/suggest/page.tsx`

- [x] **"Use what I have" mode for recipe search**
  Toggle on the Find page. When enabled, Claude Haiku generates 2 intelligent recipe search queries from the user's top pantry items and fires both Tavily searches automatically. Manual text input is disabled while the toggle is on. Results are real web recipes — no AI-written content.
  `app/suggest/page.tsx`, `app/api/pantry-search/route.ts`

- [x] **Speed up FODMAP analysis on the Adapt page**
  Removed `instructions` from Claude's tool schema (cuts tokens + round-trip). Switched adapt route to `claude-haiku-4-5-20251001`. Max tokens reduced 3000→2000.
  `app/api/adapt/route.ts`, `app/adapt/page.tsx`

- [x] **Auto-tag saved recipes by meal type, cuisine, and effort**
  "Auto-tag all" button on the Saved page. `POST /api/recipes/tag` calls Claude Haiku with recipe title + first few ingredients → returns `{ meal_type, cuisine, effort }` via tool_use → PATCHes each recipe. Only processes untagged recipes.
  `app/saved/page.tsx`, `app/api/recipes/tag/route.ts`

- [x] **Consolidate shopping list with pantry cross-reference**
  "Consolidate" button on the Shopping page. Claude Haiku merges near-duplicate items and flags items already in the pantry with a `pantry_note`. Nothing is auto-removed — user decides.
  `app/shopping/page.tsx`, `app/api/shopping/consolidate/route.ts`

- [x] **Fix false "Saved" confirmation on Adapt page**
  `saveRecipe()` now checks `res.ok` before calling `setSaved(true)`. Failure shows an inline error instead of false confirmation.
  `app/adapt/page.tsx`

- [x] **"Adapt another recipe" button**
  Shown after a successful save. Calls `resetState()` to clear all fields and return to the input step.
  `app/adapt/page.tsx`

- [x] **Relabel "Method" → "Original recipe" on Adapt result screen**
  The adapt result screen now shows "Original recipe" instead of "Method" since the stored text is the raw paste/scrape content, not extracted cooking steps. (Note: the Saved page still says "Method" — see open bugs below.)
  `app/adapt/page.tsx`

---

## Open bugs

- [ ] **Saved page: "Method" heading shows raw recipe text**
  When a recipe is saved from the Adapt page, `instructions` in the DB contains the full raw input (paste or scraped text, not extracted cooking steps). The Saved page shows this under the heading "Method", which is misleading.
  Options: (a) relabel to "Original recipe" in `app/saved/page.tsx` line 393 — one-line fix; or (b) make a separate Claude call during save to extract just the cooking method steps.
  **Files:** `app/saved/page.tsx` (line 393)

- [ ] **Pantry: no FODMAP status auto-detection on manual add**
  When adding a pantry item by typing, the user must manually choose the FODMAP status from the dropdown. There's no auto-suggestion based on ingredient name. The photo scan route (`/api/pantry/analyze`) does return status, but it only fires on photo upload.
  **Files:** `app/pantry/page.tsx`, potentially a new lookup route

---

## Missing features (not yet started)

- [ ] **PWA install prompt**
  Service worker is registered and manifest is set. There's no banner or UI prompting the user to install the app to their home screen.

- [ ] **Offline support**
  Service worker caches static assets only. API routes all require network. Offline viewing of saved recipes or the meal plan would require caching API responses.

- [ ] **Recipe editing**
  No way to edit a saved recipe in place. User must delete and re-adapt. An edit mode on the Saved page would let the user change title, ingredients, and notes.

- [ ] **Shopping list export / supermarket trolley**
  No way to share the shopping list or push it to a supermarket trolley. See `SCOPE_SHOPPING_INTEGRATIONS.md` for options (Ocado deep-links, plaintext copy, etc.).

- [ ] **Push notifications for meal reminders**
  No reminders to plan meals or check what's for dinner.

- [ ] **Supabase RLS policies**
  All row filtering is done manually in API routes using `user_id`. Safe for personal use, but would need Row Level Security policies before opening the app to other users.

- [ ] **Dietary profile settings page**
  The FODMAP sensitivity level and shellfish allergy are hardcoded in `lib/fodmap-prompt.ts`. A `/settings` page would let the user configure their own profile (allergies, dairy-free, vegan, etc.) stored in Supabase and injected into Claude prompts at request time.
  See HANDOFF.md "Considered next steps" for full scope.
