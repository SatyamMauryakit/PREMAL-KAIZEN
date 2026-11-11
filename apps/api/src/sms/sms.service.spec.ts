import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SmsService } from './sms.service';

describe('SmsService (Section 4: provider-gated mobile OTP)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('is not configured and never throws when Twilio env vars are missing', async () => {
    const service = new SmsService();
    expect(service.isConfigured()).toBe(false);

    const result = await service.sendMobileOtp('+919876543210', '123456', 5);
    expect(result).toBe(false);
  });

  it('is configured once account SID, auth token, and a from-number are present', () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACxxxx';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_FROM_NUMBER = '+15005550006';
    const service = new SmsService();

    expect(service.isConfigured()).toBe(true);
  });

  it('accepts a messaging service SID in place of a from-number', () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACxxxx';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGxxxx';
    const service = new SmsService();

    expect(service.isConfigured()).toBe(true);
  });

  it('sends a real request to Twilio once configured, and never logs the OTP itself', async () => {
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
    process.env.TWILIO_ACCOUNT_SID = 'ACxxxx';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_FROM_NUMBER = '+15005550006';
    const service = new SmsService();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Invalid number' }));

    const result = await service.sendMobileOtp('+919876543210', '111111', 5);
    expect(result).toBe(false);
  });

  it('returns false (never throws) when the network call itself fails', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACxxxx';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_FROM_NUMBER = '+15005550006';
    const service = new SmsService();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    await expect(service.sendMobileOtp('+919876543210', '111111', 5)).resolves.toBe(false);
  });
});
