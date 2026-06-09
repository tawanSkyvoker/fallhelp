# FallHelp Backend — Deep Research

## Doc Meta

- Audience: AI agents, backend developers, reviewers touching `apps/backend-api/`
- Source of Truth: `apps/backend-api/src/`, Prisma schema, backend owner docs, and runtime contracts
- Status: Active
- Last Updated: May 21, 2026

---

## Overview

> Deep-read date: 2026-05-10

Use this file as backend system memory.
Follow the workflow in `AGENTS.md`: focused local changes may proceed directly, but structural, schema, protocol, or safety-critical changes should be planned first.

---

## 1. Project Structure (`apps/backend-api/src/`)

```
src/
├── app.ts              # Express v5 config: CORS, JSON parser, rate limit
├── server.ts           # HTTP server bootstrap: MQTT connect, Socket.io init, schedulers
├── prisma.ts           # PrismaClient singleton
├── config/
│   ├── env.ts          # Runtime-safe env boundary + allowed origin parsing
│   └── origin.ts       # Shared CORS/origin policy for Express + Socket.io
├── controllers/        # 9 Route handlers (8 domain + 1 internal health)
│   ├── authController.ts
│   ├── userController.ts
│   ├── elderController.ts
│   ├── deviceController.ts
│   ├── eventController.ts
│   ├── emergencyContactController.ts
│   ├── notificationController.ts
│   ├── adminController.ts
│   └── internal/
│       └── healthController.ts
├── services/           # 8 Business logic services
│   ├── authService.ts        # register, login, OTP, reset password, profile, logout
│   ├── deviceService.ts      # pair/unpair, WiFi config, QR, device status
│   ├── eventService.ts       # create/list/detail event, device cancel, monthly summary
│   ├── notificationService.ts # push + in-app notifications, mark read
│   ├── userService.ts        # profile, password, push token, related resources
│   ├── elderService.ts       # create/list/detail/update
│   ├── emergencyContactService.ts
│   └── adminService.ts       # admin device list/create/delete/unpair
├── routes/             # Route files
│   ├── index.ts              # Central router: /auth, /users, /elders, /devices,
│   │                         #   /device-pairings, /events, /notifications, /elders/:elderId/emergency-contacts, /admin
│   ├── authRoutes.ts         # POST register/login/request-otp/verify-otp/reset-password; POST logout
│   ├── userRoutes.ts         # GET/PATCH /me; PUT /me/password; PUT /me/push-token
│   ├── elderRoutes.ts        # POST create; GET list/by-id; PUT update
│   ├── deviceRoutes.ts       # GET by-code; PUT/GET wifi-config
│   ├── eventRoutes.ts        # GET list/by-id; GET monthly summary
│   ├── emergencyContactRoutes.ts
│   ├── devicePairingRoutes.ts # POST pair; DELETE unpair
│   ├── notificationRoutes.ts # GET list/unread-count; PATCH :id (body-based); PATCH / (mark-all-read)
│   ├── adminRoutes.ts        # GET/POST/DELETE devices; POST devices/:id/unpair
│   └── internal/
│       └── healthRoutes.ts   # GET / (mounted at /internal/health in app.ts)
├── middlewares/        # 4 Middleware files
│   ├── auth.ts               # JWT authenticate + requireAdmin
│   ├── errorHandler.ts       # Global error handler + 404 handler + asyncHandler wrapper
│   ├── rateLimit.ts          # express-rate-limit config
│   └── validation.ts         # custom validate(ValidationRule[]) factory + pre-built validators (validateLogin, validateRegister, etc.)
├── constants/          # Shared constants
│   ├── domain.ts             # Domain/System-wide constraints (fall stage values, etc.)
│   └── heartRate.ts          # HR thresholds & zones
├── iot/
│   ├── mqttClient.ts         # MQTTClientManager singleton — connect, subscribe, handle messages
│   ├── topics.ts             # MQTT topic definitions + payload interfaces
│   ├── payloadValidator.ts   # Validate fall/heartRate/status payloads
│   ├── eventNormalizer.ts    # Normalize unified MQTT events to internal snapshots
│   └── handlers/
│       ├── fallHandler.ts          # suspected/confirmed fall with dedup + 15s cancel window
│       ├── fallCancelledHandler.ts # Device button press → cancel event
│       ├── heartRateHandler.ts     # Abnormal detection with 60s cooldown
│       └── statusHandler.ts        # Online/offline + RESET_WIFI for unpaired devices
├── realtime/
│   └── socketServer.ts       # SocketServerManager singleton — JWT auth, room management
├── schedulers/
│   └── otpScheduler.ts       # Background OTP cleanup scheduler
├── utils/              # 13 Utility modules
│   ├── ApiError.ts           # Structured error factory with error codes
│   ├── jwt.ts                # generateToken, verifyToken, JwtPayload types
│   ├── password.ts           # hashPassword, comparePassword, generateOtp, isPasswordStrong
│   ├── email.ts              # Resend email service (OTP emails)
│   ├── pushNotification.ts   # Expo Push Notification sender
│   ├── logger.ts             # Project logger helper (console-backed with structured context)
│   ├── configValidator.ts    # Validate env vars at startup
│   ├── deviceConnectivity.ts # isDeviceOnline() threshold logic
│   ├── deviceSemantics.ts    # attachDeviceSemantics() — เติม onlineStatus/pairingStatus บน device object
│   ├── deviceSerial.ts       # isValidDeviceSerial(), normalizeDeviceSerial()
│   ├── fileCleanup.ts        # Clean up orphaned uploaded files
│   ├── time.ts               # getDateRange() helper
│   └── param.ts              # Route parameter helper
├── __tests__/          # Unit and integration tests
├── types/              # Express Request augmentation (req.user)
└── generated/          # Auto-generated Prisma client
```

