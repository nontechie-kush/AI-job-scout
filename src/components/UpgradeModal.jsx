'use client';

import { useState } from 'react';

const PLANS = [
  { id: '5',  label: '5 pitches',  base: 200, popular: false, desc: 'Quick top-up' },
  { id: '25', label: '25 pitches', base: 299, popular: true,  desc: 'Best value' },
  { id: '50', label: '50 pitches', base: 499, popular: false, desc: 'Power user' },
];

const GST = 0.18;

function priceLine(base) {
  const gst = Math.round(base * GST);
  return { base, gst, total: base + gst };
}

export default function UpgradeModal({ onClose, onSuccess, trigger = 'manual' }) {
  const [selected, setSelected] = useState('25');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      // Step 1: Create order server-side
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selected }),
      });
      const order = await res.json();
      if (!res.ok || order.error) throw new Error(order.error || 'Failed to create order');

      // Step 2: Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'RolePitch',
        description: order.label,
        order_id: order.order_id,
        prefill: {},
        theme: { color: '#4f46e5' },
        handler: async (response) => {
          // Step 3: Verify signature server-side
          const vRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const vData = await vRes.json();
          if (!vRes.ok || vData.error) throw new Error(vData.error || 'Verification failed');
          onSuccess?.({ credits_added: vData.credits_added, new_balance: vData.new_balance });
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      rzp.on('payment.failed', (resp) => {
        setError('Payment failed — ' + (resp.error?.description || 'please try again'));
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const plan = PLANS.find(p => p.id === selected);
  const { base, gst, total } = priceLine(plan.base);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Load Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 420, padding: '32px 28px', position: 'relative', animation: 'rp-fadeUp 0.25s ease both' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-faint)', lineHeight: 1 }}
        >×</button>

        <div style={{ marginBottom: 24 }}>
          {trigger === 'no_credits'
            ? <><div style={{ fontSize: 24, marginBottom: 8 }}>🚀</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Out of pitches</h2>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>You've used all your free pitches. Top up to keep tailoring — your vault and memory are preserved.</p></>
            : <><h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Get more pitches</h2>
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>One-time purchase — no subscription.</p></>
          }
        </div>

        {/* Plan selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {PLANS.map(p => {
            const pr = priceLine(p.base);
            const isSelected = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  background: isSelected ? 'var(--accent-dim)' : 'var(--surface)',
                  transition: 'all 0.15s', position: 'relative',
                }}
              >
                {p.popular && (
                  <div style={{ position: 'absolute', top: -10, left: 16, background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.05em' }}>
                    POPULAR
                  </div>
                )}
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{p.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>₹{pr.total}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>incl. GST</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Price breakdown */}
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>{plan.label}</span><span>₹{base}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 8 }}>
            <span>GST (18%)</span><span>₹{gst}</span>
          </div>
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 8 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text)' }}>
            <span>Total</span><span>₹{total}</span>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: 'oklch(0.65 0.2 30)', background: 'oklch(0.65 0.2 30 / 0.1)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={loading}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'white', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--sans)' }}
        >
          {loading
            ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'rp-spin 0.7s linear infinite' }} /> Processing…</>
            : `Pay ₹${total} via Razorpay →`}
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', marginTop: 12 }}>
          Secured by Razorpay · UPI, cards, net banking accepted
        </div>
      </div>
    </div>
  );
}
