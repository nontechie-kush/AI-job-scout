'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HeroIllustration } from '@/components/blog/Illustration';
import ArticleBody from '@/components/blog/ArticleBody';
import { tagStyle, formatDate } from '@/lib/content-os/tags';

function ReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const h = () => {
      const el = document.documentElement;
      setPct(Math.min((window.scrollY / (el.scrollHeight - window.innerHeight)) * 100, 100));
    };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <div className="blog-reading-progress" style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99, height: 3, background: 'var(--border-subtle)' }}>
      <div style={{ height: '100%', background: 'linear-gradient(90deg,var(--accent),var(--green))', width: `${pct}%`, transition: 'width 0.1s linear' }} />
    </div>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 16px',
      background: scrolled ? 'rgba(247,248,252,0.96)' : 'rgba(247,248,252,0.88)',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: `1px solid ${scrolled ? 'var(--border-subtle)' : 'transparent'}`,
      transition: 'all 0.3s',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: 'var(--text)' }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>RolePitch</span>
        </Link>
        <span className="blog-nav-divider" style={{ color: 'var(--border)', fontSize: 14 }}>/</span>
        <Link className="blog-nav-label" href="/blog" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>Blog</Link>
        <div style={{ flex: 1 }} />
        <Link href="/start?fresh=1" style={{
          background: 'var(--accent)', color: 'white', padding: '10px 16px', borderRadius: 10,
          fontSize: 14, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
        }}>Get Started</Link>
      </div>
    </nav>
  );
}

function ToC({ sections, activeSection }) {
  if (!sections.length) return null;
  return (
    <nav style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 200 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>Contents</div>
      {sections.map((s, i) => (
        <a key={s.id} href={`#${s.id}`} style={{
          fontSize: 13, fontWeight: activeSection === i ? 500 : 400,
          color: activeSection === i ? 'var(--accent)' : 'var(--text-faint)',
          textDecoration: 'none',
          padding: '5px 0 5px 12px',
          borderLeft: `2px solid ${activeSection === i ? 'var(--accent)' : 'var(--border)'}`,
          transition: 'all 0.2s', lineHeight: 1.4,
        }}>{s.label}</a>
      ))}
    </nav>
  );
}

function ShareBar({ url }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(url); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: 'sticky', bottom: 24, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 50 }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 40, padding: '10px 20px',
        boxShadow: 'var(--shadow-md)',
        display: 'flex', alignItems: 'center', gap: 8,
        pointerEvents: 'all',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginRight: 4 }}>Share</span>
        <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" title="Twitter / X" style={{
          width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)',
          background: 'var(--surface2)', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l5 6L1 13h2l4-4.5 3.5 4.5H13L8 6.5 12.5 1H11L7 5 3.5 1H1z" fill="currentColor" /></svg>
        </a>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" title="LinkedIn" style={{
          width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)',
          background: 'var(--surface2)', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M3.5 5.5v5M3.5 3.5v.5M6 5.5v5M6 7.5c0-1 .7-2 2-2s2 1 2 2v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        </a>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <button onClick={onCopy} style={{
          height: 32, padding: '0 14px', borderRadius: 20, border: '1px solid var(--border)',
          background: copied ? 'var(--green-dim)' : 'var(--surface2)',
          color: copied ? 'var(--green)' : 'var(--text-muted)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)',
        }}>{copied ? '✓ Copied' : 'Copy link'}</button>
      </div>
    </div>
  );
}

