import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { ServiceResponse, successResponse, errorResponse, ErrorType } from '@/lib/errors';

export interface SmartPricingResult {
  suggestedStart: number;
  expectedFinal: number;
  suggestedBuyNow: number;
  dataPoints: number;
  demandLevel: 'HIGH' | 'MODERATE' | 'LOW';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  avgBids: number;
  conditionAdjustment?: number; // average condition factor adjustment applied (multiplier)
}

const CONDITION_FACTORS = {
  NEW: 1.0,
  REFURBISHED: 0.85,
  USED: 0.70,
};

const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'this', 'that', 'from', 'best', 'used', 'new', 'vintage', 'original']);

function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

export class PricingService {
  /**
   * Generates optimal pricing recommendations based on historical auction sales
   */
  static async getSmartPricing(input: {
    category: string;
    condition?: 'NEW' | 'USED' | 'REFURBISHED' | null;
    title?: string;
  }): Promise<ServiceResponse<SmartPricingResult>> {
    const { category, condition, title } = input;
    const targetCondition = condition || 'USED';
    const targetFactor = CONDITION_FACTORS[targetCondition] || 0.70;

    try {
      // 1. Fetch recently SOLD auctions in the specified category (up to 100)
      const snap = await db.collection('auctions')
        .where('category', '==', category)
        .where('status', '==', 'SOLD')
        .limit(100)
        .get();

      // Fallback defaults if database has absolutely no records
      if (snap.empty) {
        log.info('[PricingService] No historical sales found in category. Returning generic fallback defaults.', { category });
        // Set standard base prices adjusted by condition
        const baseExpected = Math.round(3000 * targetFactor);
        const suggestedStart = Math.max(10, Math.round(baseExpected * 0.5));
        const suggestedBuyNow = Math.round(baseExpected * 1.3);

        return successResponse({
          suggestedStart,
          expectedFinal: baseExpected,
          suggestedBuyNow,
          dataPoints: 0,
          demandLevel: 'MODERATE',
          confidence: 'LOW',
          avgBids: 0,
          conditionAdjustment: 1.0,
        });
      }

      const inputTokens = tokenize(title || '');
      const candidates: {
        docId: string;
        title: string;
        startingPrice: number;
        currentPrice: number;
        condition: 'NEW' | 'USED' | 'REFURBISHED';
        bidCount: number;
        overlapScore: number;
      }[] = [];

      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.currentPrice && data.startingPrice) {
          const docTitle = data.title || '';
          let overlapScore = 0;

          if (inputTokens.length > 0) {
            const docTokens = tokenize(docTitle);
            const docTokenSet = new Set(docTokens);
            inputTokens.forEach((token) => {
              if (docTokenSet.has(token)) {
                overlapScore++;
              }
            });
          }

          candidates.push({
            docId: doc.id,
            title: docTitle,
            startingPrice: data.startingPrice,
            currentPrice: data.currentPrice,
            condition: data.condition || 'USED',
            bidCount: data.bidCount || 0,
            overlapScore,
          });
        }
      });

      // 2. Select the cohort (group of matching documents)
      // Sort candidates by overlap score descending
      candidates.sort((a, b) => b.overlapScore - a.overlapScore);

      let cohort = candidates;
      let hasKeywordMatch = false;

      // Filter cohort if we have good keyword matches
      const keywordMatches = candidates.filter(c => c.overlapScore >= 1);
      if (keywordMatches.length >= 3) {
        cohort = keywordMatches;
        hasKeywordMatch = true;
      } else if (keywordMatches.length > 0) {
        // If we have some matches but fewer than 3, mix them at the top of the general category
        cohort = candidates.slice(0, 30);
        hasKeywordMatch = true;
      } else {
        // No keyword matches; use last 30 general category listings
        cohort = candidates.slice(0, 30);
      }

      // 3. Compute statistics and apply condition normalization factors
      let totalSoldPrice = 0;
      let totalStartingPrice = 0;
      let totalBids = 0;
      let totalAdjustmentFactor = 0;

      cohort.forEach((item) => {
        const itemFactor = CONDITION_FACTORS[item.condition] || 0.70;
        // Multiplier to normalize the historical price to the target item condition
        const conditionMultiplier = targetFactor / itemFactor;

        totalSoldPrice += item.currentPrice * conditionMultiplier;
        totalStartingPrice += item.startingPrice * conditionMultiplier;
        totalBids += item.bidCount;
        totalAdjustmentFactor += conditionMultiplier;
      });

      const cohortSize = cohort.length;
      const avgSoldPrice = Math.round(totalSoldPrice / cohortSize);
      const avgStartingPrice = Math.round(totalStartingPrice / cohortSize);
      const avgBids = Number((totalBids / cohortSize).toFixed(1));
      const avgConditionAdjustment = Number((totalAdjustmentFactor / cohortSize).toFixed(2));

      // 4. Calculate Demand Level based on average bid volume
      let demandLevel: 'HIGH' | 'MODERATE' | 'LOW' = 'MODERATE';
      if (avgBids >= 6) {
        demandLevel = 'HIGH';
      } else if (avgBids < 3) {
        demandLevel = 'LOW';
      }

      // 5. Determine Confidence Level
      let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (cohortSize >= 5 && hasKeywordMatch) {
        confidence = 'HIGH';
      } else if (cohortSize < 3) {
        confidence = 'LOW';
      }

      // Heuristic calculations based on demand
      let startFactor = 0.80; // default starting price factor
      let buyNowFactor = 1.25; // default buy-now markup

      if (demandLevel === 'HIGH') {
        startFactor = 0.90;  // Sellers can start higher when demand is strong
        buyNowFactor = 1.35; // Capture high exit premium
      } else if (demandLevel === 'LOW') {
        startFactor = 0.70;  // Start lower to entice first bidders
        buyNowFactor = 1.15; // Closer to expected final price
      }

      const suggestedStart = Math.max(10, Math.round(avgStartingPrice * startFactor));
      let suggestedBuyNow = Math.round(avgSoldPrice * buyNowFactor);

      // Sanity constraint: Buy It Now must be at least 1.5x of start price to make sense
      suggestedBuyNow = Math.max(suggestedBuyNow, Math.round(suggestedStart * 1.5));

      return successResponse({
        suggestedStart,
        expectedFinal: avgSoldPrice,
        suggestedBuyNow,
        dataPoints: cohortSize,
        demandLevel,
        confidence,
        avgBids,
        conditionAdjustment: avgConditionAdjustment,
      });

    } catch (error) {
      log.error('[PricingService] Failed to calculate smart pricing suggestion', error);
      return errorResponse(
        ErrorType.INTERNAL,
        'An error occurred while calculating the smart pricing suggestion.'
      );
    }
  }
}
