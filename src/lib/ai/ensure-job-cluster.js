/**
 * Lazy job-cluster classification — call before any v2 tailor pipeline step
 * that needs jobs.cluster_id / jobs.seniority_band populated.
 *
 * No-op if already classified. Persists result back to jobs row so subsequent
 * calls are free.
 *
 * Why lazy: most scraped jobs are never tailored. Auto-classifying every job
 * on insert would cost ~$54/mo at our scrape volume; lazy on tailor cuts that
 * by ~95% (only jobs users actually open get classified).
 */

import { classifyJobCluster } from './classify-job-cluster';

/**
 * @param {object} supabase — server-side client
 * @param {string} jobId — jobs.id
 * @returns {Promise<{ cluster_id, seniority_band, cluster_confidence } | null>}
 */
export async function ensureJobCluster(supabase, jobId) {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, title, company, description, cluster_id, seniority_band, cluster_confidence')
    .eq('id', jobId)
    .maybeSingle();

  if (error || !job) {
    console.error('[ensure-job-cluster] job not found', jobId, error?.message);
    return null;
  }

  if (job.cluster_id && job.seniority_band) {
    return {
      cluster_id: job.cluster_id,
      seniority_band: job.seniority_band,
      cluster_confidence: job.cluster_confidence,
    };
  }

  const result = await classifyJobCluster({
    title: job.title,
    company: job.company,
    description: job.description,
  });

  await supabase
    .from('jobs')
    .update({
      cluster_id: result.cluster_id,
      seniority_band: result.seniority_band,
      cluster_confidence: result.cluster_confidence,
    })
    .eq('id', jobId);

  return result;
}
