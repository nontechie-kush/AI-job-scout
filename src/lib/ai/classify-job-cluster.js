/**
 * Job cluster classifier — wraps the Haiku prompt and returns
 * { cluster_id, seniority_band, cluster_confidence, themes_detected }.
 *
 * Idempotent caller pattern: check jobs.cluster_id before calling.
 * Falls back to 'pm-other' on confidence < 0.6 or any failure.
 *
 * Design: careerpilot-ai/docs/role-clusters.md
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildClusterClassifyPrompt } from './prompts/job-cluster-classify';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_CLUSTERS = new Set([
  // Fintech
  'pm-payments', 'pm-lending-credit', 'pm-crypto-defi', 'pm-banking-neo',
  'pm-fintech-infra', 'pm-insurtech', 'pm-wealth-trading',
  // Platform & infra
  'pm-developer-platform', 'pm-data-analytics-platform', 'pm-ai-ml-platform',
  'pm-cloud-infra', 'pm-internal-platform', 'pm-security-identity', 'pm-observability',
  // Product & growth
  'pm-growth', 'pm-monetization', 'pm-marketplace', 'pm-consumer-app',
  'pm-b2b-saas', 'pm-content-experience',
  // Specialty
  'pm-ai-product', 'pm-technical-pm', 'pm-supply-chain-logistics',
  'pm-healthcare-pharma', 'pm-zero-to-one',
  // Fallback
  'pm-other',
]);

const VALID_BANDS = new Set(['apm', 'pm', 'senior', 'staff_principal', 'lead_director']);

const FALLBACK = {
  cluster_id: 'pm-other',
  seniority_band: 'pm',
  cluster_confidence: 0.0,
  themes_detected: [],
};

function tolerantParse(rawText) {
  const stripped = rawText
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const first = stripped.indexOf('{');
    const last = stripped.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
      throw new Error('Classifier output unparseable');
    }
    return JSON.parse(stripped.slice(first, last + 1));
  }
}

/**
 * @param {object} job — { title, company, description }
 * @returns {Promise<{ cluster_id, seniority_band, cluster_confidence, themes_detected }>}
 */
export async function classifyJobCluster(job) {
  try {
    const { system, user } = buildClusterClassifyPrompt(job);

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0.1,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const raw = msg.content[0].text.trim();
    const parsed = tolerantParse(raw);

    let cluster_id = parsed.cluster_id;
    const seniority_band = parsed.seniority_band;
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    const themes = Array.isArray(parsed.themes_detected) ? parsed.themes_detected : [];

    if (!VALID_CLUSTERS.has(cluster_id)) {
      console.warn(`[classify-job-cluster] invalid cluster_id "${cluster_id}" → pm-other`);
      cluster_id = 'pm-other';
    }
    if (!VALID_BANDS.has(seniority_band)) {
      console.warn(`[classify-job-cluster] invalid seniority_band "${seniority_band}" → pm`);
      return {
        cluster_id,
        seniority_band: 'pm',
        cluster_confidence: confidence,
        themes_detected: themes,
      };
    }

    // Sub-threshold confidence → demote to pm-other so taxonomy reviewer sees it
    if (confidence < 0.6) {
      return {
        cluster_id: 'pm-other',
        seniority_band,
        cluster_confidence: confidence,
        themes_detected: themes,
      };
    }

    return {
      cluster_id,
      seniority_band,
      cluster_confidence: confidence,
      themes_detected: themes,
    };
  } catch (err) {
    console.error('[classify-job-cluster] failed:', err.message);
    return FALLBACK;
  }
}
