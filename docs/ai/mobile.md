# FallHelp Mobile — Deep Research

## Doc Meta

- Audience: AI agents, mobile developers, reviewers touching `apps/mobile/`
- Source of Truth: `apps/mobile/`, mobile owner docs, and current app shell/navigation behavior
- Status: Active
- Last Updated: May 31, 2026

---

## Overview

> Deep-read date: 2026-05-10

---

## 1. Project Structure (`apps/mobile/`)

```
apps/mobile/
├── app/
│   ├── _layout.tsx               # Root providers + route guard + splash control
│   ├── index.tsx                 # Return null — navigation handled by route guard
│   ├── (auth)/                   # Login/register/forgot/reset/verify flows
│   ├── (setup)/                  # First-time setup wizard (step1→step2→step3)
│   ├── (tabs)/                   # Dashboard / History (bottom tabs)
│   └── (features)/               # Device, elder, emergency, notification, report, profile
├── components/                   # Shared UI components
├── context/                      # AuthContext, DialogContext
├── hooks/                        # Route guard, socket lifecycle, push notifications, query keys
├── services/                     # API client + domain services + BLE/WiFi
├── store/                        # Lightweight runtime stores for device setup + telemetry UI
├── constants/                    # Config, env boundary, theme
├── utils/                        # Logger, setup storage, safeRouter, searchParams, helpers
├── assets/                       # Fonts (Kanit) + images
├── __tests__/                    # Unit/smoke tests
└── patches/                      # patch-package overrides for native modules
```

**Route groups ที่ชื่อขึ้นต้นด้วย `(xxx)` ไม่กระทบ URL path** — `(auth)/login` → `/login`

---

## 2. App Shell (`app/_layout.tsx`)

### Provider Order (critical — ห้ามเรียงผิด)

```
GestureHandlerRootView
  SafeAreaProvider
    AuthProvider           ← token lifecycle, ใช้ initialSignedIn จาก boot cache
      QueryClientProvider
        ThemeProvider
          PaperProvider
            DialogProvider ← global alert/modal system
              RootLayoutNav  ← Stack navigator + route guard + socket hook
```

### Boot Sequence

1. โหลด font (Kanit)
2. `readBootData()` — batch อ่าน token + setup keys พร้อมกัน (6 reads แทน 11 sequential)
3. Mount providers ด้วย `initialSignedIn` จาก boot cache
4. `useProtectedRoute()` ตัดสินใจ route
5. ซ่อน splash screen หลัง route resolved เท่านั้น (กัน white flash)

> `app/index.tsx` ตั้งใจให้ `return null` ห้ามใส่ navigation logic ที่นี่

---

## 3. Route Groups & Screens

### `(auth)` — Authentication Screens

| File                  | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `login.tsx`           | Identifier (email/phone) + password login |
| `register.tsx`        | สมัครบัญชีใหม่                            |
| `forgot-password.tsx` | ขอ OTP reset password                     |
| `verify-otp.tsx`      | ยืนยัน OTP 6 หลัก                         |
| `reset-password.tsx`  | ตั้ง password ใหม่                        |
| `success.tsx`         | หน้าสำเร็จหลัง register                   |

### `(setup)` — Onboarding Wizard

ใช้ตอน user ยังไม่มีข้อมูล elder หรือมี setup cache ค้างอยู่ ทำงานเป็น 3 step ต่อเนื่อง:

| File                       | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `empty-state.tsx`          | หน้าแรก — ยังไม่มี elder ให้กด "เริ่มต้น"     |
| `step1-elder-info.tsx`     | ชื่อ, วันเกิด, เพศ, น้ำหนัก, ส่วนสูง, ที่อยู่ |
| `step2-device-pairing.tsx` | QR scan หรือกรอก device code 8 หลัก           |
| `step3-wifi-setup.tsx`     | BLE provisioning WiFi ให้ ESP32               |
| `saved-success.tsx`        | Setup เสร็จแล้ว → ไป tabs                     |

### `(tabs)` — Main App

| File            | Purpose                                           |
| --------------- | ------------------------------------------------- |
| `dashboard.tsx` | Dashboard: realtime monitoring (fall, HR, status) |
| `history.tsx`   | ประวัติ event + monthly summary                   |

