/**
 * VAPID key helper.
 *
 * Generate keys once with: npx web-push generate-vapid-keys
 * Store as env vars:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (exposed to browser — safe)
 *   VAPID_PRIVATE_KEY             (server-only — never expose)
 *   VAPID_SUBJECT                 (mailto: contact)
 */

export function getVapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:pilot@careerpilot.ai';

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured — run: npx web-push generate-vapid-keys');
  }

  return { publicKey, privateKey, subject };
}

export function isConfigured() {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
