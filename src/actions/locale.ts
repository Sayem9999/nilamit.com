"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { locales, defaultLocale, type Locale } from "@/i18n";

/**
 * Server Action: switch the user's locale.
 * Sets the NEXT_LOCALE cookie that src/i18n.ts reads on every request,
 * then revalidates the calling path so Server Components re-render with
 * the new messages.
 */
export async function setLocale(locale: string): Promise<{ success: boolean }> {
  const next: Locale = (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;

  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
  return { success: true };
}
