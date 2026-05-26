import { redirect } from "next/navigation";

export default function RetailerDashboardPage() {
  redirect("/dashboard?mode=seller");
}