function RelatedCard({ p }) {
  const ts = tagStyle(p.tag);
  return (
    <Link href={`/blog/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 20, cursor: 'pointer', height: '100%',
        boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s ease',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: ts.tc, background: ts.tb, padding: '2px 8px', borderRadius: 20 }}>{p.tag}</span>
        <h4 style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 400, lineHeight: 1.35, color: 'var(--text)', margin: '12px 0 10px' }}>{p.title}</h4>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{formatDate(p.date)} · {p.rt}</div>
      </div>
    </Link>
  );
}

const ATS_SCORE_SLUGS = new Set([
  'why-your-resume-gets-rejected-by-ats-and-exactly-how-to-fix-it-for-remote-first-companies',
  'ats-resume-checker-how-to-test-your-resume-before-you-apply',
  'ats-friendly-resume-template-2026-formatting-rules',
  'ats-keywords-by-job-title-software-engineer-product-manager-marketing-manager',
  'why-ai-written-resumes-score-lower-ats',
  'how-to-use-ai-improve-resume-without-ats-filter',
]);

const TAILORING_SLUGS = new Set([
  'the-resume-experiment-how-changing-3-lines-increased-my-interview-rate-by-40',
  'why-you-re-spending-3-hours-on-resume-formatting-when-you-should-be-tailoring',
  'the-skill-translation-framework-how-to-reframe-your-previous-role-for-a-completely-different-industry',
]);

function articleCta(post) {
  if (ATS_SCORE_SLUGS.has(post.slug)) {
    return {
      title: 'Find out if your resume can pass ATS.',
      body: 'Upload your resume — RolePitch checks parseability, keywords, structure, and impact before you apply.',
      href: '/ats-checker',
      inlineVariant: 'ats',
      label: 'Check my ATS score free →',
    };
  }
  if (TAILORING_SLUGS.has(post.slug)) {
    return {
      title: 'Make the resume fit the role.',
      body: 'Paste a job link — RolePitch picks your strongest achievements, rewrites the bullets, and keeps your layout.',
      href: '/start?fresh=1',
      inlineVariant: 'tailor',
      label: 'Tailor my resume free →',
    };
  }
  return {
    title: 'Turn the insight into your next application.',
    body: 'RolePitch helps you check, tailor, and download a resume version built for the role you want.',
    href: '/',
    inlineVariant: 'tailor',
    label: 'See how RolePitch works →',
  };
}

export default function ArticleClient({ post, related, sections }) {
  const [activeSection, setActiveSection] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [pageUrl, setPageUrl] = useState('');

  const ts = tagStyle(post.primary_tag);
  const cta = articleCta(post);

  useEffect(() => {
    const baseLikes = (post.id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 400 + 50;
    setLikeCount(baseLikes);
    setPageUrl(window.location.href);
  }, [post.id]);

  useEffect(() => {
    const root = document.querySelector('.rp-blog');
    if (!root) return;
    root.setAttribute('data-theme', 'light');
    localStorage.removeItem('rp_theme');
  }, []);

  useEffect(() => {
    if (!sections.length) return;
    const h = () => {
      let active = 0;
      sections.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < 160) active = i;
      });
      setActiveSection(active);
    };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, [sections]);

  const handleLike = () => setLiked((l) => { setLikeCount((c) => l ? c - 1 : c + 1); return !l; });

  return (
    <>
      <Nav />
      <ReadingProgress />

      <header style={{
        paddingTop: 72,
        background: 'linear-gradient(180deg, #eef1fc 0%, var(--bg) 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(79,110,247,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '56px 32px 0', position: 'relative' }}>
          <div className="fu" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <Link href="/blog" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M7 1L3 5.5 7 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Blog
            </Link>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: ts.tc, background: ts.tb, padding: '2px 9px', borderRadius: 20 }}>{post.primary_tag || 'Career Strategy'}</span>
          </div>

          <h1 style={{
            fontFamily: 'var(--serif)', fontSize: 'clamp(28px,4.5vw,52px)',
            fontWeight: 400, lineHeight: 1.12, letterSpacing: '-0.02em',
            color: 'var(--text)', marginBottom: 20, maxWidth: 780,
          }}>{post.title}</h1>

          {post.subtitle && (
            <p style={{ fontSize: 'clamp(16px,1.8vw,20px)', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 32, maxWidth: 620, fontWeight: 400 }}>
              {post.subtitle}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: (post.author_color || '#4f6ef7') + '26',
                border: `1.5px solid ${(post.author_color || '#4f6ef7')}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, color: post.author_color || '#4f6ef7',
              }}>{post.author_initial || (post.author_name?.[0] || 'R').toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{post.author_name || 'RolePitch Team'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{post.author_role || 'Editor'}</div>
              </div>
            </div>
            <div style={{ color: 'var(--border)' }}>·</div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatDate(post.published_at || post.updated_at)}</span>
            <div style={{ color: 'var(--border)' }}>·</div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-faint)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: 20 }}>{post.read_time || '5 min read'}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={handleLike} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20, border: `1px solid ${liked ? '#f43f5e' : 'var(--border)'}`,
                background: liked ? 'rgba(244,63,94,0.08)' : 'transparent',
                color: liked ? '#f43f5e' : 'var(--text-faint)',
                cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill={liked ? '#f43f5e' : 'none'}>
                  <path d="M7 12s-6-4.5-6-7.5a3.5 3.5 0 017 0 3.5 3.5 0 017 0C15 7.5 7 12 7 12z" stroke={liked ? '#f43f5e' : 'currentColor'} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {likeCount}
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px' }}>
          <div style={{
            borderRadius: '16px 16px 0 0', overflow: 'hidden',
            border: '1px solid var(--border)', borderBottom: 'none',
            background: 'var(--surface)', height: 'clamp(180px, 30vw, 360px)',
            minHeight: 180,
          }}>
            <HeroIllustration />
          </div>
        </div>
      </header>

      <div className="article-grid" style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '0 32px 80px',
        display: 'grid', gridTemplateColumns: '180px 1fr 180px',
        gap: 40, alignItems: 'start',
      }}>
        <aside style={{ paddingTop: 48 }}>
          <ToC sections={sections} activeSection={activeSection} />
        </aside>

        <article style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '0 0 16px 16px',
          padding: '52px 64px',
        }}>
          <div className="prose">
            <ArticleBody markdown={post.content} ctaVariant={cta.inlineVariant} />
            <hr />
            <div style={{
              background: 'linear-gradient(135deg,var(--accent-dim) 0%,var(--green-dim) 100%)',
              border: '1px solid rgba(79,110,247,0.15)',
              borderRadius: 14, padding: '28px',
              textAlign: 'center', marginTop: '1em',
            }}>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, marginBottom: 8, letterSpacing: '-0.01em' }}>{cta.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>{cta.body}</p>
              <Link href={cta.href} style={{
                background: 'var(--accent)', color: 'white', display: 'inline-block',
                padding: '12px 28px', borderRadius: 9, fontSize: 15, fontWeight: 600,
                textDecoration: 'none',
              }}>{cta.label}</Link>
            </div>
          </div>
        </article>

        <aside style={{ paddingTop: 48 }}>
          <div style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: (post.author_color || '#4f6ef7') + '26',
                  border: `1.5px solid ${(post.author_color || '#4f6ef7')}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, color: post.author_color || '#4f6ef7',
                }}>{post.author_initial || 'R'}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{post.author_name || 'RolePitch Team'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{post.author_role || 'Editor'}</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>Writing about the gap between talent and opportunity.</p>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
              {[
                { k: 'Published', v: formatDate(post.published_at || post.updated_at) },
                { k: 'Read time', v: post.read_time || '5 min' },
                { k: 'Likes', v: likeCount.toString() },
                { k: 'Tag', v: post.primary_tag || 'Career Strategy' },
              ].map(({ k, v }) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{k}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px 80px' }}>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 48 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(22px,2.5vw,28px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 24 }}>Continue reading</h2>
            <div className="related-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {related.map((p) => <RelatedCard key={p.slug} p={p} />)}
            </div>
          </div>
        </section>
      )}

      <ShareBar url={pageUrl} />

      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '28px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, background: 'var(--accent)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: 13 }}>RolePitch</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>© 2026 RolePitch</span>
        </div>
      </footer>
    </>
  );
}
