/**
 * GET /api/health
 *
 * Health-check endpoint for uptime monitors, load balancers, and CI smoke tests.
 * Returns HTTP 200 when the server + database are reachable, HTTP 503 otherwise.
 *
 * Response shape:
 *   { status: "ok" | "degraded", db: "ok" | "error", uptime: number, timestamp: string }
 */

import { db } from "@/lib/db";
import { log } from "@/lib/logger";

// Vercel cron / CDN must not cache health checks
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbStatus: "ok" | "error" = "error";
  let dbError: string | undefined;

  // Ping the database with a lightweight query
  try {
    await db.collection('_').limit(1).get();
    dbStatus = "ok";
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    log.error("[Health] Database ping failed", err);
  }

  const latencyMs = Date.now() - start;
  const allOk = dbStatus === "ok";

  return Response.json(
    {
      status: allOk ? "ok" : "degraded",
      db: dbStatus,
      ...(dbError ? { dbError } : {}),
      latencyMs,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
