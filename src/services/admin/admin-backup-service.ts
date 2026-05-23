import { db } from '@/lib/db';
import { Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import { log } from '@/lib/logger';

export interface BackupEntry {
  path: string;
  data: Record<string, unknown>;
}

/**
 * Custom serialization of Firestore-specific data types to plain JSON objects.
 */
export function serializeValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  if (val instanceof Timestamp) {
    return {
      __type__: 'timestamp',
      seconds: val.seconds,
      nanoseconds: val.nanoseconds,
    };
  }
  if (val instanceof GeoPoint) {
    return {
      __type__: 'geopoint',
      latitude: val.latitude,
      longitude: val.longitude,
    };
  }
  if (val instanceof DocumentReference) {
    return {
      __type__: 'reference',
      path: val.path,
    };
  }
  // Duck typing for cases where class instances differ across packages
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.toDate === 'function' && typeof obj.seconds === 'number') {
      return {
        __type__: 'timestamp',
        seconds: obj.seconds,
        nanoseconds: typeof obj.nanoseconds === 'number' ? obj.nanoseconds : 0,
      };
    }
    if (
      typeof obj.latitude === 'number' &&
      typeof obj.longitude === 'number' &&
      (obj.constructor?.name === 'GeoPoint' || typeof obj.isEqual === 'function')
    ) {
      return {
        __type__: 'geopoint',
        latitude: obj.latitude,
        longitude: obj.longitude,
      };
    }
    if (typeof obj.id === 'string' && typeof obj.path === 'string' && typeof obj.collection === 'function') {
      return {
        __type__: 'reference',
        path: obj.path,
      };
    }
  }
  if (val instanceof Date) {
    return {
      __type__: 'timestamp',
      seconds: Math.floor(val.getTime() / 1000),
      nanoseconds: (val.getTime() % 1000) * 1000000,
    };
  }
  if (Array.isArray(val)) {
    return val.map(serializeValue);
  }
  if (typeof val === 'object') {
    const proto = Object.getPrototypeOf(val);
    if (proto === null || proto === Object.prototype) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        result[k] = serializeValue(v);
      }
      return result;
    }
  }
  return val;
}

/**
 * Custom deserialization of plain JSON objects back into native Firestore types.
 */
export function deserializeValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(deserializeValue);
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj.__type__ === 'timestamp') {
      return new Timestamp(obj.seconds as number, obj.nanoseconds as number);
    }
    if (obj.__type__ === 'geopoint') {
      return new GeoPoint(obj.latitude as number, obj.longitude as number);
    }
    if (obj.__type__ === 'reference') {
      return db.doc(obj.path as string);
    }

    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = deserializeValue(v);
    }
    return result;
  }
  return val;
}

/**
 * Recursively fetches all documents and subcollections under a collection.
 */
async function backupCollection(
  colRef: FirebaseFirestore.CollectionReference,
  entries: BackupEntry[]
): Promise<void> {
  const snapshot = await colRef.get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const serializedData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      serializedData[k] = serializeValue(v);
    }

    entries.push({
      path: doc.ref.path,
      data: serializedData,
    });

    const subcols = await doc.ref.listCollections();
    for (const subcol of subcols) {
      await backupCollection(subcol, entries);
    }
  }
}

/**
 * Recursively deletes a collection and its document subcollections.
 */
async function deleteCollectionRecursively(
  colRef: FirebaseFirestore.CollectionReference
): Promise<void> {
  const snapshot = await colRef.get();

  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const subcols = await doc.ref.listCollections();
    for (const subcol of subcols) {
      await deleteCollectionRecursively(subcol);
    }

    batch.delete(doc.ref);
    count++;

    if (count % 500 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }
}

/**
 * AdminBackupService — Handles business logic for database exports and imports.
 */
export class AdminBackupService {
  /**
   * Generates a complete backup of all collections and subcollections in Firestore.
   */
  static async exportDatabase(): Promise<BackupEntry[]> {
    try {
      const entries: BackupEntry[] = [];
      const rootCollections = await db.listCollections();

      for (const col of rootCollections) {
        await backupCollection(col, entries);
      }

      log.info(`[AdminBackupService] Successfully exported database with ${entries.length} document entries.`);
      return entries;
    } catch (e) {
      log.error('[AdminBackupService] Database export failed', e);
      throw e;
    }
  }

  /**
   * Restores a database backup, optionally wiping existing data first.
   */
  static async restoreDatabase(entries: BackupEntry[], wipeFirst: boolean): Promise<{ successCount: number }> {
    try {
      if (wipeFirst) {
        const rootCollections = await db.listCollections();
        for (const col of rootCollections) {
          await deleteCollectionRecursively(col);
        }
        log.info('[AdminBackupService] Successfully wiped existing database collections before restoring.');
      }

      let batch = db.batch();
      let count = 0;

      for (const entry of entries) {
        const docRef = db.doc(entry.path);
        const deserializedData = deserializeValue(entry.data) as Record<string, unknown>;

        batch.set(docRef, deserializedData);
        count++;

        if (count % 500 === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }

      if (count % 500 !== 0) {
        await batch.commit();
      }

      log.info(`[AdminBackupService] Successfully restored database with ${count} documents.`);
      return { successCount: count };
    } catch (e) {
      log.error('[AdminBackupService] Database restore failed', e);
      throw e;
    }
  }
}
