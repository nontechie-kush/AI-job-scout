/**
 * POST /api/payments/create-order
 *
 * Creates a Razorpay order server-side. Key secret never leaves server.
 *
 * Body: { plan: '5' | '25' | '50' }
 * Returns: { order_id, amount, currency, key_id }
 */

import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

const PLANS = {
  '5':  { credits: 5,  base_paise: 20000, label: '5 pitches' },
  '25': { credits: 25, base_paise: 29900, label: '25 pitches' },
  '50': { credits: 50, base_paise: 49900, label: '50 pitches' },
};

const GST_RATE = 0.18;

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

export async function POST(request) {
  try {
    // Auth check — must be logged in
    const supabase = await createClientFromRequest(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { plan } = await request.json();
    if (!PLANS[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

    const { credits, base_paise, label } = PLANS[plan];
    const gst_paise = Math.round(base_paise * GST_RATE);
    const total_paise = base_paise + gst_paise;

    // Create Razorpay order
    const order = await getRazorpay().orders.create({
      amount: total_paise,
      currency: 'INR',
      receipt: `rp_${user.id.slice(0, 8)}_${plan}_${Date.now()}`,
      notes: { user_id: user.id, plan, credits: String(credits) },
    });

    // Store pending order in DB
    const service = createServiceClient();
    await service.from('rolepitch_orders').insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      plan,
      credits_to_add: credits,
      amount_paise: total_paise,
      status: 'created',
    });

    return NextResponse.json({
      order_id: order.id,
      amount: total_paise,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID,  // public key only — safe to send
      label,
      credits,
    });
  } catch (err) {
    console.error('[create-order] error:', err?.message || err, 'stack:', err?.stack?.split('\n')[0]);
    return NextResponse.json({ error: 'Failed to create order', detail: err?.message }, { status: 500 });
  }
}
