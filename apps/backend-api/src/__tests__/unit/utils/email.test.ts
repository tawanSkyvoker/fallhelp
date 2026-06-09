/**
 * email Utility Tests
 * Tests: dev mode (no client), Resend error handling, OTP email structure
 */

// Must mock resend before any import that loads it
jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn(),
      },
    })),
  };
});

describe('email utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret-key-for-testing-only',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  const importEmail = async () => {
    const mod = await import('../../../utils/email');
    return { sendEmail: mod.sendEmail, sendOtpEmail: mod.sendOtpEmail };
  };

  describe('sendEmail - dev mode (no RESEND_API_KEY)', () => {
    it('should return void without calling Resend when DISABLE_EMAIL=true', async () => {
      process.env.DISABLE_EMAIL = 'true';
      process.env.RESEND_API_KEY = undefined as unknown as string;
      delete process.env.RESEND_API_KEY;

      const { sendEmail } = await importEmail();

      await expect(
        sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
      ).resolves.toBeUndefined();
    });

    it('should return void without throwing when RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.DISABLE_EMAIL;

      const { sendEmail } = await importEmail();

      await expect(
        sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendEmail - with Resend client', () => {
    it('should call Resend emails.send with correct parameters', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      delete process.env.DISABLE_EMAIL;

      const { Resend } = await import('resend');
      const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg-123' }, error: null });
      (Resend as jest.Mock).mockImplementationOnce(() => ({
        emails: { send: mockSend },
      }));

      const { sendEmail } = await importEmail();

      await sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>test</p>' });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@example.com'],
          subject: 'Hello',
          html: '<p>test</p>',
        }),
      );
    });

    it('should throw emailFailed when Resend returns an error', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      delete process.env.DISABLE_EMAIL;

      const { Resend } = await import('resend');
      const mockSend = jest.fn().mockResolvedValue({ data: null, error: { message: 'API Error' } });
      (Resend as jest.Mock).mockImplementationOnce(() => ({
        emails: { send: mockSend },
      }));

      const { sendEmail } = await importEmail();

      await expect(
        sendEmail({ to: 'user@example.com', subject: 'Test', html: '<p>test</p>' }),
      ).rejects.toMatchObject({ code: 'email_send_failed' });
    });

    it('should throw emailFailed when Resend throws', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      delete process.env.DISABLE_EMAIL;

      const { Resend } = await import('resend');
      const mockSend = jest.fn().mockRejectedValue(new Error('Network failure'));
      (Resend as jest.Mock).mockImplementationOnce(() => ({
        emails: { send: mockSend },
      }));

      const { sendEmail } = await importEmail();

      await expect(
        sendEmail({ to: 'user@example.com', subject: 'Test', html: '<p>test</p>' }),
      ).rejects.toMatchObject({ code: 'email_send_failed' });
    });
  });

  describe('sendOtpEmail', () => {
    it('should complete without throwing in dev mode', async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.DISABLE_EMAIL;

      const { sendOtpEmail } = await importEmail();

      await expect(sendOtpEmail('user@example.com', '123456', 'REF-001')).resolves.toBeUndefined();
    });

    it('should complete without reference code', async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.DISABLE_EMAIL;

      const { sendOtpEmail } = await importEmail();

      await expect(sendOtpEmail('user@example.com', '654321')).resolves.toBeUndefined();
    });

    it('should call sendEmail with subject containing ref code when provided', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      delete process.env.DISABLE_EMAIL;

      const { Resend } = await import('resend');
      const mockSend = jest.fn().mockResolvedValue({ data: { id: 'id-1' }, error: null });
      (Resend as jest.Mock).mockImplementationOnce(() => ({
        emails: { send: mockSend },
      }));

      const { sendOtpEmail } = await importEmail();
      await sendOtpEmail('user@example.com', '111111', 'REF-ABC');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('REF-ABC'),
        }),
      );
    });
  });
});
