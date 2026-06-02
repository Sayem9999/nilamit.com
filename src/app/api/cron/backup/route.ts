import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import { verifyCronSecret } from '@/lib/cron-utils';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/backup
 *
 * Automated database backup via a **managed Firestore export** to a GCS bucket.
 * This is the production-grade autobackup path (vs. the in-app JSON dump, which
 * is for small manual exports): Google streams a consistent, restorable export
 * server-side — no app memory pressure, no response-size limits, includes all
 * collections, and is point-in-time consistent.
 *
 * Env-gated: no-op (200) when BACKUP_GCS_BUCKET is unset, so the cron is safe to
 * schedule before the bucket/IAM are provisioned.
 *
 * One-time setup:
 *   1. Create a bucket:  gsutil mb -l asia-southeast1 gs://nilamit-backups
 *   2. Grant the app service account export rights:
 *        gcloud projects add-iam-policy-binding nilamit-52073 \
 *          --member="serviceAccount:<FIREBASE_CLIENT_EMAIL>" \
 *          --role="roles/datastore.importExportAdmin"
 *      and Storage Object Admin on the bucket.
 *   3. Set BACKUP_GCS_BUCKET=nilamit-backups (App Hosting env).
 *   4. (Optional) bucket lifecycle rule to expire backups after N days.
 *
 * Restore later:  gcloud firestore import gs://nilamit-backups/firestore/<stamp>
 */
export async function POST(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const bucket = process.env.BACKUP_GCS_BUCKET;
  if (!bucket) {
    log.warn('[Cron:backup] BACKUP_GCS_BUCKET not set — skipping managed export (no-op).');
    return NextResponse.json({ success: true, skipped: true, reason: 'BACKUP_GCS_BUCKET unset' });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    log.error('[Cron:backup] Missing Firebase service-account credentials', { area: 'admin', severity: 'critical' });
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    const auth = new GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/datastore'],
    });
    const accessToken = await auth.getAccessToken();
    if (!accessToken) throw new Error('Failed to mint access token for Firestore export');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputUriPrefix = `gs://${bucket}/firestore/${stamp}`;

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputUriPrefix }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      log.error('[Cron:backup] Firestore export request failed', { status: res.status, detail, area: 'admin', severity: 'critical' });
      return NextResponse.json({ error: 'Export failed', status: res.status }, { status: 502 });
    }

    const op = (await res.json()) as { name?: string };
    log.info('[Cron:backup] Managed Firestore export started', { outputUriPrefix, operation: op.name });
    return NextResponse.json({ success: true, outputUriPrefix, operation: op.name ?? null });
  } catch (error) {
    log.error('[Cron:backup] Managed export failed', error, { area: 'admin', severity: 'critical' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
