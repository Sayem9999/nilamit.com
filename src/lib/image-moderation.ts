import 'server-only';

import { log } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

/**
 * Cloud Vision SafeSearch wrapper.
 *
 * Auto-degrades when Vision is unconfigured: if the API isn't enabled or the
 * service account lacks the role, this returns `{ allowed: true, reason:
 * 'unconfigured' }` so uploads aren't blocked by an infra gap. The audit log
 * line still fires so the gap is visible to operators.
 *
 * To enable in production:
 *   1. gcloud services enable vision.googleapis.com --project=nilamit-52073
 *   2. Grant `roles/cloudvision.user` to the FIREBASE_CLIENT_EMAIL service
 *      account.
 *   3. Set IMAGE_MODERATION=enabled in apphosting.yaml.
 */

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
  scores?: Record<string, string>;
}

const HARD_BLOCK = new Set(['LIKELY', 'VERY_LIKELY']);
const isEnabled  = process.env.IMAGE_MODERATION === 'enabled';

let _client: import('@google-cloud/vision').ImageAnnotatorClient | null = null;
let _initFailed = false;

async function getClient() {
  if (_client || _initFailed) return _client;
  try {
    const { ImageAnnotatorClient } = await import('@google-cloud/vision');
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      _initFailed = true;
      return null;
    }

    _client = new ImageAnnotatorClient({
      projectId,
      credentials: { client_email: clientEmail, private_key: privateKey },
    });
    return _client;
  } catch (e) {
    _initFailed = true;
    log.error('[image-moderation] Failed to init Vision client', e);
    return null;
  }
}

export async function moderateImage(buffer: Buffer): Promise<ModerationResult> {
  if (!isEnabled) {
    return { allowed: true, reason: 'unconfigured' };
  }

  const client = await getClient();
  if (!client) {
    log.warn('[image-moderation] Vision client unavailable; allowing upload (fail-open)');
    Sentry.captureMessage('[image-moderation] Vision client unavailable — fail-open', {
      level: 'warning',
      tags: { component: 'image-moderation', state: 'client-unavailable' },
    });
    return { allowed: true, reason: 'client-unavailable' };
  }

  try {
    const [response] = await client.safeSearchDetection({ image: { content: buffer } });
    const ss = response.safeSearchAnnotation;
    if (!ss) return { allowed: true, reason: 'no-annotation' };

    const scores = {
      adult:    String(ss.adult ?? 'UNKNOWN'),
      violence: String(ss.violence ?? 'UNKNOWN'),
      racy:     String(ss.racy ?? 'UNKNOWN'),
      medical:  String(ss.medical ?? 'UNKNOWN'),
      spoof:    String(ss.spoof ?? 'UNKNOWN'),
    };

    // Hard-block on adult/violence at LIKELY+. Racy/medical are advisory.
    if (HARD_BLOCK.has(scores.adult)) {
      return { allowed: false, reason: 'adult', scores };
    }
    if (HARD_BLOCK.has(scores.violence)) {
      return { allowed: false, reason: 'violence', scores };
    }

    return { allowed: true, scores };
  } catch (e) {
    log.error('[image-moderation] SafeSearch call failed (fail-open)', e);
    Sentry.captureException(e, {
      tags: { component: 'image-moderation', state: 'api-error' },
    });
    return { allowed: true, reason: 'api-error' };
  }
}
