/**
 * Logger Utility Tests
 * Tests: log levels, structured output, audit logging, error formatting
 */

describe('Logger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  const importLogger = async () => {
    const mod = await import('../../../utils/logger');
    return mod.default;
  };

  describe('log levels', () => {
    it('should log info messages by default in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'info';
      const logger = await importLogger();

      logger.info('test message');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('test message'));
    });

    it('should log error messages', async () => {
      process.env.NODE_ENV = 'development';
      const logger = await importLogger();

      logger.error('something failed', new Error('test error'));

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('something failed'));
    });

    it('should log warn messages', async () => {
      process.env.NODE_ENV = 'development';
      const logger = await importLogger();

      logger.warn('warning message');

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('warning message'));
    });

    it('should filter debug messages when LOG_LEVEL=info', async () => {
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'info';
      const logger = await importLogger();

      logger.debug('debug message');

      expect(console.debug).not.toHaveBeenCalled();
    });

    it('should log debug messages when LOG_LEVEL=debug', async () => {
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'debug';
      const logger = await importLogger();

      logger.debug('debug message');

      expect(console.debug).toHaveBeenCalledWith(expect.stringContaining('debug message'));
    });
  });

  describe('structured output', () => {
    it('should output JSON in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'info';
      const logger = await importLogger();

      logger.info('test message', { userId: '123' });

      const output = (console.log as jest.Mock).mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('test message');
      expect(parsed.context.userId).toBe('123');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should include context in development output', async () => {
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'info';
      const logger = await importLogger();

      logger.info('test', { key: 'value' });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"key":"value"'));
    });
  });

  describe('error formatting', () => {
    it('should serialize Error objects with name and message', async () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'error';
      const logger = await importLogger();

      logger.error('failed', new Error('test error'));

      const output = (console.error as jest.Mock).mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.context.errorName).toBe('Error');
      expect(parsed.context.errorMessage).toBe('test error');
      // Production should not include stack trace
      expect(parsed.context.stack).toBeUndefined();
    });

    it('should include stack trace in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'error';
      const logger = await importLogger();

      logger.error('failed', new Error('test error'));

      const output = (console.error as jest.Mock).mock.calls[0][0];
      expect(output).toContain('test error');
    });

    it('should handle non-Error objects in error param', async () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'error';
      const logger = await importLogger();

      logger.error('failed', 'string error');

      const output = (console.error as jest.Mock).mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.context.errorMessage).toBe('string error');
    });
  });

  describe('audit logging', () => {
    it('should always log audit events regardless of log level', async () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'error'; // Only errors
      const logger = await importLogger();

      logger.audit('user_login', { userId: '123', email: 'test@test.com' });

      // Audit should still be logged even though LOG_LEVEL is error
      expect(console.log).toHaveBeenCalled();
      const output = (console.log as jest.Mock).mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.message).toBe('[AUDIT] user_login');
      expect(parsed.context.audit).toBe(true);
      expect(parsed.context.userId).toBe('123');
    });

    it('should include audit:true flag in context', async () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'info';
      const logger = await importLogger();

      logger.audit('password_changed', { userId: '456' });

      const output = (console.log as jest.Mock).mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.context.audit).toBe(true);
    });
  });

  describe('no context', () => {
    it('should log without context object', async () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'info';
      const logger = await importLogger();

      logger.info('simple message');

      const output = (console.log as jest.Mock).mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.message).toBe('simple message');
      expect(parsed.context).toBeUndefined();
    });
  });
});
