/**
 * /store — the platform's own first-party storefront.
 *
 * Lists every ACTIVE auction whose seller carries the admin-granted
 * isOfficialStore flag. This is the landing page to share on social media
 * ("shop official Nilamit deals") — OG metadata below renders a branded
 * preview card in FB/WhatsApp link unfurls.
 *
 * No composite index needed beyond the existing status+endTime one: we pull
 * live auctions ordered by ending-soonest and filter to official sellers in
 * memory (the official-seller set is tiny — it's the platform itself).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, ShieldCheck, Truck, ArrowRight } from 'lucide-react';
import AuctionCard from '@/components/auction/AuctionCard';
import { db, docData } from '@/lib/db';
import type { Auction, AuctionWithSeller } from '@/types';
import type { User } from '@/types/user';

export const revalidate = 300; // 5-min ISR — fresh enough for live prices

export const metadata: Metadata = {
  title: 'Official Nilamit Store — first-party deals, escrow protected',
  description:
    'Shop auctions sold directly by Nilamit. Every item verified, every payment escrow-protected, delivered anywhere in Bangladesh.',
  openGraph: {
    title: 'Official Nilamit Store',
    description:
      'First-party deals sold directly by Nilamit — verified items, escrow-protected payments.',
    images: [{ url: '/api/og?title=Official%20Nilamit%20Store', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
};

export default async function OfficialStorePage() {
  // 1. Who is "official"? Admin-granted flag, expected to be 1-few accounts.
  const officialSnap = await db
    .collection('users')
    .where('isOfficialStore', '==', true)
    .limit(30)
    .get();

  const officialSellers = new Map(
    officialSnap.docs.map((d) => [d.id, d.data() as User]),
  );

  // 2. Live auctions ending soonest, filtered to official sellers.
  let auctions: AuctionWithSeller[] = [];
  if (officialSellers.size > 0) {
    const auctionsSnap = await db
      .collection('auctions')
      .where('status', '==', 'ACTIVE')
      .orderBy('endTime', 'asc')
      .limit(150)
      .get();

    auctions = auctionsSnap.docs
      .filter((d) => officialSellers.has(d.data().sellerId as string))
      .slice(0, 48)
      .map((d) => {
        const a = docData<Auction>(d)!;
        const s = officialSellers.get(a.sellerId)!;
        return {
          ...a,
          seller: {
            id: a.sellerId,
            name: s.name ?? 'Nilamit',
            image: s.image ?? null,
            rating: s.rating ?? 0,
            ratingCount: s.ratingCount ?? 0,
            reputationScore: s.reputationScore ?? 0,
            emailVerified: null,
            isVerifiedSeller: !!s.isVerifiedSeller,
            isRetailer: !!s.isRetailer,
            isOfficialStore: true,
            winningStreak: s.winningStreak ?? 0,
            userLevel: s.userLevel ?? 1,
            isTopRated: !!s.isTopRated,
            salesCount: s.salesCount ?? 0,
            defectCount: s.defectCount ?? 0,
            isBanned: false,
          },
          _count: { bids: Number(a.bidCount ?? 0) },
        } as AuctionWithSeller;
      });
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm">
            <BadgeCheck className="w-3.5 h-3.5" /> Official Store
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight">
            Sold directly by Nilamit
          </h1>
          <p className="mt-3 max-w-2xl text-blue-100 text-sm md:text-base leading-relaxed">
            First-party listings, checked by our team before they go live. Bid with
            confidence — every purchase is escrow-protected until you confirm delivery.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-[13px] font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Escrow-protected payments
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4" /> Verified authentic items
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="w-4 h-4" /> Nationwide delivery
            </span>
          </div>
        </div>
      </section>

      {/* Listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {auctions.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">
                Live official auctions
                <span className="ml-2 text-sm font-semibold text-gray-400">
                  {auctions.length} item{auctions.length === 1 ? '' : 's'}
                </span>
              </h2>
              <Link
                href="/browse"
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Browse everything <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {auctions.map((a) => (
                <AuctionCard key={a.id} auction={a} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <BadgeCheck className="w-12 h-12 text-gray-300 mx-auto" />
            <h2 className="mt-4 text-lg font-bold text-gray-900">
              New official drops are on the way
            </h2>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              The official store restocks regularly. Meanwhile, thousands of community
              auctions are live right now.
            </p>
            <Link
              href="/browse"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              Browse live auctions <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
