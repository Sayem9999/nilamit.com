"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";

interface SortSelectorProps {
  currentSortBy: string;
  currentSortOrder: string;
  baseParams: Record<string, string>;
}

export default function SortSelector({
  currentSortBy,
  currentSortOrder,
  baseParams,
}: SortSelectorProps) {
  const router = useRouter();

  // Combine sortBy and sortOrder into a single value key
  const activeKey = `${currentSortBy}_${currentSortOrder}`;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sortBy, sortOrder] = e.target.value.split("_");
    
    // Merge base params and override sorting options
    const merged: Record<string, string> = { ...baseParams };
    merged.sortBy = sortBy;
    merged.sortOrder = sortOrder;

    // Remove empty values
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== null && v !== "") {
        query.set(k, v);
      }
    }

    router.push(`/auctions?${query.toString()}`);
  };

  return (
    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 border border-gray-200/50 rounded-lg px-2.5 py-1.5 transition-all text-xs">
      <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
      <select
        value={activeKey}
        onChange={handleChange}
        className="bg-transparent text-[11px] font-extrabold uppercase tracking-wider text-gray-650 outline-none cursor-pointer pr-1 border-none focus:ring-0"
        aria-label="Sort listings"
      >
        <option value="endTime_asc">Ending Soonest</option>
        <option value="createdAt_desc">Newly Listed</option>
        <option value="currentPrice_asc">Price: Low to High</option>
        <option value="currentPrice_desc">Price: High to Low</option>
        <option value="bids_desc">Popular: Most Bids</option>
      </select>
    </div>
  );
}
