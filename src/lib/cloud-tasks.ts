import { CloudTasksClient } from '@google-cloud/tasks';
import { log } from './logger';

const client = new CloudTasksClient();

// The base URL should be the hosted app URL in production, or localhost/ngrok in dev
const BASE_URL = process.env.AUTH_URL || 'https://www.nilamit.com';
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'nilamit-52073';
const QUEUE_LOCATION = 'asia-southeast1';
const QUEUE_NAME = 'auction-closures';

export async function scheduleAuctionClosure(auctionId: string, endTime: Date): Promise<string | undefined> {
  if (!process.env.CRON_SECRET) {
    log.warn('[CloudTasks] CRON_SECRET is not set, skipping task schedule', { auctionId });
    return undefined;
  }

  const parent = client.queuePath(PROJECT_ID, QUEUE_LOCATION, QUEUE_NAME);

  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${BASE_URL}/api/tasks/close-auction`,
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET,
      },
      body: Buffer.from(JSON.stringify({ auctionId })).toString('base64'),
    },
    scheduleTime: {
      seconds: Math.floor(endTime.getTime() / 1000),
    },
  };

  try {
    log.info(`[CloudTasks] Scheduling closure for ${auctionId} at ${endTime.toISOString()}`);
    const [response] = await client.createTask({ parent, task });
    log.info(`[CloudTasks] Task created: ${response.name}`);
    return response.name ?? undefined;
  } catch (error) {
    log.error('[CloudTasks] Failed to schedule task', error instanceof Error ? error : new Error(String(error)), { auctionId });
    return undefined;
  }
}

export async function scheduleClosingSoonAlert(auctionId: string, endTime: Date): Promise<void> {
  if (!process.env.CRON_SECRET) return;
  const parent = client.queuePath(PROJECT_ID, QUEUE_LOCATION, QUEUE_NAME);
  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${BASE_URL}/api/tasks/closing-soon`,
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET },
      body: Buffer.from(JSON.stringify({ auctionId })).toString('base64'),
    },
    scheduleTime: { seconds: Math.floor(endTime.getTime() / 1000) - 3600 },
  };

  try {
    await client.createTask({ parent, task });
  } catch (error) {
    log.error('[CloudTasks] Failed to schedule closing-soon task', error instanceof Error ? error : new Error(String(error)), { auctionId });
  }
}

export async function scheduleEnforcePaymentPolicy(auctionId: string): Promise<void> {
  if (!process.env.CRON_SECRET) return;
  const parent = client.queuePath(PROJECT_ID, QUEUE_LOCATION, QUEUE_NAME);
  // Schedule for 24 hours from now
  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${BASE_URL}/api/tasks/enforce-policies`,
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET },
      body: Buffer.from(JSON.stringify({ auctionId })).toString('base64'),
    },
    scheduleTime: { seconds: Math.floor(Date.now() / 1000) + (24 * 3600) },
  };

  try {
    await client.createTask({ parent, task });
  } catch (error) {
    log.error('[CloudTasks] Failed to schedule enforce-policies task', error instanceof Error ? error : new Error(String(error)), { auctionId });
  }
}
