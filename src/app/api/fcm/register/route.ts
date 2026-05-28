/**
 * POST /api/fcm/register
 *
 * Persists a FCM device token onto the current user. We store up to 10
 * tokens per user (one per device); writing the same token twice is a no-op.
 *
 * Tokens are pruned by the cron `enforce-policies` job — invalid tokens
 * surface as `messaging/registration-token-not-registered` errors when we
 * try to send, and we remove them then.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FieldValue } from "firebase-admin/firestore";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

const InputSchema = z.object({
  token: z.string().min(20).max(500),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = InputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    await db.collection("users").doc(session.user.id).update({
      fcmTokens: FieldValue.arrayUnion(parsed.data.token),
      fcmTokensUpdatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("[FCM] token persist failed", err, { userId: session.user.id });
    return NextResponse.json({ error: "Persist failed" }, { status: 500 });
  }
}