> ⚠️ ไม่มี settings tab — ระบบมีเพียง 2 tabs คือ หน้าหลัก และ ประวัติ

### `(features)` — Nested Feature Flows

```
(device)/
  device-pairing.tsx         # จับคู่อุปกรณ์ใหม่
  device-wifi-setup.tsx      # smart router เลือก flow เปลี่ยน/ตั้งค่า WiFi ตาม online state
  device-wifi-reconfig.tsx   # ส่งคำสั่งเปลี่ยน WiFi ผ่าน backend/MQTT เมื่ออุปกรณ์ยัง online
  device-ble-wifi-setup.tsx  # ตั้งค่า WiFi ผ่าน BLE โดยตรงเมื่ออุปกรณ์ offline
  device-info.tsx            # ข้อมูลอุปกรณ์ปัจจุบัน

(elder)/
  elder-info.tsx       # ดูข้อมูล elder
  edit.tsx             # แก้ไข elder

(emergency)/
  contacts.tsx         # รายชื่อ emergency contacts
  add.tsx / edit.tsx   # จัดการ contacts (เลือกความสัมพันธ์กับผู้สูงอายุแบบกลาง + อื่น ๆ)
  call.tsx             # UI โทร

(notification)/
  notifications.tsx    # ประวัติ notification

(report)/
  report-summary.tsx   # สรุปรายเดือน

(profile)/
  profile-info.tsx     # หน้า profile info
  edit-info.tsx        # แก้ไขข้อมูลส่วนตัว (ชื่อ นามสกุล และเพศ)
  change-email.tsx     # เปลี่ยน email
  change-password.tsx
  edit-phone.tsx
```

---

## 4. Navigation & Route Guard

### `hooks/useProtectedRoute()`

State machine ที่ตัดสินใจ route หลัก boot เสร็จ:

```
LOADING → RESOLVING → READY
```

**Decision tree:**

1. ยังไม่ได้ sign in → `/(auth)/login`
2. Sign in แล้ว + ไม่มี elder → `/(setup)/empty-state`
3. Setup ค้างอยู่ที่ step ใด → `/(setup)/step1|step2|step3`
4. Setup เสร็จ → `/(tabs)/dashboard`

> ผู้ใช้ที่มี elder แล้วแต่ยังไม่มี device สามารถเข้า dashboard ได้ โดยหน้า dashboard จะแสดง empty/action state สำหรับการจับคู่อุปกรณ์แทนการบังคับกลับ setup ทุกครั้ง

**Features:**

- Fast path: ใช้ boot cache (SecureStore) ตัดสินใจได้เลยโดยไม่ต้องเรียก API
- Slow path: Fallback เรียก `getCurrentElder()` ถ้า cache ไม่ครบ
- Self-heal: ถ้า elderId หาย แต่ backend มี elder อยู่ → restore cache อัตโนมัติ
- Grace period 1.2s กัน screen flash จาก transient race condition
- Auth recovery: 401/403 → auto signout + redirect to login

### `utils/safeRouter.ts`

Wrapper รอบ expo-router ป้องกัน navigation race:

- **Duplicate guard**: block การ navigate ซ้ำใน 1.2s
- **Retry logic**: รอ navigation context init สูงสุด 480ms
- **Global patch**: `import { router }` ทุกที่ได้ safe version อัตโนมัติ
- Methods: `push`, `replace`, `back`, `navigate`, `dismiss`, `dismissTo`, `dismissAll`, `setParams`

### `utils/searchParams.ts`

helper กลางสำหรับ Expo Router search params:

- normalize ค่า `string | string[] | undefined` ให้เรียกใช้ได้แบบเดียวกัน
- ลดการ cast ด้วยมือในหน้าจอ auth / device / emergency / history
- API หลัก: `getString`, `getStringOrEmpty`, `getNumber`, `getNumberWithFallback`

---

## 5. State Management

### `context/AuthContext.tsx`

