/**
 * Lazy cluster classification for job_descriptions rows (RolePitch).
 * Mirror of ensure-job-cluster.js but reads/writes job_descriptions instead of jobs.
 */

import { classifyJobCluster } from './classify-job-cluster';

/**
 * @param {object} supabase
 * @param {string} jdId — job_descriptions.id
 * @returns {Promise<{ cluster_id, seniority_band, cluster_confidence } | null>}
 */
export async function ensureJdCluster(supabase, jdId) {
  const { data: jd, error } = await supabase
    .from('job_descriptions')
    .select('id, title, company, description, cluster_id, seniority_band, cluster_confidence')
    .eq('id', jdId)
    .maybeSingle();

  if (error || !jd) {
    console.error('[ensure-jd-cluster] jd not found', jdId, error?.message);
    return null;
  }

  if (jd.cluster_id && jd.seniority_band) {
    return {
      cluster_id: jd.cluster_id,
      seniority_band: jd.seniority_band,
      cluster_confidence: jd.cluster_confidence,
    };
  }

  const result = await classifyJobCluster({
    title: jd.title,
    company: jd.company,
    description: jd.description,
  });

  await supabase
    .from('job_descriptions')
    .update({
      cluster_id: result.cluster_id,
      seniority_band: result.seniority_band,
      cluster_confidence: result.cluster_confidence,
    })
    .eq('id', jdId);

  return result;
}
