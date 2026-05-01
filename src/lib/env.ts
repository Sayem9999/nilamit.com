import { z } from 'zod';

/**
 * Nilamit Environment Schema
 * Defines the shape and constraints of all configuration variables.
 */
const envSchema = z.object({
  // --- CORE ---
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
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
      return process.env as unknown as Env;
    }

    console.error(`\n[Env] ❌  Invalid environment configuration:\n${errorMessages}\n`);
    throw new Error('Invalid environment configuration');
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
