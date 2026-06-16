/**
 * place-bid-core.ts — the single source of truth for placing a bid.
 *
 * Both the web Server Action (src/actions/bid.ts) and the native-app HTTP bridge
 * (src/app/api/mobile/bid/route.ts) call `placeBidForUser`, so the rate limit,
 * privilege gates, high-value tiers, and the BiddingService transaction are
 * identical across surfaces. This is a plain server lib (NOT 'use server'), so
 * its exports are not public endpoints (CLAUDE.md rule 19) — the callers own the
 * transport-level auth.
 */
import { db } from '@/lib/db';
import { bidLimiter } from '@/lib/ratelimit';
import { ERROR_CODES } from '@/lib/constants';
import { BiddingService } from '@/services/bidding/bidding-service';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { placeBidSchema, formatZodError } from '@/lib/schemas';
import { getSystemConfig } from '@/actions/admin-content';
import { PlaceBidResult, SystemConfig } from '@/types';

export async function requireBiddingPrivileges(
  userId: string,
  systemConfig?: SystemConfig | null,
): Promise<ServiceResponse<Record<string, unknown>>> {
  const fetchPrivileges = unstable_cache(
    async (uid: string) => {
      const userSnap = await db.collection('users').doc(uid).get();
      if (!userSnap.exists) return { error: ERROR_CODES.NOT_FOUND };
      return { data: userSnap.data() };
    },
    [`user-privileges-${userId}`],
    { revalidate: 30, tags: [`user-${userId}`] },
  );

  const result = await fetchPrivileges(userId);
  if (result.error) return errorResponse(ErrorType.NOT_FOUND, 'User not found', result.error);

  const user = result.data!;
  const biddingReqs = systemConfig?.biddingRequirementsEnabled ?? true;
  if (biddingReqs) {
    const isEmailVerified = user.emailVerified != null;
    if (!isEmailVerified)
      return errorResponse(ErrorType.UNAUTHORIZED, 'Verification required. Please verify your email.', ERROR_CODES.UNAUTHORIZED);
  }
  if (user.isBanned) return errorResponse(ErrorType.FORBIDDEN, 'Your account has been banned for policy violations.', 'BANNED');
  if (user.isMinor) return errorResponse(ErrorType.FORBIDDEN, 'Users under 18 are not eligible to place binding bids or purchases.', 'MINOR');

  return successResponse(user as Record<string, unknown>);
}

/**
 * Place a bid as `userId`. Validates input, rate-limits, enforces privilege +
 * high-value tiers, then runs the BiddingService transaction and revalidates.
 * Transport-agnostic: pass the resolved userId, client ip, and user-agent.
 */
export async function placeBidForUser(
  userId: string,
  auctionId: string,
  amount: number,
  ip: string,
  userAgent: string,
): Promise<ServiceResponse<PlaceBidResult | null>> {
  const parsed = placeBidSchema.safeParse({ auctionId, amount });
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  // bidLimiter is fail-closed in production (see ratelimit.ts).
  const { success: rateLimitOk } = await bidLimiter.limit(`bid_${userId}_${ip}`);
  if (!rateLimitOk) return errorResponse(ErrorType.RATE_LIMIT, 'Too many bids placed rapidly. Please wait a moment.');

  try {
    // Async best-effort: record bidder's last active IP/UA.
    db.collection('users').doc(userId).update({
      lastActiveIp: ip,
      lastActiveUserAgent: userAgent,
      updatedAt: new Date(),
    }).catch((e) => log.error('[bid] Failed to update user last active IP/UA', e, { userId }));

    const configRes = await getSystemConfig();
    const systemConfig = configRes.success ? configRes.data : null;

    const privileges = await requireBiddingPrivileges(userId, systemConfig);
    if (!privileges.success) return privileges as ServiceResponse<never>;
    const user = privileges.data!;

    // ─── TIER 2: MFS Linkage Check (৳50,000+) ───
    const mfsReq = systemConfig?.mfsLinkageRequired ?? true;
    if (mfsReq && amount >= 50000 && !user.bkashNumber && !user.nagadNumber) {
      return errorResponse(
        ErrorType.FORBIDDEN,
        'MFS account linkage required for high-stake bidding (৳50,000+). Please link bKash or Nagad in your profile.',
        ERROR_CODES.MFS_LINKAGE_REQUIRED,
      );
    }

    // ─── TIER 3: Elite Trust Gate (৳150,000+) ───
    const ELITE_THRESHOLD = 150000;
    const MIN_RATING = 4.5;
    const MIN_SALES = 5;
    let eliteDepositRequired = 0;

    if (amount >= ELITE_THRESHOLD) {
      const isVetted = user.kycStatus === 'APPROVED';
      const currentRating = (user.rating as number) ?? 0;
      const salesCount = (user.ratingCount as number) ?? 0;

      if (!isVetted && (currentRating < MIN_RATING || salesCount < MIN_SALES)) {
        eliteDepositRequired = Math.floor(amount * 0.01);
        const depositSnap = await db.collection('bidDeposits')
          .where('bidderId', '==', userId)
          .where('auctionId', '==', auctionId)
          .where('status', '==', 'held')
          .get();
        const totalHeld = depositSnap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
        if (totalHeld < eliteDepositRequired) {
          return errorResponse(
            ErrorType.FORBIDDEN,
            `Elite auctions (৳150k+) require a 4.5★ rating or a 1% security deposit (৳${eliteDepositRequired.toLocaleString()}).`,
            ERROR_CODES.ELITE_DEPOSIT_REQUIRED,
          );
        }
      }
    }

    const result = await BiddingService.placeBid(auctionId, amount, userId, ip, userAgent, eliteDepositRequired);

    revalidateTag('auctions', { expire: 0 });
    revalidateTag('bids', { expire: 0 });
    revalidateTag('stats', { expire: 0 });
    revalidatePath(`/auctions/${auctionId}`);
    revalidatePath('/auctions');
    revalidatePath('/dashboard');

    if (!result.success) return result as ServiceResponse<never>;
    return successResponse(result.data!);
  } catch (error) {
    log.error('[bid] placeBidForUser failed', error, { userId, auctionId, amount, area: 'bid', severity: 'critical' });
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred.');
  }
}