```typescript
interface AuthContextType {
  isSignedIn: boolean; // token exists in SecureStore
  isLoading: boolean; // bootstrap ยังไม่เสร็จ
  signIn(token: string): Promise<void>; // save token + mark signed in
  signOut(): Promise<void>; // clear runtime state + setup/cache, then backend logout clears pushToken before local token removal
}
```

- `initialSignedIn` prop จาก boot cache กัน re-read SecureStore ซ้ำตอน mount

### `hooks/useSocketConnection.ts` + `store/*`

```typescript
useSocketConnection(): { reconnect(): void; disconnect(): void }
```

Realtime socket lifecycle ไม่ได้อยู่ใน Context แล้ว แต่รันครั้งเดียวจาก `RootLayoutNav`
ผ่าน `useSocketConnection()` และกระจาย state ไปยัง stores:

- `useDeviceSetupStore` — elderId/deviceId ที่ใช้ผูก socket session
- `useSensorStore` — online/offline, heartRate, socketConnected, signalStrength
- `useFallAlertStore` — fallStatus (NORMAL/FALL), activeFallEventId, lastFallUpdate

**Lifecycle:** connect → emit `authenticate` พร้อม token + elderId → รับ events → อัปเดต stores → disconnect on logout

**Notification sync:** เมื่อได้รับ fall confirmed ผ่าน Socket, Dashboard card อัปเดตจาก realtime store ทันที
แต่จุดแดงกระดิ่งและ notification list จะ refetch พร้อมกันหลัง backend สร้าง `Notification` record จริงแล้ว
เพื่อไม่ให้ badge ขึ้นก่อนรายการแจ้งเตือนใน modal

**Socket.io events รับ:**

| Event                  | ผลลัพธ์                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `fall_detected`        | อัปเดต `useFallAlertStore` เป็น `FALL` และ set `activeFallEventId`    |
| `event_status_changed` | จัดการ internal pending guard สำหรับ `FALL_SUSPECTED/CONFIRMED/CANCELLED` |
| `heart_rate_update`    | อัปเดต `useSensorStore.heartRate`, `heartConfidence`                  |
| `device_status_update` | อัปเดต `lastStatusUpdate`, `signalStrength`, และ online/offline state |
| `system_message`       | log only                                                              |

**Watchdog thresholds:**

```
STALE_HEARTBEAT_THRESHOLD_MS    = 60s   — ล้าง HR ถ้าไม่มีข้อมูลมา 60s
STALE_DEVICE_THRESHOLD_MS       = 15s   — mark offline เมื่อ realtime activity ขาด โดยไม่ใช้ socket disconnect เป็นหลักฐานว่า ESP32 offline โดยตรง
WATCHDOG_CHECK_INTERVAL_MS      = 1s    — ตรวจทุก 1s เพื่อให้ปิดเครื่องจริงแสดง offline ไวขึ้น
INITIAL_OFFLINE_GRACE_MS        = 8s    — รอหลัง authenticate ก่อนรับ offline event
```

Socket disconnect ไม่ใช่หลักฐานว่า ESP32 offline โดยตรง:
`useSocketConnection` ต้อง mark เฉพาะ `socketConnected=false` ก่อน
และ Dashboard จะ refetch `currentElder` สั้น ๆ เฉพาะช่วง socket unavailable เพื่อใช้ `Device.lastOnline` จาก backend เป็น fallback.
ถ้า socket ยัง connected แล้วได้รับ MQTT offline/LWT ผ่าน `device_status_update` ให้ offline state จาก realtime ชนะ API fallback เสมอ.

**Architecture note:** mobile app ยังเป็น Context-first สำหรับ auth/dialog/app shell
แต่ realtime telemetry ใช้ hook + store แยกออกจาก provider tree เพื่อหลีกเลี่ยง socket-specific context coupling

### `context/DialogContext.tsx` + `utils/dialogService.ts`

Global alert system แทน React Native Alert:

```typescript
showDialog(title, message?, actions?)
// actions: [{ text, onPress?, style: 'default' | 'cancel' | 'destructive' }]
```

`dialogService` เป็น singleton ใช้ได้จากทุกที่ (ไม่ต้อง hook) — fallback เป็น RN Alert ถ้าไม่มี handler

### React Query Config

