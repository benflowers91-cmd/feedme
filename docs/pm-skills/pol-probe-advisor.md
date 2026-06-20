# Proof of Life (PoL) Probe Advisor

**Type:** Interactive
**Source:** [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/pol-probe-advisor/SKILL.md)

---

## Purpose

Guides you to the cheapest validation method for a hypothesis before committing to building. Prevents the failure mode of choosing a validation approach based on tool familiarity rather than learning goals.

> "Use the cheapest prototype that tells the harshest truth."

Use this before starting any medium or large FeedMe feature to confirm the assumption at risk is actually worth testing.

---

## 5 Probe Types

| Probe | What it tests | Cost |
|---|---|---|
| **Feasibility Check** | Technical viability | 1-2 days |
| **Task-Focused Test** | Can a user complete the task? | 2-5 days |
| **Narrative Prototype** | Does this story resonate with stakeholders? | 1-3 days |
| **Synthetic Data Simulation** | Does the logic hold under edge cases? | 2-4 days |
| **Vibe-Coded PoL Probe** | Does a real user interact with this workflow naturally? | 2-3 days |

---

## Four-Step Process

**Step 0 — Define the hypothesis:**
- What are you testing?
- What's the risk if you're wrong?
- Timeline and resources available?

**Step 1 — Identify the core question:**
What single question, if answered, most reduces risk?

**Step 2 — Match probe type:**
Pick the cheapest probe that answers that question. Don't build more than you need.

**Step 3 — Define success criteria:**
What result would confirm / disconfirm the hypothesis?

**Step 4 — Refine if needed:**
If the hypothesis is too broad to test in one probe, split it.

---

## Example (FeedMe: Browser Extension)

| Hypothesis | Risk | Probe |
|---|---|---|
| "The extension can share the Google OAuth session cookie" | High — if wrong, need separate auth flow | Feasibility Check (1-2 days: read Chrome extension auth docs, test session sharing) |
| "One-click adapt from any recipe page is faster than the current flow" | Medium — it might not be worth the complexity | Task-Focused Test (watch yourself use the current flow vs. mocked extension) |
| "Users want to see the substitution picker inline, not auto-apply" | Low — can always add picker later | Defer — not worth validating before MVP |

---

## Common Pitfalls

- **Choosing a probe based on what tools you know** — "I'll just build a prototype" defaults to code when a doc or a walk-through would suffice
- **Testing multiple variables at once** — one probe, one question
- **Impressive prototype ≠ informative prototype** — a polished Figma that users say "looks great" tells you nothing about whether they'd use it
- **Skipping the probe** — "I already know users want this" is when you need it most
