# FeedMe – To Do

## Pantry Search

- [ ] **Add clear button to pantry search bar**
  The ingredient pills list is too long and unmanageable. Add an X (or similar) button inside the search input so the user can clear the current search query in one tap. The search bar lives in `app/suggest/page.tsx` (around line 96–111); the `setSearchQuery` state setter is already available and just needs to be wired to a clear button that appears when the input is non-empty.
