# Socket.io Real-time System

## Doc Meta

- Audience: Backend Dev / Mobile Dev
- Source of Truth: [socketServer.ts](../../apps/backend-api/src/realtime/socketServer.ts)
- Status: Active
- Last Updated: May 10, 2026

---

## Overview

FallHelp ใช้ **Socket.io** สำหรับการสื่อสารแบบ Real-time ระหว่าง Backend กับ Mobile App เพื่อให้ผู้ดูแลได้รับการแจ้งเตือนทันทีขณะเปิดแอป (< 1 วินาที)

---

## Connection Flow

```text
Client connect -> emit authenticate(token, elderId) -> JWT verify -> join user/elder rooms -> receive realtime events
```

**Authentication:**

- Client เชื่อมต่อ socket ก่อน แล้วส่ง event `authenticate`
- Payload ปัจจุบันใช้ `{ token, elderId }`
- Server verify JWT ก่อนให้เข้า room ใด ๆ
- ถ้า token ไม่ถูกต้อง → socket ได้รับ `authenticated: { success: false }`

**Room System:**

- ทุก client จะถูกผูกกับ room `user:{userId}` หลัง authenticate สำเร็จ
- ถ้าส่ง `elderId` มาและตรวจ ownership ผ่าน จะ join room `elder:{elderId}`
- ระบบปัจจุบันบังคับ 1 user = 1 active socket session หลัก ถ้า login ซ้ำ session เก่าจะถูกตัด

---

## Events Reference

### fall_detected

**เมื่อไร:** ตรวจพบการหกล้ม (Confirmed)

```typescript
{
  eventId: string;
  elderId: string;
  elderName: string; // "สมชาย ใจดี"
  deviceId: string;
  deviceCode: string; // "8E5D02FB"
  timestamp: string; // ISO timestamp
  accelerationMagnitude: number; // 12.5 (g-force)
  bpm?: number | null;
}
```

**Mobile Action:** เปิดหน้า Full-Screen Fall Alert สีแดง

---

### event_status_changed

**เมื่อไร:** backend เปลี่ยน lifecycle ของ fall event ระหว่าง suspected / confirmed / cancelled

```typescript
{
  eventId?: string;
  elderId: string;
  deviceId: string;
  deviceCode: string;
  status: "FALL_SUSPECTED" | "FALL_CONFIRMED" | "FALL_CANCELLED";
  timestamp: string; // ISO timestamp
  bpm?: number | null;
}
```

**Mobile Action:** ใช้เป็น internal guard ระหว่างรอ confirmed/cancelled และ clear pending guard หลังจบ flow; ไม่ใช้แทน `fall_detected` สำหรับ caregiver alert หลัก

---

### heart_rate_update

**เมื่อไร:** ชีพจรปกติ (อัปเดตค่าบน Dashboard)

```typescript
{
  elderId: string;
  elderName: string;
  deviceId: string;
  deviceCode: string;
  timestamp: string; // ISO timestamp
  heartRate: number; // 72 BPM
  confidence?: "none" | "low" | "medium" | "high";
}
```

**Mobile Action:** อัปเดตค่า BPM บน Dashboard (ไม่แสดง Alert)

---

### device_status_update

**เมื่อไร:** อุปกรณ์ Online/Offline

```typescript
{
  deviceId: string;
  deviceCode: string;
  elderId: string;
  elderName: string;
  online: boolean;
  signalStrength?: number;    // RSSI (dBm)
  wifiSSID?: string;
  timestamp: string; // ISO timestamp
  source?: string;
  serverTimestamp?: string;
  deviceTimestamp?: number | null;
}
```

**Mobile Runtime Filter:** `apps/mobile/hooks/useSocketConnection.ts` ใช้ event นี้เป็น realtime device truth เฉพาะเมื่อ `source === "mqtt_status_update"` และ `serverTimestamp` parse ได้เท่านั้น เพื่อกัน snapshot เก่าหรือ packet ที่ไม่มี server time มาเปลี่ยนสถานะ online/offline ปัจจุบัน

---

### system_message

**เมื่อไร:** Broadcast ข้อความจากระบบ (เช่น Maintenance Notice)

```typescript
{
  message: string;
  data?: unknown;
  timestamp: string; // ISO timestamp
}
```

---

## CORS Configuration

```typescript
origin: (origin, callback) => {
  if (isAllowedClientOrigin(origin)) {
    callback(null, true);
  }
};
```

- **Mobile App:** ไม่มี Origin header → อนุญาตอัตโนมัติ
- **Development:** อนุญาต `localhost:*`, `127.0.0.1:*`, LAN IP (`192.168.*`, `10.*`) และ Expo scheme
- **Production:** ใช้ allowlist จาก `FRONTEND_URL`, `ADMIN_URL`, และ `API_BASE_URL`

---

## Client Implementation Notes

### Connection (React Native)

