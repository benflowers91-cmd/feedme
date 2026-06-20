# Skill Authoring Workflow

**Type:** Workflow
**Source:** [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/skill-authoring-workflow/SKILL.md)

---

## Purpose

Converts rough materials — workshop notes, drafts, incomplete content — into validated, publication-ready PM skills compliant with the deanpeters/Product-Manager-Skills repo standards. Use this when adding new skills to the library.

---

## Six Phases

**Phase 1: Preflight**
- Search for overlapping skills
- Decide skill type (component / interactive / workflow)

**Phase 2: Generate Draft**
- Use `add-a-skill.sh` for source material, or `build-a-skill.sh` for guided prompts

**Phase 3: Tighten**
- Clear usage guidance
- One concrete example
- One anti-pattern
- Remove filler language

**Phase 4: Validate**
- Run `test-a-skill.sh --smoke`
- Run `check-skill-metadata.py`
- Trigger validation checks

**Phase 5: Integrate**
- Update README category tables and counts
- Verify link resolution

**Phase 6: Package (Optional)**
- Use `zip-a-skill.sh` for Claude custom skill uploads

---

## Definition of Done

A skill is done only when:
- Frontmatter has valid `name`, `description`, `intent`, `type`
- Section order complies with standards
- `name` ≤64 chars; `description` ≤200 chars
- Description explains both function AND triggering conditions
- Cross-references resolve
- README catalog updated with counts

---

## Critical Pitfalls

- Shipping without validation
- Mismatched skill types (template treated as workflow)
- Bloated descriptions exceeding character limits
- Weak descriptions that omit usage context
- Forgetting README updates after adding skills
