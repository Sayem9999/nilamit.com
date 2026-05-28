/**
 * Pub/Sub publisher — at-least-once delivery for downstream fan-out.
 *
 * Pattern: BidSideEffects (and similar critical paths) publish events here
 * instead of (or in addition to) calling notify/RTDB/FCM inline. Subscribers
 * run in Cloud Functions / Cloud Run with retry + DLQ — so a transient
 * notification failure doesn't drop the event silently.
 *
 * Env-gated: if PUBSUB_TOPIC_PREFIX isn't set we no-op cleanly. The inline
 * RTDB/FCM path in BidSideEffects keeps working in single-instance mode
 * until you provision Pub/Sub topics + subscribers (~1 day in GCP console
 * or via Terraform).
 *
 * Topic naming convention: `{PUBSUB_TOPIC_PREFIX}-{eventType}` so a single
 * project can host multiple environments (e.g. nilamit-prod-bid.placed,
 * nilamit-staging-bid.placed).
 */

import 'server-only';
import { log } from '@/lib/logger';

const TOPIC_PREFIX = process.env.PUBSUB_TOPIC_PREFIX;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;

type PubSubClient = {
  topic: (name: string) => {
    publishMessage: (m: { json: unknown; attributes?: Record<string, string> }) => Promise<string>;
  };
};

let _client: PubSubClient | null = null;

async function client(): Promise<PubSubClient | null> {
  if (typeof window !== 'undefined') return null;
  if (!TOPIC_PREFIX || !PROJECT_ID) return null;
  if (_client) return _client;
  try {
    const mod = await import('@google-cloud/pubsub');
    _client = new mod.PubSub({ projectId: PROJECT_ID }) as unknown as PubSubClient;
    return _client;
  } catch {
    // @google-cloud/pubsub not installed yet; install with:
    //   npm install @google-cloud/pubsub
    // and grant the App Hosting compute SA roles/pubsub.publisher.
    return null;
  }
}

export type PubSubEventType =
  | 'bid.placed'
  | 'auction.created'
  | 'auction.sold'
  | 'escrow.held'
  | 'escrow.released'
  | 'dispute.opened';

/**
 * Fire-and-forget publish. Resolves immediately so caller's critical-path
 * latency isn't affected. On failure we log + drop — alarms fire via
 * existing log.error pipeline tagged area=cron/severity=warning.
 */
export async function publish(
  eventType: PubSubEventType,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const c = await client();
  if (!c) return false;
  try {
    const topicName = `${TOPIC_PREFIX}-${eventType.replace('.', '-')}`;
    await c.topic(topicName).publishMessage({
      json: payload,
      attributes: {
        eventType,
        publishedAt: new Date().toISOString(),
      },
    });
    return true;
  } catch (err) {
    log.warn('[pubsub] publish failed', { eventType, error: String(err) });
    return false;
  }
}

export function isPubSubConfigured(): boolean {
  return !!TOPIC_PREFIX && !!PROJECT_ID;
}
