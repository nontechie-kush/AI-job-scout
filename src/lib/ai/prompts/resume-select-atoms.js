/**
 * Prompt builder for Pass 2 — Atom Selection.
 *
 * Given a story brief + the user's full atom inventory, picks 4-6 atoms per
 * role that together tell the story. This is where irrelevant content gets
 * dropped (the v2 fix for the add-only bias of the old patcher).
 *
 * Scoring rubric (from design doc):
 *   60% relevance — atoms whose tags match key_themes
 *   30% caliber   — rare metrics/scale/scope, even if off-domain. Recent > old.
 *   10% range     — one atom per role showing breadth so the role isn't one-dimensional
 *
 * Output includes dropped_atoms (with reasons) so the UI can show "Pilot dropped
 * X bullet because Y" — important for trust + audit.
 *
 * Design: careerpilot-ai/docs/resume-tailor-v2.md (Pass 2)
 */

/**
 * @param {object} params
 * @param {object} params.brief — { positioning, key_themes, caliber_signals }
 * @param {object} params.cluster — { cluster_id, seniority_band }
 * @param {Array<object>} params.atoms — full atom inventory with id + fact snippets
 * @returns {{ system: string, user: string }}
 */
export function buildResumeSelectAtomsPrompt({ brief, cluster, atoms }) {
  // Group by role for the prompt
  const byRole = new Map();
  for (const a of atoms) {
    const key = `${a.company || '—'}::${a.role || '—'}`;
    if (!byRole.has(key)) {
      byRole.set(key, {
        company: a.company,
        role: a.role,
        start_date: a.start_date,
        end_date: a.end_date,
        atoms: [],
      });
    }
    byRole.get(key).atoms.push({
      id: a.id,
      type: a.nugget_type,
      tags: a.tags,
      confidence: a.confidence,
      // Trimmed fact for selection — full fact comes back at compose time
      fact: (a.fact || '').slice(0, 180),
      metric: a.metric,
    });
  }
  // Sort roles by recency
  const roles = [...byRole.values()].sort((a, b) => {
    const ae = a.end_date || '9999-99-99';
    const be = b.end_date || '9999-99-99';
    return be.localeCompare(ae);
  });

  return {
    system: `You select which of the candidate's atoms (single facts from their work history) belong on the resume for THIS specific job. The story brief is already written — your job is to pick the atoms that serve it.

THREE PRINCIPLES (non-negotiable):
1. STORY-FIRST — every atom you pick must serve the brief's positioning + themes
2. CALIBER + RELEVANCE — recent caliber signals stay even if off-domain. The candidate must look like a high-performer, not just a good fit
3. SOURCE-TRACEABLE — never invent. You can only pick atoms from the inventory shown to you

SCORING RUBRIC (use this as your decision lens, not a literal calculator):
- RELEVANCE (60%) — does the atom's tags / domain map to the brief's key_themes? An exact theme match is worth more than a tangential one.
- CALIBER (30%) — is this atom an unusually impressive proof point? Rare metric (₹350cr, 1.8x lift), unusual scope (4 PMs, 5 countries, 0-to-1 launch), high-prestige org. Recent > old.
- RANGE (10%) — within a role, include at least one atom that shows breadth (e.g. don't pick 4 monetization atoms if the candidate also did UX work — show the dimension exists).

PER-ROLE QUOTAS:
- Most recent role (current or end_date within last 2 years): 4-6 atoms
- Second-most-recent role: 3-5 atoms
- Roles ended 2-7 years ago: 2-3 atoms
- Roles >7 years old: 0-2 atoms — only include if they prove a unique caliber signal (e.g. ₹10M+ engineering operations) that no recent role has

EMPHASIS RULES:
- For the most recent role, lean RELEVANCE — this is what the JD reader sees first
- For older roles, lean CALIBER — the older the role, the more it must justify its presence with caliber not relevance
- Never include atoms with confidence < 0.6 (already pre-filtered, but double-check)
- If two atoms are near-duplicates (same outcome, different framing), pick the one with the cleaner metric and drop the other

DROP REASONS (use exactly one per dropped atom — used for the audit UI):
- "off_theme" — doesn't map to any key_theme and isn't a caliber signal
- "redundant" — duplicates another atom you picked from the same role
- "too_old" — role too far in the past for this seniority/relevance
- "weak_signal" — vague atom (no metric, no specificity), low confidence, or pure context with no evidence
- "low_caliber" — solid atom but doesn't differentiate the candidate

OUTPUT (raw JSON only — no fences, no commentary):
{
  "selections": [
    {
      "company": "Cars24",
      "role": "Senior Product Manager",
      "atom_ids": ["uuid1", "uuid2", ...]   // 0-6 ids, ordered by descending priority
    },
    ...
  ],
  "dropped_atoms": [
    { "id": "uuid", "reason": "off_theme" },
    ...
  ]
}

Every atom in the inventory must appear in either selections.atom_ids OR dropped_atoms — exhaustive, no orphans.

Output must be a single raw JSON object. End at the closing brace. No prose.`,

    user: `STORY BRIEF (already decided — your selections must serve this):
Cluster: ${cluster.cluster_id} / ${cluster.seniority_band}
Positioning: ${brief.positioning}
Key themes: ${brief.key_themes.join(', ')}
Caliber signals to surface: ${brief.caliber_signals.join(' | ')}

ATOM INVENTORY (per role, ordered most recent first):
${JSON.stringify(roles, null, 1)}

Pick the atoms.`,
  };
}
