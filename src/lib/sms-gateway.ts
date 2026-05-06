/**
 * SMS Gateway Interface — Pluggable for BD local gateways
 * Supports: GreenWeb, BulksmsBD, or console (dev mode)
 */

import { log } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

export interface SMSGateway {
  sendSMS(phone: string, message: string): Promise<{ success: boolean; messageId?: string }>;
}

// ---- Console Gateway (Development) ----
class ConsoleGateway implements SMSGateway {
  async sendSMS(phone: string, message: string) {
    console.log(`\n📱 [SMS → ${phone}] ${message}\n----------------------------------------\n`);
    return { success: true, messageId: `dev-${Date.now()}` };
  }
}

// ---- GreenWeb SMS Gateway (Production) ----
class GreenWebGateway implements SMSGateway {
  private token: string;
  private apiUrl = 'http://api.greenweb.com.bd/api.php';

  constructor(token: string) {
    this.token = token;
  }

  async sendSMS(phone: string, message: string) {
    try {
      const params = new URLSearchParams({
        token: this.token,
        to: phone.replace('+88', ''),
        message,
      });
      const res = await fetch(`${this.apiUrl}?${params}`);
      const text = await res.text();
      const success = text.includes('Ok');
      if (!success) {
        // Surface upstream gateway errors — without this, SMS delivery failures
        // are invisible to the user (they'll wait for an OTP that never arrives).
        log.error('[SMS:greenweb] gateway returned non-Ok response', { phone: maskPhone(phone), response: text.slice(0, 200) });
        Sentry.captureMessage('[SMS:greenweb] gateway returned non-Ok response', {
          level: 'error',
          tags: { component: 'sms', provider: 'greenweb' },
          extra: { phoneMasked: maskPhone(phone), response: text.slice(0, 200) },
        });
      }
      return { success, messageId: text };
    } catch (err) {
      log.error('[SMS:greenweb] fetch failed', err);
      Sentry.captureException(err, { tags: { component: 'sms', provider: 'greenweb' } });
      return { success: false };
    }
  }
}

function maskPhone(phone: string): string {
  if (phone.length < 7) return '***';
  return phone.slice(0, 4) + '****' + phone.slice(-2);
}

// ---- BulksmsBD Gateway (Production) ----
class BulksmsBDGateway implements SMSGateway {
  private apiKey: string;
  private senderId: string;
  private apiUrl = 'https://bulksmsbd.net/api/smsapi';

  constructor(apiKey: string, senderId: string) {
    this.apiKey = apiKey;
    this.senderId = senderId;
  }

  async sendSMS(phone: string, message: string) {
    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          senderid: this.senderId,
          number: phone.replace('+88', ''),
          message,
        }),
      });
      const data = await res.json();
      return { success: data.response_code === 202, messageId: data.request_id };
    } catch {
      return { success: false };
    }
  }
}

// ---- Factory ----
export function createSMSGateway(): SMSGateway {
  const provider = process.env.SMS_PROVIDER || 'console';
  const isProd = process.env.NODE_ENV === 'production';

  switch (provider) {
    case 'greenweb': {
      const token = process.env.GREENWEB_TOKEN;
      if (!token) {
        if (isProd) throw new Error('[SMS] GREENWEB_TOKEN is required when SMS_PROVIDER=greenweb');
        log.warn('[SMS] GREENWEB_TOKEN missing — falling back to console gateway in non-production');
        return new ConsoleGateway();
      }
      return new GreenWebGateway(token);
    }
    case 'bulksmsbd': {
      const apiKey = process.env.BULKSMS_API_KEY;
      const senderId = process.env.BULKSMS_SENDER_ID;
      if (!apiKey || !senderId) {
        if (isProd) throw new Error('[SMS] BULKSMS_API_KEY and BULKSMS_SENDER_ID are required when SMS_PROVIDER=bulksmsbd');
        log.warn('[SMS] BulksmsBD credentials missing — falling back to console gateway in non-production');
        return new ConsoleGateway();
      }
      return new BulksmsBDGateway(apiKey, senderId);
    }
    default:
      // Refuse to log OTPs to stdout in production — that would leak secrets
      // to the host logs and silently bypass real SMS delivery.
      if (isProd) {
        throw new Error('[SMS] SMS_PROVIDER must be set to a real gateway (e.g. "greenweb" or "bulksmsbd") in production');
      }
      return new ConsoleGateway();
  }
}

// Lazy singleton — building eagerly at module import would crash boot in
// production whenever SMS env vars aren't set yet (e.g. App Hosting deploys
// before the GREENWEB_TOKEN secret is provisioned). The hard-fail-in-prod
// check inside createSMSGateway() still runs on first sendSMS() call.
let _gateway: SMSGateway | null = null;
export function getSMSGateway(): SMSGateway {
  if (!_gateway) _gateway = createSMSGateway();
  return _gateway;
}
