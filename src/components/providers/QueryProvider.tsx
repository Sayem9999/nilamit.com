"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * TanStack Query provider.
 *
 * Server-rendered data flows through Server Actions + `revalidatePath` (the
 * existing pattern). This Query client is for *client-side* fetches —
 * primarily realtime polling fallbacks, optimistic mutations, and any
 * future REST endpoints that need cache + retry.
 *
 * Defaults:
 *   - 30s stale time (auction prices change fast)
 *   - 1 retry (no infinite loops on permission failures)
 *   - refetchOnWindowFocus enabled (good for bid pages left open in a tab)
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
