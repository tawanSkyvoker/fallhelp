/**
 * Root Layout
 *
 * ไฟล์นี้เป็นจุดเริ่มต้นหลักของแอป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - โหลด font และ boot data ก่อนเริ่มแอป
 * - ครอบแอปด้วย Provider หลัก เช่น Auth, React Query, Theme, Dialog
 * - คุมเส้นทางหลักของแอป เช่น Auth, Setup, Tabs และ Features
 * - จัดการ Splash Screen ระหว่างโหลดข้อมูล
 * - จัดการ socket และ push notification หลังผู้ใช้เข้าสู่ระบบ
 */

import 'react-native-reanimated';
import '../global.css';
import '../utils/safeRouter';

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LogBox, Platform, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '../components/LoadingScreen';
import { toastConfig } from '../components/ToastConfig';
import Toast from 'react-native-toast-message';

import { AppTheme } from '../constants/theme';
import { readBootData, type BootData } from '../utils/setupStorage';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { DialogProvider } from '../context/DialogContext';
import { useSocketConnection } from '../hooks/useSocketConnection';
import { useNavigationBar } from '../hooks/useNavigationBar';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useRouterGuard } from '../hooks/useRouterGuard';
import { queryKeys } from '../hooks/queryKeys';
import { useFallAlertStore } from '../store/useFallAlertStore';

if (__DEV__) {
  LogBox.ignoreLogs([/SafeAreaView has been deprecated and will be removed in a future release/i]);
}

// React Query client กลางของแอป
// ใช้กำหนดค่า default สำหรับทุก useQuery/useMutation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,

      // ไม่ retry บาง error ที่ควรให้ผู้ใช้จัดการเอง
      // เช่น login หมดอายุ, ไม่มีสิทธิ์, ไม่พบข้อมูล หรือ request ถูกจำกัด
      retry: (failureCount, error) => {
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? (error as { status?: number }).status
            : undefined;

        if (
          status === 401 ||
          status === 403 ||
          status === 404 ||
          status === 409 ||
          status === 429
        ) {
          return false;
        }

        return failureCount < 1;
      },
    },
  },
});

export { ErrorBoundary } from 'expo-router';

const parseBpmValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== 'string') return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : null;
};

const parseBpmFromNotificationBody = (body: string | null | undefined): number | null => {
  if (!body) return null;

  const match = body.match(/ชีพจร(?:ขณะล้ม)?:\s*(\d{1,3})\s*BPM/i);
  return match ? parseBpmValue(match[1]) : null;
};

// กันไม่ให้ Splash Screen หายเองก่อนแอปโหลดข้อมูลจำเป็นเสร็จ
SplashScreen.preventAutoHideAsync();

