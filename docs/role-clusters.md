# Role Clusters — Taxonomy v1

**Status:** Draft for Resume Tailor v2 (see `resume-tailor-v2.md`)
**Last updated:** 2026-04-19
**Scope:** PM-shaped roles only (~80% of current job board volume). Other functions added when needed.
**Method:** Drafted from 554 real PM titles in `jobs` table (April 2026 snapshot) + common-knowledge taxonomy of PM specializations.

---

## How a cluster is decided

A cluster is a group of roles that share **the same story brief**. If two jobs would produce ~the same positioning + key themes + caliber signals when fed to Pass 1, they belong in the same cluster.

**Cluster signature** for the classifier:
- `domain_themes`: industry/domain keywords found in title or JD (`payments`, `lending`, `infrastructure`)
- `function_themes`: PM-function keywords (`growth`, `platform`, `0-to-1`, `technical`)
- `seniority_band`: `apm` | `pm` | `senior` | `staff_principal` | `lead_director`

Two jobs collapse to the same cluster if `domain_themes ∩ ≥ 1`, `function_themes ∩ ≥ 1`, and `seniority_band` matches (with adjacent bands tolerated).

---

## Seniority bands

| Band | Title patterns |
|---|---|
| `apm` | Associate Product Manager, APM, Product Analyst (entry), Intern |
| `pm` | Product Manager, Product Manager II, Product Owner |
| `senior` | Senior PM, Sr. PM, Lead PM (small team) |
| `staff_principal` | Staff PM, Principal PM, Group PM |
| `lead_director` | Director of Product, Head of Product, VP Product, CPO |

Adjacent bands tolerated for clustering (a `senior` and `staff_principal` payments job can share a brief if other dims match).

---

## Domain clusters (PM)

### Fintech family

| Cluster ID | Name | Title keywords | JD signals |
|---|---|---|---|
| `pm-payments` | Payments | payments, checkout, billing, terminal, payment methods, bank transfers, local payment | payment processing, gateways, settlement, PCI, fraud at payment layer |
| `pm-lending-credit` | Lending & Credit | lending, credit, loans, NBFC, BNPL, cards (credit) | underwriting, disbursal, collections, credit risk, KYC |
| `pm-crypto-defi` | Crypto & DeFi | staking, defi, protocol, blockchain, web3, liquidity (in crypto context) | on-chain, smart contracts, custody, exchange, tokens |
| `pm-banking-neo` | Banking & Neobank | savings, current account, banking, deposits, wallets | regulated banking, RBI/Fed compliance, deposits, KYC |
| `pm-fintech-infra` | Fintech Infrastructure | financial connections, payment infrastructure, ledger, reconciliation | SDKs/APIs serving other fintech, ledger systems, accounting infra |
| `pm-insurtech` | Insurance | insurance, insurtech, claims, underwriting (insurance) | policy, premium, claims processing |
| `pm-wealth-trading` | Wealth & Trading | investments, trading, wealth, brokerage, mutual funds | portfolio, trading systems, market data, regulated investment |

### Platform & infra family

| Cluster ID | Name | Title keywords | JD signals |
|---|---|---|---|
| `pm-developer-platform` | Developer Platform | developer experience, devex, API platform, SDK, workers, serverless | DX, docs, SDK design, internal/external developers as users |
| `pm-data-analytics-platform` | Data & Analytics Platform | data governance, dbsql, lakeflow, lake, warehouse, BI, analytics platform | SQL/ETL, data pipelines, governance, query performance |
| `pm-ai-ml-platform` | AI/ML Platform | AI platform, ML platform, foundations, GenAI infra, model platform | model training/serving, MLOps, embeddings, LLMOps |
| `pm-cloud-infra` | Cloud Infrastructure | compute platform, networking, storage, kubernetes, infrastructure | provisioning, scaling, IaaS/PaaS, cloud-native primitives |
| `pm-internal-platform` | Internal Tools / Platform | internal AI, internal tools, employee platform, finance systems, HR tech | internal users, workflow automation, internal-only systems |
| `pm-security-identity` | Security & Identity | security, identity, account protection, fraud, compliance ux, encryption, private computing | authn/authz, threat models, audit, SOC2, encryption |
| `pm-observability` | Observability & Reliability | observability, logs, monitoring, AIOps, reliability | metrics/logs/traces, incident response, SRE adjacent |

