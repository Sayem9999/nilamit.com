'use server';

import { auth } from '@/lib/auth';
import { db, newId } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { askQuestionSchema, answerQuestionSchema, formatZodError } from '@/lib/schemas';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import { ERROR_CODES } from '@/lib/constants';
import { filterPII } from '@/lib/pii-filter';
import { qaLimiter } from '@/lib/ratelimit';
import { pushUserNotification } from '@/lib/firebase-admin';
import { FIREBASE_EVENTS } from '@/lib/firebase-events';

export interface PublicQuestion {
  id:          string;
  auctionId:   string;
  askerId:     string;
  askerName:   string | null;
  question:    string;
  answer:      string | null;
  answeredAt:  Date | null;
  createdAt:   Date;
}

/**
 * Anyone authenticated and not banned can ask a public question on an active
 * auction. Question is PII-filtered, length-bounded, and rate-limited.
 */
export async function askQuestion(input: unknown): Promise<ServiceResponse<{ questionId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);

  const parsed = askQuestionSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const { auctionId, question } = parsed.data;
  const userId = session.user.id;

  const { success: rateOk } = await qaLimiter.limit(`qa_${userId}`);
  if (!rateOk) return errorResponse(ErrorType.RATE_LIMIT, 'Too many questions. Slow down a bit.');

  try {
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.data();
    if (!userData) return errorResponse(ErrorType.NOT_FOUND, 'User not found');
    if (userData.isBanned) return errorResponse(ErrorType.FORBIDDEN, 'Your account has been banned for policy violations.', 'BANNED');

    const auctionRef = db.collection('auctions').doc(auctionId);
    const auctionSnap = await auctionRef.get();
    if (!auctionSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');
    const auction = auctionSnap.data()!;

    if (auction.status !== 'ACTIVE') {
      return errorResponse(ErrorType.CONFLICT, 'Questions can only be posted on active auctions.');
    }
    if (auction.sellerId === userId) {
      return errorResponse(ErrorType.VALIDATION, 'You cannot ask questions on your own listing.');
    }

    const cleaned = filterPII(question);
    const id = newId();
    const now = new Date();

    await db.collection('auctionQuestions').doc(id).set({
      id,
      auctionId,
      sellerId:   auction.sellerId,
      askerId:    userId,
      askerName:  userData.name ?? null,
      question:   cleaned,
      answer:     null,
      answeredAt: null,
      createdAt:  now,
      updatedAt:  now,
    });

    // Notify the seller — fire-and-forget, never blocks the response.
    pushUserNotification(auction.sellerId, {
      event:        FIREBASE_EVENTS.NEW_QUESTION,
      auctionId,
      auctionTitle: auction.title,
      questionId:   id,
      timestamp:    Date.now(),
    }).catch((e) => log.error('[Action] askQuestion seller notify failed', e, { auctionId }));

    revalidatePath(`/auctions/${auctionId}`);
    return successResponse({ questionId: id });
  } catch (error) {
    log.error('[Action] askQuestion failed', error, { userId, auctionId });
    return errorResponse(ErrorType.INTERNAL, 'Failed to post question.');
  }
}

/**
 * Only the seller of the auction can answer. Answer is PII-filtered.
 * Re-answering an already-answered question replaces the previous answer.
 */
export async function answerQuestion(input: unknown): Promise<ServiceResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return errorResponse(ErrorType.UNAUTHORIZED, 'Not authenticated', ERROR_CODES.NOT_AUTHENTICATED);

  const parsed = answerQuestionSchema.safeParse(input);
  if (!parsed.success) return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));

  const { questionId, answer } = parsed.data;
  const userId = session.user.id;
  let askerId: string | undefined;
  let auctionId: string | undefined;
  let auctionTitle: string | undefined;

  try {
    await db.runTransaction(async (tx) => {
      const ref = db.collection('auctionQuestions').doc(questionId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const q = snap.data()!;

      if (q.sellerId !== userId) throw new Error('UNAUTHORIZED');

      const cleaned = filterPII(answer);
      const now = new Date();

      tx.update(ref, {
        answer:     cleaned,
        answeredAt: now,
        updatedAt:  now,
      });

      askerId      = q.askerId as string;
      auctionId    = q.auctionId as string;
      auctionTitle = q.auctionTitle as string | undefined;
    });

    if (askerId && auctionId) {
      pushUserNotification(askerId, {
        event:        FIREBASE_EVENTS.QUESTION_ANSWERED,
        auctionId,
        auctionTitle: auctionTitle ?? null,
        questionId,
        timestamp:    Date.now(),
      }).catch((e) => log.error('[Action] answerQuestion asker notify failed', e, { questionId }));
    }

    if (auctionId) revalidatePath(`/auctions/${auctionId}`);
    return successResponse(null);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTERNAL';
    if (code === 'NOT_FOUND')    return errorResponse(ErrorType.NOT_FOUND,  'Question not found');
    if (code === 'UNAUTHORIZED') return errorResponse(ErrorType.FORBIDDEN,  'Only the seller can answer questions on their listing.');

    log.error('[Action] answerQuestion failed', error, { userId, questionId });
    return errorResponse(ErrorType.INTERNAL, 'Failed to post answer.');
  }
}

/** Public read of all questions for an auction, newest first. */
export async function getAuctionQuestions(auctionId: string): Promise<ServiceResponse<PublicQuestion[]>> {
  if (!auctionId || typeof auctionId !== 'string') {
    return errorResponse(ErrorType.VALIDATION, 'Invalid auction id');
  }

  try {
    const snap = await db.collection('auctionQuestions')
      .where('auctionId', '==', auctionId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const questions: PublicQuestion[] = snap.docs.map((d) => {
      const q = d.data();
      const created = q.createdAt?.toDate ? q.createdAt.toDate() : new Date(q.createdAt);
      const answered = q.answeredAt?.toDate ? q.answeredAt.toDate() : (q.answeredAt ? new Date(q.answeredAt) : null);
      return {
        id:          d.id,
        auctionId:   q.auctionId,
        askerId:     q.askerId,
        askerName:   q.askerName ?? null,
        question:    q.question ?? '',
        answer:      q.answer ?? null,
        answeredAt:  answered,
        createdAt:   created,
      };
    });

    return successResponse(questions);
  } catch (error) {
    log.error('[Action] getAuctionQuestions failed', error, { auctionId });
    return errorResponse(ErrorType.INTERNAL, 'Failed to load questions.');
  }
}
