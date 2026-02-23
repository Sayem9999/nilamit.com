import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AuctionCard from "@/components/auction/AuctionCard";
import { Package, Heart, RefreshCw, LogOut } from "lucide-react";
import Link from "next/link";
import type { AuctionWithSeller } from "@/types";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/dashboard`);
  }

  const { tab } = await searchParams;
  const currentTab = tab || "watchlist";

  const userId = session.user.id;

  // Fetch relevant data based on tab
  let myAuctions: AuctionWithSeller[] = [];
  let watchlistAuctions: AuctionWithSeller[] = [];
  let activeBids: AuctionWithSeller[] = [];

  if (currentTab === "listings") {
    const rawAuctions = await prisma.auction.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        seller: {
          select: {
            name: true,
            image: true,
            isVerifiedSeller: true,
            reputationScore: true,
          },
        },
        _count: { select: { bids: true } },
        watchlist: { where: { userId } },
      },
    });
    myAuctions = rawAuctions as unknown as AuctionWithSeller[];
  } else if (currentTab === "watchlist") {
    const watchlists = await prisma.watchlist.findMany({
      where: { userId },
      include: {
        auction: {
          include: {
            seller: {
              select: {
                name: true,
                image: true,
                isVerifiedSeller: true,
                reputationScore: true,
              },
            },
            _count: { select: { bids: true } },
            watchlist: { where: { userId } },
          },
        },
      },
    });
    watchlistAuctions = watchlists.map(
      (w) => w.auction,
    ) as unknown as AuctionWithSeller[];
  } else if (currentTab === "bids") {
    // get unique auctions where user has placed a bid and auction is active
    const bids = await prisma.bid.findMany({
      where: { bidderId: userId, auction: { status: "ACTIVE" } },
      include: {
        auction: {
          include: {
            seller: {
              select: {
                name: true,
                image: true,
                isVerifiedSeller: true,
                reputationScore: true,
              },
            },
            _count: { select: { bids: true } },
            watchlist: { where: { userId } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["auctionId"],
    });
    activeBids = bids.map((b) => b.auction) as unknown as AuctionWithSeller[];
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-heading font-bold text-gray-900 mb-8">
          My Dashboard
        </h1>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
              <Link
                href={`/${locale}/dashboard?tab=watchlist`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  currentTab === "watchlist"
                    ? "bg-red-50 text-red-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Heart className="w-4 h-4" />
                Watchlist
              </Link>
              <Link
                href={`/${locale}/dashboard?tab=bids`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  currentTab === "bids"
                    ? "bg-primary-50 text-primary-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Active Bids
              </Link>
              <Link
                href={`/${locale}/dashboard?tab=listings`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  currentTab === "listings"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Package className="w-4 h-4" />
                My Listings
              </Link>

              <div className="pt-4 mt-4 border-t border-gray-100">
                <Link
                  href={`/${locale}/profile`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-gray-600 hover:bg-gray-50"
                >
                  <LogOut className="w-4 h-4" />
                  Profile Settings
                </Link>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {currentTab === "watchlist" && (
              <div>
                <h2 className="text-xl font-heading font-semibold text-gray-900 mb-6">
                  Saved Auctions ({watchlistAuctions.length})
                </h2>
                {watchlistAuctions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {watchlistAuctions.map((auction) => (
                      <AuctionCard
                        key={auction.id}
                        auction={auction}
                        locale={locale}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                    <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Your watchlist is empty.</p>
                  </div>
                )}
              </div>
            )}

            {currentTab === "bids" && (
              <div>
                <h2 className="text-xl font-heading font-semibold text-gray-900 mb-6">
                  Auctions You Are Winning or Tracking ({activeBids.length})
                </h2>
                {activeBids.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeBids.map((auction) => (
                      <AuctionCard
                        key={auction.id}
                        auction={auction}
                        locale={locale}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                    <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      You haven&apos;t placed any active bids recently.
                    </p>
                  </div>
                )}
              </div>
            )}

            {currentTab === "listings" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-heading font-semibold text-gray-900">
                    My Listings ({myAuctions.length})
                  </h2>
                  <Link
                    href={`/${locale}/auctions/create`}
                    className="px-4 py-2 bg-primary-600 text-white font-medium text-sm rounded-lg hover:bg-primary-700 transition"
                  >
                    + New Listing
                  </Link>
                </div>
                {myAuctions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myAuctions.map((auction) => (
                      <AuctionCard
                        key={auction.id}
                        auction={auction}
                        locale={locale}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      You haven&apos;t sold any items yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
