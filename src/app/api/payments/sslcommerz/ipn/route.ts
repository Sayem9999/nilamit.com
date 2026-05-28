/**
 * POST /api/payments/sslcommerz/ipn
 *
 * Server-to-server IPN (Instant Payment Notification) from SSLCommerz.
 *
 * Trust model: SSLCommerz signs every IPN with verify_sign + verify_key.
 * We recompute the hash locally and reject if it doesn't match — this is
 * what protects against forged "payment succeeded" calls.
 *
 * On verified VALID payment, we flip the escrow PENDING → VERIFICATION_PENDING
 * (admin still confirms before HELD, matching the bKash/Nagad flow).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyIPN, validatePayment } from "@/lib/sslcommerz";
import { log } from "@/lib/logger";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let payload: Record<string, string>;
  try {
    const form = await req.formData();
    payload = {};
    form.forEach((v, k) => {
      payload[k] = String(v);
    });
  } catch {
    return NextResponse.json({ error: "Invalid IPN body" }, { status: 400 });
  }

  // Step 1: verify the signature locally. Reject forgeries immediately.
  if (!verifyIPN(payload)) {
    log.warn("[SSLCommerz IPN] signature mismatch — possible forgery", {
      tranId: payload.tran_id,
      area: "escrow",
      severity: "warning",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const tranId = payload.tran_id;
  const status = payload.status;
  if (!tranId) {
    return NextResponse.json({ error: "Missing tran_id" }, { status: 400 });
  }

  // Parse our internal auctionId out of the tranId (format: nilamit-<auctionId>-<ts>).
  const match = tranId.match(/^nilamit-(.+)-(\d+)$/);
  if (!match) {
    log.warn("[SSLCommerz IPN] unparseable tran_id", { tranId });
    return NextResponse.json({ ok: true }, { status: 200 }); // Ack so SSLCommerz doesn't retry forever.
  }
  const auctionId = match[1];

  // Step 2: server-side re-validate against the SSLCommerz validation API.
  // Don't trust the IPN status field alone.
  const validation = await validatePayment(tranId);
  if (!validation.valid) {
    log.warn("[SSLCommerz IPN] validation API said invalid", { tranId, status: validation.status, area: "escrow" });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const escrowRef = db.collection("escrowTransactions").doc(auctionId);

  // Step 3: transactional state flip. Idempotent — if already advanced, no-op.
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(escrowRef);
      if (!snap.exists) throw new Error("Escrow not found");
      const escrow = snap.data() as { status: string; amount: number };

      // Only advance from PENDING. If already VERIFICATION_PENDING/HELD, this is a duplicate IPN — ignore.
      if (escrow.status !== "PENDING") {
        log.info("[SSLCommerz IPN] duplicate or late IPN — escrow already advanced", {
          auctionId,
          currentStatus: escrow.status,
        });
        return;
      }

      tx.update(escrowRef, {
        status: "VERIFICATION_PENDING",
        paymentMethod: "SSLCOMMERZ",
        paymentReference: tranId,
        paidAmount: validation.amount ?? escrow.amount,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    log.info("[SSLCommerz IPN] payment accepted", { auctionId, tranId, status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("[SSLCommerz IPN] state-flip transaction failed", err, {
      auctionId,
      area: "escrow",
      severity: "critical",
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
