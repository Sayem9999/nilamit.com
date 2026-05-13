/**
 * Centralised Zod schemas for inputs that cross trust boundaries.
 *
 * Every Server Action that accepts caller-supplied data must `safeParse`
 * through one of these. Defining them in one place ensures consistent bounds
 * (string lengths, price ceilings, etc.) and makes it impossible for one
 * action to accept input the rest of the system would reject.
 */

import { z } from 'zod';
import { CATEGORIES } from '@/types';
import { normalizePhone } from './utils';

// ─── Primitives ────────────────────────────────────────────────────────────

/** RFC-5321 max length for an email is 254 octets. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Email is too short')
  .max(254, 'Email is too long')
  .email('Invalid email address');

/**
 * Password rule: 8–128 chars. We deliberately don't enforce character classes —
 * length is a stronger signal for password strength and class rules push users
 * toward predictable patterns. We DO cap length so bcrypt's 72-byte truncation
 * isn't surprising and so an attacker can't OOM the worker by submitting a 1MB
 * password.
 */
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long');

/** Bangladesh mobile: accepts local (01...) or international (+8801...) form. */
export const bdPhoneSchema = z.preprocess(
  (val) => typeof val === 'string' ? normalizePhone(val) : val,
  z.string().trim().regex(/^\+8801\d{9}$/, 'Invalid Bangladesh phone number')
);

/** 6-digit numeric OTP. */
export const otpSchema = z.string().regex(/^\d{6}$/, 'OTP must be 6 digits');

/** Person name: 2–80 chars, no leading/trailing whitespace, no control chars. */
const nameSchema = z
  .string()
  .trim()
  .min(2, 'Too short')
  .max(80, 'Too long')
   
  .refine((v) => !/[\x00-\x1f\x7f]/.test(v), 'Invalid characters');

// ─── Auth ──────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name:       nameSchema,
  email:      emailSchema,
  password:   passwordSchema,
  isRetailer: z.boolean().default(false),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const phoneSignupSchema = z.object({
  name:          nameSchema,
  phone:         bdPhoneSchema,
  firebaseToken: z.string().min(1, 'Firebase token is required'),
  password:      passwordSchema,
  email:         emailSchema.optional(),
  isRetailer:    z.boolean().default(false),
});
export type PhoneSignupInput = z.infer<typeof phoneSignupSchema>;

export const passwordResetSchema = z
  .object({
    phone:         bdPhoneSchema.optional(),
    email:         emailSchema.optional(),
    otp:           otpSchema.optional(),
    firebaseToken: z.string().optional(),
    password:      passwordSchema,
  })
  .refine((d) => d.phone || d.email, {
    message: 'Either phone or email is required',
    path:    ['phone'],
  });
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

// ─── Auctions ──────────────────────────────────────────────────────────────

/** Hard ceiling on auction prices. ৳10M is well above any realistic listing
 *  on the platform; treating it as the universal cap blocks user-typo / abuse
 *  inputs (e.g. ৳999999999) before they reach Firestore. */
export const MAX_AUCTION_PRICE_BDT = 10_000_000;
const MIN_AUCTION_PRICE_BDT        = 1;

const priceSchema = z.coerce
  .number()
  .int('Price must be a whole number of taka')
  .min(MIN_AUCTION_PRICE_BDT, 'Price must be positive')
  .max(MAX_AUCTION_PRICE_BDT, `Price exceeds the ৳${MAX_AUCTION_PRICE_BDT.toLocaleString()} cap`);

const imageUrlSchema = z
  .string()
  .url('Invalid image URL')
  .max(2048, 'Image URL is too long');

/**
 * ISO-8601 datetime string. We accept the string form (cheap to send from the
 * client) and validate parseability at the boundary.
 */
const isoDatetime = z.coerce.date();

const VALID_CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

