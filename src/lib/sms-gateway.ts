import { log } from '@/lib/logger';
import { captureWithArea } from '@/lib/sentry-tags';

export interface SMSSendResult {
  success: boolean;
  error?: string;
}

/**
 * Normalizes a Bangladeshi mobile number to 8801XXXXXXXXX format (without '+').
 */
export function normalizePhoneForSMS(phone: string): string {
  // Strip non-digits
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return '88' + cleaned;
  }
  if (cleaned.startsWith('8801') && cleaned.length === 13) {
    return cleaned;
  }
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return '880' + cleaned;
  }
  return cleaned;
}

/**
 * Premium SMS dispatcher with Sandbox simulation and production HTTP dispatch
 * to the GreenWeb SMS gateway.
 */
export async function sendSMS(to: string, message: string): Promise<SMSSendResult> {
  const token = process.env.GREENWEB_TOKEN;
  const provider = process.env.SMS_PROVIDER;
  const isSandbox = !token || token === 'console' || provider !== 'greenweb';

  const normalizedPhone = normalizePhoneForSMS(to);
  
  // Basic validation of Bangladeshi phone format (8801XXXXXXXXX)
  if (!/^8801\d{9}$/.test(normalizedPhone)) {
    const errorMsg = `Invalid Bangladeshi phone number format: ${to} (normalized: ${normalizedPhone})`;
    log.error(`[sms-gateway] ${errorMsg}`);
    return { success: false, error: 'Invalid Bangladeshi phone number' };
  }

  if (isSandbox) {
    log.info(`[sms-gateway] [SANDBOX MODE] OTP SMS to ${normalizedPhone}: ${message}`);
    return { success: true };
  }

  try {
    log.info(`[sms-gateway] Dispatched OTP SMS request to GreenWeb for ${normalizedPhone}`);
    
    // GreenWeb API call using fetch
    const url = new URL('https://api.greenweb.com.bd/api.php');
    url.searchParams.append('token', token!);
    url.searchParams.append('to', normalizedPhone);
    url.searchParams.append('message', message);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      const errorMsg = `GreenWeb API HTTP error: ${response.status} ${response.statusText}`;
      log.error(`[sms-gateway] ${errorMsg}`, { text });
      captureWithArea(new Error(errorMsg), 'auth', 'warning');
      return { success: false, error: `HTTP ${response.status}` };
    }

    const bodyText = await response.text();
    // GreenWeb typically returns "Ok" or "Ok:..." on success, or JSON / other text on error.
    if (bodyText.toLowerCase().includes('ok') || bodyText.toLowerCase().includes('success')) {
      log.info(`[sms-gateway] GreenWeb sent successfully to ${normalizedPhone}`);
      return { success: true };
    } else {
      const errorMsg = `GreenWeb failed to send. Response body: ${bodyText}`;
      log.error(`[sms-gateway] ${errorMsg}`);
      captureWithArea(new Error(errorMsg), 'auth', 'warning');
      return { success: false, error: bodyText };
    }
  } catch (err) {
    const errorMsg = `Failed to dispatch SMS via GreenWeb to ${normalizedPhone}`;
    log.error(`[sms-gateway] ${errorMsg}`, err);
    captureWithArea(err instanceof Error ? err : new Error(errorMsg), 'auth', 'warning');
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