```typescript
defaultOptions: {
  queries: {
    staleTime: 30_000,          // ไม่ refetch ถ้าข้อมูลไม่เก่าเกิน 30s
    gcTime: 5 * 60_000,         // cache 5 นาที
    refetchOnWindowFocus: false,
    retry: 1,
  }
}
```

Query keys รวมอยู่ที่ `hooks/queryKeys.ts`

---

## 6. Service Layer

### `services/api.ts` — Axios Base Client

```typescript
const apiClient = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: 10_000,
});
```

- **Request interceptor**: แนบ `Authorization: Bearer {token}` จาก SecureStore
- **Response interceptor**: normalize error → `ApiError`, detect 401/404/network/timeout

### Domain Services

| File                     | หน้าที่                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `authService.ts`         | login, register, OTP flow, fetchProfile, logout (POST backend logout to clear pushToken, then clear local token) |
| `elderService.ts`        | CRUD elder + getCurrentElder/getElder สำหรับ single-caregiver model                                              |
| `deviceService.ts`       | getDeviceByCode, pairDevice, unpairDevice, configureWifi (legacy/backend reconfig path)                          |
| `eventService.ts`        | listEvents (paginated), getMonthlySummary                                                                        |
| `notificationService.ts` | registerPushToken, listNotifications, getUnreadCount, markAsRead, markAllAsRead                                  |
| `userService.ts`         | getProfile, updateProfile, changePassword, updatePushToken                                                       |
| `bleService.ts`          | BLE scan/connect/provision (ดู §8)                                                                               |
| `wifiScannerService.ts`  | scan WiFi networks บนมือถือ เพื่อ populate dropdown                                                              |

### `services/tokenStorage.ts`

```typescript
setToken(token); // SecureStore (native) / sessionStorage (web)
getToken(); // → string | null
clearToken();
```

### `services/types.ts` — Domain Types

```typescript
type Elder     = { id, firstName, lastName, dateOfBirth?, device?, ... }
type Device    = { id, serialNumber, elderId?, status, onlineStatus, lastOnline, config?, ... }
type Event     = { id, elderId, deviceId, fallStage, bpm?, magnitude?, postureDelta?, cancelledAt?, timestamp, ... }
type UserProfile = { id, email, firstName, lastName, role, ... }
type EmergencyContact = { id, elderId, name, phone, priority, ... }

type Notification = { id, title, message, eventId, isRead, createdAt, event?, ... }
```

---

## 7. Setup Wizard Detail

### Step 1 — Elder Info (`step1-elder-info.tsx`)

**Form fields:** firstName, lastName (required), dateOfBirth, gender, height, weight, medicalCondition, address (houseNumber, villageNumber, villageName, district, amphoe, province, zipcode พร้อม autocomplete)

**Persistence:** JSON string ใน AsyncStorage ผ่าน `setupStorage.setSetupStep1FormData()`

**Validation:** ตรวจว่า elderId cache ใน SecureStore ยังตรงกับ backend จริง — ถ้าไม่ตรง (DB wipe) สร้างใหม่
`dateOfBirth` ส่งเป็น date-only (`YYYY-MM-DD`) ห้ามใช้ `toISOString()` ตรง ๆ สำหรับ payload วันเกิด

### Step 2 — Device Pairing (`step2-device-pairing.tsx`)

**Input methods:**

1. QR code scan (default) — `expo-camera`
2. Manual device code entry (fallback)

**Flow:** scan → `pairDevice(elderId, deviceCode)` → store deviceId ใน setupStorage → next step

**Guard:** ถ้า device จับคู่แล้ว skip step นี้อัตโนมัติ

### Step 3 — WiFi Setup (`step3-wifi-setup.tsx`)

**Flow:** BLE scan → connect → เลือก WiFi หรือกรอก SSID เองสำหรับ hidden network → send credentials → รอสถานะจาก BLE characteristic → รอ socket/backend polling ยืนยันว่าอุปกรณ์ online จริง → success → navigate to `/(tabs)/dashboard`

