'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Illustration from '@/components/blog/Illustration';
import { TAGS, tagStyle, formatDate } from '@/lib/content-os/tags';

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
    <div style={{ position: 'fixed', top: 56, left: 0, right: 0, zIndex: 99, height: 2, background: 'var(--border-subtle)' }}>
      <div style={{ height: '100%', background: 'linear-gradient(90deg,var(--accent),var(--green))', width: `${pct}%`, transition: 'width 0.1s linear' }} />
    </div>
  );
}

function Nav({ dark, setDark }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 24px',
      background: scrolled ? (dark ? 'oklch(0.11 0.03 248/0.93)' : 'rgba(247,248,252,0.93)') : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: `1px solid ${scrolled ? 'var(--border-subtle)' : 'transparent'}`,
      transition: 'all 0.3s',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', gap: 20 }}>
        <Link href="/rolepitch" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: 'var(--text)', flexShrink: 0 }}>
          <div style={{ width: 22, height: 22, background: 'var(--accent)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>RolePitch</span>
        </Link>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/blog" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', borderBottom: '2px solid var(--accent)', paddingBottom: 2 }}>Blog</Link>
          <Link href="/rolepitch#how" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', textDecoration: 'none' }}>How it works</Link>
          <Link href="/rolepitch#pricing" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)', textDecoration: 'none' }}>Pricing</Link>
          <button onClick={() => setDark((d) => !d)} aria-label="Toggle theme" style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {dark
              ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.4" /><path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.1 3.1l1.06 1.06M10.84 10.84l1.06 1.06M3.1 11.9l1.06-1.06M10.84 4.16l1.06-1.06" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12.5 8.5A5.5 5.5 0 015.5 1.5a5.5 5.5 0 100 11 5.5 5.5 0 007-4z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
          <Link href="/rolepitch/start" style={{
            background: 'var(--accent)', color: 'white', padding: '7px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}>Get Started</Link>
        </div>
      </div>
    </nav>
  );
}

function Avatar({ i, c, size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: c + '22', border: `1.5px solid ${c}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color: c, flexShrink: 0,
    }}>{i}</div>
  );
}

function Pill({ label, tc, tb, sm }) {
  return (
    <span style={{
      fontSize: sm ? 10 : 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      color: tc, background: tb, padding: sm ? '2px 8px' : '3px 10px', borderRadius: 20,
      display: 'inline-block',
    }}>{label}</span>
  );
}

function FeaturedPost({ p }) {
  const [hov, setHov] = useState(false);
  const ts = tagStyle(p.tag);
  return (
    <Link href={`/blog/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <article onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        className="featured-grid"
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
          overflow: 'hidden', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 1fr',
          minHeight: 360,
          boxShadow: hov ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
          transform: hov ? 'translateY(-3px)' : 'translateY(0)',
          transition: 'all 0.25s ease',
        }}>
        <div style={{ borderRight: '1px solid var(--border)', position: 'relative', overflow: 'hidden', minHeight: 300 }}>
          <Illustration color={ts.tc} idx={p.img} />
          <div style={{
            position: 'absolute', top: 16, left: 16,
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em',
            color: ts.tc, background: ts.tb, border: `1px solid ${ts.tc}30`,
            padding: '3px 8px', borderRadius: 4,
          }}>FEATURED</div>
        </div>
        <div style={{ padding: '44px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ marginBottom: 16 }}><Pill label={p.tag} tc={ts.tc} tb={ts.tb} /></div>
            <h2 style={{
              fontFamily: 'var(--serif)', fontSize: 'clamp(20px,2.2vw,28px)', fontWeight: 400,
              lineHeight: 1.25, letterSpacing: '-0.01em', marginBottom: 16, color: 'var(--text)',
            }}>{p.title}</h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>{p.excerpt}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar i={p.ai} c={p.ac} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.author}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{formatDate(p.date)}</div>
              </div>
            </div>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              padding: '4px 10px', borderRadius: 20,
            }}>{p.rt}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function PostCard({ p, idx }) {
  const [hov, setHov] = useState(false);
  const ts = tagStyle(p.tag);
  return (
    <Link href={`/blog/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <article onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%',
          boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-sm)',
          transform: hov ? 'translateY(-3px)' : 'translateY(0)',
          transition: 'all 0.25s ease',
          animation: `rpFadeUp 0.45s ease both ${idx * 70}ms`,
        }}>
        <div style={{ height: 156, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
          <Illustration color={ts.tc} idx={p.img} />
          <div style={{ position: 'absolute', top: 10, left: 12 }}><Pill label={p.tag} tc={ts.tc} tb={ts.tb} sm /></div>
        </div>
        <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{
            fontFamily: 'var(--serif)', fontSize: 'clamp(15px,1.5vw,19px)', fontWeight: 400,
            lineHeight: 1.35, letterSpacing: '-0.01em', color: 'var(--text)', flex: 1,
          }}>{p.title}</h3>
          <p style={{
            fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{p.excerpt}</p>
          <div style={{
            borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 4,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar i={p.ai} c={p.ac} size={24} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.author}</div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{formatDate(p.date)}</div>
              </div>
            </div>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-faint)',
              background: 'var(--surface2)', padding: '3px 8px', borderRadius: 20,
            }}>{p.rt}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function Newsletter() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div style={{
      background: 'linear-gradient(135deg,var(--accent-dim) 0%,var(--green-dim) 100%)',
      border: '1px solid var(--border)', borderRadius: 20, padding: '48px 40px', textAlign: 'center',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '5px 14px', marginBottom: 20,
        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'block' }} />
        Weekly · Free
      </div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.2 }}>
        The 5‑minute career brief.
      </h3>
      <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 28px' }}>
        One actionable insight every week — resume strategy, pitch analysis, job market data.
      </p>
      {sent ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>
          ✓ You are in. Check your inbox.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', maxWidth: 400, margin: '0 auto' }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && email && setSent(true)}
            placeholder="your@email.com"
            style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9,
              padding: '11px 14px', fontSize: 14, color: 'var(--text)', outline: 'none', fontFamily: 'var(--sans)',
            }} />
          <button onClick={() => email && setSent(true)} style={{
            background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
            padding: '11px 20px', borderRadius: 9, fontSize: 14, fontWeight: 600, fontFamily: 'var(--sans)',
            whiteSpace: 'nowrap',
          }}>Subscribe →</button>
        </div>
      )}
    </div>
  );
}

export default function BlogLandingClient({ posts }) {
  const [dark, setDark] = useState(false);
  const [activeTag, setActiveTag] = useState('All');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('rp_theme') : null;
    if (stored === 'dark') setDark(true);
  }, []);

  useEffect(() => {
    const root = document.querySelector('.rp-blog');
    if (!root) return;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('rp_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const ATS_SLUG = 'why-your-resume-gets-rejected-by-ats-and-exactly-how-to-fix-it-for-remote-first-companies';
  const featured = posts.find((p) => p.featured) || posts.find((p) => p.slug === ATS_SLUG) || posts[0];
  const rest = posts
    .filter((p) => p.id !== featured?.id)
    .filter((p) => activeTag === 'All' || p.tag === activeTag)
    .sort((a, b) => (b.slug === ATS_SLUG ? 1 : 0) - (a.slug === ATS_SLUG ? 1 : 0));

  return (
    <>
      <Nav dark={dark} setDark={setDark} />
      <ReadingProgress />

      <section style={{
        paddingTop: 96, paddingBottom: 0, paddingLeft: 24, paddingRight: 24,
        background: `linear-gradient(180deg, ${dark ? 'oklch(0.13 0.035 248)' : '#eef1fc'} 0%, var(--bg) 100%)`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, ${dark ? 'rgba(79,110,247,0.07)' : 'rgba(79,110,247,0.06)'} 1px, transparent 1px)`, backgroundSize: '28px 28px', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', paddingBottom: 56 }}>
          <div className="fu" style={{ marginBottom: 40 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: dark ? 'oklch(0.62 0.19 248/0.12)' : 'rgba(79,110,247,0.1)',
              border: `1px solid ${dark ? 'oklch(0.62 0.19 248/0.25)' : 'rgba(79,110,247,0.2)'}`,
              borderRadius: 20, padding: '5px 14px', marginBottom: 20,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.03em' }}>The RolePitch Blog</span>
            </div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px,5vw,56px)', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 14, color: 'var(--text)' }}>
              Career insights,<br />
              <em style={{ color: 'var(--accent)' }}>without the fluff.</em>
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 460 }}>
              Data-backed strategies for job seekers who are serious about standing out.
            </p>
          </div>
          {featured && (
            <div className="fu2"><FeaturedPost p={featured} /></div>
          )}
          {!featured && (
            <div className="fu2" style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 20, padding: 56, textAlign: 'center', color: 'var(--text-muted)' }}>
              No posts published yet. Check back soon.
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: '48px 24px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TAGS.map((t) => (
              <button key={t} onClick={() => setActiveTag(t)} style={{
                padding: '7px 18px', borderRadius: 20, fontFamily: 'var(--sans)',
                border: `1px solid ${activeTag === t ? 'var(--accent)' : 'var(--border)'}`,
                background: activeTag === t ? 'var(--accent-dim)' : 'transparent',
                color: activeTag === t ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}>{t}</button>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)' }}>{rest.length} articles</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16, marginBottom: 56 }}>
          {rest.map((p, i) => <PostCard key={p.id} p={p} idx={i} />)}
        </div>

        <Newsletter />
      </section>

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
