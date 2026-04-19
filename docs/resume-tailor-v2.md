# Resume Tailor v2 — Knowledge-Base-Driven Composition

**Status:** Design — not yet built
**Last updated:** 2026-04-19
**Owner:** Kushendra
**Replaces:** Current chat-driven patcher (`resume-content`, `resume-apply-changes`, `resume-auto-fix`)

---

## TL;DR

The current Resume Tailor treats the original resume as the source of truth and chat as a way to **patch** it. This is why bullets only get added (never replaced for relevance), why irrelevant bullets survive every tailoring, and why the model can't think holistically about what story the resume tells.

v2 inverts the model: **the user is a knowledge base of source-attributed atoms; the resume is a rendering of selected atoms in service of a story.** Per job we (1) write a story brief, (2) select atoms that serve the brief, (3) compose them into bullets in the user's voice. Selection naturally drops irrelevant content, gaps trigger composition from memory atoms (not fabrication), and a reuse cache makes the 50th tailoring for the same role-cluster cost ~zero.

Three principles, non-negotiable:

1. **Story-first** — pick a narrative for the role, then assemble bullets to serve it
2. **Caliber + relevance** — recent caliber signals stay even if off-domain; the resume must say *"I can do this job"* AND *"I am the kind of person who delivers"*
3. **Source-traceable** — every claim cites a real atom; rephrase yes, fabricate never

---

## Why the current architecture is wrong

Today:

- `profiles.structured_resume` — frozen bullets parsed from the original PDF
- `tailored_resumes.tailored_version` — JSON document we mutate per job via add/replace operations
- `resume-content` chat — reactive: sees `gaps` from `weak_bullets`/`missing_signals`, asks STAR questions, proposes `add` (rarely `replace`) operations
- `user_experience_memory` — already-extracted nuggets from past chats, fed into chat prompt as supporting context

Problems this causes:

1. **Add-only bias.** Chat is gap-driven. A weak existing bullet that doesn't match a JD theme is invisible to the agent — it just gets a new bullet appended next to it.
2. **No global view.** The agent sees the top 3 experience entries but doesn't reason about "which 6 of these 30 bullets best tell the story for this JD."
3. **Memory is a side input.** `user_experience_memory` is treated as helpful context to avoid re-asking questions — not as the primary input to bullet generation.
4. **No narrative.** Every change is local (one bullet at a time). Nothing in the system asks "what is the *positioning* for this job?"
5. **Patches accumulate.** With 750 tailorings/month, the document drifts further from a coherent resume each time.

---

## Data model

### Atoms (`user_experience_memory`, extended)

The existing table already has the right shape. Two additions needed:

```sql
ALTER TABLE user_experience_memory
  ADD COLUMN IF NOT EXISTS source_type TEXT
    CHECK (source_type IN ('original_resume', 'chat_extraction', 'manual'))
    NOT NULL DEFAULT 'chat_extraction',
  ADD COLUMN IF NOT EXISTS source_bullet_id TEXT,  -- e.g. 'b_007' from structured_resume
  ADD COLUMN IF NOT EXISTS start_date DATE,         -- for recency weighting
  ADD COLUMN IF NOT EXISTS end_date DATE;
```

Existing columns we keep using:
- `nugget_type` — achievement / skill_usage / context / metric
- `company`, `role`, `fact`, `metric`, `tags`, `confidence`
- `source_match_id`, `source_conversation_id` — provenance
- `last_used_at`, `use_count` — for staleness/popularity ranking

