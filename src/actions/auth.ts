"use server";

import { signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { 
  registerSchema, 
  passwordResetSchema, 
  formatZodError 
} from "@/lib/schemas";
import { ErrorType, errorResponse, successResponse, ServiceResponse } from "@/lib/errors";
import { log } from "@/lib/logger";

import { headers } from "next/headers";
import { authLimiter } from "@/lib/ratelimit";

export async function logoutAction(): Promise<ServiceResponse<null>> {
  await signOut({ redirect: false });
  revalidatePath("/");
  return successResponse(null);
}

export async function registerUser(data: unknown): Promise<ServiceResponse<{ message: string }>> {
  const h = await headers();
  const ip = h.get('fastly-client-ip') ?? h.get('x-apphosting-client-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  const { success: rateLimitOk } = await authLimiter.limit(`auth_${ip}`);
  if (!rateLimitOk) return errorResponse(ErrorType.RATE_LIMIT, "Too many attempts. Please wait before trying again.");

  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
  }

  const { name, email, password, isRetailer } = parsed.data;

  try {
    // Check if user already exists
    const existing = await db.collection("users").where("email", "==", email).limit(1).get();
    if (!existing.empty) {
      return errorResponse(ErrorType.CONFLICT, "User with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userRef = db.collection("users").doc();
    const now = new Date();

    await userRef.set({
      id: userRef.id,
      name,
      nameLowercase: name.toLowerCase(),
      email,
      password: hashedPassword,
      isRetailer,
      isVerifiedSeller: false,
      reputationScore: 0,
      rating: 0,
      ratingCount: 0,
      xp: 0,
      userLevel: 1,
      winningStreak: 0,
      createdAt: now,
      updatedAt: now,
    });

    return successResponse({
      message: "Registration successful! Please log in — a verification email will be sent to your inbox automatically.",
    });

  } catch (e) {
    log.error("[Auth] registerUser failed", e, { area: 'auth', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, "Failed to register user.");
  }
}



export async function resetPasswordWithOTP(data: unknown): Promise<ServiceResponse<{ message: string }>> {
  const h = await headers();
  const ip = h.get('fastly-client-ip') ?? h.get('x-apphosting-client-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  const { success: rateLimitOk } = await authLimiter.limit(`auth_${ip}`);
  if (!rateLimitOk) return errorResponse(ErrorType.RATE_LIMIT, "Too many attempts. Please wait before trying again.");

  const parsed = passwordResetSchema.safeParse(data);
  if (!parsed.success) {
    return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
  }

  const { email, otp, password } = parsed.data;

  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Verify Email OTP
    const crypto = await import("crypto");
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
    const tokenId = `${normalizedEmail}__${hashedOTP}`;
    
    const tokenDoc = await db.collection("verificationTokens").doc(tokenId).get();
    if (!tokenDoc.exists || (tokenDoc.data()?.expires.toDate() < new Date())) {
      return errorResponse(ErrorType.VALIDATION, "Invalid or expired OTP.");
    }
    
    await tokenDoc.ref.delete();
    const userSnap = await db.collection("users").where("email", "==", normalizedEmail).limit(1).get();

    if (!userSnap || userSnap.empty) {
      return errorResponse(ErrorType.NOT_FOUND, "User not found.");
    }

    const userDoc = userSnap.docs[0];
    const hashedPassword = await bcrypt.hash(password, 12);
    
    await userDoc.ref.update({
      password: hashedPassword,
      updatedAt: new Date(),
    });

    return successResponse({ message: "Password reset successful." });
  } catch (e) {
    log.error("[Auth] resetPasswordWithOTP failed", e, { area: 'auth', severity: 'warning' });
    return errorResponse(ErrorType.INTERNAL, "Failed to reset password.");
  }
}
