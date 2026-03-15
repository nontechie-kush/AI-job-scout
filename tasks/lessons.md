# Lessons — CareerPilot AI

Lessons learned from corrections. Review at session start. Update after every mistake.

---

## Scraping

### Never run full scrapes for testing
**Mistake:** Ran full scrape workflows to verify code changes, wasting ScraperAPI credits.
**Rule:** Always use `scripts/test-scraper.mjs` (3-result limit) or `scripts/full-scrape.mjs [source]` for single-source tests. Never trigger the full cron pipeline just to verify a fix.

### For full upserts use full-scrape.mjs, not test-scraper.mjs
**Rule:** `test-scraper.mjs` caps upserts at 3 — only use it for verifying parsing logic. Use `full-scrape.mjs [source]` when actually populating the DB.

### ScraperAPI credits are finite and shared
**Rule:** Before running any ScraperAPI-dependent scraper, estimate credit cost (10 credits per render=true call). Free tier = 1000 credits/month. Always use the smallest test that proves the fix works.

### repost_count should NOT increment on re-seen jobs
**Mistake:** `upsertJob` incremented `repost_count` every time a job was seen again. Re-seeing the same `external_id` means the job is still live — not that it was reposted.
**Rule:** Only update `last_seen_at + is_active` on re-seen jobs. Never touch `repost_count` unless we have genuine evidence of a re-listing (different external_id, same company+title).

### apply_type must match DB constraint
**Constraint:** `jobs_apply_type_check` only allows: `greenhouse, lever, ashby, linkedin, taleo, workday, external`.
**Rule:** All scrapers must use `apply_type: 'external'` unless the portal is one of the above. Never use source name as apply_type (e.g. `'cutshort'`, `'naukri'`, `'instahyre'`).

### Ashby's posting-public.list API is dead (Mar 2026)
**Rule:** Use ScraperAPI `render=true&wait=4000` on `jobs.ashbyhq.com/{slug}` with CSS classes `.ashby-job-posting-brief-title` and `.ashby-job-posting-brief-details`.

### Foundit + Hirect are permanently blocked
**Rule:** Both sites return ScraperAPI HTTP 500 — proxy IPs are blocked. Do not attempt to fix or re-add them. They are removed from the registry.

### Instahyre is Angular 1.x, not React/Next.js
**Rule:** Job cards are in `div.employer-block`. Company name div contains "Company - Title" concatenated with " - ". Link is `a#employer-profile-opportunity[ng-href]`. Do not use React/Next.js selectors on Instahyre.

### IIMJobs requires login — no public jobfeed
**Rule:** IIMJobs renders fine but jobfeed is empty without auth (`isLoggedIn: false`). Login endpoint is NOT at `/api/auth/login` (404). On hold until browser network capture identifies the real auth flow.

---

## Naukri Clusters

### Naukri clusters must use canonical URL slugs — not derived keywords
**Root cause:** `extractNaukriKeywords` parsed freeform text and produced slugs like `sdeii-react-developer` that don't exist as Naukri URL paths → 0 results.
**Fix:** Replaced with `CANONICAL_ROLE_MAP` — 35 regex entries that map signal words to actual Naukri slugs (`reactjs-developer`, `software-engineer`, `product-manager`, etc.).
**Rule:** When adding new role types to the map, verify the slug works at `naukri.com/{slug}-jobs` before adding. Seniority (SDE II, AVP, VP) is handled by Naukri's experience filter — never put seniority in the slug.

### DEFAULT_CLUSTERS are only a fallback
**Rule:** With real users in DB, clusters are built dynamically from `users.target_roles + locations`. DEFAULT_CLUSTERS only fire when `users = []`. Don't tune DEFAULT_CLUSTERS expecting them to run in production.

---

## Git / Workflow

### Commit after every verified fix — not in batches
**Mistake:** Multiple fixes were batched and committed together, making it harder to bisect issues.
**Rule:** One fix = one commit. Verify (mini test passes) → commit → next fix.

### Never store credentials in any file
**Rule:** User credentials (email/password) shared for debugging must NEVER be written to any file, committed, or logged. Use them transiently in memory only, then discard.
