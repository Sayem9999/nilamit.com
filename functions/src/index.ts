import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import algoliasearch, { SearchIndex } from 'algoliasearch';

// Initialize Firebase Admin SDK inside the Cloud Functions environment
admin.initializeApp();

const BASE_URL = process.env.APP_URL || 'https://nilamit--nilamit-52073.asia-southeast1.hosted.app';

/**
 * Utility to trigger Next.js cron/task endpoints using a secure backend secret
 */
async function triggerEndpoint(path: string, cronSecret: string): Promise<void> {
  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  logger.info(`Triggering cron endpoint: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Endpoint returned status ${response.status}: ${responseText}`);
    }
    
    logger.info(`Successfully triggered ${path}. Response: ${responseText}`);
  } catch (error) {
    logger.error(`Failed to trigger endpoint ${path}`, error);
    throw error;
  }
}

// 1. close-auctions: every 5 minutes
export const closeAuctionsCron = onSchedule({
  schedule: '*/5 * * * *',
  secrets: ['CRON_SECRET'],
  timeZone: 'UTC',
  memory: '256MiB',
}, async () => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('CRON_SECRET secret is not available.');
    return;
  }
  await triggerEndpoint('/api/cron/close-auctions', cronSecret);
});

// 2. closing-soon: every 15 minutes
export const closingSoonCron = onSchedule({
  schedule: '*/15 * * * *',
  secrets: ['CRON_SECRET'],
  timeZone: 'UTC',
  memory: '256MiB',
}, async () => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('CRON_SECRET secret is not available.');
    return;
  }
  await triggerEndpoint('/api/tasks/closing-soon', cronSecret);
});

// 3. enforce-policies: hourly
export const enforcePoliciesCron = onSchedule({
  schedule: '0 * * * *',
  secrets: ['CRON_SECRET'],
  timeZone: 'UTC',
  memory: '256MiB',
}, async () => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('CRON_SECRET secret is not available.');
    return;
  }
  await triggerEndpoint('/api/tasks/enforce-policies', cronSecret);
});

// 4. gc-uploads: weekly on Sunday at 04:00 UTC
export const gcUploadsCron = onSchedule({
  schedule: '0 4 * * 0',
  secrets: ['CRON_SECRET'],
  timeZone: 'UTC',
  memory: '256MiB',
}, async () => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('CRON_SECRET secret is not available.');
    return;
  }
  await triggerEndpoint('/api/cron/gc-uploads', cronSecret);
});

// --- Algolia search index configuration keys ---
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID || '';
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY || '';

// Initialize Algolia client lazily so that it does not crash if keys are missing in local emulation
let algoliaIndex: SearchIndex | null = null;
function getAlgoliaIndex() {
  if (!algoliaIndex && ALGOLIA_APP_ID && ALGOLIA_API_KEY) {
    const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
    algoliaIndex = client.initIndex('nilamit_auctions');
  }
  return algoliaIndex;
}

/**
 * 5. syncAuctionToAlgolia: Realtime Firestore trigger for search sync
 */
export const syncAuctionToAlgolia = onDocumentWritten('auctions/{auctionId}', async (event) => {
  const auctionId = event.params.auctionId;
  const index = getAlgoliaIndex();
  
  if (!index) {
    logger.warn('Algolia is not configured. Skipping search index synchronization.', { auctionId });
    return;
  }

  // Handle document deletion
  if (!event.data?.after.exists) {
    await index.deleteObject(auctionId);
    logger.info('Deleted Algolia index object', { auctionId });
    return;
  }

  const auctionData = event.data.after.data()!;
  
  // Only index active, searchable listings
  if (auctionData.status !== 'ACTIVE') {
    await index.deleteObject(auctionId);
    logger.info('Removed inactive Algolia index object', { auctionId, status: auctionData.status });
    return;
  }

  const payload = {
    objectID:      auctionId,
    title:          auctionData.title,
    description:    auctionData.description,
    category:       auctionData.category,
    currentPrice:   auctionData.currentPrice,
    startingPrice:  auctionData.startingPrice,
    condition:      auctionData.condition,
    location:       auctionData.location,
    endTime:        auctionData.endTime?.toDate ? auctionData.endTime.toDate().getTime() : new Date(auctionData.endTime).getTime(),
    createdAt:      auctionData.createdAt?.toDate ? auctionData.createdAt.toDate().getTime() : new Date(auctionData.createdAt).getTime(),
  };

  await index.saveObject(payload);
  logger.info('Synchronized Algolia index object', { auctionId });
});
