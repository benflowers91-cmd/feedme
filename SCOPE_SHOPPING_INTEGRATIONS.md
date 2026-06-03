# Scope: Shopping List Integrations

Exploring two directions: (1) sending the shopping list directly to Tesco for grocery delivery, (2) exporting it to a notes app for use while shopping in-store.

---

## Direction 1 — Tesco Integration

### What's available

**Tesco does not have a public ordering/basket API.** The Tesco Developer API (developer.tesco.com) provides product search and store data, but checkout and basket operations require a commercial partnership agreement with Tesco (reserved for large retail integrations, not feasible for personal apps).

### Realistic options

#### Option A — Tesco grocery deep-links (no API, works today)
Each item on the shopping list becomes a Tesco search URL:
```
https://www.tesco.com/groceries/en-GB/search?query=chicken+thighs
```
Implementation: add a "Search on Tesco" button per item that opens a new tab. Low effort, functional, but requires clicking through each item individually.

#### Option B — Tesco search page with all items (better UX)
Tesco doesn't support multi-item search in one URL, but we can:
1. Add a "Open all on Tesco" button that opens one tab per item in sequence
2. Or open a single Tesco search for a comma-joined query (works as a rough starting point)

**Effort:** Small. Add a button to the shopping page.  
**Limitation:** User still has to add items to basket manually on Tesco.

#### Option C — Ocado API (third-party delivery)
Ocado has an affiliate/partner programme and has historically provided basket APIs to approved partners. More accessible than Tesco for small integrations.
- Requires applying to Ocado's partner programme
- Potentially feasible but involves a manual approval process

#### Option D — Instacart (US-focused, not ideal for UK)
Not relevant for a UK user.

#### Option E — Trolley.co.uk / Supermarket price comparison
Trolley.co.uk has a developer API that queries multiple UK supermarkets (Tesco, Sainsbury's, Asda, Ocado). Could be used to search for items and get basket links. Requires API key.

### Recommendation
**Short term:** Option A/B — per-item Tesco search links. Simple to build, immediately useful.  
**Medium term:** Option E (Trolley API) — search across supermarkets, pick the cheapest, deep-link to basket.

---

## Direction 2 — Export to Notes App

### Option A — Copy as plain text (works today, zero effort)
Add a "Copy list" button that copies all items to clipboard as plain text:
```
- 2 chicken thighs
- garlic-infused olive oil
- 200g rice
```
User pastes into any app (Notes, WhatsApp, iMessage, OneNote, etc.).

**Effort:** Trivial — one button, one `navigator.clipboard.writeText()` call.  
**Works everywhere.** This is the highest-value / lowest-effort option.

#### Option B — iOS / Android share sheet
On mobile, trigger the native share sheet with the list as text. User can share to Apple Notes, WhatsApp, Reminders, Keep, etc.
```ts
navigator.share({ title: 'Shopping list', text: formattedList })
```
Works on iOS Safari and Android Chrome. Falls back gracefully (just show Copy button if `navigator.share` not available).

**Effort:** Small. Add alongside the Copy button.

#### Option C — Microsoft OneNote (via Microsoft Graph API)
Requires the user to sign in with a Microsoft account (separate OAuth flow — not the same as Google). Creates a page in a FeedMe notebook with the formatted shopping list.

- New OAuth provider in NextAuth (Microsoft/Azure AD)
- Scope: `Notes.Create`
- API call: `POST https://graph.microsoft.com/v1.0/me/onenote/pages`

**Effort:** Medium. Requires adding Microsoft OAuth to NextAuth, user consent screen, and Graph API calls. Worthwhile if OneNote is a primary workflow.

#### Option D — Google Keep (via Google Tasks API workaround)
Google Keep has no public API. Items can be added to **Google Tasks** (which the app already has OAuth infrastructure for from the todo-app project) but Tasks ≠ Keep.

Not recommended — Tasks isn't a shopping list app.

#### Option E — Email the list
Send the shopping list to the user's email (their Google account email, already known from session). Requires adding an email sending service (Resend or SendGrid — both have generous free tiers).

**Effort:** Small-medium. Add Resend/SendGrid, one API route, one button.  
**Good for:** printing, forwarding to a partner.

---

## Recommended build order

| Priority | Feature | Effort | Value |
|---|---|---|---|
| 1 | Copy list to clipboard | 1 hour | High — works everywhere, instant |
| 2 | Native share sheet (iOS/Android) | 1 hour | High — integrates with any app |
| 3 | Per-item Tesco search links | 2 hours | Medium — useful but manual |
| 4 | Email the list | 3 hours | Medium — good for in-store |
| 5 | OneNote integration | 1 day | Medium — only if OneNote is primary workflow |
| 6 | Trolley.co.uk multi-supermarket | 2 days | High — price comparison + basket links |
| 7 | Tesco basket API | Not feasible | Blocked — requires commercial partnership |

---

## Implementation notes for Priority 1 & 2 (Copy + Share)

Both go in `/app/shopping/page.tsx`. Add to the page header alongside the existing "Clear done" / "Clear all" buttons.

```ts
function formatListForExport(items: ShoppingItem[]): string {
  const unchecked = items.filter(i => !i.is_checked)
  return unchecked.map(i => `- ${i.name}`).join('\n')
}

async function copyList() {
  await navigator.clipboard.writeText(formatListForExport(items))
  // show brief "Copied!" confirmation
}

async function shareList() {
  if (navigator.share) {
    await navigator.share({ title: 'Shopping list', text: formatListForExport(items) })
  } else {
    copyList() // fallback
  }
}
```

No new routes, no new env vars, no external services needed for these two.
