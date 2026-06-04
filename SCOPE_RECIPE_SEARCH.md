# Recipe Search — Tavily Integration

## Context

The original Find page used Google Custom Search API, which was returning 400 errors and had no reliable fallback. The Find page was rebuilt to use Claude-from-pantry for AI suggestions. This document covers the addition of **real web recipe search** alongside those suggestions, powered by Tavily.

## What it does

Adds a "Search real recipes" section to the Find page (`/suggest`). The user types a recipe name or idea, Tavily searches the web and returns recipe page results with titles, source domains, and content snippets. Each result has a **Fetch & Adapt** button that sends the URL to the existing adapt flow (`/adapt?url=...`), which scrapes the recipe and runs FODMAP analysis via Claude.

The page now has two distinct jobs:
- **AI suggestions** (top) — Claude generates 3 FODMAP-safe recipes based on pantry items. Good for "what can I make tonight?"
- **Web search** (bottom) — Tavily finds real recipes from the web. Good for "I want to make pasta carbonara, show me versions I can adapt."

## Architecture

### New file
**`app/api/search/route.ts`** — GET handler, takes `?q=<query>`, calls Tavily, returns normalized results.

The query is enriched by appending `"recipe"` before sending to Tavily (ensures results are recipe pages, not ingredient articles). No FODMAP filtering at search time — the Fetch & Adapt flow handles that downstream.

### Updated file
**`app/suggest/page.tsx`** — second section added below AI suggestions. Separate state (`searchQuery`, `searchResults`, `searchLoading`, `searchError`). Web search is user-triggered (not auto-load) to avoid burning API credits on every page visit.

## Environment variable

| Variable | Where to get it |
|----------|-----------------|
| `TAVILY_API_KEY` | [app.tavily.com](https://app.tavily.com) → API Keys |

Add to `.env.local` for local dev and to Vercel project settings for production.

Free tier: **1,000 searches/month** at basic depth. Each search = 1 credit. More than sufficient for personal use.

## API details

- Endpoint: `POST https://api.tavily.com/search`
- Auth: `api_key` in request body
- `search_depth: "basic"` — fast, 1 credit per call
- `max_results: 8` — capped to keep response size small
- `include_raw_content: false` — snippets only, not full page text

## Failure modes

| Scenario | Behaviour |
|----------|-----------|
| `TAVILY_API_KEY` not set | Route returns 503 "Search not configured" — search section shows error, AI suggestions still work |
| Bad API key | Tavily returns 401 → same 503 behaviour |
| Rate limit (429) | User sees "try again in a moment" |
| Tavily unreachable | 502, user sees "Search failed — try again" |

## Testing locally

1. Add `TAVILY_API_KEY` to `.env.local`
2. `npm run dev`
3. Open `/suggest`, scroll to "Search real recipes"
4. Search for "chicken soup" — expect 8 results with Fetch & Adapt buttons
5. Click Fetch & Adapt on a result — expect it to land on `/adapt` with the URL pre-filled

## Not in scope

- Filtering Tavily results to specific trusted domains (could add `include_domains` to the API call if too many low-quality results appear)
- Saving searches or result history
- Pagination beyond 8 results
