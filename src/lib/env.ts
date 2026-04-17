/**
 * Environment Variable Validation
 *
 * Called once at server startup (or build time) to detect missing
 * configuration early — before any request is served.
 *
 * ❌ Any missing REQUIRED variable throws immediately with a clear message.
 * ⚠️  Any missing OPTIONAL variable logs a warning.
 */

const REQUIRED: Record<string, string> = {
  AUTH_SECRET:  'Auth.js secret — generate with: openssl rand -base64 32',
  ADMIN_EMAILS: 'Comma-separated admin email addresses',
};

const REQUIRED_IN_PRODUCTION: Record<string, string> = {
  // Firebase Admin SDK (server-side)
  FIREBASE_PROJECT_ID:    'Firebase project ID',
  FIREBASE_CLIENT_EMAIL:  'Firebase service account client email',
  FIREBASE_PRIVATE_KEY:   'Firebase service account private key',

  // Firebase Client SDK (browser)
  NEXT_PUBLIC_FIREBASE_API_KEY:            'Firebase Web API key',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:         'Firebase project ID (public)',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:'Firebase messaging sender ID',
  NEXT_PUBLIC_FIREBASE_APP_ID:             'Firebase app ID',

  CRON_SECRET: 'Cron job authorization secret (generate with: openssl rand -hex 32)',
};

const OPTIONAL: Record<string, string> = {
  // Firebase Storage / RTDB (have sensible defaults from project ID)
  FIREBASE_DATABASE_URL:               'Firebase RTDB URL (defaults to https://{project}-default-rtdb.firebaseio.com)',
  FIREBASE_STORAGE_BUCKET:             'Firebase Storage bucket (defaults to {project}.firebasestorage.app)',
  NEXT_PUBLIC_FIREBASE_DATABASE_URL:   'Firebase RTDB URL (public, for client SDK)',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'Firebase Storage bucket (public)',

  // Auth
  GOOGLE_CLIENT_ID:     'Google OAuth (sign-in with Google will be disabled)',
  GOOGLE_CLIENT_SECRET: 'Google OAuth secret',

  // App URL
  NEXT_PUBLIC_APP_URL: 'Public app URL (used in email links)',

  // Error tracking
  SENTRY_DSN: 'Sentry error tracking (errors will not be captured)',

  // SMS
  SMS_PROVIDER:    'SMS gateway (defaults to "console")',
  GREENWEB_TOKEN:  'GreenWeb SMS API token',
};

export function validateEnv(): void {
  if (process.env.NODE_ENV === 'test') return;

  const missing:  string[] = [];
  const warnings: string[] = [];

  for (const [key, description] of Object.entries(REQUIRED)) {
    if (!process.env[key]) {
      missing.push(`  • ${key} — ${description}`);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    for (const [key, description] of Object.entries(REQUIRED_IN_PRODUCTION)) {
      if (!process.env[key]) {
        missing.push(`  • ${key} — ${description}`);
      }
    }
  }

  for (const [key, description] of Object.entries(OPTIONAL)) {
    if (!process.env[key]) {
      warnings.push(`  • ${key} — ${description}`);
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `\n[Env] ⚠️  Optional variables not set (features may be degraded):\n${warnings.join('\n')}\n`
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `\n[Env] ❌  Missing required environment variables:\n\n${missing.join('\n')}\n\n` +
      `  → Copy .env.example to .env.local and fill in the missing values.\n`
    );
  }

  console.log('[Env] ✅  All required environment variables are set.');
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`[Env] Required environment variable "${key}" is not set.`);
  return value;
}

export function optionalEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}
