/**
 * Web Push send utility.
 *
 * sendPushToUser(userRow, payload) — sends to a user's stored subscription.
 * userRow must have: push_endpoint, push_p256dh, push_auth_key
 *
 * payload: { title, body, action_url?, icon? }
 */

import webpush from 'web-push';
import { getVapidKeys } from './vapid';

let vapidInitialized = false;

function initVapid() {
  if (vapidInitialized) return;
  const { publicKey, privateKey, subject } = getVapidKeys();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialized = true;
}

export async function sendPushToUser(userRow, payload) {
  if (!userRow.push_endpoint || !userRow.push_p256dh || !userRow.push_auth_key) {
    throw new Error('User has no push subscription stored');
  }

  initVapid();

  const subscription = {
    endpoint: userRow.push_endpoint,
    keys: {
      p256dh: userRow.push_p256dh,
      auth: userRow.push_auth_key,
    },
  };

  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