```typescript
import { io } from "socket.io-client";

const socket = io(SOCKET_URL, {
  transports: ["polling", "websocket"],
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,
  timeout: 10000,
});

socket.on("connect", () => {
  socket.emit("authenticate", {
    token: jwtToken,
    elderId: "elder-uuid",
  });
});

socket.on("fall_detected", (data) => {
  // Show full-screen alert
});

socket.on("event_status_changed", (data) => {
  // Maintain internal fall pending guard
});

socket.on("heart_rate_update", (data) => {
  // Update dashboard BPM display
});
```

### Reconnection

Socket.io มี auto-reconnect ใน transport layer อยู่แล้ว แต่แอปปัจจุบันยังมี logic เพิ่มใน `apps/mobile/hooks/useSocketConnection.ts` สำหรับ:

- re-authenticate หลัง reconnect
- stale watchdog สำหรับ mark device offline เมื่อ realtime activity เก่าเกิน 15 วินาที
- debounce การ mark offline เพื่อกัน connection flapping
- grace period 8 วินาทีหลัง authenticate ก่อนรับ offline event แรก

### Device Online / Offline Timing

ค่าปัจจุบันของ realtime device status ใช้ heartbeat เป็นตัวหลัก และใช้ MQTT LWT เป็นสัญญาณเสริม:

| Layer | Timing | Purpose |
| :---- | :----- | :------ |
| Firmware status heartbeat | ส่ง `device/{serial}/status` ทุก 5 วินาที | เป็น source หลักในการยืนยันว่าอุปกรณ์ยัง online |
| Mobile watchdog | ตรวจทุก 1 วินาที และ mark offline เมื่อ realtime activity หายเกิน 15 วินาที | ให้หน้าแอปเปลี่ยน offline โดยอิง heartbeat/heart-rate ล่าสุด ไม่ใช่ socket disconnect อย่างเดียว |
| Backend / Admin freshness | ถือว่า offline เมื่อ `lastOnline` เกิน 15 วินาที | เป็น threshold กลางสำหรับ API/Admin และกรณีไม่มี socket สด |
| MQTT LWT | ใช้ทันทีเมื่อ broker trigger | เป็น fast signal เสริม แต่ไม่ใช้เป็น source เดียว เพราะเวลา trigger ขึ้นกับ broker/keepalive/network |

ผลทดสอบ hardware วันที่ 2026-04-28:

| Case | Observed Timing | Notes |
| :--- | :-------------- | :---- |
| Steady online heartbeat | status มาทุกประมาณ 5.0 วินาที | MQTT verbose เห็น `15:44:39.670`, `15:44:44.669`, `15:44:49.679`, `15:44:54.688`, `15:44:59.704`, `15:45:04.700`, `15:45:09.692`, `15:45:14.696`, `15:45:19.703`, `15:45:24.707` |
| Power/reboot to MQTT online | ประมาณ 5.5 วินาทีจาก boot banner ถึง status online แรก | Serial `15:44:04.143` → MQTT status `15:44:09.647`; ถ้านับจาก `SW_CPU_RESET` คือประมาณ 7.1 วินาที |
| WiFi connected to MQTT online | ประมาณ 1.8 วินาที | Serial WiFi connected `15:44:07.841` → MQTT status `15:44:09.647` |
| Mobile expected offline after power-off | ประมาณ 15-16 วินาทีหลัง realtime activity ล่าสุด | MQTT status ล่าสุด `15:45:24.707` → mobile watchdog ควร mark offline แถว `15:45:39.707` ถึง `15:45:40.707` ตามรอบตรวจ 1 วินาที |
| Backend/Admin expected offline after power-off | ประมาณ 15 วินาทีหลัง status ล่าสุด | MQTT status ล่าสุด `15:45:24.707` → backend/admin threshold แถว `15:45:39.707` |
| LWT trigger after short reconnect | ประมาณ 24.2 วินาทีหลัง status ล่าสุด | MQTT status ล่าสุด `15:39:04.793` → LWT `15:39:28.970`; เป็นสัญญาณจาก broker ไม่ใช่ตัวหลัก |
| LWT trigger after power-off | ประมาณ 46.1 วินาทีหลัง status ล่าสุด | MQTT status ล่าสุด `15:45:24.707` → LWT `15:46:10.822`; ช้ากว่า heartbeat timeout จึงใช้เป็น fallback เท่านั้น |

Expected UX:

- หน้าแอปควรแสดง offline ภายในประมาณ 15-16 วินาทีหลัง realtime activity ล่าสุดหาย
- Backend/Admin ควรสะท้อน offline ไม่เกินประมาณ 15 วินาทีหลัง status ล่าสุด
- เมื่อเปิดเครื่องกลับมา ถ้า WiFi/MQTT พร้อมแล้ว หน้าแอปควรกลับ online หลัง backend ได้รับ status แรก โดย hardware test รอบนี้อยู่ราว 5-6 วินาทีจาก boot ช่วงปกติ

---

## Related Docs

- [Notification System](notifications.md)
- [API Reference](../api/api-reference.md)
- [Backend AI Context](../ai/backend.md)
- [Mobile AI Context](../ai/mobile.md)
