# FallHelp — System Research (General)

## Doc Meta

- Audience: AI agents, developers working across multiple modules
- Source of Truth: cross-module architecture, active owner docs, and current package structure
- Status: Active
- Last Updated: May 10, 2026

---

## Overview

> 🎓 Senior Project — Fall Detection Wearable + Caregiver Mobile App
> Deep-read date: 2026-05-10

Use this file as cross-module system memory.
Follow the solo-developer workflow in `AGENTS.md`: small low-risk changes may proceed directly, but structural, schema, protocol, or safety-critical cross-stack changes should be planned first.

---

## 1. System Architecture

```
IoT Device (ESP32-WROOM-32U)
  → MQTT (Mosquitto 2.x / HiveMQ TLS)
    → Backend API (Express v5 + TypeScript)
      ├── Socket.io 4 → Mobile App (real-time events)
      ├── Expo Push    → Mobile App (push notifications)
      └── PostgreSQL 18 (event storage)

Admin Panel (React 19 + Vite) → Backend API → PostgreSQL
Mobile App (React Native 0.83.6, Expo SDK 55) → Backend API + Socket.io
```

### Fall Detection Pipeline (end-to-end)

```
MPU6050 (accel+gyro) → Threshold-Based Analysis (SVM + Complementary Filter)
  → suspected_fall (MQTT publish)
    → Backend creates Event(fallStage=PENDING_CONFIRMATION)
    → No Socket.io / Push; this stage is backend/database lifecycle only
    → 15s cancel window starts on device
      ├── Button pressed (GPIO27) → MQTT fall_cancelled → Backend updates Event(fallStage=CANCELLED), no Mobile realtime emit
      └── Timeout → fall_confirmed (MQTT) → Backend updates Event(fallStage=CONFIRMED)
                                           → Socket.io fall_detected + Push notification + in-app notification to the elder owner
```

---

## 2. Tech Stack

| Layer              | Technology                                              |
| ------------------ | ------------------------------------------------------- |
| **Backend**        | Node.js 24, Express v5, TypeScript 6.x                  |
| **Database**       | PostgreSQL 18, Prisma ORM 7                             |
| **Real-time**      | MQTT (Mosquitto 2.x), Socket.io 4                       |
| **Mobile**         | React Native 0.83.6, Expo SDK 55, Expo Router, NativeWind |
| **Admin**          | React 19, Vite, TailwindCSS v4, Heroicons, sonner         |
| **Firmware**       | C++ on Arduino IDE 2.x, ESP32-DevKitC V4                |
| **Fall Algorithm** | Threshold-Based Analysis (SVM + Complementary Filter)   |
| **Auth**           | JWT, OTP via email (Resend) — forgot password only      |
| **Push**           | Expo Push Notifications                                 |
| **Testing**        | Jest, React Native Testing Library, Supertest           |

---

## 3. Database Schema (Prisma)

### Models (7 total)

| Model              | Table                | Key Fields                                                                                                          | Relations                                                           |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `User`             | `users`              | id, email, password, firstName, lastName, gender, phone, pushToken, role                                            | → Elder (0..1), Notification[], AuthOtp[]                           |
| `AuthOtp`          | `auth_otps`          | id, userId, code, expiresAt                                                                                         | → User                                                              |
| `Elder`            | `elders`             | id, firstName, lastName, gender, dateOfBirth (DATE), height, weight, diseases?, address fields (houseNumber→zipcode) | → User (1:1 via unique userId), Device?, EmergencyContact[], Event[] |
| `Device`           | `devices`            | id, deviceCode (unique QR), serialNumber (unique), elderId?, status, **wifiStatus**, lastOnline, updatedAt          | → Elder?, Event[]                                                   |
| `EmergencyContact` | `emergency_contacts` | id, elderId, name, phone, relationship, priority                                                                    | → Elder                                                             |
| `Event`            | `events`             | id, elderId, deviceId, fallStage, bpm, magnitude, postureDelta, cancelledAt, timestamp                              | → Elder, Device, Notification[]                                     |
| `Notification`     | `notifications`      | id, userId, eventId, title, message, isRead, readAt                                                                 | → User, Event                                                       |

