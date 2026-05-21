import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

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
