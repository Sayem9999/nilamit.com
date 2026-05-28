import { redirect } from "next/navigation";

/**
 * /search is a legacy listings route. The canonical listings page is
 * /auctions (since the eBay-style overhaul); this route now just maps
 * the old query-param shape and redirects.
 *
 * Param mapping:
 *   q → search
 *   sort=price_asc  → sortBy=currentPrice&sortOrder=asc
 *   sort=price_desc → sortBy=currentPrice&sortOrder=desc
 *   sort=endTime    → sortBy=endTime&sortOrder=asc
 *   sort=createdAt  → sortBy=createdAt&sortOrder=desc
 *   sort=bids       → sortBy=bids&sortOrder=desc
 *   category, location, condition → forwarded as-is
 *   circleId → dropped (no longer a filter)
 */
export const dynamic = "force-dynamic";

export default async function LegacySearchRedirect({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    location?: string;
    condition?: string;
    circleId?: string;
  }>;
}) {
  const { q, category, sort, location, condition } = await searchParams;

  // Translate sort shorthand → (sortBy, sortOrder) tuple
  const sortMap: Record<string, { sortBy: string; sortOrder: string }> = {
    price_asc: { sortBy: "currentPrice", sortOrder: "asc" },
    price_desc: { sortBy: "currentPrice", sortOrder: "desc" },
    endTime: { sortBy: "endTime", sortOrder: "asc" },
    createdAt: { sortBy: "createdAt", sortOrder: "desc" },
    bids: { sortBy: "bids", sortOrder: "desc" },
  };
  const sortPair = sort && sortMap[sort] ? sortMap[sort] : null;

  const params = new URLSearchParams();
  if (q) params.set("search", q);
  if (category && category !== "All") params.set("category", category);
  if (location) params.set("location", location);
  if (condition && condition !== "All") params.set("condition", condition);
  if (sortPair) {
    params.set("sortBy", sortPair.sortBy);
    params.set("sortOrder", sortPair.sortOrder);
  }

  const qs = params.toString();
  redirect(qs ? `/auctions?${qs}` : "/auctions");
}
