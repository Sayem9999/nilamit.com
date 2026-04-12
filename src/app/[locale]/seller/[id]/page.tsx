import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import AuctionCard from "@/components/auction/AuctionCard";
import { Shield, Star, Calendar, Package, Gavel } from "lucide-react";
import Image from "next/image";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function SellerProfilePage({ params }: Props) {
  const { id } = await params;

  const seller = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      isVerifiedSeller: true,
      isPhoneVerified: true,
      reputationScore: true,
      createdAt: true,
      winningStreak: true,
      userLevel: true,
      _count: { select: { bids: true } },
    },
  });

  if (!seller) return notFound();

  const auctions = await prisma.auction.findMany({
    where: { sellerId: id, status: { in: ["ACTIVE", "SOLD"] } },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          image: true,
          isVerifiedSeller: true,
          winningStreak: true,
          userLevel: true,
          reputationScore: true,
        },
      },
      _count: { select: { bids: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const reviews = await prisma.review.findMany({
    where: { toId: id },
    include: { from: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 mb-8">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {seller.image ? (
              <Image
                src={seller.image}
                alt=""
                width={80}
                height={80}
                className="object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-indigo-600">
                {(seller.name || "?")[0].toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-heading font-bold text-2xl text-gray-900">
                {seller.name || "Anonymous"}
              </h1>
              {seller.isVerifiedSeller && (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  <Shield className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Joined{" "}
                {new Date(seller.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Package className="w-4 h-4" /> {auctions.length} listings
              </span>
              <span className="flex items-center gap-1.5">
                <Gavel className="w-4 h-4" /> {seller._count.bids} bids
              </span>
              {avgRating && (
                <span className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />{" "}
                  {avgRating} ({reviews.length} reviews)
                </span>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400">
                Reputation
              </span>
              <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${Math.min(seller.reputationScore, 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-indigo-600">
                {seller.reputationScore}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="mb-8">
          <h2 className="font-heading font-bold text-lg text-gray-900 mb-4">
            Reviews
          </h2>
          <div className="grid gap-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-xl border border-gray-100 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${s <= review.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    by {review.from.name || "Anonymous"}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-600">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auctions */}
      <h2 className="font-heading font-bold text-lg text-gray-900 mb-4">
        {auctions.length > 0 ? "Listings" : "No listings yet"}
      </h2>
      {auctions.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {auctions.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction as Parameters<typeof AuctionCard>[0]["auction"]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
