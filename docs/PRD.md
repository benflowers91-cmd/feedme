# FeedMe — Product Requirements Document

**Status:** Living document. Update as decisions are made.
**Last updated:** 2026-06-20

---

## What is it?

FeedMe is a personal meal planning app for people with FODMAP dietary restrictions. It helps you find recipes, adapt existing ones to be FODMAP-safe, plan your week, and build a shopping list — all in one place.

Built for personal use by Ben, who has FODMAP dietary restrictions. His partner has a shellfish allergy. These are lived constraints, not abstract rules.

---

## The problem it solves

Eating FODMAP-safe is hard work. Most recipes online aren't FODMAP-compliant, and working out which ingredients to swap — and to what — requires either expert knowledge or hours of research. Existing tools are either too generic (recipe apps that ignore dietary needs) or too clinical (FODMAP databases with no meal planning). FeedMe sits in between: practical, personal, and smart enough to do the hard thinking.

---

## Who it's for

**Right now:** Ben only. Single-user. No onboarding, no marketing, no multi-tenancy.

**Near future:** Ben's partner and a small circle of friends. Small-scale sharing, not a public launch. Requires RLS on Supabase and per-user dietary profiles before this is safe to open up.

**Success looks like:** Daily personal use. Light portfolio piece — something to reference and demo, not necessarily a product launch.

---

## Dietary rules (non-negotiable)

- **FODMAP:** Moderate sensitivity by default. Flag trigger ingredients, suggest safe substitutions. Don't be overly restrictive — liveable, not clinical.
- **Shellfish:** Never suggest shellfish under any circumstances. This is an allergy, not a preference.

These rules are currently hardcoded in `lib/fodmap-prompt.ts`. Planned: user-configurable dietary profile (see Roadmap).

---

## Core features (current state — all built)

### Pantry
Track what you have at home. Each ingredient tagged with FODMAP status (safe / moderate / avoid). Used by the AI to generate relevant suggestions.

### Find
Two modes:
- **AI suggestions** — Claude generates 3 complete FODMAP-safe recipes based on your pantry items. Good for "what can I make tonight?"
- **Web search** — Tavily finds real recipes from the web. Good for "I want to make pasta carbonara, show me versions I can adapt." Results link directly into the Adapt flow.

### Adapt
Take any recipe (URL or pasted text) and make it FODMAP-safe. Claude analyses each ingredient, flags issues, and suggests substitutions. You pick which subs to apply before saving. Ingredient-by-ingredient control — you're never overruled.

### Saved
Your recipe library. Recipes tagged automatically by meal type, cuisine, and effort level. Filter by tag or favourite. Add to meal plan from here.

### Plan
Weekly meal planner. Assign saved recipes to breakfast / lunch / dinner slots. Navigate week by week.

### Shopping
Shopping list that generates from your meal plan. Cross-references your pantry to flag items you may already have. Manual add also supported. Check off as you shop.

### Home
Today's meals at a glance. Quick action tiles.

---

## Technical decisions (already made)

| Decision | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) | Standard, Vercel-native |
| Auth | NextAuth v4, Google OAuth | Simple, no password management |
| Database | Supabase (Postgres) | Free tier, easy to use |
| AI | Anthropic Claude (Sonnet + Haiku) | Best-in-class for nuanced dietary reasoning |
| Web search | Tavily | Clean API, recipe-friendly results |
| Hosting | Vercel | Auto-deploy on push to main |
| Styling | Tailwind CSS 4 | Utility-first, fast to build with |
| Tests | Vitest | Fast, minimal config |

---

## Known gaps (not yet built)

| Gap | Notes |
|---|---|
| PWA offline support / install prompt | PWA manifest exists, no offline logic |
| FODMAP auto-tagging on pantry add | User must select status manually |
| Recipe edit | Must delete and re-adapt to change a saved recipe |
| Shopping list share/export | No copy, share, or supermarket integration yet |
| Push notifications / meal reminders | Not started |
| RLS on Supabase | Safe for personal use; needed before sharing with others |

---

## Roadmap (roughly prioritised)

### Small wins
- **"Adapt another recipe" button** — reset state after saving, avoid navigating away and back
- **Copy shopping list to clipboard** — one button, no dependencies, works everywhere
- **Native share sheet** — `navigator.share()` on mobile, sends list to Notes, WhatsApp, etc.
- **Improve URL scrape hit rate** — allowlist of known-good sites; block YouTube/Instagram/Pinterest immediately

### Medium effort
- **Dietary profile / settings page** — user-configurable FODMAP sensitivity level, named allergies (shellfish, dairy, etc.), other restrictions (vegan, gluten-free). Replaces hardcoded `lib/fodmap-prompt.ts`. New `/settings` page. Required before sharing with others.
- **Smart shopping aggregator** — consolidate near-duplicate ingredients across recipes into one line item
- **Streaming on Adapt** — show ingredient analysis progressively rather than waiting for full response
- **Per-item supermarket search links** — open Tesco/Ocado search in a new tab per item

### Big features

#### Browser extension
Browse any recipe site and click one button to fetch, adapt, and save directly to FeedMe — without opening the app. The adaptation step runs in the background; you get a notification when it's done.

**Why this matters:** The current flow requires copying a URL, opening FeedMe, pasting into Adapt, and waiting. A browser extension collapses that to one click from any recipe page.

**Technical approach (to validate):**
- Chrome/Firefox extension (separate codebase)
- Extension button scrapes the current page URL and POSTs it to the existing `/api/adapt` endpoint
- Auth: extension authenticates via the same Google OAuth session (cookie sharing, or a long-lived token stored in extension storage)
- On success: shows a small popup confirming the recipe was saved
- Reuses all existing server-side logic — no duplicate scraping or AI code

**Open questions before building:**
- Does the extension share the browser's Google session cookie, or does it need its own auth token?
- Should it show the substitution picker inline (like the web app) or auto-apply the first suggested sub silently?
- Chrome-only first, or Firefox too?

#### Multi-user / sharing
Share FeedMe with partner and friends. Requires:
- RLS policies on all Supabase tables (currently none — safe only because it's single-user)
- Per-user dietary profiles (so partner's settings don't affect Ben's suggestions)
- Some form of invite / onboarding flow
Not in scope until the single-user experience is solid and dietary profiles are built.

---

## Out of scope (decided)

- Nutritional information beyond FODMAP status
- Calorie counting
- Supermarket basket API integration (Tesco requires commercial partnership; not feasible)
- Recipe creation from scratch (Adapt and Find cover the use case)
- Full native mobile app (PWA covers the mobile use case)
