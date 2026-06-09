# User Account Lifecycle

## Doc Meta

- Audience: Backend Dev / Mobile Dev
- Source of Truth: [userService.ts](../../apps/backend-api/src/services/userService.ts)
- Status: Active
- Last Updated: May 21, 2026

---

## Overview

ระบบจัดการบัญชีผู้ใช้ของ FallHelp รองรับ **Profile Management** และ **Push Token Management**

---

## Feature Requirements

### Account States

เอกสารชุดนี้อธิบายเฉพาะ lifecycle ที่มีอยู่จริงใน runtime ปัจจุบัน:

- บัญชีที่ใช้งานได้ตามปกติ (`Active`)
- การออกจากระบบ (`Logout`) ซึ่งล้าง `users.pushToken` ฝั่ง backend

ยังไม่มี user deletion / deactivate flow เป็น feature ที่เปิดใช้งานอยู่ในระบบปัจจุบัน

### Profile Management

**ข้อมูลที่แก้ไขได้:**

| Field        | Type   | Validation            |
| :----------- | :----- | :-------------------- |
| firstName    | string | Required              |
| lastName     | string | Required              |
| phone        | string | Optional              |
| email        | string | Unique check          |
| profileImage | string | URL                   |
| gender       | string | MALE / FEMALE / OTHER |

### เปลี่ยนรหัสผ่าน

ต้องระบุ `currentPassword` เพื่อยืนยันตัวตนก่อนเปลี่ยน:

```
PUT /api/users/me/password
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

**Validation:**

- รหัสผ่านใหม่ต้องผ่าน Strong Password Check
- รหัสผ่านเก่าต้องตรงกับ DB

### Push Token Management

Mobile App อัปเดต Push Token ทุกครั้งที่เปิดแอป:

```
PUT /api/users/me/push-token
{
  "pushToken": "ExponentPushToken[xxxxx]"
}
```

- Token ถูกเก็บที่ `users.pushToken`
- ใช้สำหรับ Expo Push Notification

### User's Elder

ดึง Elder คนเดียวของผู้ใช้ปัจจุบันผ่าน elder domain โดย mobile เรียก:

```
GET /api/elders/current
```

**Response ของ elder จะมี:**

- ข้อมูลพื้นฐาน (ชื่อ, อายุ, โรคประจำตัว)
- อุปกรณ์ที่ผูกอยู่ (`device`)

---

## Technical Implementation

### Scope ที่มีอยู่จริง

API ปัจจุบันรองรับเฉพาะ:

- ดูและแก้ไข profile
- เปลี่ยนรหัสผ่าน
- อัปเดต Expo push token
- ดู elder ที่เป็นของผู้ใช้

**ข้อจำกัดสำคัญ:**

- ยังไม่มี endpoint ลบบัญชีผู้ใช้
- ยังไม่มี deactivate/reactivate user lifecycle ฝั่ง runtime
- อย่าอ้าง state `Deleted` หรือ soft-delete ฝั่ง user ถ้ายังไม่มี flow ในโค้ด

### Profile Update Contract

- ใช้ `GET /api/users/me` และ `PATCH /api/users/me`
- field ที่แก้ไขได้ต้องสอดคล้องกับ validation ฝั่ง backend เช่น `firstName`, `lastName`, `phone`, `email`, `profileImage`, `gender`

### Password Change Contract

```
PUT /api/users/me/password
{
  "currentPassword": "...",
  "newPassword": "..."
}
```

- ต้องตรวจ `currentPassword` ก่อนเสมอ
- `newPassword` ต้องผ่าน password policy เดียวกับ auth flow

### Push Token Contract

```
PUT /api/users/me/push-token
{
  "pushToken": "ExponentPushToken[...]"
}
```

- token ถูกเก็บไว้ที่ `users.pushToken`
- ใช้สำหรับ Expo push notification ฝั่ง caregiver

### Logout Push Cleanup

- Mobile เรียก `POST /api/auth/logout` ก่อนล้าง local JWT
- Backend ล้าง `users.pushToken` เพื่อหยุดส่ง Expo Push Notification ไปยัง session ที่ออกจากระบบแล้ว

### User's Elder Contract

- mobile ใช้ `GET /api/elders/current` ผ่าน `elderService.getCurrentElder()`
- response เป็น `Elder | null` สำหรับผู้สูงอายุคนเดียวที่ผูกกับ caregiver ปัจจุบัน
- response ต้องสะท้อน ownership จริงของ user ไม่ใช่ข้อมูล elder ทั้งระบบ

---

## Flows

```
View Profile:    GET /api/users/me
Edit Profile:    PATCH /api/users/me (firstName, lastName, phone, email, profileImage, gender)
Change Password: PUT /api/users/me/password (currentPassword + newPassword)
Push Token:      PUT /api/users/me/push-token (ExponentPushToken)
User's Elder:    GET /api/elders/current → Elder | null
```

---

## API Endpoints

| Method | Endpoint                   | Description            | Auth |
| :----- | :------------------------- | :--------------------- | :--- |
| GET    | `/api/users/me`            | ดูโปรไฟล์              | ✅   |
| PATCH  | `/api/users/me`            | แก้ไขโปรไฟล์           | ✅   |
| PUT    | `/api/users/me/password`   | เปลี่ยนรหัสผ่าน        | ✅   |
| GET    | `/api/elders`              | ดูรายการ Elder ของผู้ใช้ | ✅   |
| PUT    | `/api/users/me/push-token` | อัปเดต Push Token      | ✅   |

---

## Related Docs

- [Authentication System](auth.md)
- [API Reference](../api/api-reference.md)
- [Mobile AI Context](../ai/mobile.md)
