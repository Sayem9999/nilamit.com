'use server';

import { db } from '@/lib/db';
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
    s.docs.map(d => ({ ...d.data(), id: d.id })).filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
  );

  if (auctions.length >= limit) return auctions.slice(0, limit);

  const backfill = await getGenericRecommendations(limit - auctions.length, [...seen]);
  return [...auctions, ...backfill].slice(0, limit);
}

async function getGenericRecommendations(limit: number, excludeIds: string[] = []) {
  const snap = await db.collection('auctions')
    .where('status', '==', 'ACTIVE')
    .orderBy('endTime', 'asc')
    .limit(limit + excludeIds.length)
    .get();

  return snap.docs
    .filter(d => !excludeIds.includes(d.id))
    .slice(0, limit)
    .map(d => ({ ...d.data(), id: d.id,
      endTime: d.data().endTime?.toDate?.() ?? new Date(d.data().endTime) }));
}
