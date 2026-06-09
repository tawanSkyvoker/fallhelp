/**
 * api.ts
 *
 * API client กลางของ Admin Panel
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - สร้าง Axios instance ด้วย API URL จาก environment
 * - validate config ก่อนเริ่มยิง request
 * - แนบ JWT token จาก sessionStorage ให้ทุก request
 * - log request/response เฉพาะตอน development
 * - จัดการ 401 กลางด้วย event fallhelp:unauthorized
 */

import axios, { type AxiosRequestConfig } from "axios";

import { adminEnv } from "../config/env";
import Logger from "../utils/logger";
import { validateAndLogConfig } from "../utils/configValidator";

type RequestMetadata = {
  startTime: number;
};

type RequestConfigWithMeta<TConfig extends AxiosRequestConfig = AxiosRequestConfig> = TConfig & {
  metadata?: RequestMetadata;
};

const API_URL = adminEnv.apiUrl;

// ตรวจ API_URL ตั้งแต่ตอนสร้าง client เพื่อให้พังเร็วถ้า config ผิด
validateAndLogConfig({ API_URL }, { isProd: adminEnv.isProd });

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const configWithMeta = config as RequestConfigWithMeta<typeof config>;

    // เก็บเวลาเริ่ม request ไว้คำนวณ duration ใน response interceptor
    configWithMeta.metadata = { startTime: performance.now() };

    if (adminEnv.isDev) {
      Logger.debug("[API Request]", {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params,
      });
    }

    const token = sessionStorage.getItem("token");

    // แนบ Bearer token ให้ endpoint ที่ต้องผ่าน authenticate
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return configWithMeta;
  },
  (error) => {
    Logger.error("API Request Error", error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    const configWithMeta = response.config as RequestConfigWithMeta<typeof response.config>;
    const duration =
      configWithMeta.metadata?.startTime !== undefined
        ? performance.now() - configWithMeta.metadata.startTime
        : null;

    if (adminEnv.isDev) {
      Logger.debug("[API Response]", {
        method: response.config.method?.toUpperCase(),
        url: response.config.url,
        status: response.status,
        durationMs: duration !== null && !Number.isNaN(duration) ? Math.round(duration) : undefined,
      });
    }

    return response;
  },
  (error) => {
    const configWithMeta = (error.config || {}) as RequestConfigWithMeta<typeof error.config>;
    const duration =
      configWithMeta.metadata?.startTime !== undefined
        ? performance.now() - configWithMeta.metadata.startTime
        : null;

    if (adminEnv.isDev) {
      Logger.error("API Response Error", {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status: error.response?.status,
        durationMs: duration !== null && !Number.isNaN(duration) ? Math.round(duration) : undefined,
      });
    }

    const requestUrl = error.config?.url || "";
    const isAuthLogin =
      requestUrl.includes("/auth/login") || requestUrl.includes("/auth/admin-login");

    // token หมดอายุหรือไม่ถูกต้อง ให้ล้าง session และแจ้ง AuthContext จัดการต่อ
    if (error.response?.status === 401 && !isAuthLogin) {
      sessionStorage.removeItem("token");
      window.dispatchEvent(new Event("fallhelp:unauthorized"));
    } else {
      Logger.error(
        `API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        error.response?.data || error.message
      );
    }

    return Promise.reject(error);
  }
);

export default api;
