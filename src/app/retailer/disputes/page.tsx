import { redirect } from "next/navigation";

/**
 * Seller disputes surface through the escrow/coordination flow in the unified
 * dashboard. This route previously rendered fabricated mock disputes (violating
 * the no-mocks-in-production rule); it now redirects to the real view.
 */
export default function RetailerDisputesPage() {
  redirect("/dashboard?tab=escrow&mode=seller");
}
