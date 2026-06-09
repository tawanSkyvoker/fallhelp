# Notification System

# คู่มือระบบแจ้งเตือน

## Doc Meta

- Audience: Backend Dev / Mobile Dev / QA
- Source of Truth: [notificationService.ts](../../apps/backend-api/src/services/notificationService.ts), [fallHandler.ts](../../apps/backend-api/src/iot/handlers/fallHandler.ts), [useSocketConnection.ts](../../apps/mobile/hooks/useSocketConnection.ts), [usePushNotifications.ts](../../apps/mobile/hooks/usePushNotifications.ts), [pushNotification.ts](../../apps/backend-api/src/utils/pushNotification.ts)
- Status: Active
- Last Updated: May 21, 2026

---

## Overview

ระบบแจ้งเตือนของ FallHelp ออกแบบมาเพื่อให้ผู้ดูแลได้รับข้อมูลสำคัญทันที (Real-time) ผ่านหลายช่องทาง โดยแยกกติกาชัดว่า:

- `fall_confirmed` = Socket + Push + Notification history
- สถานะอุปกรณ์ online/offline = แสดงแบบ real-time บน Dashboard ไม่สร้าง notification ปกติ
- BPM ณ ขณะหกล้มถูกเก็บใน `Event.bpm` ของ `FALL` event และใช้ประกอบข้อความแจ้งเตือนเมื่อมีข้อมูล

คู่มือนี้อธิบาย boundary ของ Expo Push Notification ใน FallHelp ตั้งแต่การขอ permission, การเก็บ token, การส่งผ่าน backend, และข้อจำกัดระหว่าง push กับ in-app alerts

---

## Notification Types

| Source Event | Trigger Condition       | Channels           |
| :----------- | :---------------------- | :----------------- |
| **Event**    | `fallStage = CONFIRMED` | Socket + Push + DB |

**Notification Scope:**

| Source Event                 | Channel       | Title                | Body                                                            |
| ---------------------------- | ------------- | -------------------- | --------------------------------------------------------------- |
| Fall event (`eventId`)       | Push + In-App | ตรวจพบการหกล้ม!     | {elderName} อาจล้ม ชีพจร: {bpm} BPM (หากมีข้อมูล)             |

> **Push notification ใน phase ปัจจุบันมาจาก fall event เท่านั้น** — ไม่มี standalone HR notification
> BPM ณ ขณะล้มแนบไปกับ fall notification โดยตรง (ถ้า sensor อ่านค่าได้ภายใน 5 นาที)
> Dashboard card มาจาก Socket.io realtime ส่วน badge กระดิ่งและ notification list จะ sync หลัง backend สร้าง notification record จริง

---

## Notification Channels

เราใช้ 3 ช่องทางหลักในการแจ้งเตือน:

| Channel               | Tech Stack    | Use Case                                            | Speed         |
| :-------------------- | :------------ | :-------------------------------------------------- | :------------ |
| **Real-time Alert**   | Socket.io     | หน้าจอแจ้งเตือนสีแดง (Full Screen Alert) ขณะเปิดแอป | ทันที (<1s)   |
| **Push Notification** | Expo Push API | แจ้งเตือนเมื่อล็อกหน้าจอ หรือปิดแอปอยู่             | เร็ว (1-5s)   |
| **In-App History**    | PostgreSQL    | ประวัติการแจ้งเตือนย้อนหลัง + badge กระดิ่ง          | หลัง backend สร้าง record แล้ว mobile refetch |

---

## Push Implementation (Expo)

### Supported Platforms

| Platform         | Development | Production | Firebase Required |
| ---------------- | :---------: | :--------: | :---------------: |
| Android Emulator |      ✓      |     -      |   ✓ ต้องติดตั้ง   |
| iOS Simulator    |      ✓      |     -      |     ✗ ไม่ต้อง     |
| Android Device   |      ✓      |     ✓      |   ✓ ต้องติดตั้ง   |
| iOS Device       |      ✓      |     ✓      |     ✗ ไม่ต้อง     |

### Quick Start

**1. ติดตั้ง Dependencies:**

```bash
npx expo install expo-notifications expo-device expo-constants
```

**2. ขอ Permission และ Token:**

```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    console.log("Permission not granted");
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: "your-expo-project-id",
  });

  return token.data;
}
```

**3. ส่ง Token ไป Backend:**

```typescript
await api.put("/api/users/me/push-token", {
  pushToken: token,
});
```

### Firebase Setup (Android Only)

