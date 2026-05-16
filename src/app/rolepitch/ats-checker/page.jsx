const CSS = `
  :root {
    --bg: oklch(0.98 0.006 248);
    --surface: oklch(0.955 0.009 248);
    --paper: oklch(1 0 0);
    --border: oklch(0.86 0.015 248);
    --border-subtle: oklch(0.91 0.01 248);
    --accent: oklch(0.50 0.19 248);
    --accent-hover: oklch(0.44 0.19 248);
    --accent-dim: oklch(0.50 0.19 248 / 0.10);
    --green: oklch(0.55 0.17 155);
    --green-dim: oklch(0.55 0.17 155 / 0.10);
    --red: oklch(0.58 0.19 25);
    --amber: oklch(0.66 0.16 80);
    --text: oklch(0.16 0.03 248);
    --text-muted: oklch(0.44 0.04 248);
    --text-faint: oklch(0.62 0.03 248);
    --sans: 'DM Sans', sans-serif;
    --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .ats-tool { min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .ats-shell { max-width: 1120px; margin: 0 auto; padding: 28px 24px 72px; }
  .ats-nav { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 76px; }
  .ats-brand { display: flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; font-weight: 800; letter-spacing: -.02em; }
  .ats-logo { width: 30px; height: 30px; border-radius: 8px; background: var(--accent); display: grid; place-items: center; }
  .ats-nav-links { display: flex; align-items: center; gap: 22px; }
  .ats-nav-links a { color: var(--text-muted); text-decoration: none; font-size: 14px; font-weight: 650; }
  .ats-nav-cta { border: 1px solid var(--border); border-radius: 10px; padding: 10px 16px; color: var(--text); text-decoration: none; font-size: 14px; font-weight: 700; }
  .ats-hero { display: grid; grid-template-columns: minmax(0, 1fr) 430px; gap: 72px; align-items: center; }
  .ats-kicker { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px; background: var(--accent-dim); border: 1px solid oklch(0.50 0.19 248 / .20); color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: .04em; }
  .ats-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
  .ats-hero h1 { font-size: clamp(42px, 5vw, 72px); line-height: .98; letter-spacing: -.06em; margin: 26px 0 20px; font-weight: 800; max-width: 680px; }
  .ats-hero p { font-size: clamp(16px, 1.8vw, 19px); line-height: 1.65; color: var(--text-muted); margin: 0; max-width: 620px; }
  .ats-actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 34px; }
  .ats-primary, .ats-secondary { border-radius: 12px; padding: 15px 24px; font-size: 15px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 9px; }
  .ats-primary { background: var(--accent); color: white; box-shadow: 0 12px 36px oklch(0.50 0.19 248 / .24); }
  .ats-primary:hover { background: var(--accent-hover); }
  .ats-secondary { color: var(--text); border: 1px solid var(--border); background: transparent; }
  .ats-proofline { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 28px; color: var(--text-muted); font-size: 13px; }
  .ats-proofline strong { color: var(--text); }
  .ats-card { background: var(--paper); border: 1px solid var(--border); border-radius: 18px; padding: 24px; box-shadow: 0 20px 60px oklch(0 0 0 / .05); }
  .ats-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
  .ats-score { display: grid; grid-template-columns: 118px 1fr; gap: 18px; align-items: center; padding-bottom: 18px; border-bottom: 1px solid var(--border-subtle); }
  .ats-ring { width: 118px; height: 118px; border-radius: 999px; background: conic-gradient(var(--green) 276deg, var(--border) 0deg); display: grid; place-items: center; }
  .ats-ring-inner { width: 88px; height: 88px; border-radius: 999px; background: var(--paper); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: inset 0 0 0 1px var(--border-subtle); }
  .ats-metrics { display: grid; gap: 12px; margin-top: 20px; }
  .ats-metric { display: grid; grid-template-columns: 1fr 42px; gap: 12px; align-items: center; }
  .ats-bar { height: 5px; border-radius: 999px; background: var(--border-subtle); overflow: hidden; margin-top: 6px; }
  .ats-bar span { display: block; height: 100%; border-radius: inherit; }
  .ats-section { margin-top: 88px; }
  .ats-section-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-end; margin-bottom: 20px; }
  .ats-section-head h2 { font-size: clamp(26px, 3vw, 38px); line-height: 1.1; letter-spacing: -.045em; margin: 0; }
  .ats-section-head p { color: var(--text-muted); font-size: 15px; line-height: 1.6; max-width: 560px; margin: 8px 0 0; }
  .ats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .ats-info { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 22px; min-height: 184px; }
  .ats-info h3 { font-size: 17px; line-height: 1.25; letter-spacing: -.02em; margin: 12px 0 8px; }
  .ats-info p { font-size: 14px; line-height: 1.55; color: var(--text-muted); margin: 0; }
  .ats-num { font-family: var(--mono); font-size: 11px; color: var(--accent); font-weight: 800; letter-spacing: .1em; }
  .ats-before-after { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .ats-example { background: var(--paper); border: 1px solid var(--border); border-radius: 16px; padding: 22px; }
  .ats-label { font-family: var(--mono); font-size: 11px; font-weight: 800; letter-spacing: .12em; color: var(--text-faint); margin-bottom: 12px; text-transform: uppercase; }
  .ats-final { background: linear-gradient(180deg, oklch(0.50 0.19 248 / .07), oklch(0.55 0.17 155 / .06)); border: 1px solid oklch(0.50 0.19 248 / .18); border-radius: 20px; padding: 32px; display: flex; align-items: center; justify-content: space-between; gap: 28px; }
  .ats-final h2 { font-size: clamp(24px, 3vw, 34px); letter-spacing: -.04em; margin: 0 0 8px; }
  .ats-final p { color: var(--text-muted); line-height: 1.6; margin: 0; max-width: 620px; }
  @media (max-width: 900px) {
    .ats-shell { padding: 24px 20px 56px; }
    .ats-nav { margin-bottom: 44px; }
    .ats-nav-links { display: none; }
    .ats-hero { grid-template-columns: 1fr; gap: 36px; }
    .ats-card { order: -1; }
    .ats-grid, .ats-before-after { grid-template-columns: 1fr; }
    .ats-final { align-items: stretch; flex-direction: column; }
    .ats-final .ats-primary { justify-content: center; }
  }
`;