**Success rule:** Mobile ต้องไม่ถือว่า BLE `CONNECTED (0x02)` เป็นจุดจบของ flow ทันที เพราะนั่นยืนยันแค่ ESP32 ต่อ WiFi ได้แล้ว หลังจากนั้นต้องรอ MQTT/backend status หรือ `getDeviceConfig()` fallback ยืนยัน `wifiStatus=CONNECTED`/`isOnline=true` ภายใน 20 วินาที ถ้า ESP32 ส่ง `FAILED/INVALID/TIMEOUT` หรือ backend แจ้ง `ERROR` ให้ลองกลับไปกรอกรหัสผ่าน/เลือก WiFi ใหม่ได้จากหน้าฟอร์มเดิมภายใต้สมมติฐานว่า firmware รีเซ็ต BLE session สำเร็จ แต่ถ้ายังไม่สำเร็จต้องปิด-เปิดอุปกรณ์ก่อนเริ่ม setup ใหม่

**External WiFi return rule:** ถ้าผู้ใช้แตะ WiFi แล้วแอปถูกพาออกไปหน้า WiFi ของระบบหรือ captive portal เมื่อกลับมา foreground ให้เช็ก SSID ของมือถือทันที ถ้า SSID เปลี่ยนหรือกลับมาตรงกับเครือข่ายที่เลือก ให้กลับไปหน้า WiFi list, รีเฟรชรายการ, และล้าง password form โดยไม่ auto-submit credentials ให้ ESP32 ผู้ใช้ต้องเห็นรายการล่าสุดก่อนตัดสินใจส่ง WiFi ให้อุปกรณ์

**Current mobile default:** จาก `device-info` ให้เข้า `device-wifi-setup.tsx` ก่อนเสมอ แล้ว route นี้จะตัดสินใจเองว่าใช้อะไรเป็น path หลัก:

- อุปกรณ์ online → `device-wifi-reconfig.tsx` ส่งคำสั่งผ่าน backend/MQTT
- อุปกรณ์ offline → `device-ble-wifi-setup.tsx` ใช้ BLE provisioning โดยตรง

แนวทางนี้ทำให้ feature mode ยังมี entrypoint เดียว แต่ไม่บังคับใช้ BLE กับอุปกรณ์ที่ยัง online อยู่

---

## 8. BLE Provisioning Flow (`services/bleService.ts`)

### UUIDs

```typescript
SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
CHAR_SSID = "4fafc202-1fb5-459e-8fcc-c5c9c331914b"; // write
CHAR_PASSWORD = "4fafc203-1fb5-459e-8fcc-c5c9c331914b"; // write
CHAR_STATUS = "4fafc204-1fb5-459e-8fcc-c5c9c331914b"; // read + notify
```

### Status Enum

```typescript
enum BLEProvisioningStatus {
  IDLE = 0x00, // พร้อม
  CONNECTING = 0x01, // WiFi กำลังเชื่อมต่อ
  CONNECTED = 0x02, // WiFi สำเร็จ (terminal)
  FAILED = 0x03, // WiFi auth ล้มเหลว (terminal)
  INVALID = 0x04, // Payload ผิด (terminal)
  MQTT_UNAVAILABLE = 0x05, // reserved/client-supported; firmware ปัจจุบันยังไม่ emit status นี้
  TRANSPORT_ERROR = 0xf0, // BLE link error (terminal)
  TIMEOUT = 0xf1, // ไม่มีสถานะใน 45s (terminal)
}
```

### Step-by-Step

