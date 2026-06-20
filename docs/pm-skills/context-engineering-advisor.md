# Context Engineering Advisor

**Type:** Interactive
**Source:** [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/context-engineering-advisor/SKILL.md)

---

## Purpose

Helps you diagnose whether your AI prompts are doing **context stuffing** (adding volume without strategy) or **context engineering** (structuring information deliberately). Directly applicable to how FeedMe's Claude calls are structured in `lib/fodmap-prompt.ts` and the API routes.

> "Context stuffing assumes volume = quality. Context engineering treats AI attention as a scarce resource and allocates it deliberately."

Accuracy drops significantly when context exceeds ~32k tokens — more is not always better.

---

## Key Concepts

**Context stuffing markers (avoid these):**
- Reflexively expanding context windows when output is poor
- Persisting everything "just in case"
- Chaining agents without clear context boundaries
- Adding retry logic to mask inconsistency rather than fixing structure
- Normalising retries as acceptable

**The five diagnostic questions:**
1. What specific decision does this context support?
2. Can retrieval replace persistence? (Do I need to pass this in, or can I look it up?)
3. Who owns the context boundary?
4. What fails if we exclude this?
5. Are we fixing structure or avoiding it?

---

## Application

**The Research → Plan → Reset → Implement cycle:**

1. **Research phase** — gather info, explore, ask questions with full context
2. **Plan phase** — synthesise into a structured plan, still with context
3. **Reset** — clear the context window. Start fresh.
4. **Implement phase** — pass only the plan and what's directly needed. No raw research baggage.

This prevents "context rot" — where accumulated conversation history degrades output quality over time.

**Memory architecture:**
- **Short-term:** Single-session interaction history (current conversation)
- **Long-term:** Persistent preferences and facts via structured storage (e.g. pantry DB, user profile)

---

## For FeedMe specifically

Applied to the current codebase:
- The FODMAP system prompt in `lib/fodmap-prompt.ts` is a good example of deliberate context: it passes constraints, not entire recipe databases
- For the Adapt flow: pass the recipe text + substitution rules, not the full pantry
- For Find/suggestions: pass pantry items + dietary rules, not conversation history

---

## Common Pitfalls

- **Dumping the whole PRD into every prompt** — pick the slice relevant to the task
- **Using longer prompts to fix bad output** — usually the problem is structure, not length
- **Persisting session history indefinitely** — reset between distinct tasks
- **Evaluating output without understanding why it failed** — diagnose before adding context