**Atomization (one-time per resume upload):**
- Run once when `structured_resume` is created or updated
- For each bullet in `structured_resume.experience[].bullets[]`: ask Opus to break it into 1-3 atoms
- Example: `"Increased revenue 1.8x by enhancing Core Auction Platform Tech, achieving ₹350+cr in 2024"` →
  - `{ nugget_type: 'achievement', fact: 'Revenue grew 1.8x at Cars24 in 2024', metric: {value: 1.8, unit: 'x', type: 'revenue_lift'}, source_bullet_id: 'b_001', source_type: 'original_resume' }`
  - `{ nugget_type: 'metric', fact: 'Drove ₹350+cr revenue in 2024 from Cars24 auction platform', metric: {value: 350, unit: 'cr_inr', type: 'revenue'}, source_bullet_id: 'b_001' }`
  - `{ nugget_type: 'skill_usage', fact: 'Rebuilt the Cars24 Core Auction Platform tech stack', tags: ['platform', 'auctions', 'b2b-saas'], source_bullet_id: 'b_001' }`
- Atoms stay linked to source bullet so we can always trace back

**Chat extraction (already built):**
- After a finalized resume conversation, `extract-memory` adds new atoms from user messages
- These get `source_type = 'chat_extraction'`, `source_conversation_id = X`

### Story brief (`resume_story_briefs`, new table)

```sql
CREATE TABLE IF NOT EXISTS resume_story_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cluster key — what role-shape this brief serves
  role_cluster TEXT NOT NULL,         -- e.g. 'pm-payments', 'pm-growth', 'pm-platform'
  seniority TEXT,                     -- 'ic', 'lead', 'principal'

  -- The brief itself
  positioning TEXT NOT NULL,          -- 2-3 sentences: "lead with X, support with Y, deemphasize Z"
  key_themes TEXT[] NOT NULL,         -- ['payments-infra', 'fintech-ops', 'scale']
  caliber_signals TEXT[] NOT NULL,    -- ['cars24-scale', 'oyo-velocity', '0-to-1-launches']

  -- Cache invalidation
  knowledge_base_version INT NOT NULL,  -- bumps when atoms added/changed
  source_match_ids UUID[] NOT NULL,     -- jobs that justified this cluster

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (user_id, role_cluster, seniority)
);
```

### Tailored resume (`tailored_resumes`, extended)

```sql
ALTER TABLE tailored_resumes
  ADD COLUMN IF NOT EXISTS story_brief_id UUID REFERENCES resume_story_briefs(id),
  ADD COLUMN IF NOT EXISTS selected_atom_ids UUID[],  -- ordered, per role
  ADD COLUMN IF NOT EXISTS reused_from UUID REFERENCES tailored_resumes(id);
```

`tailored_version` keeps the same JSON shape so PDF generation doesn't change.

---

## The pipeline (per tailoring request)

```
┌─────────────────────────────────────────────────────────────────┐
│ Pre-check: can we reuse?                                         │
│ - Compute role_cluster for this JD                               │
│ - Look up most recent tailored_resume in same cluster            │
│ - If story_brief unchanged AND atom set would be identical AND   │
│   age < 14 days → return reuse offer to user                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Pass 1: Story brief (Haiku, ~1¢)                                 │
│ Input: JD + atom summary (titles + tags only, not full facts)   │
│ Output: positioning, key_themes, caliber_signals                │
│ Cache: by (user_id, role_cluster, seniority)                    │
│ Cache hit = no model call                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Pass 2: Selection (Haiku, ~2¢)                                   │
│ Input: story brief + ALL user atoms (with company/role/dates)   │
│ Output: per role, ordered list of atom_ids that serve the brief │
│ Rules: 4-6 atoms per role, recency-weighted, mix of relevance + │
│        caliber signals, no fabrication                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Pass 3: Composition (Opus, ~3¢)                                  │
│ Input: selected atoms grouped by role + tone/voice from profile │
│ Output: bullet text per atom (or per atom-group when combining) │
│ Rules: ≤22 words/bullet, cite atom_ids used in each bullet,     │
│        rephrase only — never invent metrics/tools/scope         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Validation                                                        │
│ For each composed bullet: verify all cited atom_ids exist and   │
│ that no numeric value in the bullet text is absent from the     │
│ cited atoms' metric fields. Reject + retry on failure.          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Review UI                                                        │
│ Show: story brief at top + bullets per role with diff vs        │
│ original. User can accept all, accept by section, or chat to    │
│ refine ("deemphasize auctions, lean into financing").           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Generate PDF (existing)
```

