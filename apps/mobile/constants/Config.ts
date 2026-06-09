/**
 * Config.ts
 *
 * คำนวณ API_URL และ SOCKET_URL สำหรับ mobile app
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - อ่านค่า environment จาก env.ts
 * - เลือก URL ให้เหมาะกับ dev client หรือ production build
 * - สร้าง socket URL จาก API URL หรือค่าที่ override มา
 * - validate config ก่อนให้แอปเริ่มใช้งานจริง
 */

import { mobileEnv } from './env';
import { validateAndLogConfig } from './configValidator';
import Logger from '../utils/logger';

// โหมดรัน: Dev Client ใช้ local IP ได้ ส่วน build จริงต้องยึด public URL
const isDevelopment = mobileEnv.isDevelopment;

const getLocalUrl = (): string | null => {
  const hostUri = mobileEnv.hostUri;

  if (hostUri) {
    // ดึง IP ของเครื่อง dev จาก Expo hostUri แล้วต่อ port backend local
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3000`;
  }

  return null;
};

const resolveApiUrl = () => {
  if (isDevelopment) {
    if (mobileEnv.forcePublic) {
      Logger.debug('[Config] Dev Client: Force Public Mode Active');
      return mobileEnv.publicApiUrl;
    }

    const localUrl = getLocalUrl();

    if (localUrl) {
      Logger.debug('[Config] Dev Client: Using Auto-detected Local IP:', localUrl);
      return localUrl;
    }
  }

  // Production และ dev ที่หา local URL ไม่ได้ จะ fallback ไป public API
  return mobileEnv.publicApiUrl;
};

const API_URL = resolveApiUrl();

// Socket URL ใช้ root ของ server เพราะ socket.io ไม่ต่อ /api
const resolveSocketUrl = (): string => {
  const apiRoot = API_URL.replace(/\/api\/?$/, '');

  if (isDevelopment && !mobileEnv.forcePublic && API_URL.startsWith('http://')) {
    Logger.debug('[Config] Dev Client: Using API-matched local Socket URL:', apiRoot);
    return apiRoot;
  }

  return mobileEnv.socketUrlOverride || apiRoot;
};

const SOCKET_URL = resolveSocketUrl();

Logger.info('[Config] 🌐 API Endpoint:', API_URL);
Logger.info('[Config] ⚡ Socket Endpoint:', SOCKET_URL);
Logger.info(
  '[Config] 📱 Environment:',
  isDevelopment ? 'Development Client' : 'Standalone (Production)',
);

const REQUEST_TIMEOUT = 10000;

export const CONFIG = {
  API_URL,
  SOCKET_URL,
  REQUEST_TIMEOUT,
};

// ตรวจสอบ config ตอน startup ถ้าค่าหลักผิดจะ throw เพื่อไม่ให้แอปทำงานต่อด้วย config ที่เสีย
validateAndLogConfig(CONFIG);
