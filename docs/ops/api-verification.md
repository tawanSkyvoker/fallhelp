# API Verification Runbook

## Doc Meta

- Audience: QA, Backend Dev, Mobile Dev
- Source of Truth: [../../apps/backend-api/src/routes](../../apps/backend-api/src/routes) + [../../apps/backend-api/docs/api/postman_collection.json](../../apps/backend-api/docs/api/postman_collection.json)
- Status: Active
- Last Updated: May 21, 2026

---

## Overview

คู่มือนี้ใช้สำหรับตรวจสอบว่า REST API ของ FallHelp ยังใช้งานได้ครบหลังมีการแก้โค้ดหรือปรับเอกสาร โดยใช้ Postman collection กลางของโปรเจกต์เป็นฐาน

runbook นี้เน้น 3 เรื่อง:

1. เตรียม environment ให้พร้อมก่อนยิง API
2. ใช้ Postman collection ชุดเดียวกับเอกสารจริง
3. เช็ก flow ขั้นต่ำที่ช่วยจับ regression ได้เร็ว

---

## Required Inputs

ต้องมีข้อมูลต่อไปนี้ก่อนเทส flow ที่เกี่ยวข้อง:

- `baseUrl`
  - ค่าเริ่มต้น local: `http://localhost:3000/api`
- `authToken`
  - ได้จาก `POST /auth/login`
- `elderId`
  - ได้จาก `POST /elders` หรือ `GET /elders/current`
- `deviceId`
  - ได้จาก `GET /devices/by-code/:deviceCode`, `POST /device-pairings`, หรือ `GET /admin/devices`
- `deviceCode`
  - ใช้กับ flow pairing
- `eventId`
  - ใช้เรียก `GET /events/:id`
- `contactId`, `notificationId`
  - ดึงจาก response ของแต่ละหมวดก่อนยิง request ถัดไป

---

## Pre-check

ก่อนเปิด Postman ให้เช็กขั้นต่ำดังนี้:

```bash
npm run infra:scan
```

ถ้าจะเทส local backend:

```bash
npm run backend:dev
```

ถ้าจะรัน backend ผ่าน Docker:

```bash
docker compose --env-file apps/backend-api/.env up -d --build --pull always backend
```

---

## Collection Source

ใช้ไฟล์นี้เป็นหลัก:

- [../../apps/backend-api/docs/api/postman_collection.json](../../apps/backend-api/docs/api/postman_collection.json)

และใช้เอกสารนี้ประกอบเมื่ออยากตรวจ request/response รายละเอียด:

- [../api/api-reference.md](../api/api-reference.md)

### Auto-Captured Variables

Postman collection ปัจจุบันมี `Tests` script บาง request เพื่อเก็บค่าจาก response ให้อัตโนมัติ ลดการคัดลอกค่าเองระหว่างเทส flow ต่อเนื่อง

request ที่จับค่าอัตโนมัติ:

- `POST /auth/login` → `authToken`, `userId`
- `POST /elders` → `elderId`
- `GET /devices/by-code/:deviceCode` → `deviceId`, `deviceCode`
- `POST /device-pairings` → `deviceId`, `deviceCode`
- `GET /events` → `eventId`
- `GET /notifications` → `notificationId`, `eventId`

กฎของ script ชุดนี้:

- ถ้า response ไม่มีข้อมูลที่ต้องใช้ จะไม่ fail ทั้ง collection
- script จะ set variable เฉพาะเมื่อ field ที่ต้องใช้มีอยู่จริง

---

## Recommended Smoke Flow

ลำดับนี้คุ้มที่สุดสำหรับเช็ก regression แบบเร็ว:

1. `GET /internal/health`
   - เช็กว่า backend ตอบได้ และ DB ไม่ล้ม
2. `POST /auth/login`
   - เอา `token` ไปใส่ `authToken`
3. `GET /users/me`
   - เช็ก JWT และ auth middleware
4. `GET /users/me`
   - เช็ก user profile flow
5. `GET /elders/current`
   - เช็กความสัมพันธ์ caregiver → elder
