'use server';

import { auth } from '@/lib/auth';
import { apiLimiter } from '@/lib/ratelimit';
import { ServiceResponse, errorResponse, ErrorType } from '@/lib/errors';
import { PricingService, type SmartPricingResult } from '@/services/pricing/pricing-service';
import { log } from '@/lib/logger';

/**
 * Calculates a smart pricing suggestion based on historical sold auctions, condition, and keywords.
 *
 * Auth-gated: the only legitimate caller is the (login-gated) create-auction
 * page, and the underlying query scans sold auctions — left open it would be
 * a free anonymous Firestore-read amplifier. Rate-limited per user on top
 * (fail-open; read-only data, availability wins).
 */
export async function getSmartPricingSuggestion(
  category: string,
  condition?: 'NEW' | 'USED' | 'REFURBISHED' | null,
  title?: string
): Promise<ServiceResponse<SmartPricingResult>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated');

  const gate = await apiLimiter.limit(`pricing_${session.user.id}`);
  if (!gate.success) {
    return errorResponse(ErrorType.RATE_LIMIT, 'Too many pricing requests — slow down a little.');
  }

  try {
    return await PricingService.getSmartPricing({ category, condition, title });
  } catch (error) {
    log.error('[Action] getSmartPricingSuggestion failed', error);
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred while fetching pricing suggestions.');
  }
}
