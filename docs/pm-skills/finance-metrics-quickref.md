# Finance Metrics Quick Reference

**Type:** Component
**Source:** [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/blob/main/skills/finance-metrics-quickref/SKILL.md)

---

## Purpose

Fast-lookup cheat sheet for SaaS finance metrics. Use when you need a formula or benchmark quickly. Not for learning these metrics for the first time — see `saas-economics-efficiency-metrics.md` and `saas-revenue-growth-metrics.md` for that.

---

## Metric Families

### Revenue & Growth
| Metric | Formula | Healthy Benchmark |
|---|---|---|
| MRR/ARR | Monthly/Annual recurring revenue | — |
| ARPU | Revenue / Active Users | — |
| NRR | (Start MRR + Expansion - Churn - Contraction) / Start MRR | >100% |
| Quick Ratio | (New + Expansion MRR) / (Churned + Contraction MRR) | >4 |
| Churn Rate | Lost MRR / Start MRR | <2%/month |

### Unit Economics
| Metric | Formula | Healthy Benchmark |
|---|---|---|
| Gross Margin | (Revenue - COGS) / Revenue | 70–85% |
| CAC | S&M Spend / New Customers | Varies by segment |
| LTV | ARPU × Gross Margin % / Monthly Churn | 3× CAC minimum |
| LTV:CAC | LTV / CAC | >3:1 |
| Payback Period | CAC / (Monthly ARPU × Gross Margin %) | <12 months |

### Capital Efficiency
| Metric | Formula | Healthy Benchmark |
|---|---|---|
| Burn Rate | Monthly Cash Out - Monthly Revenue | Net <$200K early stage |
| Runway | Cash Balance / Monthly Net Burn | >12 months |
| Rule of 40 | Revenue Growth % + Profit Margin % | >40 |
| Magic Number | (Q Revenue - Q-1 Revenue) × 4 / Q-1 S&M Spend | >0.75 |

---

## Red Flags by Category

**Revenue:** NRR <100%, churn increasing, Quick Ratio <2, top customer >25% of revenue

**Unit economics:** LTV:CAC <1.5:1, payback >24 months, gross margin <60%

**Capital efficiency:** Runway <6 months, OpEx outpacing revenue growth, Rule of 40 <25

---

## Four Decision Frameworks (Quick)

- **Feature investment:** Build if ROI >3× annually or LTV impact >10× dev cost
- **Channel scaling:** Scale when LTV:CAC >3:1 AND payback <18 months AND Magic Number >0.75
- **Pricing changes:** Implement if net revenue impact is positive after modelling churn risk
- **Business health check:** Match benchmarks to your stage (see `business-health-diagnostic.md`)