6. `GET /notifications`
   - เช็ก pagination และ event attachment
7. `GET /events?elderId={{elderId}}&page=1&limit=10`
   - เช็ก event read flow แบบแบ่งหน้า
8. `GET /admin/devices`
   - ใช้เฉพาะ admin token เพื่อตรวจ admin device-management surface

---

## Feature Flows

### Auth

ใช้ลำดับนี้:

1. `POST /auth/register`
2. `POST /auth/login`
3. `POST /auth/request-otp`
4. `POST /auth/verify-otp`
5. `POST /auth/reset-password`
6. `POST /auth/logout`

### Elder + Device Pairing

ใช้ลำดับนี้:

1. `POST /elders`
2. `GET /devices/by-code/:deviceCode`
3. `POST /device-pairings`
4. `PUT /devices/:id/wifi-config`
5. `GET /devices/:id/wifi-config`
6. `DELETE /device-pairings/:deviceId`

### Emergency Contacts

ใช้ลำดับนี้:

1. `POST /elders/:elderId/emergency-contacts`
2. `GET /elders/:elderId/emergency-contacts`
3. `PATCH /elders/:elderId/emergency-contacts/:contactId`
4. `PATCH /elders/:elderId/emergency-contacts/order`
5. `DELETE /elders/:elderId/emergency-contacts/:contactId`

### Events + Notifications

ใช้ลำดับนี้:

1. `GET /events?elderId={{elderId}}&page=1&limit=20`
2. `GET /events/:id`
3. `GET /events/summary/monthly`
4. `GET /notifications`
5. `GET /notifications/unread-count`
6. `PATCH /notifications/:id` (body: `{ isRead: true }`)
7. `PATCH /notifications` (body: `{ action: "mark_all_read" }`)

### Admin

ใช้ admin token:

1. `GET /admin/devices`
2. `POST /admin/devices`
3. `POST /admin/devices/:id/unpair`
4. `DELETE /admin/devices/:id`

---

## Known Constraints

- `Notification.eventId`
  - เป็น FK แบบ required ไปยัง `events.id`
- `fall_cancelled`
  - ต้องมาจาก device flow เท่านั้น
- `Device.status`
  - หมายถึง pairing state ไม่ใช่ online/offline
- `online/offline`
  - คำนวณจาก `lastOnline`

---

## Common Failure Checks

ถ้า request fail ให้ไล่เช็กตามนี้:

1. `401 Unauthorized`
   - token หมดอายุ หรือยังไม่ได้ตั้ง `authToken`
2. `403 Forbidden`
   - ใช้ token คนละ role หรือ resource ไม่ได้เป็นเจ้าของ
3. `404 Not Found`
   - ใช้ `id` เก่าหลังจากลบ/รีเซ็ตข้อมูล
4. `400 Validation Error`
   - body ยังใช้ field เก่า เช่น `adminResponse` (rename เป็น `adminNote` แล้ว), `qrData`, `orderedIds`
5. `GET /events/:id` fail
   - ตรวจสอบว่า `eventId` ยังมีอยู่จริงในระบบ
6. `PUT /devices/:id/wifi-config` ค้าง
   - backend ตอบได้ แต่ device ไม่ ACK หรือ MQTT ไม่พร้อม

---

## Exit Criteria

ถือว่า API baseline ใช้งานได้ เมื่อ:

- `GET /internal/health` ผ่าน
- auth flow ผ่านอย่างน้อย `login -> me`
- user flow ผ่านอย่างน้อย `profile -> current elder`
- event flow ผ่านอย่างน้อย `recent -> detail -> summary`
- notification flow ผ่านอย่างน้อย `list -> unread-count`
- admin flow ผ่านอย่างน้อย `GET /admin/devices`

---

## Related Docs

- [../api/api-reference.md](../api/api-reference.md)
- [../architecture/system-design.md](../architecture/system-design.md)
- [../architecture/data-model.md](../architecture/data-model.md)
- [../../apps/backend-api/docs/api/postman_collection.json](../../apps/backend-api/docs/api/postman_collection.json)
