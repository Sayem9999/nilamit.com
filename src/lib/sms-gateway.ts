/**
 * SMS Gateway Interface — Pluggable for BD local gateways
 * Supports: GreenWeb, BulksmsBD, or console (dev mode)
 */

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
      return { success: text.includes('Ok'), messageId: text };
    } catch {
      return { success: false };
    }
  }
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

  switch (provider) {
    case 'greenweb':
      return new GreenWebGateway(process.env.GREENWEB_TOKEN!);
    case 'bulksmsbd':
      return new BulksmsBDGateway(process.env.BULKSMS_API_KEY!, process.env.BULKSMS_SENDER_ID!);
    default:
      return new ConsoleGateway();
  }
}

export const smsGateway = createSMSGateway();
