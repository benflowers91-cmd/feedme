@AGENTS.md

# About this project

FeedMe is a personal FODMAP meal planning app built by Ben for personal use. Single-user. No onboarding, no multi-tenancy. Dietary constraints are non-negotiable: FODMAP sensitivity + no shellfish under any circumstances.

Full product context is in `docs/PRD.md` — treat it as the source of truth for what's built, what's planned, and what's explicitly out of scope. Check it before proposing new work.

# Working style

**Prioritisation:** Use ICE scoring (Impact × Confidence × Ease) when deciding what to build next. The backlog lives in `TODO.md` and `docs/PRD.md` (Roadmap section).

**New features:** Before designing a solution, run through `docs/pm-skills/problem-framing-canvas.md`. Don't jump to implementation before the problem is clearly framed.

**Validation:** Default to the cheapest proof-of-life first. See `docs/pm-skills/pol-probe-advisor.md` before committing to any medium or large build.

**Feature specs:** Use `docs/pm-skills/user-story.md` as the template for writing stories before implementation.

# AI prompt code

When reviewing or writing any code that touches Claude API calls, prompts, or context assembly (e.g. `lib/fodmap-prompt.ts`, API route handlers), apply the context engineering principles in `docs/pm-skills/context-engineering-advisor.md`:
- Treat AI attention as a scarce resource — pass only what the specific task needs
- Follow the Research → Plan → Reset → Implement cycle
- Diagnose before adding context — more tokens is rarely the fix

# PM skills reference

Full index at `docs/pm-skills/README.md`.
