"use server";

import { signOut, signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { 
  registerSchema, 
  phoneSignupSchema, 
  passwordResetSchema, 
  formatZodError 
} from "@/lib/schemas";
import { ErrorType, errorResponse, successResponse } from "@/lib/errors";
import { verifyStandaloneOTP } from "./phone";
import { log } from "@/lib/logger";

export async function logoutAction() {
  await signOut({ redirect: false });
  revalidatePath("/");
  return { success: true };
}

export async function registerUser(data: unknown) {
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
      email,
      password: hashedPassword,
      isRetailer,
      isPhoneVerified: false,
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

    // ─── Automatic Email Verification ───
    try {
      const { sendEmailVerificationByEmail } = await import("./email-server");
      await sendEmailVerificationByEmail(email);
      log.info(`[Auth] Verification email sent to ${email}`);
    } catch (verifErr) {
      log.error("[Auth] Background email verification trigger failed", verifErr);
      // We don't fail the registration if the email fails, but we log it.
    }

    return successResponse({ 
      message: email.endsWith("@gmail.com") 
        ? "Registration successful. Please check your Gmail for a verification link." 
        : "Registration successful. Please check your email for a verification link." 
    });
  } catch (e) {
    log.error("[Auth] registerUser failed", e);
    return errorResponse(ErrorType.INTERNAL, "Failed to register user.");
  }
}

export async function signupWithPhone(data: unknown) {
  const parsed = phoneSignupSchema.safeParse(data);
  if (!parsed.success) {
    return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
  }

  const { name, phone, otp, password, email, isRetailer } = parsed.data;

  try {
    // 1. Verify OTP
    const otpResult = await verifyStandaloneOTP(phone, otp);
    if (!otpResult.success) {
      return otpResult;
    }

    // 2. Check if phone already taken
    const existingPhone = await db.collection("users").where("phone", "==", phone).limit(1).get();
    if (!existingPhone.empty) {
      return errorResponse(ErrorType.CONFLICT, "This phone number is already registered.");
    }

    // 3. If email provided, check if email taken
    if (email) {
      const existingEmail = await db.collection("users").where("email", "==", email).limit(1).get();
      if (!existingEmail.empty) {
        return errorResponse(ErrorType.CONFLICT, "This email is already registered.");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userRef = db.collection("users").doc();
    const now = new Date();

    await userRef.set({
      id: userRef.id,
      name,
      phone,
      email: email || null,
      password: hashedPassword,
      isRetailer,
      isPhoneVerified: true,
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

    return successResponse({ message: "Registration successful. You can now log in." });
  } catch (e) {
    log.error("[Auth] signupWithPhone failed", e);
    return errorResponse(ErrorType.INTERNAL, "Failed to register user.");
  }
}

export async function resetPasswordWithOTP(data: unknown) {
  const parsed = passwordResetSchema.safeParse(data);
  if (!parsed.success) {
    return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
  }

  const { phone, email, otp, password } = parsed.data;

  try {
    let userSnap;
    if (phone) {
      // Verify Phone OTP
      const otpResult = await verifyStandaloneOTP(phone, otp);
      if (!otpResult.success) return otpResult;
      
      userSnap = await db.collection("users").where("phone", "==", phone).limit(1).get();
    } else if (email) {
      // Verify Email OTP (using the same mechanism as phone for now if applicable, 
      // but verifyEmailToken handles token links. For OTP, we might need a separate check)
      // The forgot-password UI uses sendEmailOTP from phone.ts which stores in verificationTokens
      
      const normalizedEmail = email.trim().toLowerCase();
      const crypto = await import("crypto");
      const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
      const tokenId = `${normalizedEmail}__${hashedOTP}`;
      
      const tokenDoc = await db.collection("verificationTokens").doc(tokenId).get();
      if (!tokenDoc.exists || (tokenDoc.data()?.expires.toDate() < new Date())) {
        return errorResponse(ErrorType.VALIDATION, "Invalid or expired OTP.");
      }
      
      await tokenDoc.ref.delete();
      userSnap = await db.collection("users").where("email", "==", normalizedEmail).limit(1).get();
    }

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
    log.error("[Auth] resetPasswordWithOTP failed", e);
    return errorResponse(ErrorType.INTERNAL, "Failed to reset password.");
  }
}
