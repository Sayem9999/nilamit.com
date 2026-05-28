import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SellerAnalyticsTab } from "@/components/dashboard/SellerAnalyticsTab";
import type { Auction } from "@/types";

export const dynamic = "force-dynamic";

interface ListingMetric {
  id: string;
  title: string;
  images: string[];
  status: string;
  viewCount: number;
  bidCount: number;
  currentPrice: number;
  startingPrice: number;
  conversionRate: number;
}

export default async function SellerAnalyticsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/analytics");
  }

  // Pull seller's listings + compute the analytics metrics inline. Cheap —
  // page is gated to the seller's own data and we cap at 100 listings.
  const snap = await db
    .collection("auctions")
    .where("sellerId", "==", session.user.id)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const listings: ListingMetric[] = snap.docs.map((d) => {
    const a = d.data() as Auction & { viewCount?: number; bidCount?: number };
    const views = a.viewCount ?? 0;
    const bids = a.bidCount ?? 0;
    return {
      id: d.id,
      title: a.title,
      images: a.images ?? [],
      status: a.status,
      viewCount: views,
      bidCount: bids,
      currentPrice: a.currentPrice,
      startingPrice: a.startingPrice,
      conversionRate: views > 0 ? (bids / views) * 100 : 0,
    };
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary-600 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to dashboard
      </Link>
      <SellerAnalyticsTab listings={listings} />
    </div>
  );
}
