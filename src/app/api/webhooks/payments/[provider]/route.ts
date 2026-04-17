import { NextRequest, NextResponse } from "next/server";
import { getAdapterByProvider } from "@/lib/payments";
import { db } from "@/lib/db";
import { rtdbPush } from "@/lib/firebase-admin";
import { RTDB_PATHS, FIREBASE_EVENTS } from "@/lib/firebase-events";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const adapter = getAdapterByProvider(provider);
  if (!adapter) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  let payload;
  try {
    payload = await adapter.parseWebhook(body, headers);
  } catch (e) {
    console.error(`[webhook:${provider}] parse failed`, e);
    return NextResponse.json({ error: "Parse failed" }, { status: 400 });
  }

  if (!payload.signatureOk) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!payload.transactionId) {
    return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
  }

  try {
    const txRef = db.collection("escrowTransactions").doc(payload.transactionId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const tx = txSnap.data()!;

    if (payload.status === "SUCCESS" && tx.status === "PENDING") {
      await txRef.update({
        status: "HELD",
        paymentMethod: `${provider}_automatic`,
        providerRef: payload.providerRef,
        verificationType: "AUTOMATIC",
        updatedAt: new Date(),
      });

      const auctionSnap = await db.collection("auctions").doc(tx.auctionId).get();
      const auction = auctionSnap.data() ?? {};
      if (auction.sellerId) {
        await rtdbPush(RTDB_PATHS.userNotifications(auction.sellerId), {
          event: FIREBASE_EVENTS.ADVANCE_PAID,
          auctionId: tx.auctionId,
          auctionTitle: auction.title,
          message: `Advance received for "${auction.title}".`,
        });
      }
    } else if (payload.status === "FAILED") {
      await txRef.update({
        providerRef: payload.providerRef,
        lastPaymentError: `Webhook FAILED at ${new Date().toISOString()}`,
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[webhook:${provider}] update failed`, e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