**Import strategy note:** backend ยังใช้ relative imports เป็นหลักใน `src/` และ `scripts/`
เพื่อให้ `tsx` (dev), `tsc` (build), `node dist/*` (runtime), และ Jest resolve ตรงกันโดยไม่ต้องเพิ่ม alias layer ฝั่ง Node

**Docker runtime note:** container production/runtime ของ backend ปัจจุบันรันจาก `dist/server.js`
ไม่ใช้ `tsx` ใน container แล้ว
โดยขั้น build จะมี post-build step เติม `.js` specifier ให้ output ESM เพื่อให้ Node runtime ใน container โหลดไฟล์ `dist/` ได้ตรง
และ runtime image จะติดตั้งเฉพาะ production dependencies ของ backend เพื่อลด image footprint

**Architecture note:** Controller-Service is the default application pattern in this repository.
Routes and controllers stay thin; introduce a repository layer only when it clearly reduces repeated persistence complexity or isolates a meaningful external integration.

---

## 2. Prisma Schema (Full Details)

### Models

**User** — `users` table

- `id` UUID PK, `email` unique, `password` hash, `firstName`, `lastName`, `gender?` (TEXT with backend validation: MALE/FEMALE/OTHER), `phone?` unique nullable, `profileImage?`, `pushToken?` (Expo), `role` (TEXT default CAREGIVER; allowed ADMIN/CAREGIVER)
- Relations: Elder? (0..1), Notification[], AuthOtp[]

**AuthOtp** — `auth_otps` table

- `id`, `userId` → User (cascade), `code`, `expiresAt`
- Index: `[userId, expiresAt]`

**Elder** — `elders` table

- `id`, `firstName`, `lastName`, `gender?` (TEXT with backend validation: MALE/FEMALE/OTHER), `dateOfBirth?` (DATE / `YYYY-MM-DD`), `height?`, `weight?`, `diseases?` (optional free-text note, e.g. "Diabetes, Hypertension")
- Address: houseNumber, villageNumber, villageName, subdistrict, district, province, zipcode
- `userId` unique → User (cascade, 1:1)
- Relations: Device?, EmergencyContact[], Event[]

> `isActive` field was removed — it was never set to false (always defaulted true) and was dead code.

**Device** — `devices` table