### Pass 1 — Story brief details

**Trigger:** runs only on cache miss for `(user, role_cluster, seniority)` OR when `knowledge_base_version` is newer than the cached brief.

**Prompt shape:**
- System: "You are a resume strategist. Write a 2-3 sentence positioning for how this user should present themselves for this role-shape. Then list 3-5 key themes the resume must hit and 2-3 caliber signals worth proving."
- User: JD title + JD body + atom summary (`per role: {company, role, dates, top 3 tags, atom_count}` — NOT full facts to keep tokens down)
- Output: `{ positioning, key_themes[], caliber_signals[] }`

**Cost optimization:** uses prompt caching on the atom summary block (stable across briefs for same user).

### Pass 2 — Selection details

**Trigger:** runs every tailoring (unless full reuse).

**Prompt shape:**
- System contains the three principles + ranking rubric:
  > For each role, pick 4-6 atoms that together tell the story:
  > - **Relevance (60%)**: atoms whose tags or theme map to `key_themes`
  > - **Caliber (30%)**: atoms with rare metrics/scale/scope, even if off-domain. **Recent > old.**
  > - **Range (10%)**: one atom showing breadth so the role doesn't look one-dimensional
  >
  > For the most recent role, prefer relevance. For older roles, prefer caliber.
  > For roles >7 years old, 1-2 atoms total unless they prove a unique caliber signal.
  > Never include atoms with confidence < 0.6.

- User: story brief + JSON-list of all atoms with `id`, `company`, `role`, `start_date`, `tags`, `confidence`, short `fact` snippet
- Output: `{ selections: [{ company, role, atom_ids: [...] }], dropped_atoms: [{ id, reason }] }` — `dropped_atoms` is for audit/UI

**Cost optimization:** atom list is cached at Anthropic prompt-cache layer (90% discount on cached input).

### Pass 3 — Composition details

**Trigger:** runs every tailoring unless full reuse OR unless selection produced an atom set identical to the previous tailoring's selection (in which case copy bullets verbatim from previous tailored_version).

**Prompt shape:**
- System:
  > Rephrase atoms into resume bullets in the user's voice.
  >
  > Hard rules:
  > - ≤22 words per bullet (count them)
  > - Start with a strong action verb
  > - Every numeric/named claim in the bullet MUST trace to a cited atom_id (you list the citations)
  > - You may combine 2 atoms from the same role into one bullet — list both citations
  > - You MAY NOT invent metrics, tool names, team sizes, scope, or outcomes
  > - You MAY NOT borrow a metric from one role into a different role's bullet
  > - If an atom can't be tightened into ≤22 words without losing the metric, split it across two bullets

- User: per-role groups of selected atoms with full `fact`, `metric`, `tags`
- Output: `{ bullets: [{ company, role, text, cited_atom_ids: [...], split_from: null|atom_id }] }`

### Validation

After Pass 3, before showing to user:

```js
for (const bullet of composed.bullets) {
  // 1. Every cited atom_id exists
  const atoms = bullet.cited_atom_ids.map(id => atomsById.get(id));
  if (atoms.some(a => !a)) reject('phantom citation');

  // 2. Every numeric token in bullet.text appears in at least one cited atom's metric or fact
  const numbers = extractNumbers(bullet.text); // ['1.8x', '350cr', '4', '100k']
  for (const n of numbers) {
    const found = atoms.some(a =>
      String(a.fact).includes(n) ||
      (a.metric && metricMatches(a.metric, n))
    );
    if (!found) reject(`unsourced number: ${n}`);
  }

  // 3. Word count ≤ 22 (soft warn, not reject)
  if (wordCount(bullet.text) > 22) warn('over budget');
}
```

On reject: re-run composition for failed bullets only (cheap retry, not full pass).

---

## Reuse cache flow (the user-facing thing)

