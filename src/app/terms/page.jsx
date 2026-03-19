export const metadata = { title: 'Terms of Service — CareerPilot' };

export default function TermsPage() {
  return (
    <div className="lp-root min-h-dvh">
      <div className="max-w-2xl mx-auto px-5 py-16">
        <div className="flex items-center gap-2.5 font-bold text-base tracking-tight text-white mb-12">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-[13px] font-extrabold text-slate-950">
            ⌘
          </div>
          CareerPilot
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-10">Last updated: March 2026</p>

        <div className="space-y-10 text-slate-300 text-[15px] leading-relaxed">

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">1. Acceptance</h2>
            <p>
              By using CareerPilot ("the Service"), you agree to these Terms. If you don't agree,
              don't use the Service. We may update these Terms — continued use after updates means acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">2. What CareerPilot does</h2>
            <p>
              CareerPilot is a job search assistant that finds job listings from public sources,
              generates AI-drafted outreach messages and cover letters, and helps you track applications.
              The Chrome extension sends LinkedIn connection requests on your behalf — but only for
              messages you have reviewed and explicitly approved.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">3. Your responsibilities</h2>
            <ul className="space-y-2 list-none">
              {[
                'You are responsible for all messages sent through the Service, including LinkedIn connection requests.',
                'You must review and approve each message before queuing it for delivery.',
                'You must comply with LinkedIn\'s Terms of Service when using the extension.',
                'You must not use CareerPilot to send spam, misleading messages, or unsolicited bulk outreach.',
                'You must be at least 18 years old to use the Service.',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-green-400 font-mono text-xs mt-1 shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">4. AI-generated content</h2>
            <p>
              CareerPilot uses AI (Anthropic Claude) to generate job match explanations, cover letters,
              and outreach messages. AI-generated content may contain errors or inaccuracies. You are
              responsible for reviewing all AI-generated content before using or sending it. CareerPilot
              does not guarantee that AI-generated content is accurate, appropriate, or will achieve
              any particular result.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">5. Third-party platforms</h2>
            <p>
              CareerPilot interacts with third-party platforms (LinkedIn, job boards) through their
              public interfaces. We are not affiliated with, endorsed by, or partnered with LinkedIn
              or any job board. These platforms may change their interfaces or terms at any time,
              which may affect CareerPilot's functionality. We are not responsible for actions taken
              by third-party platforms in response to your use of CareerPilot.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">6. Limitation of liability</h2>
            <p>
              CareerPilot is provided "as is." We make no guarantees about job outcomes, response rates,
              or the accuracy of job matches. To the fullest extent permitted by law, CareerPilot is not
              liable for any indirect, incidental, or consequential damages arising from your use of the Service.
              Our total liability to you shall not exceed the amount you paid us in the 12 months
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">7. Termination</h2>
            <p>
              You may stop using CareerPilot and delete your account at any time. We may suspend or
              terminate your access if you violate these Terms. Upon termination, your data will be
              deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">8. Contact</h2>
            <p>
              Questions?{' '}
              <a href="mailto:hello@careerpilot.ai" className="text-green-400 hover:text-green-300">
                hello@careerpilot.ai
              </a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