- `id`, `deviceCode` unique (QR), `serialNumber` unique, `elderId?` unique → Elder (SetNull), `status` (TEXT; allowed PAIRED/UNPAIRED — pairing state only, not online/offline), `wifiStatus` (TEXT; allowed CONNECTED/DISCONNECTED/CONFIGURING/ERROR), `lastOnline?`, `updatedAt`
- Online/offline computed via `isDeviceOnline()` in `deviceConnectivity.ts`, not stored as status
- Relations: Event[]

> ⚠️ ไม่มี `DeviceConfig` model แยก — `wifiStatus` อยู่บน `Device` โดยตรง (ไม่มี `device_configs` table)

### Connectivity Semantics

- `Device.status` = pairing state only (`PAIRED` / `UNPAIRED`)
- `wifiStatus` = WiFi/provisioning state
  - `CONNECTED` → device reported WiFi connectivity successfully
  - `DISCONNECTED` → device is not currently connected to WiFi or was marked offline
  - `CONFIGURING` → backend/device are in the middle of WiFi setup flow
  - `ERROR` → WiFi setup or config acknowledgement flow failed
- `lastOnline` = latest server-side timestamp proving the backend saw the device alive
- UI online/offline must be derived from `lastOnline`, not from `wifiStatus`
- Practical rule:
  - use `wifiStatus` to explain WiFi/provisioning progress
  - use `lastOnline` to decide presence (`ONLINE` / `OFFLINE`)

**EmergencyContact** — `emergency_contacts` table

- `id`, `elderId` → Elder (cascade), `name`, `phone`, `relationship?`, `priority` Int
- Unique: `[elderId, priority]` — no duplicate priority per elder

**Event** — `events` table

- Primary key: `id`
- `elderId` → Elder (cascade), `deviceId` → Device (cascade)
- `fallStage` TEXT (allowed `PENDING_CONFIRMATION` / `CONFIRMED` / `CANCELLED`), `bpm?` Int (BPM at fall time, null if unavailable), `magnitude?` Float, `postureDelta?` Float, `cancelledAt?`
- Indexes: `[elderId, timestamp DESC]`, `[deviceId, timestamp DESC]`, `[deviceId, fallStage, cancelledAt, timestamp DESC]`

**Notification** — `notifications` table

- `id`, `userId` → User, `eventId` → Event (`onDelete: Cascade`)
- `title`, `message`, `isRead`, `readAt?`

## 3. MQTT System

### Topics

| Subscribe Pattern     | Handler            | Direction       |
| --------------------- | ------------------ | --------------- |
| `device/+/fall`       | fallHandler        | ESP32 → Backend |
| `device/+/heartrate`  | heartRateHandler   | ESP32 → Backend |
| `device/+/status`     | statusHandler      | ESP32 → Backend |
| `device/+/event`      | handleUnifiedEvent | ESP32 → Backend |
| `device/+/config/ack` | handleConfigAck    | ESP32 → Backend |
| `events/+`            | handleUnifiedEvent | ESP32 → Backend |
| `device/+/lwt`        | statusHandler      | Broker → Backend |

| Publish Pattern      | Purpose                 | Direction       |
| -------------------- | ----------------------- | --------------- |
| `device/{serialNumber}/config` | WiFi config, RESET_WIFI | Backend → ESP32 |

> `device/+/event` คือ canonical topic จาก firmware ปัจจุบัน ส่วน `device/+/fall`, `device/+/heartrate`, และ `events/+` ยังถูกรับไว้เพื่อ compatibility กับ payload รุ่นเก่า
> `device/+/lwt` เป็น Last Will & Testament จาก broker และถูก route เข้า `statusHandler` เป็น `online=false`

### Payload Interfaces

**FallDetectionPayload**: `{ timestamp, magnitude, postureDelta, bpm? }`

> หมายเหตุ: `type` อยู่ใน unified MQTT event envelope ก่อน จากนั้น `mqttClient` จะ map เหลือ normalized snapshot นี้ให้ handler ใช้งาน

**HeartRatePayload**: `{ timestamp, heartRate, zone?, confidence?, isAbnormal?, alertType? }`

**DeviceStatusPayload**: `{ timestamp, online, signalStrength?, ip?, wifiSSID? }`

