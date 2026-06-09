/**
 * ApiError.ts
 *
 * โครงสร้าง Error มาตรฐานของ FallHelp API
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด error code ที่ backend ใช้ตอบกลับ client
 * - map error code เป็นข้อความภาษาไทย/อังกฤษและ HTTP status
 * - สร้าง ApiError class สำหรับ error ที่คาดการณ์ได้
 * - รวม factory createError เพื่อให้ service/controller เรียกใช้ error ได้สั้นลง
 */

export type ErrorCode =
  | 'validation_error'
  | 'invalid_input'
  | 'missing_required_field'
  | 'invalid_email_format'
  | 'invalid_phone_format'
  | 'password_too_short'
  | 'password_mismatch'
  | 'invalid_push_token'
  | 'missing_token'
  | 'invalid_token'
  | 'session_expired'
  | 'invalid_credentials'
  | 'current_password_incorrect'
  | 'access_denied'
  | 'role_not_allowed'
  | 'user_not_found'
  | 'elder_not_found'
  | 'device_not_found'
  | 'device_not_paired'
  | 'otp_not_found'
  | 'resource_not_found'
  | 'event_not_found'
  | 'notification_not_found'
  | 'email_already_exists'
  | 'phone_already_exists'
  | 'device_already_paired'
  | 'event_already_cancelled'
  | 'otp_expired'
  | 'otp_invalid'
  | 'invalid_event_type'
  | 'rate_limit_exceeded'
  | 'internal_server_error'
  | 'email_send_failed'
  | 'database_error';

export const ErrorMessages: Record<ErrorCode, { th: string; en: string }> = {
  validation_error: {
    th: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง',
    en: 'Invalid data. Please check and try again.',
  },
  invalid_input: {
    th: 'รูปแบบข้อมูลไม่ถูกต้อง',
    en: 'Invalid input format.',
  },
  missing_required_field: {
    th: 'กรุณากรอกข้อมูลให้ครบถ้วน',
    en: 'Please fill in all required fields.',
  },
  invalid_email_format: {
    th: 'รูปแบบอีเมลไม่ถูกต้อง',
    en: 'Invalid email format.',
  },
  invalid_phone_format: {
    th: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง',
    en: 'Invalid phone number format.',
  },
  password_too_short: {
    th: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
    en: 'Password must be at least 6 characters.',
  },
  password_mismatch: {
    th: 'รหัสผ่านไม่ตรงกัน',
    en: 'Passwords do not match.',
  },
  invalid_push_token: {
    th: 'รูปแบบ Push Token ไม่ถูกต้อง',
    en: 'Invalid Push Token format.',
  },
  missing_token: {
    th: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
    en: 'Please login to continue.',
  },
  invalid_token: {
    th: 'Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
    en: 'Invalid token. Please login again.',
  },
  session_expired: {
    th: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
    en: 'Session expired. Please login again.',
  },
  invalid_credentials: {
    th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    en: 'Invalid email or password.',
  },
  current_password_incorrect: {
    th: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
    en: 'Current password is incorrect.',
  },
  access_denied: {
    th: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้',
    en: 'Access denied.',
  },
  role_not_allowed: {
    th: 'บัญชีประเภทนี้ไม่สามารถใช้ฟังก์ชันนี้ได้',
    en: 'This account type cannot use this function.',
  },
  user_not_found: {
    th: 'ไม่พบผู้ใช้ในระบบ กรุณาตรวจสอบอีเมลอีกครั้ง',
    en: 'User not found. Please check your email.',
  },
  elder_not_found: {
    th: 'ไม่พบข้อมูลผู้สูงอายุ',
    en: 'Elder not found.',
  },
  device_not_found: {
    th: 'ไม่พบอุปกรณ์ในระบบ',
    en: 'Device not found.',
  },
  device_not_paired: {
    th: 'อุปกรณ์ยังไม่ได้จับคู่กับผู้สูงอายุ',
    en: 'Device is not paired.',
  },
  otp_not_found: {
    th: 'ไม่พบรหัส OTP หรือรหัสหมดอายุแล้ว',
    en: 'OTP not found or expired.',
  },
  resource_not_found: {
    th: 'ไม่พบข้อมูลที่ร้องขอ',
    en: 'Resource not found.',
  },
  event_not_found: {
    th: 'ไม่พบเหตุการณ์ที่ระบุ',
    en: 'Event not found.',
  },
  notification_not_found: {
    th: 'ไม่พบการแจ้งเตือน',
    en: 'Notification not found.',
  },
  email_already_exists: {
    th: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น',
    en: 'Email already exists. Please use another email.',
  },
  phone_already_exists: {
    th: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว กรุณาใช้หมายเลขอื่น',
    en: 'Phone number already exists.',
  },
  device_already_paired: {
    th: 'อุปกรณ์นี้ถูกเชื่อมต่อกับผู้ใช้อื่นแล้ว',
    en: 'Device is already paired with another user.',
  },
  event_already_cancelled: {
    th: 'เหตุการณ์นี้ถูกยกเลิกไปแล้ว',
    en: 'Event has already been cancelled.',
  },
  otp_expired: {
    th: 'รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่',
    en: 'OTP has expired. Please request a new one.',
  },
  otp_invalid: {
    th: 'รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
    en: 'Invalid OTP. Please check and try again.',
  },
  invalid_event_type: {
    th: 'ประเภทเหตุการณ์ไม่รองรับการดำเนินการนี้',
    en: 'This event type does not support this action.',
  },
  rate_limit_exceeded: {
    th: 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่',
    en: 'Too many requests. Please wait and try again.',
  },
  internal_server_error: {
    th: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง',
    en: 'Server error. Please try again later.',
  },
  email_send_failed: {
    th: 'ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่อีกครั้ง',
    en: 'Failed to send email. Please try again.',
  },
  database_error: {
    th: 'เกิดข้อผิดพลาดในการเข้าถึงฐานข้อมูล',
    en: 'Database error occurred.',
  },
};