### Product & growth family

| Cluster ID | Name | Title keywords | JD signals |
|---|---|---|---|
| `pm-growth` | Growth | growth, web growth, engagement, lifecycle, retention, activation | funnel metrics, A/B testing, top-of-funnel, conversion |
| `pm-monetization` | Monetization & Pricing | pricing, monetization, revenue, packaging, billing (revenue side) | LTV/ARPU, plan design, paywalls, upgrade flows |
| `pm-marketplace` | Marketplace / Supply-Demand | marketplace, supply, matching, fulfillment, rider, driver, partner app | two-sided dynamics, supply quality, take rate, matching |
| `pm-consumer-app` | Consumer Mobile/Web | rider product, app experience, consumer, web (consumer) | retail consumer, app store, NPS, mobile-first |
| `pm-b2b-saas` | B2B SaaS | B2B SaaS, enterprise apps, workflow, CRM, sales tech, HR tech | seat-based pricing, admin/user split, enterprise-tier features |
| `pm-content-experience` | Content & UX | content experience, design tools, omni analysis, content systems | editor surfaces, content workflows, creator tools |

### Specialty family

| Cluster ID | Name | Title keywords | JD signals |
|---|---|---|---|
| `pm-ai-product` | AI Product (consumer/SMB) | AI agents, AI product, GenAI product, copilot | end-user AI features (not infra), prompt UX, AI safety in product |
| `pm-technical-pm` | Technical PM | technical product manager, TPM | deep architectural decisions, engineering-heavy product calls |
| `pm-supply-chain-logistics` | Supply Chain & Logistics | supply chain, logistics, mapping, routing, fulfillment | warehousing, last mile, routing, inventory |
| `pm-healthcare-pharma` | Healthcare & Pharma | pharma, healthtech, clinical, diabetic, oral insulin, medical | regulated medical, prescriptions, clinical workflows, HIPAA |
| `pm-zero-to-one` | 0→1 Founding | founding product manager, new bets, ground up, start up product | greenfield, ambiguity, wear-many-hats, MVP |

---

## Cluster matrix (cluster_id × seniority_band)

The actual cluster used for caching is `{cluster_id}-{seniority_band}` because the *story* differs by seniority even within a domain.

Example: `pm-payments-senior` vs `pm-payments-staff_principal` are different cached briefs:
- `senior` brief leads with execution depth, ownership of one product area
- `staff_principal` brief leads with strategy, cross-team influence, multi-product scope

Total combinations: 27 clusters × 5 bands = **135 possible cache keys**. In practice, an active user touches ~5-8.

---

## Classifier

A small Haiku call, called once per `jobs` row insert, cached on `jobs.cluster_id`:

```
INPUT: { title, company, description (first 2000 chars) }
OUTPUT: { cluster_id, seniority_band, confidence, themes_detected[] }
```

Prompt has the cluster table above embedded as the spec. Confidence < 0.6 → falls back to `pm-other` (uncategorized) and we log for taxonomy review.

Per call: ~3K input + 200 output ≈ 0.3¢. With a per-job cache, this is one-time per scraped job → trivial cost.

---

## Maintenance

- New cluster proposed when 5+ jobs land in `pm-other` with similar themes — manual review weekly during build, monthly once stable
- Taxonomy lives here in source control; bumping the file invalidates story briefs (`knowledge_base_version` bump on briefs that used the moved cluster)
- Other-function clusters (Eng, Design, Sales, etc.) added in their own sections when those job types appear in the system. PM is the only audience for v1.

---

## Open questions for build

1. **`pm-other` fallback** — when classifier confidence is low. Do we run the full pipeline anyway (treat each `pm-other` job as a fresh cluster), or block tailoring with "we don't recognize this role shape — chat with Pilot to clarify"? Probably the former with a "this is an unusual one" note in the brief.

2. **Cross-cluster atom reuse** — when a user has atoms tagged `payments` AND a job in `pm-fintech-infra`, do those atoms qualify? Yes — selection is tag-driven, not cluster-locked. Cluster only drives the *brief*, not which atoms get selected.

3. **Title vs JD weighting** — title alone is often unreliable ("Product Manager II" tells us nothing). Classifier should weight JD body 70%, title 30%.