**DeviceConfigPayload**: `{ wifiSSID?, wifiPassword?, requestId?, action?, reason?, deviceSerial? }`

**DeviceConfigAckPayload**: `{ requestId, success, timestamp, reason?, ip? }`

### Handler Details

**fallHandler** — 2 modes: `suspected_fall` and `fall_confirmed`

- Dedup: 30s for confirmed, 15s for suspected (prevents MQTT QoS 1 retransmission)
- Suspected: creates Event(fallStage=PENDING_CONFIRMATION), emits internal `event_status_changed/FALL_SUSPECTED` to mobile, but sends no caregiver alert or push
- Confirmed: finds pending event within 2 minutes, updates to fallStage=CONFIRMED, emits `fall_detected` + `event_status_changed/FALL_CONFIRMED`, then creates notification + sends push
- Persisted evidence stays lean: `bpm`, `cancelledAt`, `fallStage`, `magnitude`, `postureDelta`

> ระบบปัจจุบันควรยึด `fallStage` เป็น source of truth ของ lifecycle เหตุการณ์
> ถ้าต้องตัดสินว่า event อยู่ในสถานะ suspected / confirmed / cancelled ให้ดู `fallStage` ก่อน field อื่น
> ส่วน `cancelledAt`, `bpm`, `magnitude`, `postureDelta` ใช้เป็นข้อมูลประกอบ ไม่ใช่ตัวตัดสิน lifecycle หลัก

**fallCancelledHandler** — Device button press

- Finds device by serialNumber, calls `cancelFallEventByDevice(deviceId)`, updates DB lifecycle, emits internal `event_status_changed/FALL_CANCELLED`, but sends no caregiver alert or push
- Cancel only applies to `PENDING_CONFIRMATION` events. A late `fall_cancelled` received after an event is already `CONFIRMED` must be ignored and must never transition `CONFIRMED` back to `CANCELLED`.

**heartRateHandler** — HR real-time relay (no DB events)

- Trusts device-side `alertType`/`zone`/`isAbnormal`
- Does NOT create standalone HR events in DB
- BPM at fall time is stored in `Event.bpm` on FALL events instead
- HR threshold: Low < 60 BPM, Normal 60–100 BPM, High > 100 BPM
- Emits `heart_rate_update` socket event for real-time Dashboard display
- heartRate=0: sensor removed, emit socket update to clear UI
- No standalone HR notifications (push or in-app)

**statusHandler** — Device heartbeat

- Updates `lastOnline` and `wifiStatus`
- Guard: if device UNPAIRED → sends RESET_WIFI via MQTT, sets wifiStatus=DISCONNECTED
- `RESET_WIFI` commands are published retained so offline devices receive the reset when they return
- Pairing clears any stale retained config command best-effort to avoid an old reset affecting the newly paired flow
- Current semantics:
  - `online=true` heartbeat updates `lastOnline` and moves `wifiStatus` to `CONNECTED`
  - `online=false` (including LWT) keeps `lastOnline` as the latest successful sighting, while `wifiStatus` moves to `DISCONNECTED`
  - online/offline for API/UI still comes from `lastOnline` threshold logic, not directly from `wifiStatus`

---

## 4. Socket.io System

### Events

| Direction       | Event                  | Data                                                                                          |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| Client → Server | `authenticate`         | `{ token, elderId? }`                                                                         |
| Client → Server | `ping`                 | —                                                                                             |
| Server → Client | `authenticated`        | `{ success }`                                                                                 |
| Server → Client | `pong`                 | `{ timestamp }`                                                                               |
| Server → Client | `fall_detected`        | eventId, elderId, elderName, deviceId, deviceCode, timestamp, accelerationMagnitude, bpm? |
| Server → Client | `event_status_changed` | eventId?, elderId, deviceId, deviceCode, status, timestamp, bpm?                           |
| Server → Client | `heart_rate_update`    | elderId, elderName, deviceId, deviceCode, heartRate, confidence?                              |
| Server → Client | `device_status_update` | deviceId, deviceCode, elderId, elderName, online, signalStrength?, timestamp, source, serverTimestamp, deviceTimestamp?, wifiSSID? |
| Server → Client | `system_message`       | message, data?, timestamp                                                                     |