export const ErrorStatusCodes: Record<ErrorCode, number> = {
  validation_error: 400,
  invalid_input: 400,
  missing_required_field: 400,
  invalid_email_format: 400,
  invalid_phone_format: 400,
  password_too_short: 400,
  password_mismatch: 400,
  invalid_push_token: 400,
  missing_token: 401,
  invalid_token: 401,
  session_expired: 401,
  invalid_credentials: 401,
  current_password_incorrect: 401,
  access_denied: 403,
  role_not_allowed: 403,
  user_not_found: 404,
  elder_not_found: 404,
  device_not_found: 404,
  device_not_paired: 404,
  otp_not_found: 404,
  resource_not_found: 404,
  event_not_found: 404,
  notification_not_found: 404,
  email_already_exists: 409,
  phone_already_exists: 409,
  device_already_paired: 409,
  event_already_cancelled: 409,
  otp_expired: 422,
  otp_invalid: 422,
  invalid_event_type: 422,
  rate_limit_exceeded: 429,
  internal_server_error: 500,
  email_send_failed: 500,
  database_error: 500,
};

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly messageTh: string;
  public readonly messageEn: string;
  public readonly isOperational: boolean;

  constructor(code: ErrorCode, customMessage?: string) {
    const messages = ErrorMessages[code];
    const statusCode = ErrorStatusCodes[code];

    super(customMessage || messages.en);

    this.code = code;
    this.statusCode = statusCode;
    this.messageTh = customMessage || messages.th;
    this.messageEn = customMessage || messages.en;
    this.isOperational = true;

    // เก็บ stack trace ไว้ช่วย debug โดยตัด constructor frame ออก
    Error.captureStackTrace(this, this.constructor);
  }

  toResponse(lang: 'th' | 'en' = 'th') {
    return {
      success: false,
      error: {
        code: this.code,
        message: lang === 'th' ? this.messageTh : this.messageEn,
        statusCode: this.statusCode,
      },
    };
  }
}

export const createError = {
  userNotFound: () => new ApiError('user_not_found'),
  invalidToken: () => new ApiError('invalid_token'),
  invalidCredentials: () => new ApiError('invalid_credentials'),
  sessionExpired: () => new ApiError('session_expired'),
  accessDenied: () => new ApiError('access_denied'),
  roleNotAllowed: (role: string) =>
    new ApiError('role_not_allowed', `บัญชีประเภท ${role} ไม่สามารถใช้ฟังก์ชันนี้ได้`),
  currentPasswordIncorrect: () => new ApiError('current_password_incorrect'),

  otpNotFound: () => new ApiError('otp_not_found'),
  otpExpired: () => new ApiError('otp_expired'),
  otpInvalid: () => new ApiError('otp_invalid'),

  elderNotFound: () => new ApiError('elder_not_found'),

  deviceNotFound: () => new ApiError('device_not_found'),
  deviceNotPaired: () => new ApiError('device_not_paired'),
  deviceAlreadyPaired: () => new ApiError('device_already_paired'),

  eventNotFound: () => new ApiError('event_not_found'),
  eventAlreadyCancelled: () => new ApiError('event_already_cancelled'),
  invalidEventType: () => new ApiError('invalid_event_type'),

  notificationNotFound: () => new ApiError('notification_not_found'),

  resourceNotFound: () => new ApiError('resource_not_found'),

  emailExists: () => new ApiError('email_already_exists'),
  phoneExists: () => new ApiError('phone_already_exists'),

  serverError: () => new ApiError('internal_server_error'),
  emailFailed: () => new ApiError('email_send_failed'),

  validationError: (message: string) => new ApiError('validation_error', message),
  missingField: (field: string) => new ApiError('missing_required_field', `กรุณากรอก ${field}`),
  invalidPushToken: () => new ApiError('invalid_push_token'),
};
