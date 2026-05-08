"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Headless client component that mounts on successful email verification.
 * It triggers a NextAuth session update to immediately sync the new `emailVerified`
 * timestamp from Firestore to the client-side JWT session cookie.
 */
export function VerifySuccessClient() {
  const { update, data: session } = useSession();

  useEffect(() => {
    if (session) {
      update().catch((err) => {
        console.error("[VerifySuccessClient] Failed to trigger session update:", err);
      });
    }
  }, [session, update]);

  return null;
}
