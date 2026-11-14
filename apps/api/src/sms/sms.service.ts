import { Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '../common/logging/redact';

type SmsProvider = 'self_hosted' | 'twilio' | 'msg91' | 'generic_http';

const DEFAULT_SEND_TIMEOUT_MS = 10_000;
/** Overridable via SMS_SEND_TIMEOUT_MS - mainly so tests can use a short timeout instead of waiting out the real 10s default. */
function sendTimeoutMs(): number {
  const override = Number(process.env.SMS_SEND_TIMEOUT_MS);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_SEND_TIMEOUT_MS;
}

/**
 * Sends SMS messages via a pluggable provider, chosen with `SMS_PROVIDER`:
 *
 * - `self_hosted` (default) - a plain JSON HTTP POST to a gateway YOU run and
 *   control (a GSM-modem box on your own network running Gammu/SMSTools3, a
 *   self-hosted "SMS Gateway" app on an Android phone with a SIM card, or any
 *   script you write) instead of a commercial SMS API.
 *
 * - `twilio` - Twilio's REST API, for anyone who prefers a managed global
 *   provider. NOTE for India: Twilio requires the same TRAI DLT sender-ID +
 *   content-template registration as any other route into Indian telecom
 *   networks - see the MSG91/DLT notes below, which apply regardless of
 *   which provider ultimately carries the message.
 *
 * - `msg91` - MSG91's Flow API (https://control.msg91.com/api/v5/flow), a
 *   DLT-compliant Indian transactional SMS aggregator. Unlike the other
 *   providers, MSG91's Flow API does not accept arbitrary free-text - it
 *   fills a pre-approved DLT template with variables, which is itself the
 *   correct, TRAI-compliant way to send transactional/OTP SMS in India.
 *
 * - `generic_http` - a configurable field-mapped HTTP adapter for any other
 *   Indian or international transactional SMS provider (Kaleyra, Gupshup,
 *   Fast2SMS, TextLocal, AWS SNS, etc.) that doesn't match the shapes above -
 *   see the env var reference in .env.example.
 *
 * Every provider path has a hard SEND_TIMEOUT_MS cap (a hung provider must
 * never hang a request indefinitely) and NEVER throws from `send`/
 * `sendMobileOtp` themselves - a provider outage, timeout, or missing
 * configuration always resolves to `false`, exactly like EmailService.send.
 * It is the CALLER's responsibility to decide what a `false` result means
 * for the user-facing response (see identity.service.ts / customer.service.ts,
 * which turn `false` into a real error for explicit send/resend actions -
 * this service never silently claims a message was delivered).
 *
 * Verification is NEVER delegated to any of these providers or to any other
 * third party - OTPs are generated, hashed, and checked entirely in
 * otp.utils.ts against our own database. This service only ever carries an
 * already-generated code to the customer.
 *
 * The OTP code itself is never logged - only a masked destination number and
 * the delivery outcome (see logSmsOutcome).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private configChecked = false;
  private configured = false;
  private provider: SmsProvider = 'self_hosted';

  // self_hosted config
  private selfHostedUrl: string | undefined;
  private selfHostedApiKey: string | undefined;

  // twilio config
  private accountSid: string | undefined;
  private authToken: string | undefined;
  private fromNumber: string | undefined;
  private messagingServiceSid: string | undefined;

  // msg91 config (DLT-compliant Indian transactional SMS)
  private msg91AuthKey: string | undefined;
  private msg91SenderId: string | undefined;
  private msg91DltTemplateId: string | undefined;
  private msg91OtpVariable = 'OTP';

  // generic_http config (any other provider, field-mapped)
  private genericUrl: string | undefined;
  private genericMethod: 'GET' | 'POST' = 'POST';
  private genericContentType: 'json' | 'form' = 'json';
  private genericToField = 'to';
  private genericMessageField = 'message';
  private genericSenderField: string | undefined;
  private genericSenderId: string | undefined;
  private genericAuthHeaderName: string | undefined;
  private genericAuthHeaderValue: string | undefined;
  private genericAuthParamName: string | undefined;
  private genericErrorIndicator: string | undefined;

  getProvider(): SmsProvider {
    this.ensureConfig();
    return this.provider;
  }

  isConfigured(): boolean {
    this.ensureConfig();
    return this.configured;
  }

  private ensureConfig(): void {
    if (this.configChecked) return;
    this.configChecked = true;

    const requested = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
    const knownProviders: readonly string[] = ['twilio', 'msg91', 'generic_http'];
    this.provider = knownProviders.includes(requested) ? (requested as SmsProvider) : 'self_hosted';

    switch (this.provider) {
      case 'self_hosted':
        this.configureSelfHosted();
        return;
      case 'twilio':
        this.configureTwilio();
        return;
      case 'msg91':
        this.configureMsg91();
        return;
      case 'generic_http':
        this.configureGenericHttp();
        return;
    }
  }

  private configureSelfHosted(): void {
    this.selfHostedUrl = process.env.SELF_HOSTED_SMS_URL;
    this.selfHostedApiKey = process.env.SELF_HOSTED_SMS_API_KEY;

    if (!this.selfHostedUrl) {
      this.logger.warn(
        'SMS provider not configured (SMS_PROVIDER=self_hosted but SELF_HOSTED_SMS_URL is ' +
        'not set). Mobile OTP codes will be skipped until your self-hosted gateway URL is set.',
      );
      this.configured = false;
      return;
    }
    this.configured = true;
  }

  private configureTwilio(): void {
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

  private configureMsg91(): void {
    this.msg91AuthKey = process.env.MSG91_AUTH_KEY;
    this.msg91SenderId = process.env.MSG91_SENDER_ID;
    this.msg91DltTemplateId = process.env.MSG91_DLT_TEMPLATE_ID;
    this.msg91OtpVariable = process.env.MSG91_OTP_VARIABLE_NAME || 'OTP';

    // All three are mandatory: TRAI's DLT rules require a registered sender ID
    // AND a pre-approved content template for every transactional SMS sent to
    // an Indian number - without both, MSG91 (or any Indian aggregator) will
    // reject the send outright, so treat it as "not configured" rather than
    // attempting a doomed request.
    if (!this.msg91AuthKey || !this.msg91SenderId || !this.msg91DltTemplateId) {
      this.logger.warn(
        'SMS provider not configured (missing MSG91_AUTH_KEY/MSG91_SENDER_ID/MSG91_DLT_TEMPLATE_ID). ' +
        'All three are required by TRAI DLT rules for Indian transactional SMS - see .env.example.',
      );
      this.configured = false;
      return;
    }
    this.configured = true;
  }

  private configureGenericHttp(): void {
    this.genericUrl = process.env.GENERIC_SMS_URL;
    this.genericMethod = (process.env.GENERIC_SMS_METHOD || 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST';
    this.genericContentType = (process.env.GENERIC_SMS_CONTENT_TYPE || 'json').toLowerCase() === 'form' ? 'form' : 'json';
    this.genericToField = process.env.GENERIC_SMS_TO_FIELD || 'to';
    this.genericMessageField = process.env.GENERIC_SMS_MESSAGE_FIELD || 'message';
    this.genericSenderField = process.env.GENERIC_SMS_SENDER_FIELD;
    this.genericSenderId = process.env.GENERIC_SMS_SENDER_ID;
    this.genericAuthHeaderName = process.env.GENERIC_SMS_AUTH_HEADER_NAME;
    this.genericAuthHeaderValue = process.env.GENERIC_SMS_AUTH_HEADER_VALUE;
    this.genericAuthParamName = process.env.GENERIC_SMS_AUTH_PARAM_NAME;
    this.genericErrorIndicator = process.env.GENERIC_SMS_ERROR_INDICATOR;

    if (!this.genericUrl) {
      this.logger.warn(
        'SMS provider not configured (SMS_PROVIDER=generic_http but GENERIC_SMS_URL is not set). ' +
        'Mobile OTP codes will be skipped until your provider endpoint is configured - see .env.example.',
      );
      this.configured = false;
      return;
    }
    this.configured = true;
  }

  /**
   * Sends a plain-text SMS via whichever provider is configured. Never
   * throws - a provider outage, timeout, or missing configuration must
   * never block registration/verification, exactly like EmailService.send.
   * Not used for the `msg91` provider (its DLT template API has no free-text
   * mode) - sendMobileOtp branches to sendMsg91Otp instead.
   */
  async send(toPhone: string, message: string): Promise<boolean> {
    this.ensureConfig();

    if (!this.configured) {
      this.logSmsOutcome(toPhone, 'skipped-not-configured');
      return false;
    }

    switch (this.provider) {
      case 'self_hosted':
        return this.sendViaSelfHostedGateway(toPhone, message);
      case 'twilio':
        return this.sendViaTwilio(toPhone, message);
      case 'generic_http':
        return this.sendViaGenericHttp(toPhone, message);
      case 'msg91':
        // send() carries free text; msg91's DLT template API can't express
        // this safely, so refuse rather than silently mis-sending.
        this.logger.error('SmsService.send() called directly with SMS_PROVIDER=msg91 - use sendMobileOtp instead (msg91 requires the DLT OTP template).');
        return false;
    }
  }

  /** Sends a numeric OTP. The code itself is never logged - only in the message/template variable sent to the provider. */
  async sendMobileOtp(toPhone: string, otp: string, expiryMinutes: number): Promise<boolean> {
    this.ensureConfig();

    if (!this.configured) {
      this.logSmsOutcome(toPhone, 'skipped-not-configured');
      return false;
    }

    if (this.provider === 'msg91') {
      return this.sendMsg91Otp(toPhone, otp);
    }

    return this.send(
      toPhone,
      `Your PREMAL KAIZEN verification code is ${otp}. It expires in ${expiryMinutes} minutes. Do not share this code with anyone.`,
    );
  }

  private async sendViaSelfHostedGateway(toPhone: string, message: string): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(this.selfHostedUrl as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.selfHostedApiKey ? { Authorization: `Bearer ${this.selfHostedApiKey}` } : {}),
        },
        body: JSON.stringify({ to: toPhone, message }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        this.logSmsOutcome(toPhone, 'failed', `status=${res.status} ${errBody.slice(0, 200)}`);
        return false;
      }
      this.logSmsOutcome(toPhone, 'sent', 'via self-hosted gateway');
      return true;
    } catch (err) {
      this.logSmsOutcome(toPhone, 'failed', (err as Error).message);
      return false;
    }
  }

  private async sendViaTwilio(toPhone: string, message: string): Promise<boolean> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const body = new URLSearchParams({ To: toPhone, Body: message });
      if (this.messagingServiceSid) body.set('MessagingServiceSid', this.messagingServiceSid);
      else body.set('From', this.fromNumber as string);

      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        this.logSmsOutcome(toPhone, 'failed', `status=${res.status} ${errBody.slice(0, 200)}`);
        return false;
      }
      this.logSmsOutcome(toPhone, 'sent', 'via Twilio');
      return true;
    } catch (err) {
      this.logSmsOutcome(toPhone, 'failed', (err as Error).message);
      return false;
    }
  }

  /**
   * MSG91 Flow API - the DLT-compliant way to send transactional/OTP SMS to
   * Indian numbers. The OTP is passed as a template variable (never embedded
   * in free text), filling the pre-approved DLT template identified by
   * MSG91_DLT_TEMPLATE_ID. `mobiles` must be digits-only with country code,
   * no leading '+'.
   */
  private async sendMsg91Otp(toPhone: string, otp: string): Promise<boolean> {
    try {
      const mobiles = toPhone.replace(/[^\d]/g, '');
      const res = await fetchWithTimeout('https://control.msg91.com/api/v5/flow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.msg91AuthKey as string,
        },
        body: JSON.stringify({
          template_id: this.msg91DltTemplateId,
          short_url: '0',
          recipients: [
            {
              mobiles,
              [this.msg91OtpVariable]: otp,
            },
          ],
        }),
      });

      const payload = await res.text().catch(() => '');
      // MSG91 can return HTTP 200 with an error payload (e.g. {"type":"error",...})
      // for an invalid template/sender/route, so check the body, not just the status.
      const looksLikeError = !res.ok || /"type"\s*:\s*"error"/i.test(payload);
      if (looksLikeError) {
        this.logSmsOutcome(toPhone, 'failed', `status=${res.status} ${payload.slice(0, 200)}`);
        return false;
      }
      this.logSmsOutcome(toPhone, 'sent', 'via MSG91 (DLT template)');
      return true;
    } catch (err) {
      this.logSmsOutcome(toPhone, 'failed', (err as Error).message);
      return false;
    }
  }

  private async sendViaGenericHttp(toPhone: string, message: string): Promise<boolean> {
    try {
      const fields: Record<string, string> = {
        [this.genericToField]: toPhone,
        [this.genericMessageField]: message,
      };
      if (this.genericSenderField && this.genericSenderId) {
        fields[this.genericSenderField] = this.genericSenderId;
      }

      let url = this.genericUrl as string;
      let body: string | undefined;
      const headers: Record<string, string> = {};
      if (this.genericAuthHeaderName && this.genericAuthHeaderValue) {
        headers[this.genericAuthHeaderName] = this.genericAuthHeaderValue;
      }

      const params = new URLSearchParams(fields);
      if (this.genericAuthParamName && this.genericAuthHeaderValue) {
        params.set(this.genericAuthParamName, this.genericAuthHeaderValue);
      }

      if (this.genericMethod === 'GET') {
        url = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
      } else if (this.genericContentType === 'form') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = params.toString();
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(fields);
      }

      const res = await fetchWithTimeout(url, { method: this.genericMethod, headers, body });
      const payload = await res.text().catch(() => '');
      const looksLikeError = !res.ok || (this.genericErrorIndicator ? payload.includes(this.genericErrorIndicator) : false);

      if (looksLikeError) {
        this.logSmsOutcome(toPhone, 'failed', `status=${res.status} ${payload.slice(0, 200)}`);
        return false;
      }
      this.logSmsOutcome(toPhone, 'sent', 'via generic_http provider');
      return true;
    } catch (err) {
      this.logSmsOutcome(toPhone, 'failed', (err as Error).message);
      return false;
    }
  }

  /** Structured delivery-status logging - masked destination, provider, and outcome only. The OTP value is never available here (only the pre-rendered message/template vars were, and are never logged). */
  private logSmsOutcome(toPhone: string, outcome: 'sent' | 'failed' | 'skipped-not-configured', detail?: string): void {
    const line = `[sms ${outcome}] provider=${this.provider} to=${maskPhone(toPhone)}${detail ? ` ${detail}` : ''}`;
    if (outcome === 'failed') this.logger.error(line);
    else this.logger.log(line);
  }
}

/** fetch() with a hard timeout - a hung SMS provider must never hang the request indefinitely. */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = sendTimeoutMs()): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
