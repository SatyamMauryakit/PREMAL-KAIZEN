import { Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '../common/logging/redact';

/**
 * Sends SMS messages via Twilio's REST API (plain `fetch`, no SDK dependency -
 * Twilio's Messages endpoint is a simple HTTPS Basic-Auth form POST, so pulling
 * in the full twilio npm package isn't needed just to send a text).
 *
 * Mirrors EmailService's never-throws, gated-by-env-vars pattern exactly: when
 * credentials are missing, every send is skipped (logged, not thrown) so mobile
 * OTP code elsewhere can always call this unconditionally without extra
 * isConfigured() branching at every call site - it just won't actually deliver
 * anything until real credentials are set.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER            — a Twilio phone number in E.164 format (+1...)
 * Optional:
 *   TWILIO_MESSAGING_SERVICE_SID  — if set, used instead of TWILIO_FROM_NUMBER
 *     (Twilio allows either `From` or `MessagingServiceSid`, not both)
 *
 * The OTP code itself is never logged - only a masked destination number.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private configChecked = false;
  private configured = false;
  private accountSid: string | undefined;
  private authToken: string | undefined;
  private fromNumber: string | undefined;
  private messagingServiceSid: string | undefined;

  isConfigured(): boolean {
    this.ensureConfig();
    return this.configured;
  }

  private ensureConfig(): void {
    if (this.configChecked) return;
    this.configChecked = true;

    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER;
    this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    if (!this.accountSid || !this.authToken || (!this.fromNumber && !this.messagingServiceSid)) {
      this.logger.warn(
        'SMS provider not configured (missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN and ' +
        'TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID). Mobile OTP codes will be skipped until these are set.',
      );
      this.configured = false;
      return;
    }
    this.configured = true;
  }

  /**
   * Sends a plain-text SMS. Never throws - a provider outage or missing
   * configuration must never block registration/verification, exactly like
   * EmailService.send.
   */
  async send(toPhone: string, message: string): Promise<boolean> {
    this.ensureConfig();

    if (!this.configured) {
      this.logger.log(`[sms skipped - not configured] to=${maskPhone(toPhone)}`);
      return false;
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const body = new URLSearchParams({ To: toPhone, Body: message });
      if (this.messagingServiceSid) body.set('MessagingServiceSid', this.messagingServiceSid);
      else body.set('From', this.fromNumber as string);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        this.logger.error(`[sms failed] to=${maskPhone(toPhone)} status=${res.status} ${errBody.slice(0, 200)}`);
        return false;
      }

      this.logger.log(`[sms sent] to=${maskPhone(toPhone)}`);
      return true;
    } catch (err) {
      this.logger.error(`[sms failed] to=${maskPhone(toPhone)}: ${(err as Error).message}`);
      return false;
    }
  }

  /** Sends a numeric OTP. The code itself is never logged - only in the message body sent to the user. */
  async sendMobileOtp(toPhone: string, otp: string, expiryMinutes: number): Promise<boolean> {
    return this.send(toPhone, `Your PREMAL KAIZEN verification code is ${otp}. It expires in ${expiryMinutes} minutes. Do not share this code with anyone.`);
  }
}