const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'RolePitch ATS Resume Checker',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://www.rolepitch.com/ats-checker',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Free ATS resume checker that scores resume parseability, keyword match, structure, impact, and gives actionable fixes.',
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is the RolePitch ATS checker free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. You can upload a resume and get an ATS readiness report without signing up.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does RolePitch only check formatting?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. RolePitch checks parseability, keyword signal, section structure, impact, and gives examples of stronger bullets.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can RolePitch fix my resume after the ATS score?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. After the report, you can paste a job description and RolePitch will tailor your resume for that role.',
      },
    },
  ],
};

export default function ATSCheckerPage() {
  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <main className="ats-tool">
        <div className="ats-shell">
          <nav className="ats-nav">
            <a className="ats-brand" href="/">
              <span className="ats-logo" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
              RolePitch
            </a>
            <div className="ats-nav-links">
              <a href="/blog">Blog</a>
              <a href="/start?fresh=1">Tailor resume</a>
              <a href="/critique" className="ats-nav-cta">Start free check</a>
            </div>
          </nav>

          <section className="ats-hero">
            <div>
              <span className="ats-kicker"><span className="ats-dot" /> Free ATS checker</span>
              <h1>See if your resume can pass ATS screening.</h1>
              <p>
                Upload your resume and get a score for parseability, keyword signal, structure, and impact. Then see the exact gaps RolePitch can fix for a real job.
              </p>
              <div className="ats-actions">
                <a className="ats-primary" href="/critique">Check my ATS score free →</a>
                <a className="ats-secondary" href="/start?fresh=1">Tailor my resume instead</a>
              </div>
              <div className="ats-proofline">
                <span><strong>No sign-up</strong> to get the report</span>
                <span><strong>PDF or text</strong> supported</span>
                <span><strong>Global roles</strong>, resume or CV</span>
              </div>
            </div>

            <aside className="ats-card" aria-label="Example ATS score report">
              <div className="ats-card-head">
                <span className="ats-label" style={{ margin: 0 }}>Sample report</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)', fontWeight: 800 }}>READY IN 60 SEC</span>
              </div>
              <div className="ats-score">
                <div className="ats-ring">
                  <div className="ats-ring-inner">
                    <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.05em' }}>76</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)' }}>/100</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-.02em' }}>Readable, but not role-ready yet.</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, margin: '7px 0 0' }}>Your resume parses, but the strongest proof is not visible fast enough.</p>
                </div>
              </div>
              <div className="ats-metrics">
                {[
                  ['Parseability', 86, 'var(--green)'],
                  ['Keyword signal', 62, 'var(--amber)'],
                  ['Impact proof', 58, 'var(--amber)'],
                  ['Scan structure', 74, 'var(--green)'],
                ].map(([label, score, color]) => (
                  <div className="ats-metric" key={label}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{label}</div>
                      <div className="ats-bar"><span style={{ width: `${score}%`, background: color }} /></div>
                    </div>
                    <strong style={{ color, fontSize: 13, textAlign: 'right' }}>{score}</strong>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <section className="ats-section">
            <div className="ats-section-head">
              <div>
                <h2>What the report checks</h2>
                <p>It is not just a formatting scan. The report shows why your resume may pass parsing but still lose to better-matched candidates.</p>
              </div>
            </div>
            <div className="ats-grid">
              {[
                ['01', 'ATS parseability', 'Sections, dates, contact details, and formatting that hiring systems need to read correctly.'],
                ['02', 'Keyword signal', 'Whether your resume uses the role language recruiters and screening tools are looking for.'],
                ['03', 'Impact proof', 'Whether bullets show scope, metrics, outcomes, and business value instead of generic responsibility.'],
              ].map(([n, title, body]) => (
                <div className="ats-info" key={title}>
                  <div className="ats-num">{n}</div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="ats-section">
            <div className="ats-section-head">
              <div>
                <h2>From score to fix</h2>
                <p>RolePitch shows one concrete rewrite preview inside the report, so users understand what changes before they tailor for a job.</p>
              </div>
            </div>
            <div className="ats-before-after">
              <div className="ats-example">
                <div className="ats-label">Before</div>
                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>Responsible for dashboard reporting and stakeholder updates across product teams.</p>
              </div>
              <div className="ats-example" style={{ background: 'var(--green-dim)', borderColor: 'oklch(0.55 0.17 155 / .24)' }}>
                <div className="ats-label" style={{ color: 'var(--green)' }}>After RolePitch</div>
                <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.6 }}><strong>Built Power BI dashboards</strong> tracking product KPIs, reducing weekly manual reporting by <strong>12 hours</strong>.</p>
              </div>
            </div>
          </section>

          <section className="ats-section">
            <div className="ats-final">
              <div>
                <h2>Check your resume before you apply.</h2>
                <p>Get the score first. If the report finds gaps, paste the job description and RolePitch will tailor the resume for that role.</p>
              </div>
              <a className="ats-primary" href="/critique">Check my ATS score free →</a>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