When the user clicks "Tailor Resume" for a new job:

```
1. Server computes role_cluster from job (title + description → Haiku classification, cached per job)
2. Server queries: most recent tailored_resume for (user, same role_cluster) within last 14 days
3. If found, runs cheap diff:
   - Did atom set change? (compare what selection WOULD pick now vs what was picked then)
   - Did story brief change? (compare cached brief)
4. If no meaningful change → return reuse offer:
```

```jsonc
{
  "reusable": true,
  "previous_tailored_resume_id": "...",
  "previous_job": { "title": "Principal PM, Growth", "company": "PagerDuty", "applied_at": "..." },
  "diff_summary": "Same role-shape, same evidence. Stripe asks for fintech experience — your PagerDuty resume already leads with that.",
  "would_change": []  // or list of micro-changes if minor
}
```

UI shows:

> **Already tailored for this kind of role**
>
> You tailored your resume for **PagerDuty — Principal PM, Growth** yesterday. Stripe's PM Payments role is a strong match for that same version — same domain, same level.
>
> [ Use that resume → ]   [ Tailor fresh anyway ]
>
> *Pilot's take: the bullets we picked for PagerDuty hit the same beats Stripe is asking for. Saving you a re-edit.*

If user picks "Use that resume" → instant. New `tailored_resumes` row inserted with `reused_from = X` and same `tailored_version`. PDF generation runs (it's the cheap part).

If user picks "Tailor fresh anyway" → full pipeline runs.

**Reuse window:** 14 days OR until knowledge base version bumps (chat extracted new atoms / user re-uploaded resume), whichever is shorter.

---

## Cost model

Per user assumed: **750 tailorings/month, 3-5 distinct role clusters, $15/month subscription.**

| Pass | Model | Tokens (in/out) | Cost/call | Calls/month | Total |
|---|---|---|---|---|---|
| Atomization (one-time) | Opus | 8K / 4K | 5¢ | ~1/month | $0.05 |
| Story brief (cluster-cached) | Haiku | 3K / 0.5K | 0.5¢ | ~5/month | $0.03 |
| Selection | Haiku (cached input) | 6K / 1K | 0.6¢ | ~300/month* | $1.80 |
| Composition | Opus (cached input) | 4K / 1.5K | 3.5¢ | ~150/month** | $5.25 |
| Reuse pre-check | Haiku | 1K / 0.2K | 0.1¢ | 750/month | $0.75 |
| Memory extraction | Haiku | 2K / 0.5K | 0.3¢ | ~30/month | $0.09 |
| **Total** | | | | | **~$8/month** |

\* 60% of tailorings are reuse (no selection)
\** 50% of selections produce identical atom sets to previous (no composition)

**Headroom:** $7/user covers Supabase, ScraperAPI, Vercel, PDF generation costs.

**Three optimizations doing the heavy lifting:**
1. **Reuse cache** — drops most tailorings to ~0.1¢
2. **Anthropic prompt caching** — atom blocks reused across passes get 90% discount on input
3. **Haiku for selection** — composition is the only pass that needs Opus quality

If costs creep up: drop story brief, do single-pass select+compose with Haiku → ~$3/user but lower bullet quality.

---

## Migration path

The current system stays running. Build v2 alongside, gated by a feature flag, switch users over incrementally.

### Phase A — Atomize existing data (1-2 days)

1. SQL migration: add `source_type`, `source_bullet_id`, `start_date`, `end_date` to `user_experience_memory`
2. Backfill: for each user with a `structured_resume`, run atomization → insert atoms
3. Existing chat-extracted nuggets get `source_type = 'chat_extraction'` (default)

### Phase B — Build the pipeline (3-5 days)

New routes (none of these break existing code):
- `POST /api/ai/resume-atomize` — runs atomization, called on resume upload
- `POST /api/ai/resume-story-brief` — pass 1, with cluster cache
- `POST /api/ai/resume-select-atoms` — pass 2
- `POST /api/ai/resume-compose` — pass 3 + validation
- `POST /api/ai/resume-reuse-check` — the cache pre-check

New SQL: `resume_story_briefs` table.

New prompts: `resume-story-brief.js`, `resume-select-atoms.js`, `resume-compose.js`.

### Phase C — Wire up new flow behind a flag (1 day)

`ResumeTailorSheet` gets a `useV2Pipeline` flag. When true:
- "Let's fix this" → reuse pre-check → if reusable, show offer; else run full pipeline → review → PDF
- Chat is now an *optional refinement step* on the review screen, not the primary flow
- "Skip — just generate PDF" → skip refinement, go straight to PDF from auto-pipeline output

### Phase D — Ship to internal user (you), then everyone (1 day)

- Flag on for `kushendrasuryavanshi@gmail.com` first
- Tailor 5-10 jobs across 2-3 role clusters, validate quality + cost
- Flip flag globally
- Old routes (`resume-content`, `resume-apply-changes`, `resume-auto-fix`) get deleted in a follow-up cleanup commit

### What we keep

- `resume-gap-analysis` — still useful for the strength score and the "missing signals" the story brief should address
- `resume-conversation` (rehydrate) — chat is still a thing, just as refinement
- `resume-generate-pdf` — unchanged
- `extract-memory` — still runs after chats, feeds atoms

### What we delete (after Phase D)

- `resume-content` route + `resume-content-creator.js` prompt
- `resume-apply-changes` route — composition writes `tailored_version` directly, no patch operations
- `resume-auto-fix` route — reuse cache + selection replaces the "auto-fix" concept

---

## Open questions for the build phase

1. **Role cluster taxonomy.** How granular? `pm-payments` vs `pm-fintech` — same cluster or different? Lean coarse (more reuse) at the cost of slightly less-tailored briefs. Probably ~15-20 clusters in the PM space alone.

2. **Atomization quality control.** Opus splits a bullet into atoms — what if it over-splits or merges things wrongly? Add a review pass during onboarding ("here's how Pilot understood your resume — anything wrong?")? Adds friction but builds trust.

3. **What if selection drops a bullet the user loves?** The user must be able to *pin* an atom: "always include this in my Cars24 bullets." Adds a `pinned_for_cluster` column to `user_experience_memory`. Optional; ship without it first, add when users complain.

4. **Confidence threshold for atoms from original resume.** Default 0.95 (we believe what they wrote)? Or lower for unverified claims?

5. **Caliber-signal definition.** "Rare metrics, scale, scope" is fuzzy. Is `₹350cr revenue` a caliber signal? `0→1 launch`? `team of 4 PMs reporting`? Either codify in the selection prompt or learn over time from which atoms get picked across users.

---

## Acceptance tests

Before shipping to all users, the v2 pipeline must pass these on a real account (kushendrasuryavanshi@gmail.com) with the existing 13 tailored_resumes as fixture data:

- **No fabrication test:** for every composed bullet across 10 tailorings, every numeric/named claim is traceable to a cited atom. 0 violations.
- **Add+drop test:** for at least 5 tailorings, the new `tailored_version` shows fewer or equal total bullets than `base_version` for at least one experience entry (proves selection is actually dropping irrelevant content, not just adding).
- **Reuse hit-rate test:** across 20 simulated tailorings hitting 4 role clusters, ≥60% should hit the reuse cache.
- **Bullet length test:** 95%+ of composed bullets ≤22 words.
- **Caliber preservation test:** for an off-domain JD (e.g. SWE-CEO or PM-Investor), recent role still produces 4-6 bullets (caliber signals survive even with poor relevance).
- **Cost test:** average cost per tailoring across 50 simulated runs ≤2¢.

---

## Non-goals

- Multi-page resume composition (still one page, same as today)
- Cover letter generation (handled by `draft-application`, separate flow)
- Resume design/template choice (vision-based PDF preserves user's original design — already shipped)
- Real-time collaborative editing
- Multi-language support
