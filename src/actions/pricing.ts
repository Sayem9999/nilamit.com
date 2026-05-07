'use server';

import { db } from '@/lib/db';
import { log } from '@/lib/logger';

export interface SmartPricingResult {
  suggestedStart: number;
  expectedFinal: number;
  suggestedBuyNow: number;
  dataPoints: number;
}

/**
 * Calculates a smart pricing suggestion based on historical sold auctions in the same category.
 */
export async function getSmartPricingSuggestion(category: string): Promise<SmartPricingResult | null> {
  try {
    // Note: To avoid requiring a new composite index, we query by category and status
    const snap = await db.collection('auctions')
      .where('category', '==', category)
      .where('status', '==', 'SOLD')
      .limit(30)
      .get();

    if (snap.empty) {
      return null;
    }

    let totalSoldPrice = 0;
    let totalStartingPrice = 0;
    let validAuctions = 0;

    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.currentPrice && data.startingPrice) {
        totalSoldPrice += data.currentPrice;
        totalStartingPrice += data.startingPrice;
        validAuctions++;
      }
    });

    if (validAuctions < 3) {
      // Not enough data for a reliable suggestion
      return null;
    }

    const avgSoldPrice = Math.round(totalSoldPrice / validAuctions);
    const avgStartingPrice = Math.round(totalStartingPrice / validAuctions);

    // Intelligent heuristic:
    // Suggest starting at 90% of the historical average starting price to encourage bidding
    // Suggest Buy It Now at 120% of the historical average final price for a premium exit
    const suggestedStart = Math.max(10, Math.round(avgStartingPrice * 0.9));
    const suggestedBuyNow = Math.round(avgSoldPrice * 1.2);

    return {
      suggestedStart,
      expectedFinal: avgSoldPrice,
      suggestedBuyNow,
      dataPoints: validAuctions
    };
  } catch (error) {
    log.error('[pricing] Failed to get smart pricing suggestion', error);
    return null;
  }
}
