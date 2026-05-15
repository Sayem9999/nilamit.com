import { log } from './logger';
import { getAccessToken } from './gcp-auth';

// The base URL should be the hosted app URL in production, or localhost/ngrok in dev
const BASE_URL = process.env.AUTH_URL || 'https://www.nilamit.com';
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'nilamit-52073';
const QUEUE_LOCATION = 'asia-southeast1';
const QUEUE_NAME = 'auction-closures';

async function createCloudTask(
  apiPath: string,
  payload: Record<string, unknown>,
  scheduleTime: Date,
  auctionId: string
): Promise<string | undefined> {
  if (!process.env.CRON_SECRET) {
    log.warn('[CloudTasks] CRON_SECRET is not set, skipping task schedule', { auctionId });
    return undefined;
  }

  try {
    const token = await getAccessToken();
    const url = `https://cloudtasks.googleapis.com/v2/projects/${PROJECT_ID}/locations/${QUEUE_LOCATION}/queues/${QUEUE_NAME}/tasks`;

    const body = {
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: `${BASE_URL}/api/tasks/${apiPath}`,
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': process.env.CRON_SECRET,
          },
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        },
        scheduleTime: scheduleTime.toISOString(),
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloud Tasks API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    log.info(`[CloudTasks] Task created: ${data.name}`);
    return data.name;
  } catch (error) {
    log.error(`[CloudTasks] Failed to schedule ${apiPath} task`, error instanceof Error ? error : new Error(String(error)), { auctionId });
    return undefined;
  }
}

export async function scheduleAuctionClosure(auctionId: string, endTime: Date): Promise<string | undefined> {
  return createCloudTask('close-auction', { auctionId }, endTime, auctionId);
}

export async function scheduleClosingSoonAlert(auctionId: string, endTime: Date): Promise<void> {
  // Schedule 1 hour before end time
  const alertTime = new Date(endTime.getTime() - 3600000);
  if (alertTime > new Date()) {
    await createCloudTask('closing-soon', { auctionId }, alertTime, auctionId);
  }
}

export async function scheduleEnforcePaymentPolicy(auctionId: string): Promise<void> {
  // Schedule for 24 hours from now
  const policyTime = new Date(Date.now() + 24 * 3600000);
  await createCloudTask('enforce-policies', { auctionId }, policyTime, auctionId);
}
