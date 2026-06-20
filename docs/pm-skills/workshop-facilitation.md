# Workshop Facilitation

**Type:** Component
**Source:** [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/workshop-facilitation/SKILL.md)

---

## Purpose

The interaction protocol used by all interactive skills in this library. Provides consistent pacing, progress tracking, and adaptive guidance. Understanding this pattern helps you get better results from any interactive skill.

---

## Core Principles

**One step at a time.** Ask a single targeted question per turn.

**Show progress.** Sessions display labels like `Context Q3/8` or `Scoring Q2/5` so participants know where they stand.

**Flexible entry.** Choose how to begin:
1. **Guided** — sequential questions, one at a time
2. **Context dump** — share what you know upfront, skip redundant questions
3. **Best guess** — facilitator infers details and labels assumptions, keeps moving

---

## Key Facilitation Moves

**Decision points with numbered options.** Recommendations appear only when choices matter — after context synthesis, not after every answer.

**Flexible input handling.** Accept: `1` / `1 and 3` / `1,3` / custom text. Synthesise multi-select choices before continuing.

**Interruption management.** If you ask a meta question ("how much longer?"), the facilitator answers directly, restates progress, and resumes the pending question.

---

## Session Structure

1. Brief heads-up on time and question count
2. Mode selection (guided / dump / best guess)
3. One question per turn with quick-select options where practical
4. Progress labels after each answer
5. Synthesis and numbered recommendations at decision points
6. Clear summary with validated assumptions at the end

---

## Anti-Patterns in Facilitation

- Hiding progress — participants not knowing how much remains creates anxiety
- Offering recommendations after every answer — creates interaction drag
- Asking for information the facilitator should infer
- Dumping 10 questions at once
- Offering vague options — each choice should be meaningfully distinct
