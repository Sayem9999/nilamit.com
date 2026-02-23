"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function isWatched(auctionId: string): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.user?.id) return false;
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_auctionId: {
          userId: session.user.id,
          auctionId,
        },
      },
    });
    return !!existing;
  } catch (error) {
    return false;
  }
}

export async function toggleWatchlist(auctionId: string, pathname: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_auctionId: {
          userId,
          auctionId,
        },
      },
    });

    let isWatchlisted = false;

    if (existing) {
      await prisma.watchlist.delete({
        where: { id: existing.id },
      });
    } else {
      await prisma.watchlist.create({
        data: {
          userId,
          auctionId,
        },
      });
      isWatchlisted = true;
    }

    revalidatePath(pathname);
    return { success: true, isWatchlisted };
  } catch (error) {
    console.error("Watchlist error:", error);
    return { success: false, error: "Failed to toggle watchlist" };
  }
}
