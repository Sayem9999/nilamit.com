"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, ShieldCheck, Trophy, Sparkles, ChevronRight, Award, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { getProxiedAvatarUrl } from "@/lib/avatar";

interface Seller {
  id: string;
  name: string;
  image: string | null;
  rating: number;
  ratingCount: number;
  userLevel: number;
  salesCount: number;
  isTopRated: boolean;
}

interface TopSellersShowcaseProps {
  sellers: Seller[];
}

export function TopSellersShowcase({ sellers = [] }: TopSellersShowcaseProps) {
  if (sellers.length === 0) return null;

  return (
    <section className="py-20 relative overflow-hidden bg-slate-50/50 border-y border-gray-100" aria-labelledby="top-sellers-heading">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-100/10 rounded-full blur-[100px] -mr-48 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100/10 rounded-full blur-[100px] -ml-48 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs font-bold uppercase tracking-wide">
            <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
            Leading Retailers
          </div>
          <h2 id="top-sellers-heading" className="font-heading font-bold text-4xl sm:text-5xl text-gray-900 tracking-tight">
            Top Rated Storefronts
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto font-medium">
            Buy with absolute confidence from Bangladesh&apos;s most vetted, high-volume sellers and professional shops.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {sellers.map((seller, idx) => (
            <motion.div
              key={seller.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="group relative bg-white border border-gray-100 rounded-md p-6 hover:shadow-xl hover:shadow-primary-600/5 hover:border-primary-100 transition-all duration-300 flex flex-col justify-between"
            >
              {/* Premium Top Rated Banner Overlay */}
              {seller.isTopRated && (
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider shadow-xs">
                  <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                  TOP RATED
                </div>
              )}

              <div>
                <div className="flex items-center gap-4 mb-6">
                  {/* Avatar */}
                  <div className="relative w-16 h-16 rounded-full bg-gray-50 border-2 border-gray-100 shadow-sm shrink-0 overflow-hidden ring-2 ring-primary-50">
                    {seller.image ? (
                      <Image
                        src={getProxiedAvatarUrl(seller.image) || ""}
                        alt={seller.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-primary-50 rounded-full flex items-center justify-center">
                        <ShieldCheck className="w-8 h-8 text-primary-500" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-heading font-bold text-gray-900 group-hover:text-primary-600 transition-colors flex items-center gap-1">
                      {seller.name}
                      <ShieldCheck className="w-4 h-4 text-blue-500 fill-blue-500/10" />
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-bold text-gray-700">
                        {seller.rating ? seller.rating.toFixed(1) : "5.0"}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        ({seller.ratingCount || 0} reviews)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Level / Sales Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50/50 p-3 rounded-md border border-gray-50">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mb-0.5">Vetted Level</p>
                    <div className="flex items-center justify-center gap-1 text-sm font-bold text-slate-800">
                      <Award className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Lvl {seller.userLevel || 1}</span>
                    </div>
                  </div>
                  <div className="text-center border-l border-gray-150">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mb-0.5">Completed Sales</p>
                    <div className="flex items-center justify-center gap-1 text-sm font-bold text-slate-800">
                      <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
                      <span>{seller.salesCount || 0} Trades</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Storefront Link Button */}
              <Link
                href={`/seller/${seller.id}`}
                className="w-full inline-flex items-center justify-center py-3 bg-gray-50 border border-gray-100 hover:border-primary-200 hover:bg-primary-50 rounded-md text-xs font-bold text-gray-600 hover:text-primary-600 transition-all gap-1.5 shadow-xs"
              >
                Visit Storefront
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
