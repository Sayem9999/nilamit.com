'use server';

import { db, snapDocs, toSellerPublic } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function trackCategoryView(category: string) {
  const session = await auth();
  if (!session?.user?.id || !category) return;

  const prefRef  = db.collection('userPreferences').doc(session.user.id);
  const prefSnap = await prefRef.get();
  const prefs    = prefSnap.data() ?? {};

  const viewed: string[] = prefs.viewedCategories ?? [];
  viewed.unshift(category);
  const trimmed = viewed.slice(0, 50);

  // Affinity score — count appearances
  const affinity: Record<string, number> = prefs.affinityScore ?? {};
  affinity[category] = (affinity[category] ?? 0) + 1;

  await prefRef.set({
    id: session.user.id, userId: session.user.id,
    viewedCategories: trimmed, affinityScore: affinity,
    updatedAt: new Date(),
  }, { merge: true });
}

export async function getRecommendations(limit = 8) {
  const session = await auth();
  if (!session?.user?.id) return getGenericRecommendations(limit);

  const prefSnap = await db.collection('userPreferences').doc(session.user.id).get();
  const prefs    = prefSnap.data() ?? {};
  const affinity: Record<string, number> = prefs.affinityScore ?? {};

  const topCategories = Object.entries(affinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  if (topCategories.length === 0) return getGenericRecommendations(limit);

  const snaps = await Promise.all(
    topCategories.map(cat =>
      db.collection('auctions')
        .where('status', '==', 'ACTIVE')
        .where('category', '==', cat)
        .orderBy('endTime', 'asc')
        .limit(4)
        .get()
    )
  );

  const seen = new Set<string>();
  const auctions = snaps.flatMap(s =>
    snapDocs<any>(s).filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
  );

  let result = auctions;
  if (result.length < limit) {
    const backfill = await getGenericRecommendationsRaw(limit - result.length, [...seen]);
    result = [...result, ...backfill];
  }

  return hydrateAuctions(result.slice(0, limit));
}

export async function getGenericRecommendations(limit: number, excludeIds: string[] = []) {
  const raw = await getGenericRecommendationsRaw(limit, excludeIds);
  return hydrateAuctions(raw);
}

async function getGenericRecommendationsRaw(limit: number, excludeIds: string[] = []) {
  const snap = await db.collection('auctions')
    .where('status', '==', 'ACTIVE')
    .orderBy('endTime', 'asc')
    .limit(limit + excludeIds.length)
    .get();

  return snapDocs<any>(snap)
    .filter(d => !excludeIds.includes(d.id))
    .slice(0, limit);
}

async function hydrateAuctions(auctions: any[]): Promise<any[]> {
  if (auctions.length === 0) return [];

  const sellerIds = [...new Set(auctions.map(a => a.sellerId))];
  const sellerSnaps = sellerIds.length > 0 ? await db.getAll(...sellerIds.map(id => db.collection('users').doc(id))) : [];
  const sellerMap = new Map(sellerSnaps.map(s => [s.id, toSellerPublic(s.id, s.data())]));

  return auctions.map(a => {
    const rawEnd = a.endTime as any;
    const endTime = rawEnd?.toDate ? rawEnd.toDate() : new Date(rawEnd);
    return {
      ...a,
      seller: sellerMap.get(a.sellerId) || { id: a.sellerId, name: 'Unknown Seller', reputationScore: 0, dealsCompleted: 0 },
      endTime
    };
  });
}