```
1. scanForDevices(onDeviceFound, timeoutMs)
   - Filter name: "FallDetector-*" หรือ "FallHelp-*"
   - Deduplicate callbacks (same device)
   - Android: stopDeviceScan() ก่อน startDeviceScan() ทุกครั้ง (reset throttle counter)

2. connectToDevice(deviceId) — timeout 30s

3. sendWiFiCredentials(ssid, password)
   - Read initial status ก่อน → detect stale status จาก provision ครั้งก่อน
   - Write SSID → Write Password

4. waitForStatus(timeoutMs = 45s)
   - Primary: monitorCharacteristicForService() [BLE notify ~10ms]
   - Fallback: Read ทุก 3s ถ้า notify ไม่ทำงาน (Android glitch)
   - รอ CONNECTING ก่อน แล้วค่อยรอ terminal status

5. Mobile completion
   - BLE `CONNECTED` = อุปกรณ์ต่อ WiFi ได้แล้ว แต่ยังรอ backend/socket ยืนยัน online
   - Socket update หรือ backend polling `wifiStatus=CONNECTED`/`isOnline=true` = แสดง success
   - BLE `FAILED/INVALID/TIMEOUT` หรือ backend `wifiStatus=ERROR` = เปิดทางให้ลองใหม่จากหน้าฟอร์ม แต่ถ้ายัง fail ซ้ำให้ power-cycle อุปกรณ์แล้วเริ่ม flow ใหม่

6. disconnect()
   - Clear device reference ก่อน disconnect (กัน double-call)
   - ห้าม subscription.remove() ถ้า BLE กำลัง deinit (native race condition)
```

---

## 9. Fall Detection UI Flow

```
[MQTT] suspected_fall
        ↓ internal Socket.io event_status_changed / no Push
   (DB อัปเดตเป็น PENDING_CONFIRMATION; Mobile ตั้ง pending guard แต่ Dashboard ยังไม่แสดง alert)
        ↓
   [ผู้ใช้กดปุ่ม GPIO27 บนอุปกรณ์]
        ↓ internal Socket.io event_status_changed / no Push
   DB อัปเดตเป็น CANCELLED และ Mobile clear pending guard

    [ถ้าไม่กด 15s หมด]
         ↓ Socket.io 'fall_detected' หรือ push notification
    useFallAlertStore: fallStatus = 'FALL'
Dashboard: แสดง fall card (สีแดง) + ปุ่ม `รับทราบแล้ว`
```

**กฎสำคัญ:**

- **Cancel** ทำได้เฉพาะ GPIO27 บนอุปกรณ์ (ไม่มีปุ่ม Cancel ใน mobile app)
- **Acknowledge** = mobile app กด `รับทราบแล้ว` → คืนมุมมองในแอปเป็นปกติเท่านั้น ไม่เขียน DB
- `activeFallEventId` ใช้สำหรับ link ไปหน้า event detail

### Dashboard Thresholds

```
HEART_FRESHNESS_MS         = 60s    — HR เกิน 60s → dim/ซ่อน
FALL_FRESHNESS_MS          = 10min  — fall เกิน 10min → ซ่อน card
DEVICE_ONLINE_FRESHNESS_MS = 8s     — API snapshot เกิน 8s → offline
OFFLINE_DISPLAY_GRACE_MS   = 12s    — ไม่แสดง offline ก่อน 12s
SOCKET_CONNECT_GRACE_MS    = 8s     — ไม่แสดง "connecting" ก่อน 8s
```

API online fallback ใช้เฉพาะตอน socket unavailable เท่านั้น เพื่อกัน socket transport error ทำให้ device card offline ผิดพลาด.
หลัง reconnect หรือเมื่อมี realtime offline ชัดเจน ให้ยึด realtime state เป็นหลัก.

---

## 10. Hooks (`hooks/`)

| Hook                            | หน้าที่                                                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useHomeDisplayState()`         | **หัวใจหลักของการแสดงผล Dashboard** — คำนวณเรื่อง Timing Windows, Snapshot State, และ Grace periods ของทั้ง Fall, HR, และ Status เพื่อให้ UI เสถียรที่สุด |
| `useProtectedRoute()`           | Route resolution (auth + setup state) — ตัวตัดสินใจหลักในการ navigate ไปหน้าต่างๆ                                                                         |
| `useCurrentElder()`             | React Query: ดึงข้อมูลผู้สูงอายุคนเดียวที่ผูกกับ caregiver ปัจจุบัน                                                                                       |
| `usePushNotifications(enabled)` | Register Expo push token + รับ push fallback, invalidate notification/history เมื่อ push foreground มาถึง                                                 |
| `useSocketConnection()`         | ควบคุม Socket.io, กระจาย realtime state ไปยัง stores, และ sync unread badge/list หลัง fall confirmed                                                      |
| `useRouterGuard()`              | Queue navigation จนกว่า navigation context จะพร้อมทำงาน                                                                                                   |
| `useUnsavedChanges()`           | แจ้งเตือนก่อนออกจากหน้าจอที่มีการแก้ไขข้อมูลค้างไว้                                                                                                       |
| `useNavBarInset()`              | คำนวณ Safe area insets สำหรับ bottom navigation bar                                                                                                       |
| `useNavigationBar()`            | ควบคุมสไตล์ของ status bar และ navigation bar (native)                                                                                                     |
| `queryKeys.ts`                  | จุดรวม Query Keys สำหรับ React Query ทั้งระบบ                                                                                                             |

---

## 11. Utils (`utils/`)

### `setupStorage.ts` — Setup State (สำคัญมาก)

```typescript
// SecureStore keys (scoped by userId: `{key}.u_{encodedUserId}`)
setSetupStep(step: '1'|'2'|'3'|'complete')
setSetupElderId(id)
setSetupDeviceId(id)
setSetupSerialNumber(serial)
setLastResolvedRoute(route)

