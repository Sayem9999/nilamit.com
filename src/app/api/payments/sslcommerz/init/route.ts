/**
 * POST /api/payments/sslcommerz/init
 *
 * Creates a SSLCommerz payment session for an escrow advance. Returns the
 * gateway URL — caller redirects the user there to complete payment.
 *
 * Auth: required. The session user must be the buyer for the escrow.
 * Rate-limited by depositLimiter to prevent gateway abuse.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, docData } from "@/lib/db";
import { initSession, isConfigured } from "@/lib/sslcommerz";
import { apiLimiter } from "@/lib/ratelimit";
import { log } from "@/lib/logger";
import type { EscrowTransaction } from "@/types";

export const dynamic = "force-dynamic";

const InputSchema = z.object({
  auctionId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "SSLCommerz is not configured on this deployment." },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await apiLimiter.limit(`sslcz:${session.user.id}`);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = InputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { auctionId } = parsed.data;

  // Load the escrow (doc ID = auctionId per the schema).
  const escrowSnap = await db.collection("escrowTransactions").doc(auctionId).get();
  const escrow = docData<EscrowTransaction>(escrowSnap);
  if (!escrow) {
    return NextResponse.json({ error: "Escrow not found" }, { status: 404 });
  }
  if (escrow.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Not your escrow" }, { status: 403 });
  }
  if (escrow.status !== "PENDING") {
    return NextResponse.json({ error: `Cannot pay an escrow in status ${escrow.status}` }, { status: 409 });
  }

  const auctionSnap = await db.collection("auctions").doc(auctionId).get();
  const auction = auctionSnap.exists ? auctionSnap.data() : null;
  if (!auction) {
    return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  }

  const userSnap = await db.collection("users").doc(session.user.id).get();
  const user = userSnap.data() ?? {};

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.nilamit.com";
  const tranId = `nilamit-${auctionId}-${Date.now()}`;

  try {
    const result = await initSession({
      tranId,
      amount: escrow.amount,
      productCategory: "auction-escrow",
      productName: auction.title || "Nilamit auction",
      customerName: user.name || session.user.name || "Buyer",
      customerEmail: user.email || session.user.email || "buyer@nilamit.com",
      customerPhone: user.phone || "0000000000",
      customerAddress: user.address || "Bangladesh",
      successUrl: `${baseUrl}/api/payments/sslcommerz/return?status=success&tran_id=${tranId}`,
      failUrl: `${baseUrl}/api/payments/sslcommerz/return?status=fail&tran_id=${tranId}`,
      cancelUrl: `${baseUrl}/api/payments/sslcommerz/return?status=cancel&tran_id=${tranId}`,
      ipnUrl: `${baseUrl}/api/payments/sslcommerz/ipn`,
    });

    if (result.status !== "SUCCESS" || !result.GatewayPageURL) {
      log.warn("[SSLCommerz] initSession non-success", { auctionId, status: result.status, reason: result.failedreason });
      return NextResponse.json({ error: result.failedreason || "Gateway init failed" }, { status: 502 });
    }

    // Stamp the escrow with the pending tranId so the IPN handler can correlate.
    await db.collection("escrowTransactions").doc(auctionId).update({
      sslcommerzTranId: tranId,
      sslcommerzInitiatedAt: new Date(),
    });

    return NextResponse.json({ redirectUrl: result.GatewayPageURL, tranId });
  } catch (err) {
    log.error("[SSLCommerz] initSession threw", err, { auctionId, area: "escrow", severity: "warning" });
    return NextResponse.json({ error: "Payment gateway unavailable" }, { status: 502 });
  }
}