> ⚠️ ไม่มี `DeviceConfig` model แยก — `wifiStatus` และ connectivity fields อยู่บน `Device` โดยตรง

### Constrained TEXT Fields

ค่ากลุ่ม state/type/role ใน schema ปัจจุบันเก็บเป็น `TEXT` เพื่อให้อ่าน ER/schema ง่ายขึ้น
แต่ backend ยังจำกัด allowed values ผ่าน validation และ string unions ในโค้ด:

| Field                 | Allowed Values                              |
| --------------------- | ------------------------------------------- |
| `users.role`          | ADMIN, CAREGIVER                            |
| `users.gender`        | MALE, FEMALE, OTHER                         |
| `elders.gender`       | MALE, FEMALE, OTHER                         |
| `devices.status`      | PAIRED, UNPAIRED (pairing state only)       |
| `devices.wifiStatus`  | CONNECTED, DISCONNECTED, CONFIGURING, ERROR |
| `events.fallStage`    | PENDING_CONFIRMATION, CONFIRMED, CANCELLED  |

### Key Schema Decisions

- **Single-Caregiver model**: 1 User ↔ 1 Elder (multi-caregiver removed)
- ในระดับ schema ให้ตีความเป็น `User 1 -> Elder 0..1` และ `Elder -> User 1`
  - เพื่อรองรับ onboarding ที่ user ถูกสร้างก่อน elder และรองรับบัญชี `ADMIN`
  - เชิง business เมื่อ caregiver setup เสร็จแล้วจึงคาดหวังให้มี elder ครบ
- `events` ใช้ primary key แบบเดี่ยว (`id`) และคง index ตามเวลา (`timestamp`) สำหรับ query แบบช่วงเวลา
- `notifications.eventId` เป็น FK แบบ required ไปยัง `events.id` — notification ทุกตัวใน phase ปัจจุบันต้องมาจาก event
- **Device online/offline** is computed from `lastOnline` timestamp, NOT stored as a status field
- **`wifiStatus` vs `lastOnline`** — ทั้งคู่เป็น fields บน `Device` โดยตรง (ไม่มี DeviceConfig table แยก)
  - `wifiStatus` answers provisioning/connectivity questions such as "is WiFi connected?", "is the device configuring WiFi?", or "did WiFi setup fail?"
  - `lastOnline` answers presence questions such as "when did backend last see the device alive?" and "should the UI currently treat the device as online or offline?"
  - These fields must not be merged conceptually: `wifiStatus` is a WiFi/provisioning state, while online/offline remains a derived state from `lastOnline`
- **Elder lifecycle** is managed by Elder creation and deletion (cascade); the former `isActive` soft-hide field was removed as dead code

---

## 4. Cross-Module Flows

### Auth + OTP Flow

```
Register → hash password → create User → generate JWT
Login → find by email/phone → compare password → generate JWT
Forgot Password → requestOtp(email) → send OTP via Resend email → verifyOtp → resetPassword
Logout → clear pushToken (prevent stale notifications)
```

### Device Pairing Flow

```
Admin creates Device (serialNumber → auto-generate deviceCode)
  → QR Code generated from deviceCode
User scans QR → getDeviceByCode → pairDevice(userId, deviceCode, elderId)
  → BLE provisioning: scan → connect → sendWiFiCredentials → waitForStatus
  → WiFi connected → MQTT online → device starts sending data
Unpair → RESET_WIFI MQTT → device enters BLE mode
```

### MQTT → Socket.io → Push Pipeline

```
ESP32 publishes to device/{serialNumber}/event|status
  → Backend MQTT handler validates payload
  → Creates Event in DB (if needed)
  → Emits Socket.io event to caregiver room (elder:{elderId}) only when a fall is confirmed
  → For confirmed FALL: also creates Notification + sends Expo Push; HR value (BPM) stored in `bpm` on the confirmed FALL event
  → HR is stored on the related FALL event, not as a standalone event type
```

