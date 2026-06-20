# PM Skills for FeedMe

Curated subset of [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills) (v0.80, CC BY-NC-SA 4.0).
Selected for solo/personal product work. Full library has 52 skills — these 8 are the ones most directly useful here.

---

## Skill Index

| Skill | Type | Use when... |
|---|---|---|
| [context-engineering-advisor](context-engineering-advisor.md) | Interactive | Designing how context is structured for Claude API calls |
| [prd-development](prd-development.md) | Workflow | Writing or updating a PRD from scratch |
| [problem-framing-canvas](problem-framing-canvas.md) | Component | Clarifying a messy problem before jumping to solutions |
| [prioritization-advisor](prioritization-advisor.md) | Interactive | Choosing what to build next from a backlog |
| [epic-breakdown-advisor](epic-breakdown-advisor.md) | Interactive | Breaking a big feature (e.g. browser extension) into stories |
| [user-story](user-story.md) | Component | Writing a single development-ready user story |
| [user-story-splitting](user-story-splitting.md) | Component | Splitting a story that's too big for one sprint |
| [pol-probe-advisor](pol-probe-advisor.md) | Interactive | Choosing the cheapest way to validate an idea before building |

---

## Skill Types

- **Component** — use as a template/checklist for a single artifact
- **Interactive** — work through it as a guided conversation (ask Claude to run the skill)
- **Workflow** — multi-phase process, takes longer, produces bigger output

---

## How to use these with Claude

Say something like:

> "Run the prioritization-advisor skill on my roadmap. Here's my current backlog: [paste TODO.md or PRD roadmap section]"

Or:

> "Use the problem-framing-canvas to help me think through [feature/problem]. Ask me the questions."

The interactive skills work best when you ask Claude to ask you questions rather than generating output directly.

---

## Source

All skills from [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills).
License: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
Summaries here are condensed from the originals for quick reference. For the full skill with all examples, anti-patterns, and interactive branching logic, read the source.
