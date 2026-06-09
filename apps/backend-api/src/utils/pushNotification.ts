/**
 * pushNotification.ts
 *
 * Utility สำหรับส่ง Push Notification ผ่าน Expo Push API
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจรูปแบบ Expo Push Token ก่อนส่ง
 * - สร้าง payload สำหรับ Expo Push API
 * - ส่ง notification ไปยังอุปกรณ์ผ่าน endpoint ของ Expo
 * - คืน true/false แทนการ throw เพื่อให้ push เป็น side effect เสริม
 */

import createDebug from 'debug';

const log = createDebug('fallhelp:push');

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const isExpoPushToken = (token: string): boolean =>
  token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');

export const sendNotification = async (
  expoPushToken: string,
  payload: NotificationPayload,
): Promise<boolean> => {
  try {
    if (!expoPushToken || !isExpoPushToken(expoPushToken)) {
      log('[Expo Push] Invalid token format: %s', expoPushToken);
      return false;
    }

    const message = {
      to: expoPushToken,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    const resultData = result?.data;
    const firstResult = Array.isArray(resultData) ? resultData[0] : resultData;

    if (firstResult?.status === 'ok') {
      // ไม่ log push token เพราะถือเป็น device identifier
      log('[Expo Push] ✅ Notification sent successfully');
      return true;
    } else {
      log('[Expo Push] ❌ Failed to send: %O', result);
      return false;
    }
  } catch (error) {
    // push notification เป็น side effect เสริม จึงคืน false แทนการ throw
    log('[Expo Push] Error sending notification: %O', error);
    return false;
  }
};