### Fall Lifecycle Source Of Truth

สำหรับ flow การล้มใน phase ปัจจุบัน ให้ยึด `fallStage` เป็น source of truth ของสถานะเหตุการณ์
เมื่อ logic ส่วนใดต้องตัดสินว่า event ยังรอยืนยัน, ยืนยันแล้ว, หรือถูกยกเลิก ให้ดูที่ `fallStage` ก่อน field อื่น

- `PENDING_CONFIRMATION` = suspected fall, เก็บใน DB และส่ง `event_status_changed/FALL_SUSPECTED` เป็น internal mobile signal แต่ยังไม่ส่ง notification
- `CONFIRMED` = confirmed fall, ส่ง `fall_detected`, `event_status_changed/FALL_CONFIRMED`, notification และแสดงสถานะฉุกเฉิน
- `CANCELLED` = false alarm ที่ผู้สวมใส่กดยกเลิกจากอุปกรณ์ ส่ง `event_status_changed/FALL_CANCELLED` เพื่อ clear pending guard แต่ไม่ส่ง notification

State transition guard: `fall_cancelled` ยกเลิกได้เฉพาะ event ที่ยังเป็น `PENDING_CONFIRMATION` เท่านั้น
ถ้า backend ได้รับ `fall_cancelled` ช้าหลังจาก event เป็น `CONFIRMED` แล้ว ต้อง ignore และห้ามย้อนกลับเป็น `CANCELLED`

field อื่นเช่น `cancelledAt`, `bpm`, `magnitude`, `postureDelta` เป็นข้อมูลประกอบ ไม่ใช่ตัวตัดสิน lifecycle หลัก

---

## 5. Shared Patterns Across Modules

| Pattern                      | Where Used                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------- |
| **Singleton managers**       | MQTTClientManager, SocketServerManager, BLEService                           |
| **JWT auth with Bearer**     | Backend middleware, Mobile API interceptor, Admin API service                |
| **ApiError normalization**   | Backend `utils/ApiError.ts`, Mobile `services/api.ts`                        |
| **Logger (not console.log)** | Backend `utils/logger.ts`, Mobile `utils/logger.ts`, Admin `utils/logger.ts` |
| **configValidator**          | Backend, Mobile, Admin — all validate env vars at startup                    |
| **Kanit font**               | Mobile (NativeWind + assets), Admin (CSS import)                             |
| **No purple/violet**         | Mobile and Admin UI guideline                                                |
| **React Query**              | Mobile hooks, Admin hooks — shared staleTime/gcTime config                   |
| **debug (createDebug)**      | Backend uses `debug` library with `fallhelp:*` namespaces                    |
| **Server timestamps**        | ESP32 millis() is ignored; backend uses `new Date()` for all events          |

---

## 6. Services/Endpoints Summary

### Backend API Routes (`/api/...`)

| Route                 | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `/internal/health`    | Health check (public, no auth; mounted outside `/api`)               |
| `/auth`               | Register, login, logout, OTP request/verify, reset password          |
| `/users`              | Profile, password, push token, user's elder list                     |
| `/elders`             | Elder create/list/detail/update                                      |
| `/devices`            | Device lookup by code, WiFi config (GET/PUT)                         |
| `/device-pairings`    | Pair/unpair device with elder                                        |
| `/events`             | Get events by elder, event detail, monthly summary                   |
| `/elders/:elderId/emergency-contacts` | CRUD + reorder emergency contacts for one elder          |
| `/notifications`      | List, unread count, mark read (body-based), mark all read            |
| `/admin`              | Device list, create, delete, and force-unpair for admin operations    |

---

## Working Note

- Use this file to understand end-to-end impact before changing more than one module
- For changes affecting MQTT payloads, DB schema, Socket.io events, push notifications, or caregiver-facing alert behavior, review the full pipeline before editing

---

## Related Docs

- [AI Module Router](AI_MODULE_ROUTER.md)
- [Agent Reference](agent-reference.md)
- [System Design](../architecture/system-design.md)
- [API Reference](../api/api-reference.md)
