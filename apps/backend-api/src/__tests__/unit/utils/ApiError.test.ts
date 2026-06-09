/**
 * ApiError Utility Tests
 * Tests: class constructor, toResponse, factory functions, status codes
 */

import {
  ApiError,
  ErrorMessages,
  ErrorStatusCodes,
  createError,
  type ErrorCode,
} from '../../../utils/ApiError';

describe('ApiError', () => {
  describe('constructor', () => {
    it('should create error with correct code and statusCode', () => {
      const err = new ApiError('user_not_found');
      expect(err.code).toBe('user_not_found');
      expect(err.statusCode).toBe(404);
    });

    it('should set messageTh and messageEn from ErrorMessages', () => {
      const err = new ApiError('invalid_credentials');
      expect(err.messageTh).toBe(ErrorMessages.invalid_credentials.th);
      expect(err.messageEn).toBe(ErrorMessages.invalid_credentials.en);
    });

    it('should set message (Error.message) to English message by default', () => {
      const err = new ApiError('user_not_found');
      expect(err.message).toBe(ErrorMessages.user_not_found.en);
    });

    it('should override messageTh and messageEn with customMessage', () => {
      const custom = 'Custom error message';
      const err = new ApiError('validation_error', custom);
      expect(err.messageTh).toBe(custom);
      expect(err.messageEn).toBe(custom);
      expect(err.message).toBe(custom);
    });

    it('should always set isOperational to true', () => {
      const err = new ApiError('internal_server_error');
      expect(err.isOperational).toBe(true);
    });

    it('should be an instance of Error', () => {
      const err = new ApiError('access_denied');
      expect(err).toBeInstanceOf(Error);
    });

    it('should be an instance of ApiError', () => {
      const err = new ApiError('access_denied');
      expect(err).toBeInstanceOf(ApiError);
    });

    it('should have a stack trace', () => {
      const err = new ApiError('internal_server_error');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('ApiError');
    });
  });

  describe('toResponse', () => {
    it('should return Thai message by default', () => {
      const err = new ApiError('user_not_found');
      const res = err.toResponse();
      expect(res.success).toBe(false);
      expect(res.error.message).toBe(ErrorMessages.user_not_found.th);
    });

    it('should return Thai message when lang="th"', () => {
      const err = new ApiError('invalid_token');
      const res = err.toResponse('th');
      expect(res.error.message).toBe(ErrorMessages.invalid_token.th);
    });

    it('should return English message when lang="en"', () => {
      const err = new ApiError('invalid_token');
      const res = err.toResponse('en');
      expect(res.error.message).toBe(ErrorMessages.invalid_token.en);
    });

    it('should include error code in response', () => {
      const err = new ApiError('otp_expired');
      const res = err.toResponse();
      expect(res.error.code).toBe('otp_expired');
    });

    it('should include statusCode in response', () => {
      const err = new ApiError('otp_expired');
      const res = err.toResponse();
      expect(res.error.statusCode).toBe(422);
    });

    it('should return custom message in toResponse', () => {
      const custom = 'กรุณากรอก ชื่อ';
      const err = new ApiError('missing_required_field', custom);
      expect(err.toResponse().error.message).toBe(custom);
      expect(err.toResponse('en').error.message).toBe(custom);
    });
  });

  describe('status code mapping', () => {
    it('should map 400 codes correctly', () => {
      const codes400: ErrorCode[] = [
        'validation_error',
        'invalid_input',
        'missing_required_field',
        'invalid_email_format',
        'invalid_phone_format',
        'password_too_short',
        'password_mismatch',
        'invalid_push_token',
      ];
      codes400.forEach((code) => {
        expect(new ApiError(code).statusCode).toBe(400);
      });
    });

    it('should map 401 codes correctly', () => {
      const codes401: ErrorCode[] = [
        'missing_token',
        'invalid_token',
        'session_expired',
        'invalid_credentials',
        'current_password_incorrect',
      ];
      codes401.forEach((code) => {
        expect(new ApiError(code).statusCode).toBe(401);
      });
    });

    it('should map 403 codes correctly', () => {
      expect(new ApiError('access_denied').statusCode).toBe(403);
      expect(new ApiError('role_not_allowed').statusCode).toBe(403);
    });

    it('should map 404 codes correctly', () => {
      const codes404: ErrorCode[] = [
        'user_not_found',
        'elder_not_found',
        'device_not_found',
        'device_not_paired',
        'otp_not_found',
        'resource_not_found',
        'event_not_found',
        'notification_not_found',
      ];
      codes404.forEach((code) => {
        expect(new ApiError(code).statusCode).toBe(404);
      });
    });

    it('should map 409 codes correctly', () => {
      const codes409: ErrorCode[] = [
        'email_already_exists',
        'phone_already_exists',
        'device_already_paired',
        'event_already_cancelled',
      ];
      codes409.forEach((code) => {
        expect(new ApiError(code).statusCode).toBe(409);
      });
    });

    it('should map 422 codes correctly', () => {
      expect(new ApiError('otp_expired').statusCode).toBe(422);
      expect(new ApiError('otp_invalid').statusCode).toBe(422);
      expect(new ApiError('invalid_event_type').statusCode).toBe(422);
    });

    it('should map 429 correctly', () => {
      expect(new ApiError('rate_limit_exceeded').statusCode).toBe(429);
    });

    it('should map 500 codes correctly', () => {
      const codes500: ErrorCode[] = [
        'internal_server_error',
        'email_send_failed',
        'database_error',
      ];
      codes500.forEach((code) => {
        expect(new ApiError(code).statusCode).toBe(500);
      });
    });
  });

  describe('createError factory', () => {
    it('userNotFound() creates 404 error', () => {
      const err = createError.userNotFound();
      expect(err.code).toBe('user_not_found');
      expect(err.statusCode).toBe(404);
    });

    it('invalidToken() creates 401 error', () => {
      const err = createError.invalidToken();
      expect(err.code).toBe('invalid_token');
      expect(err.statusCode).toBe(401);
    });

    it('invalidCredentials() creates 401 error', () => {
      const err = createError.invalidCredentials();
      expect(err.code).toBe('invalid_credentials');
    });

    it('sessionExpired() creates 401 error', () => {
      const err = createError.sessionExpired();
      expect(err.code).toBe('session_expired');
    });

    it('accessDenied() creates 403 error', () => {
      const err = createError.accessDenied();
      expect(err.code).toBe('access_denied');
    });

    it('roleNotAllowed(role) includes role in message', () => {
      const err = createError.roleNotAllowed('ADMIN');
      expect(err.code).toBe('role_not_allowed');
      expect(err.messageTh).toContain('ADMIN');
    });

    it('otpExpired() creates 422 error', () => {
      const err = createError.otpExpired();
      expect(err.code).toBe('otp_expired');
      expect(err.statusCode).toBe(422);
    });

    it('otpInvalid() creates 422 error', () => {
      const err = createError.otpInvalid();
      expect(err.code).toBe('otp_invalid');
    });

    it('elderNotFound() creates 404 error', () => {
      const err = createError.elderNotFound();
      expect(err.code).toBe('elder_not_found');
    });

    it('deviceNotFound() creates 404 error', () => {
      const err = createError.deviceNotFound();
      expect(err.code).toBe('device_not_found');
    });

    it('deviceAlreadyPaired() creates 409 error', () => {
      const err = createError.deviceAlreadyPaired();
      expect(err.code).toBe('device_already_paired');
      expect(err.statusCode).toBe(409);
    });

    it('eventAlreadyCancelled() creates 409 error', () => {
      const err = createError.eventAlreadyCancelled();
      expect(err.code).toBe('event_already_cancelled');
    });

    it('serverError() creates 500 error', () => {
      const err = createError.serverError();
      expect(err.statusCode).toBe(500);
    });

    it('emailFailed() creates 500 error', () => {
      const err = createError.emailFailed();
      expect(err.code).toBe('email_send_failed');
    });

    it('validationError(msg) uses custom message', () => {
      const err = createError.validationError('ข้อมูลไม่ถูก');
      expect(err.code).toBe('validation_error');
      expect(err.messageTh).toBe('ข้อมูลไม่ถูก');
    });

    it('missingField(field) includes field name in message', () => {
      const err = createError.missingField('ชื่อ');
      expect(err.code).toBe('missing_required_field');
      expect(err.messageTh).toContain('ชื่อ');
    });

    it('emailExists() creates 409 error', () => {
      const err = createError.emailExists();
      expect(err.code).toBe('email_already_exists');
      expect(err.statusCode).toBe(409);
    });

    it('phoneExists() creates 409 error', () => {
      const err = createError.phoneExists();
      expect(err.code).toBe('phone_already_exists');
    });

    it('invalidPushToken() creates 400 error', () => {
      const err = createError.invalidPushToken();
      expect(err.code).toBe('invalid_push_token');
      expect(err.statusCode).toBe(400);
    });

    it('notificationNotFound() creates 404 error', () => {
      const err = createError.notificationNotFound();
      expect(err.code).toBe('notification_not_found');
    });

    it('resourceNotFound() creates 404 error', () => {
      const err = createError.resourceNotFound();
      expect(err.code).toBe('resource_not_found');
    });

    it('currentPasswordIncorrect() creates 401 error', () => {
      const err = createError.currentPasswordIncorrect();
      expect(err.code).toBe('current_password_incorrect');
      expect(err.statusCode).toBe(401);
    });

    it('otpNotFound() creates 404 error', () => {
      const err = createError.otpNotFound();
      expect(err.code).toBe('otp_not_found');
      expect(err.statusCode).toBe(404);
    });

    it('deviceNotPaired() creates 404 error', () => {
      const err = createError.deviceNotPaired();
      expect(err.code).toBe('device_not_paired');
      expect(err.statusCode).toBe(404);
    });

    it('eventNotFound() creates 404 error', () => {
      const err = createError.eventNotFound();
      expect(err.code).toBe('event_not_found');
      expect(err.statusCode).toBe(404);
    });

    it('invalidEventType() creates 422 error', () => {
      const err = createError.invalidEventType();
      expect(err.code).toBe('invalid_event_type');
      expect(err.statusCode).toBe(422);
    });
  });

  describe('ErrorMessages and ErrorStatusCodes completeness', () => {
    it('every ErrorCode has a message entry', () => {
      const codes = Object.keys(ErrorStatusCodes) as ErrorCode[];
      codes.forEach((code) => {
        expect(ErrorMessages[code]).toBeDefined();
        expect(ErrorMessages[code].th).toBeTruthy();
        expect(ErrorMessages[code].en).toBeTruthy();
      });
    });

    it('every ErrorCode has a status code entry', () => {
      const codes = Object.keys(ErrorMessages) as ErrorCode[];
      codes.forEach((code) => {
        expect(ErrorStatusCodes[code]).toBeGreaterThanOrEqual(400);
        expect(ErrorStatusCodes[code]).toBeLessThan(600);
      });
    });
  });
});
