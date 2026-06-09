// env.d.ts — ประกาศ Expo public env ที่ mobile ใช้งานจริง
// ใช้กับ config boundary เท่านั้น เพื่อให้จุดอ่าน env ชัดและปลอดภัยขึ้น

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_FORCE_PUBLIC?: 'true' | 'false';
      EXPO_PUBLIC_API_URL?: string;
      EXPO_PUBLIC_SOCKET_URL?: string;
    }
  }
}

export {};
