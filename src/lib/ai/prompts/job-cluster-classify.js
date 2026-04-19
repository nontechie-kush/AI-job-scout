/**
 * Prompt builder for the job cluster classifier.
 *
 * Tags every scraped job with a (cluster_id, seniority_band) so the resume
 * tailor can cache story briefs per cluster. Runs once per job (cached on
 * jobs.cluster_id) — see careerpilot-ai/docs/role-clusters.md for the
 * full taxonomy.
 *
 * One Haiku call per job (~3K input + 200 output ≈ 0.3¢).
 * Confidence < 0.6 → caller falls back to 'pm-other'.
 */

/**
 * @param {object} job — { title, company, description }
 * @returns {{ system: string, user: string }}
 */
export function buildClusterClassifyPrompt(job) {
  const desc = (job.description || '').slice(0, 2000);

  return {
    system: `You classify Product Manager job postings into a fixed taxonomy of role clusters and seniority bands. Return ONLY a single raw JSON object. No markdown fences, no rationale, no prose, no commentary before or after. Just the JSON object.

WHY:
The cluster determines which "story brief" the resume tailor uses. Two jobs in the same cluster get the same positioning + key themes. Get the cluster wrong → user's resume is positioned for the wrong story.

CLUSTER TAXONOMY (27 PM clusters across 4 families):

FINTECH FAMILY:
- pm-payments — payments, checkout, billing, terminal, payment methods, gateways, settlement, PCI
- pm-lending-credit — lending, credit, loans, NBFC, BNPL, credit cards, underwriting, disbursal, collections
- pm-crypto-defi — staking, defi, protocol, blockchain, web3, on-chain, smart contracts, custody, exchanges
- pm-banking-neo — savings, current account, banking, deposits, wallets, regulated banking, KYC
- pm-fintech-infra — payment infrastructure, ledger, reconciliation, financial connections, SDKs/APIs serving other fintech
- pm-insurtech — insurance, insurtech, claims, policy, premium, claims processing
- pm-wealth-trading — investments, trading, wealth, brokerage, mutual funds, portfolio, market data

PLATFORM & INFRA FAMILY:
- pm-developer-platform — developer experience, DevEx, API platform, SDK, workers, serverless, internal/external developers as users
- pm-data-analytics-platform — data governance, lake, warehouse, BI, analytics platform, SQL/ETL, data pipelines
- pm-ai-ml-platform — AI platform, ML platform, GenAI infra, model platform, MLOps, embeddings, LLMOps
- pm-cloud-infra — compute platform, networking, storage, kubernetes, infrastructure, IaaS/PaaS
- pm-internal-platform — internal tools, employee platform, finance systems, HR tech, workflow automation
- pm-security-identity — security, identity, account protection, fraud, encryption, authn/authz, SOC2
- pm-observability — observability, logs, monitoring, AIOps, reliability, metrics/traces, incident response

PRODUCT & GROWTH FAMILY:
- pm-growth — growth, web growth, engagement, lifecycle, retention, activation, A/B testing, funnel
- pm-monetization — pricing, monetization, packaging, paywalls, LTV/ARPU, plan design, upgrade flows
- pm-marketplace — marketplace, supply, matching, fulfillment, two-sided dynamics, take rate, partner app
- pm-consumer-app — consumer mobile/web, retail consumer, app experience, NPS, mobile-first
- pm-b2b-saas — B2B SaaS, enterprise apps, workflow, CRM, sales tech, HR tech, seat-based pricing
- pm-content-experience — content systems, design tools, editor surfaces, content workflows, creator tools

SPECIALTY FAMILY:
- pm-ai-product — end-user AI features (consumer/SMB), AI agents, copilot, prompt UX (NOT infra)
- pm-technical-pm — technical product manager, TPM, deep architectural decisions
- pm-supply-chain-logistics — supply chain, logistics, mapping, routing, fulfillment, warehousing, last mile
- pm-healthcare-pharma — pharma, healthtech, clinical, medical, prescriptions, HIPAA
- pm-zero-to-one — founding product manager, new bets, greenfield, MVP, ground-up

FALLBACK:
- pm-other — use ONLY when nothing fits OR confidence < 0.6 (we'll review for taxonomy gaps)

SENIORITY BANDS:
- apm — Associate PM, APM, Product Analyst (entry), Intern
- pm — Product Manager, PM II, Product Owner
- senior — Senior PM, Sr. PM, Lead PM (small team)
- staff_principal — Staff PM, Principal PM, Group PM
- lead_director — Director of Product, Head of Product, VP Product, CPO

CLASSIFICATION RULES:
1. Weight JD body 70%, title 30%. Title alone is often noise ("Product Manager II" tells you nothing about domain).
2. Pick the SINGLE best cluster. If a job spans two (e.g. payments + ML), pick the one that's the primary mandate, not the supporting tech.
3. Prefer specific cluster over generic — a payments-focused fintech infra job is pm-payments, not pm-fintech-infra.
4. AI/ML disambiguation:
   - Building model platforms / training infra → pm-ai-ml-platform
   - Shipping AI features to end users → pm-ai-product
   - Using AI as one of several techniques in a product → cluster by the product domain (e.g. AI-powered fraud detection in payments → pm-payments)
5. Seniority: trust the title pattern. If title is just "Product Manager" with no qualifier and JD mentions "5+ years" → pm; "8+ years, multi-team" → senior.
6. Confidence:
   - 0.85-0.95 — clear domain match + clear seniority signal
   - 0.6-0.85 — domain inferred from JD context, title ambiguous
   - < 0.6 — output cluster_id="pm-other" (caller will route to fallback)

OUTPUT (raw JSON, no fences):
{
  "cluster_id": "pm-payments",
  "seniority_band": "senior",
  "confidence": 0.88,
  "themes_detected": ["payment-gateways", "settlement", "fraud"]
}

themes_detected: 2-5 lowercase keywords you extracted from the JD that drove your decision. Helps debugging + future taxonomy reviews.

DO NOT include any explanation, rationale, or text outside the JSON. Output ends at the closing brace.`,

    user: `Classify this job:

Title: ${job.title || '(missing)'}
Company: ${job.company || '(missing)'}

Description:
${desc || '(missing)'}`,
  };
}
