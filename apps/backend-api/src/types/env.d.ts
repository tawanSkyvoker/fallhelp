/**
 * env.d.ts
 *
 * Type declaration สำหรับ environment variables ของ backend
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ประกาศ key ใน process.env ให้ TypeScript รู้จัก
 * - ช่วยให้อ่าน env แบบ dot access ได้ปลอดภัยขึ้น
 * - ลดปัญหาจาก noPropertyAccessFromIndexSignature เมื่อต้องอ่าน config หลายจุด
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: string | undefined;
      PORT?: string | undefined;
      DATABASE_URL?: string | undefined;
      JWT_SECRET?: string | undefined;
      JWT_EXPIRES_IN?: string | undefined;
      MQTT_DISABLED?: string | undefined;
      MQTT_BROKER_URL?: string | undefined;
      MQTT_USERNAME?: string | undefined;
      MQTT_PASSWORD?: string | undefined;
      FRONTEND_URL?: string | undefined;
      ADMIN_URL?: string | undefined;
      API_BASE_URL?: string | undefined;
      LOG_LEVEL?: string | undefined;
      RESEND_API_KEY?: string | undefined;
      DISABLE_EMAIL?: string | undefined;
      EMAIL_FROM?: string | undefined;
      WIFI_CONFIGURING_STALE_MS?: string | undefined;
      MQTT_CONFIG_ACK_TIMEOUT_MS?: string | undefined;
      DEVICE_ONLINE_THRESHOLD_MS?: string | undefined;
      npm_package_version?: string | undefined;
    }
  }
}

export {};
