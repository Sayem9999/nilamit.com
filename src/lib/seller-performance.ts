import { db } from './db';
import { log } from './logger';

/**
 * Performance thresholds for the "Top Rated" status in the Bangladesh context.
 */
const PERFORMANCE_THRESHOLDS = {
  MIN_SALES: 10,       // 10 successful sales
  MIN_RATING: 4.5,     // 4.5+ star rating
  MIN_COMPLETION: 0.9, // 90% completion rate
  MAX_DEFECT_RATE: 0.05, // 5% max defect rate (Adjusted for Nilamit context)
};

/**
 * Re-evaluates and updates a seller's Performance Status.
 * This should be called after escrow release, rating updates, or cancellations.
 */
export async function updateSellerPerformance(userId: string) {
  try {
    const userRef = db.collection('users').doc(userId);
    
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return;
      
      const userData = userSnap.data()!;
      
      // 1. Check basic eligibility (must be a Verified Seller)
      if (!userData.isVerifiedSeller) {
        tx.update(userRef, { isTopRated: false });
        return;
      }
      
      // 2. Fetch stats
      const salesCount = userData.salesCount || 0;
      const defectCount = userData.defectCount || 0;
      const rating = userData.rating || 0;
      const ratingCount = userData.ratingCount || 0;
      
      const totalAttemptedSales = salesCount + defectCount;
      const defectRate = totalAttemptedSales > 0 ? defectCount / totalAttemptedSales : 0;
      
      // 3. Determine Top Rated status
      const isTopRated = 
        salesCount >= PERFORMANCE_THRESHOLDS.MIN_SALES && 
        rating >= PERFORMANCE_THRESHOLDS.MIN_RATING &&
        ratingCount >= 5 &&
        defectRate <= PERFORMANCE_THRESHOLDS.MAX_DEFECT_RATE;
        
      if (userData.isTopRated !== isTopRated) {
        tx.update(userRef, { 
          isTopRated,
          updatedAt: new Date()
        });
        log.info(`[Performance] User ${userId} Top Rated status changed to: ${isTopRated} (Defect Rate: ${(defectRate * 100).toFixed(2)}%)`);
      }
    });
  } catch (err) {
    log.error(`[Performance] Failed to update performance for ${userId}`, err);
  }
}
