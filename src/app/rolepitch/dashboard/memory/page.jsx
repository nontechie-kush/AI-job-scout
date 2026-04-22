'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root {
    --bg:#f7f8fc; --surface:#fff; --surface2:#f0f2f8;
    --border:#e4e7f0; --border-subtle:#eceef6;
    --accent:#4f6ef7; --accent-dim:rgba(79,110,247,0.09);
    --green:#22c55e; --green-dim:rgba(34,197,94,0.09);
    --amber:#f59e0b; --amber-dim:rgba(245,158,11,0.09);
    --rose:#f43f5e;
    --text:#111827; --text-muted:#6b7280; --text-faint:#9ca3af;
    --mono:'JetBrains Mono',monospace; --sans:'DM Sans',sans-serif;
    --shadow-sm:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);
    --shadow-md:0 4px 16px rgba(0,0,0,0.07),0 1px 4px rgba(0,0,0,0.04);
  }
  [data-rp-theme="dark"] {
    --bg:oklch(0.11 0.03 248); --surface:oklch(0.155 0.035 248); --surface2:oklch(0.19 0.04 248);
    --border:oklch(0.26 0.04 248); --border-subtle:oklch(0.195 0.03 248);
    --accent:oklch(0.62 0.19 248); --accent-dim:oklch(0.62 0.19 248/0.12);
    --green:oklch(0.72 0.17 155); --green-dim:oklch(0.72 0.17 155/0.12);
    --amber:oklch(0.78 0.16 80); --amber-dim:oklch(0.78 0.16 80/0.12);
    --rose:oklch(0.7 0.2 10);
    --text:oklch(0.94 0.01 248); --text-muted:oklch(0.58 0.04 248); --text-faint:oklch(0.38 0.03 248);
    --shadow-sm:0 1px 3px rgba(0,0,0,0.3); --shadow-md:0 4px 16px rgba(0,0,0,0.3);
  }
  body{background:var(--bg);color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased;}
  html{scroll-behavior:smooth;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  @keyframes neuronPop{0%{opacity:0;transform:scale(0.3);}60%{transform:scale(1.15);}100%{opacity:1;transform:scale(1);}}
  @keyframes drawPath{from{stroke-dashoffset:var(--path-len);}to{stroke-dashoffset:0;}}
  @keyframes ripple{0%{transform:scale(1);opacity:0.6;}100%{transform:scale(2.4);opacity:0;}}
  @keyframes statIn{from{opacity:0;transform:scale(0.85);}to{opacity:1;transform:scale(1);}}
  .neuron{animation:neuronPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;}
  .axon-path{animation:drawPath 0.7s ease both;}
  .ev-label{animation:fadeUp 0.4s ease both;}
  .ripple-ring{animation:ripple 2s ease-out infinite;}
`;

// Build CONNECTIONS between events: upload→pitches, pitches chain, facts chain to nearest pitch
function buildConnections(events) {
  const conns = [];
  const uploadIdx = events.findIndex(e => e.type === 'upload');
  const pitchIdxs = events.map((e, i) => e.type === 'pitch' ? i : -1).filter(i => i >= 0);
  const factIdxs  = events.map((e, i) => e.type === 'fact'  ? i : -1).filter(i => i >= 0);
  const milestoneIdx = events.findIndex(e => e.type === 'milestone');

  // upload → first pitch
  if (uploadIdx >= 0 && pitchIdxs[0] !== undefined) conns.push([uploadIdx, pitchIdxs[0]]);
  // pitches ladder
  for (let i = 0; i < pitchIdxs.length - 1; i++) conns.push([pitchIdxs[i], pitchIdxs[i + 1]]);
  // each fact → nearest later pitch (or previous)
  factIdxs.forEach(fi => {
    const nextPitch = pitchIdxs.find(pi => pi > fi);
    const prevPitch = [...pitchIdxs].reverse().find(pi => pi < fi);
    const target = nextPitch ?? prevPitch;
    if (target !== undefined) conns.push([fi, target]);
  });
  // cross-fact connections (every other fact)
  for (let i = 0; i < factIdxs.length - 2; i += 2) conns.push([factIdxs[i], factIdxs[i + 2]]);
  // last pitch → milestone
  if (milestoneIdx >= 0 && pitchIdxs.length) conns.push([pitchIdxs[pitchIdxs.length - 1], milestoneIdx]);
  return conns;
}

function axonPath(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return `M${a.x},${a.y} C${a.x + dx * 0.2},${a.y + dy * 0.5} ${b.x - dx * 0.2},${b.y - dy * 0.5} ${b.x},${b.y}`;
}
function pathLen(a, b) {
  return Math.round(Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2) * 1.5);
}

function NeuronViz({ events, showLabels }) {
  const [activeCount, setActiveCount] = useState(0);
  const [hovered, setHovered] = useState(null);

  const connections = buildConnections(events);

  // Layout: SVG 700 wide, height = 140 * n events (min 600)
  const W = 700;
  const PER_NODE = 130;
  const H = Math.max(600, events.length * PER_NODE + 80);

  // Assign y positions: bottom (last event near top) — we render oldest at bottom
  const eventsWithPos = events.map((ev, i) => ({
    ...ev,
    // y: from bottom, so event 0 is near bottom, last event near top
    y: H - 60 - i * PER_NODE,
    x: ev.x || 350,
  }));

  useEffect(() => {
    setActiveCount(0);
    let i = 0;
    const tick = setInterval(() => {
      i++;
      setActiveCount(i);
      if (i >= events.length) clearInterval(tick);
    }, 140);
    return () => clearInterval(tick);
  }, [events.length]);

  const visible = eventsWithPos.slice(0, activeCount);
  const visibleIds = new Set(visible.map(e => e.id));

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 700, margin: '0 auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
        <defs>
          <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="spineGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#4f6ef7" stopOpacity="0.05"/>
            <stop offset="60%" stopColor="#4f6ef7" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.4"/>
          </linearGradient>
          <linearGradient id="axonGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#4f6ef7" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="#4f6ef7" stopOpacity="0.4"/>
          </linearGradient>
        </defs>

        {/* Spine */}
        <path
          d={`M350,${H - 50} C350,${H - 180} 350,180 350,60`}
          stroke="url(#spineGrad)" strokeWidth="2" fill="none"
          strokeDasharray="6 6"
          style={{ opacity: activeCount > 0 ? 1 : 0, transition: 'opacity 0.5s' }}
        />

        {/* Axons */}
        {connections.map(([fromId, toId], ci) => {
          const a = eventsWithPos.find(e => e.id === fromId);
          const b = eventsWithPos.find(e => e.id === toId);
          if (!a || !b || !visibleIds.has(fromId) || !visibleIds.has(toId)) return null;
          const len = pathLen(a, b);
          const isHot = hovered !== null && (hovered === fromId || hovered === toId);
          return (
            <path
              key={ci}
              d={axonPath(a, b)}
              stroke={isHot ? b.color : 'url(#axonGrad)'}
              strokeWidth={isHot ? 2 : 1.5}
              fill="none"
              strokeLinecap="round"
              className="axon-path"
              style={{
                '--path-len': len,
                strokeDasharray: len,
                strokeDashoffset: 0,
                opacity: isHot ? 0.9 : 0.35,
                transition: 'opacity 0.2s, stroke 0.2s',
                filter: isHot ? `drop-shadow(0 0 4px ${b.color})` : 'none',
              }}
            />
          );
        })}

        {/* Neurons */}
        {visible.map((ev, i) => {
          const isHov = hovered === ev.id;
          const isMilestone = ev.type === 'milestone';
          const r = isMilestone ? 26 : ev.type === 'pitch' ? 20 : 16;
          const delay = i * 80;
          return (
            <g key={ev.id} style={{ cursor: 'pointer' }}
               onMouseEnter={() => setHovered(ev.id)}
               onMouseLeave={() => setHovered(null)}>
              {(isHov || isMilestone) && (
                <circle cx={ev.x} cy={ev.y} r={r + 6}
                  fill="none" stroke={ev.color} strokeWidth="1.5"
                  className="ripple-ring"
                  style={{ opacity: 0.5, transformOrigin: `${ev.x}px ${ev.y}px` }}
                />
              )}
              <circle cx={ev.x} cy={ev.y} r={r + 10} fill={ev.color}
                style={{ opacity: isHov ? 0.12 : 0.06, transition: 'opacity 0.2s' }}
              />
              <circle cx={ev.x} cy={ev.y} r={r} fill={ev.color}
                className="neuron"
                style={{
                  animationDelay: `${delay}ms`,
                  filter: isHov || isMilestone
                    ? `drop-shadow(0 0 ${isMilestone ? 12 : 8}px ${ev.color})`
                    : `drop-shadow(0 0 4px ${ev.color}88)`,
                  transform: isHov ? 'scale(1.1)' : 'scale(1)',
                  transformOrigin: `${ev.x}px ${ev.y}px`,
                  transition: 'transform 0.2s, filter 0.2s',
                }}
              />
              <text x={ev.x} y={ev.y + 5} textAnchor="middle"
                fontSize={isMilestone ? 16 : 13}
                className="neuron"
                style={{ animationDelay: `${delay + 100}ms`, userSelect: 'none' }}
              >{ev.icon}</text>

              {/* Hover tooltip */}
              {isHov && (
                <g>
                  <rect
                    x={ev.x > 400 ? ev.x - 185 : ev.x + r + 8}
                    y={ev.y - 32}
                    width={174} height={60}
                    rx={8} fill="var(--surface)"
                    stroke={ev.color} strokeWidth="1"
                    style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.14))' }}
                  />
                  <text
                    x={ev.x > 400 ? ev.x - 98 : ev.x + r + 95}
                    y={ev.y - 10} textAnchor="middle"
                    fontSize="11" fontWeight="600" fill="var(--text)"
                    fontFamily="DM Sans, sans-serif"
                  >{ev.label.slice(0, 28)}{ev.label.length > 28 ? '…' : ''}</text>
                  <text
                    x={ev.x > 400 ? ev.x - 98 : ev.x + r + 95}
                    y={ev.y + 10} textAnchor="middle"
                    fontSize="10" fill="var(--text-muted)"
                    fontFamily="DM Sans, sans-serif"
                  >{ev.desc?.slice(0, 34)}{ev.desc?.length > 34 ? '…' : ''}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Climbing indicator */}
        {activeCount > 0 && activeCount < events.length && (
          <text
            x="350"
            y={Math.max(40, (eventsWithPos[activeCount - 1]?.y || 200) - 30)}
            textAnchor="middle" fontSize="10" fill="var(--accent)"
            fontFamily="JetBrains Mono, monospace" fontWeight="600"
            style={{ opacity: 0.7 }}
          >↑ climbing</text>
        )}
      </svg>

      {/* Side labels */}
      {showLabels && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', pointerEvents: 'none' }}>
          {visible.map((ev, i) => {
            const pct = (ev.y / H) * 100;
            const isRight = ev.x > 350;
            return (
              <div key={ev.id} className="ev-label" style={{
                position: 'absolute',
                top: `${pct}%`,
                left: isRight ? 'auto' : 0,
                right: isRight ? 0 : 'auto',
                transform: 'translateY(-50%)',
                maxWidth: 140,
                animationDelay: `${i * 80 + 200}ms`,
                opacity: hovered === null || hovered === ev.id ? 1 : 0.3,
                transition: 'opacity 0.2s',
              }}>
                <div style={{
                  background: 'var(--surface)',
                  border: `1px solid ${hovered === ev.id ? ev.color : 'var(--border)'}`,
                  borderRadius: 8, padding: '6px 10px',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'border-color 0.2s',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ev.color, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
                    {ev.type === 'upload' ? 'Start' : ev.type === 'pitch' ? 'Pitch' : ev.type === 'question' ? 'Q&A' : ev.type === 'milestone' ? '🏆 Best' : 'Atom'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500, lineHeight: 1.35 }}>
                    {ev.label.slice(0, 30)}{ev.label.length > 30 ? '…' : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Empty state when no pitches done yet
function EmptyState({ onStart }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'var(--accent-dim)', border: '2px solid var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, margin: '0 auto 24px',
      }}>🧠</div>
      <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Pilot hasn't learned anything yet.</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
        Tailor your first resume to start building memory.
      </p>
      <button onClick={onStart} style={{
        background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
        padding: '11px 22px', borderRadius: 9, fontSize: 14, fontWeight: 600,
        fontFamily: 'var(--sans)', letterSpacing: '-0.02em',
      }}>Start your first pitch →</button>
    </div>
  );
}

function StatPill({ value, label, color, delay }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 24px',
      display: 'flex', flexDirection: 'column', gap: 4,
      boxShadow: 'var(--shadow-sm)',
      animation: `statIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both ${delay}ms`,
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 600, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );
}

export default function MemoryPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem('rp_theme') || 'light';
    setDark(theme === 'dark');
    document.documentElement.setAttribute('data-rp-theme', theme);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-rp-theme', next ? 'dark' : 'light');
    localStorage.setItem('rp_theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    fetch('/api/rolepitch/memory')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const stats = data?.stats || {};
  const events = data?.events || [];
  const hasData = events.length > 0;

  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100, padding: '0 24px',
        background: 'var(--bg)', borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/rolepitch/dashboard')} style={{
            display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: 'var(--sans)', flexShrink: 0,
          }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M7 1L3 5.5 7 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <div style={{ width: 22, height: 22, background: 'var(--accent)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h7M2 11h9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>RolePitch</span>
            <span style={{ color: 'var(--border)', fontSize: 16 }}>·</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Pilot's Memory</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setShowLabels(v => !v)} style={{
              background: showLabels ? 'var(--accent-dim)' : 'var(--surface)',
              border: `1px solid ${showLabels ? 'var(--accent)' : 'var(--border)'}`,
              color: showLabels ? 'var(--accent)' : 'var(--text-muted)',
              borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--sans)',
            }}>Labels {showLabels ? 'on' : 'off'}</button>
            <button onClick={toggleDark} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, width: 34, height: 34, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {dark
                ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="3" stroke="var(--text)" strokeWidth="1.4"/><path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.1 3.1l1.06 1.06M10.84 10.84l1.06 1.06M3.1 11.9l1.06-1.06M10.84 4.16l1.06-1.06" stroke="var(--text)" strokeWidth="1.4" strokeLinecap="round"/></svg>
                : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12.5 8.5A5.5 5.5 0 015.5 1.5a5.5 5.5 0 100 11 5.5 5.5 0 007-4z" stroke="var(--text)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        paddingTop: 56, paddingBottom: 40, paddingLeft: 24, paddingRight: 24,
        textAlign: 'center',
        background: `linear-gradient(180deg, ${dark ? 'oklch(0.13 0.035 248)' : '#eef1fc'} 0%, var(--bg) 100%)`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle,${dark ? 'rgba(79,110,247,0.07)' : 'rgba(79,110,247,0.06)'} 1px,transparent 1px)`, backgroundSize: '28px 28px', pointerEvents: 'none' }}/>
        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: dark ? 'oklch(0.62 0.19 248/0.12)' : 'rgba(79,110,247,0.10)',
            border: `1px solid ${dark ? 'oklch(0.62 0.19 248/0.25)' : 'rgba(79,110,247,0.2)'}`,
            borderRadius: 20, padding: '5px 14px', marginBottom: 20,
            animation: 'fadeUp 0.5s ease both',
          }}>
            <span style={{ fontSize: 14 }}>🧠</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.03em' }}>Pilot's Memory</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 12, animation: 'fadeUp 0.5s ease both 0.1s' }}>
            Gets smarter<br/>every pitch.
          </h1>
          <p style={{ fontSize: 'clamp(13px,1.8vw,16px)', color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 480, margin: '0 auto 32px', animation: 'fadeUp 0.5s ease both 0.2s' }}>
            Every question you answer teaches Pilot a new fact. Watch your neural map grow as you climb towards the perfect pitch.
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeUp 0.5s ease both 0.3s' }}>
            <StatPill value={stats.total_events ?? 0} label="Total Events" color="var(--accent)" delay={0}/>
            <StatPill value={stats.pitches_done ?? 0} label="Pitches Done" color="var(--green)" delay={80}/>
            <StatPill value={stats.atoms_stored ?? 0} label="Atoms Stored" color="var(--amber)" delay={160}/>
            <StatPill value={stats.best_match ? `${stats.best_match}%` : '—'} label="Best Match" color="var(--green)" delay={240}/>
          </div>
        </div>
      </section>

      {/* Legend */}
      {hasData && (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 24px 0', display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { color: '#4f6ef7', label: 'Pitch tailored' },
            { color: '#22c55e', label: 'Q&A answered' },
            { color: '#f59e0b', label: 'Atom extracted' },
            { color: '#22c55e', label: 'Milestone', star: true },
          ].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, boxShadow: `0 0 6px ${l.color}88` }}/>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{l.label}</span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>· Hover neurons to inspect</div>
        </div>
      )}

      {/* Main content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 80px', position: 'relative' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }}/>
          </div>
        )}

        {error && (
          <div style={{ background: 'oklch(0.65 0.2 30/0.08)', border: '1px solid oklch(0.65 0.2 30/0.25)', borderRadius: 12, padding: '20px 24px', color: 'oklch(0.75 0.15 30)', fontSize: 14 }}>
            {error}
          </div>
        )}

        {!loading && !error && !hasData && (
          <EmptyState onStart={() => router.push('/rolepitch/start')} />
        )}

        {!loading && hasData && (
          <>
            {/* Depth axis */}
            <div style={{
              position: 'absolute', left: 0, top: 32, bottom: 80, width: 2,
              background: 'linear-gradient(to top, var(--border) 0%, var(--accent) 100%)',
              borderRadius: 1, marginLeft: 12,
            }}/>
            <div style={{
              position: 'absolute', left: 0, top: 32,
              fontSize: 10, color: 'var(--text-faint)',
              fontFamily: 'var(--mono)', letterSpacing: '0.06em',
              writingMode: 'vertical-rl', textOrientation: 'mixed',
              transform: 'rotate(180deg)', marginLeft: 4, paddingTop: 8,
            }}>MEMORY DEPTH ↑</div>

            <div style={{ paddingLeft: 32 }}>
              <NeuronViz events={events} showLabels={showLabels} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