1. **สร้าง Firebase Project** — ไปที่ [Firebase Console](https://console.firebase.google.com/)
2. **เพิ่ม Android App** — Package name: `com.yourcompany.fallhelp`, Download `google-services.json`
3. **วางไฟล์ในโปรเจค:**

```
apps/mobile/
├── app.json
├── google-services.json  ← วางที่นี่
└── ...
```

1. **Update app.json:**

```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.fallhelp",
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### Backend Internal Function

```typescript
// apps/backend-api/src/utils/pushNotification.ts
import { Expo } from "expo-server-sdk";

const expo = new Expo();

async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: object,
) {
  const message = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data,
  };

  const [ticket] = await expo.sendPushNotificationsAsync([message]);
  return ticket;
}
```

### Token Management

- Token ถูกเก็บที่ `users.pushToken`
- Mobile App อัปเดต Token ทุกครั้งที่เปิดแอป (`registerPushToken`)
- เมื่อ mobile logout จะเรียก `POST /api/auth/logout` ก่อนล้าง local JWT เพื่อให้ backend ล้าง `users.pushToken`
- โมเดลปัจจุบันเป็น 1 User ↔ 1 Elder จึงส่งไปยังเจ้าของ elder คนนั้น

---

## Architecture Flow

ตัวอย่าง Flow: **Fall Confirmed**

1. **IoT Device:** ส่ง `fall_confirmed` (พร้อมค่า BPM ถ้ามี) ผ่าน MQTT
2. **Backend (`fallHandler.ts`):**
   - ค้นหา pending event และอัปเดต `fallStage` เป็น `CONFIRMED`
   - บันทึก BPM ใน `Event.bpm` จาก heart-rate cache (ถ้ามี)
3. **Trigger Alert Channels:**
   - **Socket:** Emit `fall_detected` ไปยัง room ของ elder ก่อน เพื่อให้ Dashboard card ตอบสนองเร็วที่สุด
   - **DB:** สร้าง record ลง `notifications` table (สำหรับ History)
   - **Push:** ส่ง Expo Push Notification ผ่าน Expo Push API

> ลำดับนี้ตั้งใจให้ real-time card เร็วกว่าหรือมาพร้อม push ส่วน badge กระดิ่งและ notification list ไม่ทำ optimistic fake item แต่รอ refetch หลัง backend สร้าง `Notification` จริงแล้ว จึงควรมาพร้อมกัน

---

## Socket vs Push Distinction

### Socket.io Events (Namespace: `/`)

Events ที่ Mobile App ต้อง Listen:

- `fall_detected` → เปิดหน้า Fall Alert
- `event_status_changed` → lifecycle signal ภายในสำหรับ pending/confirmed/cancelled guard; ไม่สร้าง caregiver alert หรือ notification record
- `heart_rate_update` → อัปเดตค่า BPM บน Dashboard (real-time, ไม่สร้าง notification)
- `device_status_update` → อัปเดตสถานะ online/offline ของอุปกรณ์

### Database Schema

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  title     String
  message   String
  isRead    Boolean  @default(false)

  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
}
```

> `Notification` ใน phase ปัจจุบันมาจาก fall event เท่านั้น จึงบังคับ `eventId` และใช้ `onDelete: Cascade` เพื่อไม่ให้เหลือ history ที่ไม่มี event ต้นทาง

### Client-Side Handling (Mobile)

**Foreground:**

- Socket event เข้ามา → แสดง Modal/Overlay ทันที
- `useSocketConnection` หน่วงสั้น ๆ แล้ว refetch `unread-count` และ notification list พร้อมกัน เพื่อให้จุดแดงกระดิ่งไม่ขึ้นก่อนรายการจริง
- Push Notification เข้ามา → invalidate notification/history queries และใช้เป็น fallback เมื่อแอปอยู่ foreground

**Background/Quit:**

- User แตะที่ Push Notification → นำทางไปยังหน้า **Dashboard (หน้าหลัก)** เสมอ
- ไม่ deep link ไปหน้า Event Detail โดยตรง — เพื่อให้ผู้ดูแลเห็น real-time status ก่อนตัดสินใจ (โทร หรือดูรายละเอียด)

---

## Backend API Endpoints

### ลงทะเบียน Expo Push Token

```
PUT /api/users/me/push-token
```

**Request Body:**

```json
{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

### Logout และล้าง Push Token

```
POST /api/auth/logout
```

Mobile ต้องเรียก endpoint นี้ก่อนล้าง local JWT เพื่อให้ backend ตั้งค่า `users.pushToken = null`
และหยุดส่ง push ไปยังเครื่อง/session ที่ออกจากระบบแล้ว

---

## Troubleshooting

| ปัญหา                 | วิธีแก้ไข                       |
| --------------------- | ------------------------------- |
| Token เป็น null       | ใช้อุปกรณ์จริง ไม่ใช่ Simulator |
| Android ไม่ได้รับ     | Setup Firebase ก่อน             |
| iOS Simulator ไม่แสดง | ปกติ - ใช้อุปกรณ์จริงทดสอบ      |
| Backend ส่งไม่ได้     | ตรวจสอบ projectId ใน app.json   |

---

## Related Docs

- [Realtime System](realtime.md)
- [Fall Detection System](fall-detection.md)
- [API Reference](../api/api-reference.md)
- [Mobile AI Context](../ai/mobile.md)
- [Backend AI Context](../ai/backend.md)