export const createAuctionSchema = z
  .object({
    title:           z.string().trim().min(3, 'Title is too short').max(120, 'Title is too long'),
    description:     z.string().trim().min(10, 'Description is too short').max(5000, 'Description is too long'),
    images:          z.array(imageUrlSchema).min(1, 'At least one image is required').max(10, 'Maximum 10 images per listing'),
    category:        z.string().trim().refine((v) => (VALID_CATEGORY_SLUGS as string[]).includes(v), 'Invalid category'),
    startingPrice:   priceSchema,
    minBidIncrement: priceSchema.optional(),
    startTime:       isoDatetime,
    endTime:         isoDatetime,
    reservePrice:    priceSchema.optional(),
    buyItNowPrice:   priceSchema.optional(),
    location:        z.string().trim().max(120).optional(),
    condition:       z.enum(['NEW', 'USED', 'REFURBISHED']).optional(),
  })
  .superRefine((d, ctx) => {
    const start = new Date(d.startTime);
    const end   = new Date(d.endTime);
    const now   = Date.now();

    if (end.getTime() <= start.getTime()) {
      ctx.addIssue({ code: 'custom', message: 'End time must be after start time', path: ['endTime'] });
    }
    // Disallow listings that end in the past (modulo 60s clock skew).
    if (end.getTime() < now - 60_000) {
      ctx.addIssue({ code: 'custom', message: 'End time must be in the future', path: ['endTime'] });
    }
    if (d.reservePrice !== undefined && d.reservePrice < d.startingPrice) {
      ctx.addIssue({ code: 'custom', message: 'Reserve price must be at least the starting price', path: ['reservePrice'] });
    }
    if (d.buyItNowPrice !== undefined && d.buyItNowPrice <= d.startingPrice) {
      ctx.addIssue({ code: 'custom', message: 'Buy-it-now price must exceed the starting price', path: ['buyItNowPrice'] });
    }
  });
export type CreateAuctionInputValidated = z.infer<typeof createAuctionSchema>;

/**
 * Edit-while-no-bids schema.
 * Only description and images are editable post-publish, and only while
 * bidCount === 0. Title/pricing/timing are locked once published — bidders
 * shouldn't have the listing change underneath them.
 */
export const editAuctionSchema = z.object({
  auctionId:   z.string().trim().min(1).max(128),
  description: z.string().trim().min(10, 'Description is too short').max(5000, 'Description is too long').optional(),
  images:      z.array(imageUrlSchema).min(1, 'At least one image is required').max(10, 'Maximum 10 images per listing').optional(),
}).refine(
  (d) => d.description !== undefined || d.images !== undefined,
  { message: 'Provide at least one field to update.' },
);
export type EditAuctionInputValidated = z.infer<typeof editAuctionSchema>;

// ─── Bids ──────────────────────────────────────────────────────────────────

export const placeBidSchema = z.object({
  auctionId: z.string().trim().min(1).max(128),
  amount:    priceSchema,
});
export type PlaceBidInput = z.infer<typeof placeBidSchema>;

/** Firestore document ID — only printable non-slash chars, max 1500 bytes. */
const firestoreIdSchema = z.string().trim().min(1).max(128).regex(/^[^/]+$/, 'Invalid ID');

export const sendMessageSchema = z.object({
  conversationId: firestoreIdSchema,
  content:        z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
  imageUrl:       z.string().url('Invalid image URL').max(2048).optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const raiseDisputeSchema = z.object({
  transactionId: firestoreIdSchema,
  reason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(1000, 'Reason too long'),
});
export type RaiseDisputeInput = z.infer<typeof raiseDisputeSchema>;

export const reportAuctionSchema = z.object({
  auctionId:   firestoreIdSchema,
  reason:      z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
});
export type ReportAuctionInput = z.infer<typeof reportAuctionSchema>;

// ─── Seller follow ─────────────────────────────────────────────────────────

export const followSellerSchema = z.object({
  sellerId: firestoreIdSchema,
});
export type FollowSellerInput = z.infer<typeof followSellerSchema>;

// ─── Auction Q&A ───────────────────────────────────────────────────────────

export const askQuestionSchema = z.object({
  auctionId: firestoreIdSchema,
  question:  z.string().trim().min(5, 'Question must be at least 5 characters').max(500, 'Question is too long'),
});
export type AskQuestionInput = z.infer<typeof askQuestionSchema>;

export const answerQuestionSchema = z.object({
  questionId: firestoreIdSchema,
  answer:     z.string().trim().min(1, 'Answer is required').max(2000, 'Answer is too long'),
});
export type AnswerQuestionInput = z.infer<typeof answerQuestionSchema>;

export const updateProfileSchema = z.object({
  name:  z.string().trim().min(2, 'Name too short').max(80, 'Name too long').optional(),
  image: z.string().url('Invalid image URL').max(2048).optional(),
}).refine(d => d.name !== undefined || d.image !== undefined, {
  message: 'Provide at least one field to update',
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Alerts ────────────────────────────────────────────────────────────────

export const createAlertSchema = z.object({
  type:           z.enum(['OUTBID', 'TARGET_REACHED', 'PRICE_DROP']),
  auctionId:      firestoreIdSchema.optional(),
  thresholdPrice: z.number().int('Must be a whole number').positive().max(MAX_AUCTION_PRICE_BDT).optional(),
});
export type CreateAlertInput = z.infer<typeof createAlertSchema>;

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Flatten a ZodError into a single human-readable line for action responses. */
export function formatZodError(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return 'Invalid input';
  return first.path.length > 0 ? `${first.path.join('.')}: ${first.message}` : first.message;
}
