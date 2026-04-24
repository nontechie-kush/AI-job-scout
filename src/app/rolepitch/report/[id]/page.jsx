/**
 * /rolepitch/report/[id]
 *
 * Public shareable critique report. Fetches from rp_critiques by UUID.
 * Expires after 7 days (checked server-side via expires_at column).
 * No auth required — anyone with the link can view.
 */

import { createServiceClient } from '@/lib/supabase/service-client';
import ReportClient from './ReportClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  return {
    title: 'Resume Critique — RolePitch',
    description: 'Free resume critique powered by RolePitch AI',
  };
}

export default async function ReportPage({ params }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: row, error } = await supabase
    .from('rp_critiques')
    .select('id, name, target_context, critique_json, expires_at, created_at')
    .eq('id', id)
    .single();

  if (error || !row) {
    return <ExpiredOrNotFound reason="not_found" />;
  }

  if (new Date(row.expires_at) < new Date()) {
    return <ExpiredOrNotFound reason="expired" />;
  }

  return <ReportClient row={row} />;
}

function ExpiredOrNotFound({ reason }) {
  const CSS = `
    :root { --bg: oklch(0.98 0.006 248); --text: oklch(0.16 0.03 248); --text-muted: oklch(0.44 0.04 248); --accent: oklch(0.50 0.19 248); --border: oklch(0.86 0.015 248); --surface: oklch(0.955 0.009 248); --sans: 'DM Sans', sans-serif; }
    @keyframes rc-fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  `;
  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ fontFamily: 'var(--sans)', background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center', animation: 'rc-fadeUp 0.35s ease both' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{reason === 'expired' ? '⏳' : '🔍'}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>
            {reason === 'expired' ? 'This report has expired' : 'Report not found'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 24 }}>
            {reason === 'expired'
              ? 'Critique reports are available for 7 days after creation. Get a fresh critique of your resume below.'
              : "We couldn't find this report. It may have been removed or the link is incorrect."}
          </p>
          <a href="/rolepitch/critique" style={{ display: 'inline-block', background: 'var(--accent)', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Critique my resume — free →
          </a>
          <div style={{ marginTop: 16 }}>
            <a href="/rolepitch" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Back to RolePitch</a>
          </div>
        </div>
      </div>
    </>
  );
}
