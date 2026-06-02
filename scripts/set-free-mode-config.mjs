/**
 * scripts/set-free-mode-config.mjs
 *
 * One-off: put the marketplace into "free launch" mode by writing the
 * operational flags onto systemConfig/default. Uses merge:true so existing
 * content fields (hero, announcement, treasury numbers) are preserved.
 *
 * Mode applied (see docs / audit advice): Free + Hybrid escrow, 0% commission.
 *   - commissionPercentageEnabled = false   (platform takes 0%)
 *   - hybridEscrowEnabled         = true    (small commitment + COD)
 *   - hybridCommitmentPercentage  = 2
 *   - escrowRequired              = true    (buyer protection on)
 *   - mfsLinkageRequired          = true    (traceability / anti-fraud)
 *   - biddingRequirementsEnabled  = true    (email/phone verification gate)
 *
 * Run:  node scripts/set-free-mode-config.mjs
 * Revert later by flipping these flags from the admin panel.
 */

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Prefer .env.local, fall back to .env
loadEnv({ path: existsSync('.env.local') ? '.env.local' : '.env' });

const projectId   = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let   privateKey  = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in env.');
  process.exit(1);
}
// .env stores the key with literal \n — convert to real newlines.
privateKey = privateKey.replace(/\\n/g, '\n');

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

const freeModeConfig = {
  commissionPercentageEnabled: false,
  hybridEscrowEnabled:         true,
  hybridCommitmentPercentage:  2,
  escrowRequired:              true,
  mfsLinkageRequired:          true,
  biddingRequirementsEnabled:  true,
  updatedAt:                   FieldValue.serverTimestamp(),
};

async function main() {
  const ref = db.collection('systemConfig').doc('default');
  console.log(`Project: ${projectId}`);
  console.log('Applying free-launch config (merge):', freeModeConfig);
  await ref.set(freeModeConfig, { merge: true });
  const after = (await ref.get()).data();
  console.log('✅ systemConfig/default updated. Current relevant flags:');
  console.log({
    commissionPercentageEnabled: after?.commissionPercentageEnabled,
    hybridEscrowEnabled:         after?.hybridEscrowEnabled,
    hybridCommitmentPercentage:  after?.hybridCommitmentPercentage,
    escrowRequired:              after?.escrowRequired,
    mfsLinkageRequired:          after?.mfsLinkageRequired,
    biddingRequirementsEnabled:  after?.biddingRequirementsEnabled,
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
