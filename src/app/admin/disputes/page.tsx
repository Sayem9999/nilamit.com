import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import AdminDisputesClient from "./AdminDisputesClient";

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/login");

  return <AdminDisputesClient />;
}
