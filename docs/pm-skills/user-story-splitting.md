# User Story Splitting

**Type:** Component
**Source:** [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/user-story-splitting/SKILL.md)

---

## Purpose

Breaks oversized user stories and epics into smaller independently deliverable pieces while preserving user value. Use this when a story can't be completed in a single sprint or when estimates vary wildly.

---

## 8 Splitting Patterns

| Pattern | When to use | Example |
|---|---|---|
| Workflow steps | Sequential journey phases | "Find recipe" → search → filter → select → confirm |
| Business rule variations | Different conditions produce different outcomes | FODMAP-safe vs. "may contain" vs. avoid |
| Data variations | Different input types | URL scrape vs. pasted text in Adapt |
| Acceptance criteria complexity | Multiple When/Then pairs in one story | Split each scenario into its own story |
| Major effort | Technical milestone that unlocks further work | Auth spike before extension MVP |
| External dependencies | API or third-party integration boundary | Tavily search as its own story |
| DevOps steps | Infrastructure or deployment work | Deploy Vercel preview as its own deliverable |
| Tiny Acts of Discovery (spike) | Too uncertain to estimate | Research spike: "Can we share Google OAuth session with extension?" |

---

## Validation — Each Split Must Be

- Independently valuable to the user (not just to the system)
- Independently developable (no hidden dependency on the other split)
- Independently testable
- Sprint-appropriate in scope
- Together, the splits must cover everything in the original story

---

## Anti-Patterns

**Horizontal slicing** — "front-end story" and "back-end story" is not splitting, it's task decomposition. Neither piece delivers user value on its own.

**Arbitrary chopping** — "Let's just do the first half." What does "first half" mean to the user? Split by value, not by effort.

**Micro-stories** — If a story takes less than half a day, it's a task, not a story.

---

## When to Spike Instead

If you can't confidently estimate a story after trying the patterns above, the uncertainty is the problem — not the size. Run a time-boxed discovery spike to answer the blocking question, then re-estimate.
