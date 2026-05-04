"use server";

import { signOut } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function logoutAction() {
  await signOut({ redirect: false });
  revalidatePath("/");
  return { success: true };
}
