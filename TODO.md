# FeedMe – To Do

## Pantry Search

- [ ] **Add clear button to pantry search bar**
  The ingredient pills list is too long and unmanageable. Add an X (or similar) button inside the search input so the user can clear the current search query in one tap. The search bar lives in `app/suggest/page.tsx` (around line 96–111); the `setSearchQuery` state setter is already available and just needs to be wired to a clear button that appears when the input is non-empty.

- [ ] **Ideate a better way to use the pantry in recipe search**
  The current approach (ingredient pills that append to the query) is clunky at scale. Think through alternatives — e.g. automatically pre-filtering or ranking results by pantry coverage, a "use what I have" mode that builds the query from pantry items directly, or a smarter UI for surfacing high-match recipes without manual pill tapping.

## Shopping List

- [ ] **Consolidate feature should cross-reference the pantry**
  When consolidating shopping list items, check the user's pantry and automatically reduce or remove quantities for ingredients they already have. This avoids buying things that are already stocked.
