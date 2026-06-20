# User Story

**Type:** Component
**Source:** [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/user-story/SKILL.md)

---

## Purpose

Writes development-ready user stories combining Mike Cohn's persona-driven format with Gherkin acceptance criteria. Use this any time you're about to ask Claude to implement a feature — it forces you to clarify who benefits and what "done" looks like before writing any code.

> "This is not a feature spec — it's a conversation starter that captures who benefits, what they're trying to do, why it matters, and how you'll know it works."

---

## Template

```
## Use Case

As a [specific persona],
I want to [action the user takes],
So that [outcome / motivation].

## Acceptance Criteria

Scenario: [descriptive name]
  Given [precondition]
  And [additional precondition if needed]
  When [user action]
  Then [expected outcome]
  And [additional outcome if needed]

Scenario: [edge case or failure path]
  Given [precondition]
  When [user action]
  Then [expected outcome]
```

---

## Quality Checks

**Use Case:**
- Persona should be specific ("trial user", "returning cook") not generic ("user")
- "I want to" must describe an action the **user** takes, not a system behaviour
- "So that" must reveal motivation, not restate the action ("so that I can see it" is not a motivation)

**Acceptance Criteria:**
- Only one When/Then pair per scenario — multiple pairs mean the story needs splitting
- Outcomes must be measurable and testable
- Scenarios should cover happy path + at least one failure/edge case

---

## Example (FeedMe: Shopping list share)

```
## Use Case

As Ben planning a FODMAP week,
I want to share my shopping list as text,
So that I can paste it into WhatsApp or Notes without retyping it.

## Acceptance Criteria

Scenario: Copy list to clipboard
  Given I have at least one item on my shopping list
  When I tap "Copy list"
  Then all items are copied to my clipboard as plain text

Scenario: Native share on mobile
  Given I am on a mobile device that supports navigator.share()
  When I tap "Share list"
  Then the native share sheet opens with the list as text

Scenario: Share not available
  Given I am on a desktop browser without navigator.share()
  When I tap "Share list"
  Then I see the copy-to-clipboard fallback instead
```

---

## Common Pitfalls

- **Technical tasks as stories** — "Refactor the database" is not a user story
- **Feature lists** — "Allow users to do X, Y, and Z" should be three stories
- **Unmeasurably vague** — "better experience" can't be tested
- **Bundled too broadly** — if it takes more than a week to build, split it
