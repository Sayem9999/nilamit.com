import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { SavedSearchesList } from "@/components/dashboard/SavedSearchesList";

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/saved-searches");
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary-600 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to dashboard
      </Link>
      <SavedSearchesList />
    </div>
  );
}
