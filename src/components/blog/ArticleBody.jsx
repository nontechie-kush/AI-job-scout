import { Fragment } from 'react';

function StatCallout({ stat, label, sub }) {
  return (
    <div style={{
      background: 'var(--accent-dim)', border: '1px solid rgba(79,110,247,0.18)',
      borderRadius: 12, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 20, margin: '2em 0',
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 40, fontWeight: 600, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1, flexShrink: 0 }}>{stat}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

function PullQuote({ text }) {
  return (
    <div style={{ borderLeft: '3px solid var(--accent)', padding: '8px 0 8px 28px', margin: '2.2em 0' }}>
      <p style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(19px,2.2vw,24px)', fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>{text}</p>
    </div>
  );
}

function InlineCta() {
  return (
    <div style={{
      background: 'linear-gradient(135deg,var(--accent-dim) 0%,var(--green-dim) 100%)',
      border: '1px solid rgba(79,110,247,0.2)',
      borderRadius: 14, padding: '28px 32px',
      margin: '2.5em 0', textAlign: 'center',
    }}>
      <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.01em' }}>
        See where your resume is losing points.
      </p>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
        Upload your resume — get an ATS readiness score and the fixes to improve it.
      </p>
      <a href="/rolepitch/critique" style={{
        background: 'var(--accent)', color: 'white', display: 'inline-block',
        padding: '11px 26px', borderRadius: 9, fontSize: 14, fontWeight: 600,
        textDecoration: 'none', letterSpacing: '-0.01em',
      }}>Check my ATS score free →</a>
    </div>
  );
}

function ComparisonBox({ bad_label, bad, good_label, good }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: '24px 28px', margin: '2em 0', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 16 }}>Example</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f43f5e', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>{bad_label || 'Generic'}</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{bad}</p>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>{good_label || 'Specific'}</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{good}</p>
        </div>
      </div>
    </div>
  );
}

// Parses key="value" pairs from a directive line
function parseAttrs(s) {
  const out = {};
  const re = /(\w+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(s)) !== null) out[m[1]] = m[2];
  return out;
}

function inline(text) {
  // bold + italic + links — minimal but safe
  const nodes = [];
  let i = 0;
  let key = 0;
  const push = (n) => nodes.push(<Fragment key={key++}>{n}</Fragment>);
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) push(text.slice(last, m.index));
    if (m[2]) push(<strong>{m[2]}</strong>);
    else if (m[3]) push(<em>{m[3]}</em>);
    else if (m[4]) push(<em>{m[4]}</em>);
    else if (m[5]) push(<a href={m[6]}>{m[5]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) push(text.slice(last));
  return nodes;
}

function slugifyHeading(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export function extractSections(markdown) {
  const out = [];
  const lines = (markdown || '').split('\n');
  for (const ln of lines) {
    const m = ln.match(/^##\s+(.+)$/);
    if (m) out.push({ id: slugifyHeading(m[1]), label: m[1] });
  }
  return out;
}

export default function ArticleBody({ markdown }) {
  if (!markdown) return null;
  const lines = markdown.split('\n');
  const out = [];
  let key = 0;
  const push = (n) => out.push(<Fragment key={key++}>{n}</Fragment>);

  let i = 0;
  let listBuf = null; // {type: 'ul'|'ol', items: []}

  function flushList() {
    if (!listBuf) return;
    const Tag = listBuf.type;
    push(<Tag>{listBuf.items.map((item, k) => <li key={k}>{inline(item)}</li>)}</Tag>);
    listBuf = null;
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\r$/, '');

    // custom block: :::stat ...
    const dir = line.match(/^:::(stat|quote|compare|cta)\s*(.*)$/);
    if (dir) {
      flushList();
      const attrs = parseAttrs(dir[2]);
      if (dir[1] === 'stat') push(<StatCallout stat={attrs.stat} label={attrs.label} sub={attrs.sub} />);
      else if (dir[1] === 'quote') push(<PullQuote text={attrs.text} />);
      else if (dir[1] === 'compare') push(<ComparisonBox bad_label={attrs.bad_label} bad={attrs.bad} good_label={attrs.good_label} good={attrs.good} />);
      else if (dir[1] === 'cta') push(<InlineCta />);
      i++; continue;
    }

    if (/^---\s*$/.test(line)) { flushList(); push(<hr />); i++; continue; }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) { flushList(); push(<h2 id={slugifyHeading(h2[1])}>{inline(h2[1])}</h2>); i++; continue; }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) { flushList(); push(<h3>{inline(h3[1])}</h3>); i++; continue; }

    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      if (!listBuf || listBuf.type !== 'ol') { flushList(); listBuf = { type: 'ol', items: [] }; }
      listBuf.items.push(ol[1]); i++; continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ul) {
      if (!listBuf || listBuf.type !== 'ul') { flushList(); listBuf = { type: 'ul', items: [] }; }
      listBuf.items.push(ul[1]); i++; continue;
    }

    const bq = line.match(/^>\s+(.+)$/);
    if (bq) { flushList(); push(<blockquote>{inline(bq[1])}</blockquote>); i++; continue; }

    if (line.trim() === '') { flushList(); i++; continue; }

    // Paragraph — collect contiguous non-empty, non-special lines
    flushList();
    const buf = [line];
    let j = i + 1;
    while (j < lines.length) {
      const nx = lines[j].replace(/\r$/, '');
      if (nx.trim() === '') break;
      if (/^(##|###|>|:::|\s*\d+\.\s+|\s*[-*]\s|---)/.test(nx)) break;
      buf.push(nx);
      j++;
    }
    push(<p>{inline(buf.join(' '))}</p>);
    i = j;
  }
  flushList();
  return <>{out}</>;
}
