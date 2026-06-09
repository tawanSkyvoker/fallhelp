/**
 * errorHelper Utility Tests
 * Tests: API error parsing, HTTP status mapping, network error fallbacks
 */
import { getErrorMessage, showErrorMessage } from '../../utils/errorHelper';
import Logger from '../../utils/logger';
import { showDialog } from '../../utils/dialogService';

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
}));

jest.mock('../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

describe('errorHelper utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getErrorMessage', () => {
    it('should return message from response.data.error.message if available', () => {
      const error = {
        response: {
          data: {
            error: { code: 'some_code', message: 'Backend error message' },
          },
        },
      };
      expect(getErrorMessage(error)).toBe('Backend error message');
    });

    it('should return string from response.data.error if it contains text', () => {
      const error = {
        response: {
          data: {
            error: 'ข้อผิดพลาดแบบเก่า',
          },
        },
      };
      expect(getErrorMessage(error)).toBe('ข้อผิดพลาดแบบเก่า');
    });

    it('should return fallback message based on HTTP status if no message in data', () => {
      const error401 = { response: { status: 401 } };
      expect(getErrorMessage(error401)).toBe('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');

      const error403 = { response: { status: 403 } };
      expect(getErrorMessage(error403)).toBe('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');

      const error404 = { response: { status: 404 } };
      expect(getErrorMessage(error404)).toBe('ไม่พบข้อมูลที่ร้องขอ');

      const error409 = { response: { status: 409 } };
      expect(getErrorMessage(error409)).toBe('ข้อมูลซ้ำกับที่มีอยู่แล้ว');

      const error500 = { response: { status: 500 } };
      expect(getErrorMessage(error500)).toBe('เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');

      const errorUnknown = { response: { status: 418 } };
      expect(getErrorMessage(errorUnknown)).toBe(
        'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
      );
    });

    it('should return message directly if it is a Thai string', () => {
      const error = new Error('มีบางอย่างผิดพลาด');
      expect(getErrorMessage(error)).toBe('มีบางอย่างผิดพลาด');
    });

    it('should return network error fallback for ERR_NETWORK code', () => {
      const error = { message: 'Network Error', code: 'ERR_NETWORK' };
      expect(getErrorMessage(error)).toBe(
        'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต',
      );
    });

    it('should return timeout error fallback for ECONNABORTED code', () => {
      const error = { message: 'timeout of 5000ms exceeded', code: 'ECONNABORTED' };
      expect(getErrorMessage(error)).toBe('การเชื่อมต่อหมดเวลา กรุณาลองใหม่อีกครั้ง');
    });

    it('should return generic error message for unknown errors', () => {
      expect(getErrorMessage(null)).toBe('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      expect(getErrorMessage(undefined)).toBe('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      expect(getErrorMessage('just a string')).toBe('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      expect(getErrorMessage({ some: 'object' })).toBe('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });

  describe('showErrorMessage', () => {
    it('should log error and show dialog with translated message', () => {
      const title = 'เข้าสู่ระบบล้มเหลว';
      const error = { response: { status: 401 } };

      showErrorMessage(title, error);

      expect(Logger.error).toHaveBeenCalledWith(`${title}:`, error);
      expect(showDialog).toHaveBeenCalledWith(title, 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    });
  });
});
