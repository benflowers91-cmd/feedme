# Epic Breakdown Advisor

**Type:** Interactive
**Source:** [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/epic-breakdown-advisor/SKILL.md)

---

## Purpose

Breaks large epics into user stories using vertical slices — work that delivers end-to-end user value, not just a technical layer. Use this when a feature feels too big to start on, or when estimates are wildly uncertain.

---

## Pre-Split Checklist (INVEST)

Before splitting, check the epic is:
- **I**ndependent — can be delivered without depending on another story
- **N**egotiable — scope can flex
- **V**aluable — delivers something to the user, not just the system
- **E**stimable — team can roughly size it
- **T**estable — has clear acceptance criteria

---

## 9 Splitting Patterns

Apply these sequentially until one fits:

1. **Workflow Steps** — Split by phases in the user's journey
2. **Operations (CRUD)** — Create / Read / Update / Delete as separate stories
3. **Business Rule Variations** — Each edge case or conditional as a story
4. **Data Variations** — Different input types (URL vs. pasted text) as separate stories
5. **Data Entry Methods** — Manual vs. import vs. API
6. **Major Effort** — Separate technical milestone that unlocks further work
7. **Simple / Complex** — Happy path first, edge cases later
8. **Defer Performance** — Working but slow first, optimised later
9. **Break Out a Spike** — If too uncertain to estimate, research spike first

---

## Example (FeedMe: Browser Extension)

The browser extension epic could split into:

| Story | Pattern used |
|---|---|
| As a user, I can click the extension button and send the current URL to the adapt API | Simple (happy path) |
| As a user, I see a loading state while the recipe is being adapted | Simple/Complex |
| As a user, I see an error message if the URL can't be scraped | Business Rule Variations |
| As a user, I'm authenticated via the same Google session I use in the web app | Major Effort (auth spike first) |
| As a user, I can see the substitution picker inline before saving | Complex (defer from MVP) |

---

## Common Pitfalls

- **Horizontal slicing** — "front-end story" and "back-end story" don't deliver independent value
- **Task decomposition** — stories are user outcomes, not implementation checklists
- **Forcing patterns** — if none fit cleanly, run a spike instead
- **Splitting too fine** — stories smaller than half a day of work are usually just tasks
