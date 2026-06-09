/**
 * usePushNotifications.ts
 *
 * Hook สำหรับจัดการ lifecycle ของ Expo Push Notification token
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ขอ permission และสร้าง Expo Push Token
 * - ตั้งค่า notification channel สำหรับ Android
 * - ส่ง push token ไป backend หลัง login สำเร็จ
 * - รับ notification ตอน foreground และอัปเดต unread badge ทันที
 * - รับ event ตอนผู้ใช้แตะ notification แล้ว sync รายการแจ้งเตือนกับ server
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext';
import { updatePushToken } from '../services';
import Logger from '../utils/logger';
import { queryKeys } from './queryKeys';

const resolveProjectId = () => {
  const extra = Constants.expoConfig?.extra;
  const eas =
    extra && typeof extra === 'object' && !Array.isArray(extra)
      ? (extra['eas'] as Record<string, unknown> | undefined)
      : undefined;

  // อ่าน projectId จาก expo extra ก่อน แล้ว fallback ไป easConfig
  const projectIdFromExtra = typeof eas?.['projectId'] === 'string' ? eas['projectId'] : undefined;
  return projectIdFromExtra ?? Constants.easConfig?.projectId;
};

const getNotificationLogPayload = (notification: Notifications.Notification) => {
  const { content, identifier } = notification.request;

  return {
    id: identifier,
    date: notification.date,
    title: content.title,
    body: content.body,
    data: content.data,
  };
};

const getNotificationResponseLogPayload = (response: Notifications.NotificationResponse) => {
  const { content, identifier } = response.notification.request;

  return {
    actionIdentifier: response.actionIdentifier,
    notification: {
      id: identifier,
      date: response.notification.date,
      title: content.title,
      body: content.body,
      data: content.data,
    },
  };
};

// กำหนดพฤติกรรมตอนแอปอยู่ foreground ให้ยังแสดง notification เหมือนระบบปกติ
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationState {
  expoPushToken: string | undefined;
  notification: Notifications.Notification | undefined;
  error: Error | undefined;
}

export const usePushNotifications = (enabled = true): PushNotificationState => {
  const queryClient = useQueryClient();

  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const [error, setError] = useState<Error | undefined>();

  const { isSignedIn } = useAuth();

  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  // จำ token ล่าสุดที่ส่งไป backend แล้ว เพื่อกันส่งซ้ำถ้า token ยังไม่เปลี่ยน
  const lastSentTokenRef = useRef<string | null>(null);

  const savePushToken = async (token: string) => {
    try {
      Logger.debug('Saving push token to backend:', token.substring(0, 24));

      // ส่ง Expo push token ไป backend เพื่อให้ server ใช้ส่ง fallback notification
      // ไฟล์ถัดไป: services/index.ts
      await updatePushToken({ pushToken: token });

      lastSentTokenRef.current = token;
      Logger.info('Push token saved to backend');
    } catch (err: unknown) {
      // ข้าม error ที่คาดได้ตอน startup เช่นยังไม่ login หรือ backend ยังไม่พร้อม
      const error = err as { status?: number; response?: { status?: number }; message?: string };
      const status = error?.status || error?.response?.status;
      const message = error?.message || '';

      const isUnauthorized =
        status === 401 || message.includes('401') || JSON.stringify(err).includes('401');

      const isNetworkError =
        message.includes('Network Error') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ENOTFOUND') ||
        message.includes('timeout');

      if (!isUnauthorized && !isNetworkError) {
        Logger.error('Failed to save push token to backend:', err);
      } else if (isNetworkError) {
        Logger.debug('Push token save skipped: Backend not reachable');
      } else {
        Logger.debug('Push token save skipped: User not authenticated (401)');
      }
    }
  };

  const registerForPushNotificationsAsync = useCallback(async () => {
    let token;

    if (Platform.OS === 'android') {
      // Android ต้องสร้าง notification channel ก่อน จึงจะส่ง push ได้ถูกต้อง
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      Logger.debug('Push notifications: checking permissions');

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      Logger.debug('Push notifications permission status:', { existingStatus });

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;

        Logger.debug('Push notifications permission requested:', { finalStatus });
      }

      if (finalStatus !== 'granted') {
        Logger.warn('Push notifications permission not granted');
        throw new Error('Permission not granted for push notifications');
      }

      const projectId = resolveProjectId();

      if (!projectId) {
        Logger.error('Project ID not found for Expo Push Notifications');
        throw new Error('Project ID not found');
      }

      Logger.debug('Expo projectId for push:', projectId);

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      Logger.info('Expo Push Token:', token);
    } else {
      Logger.warn('Must use physical device for Push Notifications');
    }

    return token;
  }, []);

  const updateUnreadCacheOnNotificationReceived = useCallback(() => {
    if (!isSignedIn) return;

    // เพิ่ม unread count ใน cache ทันที เพื่อให้จุดแดงบนกระดิ่งขึ้นทันที
    queryClient.setQueryData(queryKeys.unreadCount(), (oldCount: number | undefined) => {
      return (oldCount ?? 0) + 1;
    });

    // ให้รายการใน NotificationModal sync กับ server เมื่อเปิด modal หรือ refetch รอบถัดไป
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
  }, [isSignedIn, queryClient]);

  const syncNotificationQueries = useCallback(() => {
    if (!isSignedIn) return;

    // ใช้ตอนผู้ใช้แตะ notification หรือกลับเข้าแอป เพื่อดึงสถานะจริงจาก server
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
  }, [isSignedIn, queryClient]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // ลงทะเบียน push token เมื่อ hook ถูกเปิดใช้งาน
    registerForPushNotificationsAsync()
      .then((token) => setExpoPushToken(token))
      .catch((error: Error) => {
        Logger.error('Failed to register push notifications:', error);
        setError(error);
      });

    // รับ notification ตอน app อยู่ foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      Logger.debug('Notification received:', getNotificationLogPayload(notification));
      setNotification(notification);

      // อัปเดต badge unread ทันทีโดยไม่ต้องรอ Dashboard refetch
      updateUnreadCacheOnNotificationReceived();
    });

    // รับ event เมื่อผู้ใช้แตะ notification เพื่อเปิดหรือกลับเข้าแอป
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      Logger.debug('Notification tapped:', getNotificationResponseLogPayload(response));

      const data = response.notification.request.content.data;
      Logger.debug('Notification data:', data);

      // ผู้ใช้กลับเข้าแอปจาก notification แล้ว ให้ sync unread/list กับ server
      syncNotificationQueries();
    });

    return () => {
      // ลบ listener เมื่อ unmount เพื่อกัน callback ค้างหลังออกจาก provider
      if (notificationListener.current) {
        notificationListener.current.remove();
      }

      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [
    enabled,
    registerForPushNotificationsAsync,
    updateUnreadCacheOnNotificationReceived,
    syncNotificationQueries,
  ]);

  useEffect(() => {
    if (!enabled || !isSignedIn || !expoPushToken) {
      return;
    }

    if (lastSentTokenRef.current === expoPushToken) {
      return;
    }

    // sync token ไป backend หลัง login แล้วเท่านั้น เพื่อกัน 401 ตอน app เพิ่งเปิด
    void savePushToken(expoPushToken);
  }, [enabled, expoPushToken, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      // logout แล้ว reset guard เพื่อให้ login ครั้งถัดไปส่ง token ได้ใหม่
      lastSentTokenRef.current = null;
    }
  }, [isSignedIn]);

  return {
    expoPushToken,
    notification,
    error,
  };
};
