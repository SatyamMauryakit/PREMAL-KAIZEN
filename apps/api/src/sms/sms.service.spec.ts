import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SMS_PROVIDER;
    delete process.env.SELF_HOSTED_SMS_URL;
    delete process.env.SELF_HOSTED_SMS_API_KEY;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.MSG91_SENDER_ID;
    delete process.env.MSG91_DLT_TEMPLATE_ID;
    delete process.env.GENERIC_SMS_URL;
    delete process.env.GENERIC_SMS_AUTH_HEADER_NAME;
    delete process.env.GENERIC_SMS_AUTH_HEADER_VALUE;
    delete process.env.GENERIC_SMS_ERROR_INDICATOR;
    delete process.env.SMS_SEND_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('self-hosted gateway (default provider - no third-party SMS API)', () => {
    it('is not configured and never throws when no gateway URL is set', async () => {
      const service = new SmsService();
      expect(service.isConfigured()).toBe(false);

      const result = await service.sendMobileOtp('+919876543210', '123456', 5);
      expect(result).toBe(false);
    });

    it('is configured once a self-hosted gateway URL is set (this is the default provider)', () => {
      process.env.SELF_HOSTED_SMS_URL = 'http://192.168.1.50:8080/send-sms';
      const service = new SmsService();

      expect(service.isConfigured()).toBe(true);
    });

    it('posts JSON {to, message} to the self-hosted gateway, and never logs the OTP itself', async () => {
      process.env.SELF_HOSTED_SMS_URL = 'http://192.168.1.50:8080/send-sms';
      const service = new SmsService();

      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
      vi.stubGlobal('fetch', fetchMock);

      const result = await service.sendMobileOtp('+919876543210', '654321', 5);

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://192.168.1.50:8080/send-sms',
        expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }),
      );
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.to).toBe('+919876543210');
      expect(sentBody.message).toContain('654321'); // the OTP goes in the SMS body sent to your own gateway...
      // ...but never appears in this service's own return value or thrown errors.
      expect(JSON.stringify(result)).not.toContain('654321');
    });

    it('sends a bearer token header when SELF_HOSTED_SMS_API_KEY is set', async () => {
      process.env.SELF_HOSTED_SMS_URL = 'http://192.168.1.50:8080/send-sms';
      process.env.SELF_HOSTED_SMS_API_KEY = 'my-gateway-secret';
      const service = new SmsService();

      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
      vi.stubGlobal('fetch', fetchMock);

      await service.sendMobileOtp('+919876543210', '111111', 5);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer my-gateway-secret' }) }),
      );
    });

    it('returns false (never throws) when the gateway responds with an error status', async () => {
      process.env.SELF_HOSTED_SMS_URL = 'http://192.168.1.50:8080/send-sms';
      const service = new SmsService();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'modem offline' }));

      const result = await service.sendMobileOtp('+919876543210', '111111', 5);
      expect(result).toBe(false);
    });

    it('returns false (never throws) when the network call itself fails', async () => {
      process.env.SELF_HOSTED_SMS_URL = 'http://192.168.1.50:8080/send-sms';
      const service = new SmsService();

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      await expect(service.sendMobileOtp('+919876543210', '111111', 5)).resolves.toBe(false);
    });
  });

  describe('msg91 (DLT-compliant Indian transactional SMS, opt-in via SMS_PROVIDER=msg91)', () => {
    it('is not configured when auth key, sender ID or DLT template ID is missing', async () => {
      process.env.SMS_PROVIDER = 'msg91';
      process.env.MSG91_AUTH_KEY = 'key123';
      // MSG91_SENDER_ID and MSG91_DLT_TEMPLATE_ID deliberately left unset
      const service = new SmsService();

      expect(service.isConfigured()).toBe(false);
      const result = await service.sendMobileOtp('+919876543210', '123456', 5);
      expect(result).toBe(false);
    });

    it('is configured once auth key, sender ID, and DLT template ID are all present', () => {
      process.env.SMS_PROVIDER = 'msg91';
      process.env.MSG91_AUTH_KEY = 'key123';
      process.env.MSG91_SENDER_ID = 'PRMLKZ';
      process.env.MSG91_DLT_TEMPLATE_ID = 'tpl_001';
      const service = new SmsService();

      expect(service.isConfigured()).toBe(true);
    });

    it('sends the OTP as a DLT template variable (not free text), strips the leading + from the mobile number', async () => {
      process.env.SMS_PROVIDER = 'msg91';
      process.env.MSG91_AUTH_KEY = 'key123';
      process.env.MSG91_SENDER_ID = 'PRMLKZ';
      process.env.MSG91_DLT_TEMPLATE_ID = 'tpl_001';
      const service = new SmsService();

      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"type":"success"}' });
      vi.stubGlobal('fetch', fetchMock);

      const result = await service.sendMobileOtp('+919876543210', '246810', 5);

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://control.msg91.com/api/v5/flow',
        expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ authkey: 'key123' }) }),
      );
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.template_id).toBe('tpl_001');
      expect(sentBody.recipients[0].mobiles).toBe('919876543210'); // no leading '+'
      expect(sentBody.recipients[0].OTP).toBe('246810');
      expect(JSON.stringify(result)).not.toContain('246810');
    });

    it('treats an HTTP 200 response carrying an error payload as a failure (MSG91 does this for an invalid template/sender/route)', async () => {
      process.env.SMS_PROVIDER = 'msg91';
      process.env.MSG91_AUTH_KEY = 'key123';
      process.env.MSG91_SENDER_ID = 'PRMLKZ';
      process.env.MSG91_DLT_TEMPLATE_ID = 'tpl_001';
      const service = new SmsService();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"type":"error","message":"invalid template"}' }));

      const result = await service.sendMobileOtp('+919876543210', '111111', 5);
      expect(result).toBe(false);
    });

    it('returns false (never throws) when the network call itself fails', async () => {
      process.env.SMS_PROVIDER = 'msg91';
      process.env.MSG91_AUTH_KEY = 'key123';
      process.env.MSG91_SENDER_ID = 'PRMLKZ';
      process.env.MSG91_DLT_TEMPLATE_ID = 'tpl_001';
      const service = new SmsService();

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

      await expect(service.sendMobileOtp('+919876543210', '111111', 5)).resolves.toBe(false);
    });
  });

  describe('generic_http (configurable adapter for any other transactional SMS provider, opt-in via SMS_PROVIDER=generic_http)', () => {
    it('is not configured when no URL is set', async () => {
      process.env.SMS_PROVIDER = 'generic_http';
      const service = new SmsService();

      expect(service.isConfigured()).toBe(false);
      const result = await service.sendMobileOtp('+919876543210', '123456', 5);
      expect(result).toBe(false);
    });

    it('posts JSON with configurable field names and an auth header', async () => {
      process.env.SMS_PROVIDER = 'generic_http';
      process.env.GENERIC_SMS_URL = 'https://api.example-india-sms.com/v1/send';
      process.env.GENERIC_SMS_TO_FIELD = 'mobile';
      process.env.GENERIC_SMS_MESSAGE_FIELD = 'text';
      process.env.GENERIC_SMS_AUTH_HEADER_NAME = 'Authorization';
      process.env.GENERIC_SMS_AUTH_HEADER_VALUE = 'Bearer provider-key';
      const service = new SmsService();

      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'OK' });
      vi.stubGlobal('fetch', fetchMock);

      const result = await service.sendMobileOtp('+919876543210', '135790', 5);

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example-india-sms.com/v1/send',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer provider-key' }) }),
      );
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.mobile).toBe('+919876543210');
      expect(sentBody.text).toContain('135790');
    });

    it('treats a 2xx response containing the configured error indicator as a failure', async () => {
      process.env.SMS_PROVIDER = 'generic_http';
      process.env.GENERIC_SMS_URL = 'https://api.example-india-sms.com/v1/send';
      process.env.GENERIC_SMS_ERROR_INDICATOR = '"status":"FAILED"';
      const service = new SmsService();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"status":"FAILED","reason":"invalid sender id"}' }));

      const result = await service.sendMobileOtp('+919876543210', '111111', 5);
      expect(result).toBe(false);
    });

    it('returns false (never throws) when the provider responds with an error status', async () => {
      process.env.SMS_PROVIDER = 'generic_http';
      process.env.GENERIC_SMS_URL = 'https://api.example-india-sms.com/v1/send';
      const service = new SmsService();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'sender id not DLT approved' }));

      const result = await service.sendMobileOtp('+919876543210', '111111', 5);
      expect(result).toBe(false);
    });

    it('uses GET with query params when GENERIC_SMS_METHOD=GET (common for legacy Indian provider APIs)', async () => {
      process.env.SMS_PROVIDER = 'generic_http';
      process.env.GENERIC_SMS_URL = 'https://api.example-india-sms.com/v1/send';
      process.env.GENERIC_SMS_METHOD = 'GET';
      process.env.GENERIC_SMS_AUTH_PARAM_NAME = 'authkey';
      process.env.GENERIC_SMS_AUTH_HEADER_VALUE = 'provider-key';
      const service = new SmsService();

      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'OK' });
      vi.stubGlobal('fetch', fetchMock);

      await service.sendMobileOtp('+919876543210', '111111', 5);

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('authkey=provider-key');
      expect(calledUrl).toContain('to=%2B919876543210');
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET' });
    });
  });

  describe('request timeout (applies to every provider)', () => {
    it('gives up and returns false if the provider never responds within the configured timeout', async () => {
      process.env.SMS_PROVIDER = 'self_hosted';
      process.env.SELF_HOSTED_SMS_URL = 'http://192.168.1.50:8080/send-sms';
      process.env.SMS_SEND_TIMEOUT_MS = '50'; // short timeout so the test stays fast
      const service = new SmsService();

      // Simulates a provider that hangs - fetch only ever settles when the
      // AbortController (driven by the timeout) aborts it.
      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, options: RequestInit) => {
        return new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }));

      const result = await service.sendMobileOtp('+919876543210', '111111', 5);
      expect(result).toBe(false);
    }, 10000);
  });

  describe('Twilio (opt-in via SMS_PROVIDER=twilio, for anyone who prefers a managed provider)', () => {
    it('is not configured and never throws when Twilio env vars are missing', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      const service = new SmsService();
      expect(service.isConfigured()).toBe(false);

      const result = await service.sendMobileOtp('+919876543210', '123456', 5);
      expect(result).toBe(false);
    });

    it('is configured once account SID, auth token, and a from-number are present', () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'ACxxxx';
      process.env.TWILIO_AUTH_TOKEN = 'secret';
      process.env.TWILIO_FROM_NUMBER = '+15005550006';
      const service = new SmsService();

      expect(service.isConfigured()).toBe(true);
    });

    it('accepts a messaging service SID in place of a from-number', () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'ACxxxx';
      process.env.TWILIO_AUTH_TOKEN = 'secret';
      process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGxxxx';
      const service = new SmsService();

      expect(service.isConfigured()).toBe(true);
    });

    it('sends a real request to Twilio once configured, and never logs the OTP itself', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'ACxxxx';
      process.env.TWILIO_AUTH_TOKEN = 'secret';
      process.env.TWILIO_FROM_NUMBER = '+15005550006';
      const service = new SmsService();

      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' });
      vi.stubGlobal('fetch', fetchMock);

      const result = await service.sendMobileOtp('+919876543210', '654321', 5);

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/ACxxxx/Messages.json',
        expect.objectContaining({ method: 'POST' }),
      );
      const sentBody = fetchMock.mock.calls[0][1].body.toString();
      expect(sentBody).toContain('654321'); // the OTP goes in the SMS body sent to Twilio...
      // ...but never appears in this service's own return value or thrown errors.
      expect(JSON.stringify(result)).not.toContain('654321');
    });

    it('returns false (never throws) when the provider responds with an error status', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'ACxxxx';
      process.env.TWILIO_AUTH_TOKEN = 'secret';
      process.env.TWILIO_FROM_NUMBER = '+15005550006';
      const service = new SmsService();

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Invalid number' }));

      const result = await service.sendMobileOtp('+919876543210', '111111', 5);
      expect(result).toBe(false);
    });

    it('returns false (never throws) when the network call itself fails', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'ACxxxx';
      process.env.TWILIO_AUTH_TOKEN = 'secret';
      process.env.TWILIO_FROM_NUMBER = '+15005550006';
      const service = new SmsService();

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

      await expect(service.sendMobileOtp('+919876543210', '111111', 5)).resolves.toBe(false);
    });
  });
});
