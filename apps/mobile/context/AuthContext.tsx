/**
 * AuthContext.tsx
 *
 * จัดการสถานะ auth, JWT token lifecycle และผลข้างเคียงของ signIn/signOut
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ถือสถานะว่าผู้ใช้ล็อกอินอยู่หรือไม่
 * - bootstrap สถานะ auth จาก token หรือ initialSignedIn
 * - บันทึก token ตอน signIn
 * - เคลียร์ store, cache และ token ที่ผูกกับ session ตอน signOut
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

import { runAfterKeyboardDismiss } from '../utils/keyboard';
import { getToken, setToken } from '../services/tokenStorage';
import { logout as logoutFromBackend } from '../services/authService';
import Logger from '../utils/logger';
import {
  clearAllSetupForCurrentUser,
  clearScopeCache,
  clearBootCache,
} from '../utils/setupStorage';
import { useDeviceSetupStore } from '../store/useDeviceSetupStore';
import { useSensorStore } from '../store/useSensorStore';
import { useFallAlertStore } from '../store/useFallAlertStore';

interface AuthContextType {
  isSignedIn: boolean;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
  // สถานะ auth ที่ root layout resolve ไว้ล่วงหน้าจาก boot cache
  initialSignedIn?: boolean;
}

export const AuthProvider = ({ children, initialSignedIn }: AuthProviderProps) => {
  // isSignedIn ใช้ให้ route guard ตัดสินใจว่าจะพาผู้ใช้ไปหน้า login หรือหน้าในแอป
  const [isSignedIn, setIsSignedIn] = useState(initialSignedIn ?? false);

  // isLoading ใช้กัน route guard ทำงานก่อนรู้สถานะ auth จริง
  const [isLoading, setIsLoading] = useState(initialSignedIn === undefined);

  useEffect(() => {
    // ถ้า root layout ส่ง initialSignedIn มาแล้ว ไม่ต้องอ่าน token ซ้ำ
    if (initialSignedIn !== undefined) return;

    const bootstrap = async () => {
      try {
        // อ่าน JWT token จาก storage เพื่อ restore session ตอนเปิดแอป
        // ไฟล์ถัดไป: services/tokenStorage.ts
        const token = await getToken();

        Logger.info('Auth Bootstrap: Token retrieval result', { hasToken: !!token });
        setIsSignedIn(!!token);
      } catch (e) {
        Logger.error('Auth bootstrap error', e);
        setIsSignedIn(false);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, [initialSignedIn]);

  const signIn = async (token: string) => {
    // ล้าง boot cache ก่อน เพื่อให้ route guard คำนวณ route ใหม่จาก session ปัจจุบัน
    clearBootCache();

    // บันทึก JWT token หลัง login สำเร็จ
    // ไฟล์ถัดไป: services/tokenStorage.ts
    await setToken(token);

    setIsSignedIn(true);
  };

  const signOut = async () => {
    Logger.info('AuthContext: Initiating signOut');

    // ใช้ runAfterKeyboardDismiss เพื่อให้คีย์บอร์ดหุบลงเสร็จสมบูรณ์ก่อนเปลี่ยน Auth State
    // ป้องกันข้อผิดพลาด viewIsDescendantOf noop บน Android เมื่อ TextInput ถูก Unmount ขณะย่อแป้นพิมพ์
    // และหากไม่มีคีย์บอร์ดเปิดอยู่ กลไกนี้จะประมวลผลทันที (0ms delay) เพื่อความลื่นไหลสูงสุด
    runAfterKeyboardDismiss(
      async () => {
        // เปลี่ยน auth state ทันทีเพื่อลดอาการค้างก่อน redirect ไปหน้า login
        setIsSignedIn(false);

        // เคลียร์ runtime store ทันที เพื่อกัน UI แว๊บใช้ state ของผู้ใช้เดิมก่อน route guard ทำงาน
        useDeviceSetupStore.getState().clearConfig();
        useSensorStore.getState().resetSensorState();
        useFallAlertStore.getState().resetFallAlertState();

        // ล้าง cache ที่ผูกกับ session เดิม เพื่อให้ login รอบถัดไปเริ่มจาก state ใหม่
        clearScopeCache();
        clearBootCache();

        try {
          // ล้างข้อมูล setup ทั้งหมดของ session นี้ รวมถึง setupStep ที่อาจค้างอยู่
          // ไฟล์ถัดไป: utils/setupStorage.ts
          await clearAllSetupForCurrentUser();
        } catch (error) {
          Logger.warn('Failed to clear setup data on signout', error);
        }

        // เรียก backend logout และให้ service ล้าง token ในเครื่องเสมอผ่าน finally
        // ไม่ต้อง await เพื่อให้ UI ตอบสนองและเริ่ม navigation ได้ทันที
        // ไฟล์ถัดไป: services/authService.ts
        logoutFromBackend().catch((error) => {
          Logger.warn('Background backend logout failed', error);
        });

        Logger.info('AuthContext: signOut state transition complete');
      },
      {
        waitAfterHideMs: 100, // รอให้อินพุตเคลียร์ความสูงเลย์เอาต์เสร็จสิ้นอย่างนิ่ง
        maxWaitMs: 300, // ลิมิตเวลารอกรณีคีย์บอร์ดปิดอย่างรวดเร็วหรือไม่มีแอนิเมชันตอบสนอง
      },
    );
  };

  return (
    <AuthContext.Provider value={{ isSignedIn, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
