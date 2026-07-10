'use server';

/**
 * Best Offer server actions — buyer makes an offer, seller accepts/declines.
 * Business logic lives in OfferService; sale finalization reuses the exact
 * Buy It Now path (processAuctionSale → escrow → coordination chat).
 */
import { auth } from '@/lib/auth';
import { makeOfferSchema, respondToOfferSchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse, type ServiceResponse } from '@/lib/errors';
import { bidLimiter, apiLimiter } from '@/lib/ratelimit';
import { OfferService, type OfferDoc } from '@/services/offer-service';
import { sendSaleNotifications } from '@/lib/auction-logic';
import { pushUserNotification } from '@/lib/firebase-admin';
import { FIREBASE_EVENTS } from '@/lib/firebase-events';
import { pushToUser } from '@/lib/fcm-sender';
import { formatBDT } from '@/lib/format';
import { ERROR_CODES } from '@/lib/constants';
import { log } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

const OFFER_ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.NOT_FOUND]: 'Listing not found.',
  [ERROR_CODES.AUCTION_NOT_ACTIVE]: 'This listing is no longer active.',
  [ERROR_CODES.AUCTION_ENDED]: 'This auction has ended.',
  [ERROR_CODES.SELF_BID_FORBIDDEN]: 'You cannot make an offer on your own listing.',
  [ERROR_CODES.BID_TOO_LOW]: 'Your offer must be higher than the current bid.',
  [ERROR_CODES.FORBIDDEN]: 'Only the seller can respond to this offer.',
  OFFER_ABOVE_BIN: 'Your offer meets the Buy It Now price — use Buy It Now instead.',
  OFFER_ALREADY_RESOLVED: 'This offer has already been responded to.',
};

function offerError(e: unknown): ServiceResponse<never> {
  const code = e instanceof Error ? e.message : '';
  const friendly = OFFER_ERROR_MESSAGES[code];
  if (friendly) return errorResponse(ErrorType.VALIDATION, friendly);
  log.error('[Offer] action failed', e, { area: 'bid', severity: 'warning' });
  return errorResponse(ErrorType.INTERNAL, 'Something went wrong. Please try again.');
}

export async function makeOffer(input: unknown): Promise<ServiceResponse<{ amount: number }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Sign in to make an offer.');

  const parsed = makeOfferSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  // Financial-adjacent action → fail-closed limiter, same budget as bidding.
  const gate = await bidLimiter.limit(`offer_${session.user.id}`);
  if (!gate.success) return errorResponse(ErrorType.RATE_LIMIT, 'Too many offers. Please slow down.');

  try {
    const { auctionId, amount, message } = parsed.data;
    const result = await OfferService.makeOffer(
      session.user.id,
      session.user.name ?? null,
      auctionId,
      amount,
      message,
    );

    // Notify the seller (RTDB inbox + browser push) — fire-and-forget.
    void pushUserNotification(result.sellerId, {
      event: FIREBASE_EVENTS.OFFER_RECEIVED,
      auctionId,
      auctionTitle: result.auctionTitle,
      amount: result.amount,
      buyerName: result.buyerName ?? undefined,
      timestamp: Date.now(),
    }).catch((e) => log.warn('[Offer] seller inbox notify failed', { error: e }));
    void pushToUser(result.sellerId, {
      title: `New offer on ${result.auctionTitle}`,
      body: `${result.buyerName ?? 'A buyer'} offered ${formatBDT(result.amount)}. Accept or decline from the listing page.`,
      clickAction: `/auctions/${auctionId}`,
      data: { event: 'OFFER_RECEIVED', auctionId },
    });

    log.event('offer_made', { userId: session.user.id, auctionId, amountBdt: amount });
    revalidatePath(`/auctions/${auctionId}`);
    return successResponse({ amount });
  } catch (e) {
    return offerError(e);
  }
}

export async function respondToOffer(input: unknown): Promise<ServiceResponse<{ accepted: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  const parsed = respondToOfferSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const gate = await apiLimiter.limit(`offer_respond_${session.user.id}`);
  if (!gate.success) return errorResponse(ErrorType.RATE_LIMIT, 'Too many requests. Please slow down.');

  try {
    const result = await OfferService.respondToOffer(
      session.user.id,
      parsed.data.offerId,
      parsed.data.response,
    );

    // Post-commit side effects only (transactions can retry).
    if (result.accepted && result.salePayload) {
      sendSaleNotifications(result.salePayload);
    }
    const event = result.accepted ? FIREBASE_EVENTS.OFFER_ACCEPTED : FIREBASE_EVENTS.OFFER_DECLINED;
    void pushUserNotification(result.buyerId, {
      event,
      auctionId: result.auctionId,
      auctionTitle: result.auctionTitle,
      amount: result.amount,
      timestamp: Date.now(),
    }).catch((e) => log.warn('[Offer] buyer inbox notify failed', { error: e }));
    void pushToUser(result.buyerId, {
      title: result.accepted ? 'Your offer was accepted! 🎉' : 'Your offer was declined',
      body: result.accepted
        ? `${result.auctionTitle} is yours for ${formatBDT(result.amount)}. Complete payment to secure it.`
        : `The seller declined your ${formatBDT(result.amount)} offer on ${result.auctionTitle}.`,
      clickAction: result.accepted ? '/dashboard?tab=won' : `/auctions/${result.auctionId}`,
      data: { event, auctionId: result.auctionId },
    });

    log.event(result.accepted ? 'offer_accepted' : 'offer_declined', {
      userId: session.user.id,
      auctionId: result.auctionId,
      amountBdt: result.amount,
    });
    revalidatePath(`/auctions/${result.auctionId}`);
    return successResponse({ accepted: result.accepted });
  } catch (e) {
    return offerError(e);
  }
}

export async function getAuctionOffers(auctionId: string): Promise<ServiceResponse<OfferDoc[]>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');
  if (typeof auctionId !== 'string' || !/^[A-Za-z0-9_-]{10,40}$/.test(auctionId)) {
    return errorResponse(ErrorType.VALIDATION, 'Invalid auction id');
  }
  try {
    // Cheap read gate — reuse the API budget so a scraper can't enumerate.
    const gate = await apiLimiter.limit(`offer_list_${session.user.id}`);
    if (!gate.success) return errorResponse(ErrorType.RATE_LIMIT, 'Too many requests.');
    const offers = await OfferService.getOffersFor(session.user.id, auctionId);
    return successResponse(offers);
  } catch (e) {
    log.error('[Offer] getAuctionOffers failed', e, { auctionId });
    return errorResponse(ErrorType.INTERNAL, 'Failed to load offers.');
  }
}

