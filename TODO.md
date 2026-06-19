# FeedMe – To Do

## Pantry Search

- [ ] **Add clear button to pantry search bar**
  The ingredient pills list is too long and unmanageable. Add an X (or similar) button inside the search input so the user can clear the current search query in one tap. The search bar lives in `app/suggest/page.tsx` (around line 96–111); the `setSearchQuery` state setter is already available and just needs to be wired to a clear button that appears when the input is non-empty.

- [ ] **Ideate a better way to use the pantry in recipe search**
  The current approach (ingredient pills that append to the query) is clunky at scale. Think through alternatives — e.g. automatically pre-filtering or ranking results by pantry coverage, a "use what I have" mode that builds the query from pantry items directly, or a smarter UI for surfacing high-match recipes without manual pill tapping.

- [ ] **Speed up recipe search and persist results across navigation**
  The search takes too long, and navigating away (another tab/app) causes the page to remount and results to disappear. Investigate on multiple fronts:
  - Is the analysis doing too much in one pass? Consider splitting the Tavily fetch and the FODMAP/pantry analysis into separate steps so results appear sooner.
  - Could internal templates or tighter prompting reduce LLM processing time?
  - Cache or store the last search results (e.g. `sessionStorage` or a lightweight client-side store) so they survive a tab blur/remount without re-fetching.
  - Check whether the `/api/search` route is doing redundant work that could be trimmed.
  - **Bug:** Every fetch attempt now triggers a search for "fatoush" — likely a stale value stuck in `sessionStorage`, a React state initialiser reading from cache, or a `useEffect` firing with a persisted query on mount. Find where the initial query value is being read from and clear/guard it.

## Saved Recipes

- [ ] **Auto-tag saved recipes by meal type, cuisine, and effort**
  Users should be able to tag saved recipes without doing it manually. Tags to generate: meal type (breakfast, lunch, dinner, snack), cuisine (e.g. Italian, Asian, Middle Eastern), and effort (quick, moderate, involved). Two possible trigger points to explore:
  - **On save** — run tagging automatically when a recipe is saved, so tags are ready immediately.
  - **On demand** — add a "Tag" or "Auto-tag" button on the saved recipes page that processes one or all saved recipes.
  Tagging could be done via a short LLM prompt against the recipe title/snippet, or with a lightweight rules-based classifier if speed/cost is a concern. Tags should be stored alongside the saved recipe and be filterable on the saved page.

## Shopping List

- [ ] **Consolidate feature should cross-reference the pantry**
  When consolidating shopping list items, check the user's pantry and automatically reduce or remove quantities for ingredients they already have. This avoids buying things that are already stocked.
