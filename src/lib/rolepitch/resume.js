export function buildStructuredResume(parsed = {}) {
  return {
    name: parsed.name || '',
    title: parsed.title || '',
    contact: parsed.contact || {},
    summary: parsed.summary || '',
    experience: (parsed.experience || []).map(role => ({
      title: role.title || '',
      company: role.company || '',
      location: role.location || '',
      start_date: role.start_date || null,
      end_date: role.end_date || null,
      bullets: (role.bullets || []).map(b => ({
        text: typeof b === 'string' ? b : (b?.text || ''),
        type: typeof b === 'string' ? 'achievement' : (b?.type || 'achievement'),
      })).filter(b => b.text),
    })),
    education: (() => {
      const ed = Array.isArray(parsed.education_detail) ? parsed.education_detail
        : Array.isArray(parsed.education) ? parsed.education
        : [];
      return ed.map(e => ({
        degree: e.degree || '',
        institution: e.institution || '',
        start_date: e.start_date || null,
        end_date: e.end_date || null,
      }));
    })(),
    skills: parsed.skills || [],
  };
}

export function summarizeBaseResume(profile = {}) {
  const sr = profile.structured_resume || {};
  const pj = profile.parsed_json || {};
  const resume = Object.keys(sr).length ? sr : pj;
  const latestRole = resume.experience?.[0] || {};

  return {
    id: profile.id,
    parsed_at: profile.parsed_at,
    source: profile.source || null,
    has_layout: !!(profile.original_html || profile.original_pdf_path),
    name: resume.name || pj.name || '',
    title: resume.title || pj.title || latestRole.title || '',
    company: latestRole.company || '',
  };
}
