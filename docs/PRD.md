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

**Longer term:** [Open question — see Clarifications below]

---

## Dietary rules (non-negotiable)

- **FODMAP:** Moderate sensitivity. Flag trigger ingredients, suggest safe substitutions. Don't be overly restrictive — liveable, not clinical.
- **Shellfish:** Never suggest shellfish under any circumstances. This is an allergy, not a preference.

These rules are currently hardcoded in `lib/fodmap-prompt.ts`. Future: user-configurable dietary profile (see Roadmap).

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
| RLS on Supabase | Safe for personal use; needed before multi-user |

---

## Roadmap (roughly prioritised)

### Small wins
- **"Adapt another recipe" button** — reset state after saving, avoid navigating away and back
- **Copy shopping list** — one button, `navigator.clipboard.writeText()`, no dependencies
- **Native share sheet** — `navigator.share()` for mobile, sends list to any app
- **Improve URL scrape hit rate** — allowlist of known-good sites; block YouTube/Instagram/Pinterest fast

### Medium effort
- **Dietary profile / allergy settings** — user-configurable FODMAP sensitivity, named allergies, other restrictions. Replaces hardcoded prompt. New `/settings` page.
- **Smart shopping aggregator** — consolidate near-duplicate ingredients across recipes (e.g. 3 different tomato types → one quantity)
- **Streaming on Adapt** — show ingredient analysis progressively instead of waiting for full response
- **Per-item Tesco/Ocado search links** — open supermarket search in new tab per item

### Bigger
- **Multi-user / sharing** — requires RLS, onboarding, settings per user. Not in scope until personal use is solid.

---

## Out of scope (decided)

- Nutritional information beyond FODMAP status
- Calorie counting
- Supermarket basket API integration (Tesco requires commercial partnership; not feasible)
- Recipe creation from scratch (Adapt and Find cover the use case)

---

## Clarifications needed

*Things to decide — answers will update this doc.*

1. **Who is the long-term audience?** Just Ben forever, or eventually open to others (friends, public, product launch)? This affects decisions around RLS, onboarding, settings, and how much polish matters.

2. **What does success look like?** Using it daily yourself? Portfolio piece? Something you'd share?

3. **Is there a feature you've imagined that isn't in any doc yet?** Anything you've thought "it'd be great if..." that hasn't been scoped.

4. **Shopping list priority** — copy/share vs supermarket links vs something else. What would you actually use?

5. **Dietary profile** — do you ever want to change your FODMAP sensitivity level or add restrictions, or is the current hardcoded setup fine for now?