// AsyncStorage (form data)
setSetupStep1FormData(json)  // ข้อมูล step 1 cache

// Boot cache — batch read เพื่อ startup เร็ว
readBootData(): Promise<BootData>    // token + all setup keys พร้อมกัน
getBootDataSync(): BootData | null   // synchronous fallback

// Cleanup
clearAllSetupForCurrentUser()
```

**Key scoping:** `{key}.u_{encodedUserId}` กัน cross-user data leakage เมื่อเปลี่ยนบัญชีบนเครื่องเดิม

### `errorHelper.ts`

```typescript
getErrorMessage(error): string   // extract Thai message จาก ApiError response
showErrorMessage(title, error)   // getErrorMessage + showDialog
```

Priority: `error.response.data.error.message` → `error.response.data.error` → HTTP status message (Thai) → network error (Thai)

### `passwordPolicy.ts`

ข้อกำหนด: ≥8 ตัวอักษร, พิมพ์ใหญ่, พิมพ์เล็ก, ตัวเลข

### `logger.ts`

```typescript
Logger.debug(msg, data?)   // __DEV__ เท่านั้น
Logger.info(msg, data?)
Logger.warn(msg, data?)
Logger.error(msg, error?, meta?)
```

ห้ามใช้ `console.log` ใน codebase ทั้งหมด

---

## 12. Configuration

### `constants/Config.ts`

```typescript
API_URL; // EXPO_PUBLIC_API_URL หรือ auto-detect local IP ใน __DEV__
SOCKET_URL; // EXPO_PUBLIC_SOCKET_URL หรือ ใช้ API_URL
REQUEST_TIMEOUT = 10_000;
```

**Dev mode:** auto-detect LAN IP จาก `hostUri` เพื่อ connect กับ backend ที่รันบนเครื่องเดียวกัน
ใน dev client ที่ `EXPO_PUBLIC_FORCE_PUBLIC=false` และหา local IP ได้ `SOCKET_URL` ต้องตาม local `API_URL` โดยอัตโนมัติ แม้ `.env` จะมี `EXPO_PUBLIC_SOCKET_URL` เป็น public tunnel อยู่ เพื่อไม่ให้ REST API กับ Socket.io ชี้คนละ backend
**Prod mode:** ใช้ URL จาก env เสมอ

### Environment Variables

```
EXPO_PUBLIC_API_URL           # default: https://api.tawanlab.site
EXPO_PUBLIC_SOCKET_URL        # optional override
EXPO_PUBLIC_FORCE_PUBLIC      # 'true' = บังคับใช้ public URL ใน dev
```

### `app.json` Permissions

- Android: CAMERA, ACCESS_FINE_LOCATION, BLUETOOTH_SCAN, BLUETOOTH_CONNECT
- iOS: NSLocationWhenInUseUsageDescription, NSBluetoothPeripheralUsageDescription

---

## 13. Testing

### Test Files

```
__tests__/
├── app/
│   ├── (auth)/login.test.tsx / register.test.tsx / password-reset.test.tsx
│   ├── (setup)/step1-elder-info.test.tsx / step2-device-pairing.test.tsx / step3-wifi-setup.test.tsx
│   ├── (tabs)/dashboard.test.tsx / history.test.tsx
│   └── (features)/device-actions.test.tsx / elder.test.tsx / emergency.test.tsx / notification-report.test.tsx / profile.test.tsx
├── services/ (api, authService, deviceService, notificationService, tokenStorage, ...)
├── stores/ (useFallAlertStore, useSensorStore, useDeviceSetupStore)
├── contexts/ (AuthContext, DialogContext)
└── utils/ (safeRouter, testId, thailandAddress, connectivity helpers, etc.)
```

### Commands

```bash
npm run test              # ทั้งหมด
npm run test:light        # เร็วกว่า (jest.light.config.cjs)
npm run test:watch
npm run test:coverage
```

### Mock Pattern

```typescript
// Store reset + seed state ก่อน render
useFallAlertStore.getState().setFallStatus('SUSPECTED');
useSensorStore.getState().setHeartRate(75);
render(<ComponentUnderTest />);

