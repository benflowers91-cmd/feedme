# PRD Development

**Type:** Workflow
**Source:** [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/prd-development/SKILL.md)

---

## Purpose

Transforms scattered discovery notes into a structured PRD that aligns stakeholders and guides engineering execution. The FeedMe PRD already exists at `docs/PRD.md` — use this skill when expanding sections, adding new features, or revisiting the document as the product evolves.

A PRD is a **living document**, not a waterfall spec. It captures strategic context.

---

## The 8-Phase Structure

| Phase | Content | Time |
|---|---|---|
| 1. Executive Summary | One paragraph: problem + solution + expected impact | 30 min |
| 2. Problem Statement | Evidence-backed pain point framing | 60 min |
| 3. Target Users & Personas | Primary and secondary user profiles with goals | 45 min |
| 4. Strategic Context | Business goals, market, competitive positioning, urgency | 60 min |
| 5. Solution Overview | High-level description + user flows (not pixel specs) | 90 min |
| 6. Success Metrics | Primary metric, secondary indicators, guardrail thresholds | 45 min |
| 7. User Stories & Requirements | Epic hypothesis → testable stories with acceptance criteria | 120 min |
| 8. Out of Scope & Dependencies | Explicit boundaries, risks, open questions | 30 min |

---

## Key Principles

- Phase 7 (user stories) should be co-written with design and engineering, not solo
- "Out of Scope" is as important as what's in scope — prevents scope creep
- Success metrics should have guardrail thresholds, not just targets
- PRD sections that stay empty ("TBD") are technical debt — flag them

---

## Common Pitfalls

- **Frozen spec syndrome** — treating the PRD as a contract rather than a conversation
- **Metrics theater** — tracking metrics that don't drive decisions
- **Missing guardrails** — success metrics without thresholds ("more is better" isn't a metric)
- **Solution-first PRDs** — writing solution before validating the problem statement
