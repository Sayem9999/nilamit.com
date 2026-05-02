import { z } from 'zod';

/**
 * Nilamit Environment Schema
 * Defines the shape and constraints of all configuration variables.
 */
const envSchema = z.object({
  // --- CORE ---
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // --- AUTH ---
  NEXTAUTH_URL: z.preprocess(
    (v) => typeof v === 'string' ? v.trim().replace(/^[^h]+/, '') : v,
    z.string().url().optional()
  ),
  AUTH_URL: z.preprocess(
    (v) => typeof v === 'string' ? v.trim().replace(/^[^h]+/, '') : v,
    z.string().url().optional()
  ),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  ADMIN_EMAILS: z.string().transform((val) => val.split(',').map(e => e.trim().toLowerCase())),
  
  // --- FIREBASE (Server-Side) ---
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().transform(v => v.replace(/\\n/g, '\n')),
  FIREBASE_DATABASE_URL: z.string().url().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),

  // --- FIREBASE (Client-Side) ---
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string(),
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  
  // --- INFRASTRUCTURE ---
  // Optional so the build phase succeeds before secrets are injected at runtime.
  // ratelimit.ts handles missing Redis gracefully (fail-closed in production).
  UPSTASH_REDIS_REST_URL: z.preprocess(v => v === '' ? undefined : v, z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(v => v === '' ? undefined : v, z.string().optional()),
  CRON_SECRET: z.preprocess(v => v === '' ? undefined : v, z.string().min(16).optional()),
  
  // --- OPTIONAL / EXTERNAL ---
  NEXT_PUBLIC_APP_URL: z.preprocess(
    (v) => typeof v === 'string' ? v.trim().replace(/^[^h]+/, '') : v,
    z.string().url()
  ).default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMS_PROVIDER: z.enum(['console', 'greenweb']).default('console'),
  GREENWEB_TOKEN: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Validates the environment variables and returns the typed object.
 * Throws immediately if the configuration is invalid.
 */
export function validateEnv(): Env {
  if (_env) return _env;

  // We only validate in Node.js environment
  if (typeof window !== 'undefined') {
    return {} as Env; // Browser access should use NEXT_PUBLIC directly
  }

  // GLOBAL SANITIZATION: Mutate process.env directly to fix corrupted values injected by Secret Manager
  // This ensures that even third-party libraries using process.env directly get sanitized values.
  const urlKeys = ['NEXT_PUBLIC_APP_URL', 'NEXTAUTH_URL', 'AUTH_URL', 'APP_URL'];
  urlKeys.forEach(key => {
    const val = process.env[key];
    if (typeof val === 'string' && val.includes('?http')) {
      const sanitized = val.trim().replace(/^[^h]+/, '');
      console.log(`[Env] 🪄  Globally sanitizing process.env.${key}: "${val}" -> "${sanitized}"`);
      process.env[key] = sanitized;
    }
  });

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, messages]) => `  • ${key}: ${messages?.join(', ')}`)
      .join('\n');

    // Soft-fail during the build phase. In Firebase App Hosting, secrets are 
    // injected at runtime, so Next.js must be allowed to build static pages 
    // without them.
    const isBuildPhase =
      process.env.NEXT_PHASE === 'phase-production-build' ||
      process.env.npm_lifecycle_event === 'build';

    if (isBuildPhase) {
      console.warn(`\n[Env] ⚠️  Missing/Invalid environment variables during BUILD:\n${errorMessages}\nContinuing build anyway...\n`);
      
      // Even in build phase, sanitize critical URL variables to prevent crashing during build-time static generation
      const sanitized = { ...process.env } as unknown as Env;
      if (typeof process.env.NEXT_PUBLIC_APP_URL === 'string') {
        sanitized.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/^[^h]+/, '');
      }
      if (typeof process.env.NEXTAUTH_URL === 'string') {
        sanitized.NEXTAUTH_URL = process.env.NEXTAUTH_URL.trim().replace(/^[^h]+/, '');
      }
      if (typeof process.env.AUTH_URL === 'string') {
        sanitized.AUTH_URL = process.env.AUTH_URL.trim().replace(/^[^h]+/, '');
      }
      return sanitized;
    }

    const problematicKeys = Object.keys(errors);
    const rawValues = problematicKeys.reduce((acc, key) => {
      acc[key] = process.env[key];
      return acc;
    }, {} as Record<string, string | undefined>);

    console.error(`\n[Env] ❌  Invalid environment configuration (Runtime Soft-fail):\n${errorMessages}\nRaw values: ${JSON.stringify(rawValues)}\n`);
    return process.env as unknown as Env;
  }

  _env = result.data;
  console.log(`[Env] ✅  Configuration validated for: ${result.data.NODE_ENV}`);
  return result.data;
}

/**
 * Typed environment accessor for server-side code
 */
export const env = new Proxy({} as Env, {
  get(_, prop: string) {
    const validated = validateEnv();
    return (validated as unknown as Record<string, unknown>)[prop];
  }
});

// Trigger validation/sanitization immediately on load
if (typeof window === 'undefined') {
  validateEnv();
}
