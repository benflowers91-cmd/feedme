# Feature Investment Advisor

**Type:** Interactive
**Source:** [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/feature-investment-advisor/SKILL.md)

---

## Purpose

Financial evaluation of feature investments. Assesses revenue impact, cost structure, ROI, and strategic value to deliver a data-driven build/don't-build recommendation.

**Use for:** Expensive features (>1 engineer-month), prioritisation decisions between quantifiable opportunities, build/buy/partner trade-offs.
**Skip for:** Table-stakes features, purely qualitative impact, <1-week efforts.

---

## Four-Step Evaluation

1. **Revenue Connection** — direct monetisation / retention / conversion / expansion / strategic-only
2. **Cost Structure** — development costs + ongoing COGS/OpEx → payback period
3. **Constraints** — competitive threats, capacity limits, dependencies
4. **Recommendation** — build / don't build / build for strategic reasons / build later

---

## Decision Patterns

| ROI | Strategic Value | Recommendation |
|---|---|---|
| >3:1 (direct) or LTV impact >10:1 (retention) | Any | Build now |
| <2:1 | High (competitive/compliance) | Build for strategic reasons — monitor closely |
| <1:1 or margin-diluting | Low | Don't build unless scope/monetisation changes |
| Uncertain assumptions | Any | Build later — validate first |

---

## Common Pitfalls

- Confusing revenue with profit
- Ignoring payback periods relative to customer lifetime
- Overestimating adoption rates
- Building without customer validation
- Using "strategic value" as a catch-all excuse for low-ROI features
