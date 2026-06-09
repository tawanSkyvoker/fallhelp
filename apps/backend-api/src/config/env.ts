/**
 * env.ts
 *
 * Env helper กลางของ backend
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมค่า default สำหรับ development
 * - อ่านและ parse ค่า process.env ให้อยู่ในรูปแบบที่ service ใช้ได้
 * - validate env สำคัญที่ต้องมี เช่น DATABASE_URL, JWT_SECRET และ ENCRYPTION_KEY
 * - รวมค่า config ของ HTTP, MQTT, Email, CORS และ device timing ไว้จุดเดียว
 */

export type BackendLogLevel = 'debug' | 'info' | 'warn' | 'error';

const DEFAULT_PORT = 3000;
const DEFAULT_FRONTEND_URL = 'http://localhost:8081';
const DEFAULT_ADMIN_URL = 'http://localhost:5173';
const DEFAULT_MQTT_BROKER_URL = 'mqtt://localhost:1883';
const DEFAULT_EMAIL_FROM = 'FallHelp <support@fallhelp.tawanlab.site>';

const DEVELOPMENT_ORIGIN_PREFIXES = [
  'http://localhost:',
  'http://127.0.0.1:',
  'http://192.168.',
  'http://10.',
  'exp://',
  'expo://',
] as const;

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const requireEnv = (key: keyof NodeJS.ProcessEnv, errorMessage?: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(errorMessage ?? `${String(key)} is required`);
  }

  return value;
};

const getNodeEnv = (): string => process.env.NODE_ENV ?? 'development';

const getAllowedOrigins = (): string[] => {
  // รวม origin ที่อนุญาตใน production สำหรับ Express CORS และ Socket.io
  const allowedOrigins = [
    process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL,
    process.env.ADMIN_URL || DEFAULT_ADMIN_URL,
    process.env.API_BASE_URL,
  ].filter((origin): origin is string => Boolean(origin));

  // เพิ่ม origin ที่มาจาก Cloudflare Tunnel หากมีการกำหนดไว้
  const tunnelHost = process.env['TUNNEL_PUBLIC_HOSTNAME'];
  if (tunnelHost) {
    allowedOrigins.push(`https://${tunnelHost}`);
    allowedOrigins.push(`http://${tunnelHost}`);
  }

  return Array.from(new Set(allowedOrigins));
};

const getLogLevel = (): BackendLogLevel => {
  const logLevel = process.env.LOG_LEVEL;

  if (logLevel === 'debug' || logLevel === 'info' || logLevel === 'warn' || logLevel === 'error') {
    return logLevel;
  }

  return getNodeEnv() === 'production' ? 'info' : 'debug';
};

export const backendEnv = {
  get raw(): NodeJS.ProcessEnv {
    return process.env;
  },

  get nodeEnv(): string {
    return getNodeEnv();
  },

  get isProduction(): boolean {
    return getNodeEnv() === 'production';
  },

  get isDevelopment(): boolean {
    return getNodeEnv() !== 'production';
  },

  get port(): number {
    return parsePositiveInt(process.env.PORT, DEFAULT_PORT);
  },

  get databaseUrl(): string {
    // ไม่มี DATABASE_URL ให้ fail ตั้งแต่ startup เพื่อไม่ให้ backend รันแบบต่อ DB ไม่ได้
    return requireEnv('DATABASE_URL', 'DATABASE_URL is required');
  },

  get jwtSecret(): string {
    // JWT_SECRET เป็นค่าบังคับ เพราะใช้ verify/sign token ทั้งระบบ auth
    return requireEnv(
      'JWT_SECRET',
      'FATAL: JWT_SECRET environment variable is required but not set',
    );
  },

  get jwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN || '7d';
  },

  get encryptionKey(): string {
    return requireEnv('ENCRYPTION_KEY', 'ENCRYPTION_KEY is required and must be 32 characters');
  },

  get mqttDisabled(): boolean {
    return process.env.MQTT_DISABLED === 'true';
  },

  get mqttBrokerUrl(): string {
    return process.env.MQTT_BROKER_URL || DEFAULT_MQTT_BROKER_URL;
  },

  get mqttUsername(): string | undefined {
    return process.env.MQTT_USERNAME || undefined;
  },

  get mqttPassword(): string | undefined {
    return process.env.MQTT_PASSWORD || undefined;
  },

  get frontendUrl(): string {
    return process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  },

  get adminUrl(): string {
    return process.env.ADMIN_URL || DEFAULT_ADMIN_URL;
  },

  get apiBaseUrl(): string | undefined {
    return process.env.API_BASE_URL || undefined;
  },

  get tunnelPublicHostname(): string | undefined {
    return process.env['TUNNEL_PUBLIC_HOSTNAME'] || undefined;
  },

  get allowedOrigins(): string[] {
    return getAllowedOrigins();
  },

  isKnownDevelopmentOrigin(origin: string): boolean {
    // development อนุญาต localhost, LAN IP และ Expo scheme เพื่อให้ทดสอบ mobile ได้สะดวก
    return DEVELOPMENT_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix));
  },

  get logLevel(): BackendLogLevel {
    return getLogLevel();
  },

  get resendApiKey(): string | undefined {
    return process.env.RESEND_API_KEY || undefined;
  },

  get disableEmail(): boolean {
    return process.env.DISABLE_EMAIL === 'true';
  },

  get emailFrom(): string {
    return process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
  },

  get wifiConfiguringStaleMs(): number {
    // เวลาที่ WiFi CONFIGURING ค้างได้ก่อนถือว่า stale
    return parsePositiveInt(process.env.WIFI_CONFIGURING_STALE_MS, 120000);
  },

  get mqttConfigAckTimeoutMs(): number {
    // timeout สำหรับรอ config ACK จาก ESP32
    return parsePositiveInt(process.env.MQTT_CONFIG_ACK_TIMEOUT_MS, 15000);
  },

  get deviceOnlineThresholdMs(): number {
    // freshness window สำหรับตีความ lastOnline เป็น online
    return parsePositiveInt(process.env.DEVICE_ONLINE_THRESHOLD_MS, 15000);
  },

  get packageVersion(): string {
    return process.env.npm_package_version || '1.0.0';
  },
};
