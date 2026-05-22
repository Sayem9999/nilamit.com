'use server';

import { ServiceResponse, errorResponse, ErrorType } from '@/lib/errors';
import { PricingService, type SmartPricingResult } from '@/services/pricing/pricing-service';
import { log } from '@/lib/logger';

/**
 * Calculates a smart pricing suggestion based on historical sold auctions, condition, and keywords.
 */
export async function getSmartPricingSuggestion(
  category: string,
  condition?: 'NEW' | 'USED' | 'REFURBISHED' | null,
  title?: string
): Promise<ServiceResponse<SmartPricingResult>> {
  try {
    return await PricingService.getSmartPricing({ category, condition, title });
  } catch (error) {
    log.error('[Action] getSmartPricingSuggestion failed', error);
    return errorResponse(ErrorType.INTERNAL, 'An unexpected error occurred while fetching pricing suggestions.');
  }
}