// Component นี้อยู่หลัง Provider แล้ว
// จึงใช้ Auth, QueryClient, Socket, Push Notification และ Router Guard ได้
function RootLayoutNav() {
  useEffect(() => {
    if (__DEV__) {
      console.log('[RouterGuard] RootLayoutNav mounted');
    }

    if (Platform.OS === 'android') {
      // ตั้งค่า Status Bar ของ Android ให้โปร่งใสและใช้ตัวอักษรสีเข้ม
      RNStatusBar.setHidden(false);
      RNStatusBar.setBarStyle('dark-content');
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent');
    }
  }, []);

  // อ่านสถานะ login จาก AuthContext
  const { isSignedIn, isLoading: isAuthLoading } = useAuth();

  // useProtectedRoute ใช้ตรวจว่า user ควรอยู่หน้าไหน
  // เช่น auth, setup หรือ main app
  const { isLoading } = useProtectedRoute();

  const queryClient = useQueryClient();
  const prevSignedInRef = useRef<boolean | null>(null);

  // เปิดใช้งาน push notification เมื่อ auth และ route พร้อมแล้ว
  const { notification } = usePushNotifications(isSignedIn && !isAuthLoading && !isLoading);

  // ตั้งค่า navigation bar ของเครื่อง
  useNavigationBar();

  // คุม route guard ฝั่ง navigation
  useRouterGuard();

  // จัดการ socket connection ของ realtime data
  const { disconnect } = useSocketConnection();

  useEffect(() => {
    if (prevSignedInRef.current === null) {
      prevSignedInRef.current = isSignedIn;
      return;
    }

    if (prevSignedInRef.current !== isSignedIn) {
      if (!isSignedIn) {
        // ถ้า logout ให้ตัด socket ทันที
        disconnect();

        // หน่วงการเคลียร์ cache เล็กน้อยเพื่อให้ navigation เริ่มทำงานก่อน
        // ป้องกัน JS thread ทำงานหนักเกินไปจน navigation ค้าง
        setTimeout(() => {
          queryClient.clear();
        }, 300);
      } else {
        // ถ้า login ให้เคลียร์ทันทีเพื่อความปลอดภัยของข้อมูล
        queryClient.clear();
      }

      prevSignedInRef.current = isSignedIn;
    }
  }, [isSignedIn, queryClient, disconnect]);

  useEffect(() => {
    if (!notification) return;

    // ถ้า push notification มี eventId แปลว่ามีเหตุการณ์ล้มเข้ามา
    const { content } = notification.request;
    const eventId = content.data?.['eventId'];

    if (typeof eventId === 'string' && eventId.length > 0) {
      // อัปเดต fall alert store ให้ dashboard เห็นสถานะล้มทันที
      const fallStore = useFallAlertStore.getState();
      const bpm =
        parseBpmValue(content.data?.['bpm']) ??
        parseBpmValue(content.data?.['heartRateAtFall']) ??
        parseBpmFromNotificationBody(content.body);

      fallStore.setFallStatus('FALL');
      fallStore.setActiveFallEventId(eventId);
      fallStore.setLastFallUpdate(new Date(notification.date || Date.now()));
      fallStore.setActiveFallBpm(bpm);
    }

    // เพิ่ม unread count ทันทีโดยไม่รอ API เพื่อให้จุดแดงขึ้นพร้อม push
    queryClient.setQueryData(
      queryKeys.unreadCount(),
      (prev: number | undefined) => (prev ?? 0) + 1,
    );

    // รีเฟรช cache ที่เกี่ยวกับ notification และประวัติเหตุการณ์
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
    void queryClient.invalidateQueries({ queryKey: ['initialEvents'] });
    void queryClient.invalidateQueries({ queryKey: ['historyEvents'] });
  }, [notification, queryClient]);

  const splashHiddenRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !splashHiddenRef.current) {
      splashHiddenRef.current = true;

      // หน่วงเล็กน้อยเพื่อกันหน้าจอกะพริบตอนเปลี่ยนจาก Splash เข้าแอป
      const timer = setTimeout(() => SplashScreen.hideAsync(), 100);

      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  useEffect(() => {
    // fallback กัน Splash ค้างนานผิดปกติ
    const timer = setTimeout(() => {
      if (!splashHiddenRef.current) {
        splashHiddenRef.current = true;
        SplashScreen.hideAsync();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.stackContainer, isLoading && styles.hidden]}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
          }}
        >
          {/* กลุ่มหน้าก่อนเข้าสู่ระบบ */}
          <Stack.Screen name="(auth)" options={{ animation: 'none' }} />

          {/* กลุ่มหน้าตั้งค่าเริ่มต้นหลังสมัครหรือยัง setup ไม่ครบ */}
          <Stack.Screen name="(setup)" options={{ animation: 'none' }} />

          {/* กลุ่มหน้าหลักหลังเข้าแอปแล้ว */}
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />

          {/* กลุ่มหน้าฟีเจอร์ย่อย เช่น profile, device, elder, emergency */}
          <Stack.Screen name="(features)" options={{ animation: 'none' }} />

          {/* หน้า modal แยก */}
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="box-none">
          <LoadingScreen />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  // โหลด font ที่แอปใช้ก่อน render UI
  const [loaded, error] = useFonts({
    Kanit: require('../assets/fonts/Kanit-Regular.ttf'),
    'Kanit-Regular': require('../assets/fonts/Kanit-Regular.ttf'),
    'Kanit-Medium': require('../assets/fonts/Kanit-Medium.ttf'),
    MaterialSymbolsOutlined: require('../assets/fonts/MaterialSymbolsOutlined.ttf'),
    MaterialSymbolsFilled: require('../assets/fonts/MaterialSymbolsFilled.ttf'),
    ...MaterialCommunityIcons.font,
  });

  // bootData ใช้บอกสถานะเริ่มต้น เช่น มี token อยู่หรือไม่
  const [bootData, setBootData] = useState<BootData | null>(null);

  useEffect(() => {
    // อ่านข้อมูลเริ่มต้นของแอปจาก storage
    readBootData().then(setBootData);
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded || !bootData) {
    // ยังไม่พร้อม ให้ Splash Screen ค้างไว้ก่อน
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" translucent={true} backgroundColor="transparent" />

        {/* AuthProvider ต้องอยู่ด้านนอก เพื่อให้ route guard อ่านสถานะ login ได้ */}
        <AuthProvider initialSignedIn={bootData.hasToken}>
          {/* QueryClientProvider ครอบทุกหน้าที่ใช้ React Query */}
          <QueryClientProvider client={queryClient}>
            <ThemeProvider value={DefaultTheme}>
              <PaperProvider theme={AppTheme}>
                {/* DialogProvider ใช้กับ showDialog ทั่วทั้งแอป */}
                <DialogProvider>
                  <RootLayoutNav />
                </DialogProvider>
              </PaperProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </AuthProvider>

        {/* Toast แสดงข้อความ success/error แบบลอย */}
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stackContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  hidden: {
    opacity: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 9999,
  },
});
