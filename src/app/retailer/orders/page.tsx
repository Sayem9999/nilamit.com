import { redirect } from "next/navigation";

/**
 * Retailer orders are the seller's sold listings + escrow, which live in the
 * unified dashboard. This route previously rendered fabricated mock orders
 * (violating the no-mocks-in-production rule); it now redirects to the real
 * seller view.
 */
export default function RetailerOrdersPage() {
  redirect("/dashboard?tab=listings&mode=seller");
}
