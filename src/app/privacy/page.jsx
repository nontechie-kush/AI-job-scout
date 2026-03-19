export const metadata = { title: 'Privacy Policy — CareerPilot' };

export default function PrivacyPage() {
  return (
    <div className="lp-root min-h-dvh">
      <div className="max-w-2xl mx-auto px-5 py-16">
        <div className="flex items-center gap-2.5 font-bold text-base tracking-tight text-white mb-12">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-[13px] font-extrabold text-slate-950">
            ⌘
          </div>
          CareerPilot
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: March 2026</p>

        <div className="space-y-10 text-slate-300 text-[15px] leading-relaxed">

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Overview</h2>
            <p>
              CareerPilot ("we", "us", "our") is a job search assistant. We collect the minimum
              data needed to match you with jobs, draft outreach messages, and track your applications.
              We do not sell your data. We do not share it with third parties for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Data we collect</h2>
            <ul className="space-y-3 list-none">
              {[
                ['Account data', 'Email address and name — used to create and identify your account.'],
                ['Resume / profile data', 'Your resume text, work history, skills, and experience — used to match you with jobs and draft personalized messages. Stored securely in our database. You can delete it at any time from your profile settings.'],
                ['Job preferences', 'Target roles, location, work style, and seniority preferences you set during onboarding.'],
                ['Application activity', 'Jobs you viewed, applied to, dismissed, or saved — used to personalise your feed and avoid showing you the same job twice.'],
                ['Gmail (optional)', 'If you connect Gmail, we read only thread metadata (sender domain, message count, detected reply pattern) to auto-update your pipeline. We never store email subject lines, body text, or sender names. You can disconnect Gmail at any time.'],
                ['Usage data', 'Standard server logs (timestamps, API routes accessed). No third-party analytics.'],
              ].map(([label, text]) => (
                <li key={label} className="flex gap-3">
                  <span className="text-green-400 font-mono text-xs mt-1 shrink-0">→</span>
                  <span><span className="text-white font-medium">{label}:</span> {text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Chrome Extension</h2>
            <p className="mb-3">
              The CareerPilot Chrome extension sends LinkedIn connection requests on your behalf —
              but only for messages you have reviewed and approved in the CareerPilot dashboard.
            </p>
            <ul className="space-y-2 list-none">
              {[
                'The extension does not read your LinkedIn inbox, messages, or connections.',
                'The extension does not scrape LinkedIn profiles or collect data about other LinkedIn users.',
                'The extension stores only your CareerPilot session token in local Chrome storage — no LinkedIn credentials are stored.',
                'The extension communicates only with CareerPilot\'s own servers (careerpilot-ai-lac.vercel.app) to fetch your approved queue and report results.',
                'No LinkedIn data is transmitted to CareerPilot\'s servers.',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-green-400 font-mono text-xs mt-1 shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">How we use your data</h2>
            <ul className="space-y-2 list-none">
              {[
                'To match you with relevant job listings from public job boards.',
                'To generate personalized cover letters and outreach messages using AI (Anthropic Claude).',
                'To track your application pipeline and send you relevant notifications.',
                'To improve job matching accuracy over time (anonymised, aggregate signals only).',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-green-400 font-mono text-xs mt-1 shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Third-party services</h2>
            <ul className="space-y-2 list-none">
              {[
                ['Supabase', 'Database and authentication. Data stored in their US region.'],
                ['Anthropic Claude', 'AI model used to generate job match explanations, cover letters, and outreach drafts. Your profile and job data is sent to Anthropic\'s API for this purpose. Anthropic does not use API data to train models.'],
                ['Vercel', 'Hosting and serverless functions.'],
              ].map(([name, desc]) => (
                <li key={name} className="flex gap-3">
                  <span className="text-green-400 font-mono text-xs mt-1 shrink-0">→</span>
                  <span><span className="text-white font-medium">{name}:</span> {desc}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Data retention and deletion</h2>
            <p>
              You can delete your account and all associated data at any time from your profile settings.
              Upon deletion, your profile, preferences, job activity, and any stored messages are permanently
              removed within 30 days. Aggregate, anonymised signals (used for matching improvement) are
              retained but cannot be linked back to you.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Security</h2>
            <p>
              All data is encrypted in transit (TLS) and at rest. Authentication uses Supabase Auth with
              row-level security — your data is only accessible to you. Gmail tokens are stored encrypted
              and used only to read thread metadata from your own inbox.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">Contact</h2>
            <p>
              Questions about this policy? Email us at{' '}
              <a href="mailto:privacy@careerpilot.ai" className="text-green-400 hover:text-green-300">
                privacy@careerpilot.ai
              </a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
