"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { LOCATIONS } from "@/types";

export function AreaQuickLinks({ locale }: { locale: string }) {
  // Take top 6 locations for the quick grid
  const quickLocs = LOCATIONS.slice(0, 6);

  return (
    <div className="py-12 border-t border-gray-100">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-heading font-bold text-gray-900">
            Browse by Area
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Find items near you for easier inspection and pickup.
          </p>
        </div>
        <Link 
          href={`/${locale}/search`}
          className="text-primary-600 font-semibold text-sm hover:underline"
        >
          View all locations
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {quickLocs.map((loc) => (
          <Link
            key={loc.id}
            href={`/${locale}/search?location=${loc.id}`}
            className="group p-6 bg-white rounded-2xl border border-gray-100 hover:border-primary-100 hover:bg-primary-50/30 transition-all duration-300 text-center flex flex-col items-center gap-3 shadow-sm hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
              <MapPin className="w-6 h-6" />
            </div>
            <span className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
              {loc.label}
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
              Dhaka
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