### Room Management

- Client connects first, then sends `authenticate` event with `{ token, elderId? }`
- Server joins `user:{userId}` after auth
- Client joins room `elder:{elderId}` only after ownership check passes
- `device_status_update` broadcast ไปยัง elder room ของ caregiver
- Admin ไม่มี Socket.io room ใน runtime ปัจจุบัน และใช้ REST polling แทน realtime socket

---

## 5. Middleware Chain

```
Request → CORS → JSON parser → Rate limiter (/api) → Route matching
  → authenticate (JWT) → requireAdmin (if admin route)
  → validation middleware (custom validate() factory) → Controller → Service → Response
  → errorHandler (catches all errors → structured ApiError response)
  → notFoundHandler (404 for unmatched routes)
```

### Auth Middleware Details

- `authenticate`: verifies JWT, checks user still exists in DB, sets `req.user`
- `requireAdmin`: requires `req.user.role === 'ADMIN'`

---

## 6. Error Handling

Backend uses structured `ApiError` with error codes:

```typescript
{ success: false, error: { code: 'device_already_paired', message: '...' } }
```

### Complete Error Code List

- **400 Bad Request:** `validation_error`, `invalid_input`, `missing_required_field`, `invalid_email_format`, `invalid_phone_format`, `password_too_short`, `password_mismatch`, `invalid_push_token`
- **401 Unauthorized:** `missing_token`, `invalid_token`, `session_expired`, `invalid_credentials`, `current_password_incorrect`
- **403 Forbidden:** `access_denied`, `role_not_allowed`
- **404 Not Found:** `user_not_found`, `elder_not_found`, `device_not_found`, `device_not_paired`, `otp_not_found`, `resource_not_found`, `event_not_found`, `notification_not_found`
- **409 Conflict:** `email_already_exists`, `phone_already_exists`, `device_already_paired`, `event_already_cancelled`
- **422 Unprocessable Entity:** `otp_expired`, `otp_invalid`, `invalid_event_type`
- **429 Too Many Requests:** `rate_limit_exceeded`
- **500 Server Error:** `internal_server_error`, `email_send_failed`, `database_error`

Controller pattern: wrap with `asyncHandler` from `errorHandler.ts` — no manual try/catch.
Error factory: use `createError.xxx()` for common errors, or `new ApiError('code', 'message?')` for custom messages.

---

## 7. Commenting Convention

Backend API ใช้มาตรฐาน comment เดียวกับ Mobile และ Admin:

- ใช้ Thai-first comments และเก็บ technical terms เช่น MQTT, Socket.io, Prisma, ACK เป็น English เมื่ออ่านง่ายกว่า
- ไฟล์ที่เป็น orchestration สำคัญ เช่น `mqttClient.ts`, socket manager, controllers/services ที่มี flow ชัดเจน สามารถมี JSDoc-style file header พร้อมหัวข้อ `สิ่งที่เกิดขึ้นในไฟล์นี้:`
- หลีกเลี่ยง import group labels และ separator banners; เพิ่ม inline comments เฉพาะ guard, transaction/side effect, MQTT routing, retained message, ACK timeout, auth boundary, หรือ server timestamp rule ที่ต้องอธิบายเจตนา
- ใช้ `ไฟล์ถัดไป: ...` เฉพาะจุดที่ reader ควรตาม flow ไปยัง validator, handler, service, หรือ realtime module ถัดไปจริง ๆ

---

## Working Note

- Review the full backend path for high-impact changes: route/controller -> service -> Prisma/DB -> MQTT/Socket/Push side effects -> docs
- If an API contract, MQTT topic, payload shape, or schema changes, update the related owner docs and `docs/ai/*` references in the same change

---

## Related Docs

- [System Overview](system_overview.md)
- [API Reference](../api/api-reference.md)
- [IoT MQTT Architecture](../architecture/iot-mqtt.md)
- [API Verification](../ops/api-verification.md)