// React Query mock
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
<QueryClientProvider client={queryClient}>
  <ComponentUnderTest />
</QueryClientProvider>
```

---

## 14. Conventions

### Import Style

```typescript
// ใช้ relative imports เป็นค่าเริ่มต้น เพื่อให้ TypeScript/Metro/Jest/ESLint resolve ตรงกัน
import { showDialog } from "../../utils/dialogService";
import { useAuth } from "../../context/AuthContext";
import { getCurrentElder } from "../../services";

// หลีกเลี่ยง @/ alias ใน mobile code เว้นแต่มี config/เหตุผลเฉพาะจุดรองรับครบทุก tool
```

### Comment Style

- ใช้ Thai-first comments ตาม `AGENTS.md` และ comment reference กลาง
- ไฟล์ที่คุม flow หลายขั้น เช่น socket lifecycle, route guard, BLE provisioning, setup storage, dashboard display state สามารถมี JSDoc-style file header พร้อม `สิ่งที่เกิดขึ้นในไฟล์นี้:`
- หลีกเลี่ยง import group labels และ separator banners; comment เฉพาะ intent เช่น race guard, debounce/grace period, cache invalidation, store side effect, หรือ navigation edge case
- ใช้ `ไฟล์ถัดไป: ...` เมื่อ logic ส่งงานต่อไปยัง service, store, hook, หรือ backend-facing module ที่ควรตามอ่านจริง

### Error Handling Pattern

```typescript
// Service layer
try {
  return await apiClient.get(...);
} catch (error) {
  throw toApiError(error);
}

// Component layer
try {
  await mutation();
} catch (error) {
  showErrorMessage('หัวข้อ', error); // Thai message อัตโนมัติ
}
```

### UI

- **Font:** Kanit ทุก text (ไทย + EN)
- **Colors:** ห้ามใช้ purple/violet
- **Styling:** NativeWind (Tailwind class → `className="..."`)
- **Logging:** `Logger.*` เสมอ ห้าม `console.log`

---

## 15. Key Constraints (ห้ามละเมิด)

- **Cancel** ทำได้เฉพาะ GPIO27 บน device — ห้ามมีปุ่ม Cancel ใน mobile UI
- **Acknowledge** = กด `รับทราบแล้ว` เพื่อคืนมุมมองในแอปเป็นปกติเท่านั้น ไม่เขียน DB ไม่แตะ backend
- **Single-caregiver:** 1 User : 1 Elder — ห้าม implement multi-caregiver logic
- **Navigation:** `useProtectedRoute` เป็นคนตัดสินใจเดียว ห้ามแยก redirect ในหลายหน้า
- **Logging:** ห้าม `console.log` ใช้ `Logger.*` เท่านั้น
- **Device.status** = pairing state (`PAIRED/UNPAIRED`) ไม่ใช่ online/offline
- **online/offline** คำนวณจาก `lastOnline` timestamp ไม่ใช่ field ถาวร

---

## Related Docs

- [System Overview](system_overview.md)
- [Dashboard & UI/UX Spec](../features/dashboard.md)
- [Device Pairing](../features/device-pairing.md)
