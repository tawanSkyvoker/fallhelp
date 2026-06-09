/**
 * Tests for validation.ts middlewares
 *
 * Covers:
 * - validate() factory (all rule types: required, type, minLength/maxLength,
 *   min/max, pattern, custom, email, array)
 * - validateLogin
 * - validateRegister
 * - validateOtpRequest
 * - validateOtpVerification
 * - validateWiFiConfig (full branch coverage)
 */

import { Request, Response } from 'express';
import {
  validate,
  validateLogin,
  validateRegister,
  validateOtpRequest,
  validateOtpVerification,
  validateResetPassword,
  validateCreateDevice,
  validateWiFiConfig,
} from '../../../middlewares/validation';

// ── Helper ────────────────────────────────────────────────────────────────────

const createMockResponse = (): Response => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
  (res.status as unknown as jest.Mock).mockReturnValue(res);
  return res;
};

const makeReq = (body: Record<string, unknown>): Request => ({ body }) as unknown as Request;

// ── validate() factory ────────────────────────────────────────────────────────

describe('validate() factory', () => {
  describe('required rule', () => {
    const mw = validate([{ field: 'name', required: true }]);

    it('passes when required field is present', () => {
      const next = jest.fn();
      mw(makeReq({ name: 'Alice' }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('fails when required field is undefined', () => {
      const res = createMockResponse();
      const next = jest.fn();
      mw(makeReq({}), res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['name is required'] }),
      );
    });

    it('fails when required field is null', () => {
      const res = createMockResponse();
      const next = jest.fn();
      mw(makeReq({ name: null }), res, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('fails when required field is empty string', () => {
      const res = createMockResponse();
      const next = jest.fn();
      mw(makeReq({ name: '' }), res, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('uses custom message when provided', () => {
      const mwMsg = validate([{ field: 'x', required: true, message: 'x is needed' }]);
      const res = createMockResponse();
      mwMsg(makeReq({}), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors: ['x is needed'] }));
    });
  });

  describe('optional field skip', () => {
    const mw = validate([{ field: 'nick', required: false, type: 'string' as const }]);

    it('skips validation when optional field is undefined', () => {
      const next = jest.fn();
      mw(makeReq({}), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('skips validation when optional field is null', () => {
      const next = jest.fn();
      mw(makeReq({ nick: null }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('type: email', () => {
    const mw = validate([{ field: 'email', type: 'email' as const }]);

    it('passes with valid email', () => {
      const next = jest.fn();
      mw(makeReq({ email: 'test@example.com' }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('fails with invalid email', () => {
      const res = createMockResponse();
      const next = jest.fn();
      mw(makeReq({ email: 'not-an-email' }), res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['email must be a valid email'] }),
      );
    });
  });

  describe('type: array', () => {
    const mw = validate([{ field: 'tags', type: 'array' as const }]);

    it('passes with an array value', () => {
      const next = jest.fn();
      mw(makeReq({ tags: ['a', 'b'] }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('fails with a non-array value', () => {
      const res = createMockResponse();
      const next = jest.fn();
      mw(makeReq({ tags: 'not-array' }), res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['tags must be an array'] }),
      );
    });
  });

  describe('type: string', () => {
    const mw = validate([{ field: 'val', type: 'string' as const }]);

    it('passes with a string', () => {
      const next = jest.fn();
      mw(makeReq({ val: 'hello' }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('fails with a number', () => {
      const res = createMockResponse();
      const next = jest.fn();
      mw(makeReq({ val: 42 }), res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['val must be a string'] }),
      );
    });
  });

  describe('type: boolean', () => {
    const mw = validate([{ field: 'flag', type: 'boolean' as const }]);

    it('passes with a boolean', () => {
      const next = jest.fn();
      mw(makeReq({ flag: true }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('fails with a string', () => {
      const res = createMockResponse();
      mw(makeReq({ flag: 'yes' }), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['flag must be a boolean'] }),
      );
    });
  });

  describe('type: number', () => {
    const mw = validate([{ field: 'age', type: 'number' as const }]);

    it('passes with a number', () => {
      const next = jest.fn();
      mw(makeReq({ age: 30 }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('fails with a string', () => {
      const res = createMockResponse();
      mw(makeReq({ age: '30' }), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['age must be a number'] }),
      );
    });
  });

  describe('minLength / maxLength', () => {
    const mw = validate([{ field: 'bio', type: 'string' as const, minLength: 3, maxLength: 10 }]);

    it('passes when length is within bounds', () => {
      const next = jest.fn();
      mw(makeReq({ bio: 'hello' }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('fails when string is too short', () => {
      const res = createMockResponse();
      mw(makeReq({ bio: 'hi' }), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['bio must be at least 3 characters'] }),
      );
    });

    it('fails when string is too long', () => {
      const res = createMockResponse();
      mw(makeReq({ bio: 'this is way too long for the field' }), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['bio must be at most 10 characters'] }),
      );
    });
  });

  describe('pattern', () => {
    const mw = validate([
      { field: 'code', type: 'string' as const, pattern: /^\d{4}$/, message: 'Must be 4 digits' },
    ]);

    it('passes when pattern matches', () => {
      const next = jest.fn();
      mw(makeReq({ code: '1234' }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('fails when pattern does not match', () => {
      const res = createMockResponse();
      mw(makeReq({ code: 'abc' }), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['Must be 4 digits'] }),
      );
    });

    it('uses default message when pattern fails and no message provided', () => {
      const mwNoMsg = validate([{ field: 'code2', type: 'string' as const, pattern: /^\d+$/ }]);
      const res = createMockResponse();
      mwNoMsg(makeReq({ code2: 'abc' }), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['code2 format is invalid'] }),
      );
    });
  });

  describe('min / max (number)', () => {
    const mw = validate([{ field: 'score', type: 'number' as const, min: 0, max: 100 }]);

    it('passes when number is in range', () => {
      const next = jest.fn();
      mw(makeReq({ score: 50 }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('fails when number is below min', () => {
      const res = createMockResponse();
      mw(makeReq({ score: -1 }), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['score must be at least 0'] }),
      );
    });

    it('fails when number is above max', () => {
      const res = createMockResponse();
      mw(makeReq({ score: 101 }), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['score must be at most 100'] }),
      );
    });
  });

  describe('custom validator', () => {
    const mw = validate([
      {
        field: 'status',
        custom: (v) => ['ACTIVE', 'INACTIVE'].includes(v as string),
        message: 'Invalid status',
      },
    ]);

    it('passes when custom function returns true', () => {
      const next = jest.fn();
      mw(makeReq({ status: 'ACTIVE' }), createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('fails when custom function returns false', () => {
      const res = createMockResponse();
      mw(makeReq({ status: 'DELETED' }), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: ['Invalid status'] }),
      );
    });

    it('uses default message when custom fails and no message provided', () => {
      const mwNoMsg = validate([{ field: 'x', custom: () => false }]);
      const res = createMockResponse();
      mwNoMsg(makeReq({ x: 'anything' }), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors: ['x is invalid'] }));
    });
  });

  describe('multiple errors collected', () => {
    const mw = validate([
      { field: 'a', required: true },
      { field: 'b', required: true },
    ]);

    it('returns all errors at once', () => {
      const res = createMockResponse();
      mw(makeReq({}), res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining(['a is required', 'b is required']),
        }),
      );
    });
  });
});

// ── validateLogin ─────────────────────────────────────────────────────────────

describe('validateLogin', () => {
  it('passes with password only', () => {
    const next = jest.fn();
    validateLogin(makeReq({ password: 'secret123' }), createMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes with email + password', () => {
    const next = jest.fn();
    validateLogin(makeReq({ email: 'a@b.com', password: 'secret123' }), createMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes with identifier + password', () => {
    const next = jest.fn();
    validateLogin(
      makeReq({ identifier: '0812345678', password: 'secret123' }),
      createMockResponse(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fails when email is invalid', () => {
    const res = createMockResponse();
    validateLogin(makeReq({ email: 'not-an-email', password: 'secret123' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('fails when password is missing', () => {
    const res = createMockResponse();
    validateLogin(makeReq({ email: 'a@b.com' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('fails when password is too short', () => {
    const res = createMockResponse();
    validateLogin(makeReq({ password: 'abc' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining(['password must be at least 6 characters']),
      }),
    );
  });
});

// ── validateRegister ──────────────────────────────────────────────────────────

describe('validateRegister', () => {
  const validBase = {
    email: 'user@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe',
  };

  it('passes with valid required fields', () => {
    const next = jest.fn();
    validateRegister(makeReq(validBase), createMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes with valid optional gender', () => {
    const next = jest.fn();
    validateRegister(makeReq({ ...validBase, gender: 'MALE' }), createMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fails with invalid gender value', () => {
    const res = createMockResponse();
    validateRegister(makeReq({ ...validBase, gender: 'UNKNOWN' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['Gender must be MALE, FEMALE, or OTHER'] }),
    );
  });

  it('passes with valid phone number', () => {
    const next = jest.fn();
    validateRegister(makeReq({ ...validBase, phone: '0812345678' }), createMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fails with invalid phone number format', () => {
    const res = createMockResponse();
    validateRegister(makeReq({ ...validBase, phone: '123456789' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['Phone must be 10 digits starting with 0'] }),
    );
  });

  it('fails with missing email', () => {
    const res = createMockResponse();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email: _e, ...rest } = validBase;
    validateRegister(makeReq(rest), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('fails with invalid email format', () => {
    const res = createMockResponse();
    validateRegister(makeReq({ ...validBase, email: 'not-email' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['email must be a valid email'] }),
    );
  });

  it('fails with password too short', () => {
    const res = createMockResponse();
    validateRegister(makeReq({ ...validBase, password: 'short' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining(['password must be at least 8 characters']),
      }),
    );
  });
});

// ── validateOtpRequest ────────────────────────────────────────────────────────

describe('validateOtpRequest', () => {
  it('passes with valid email', () => {
    const next = jest.fn();
    validateOtpRequest(makeReq({ email: 'a@b.com' }), createMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fails when email is missing', () => {
    const res = createMockResponse();
    validateOtpRequest(makeReq({}), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('fails with invalid email format', () => {
    const res = createMockResponse();
    validateOtpRequest(makeReq({ email: 'bad' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['email must be a valid email'] }),
    );
  });
});

// ── validateOtpVerification ───────────────────────────────────────────────────

describe('validateOtpVerification', () => {
  it('passes with valid email and 6-digit code', () => {
    const next = jest.fn();
    validateOtpVerification(
      makeReq({ email: 'a@b.com', code: '123456' }),
      createMockResponse(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fails when code is too short', () => {
    const res = createMockResponse();
    validateOtpVerification(makeReq({ email: 'a@b.com', code: '123' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining(['code must be at least 6 characters']),
      }),
    );
  });

  it('fails when code is too long', () => {
    const res = createMockResponse();
    validateOtpVerification(makeReq({ email: 'a@b.com', code: '1234567' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining(['code must be at most 6 characters']),
      }),
    );
  });

  it('fails when email is missing', () => {
    const res = createMockResponse();
    validateOtpVerification(makeReq({ code: '123456' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('fails when code is missing', () => {
    const res = createMockResponse();
    validateOtpVerification(makeReq({ email: 'a@b.com' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('validateResetPassword', () => {
  it('passes with valid email, code, and newPassword', () => {
    const next = jest.fn();
    validateResetPassword(
      makeReq({ email: 'a@b.com', code: '123456', newPassword: 'StrongPass1' }),
      createMockResponse(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fails when newPassword is missing', () => {
    const res = createMockResponse();
    validateResetPassword(makeReq({ email: 'a@b.com', code: '123456' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('fails when newPassword is too short', () => {
    const res = createMockResponse();
    validateResetPassword(
      makeReq({ email: 'a@b.com', code: '123456', newPassword: 'short' }),
      res,
      jest.fn(),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining(['newPassword must be at least 8 characters']),
      }),
    );
  });
});

describe('validateCreateDevice', () => {
  it('accepts valid device serial and normalizes to uppercase', () => {
    const req = makeReq({ serialNumber: ' esp32-6c689bdaf380 ' });
    const res = createMockResponse();
    const next = jest.fn();

    validateCreateDevice(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toMatchObject({ serialNumber: 'ESP32-6C689BDAF380' });
  });

  it('rejects when serialNumber is missing', () => {
    const res = createMockResponse();

    validateCreateDevice(makeReq({}), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['serialNumber is required'] }),
    );
  });

  it('rejects when serialNumber length is incomplete', () => {
    const res = createMockResponse();

    validateCreateDevice(makeReq({ serialNumber: 'ESP32-1234' }), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: ['serialNumber must be exactly 18 characters in ESP32-XXXXXXXXXXXX format'],
      }),
    );
  });

  it('rejects when serialNumber does not match hexadecimal pattern', () => {
    const res = createMockResponse();

    validateCreateDevice(makeReq({ serialNumber: 'ESP32-ZZZZZZZZZZZZ' }), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          'serialNumber must match ESP32-XXXXXXXXXXXX (12 uppercase hexadecimal characters)',
        ],
      }),
    );
  });
});

// ── validateWiFiConfig ────────────────────────────────────────────────────────

describe('validateWiFiConfig', () => {
  it('accepts valid ssid/wifiPassword and normalizes ssid', () => {
    const req = makeReq({ ssid: '  HomeWiFi  ', wifiPassword: 'password123' });
    const res = createMockResponse();
    const next = jest.fn();

    validateWiFiConfig(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toMatchObject({ ssid: 'HomeWiFi', wifiPassword: 'password123' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects when wifiPassword is missing', () => {
    const req = makeReq({ ssid: 'HomeWiFi' });
    const res = createMockResponse();
    const next = jest.fn();

    validateWiFiConfig(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['wifiPassword is required'] }),
    );
  });

  it('rejects when ssid is missing', () => {
    const res = createMockResponse();
    const next = jest.fn();
    validateWiFiConfig(makeReq({ wifiPassword: 'password123' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['ssid is required'] }),
    );
  });

  it('rejects when ssid is a non-string type', () => {
    const res = createMockResponse();
    validateWiFiConfig(makeReq({ ssid: 123, wifiPassword: 'password123' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['ssid is required'] }),
    );
  });

  it('rejects when ssid is empty string (only whitespace)', () => {
    const res = createMockResponse();
    validateWiFiConfig(makeReq({ ssid: '   ', wifiPassword: 'password123' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['ssid is required'] }),
    );
  });

  it('rejects when ssid exceeds 32 characters', () => {
    const res = createMockResponse();
    validateWiFiConfig(
      makeReq({ ssid: 'a'.repeat(33), wifiPassword: 'password123' }),
      res,
      jest.fn(),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['ssid must be at most 32 characters'] }),
    );
  });

  it('rejects when wifiPassword exceeds 64 characters', () => {
    const res = createMockResponse();
    validateWiFiConfig(makeReq({ ssid: 'Net', wifiPassword: 'a'.repeat(65) }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['wifiPassword must be at most 64 characters'] }),
    );
  });

  it('rejects when wifiPassword is between 1 and 7 characters (below WPA2 minimum)', () => {
    const res = createMockResponse();
    validateWiFiConfig(makeReq({ ssid: 'Net', wifiPassword: 'short' }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: ['wifiPassword must be at least 8 characters or empty for open network'],
      }),
    );
  });

  it('accepts empty wifiPassword (open network)', () => {
    const next = jest.fn();
    validateWiFiConfig(makeReq({ ssid: 'OpenNet', wifiPassword: '' }), createMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('handles missing req.body gracefully', () => {
    const req = { body: undefined } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn();
    validateWiFiConfig(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: ['ssid is required'] }),
    );
  });
});
