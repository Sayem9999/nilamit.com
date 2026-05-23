import { db } from '@/lib/db';
import { Timestamp, DocumentReference } from 'firebase-admin/firestore';
import { log } from '@/lib/logger';
import { auth } from '@/lib/auth';

/**
 * Computes the difference between before and after states.
 */
export function getDiff(
  before: FirebaseFirestore.DocumentData | null,
  after: FirebaseFirestore.DocumentData | null
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};

  if (!before) {
    if (after) {
      for (const [k, v] of Object.entries(after)) {
        diff[k] = { before: null, after: v };
      }
    }
    return diff;
  }

  if (!after) {
    for (const [k, v] of Object.entries(before)) {
      diff[k] = { before: v, after: null };
    }
    return diff;
  }

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    const valBefore = before[key];
    const valAfter = after[key];

    // Simple comparison using JSON.stringify for complex types (dates, nested objects)
    if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
      diff[key] = { before: valBefore ?? null, after: valAfter ?? null };
    }
  }

  return diff;
}

/**
 * Sanitizes and normalizes objects/values for audit log persistence.
 */
export function serializeForAudit(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  if (val instanceof Date) {
    return Timestamp.fromDate(val);
  }
  if (val instanceof Timestamp) {
    return val;
  }
  if (val instanceof DocumentReference) {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(serializeForAudit);
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    // Check if it looks like a Firestore Timestamp
    if (typeof obj.toDate === 'function' && typeof obj.seconds === 'number') {
      return new Timestamp(obj.seconds as number, (obj.nanoseconds as number) || 0);
    }
    // Check if it looks like a DocumentReference
    if (typeof obj.id === 'string' && typeof obj.path === 'string' && typeof obj.collection === 'function') {
      return db.doc(obj.path as string);
    }

    const proto = Object.getPrototypeOf(val);
    if (proto === null || proto === Object.prototype) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = serializeForAudit(v);
      }
      return result;
    }
  }
  return val;
}

export class AuditService {
  /**
   * Logs a change to an auction in its history_logs subcollection.
   */
  static async logAuctionChange(
    auctionId: string,
    before: FirebaseFirestore.DocumentData | null,
    after: FirebaseFirestore.DocumentData | null,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    operatorId?: string,
    tx?: FirebaseFirestore.Transaction | FirebaseFirestore.WriteBatch
  ): Promise<void> {
    try {
      let resolvedOperatorId = operatorId;
      if (!resolvedOperatorId) {
        try {
          const session = await auth();
          resolvedOperatorId = session?.user?.id || 'system';
        } catch {
          resolvedOperatorId = 'system';
        }
      }

      const rawDiff = getDiff(before, after);
      if (action === 'UPDATE' && Object.keys(rawDiff).length === 0) {
        // No changes, skip logging
        return;
      }

      const logRef = db.collection('auctions').doc(auctionId).collection('history_logs').doc();
      const logData = {
        id: logRef.id,
        operatorId: resolvedOperatorId,
        action,
        timestamp: Timestamp.now(),
        before: before ? serializeForAudit(before) : null,
        after: after ? serializeForAudit(after) : null,
        diff: serializeForAudit(rawDiff),
      };

      if (tx) {
        if ('commit' in tx) {
          (tx as FirebaseFirestore.WriteBatch).set(logRef, logData);
        } else {
          (tx as FirebaseFirestore.Transaction).set(logRef, logData);
        }
      } else {
        await logRef.set(logData);
      }

      log.info(`[AuditService] Logged auction change`, { auctionId, action, operatorId: resolvedOperatorId });
    } catch (e) {
      log.error(`[AuditService] Failed to log auction change`, e, { auctionId, action });
    }
  }

  /**
   * Logs a change to an escrow transaction in its history_logs subcollection.
   */
  static async logEscrowChange(
    escrowId: string,
    before: FirebaseFirestore.DocumentData | null,
    after: FirebaseFirestore.DocumentData | null,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    operatorId?: string,
    tx?: FirebaseFirestore.Transaction | FirebaseFirestore.WriteBatch
  ): Promise<void> {
    try {
      let resolvedOperatorId = operatorId;
      if (!resolvedOperatorId) {
        try {
          const session = await auth();
          resolvedOperatorId = session?.user?.id || 'system';
        } catch {
          resolvedOperatorId = 'system';
        }
      }

      const rawDiff = getDiff(before, after);
      if (action === 'UPDATE' && Object.keys(rawDiff).length === 0) {
        // No changes, skip logging
        return;
      }

      const logRef = db.collection('escrowTransactions').doc(escrowId).collection('history_logs').doc();
      const logData = {
        id: logRef.id,
        operatorId: resolvedOperatorId,
        action,
        timestamp: Timestamp.now(),
        before: before ? serializeForAudit(before) : null,
        after: after ? serializeForAudit(after) : null,
        diff: serializeForAudit(rawDiff),
      };

      if (tx) {
        if ('commit' in tx) {
          (tx as FirebaseFirestore.WriteBatch).set(logRef, logData);
        } else {
          (tx as FirebaseFirestore.Transaction).set(logRef, logData);
        }
      } else {
        await logRef.set(logData);
      }

      log.info(`[AuditService] Logged escrow change`, { escrowId, action, operatorId: resolvedOperatorId });
    } catch (e) {
      log.error(`[AuditService] Failed to log escrow change`, e, { escrowId, action });
    }
  }
}
