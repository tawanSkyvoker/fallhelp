# Authentication System

## Doc Meta

- Audience: Backend Dev / Mobile Dev
- Source of Truth: [authService.ts](../../apps/backend-api/src/services/authService.ts), [jwt.ts](../../apps/backend-api/src/utils/jwt.ts), [password.ts](../../apps/backend-api/src/utils/password.ts)
- Status: Active
- Last Updated: June 3, 2026

---

## Overview

ระบบ Authentication ของ FallHelp ใช้ **JWT (JSON Web Token)** สำหรับจัดการ Session และ **OTP (One-Time Password)** สำหรับการรีเซ็ตรหัสผ่าน รองรับผู้ใช้ 2 ประเภท: **Caregiver** (Mobile App) และ **Admin** (Backoffice)

---

## Feature Requirements

### Registration (ลงทะเบียนบัญชีผู้ใช้งาน)

| Field     | Required | Validation                    |
| :-------- | :------- | :---------------------------- |
| email     | ✅       | Unique, Valid format          |
| password  | ✅       | Strong password (min 8 chars) |
| firstName | ✅       | -                             |
| lastName  | ✅       | -                             |
| phone     | ❌       | Optional                      |
| gender    | ❌       | MALE / FEMALE / OTHER         |

### Login

- ค้นหา User จาก Email หรือ Phone
- เปรียบเทียบ Password ด้วย `bcrypt.compare()`
- สร้าง JWT Token พร้อม Payload

### Password Reset (รีเซ็ตรหัสผ่าน)

**OTP Details:**

- **รูปแบบ:** 6 หลัก (e.g., `482931`)
- **Reference Code:** 4 ตัวอักษร (e.g., `XPQL`) — ใช้ให้ User ยืนยันว่า OTP มาจากระบบเรา
- **หมดอายุ:** 5 นาที
- **ใช้ได้ครั้งเดียว:** `verify-otp` ใช้เพื่อตรวจรหัสก่อนเข้าหน้าตั้งรหัสผ่านใหม่ และเมื่อ `reset-password` สำเร็จ ระบบจะลบ OTP ชุดนั้นออกจาก DB ทันที
- **OTP Purpose:** `PASSWORD_RESET` เท่านั้น

### Admin Access

ระบบ Admin ใช้ role เดียวคือ `ADMIN`

- ไม่มี `OWNER` / `OPERATOR`
- เมื่อผู้ใช้มี `role = ADMIN` จะเข้าถึง endpoint ฝั่ง admin ได้ทั้งหมด
- JWT ไม่แนบ `adminRole`

---

## Technical Implementation

### Registration Flow

```
Request → validation → hash password → create user(role=CAREGIVER) → return JWT
```

- รองรับการสมัคร caregiver เท่านั้น
- backend สร้าง JWT แล้วตอบกลับทันทีหลังสร้าง user สำเร็จ

**สิ่งที่เกิดขึ้นเมื่อผู้ใช้ลงทะเบียนบัญชี:**

- Password ถูก Hash ด้วย `bcrypt` ก่อนเก็บลง DB
- User ได้รับ Role เริ่มต้นเป็น `CAREGIVER`
- ระบบสร้าง JWT Token และส่งกลับทันที

### Login Flow

```
Email/Phone + Password → find user → compare hash → return JWT
```

- lookup ผู้ใช้ได้จาก email หรือ phone
- JWT payload ปัจจุบันมี `userId`, `email`, `role`
- Admin Panel ใช้ endpoint แยก `POST /api/auth/admin-login` เพื่อให้ backend ตรวจ `role = ADMIN` ก่อนคืน JWT

**JWT Payload:**

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "CAREGIVER"
}
```

### Password Reset Flow

```
request-otp → verify-otp → reset-password
```

- OTP ใช้เพื่อ `PASSWORD_RESET` เท่านั้น
- OTP เป็นรหัส 6 หลัก พร้อม reference code 4 ตัวอักษร
- `verify-otp` ใช้เพื่อตรวจรหัสก่อนเข้าหน้าตั้งรหัสผ่านใหม่ และเมื่อ `reset-password` สำเร็จ ระบบจะลบ OTP ชุดนั้นออกจาก DB ทันที
- scheduler ใน `apps/backend-api/src/schedulers/otpScheduler.ts` ลบ OTP ที่หมดอายุเป็นระยะ
- ถ้า Resend ส่งอีเมลไม่สำเร็จ backend จะส่ง error `email_send_failed` กลับไปแทนการตอบ success เพื่อให้ client รู้ว่ารหัสยังไม่ถูกส่งจริง

### Logout Flow

- ใช้ `POST /api/auth/logout`
- Mobile เรียก endpoint นี้ก่อนล้าง local JWT เพื่อให้ backend ยัง authenticate request ได้
- Backend ตั้งค่า `users.pushToken = null` เพื่อหยุด Expo Push Notification ไปยัง session ที่ออกจากระบบแล้ว
- ถ้า backend ติดต่อไม่ได้ mobile ยังต้องล้าง local session ต่อแบบ best-effort เพื่อไม่ให้ผู้ใช้ติดอยู่ใน session เดิม

---

## Flows

### Authentication Flow Diagram

```
Registration: User กรอกข้อมูล → Validate Email/Password → Hash Password → Create User → Return JWT
Login:        User ส่ง Email/Phone + Password → Find User → Compare Password → Return JWT
Reset:        request-otp → [OTP via email] → verify-otp → reset-password → delete OTP
```

---

## Security Notes

| มาตรการ / Concern | รายละเอียด                                         |
| :---------------- | :-------------------------------------------------- |
| Password Hashing  | `bcrypt` (auto-salt) พร้อม salt                    |
| Password Strength | ขั้นต่ำ 8 ตัวอักษร ตรวจตาม helper ฝั่ง backend    |
| JWT Expiry        | กำหนดใน config (default: 7 วัน)                    |
| JWT scope         | แนบ role เดียว (`ADMIN` หรือ `CAREGIVER`)          |
| OTP expiry        | อายุสั้น 5 นาทีและใช้ได้ครั้งเดียว                 |
| OTP Cleanup       | Cron Job ลบ OTP หมดอายุเป็นระยะ                    |
| Admin access      | ไม่มี `OWNER` / `OPERATOR`; ใช้ role `ADMIN` เดียว |

---

## API Endpoints

| Method | Endpoint                   | Description             | Auth |
| :----- | :------------------------- | :---------------------- | :--- |
| POST   | `/api/auth/register`       | สร้าง caregiver account | ❌   |
| POST   | `/api/auth/login`          | รับ JWT session         | ❌   |
| POST   | `/api/auth/admin-login`    | รับ JWT session สำหรับ Admin | ❌   |
| GET    | `/api/users/me`            | อ่าน profile ปัจจุบัน  | ✅   |
| POST   | `/api/auth/request-otp`    | ขอ OTP สำหรับ reset     | ❌   |
| POST   | `/api/auth/verify-otp`     | ตรวจ OTP ก่อน reset     | ❌   |
| POST   | `/api/auth/reset-password` | เปลี่ยนรหัสผ่านผ่าน OTP | ❌   |
| POST   | `/api/auth/logout`         | ออกจากระบบและล้าง pushToken | ✅   |

---

## Related Docs

- [API Reference](../api/api-reference.md)
- [Backend AI Context](../ai/backend.md)
- [Mobile AI Context](../ai/mobile.md)
- [User Account Lifecycle](user-account.md)
