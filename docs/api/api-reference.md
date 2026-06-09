# เอกสาร API ระบบ FallHelp

## Doc Meta

- **Audience**: Backend/Mobile/Admin Dev, QA
- **Source of Truth**: [routes/](../../apps/backend-api/src/routes)
- **Status**: Active
- Last Updated: June 3, 2026

---

> เอกสารนี้รวบรวม **API Endpoints**, **Request/Response**, และ **Real-time Events** ทั้งหมดของระบบ FallHelp

## Table of Contents

1. [Authentication](#1-authentication---apiauth)
2. [Users - `/api/users`](#2-users---apiusers)
3. [Elders - `/api/elders`](#3-elders---apielders)
4. [Devices - `/api/devices`](#4-devices---apidevices)
5. [Device Pairings - `/api/device-pairings`](#5-device-pairings---apidevice-pairings)
6. [Events - `/api/events`](#6-events---apievents)
7. [Emergency Contacts - `/api/elders/:elderId/emergency-contacts`](#7-emergency-contacts---apielderselderidemergency-contacts)
8. [Notifications - `/api/notifications`](#8-notifications---apinotifications)
9. [Admin - `/api/admin`](#9-admin---apiadmin)
10. [Health Check - `/internal/health`](#10-health-check---internalhealth)
11. [Real-time Communication](#11-real-time-communication)
12. [Database Schema](#12-database-schema)
13. [Security](#13-security)
14. [Error Responses](#14-error-responses)

---

---

## Overview

| รายการ             | ค่า                                                                       |
| ------------------ | ------------------------------------------------------------------------- |
| **Base URL**       | `http://localhost:3000`                                                   |
| **Auth Model**     | JWT Bearer Token                                                          |
| **Primary Actors** | `CAREGIVER`, `ADMIN`                                                      |
| **Event Storage**  | `events` ใช้ PostgreSQL พร้อม PK เดี่ยว (`id`) และดัชนีเวลา (`timestamp`) |

---

## 1. Authentication - `/api/auth`

### 1.1 ลงทะเบียนผู้ใช้ใหม่

| รายการ       | ค่า                  |
| ------------ | -------------------- |
| **Method**   | `POST`               |
| **Endpoint** | `/api/auth/register` |
| **Auth**     | ไม่ต้อง              |

**Request Body:**

```json
{
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "gender": "MALE",
  "phone": "0812345678",
  "email": "somchai@example.com",
  "password": "Password123!"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "somchai@example.com",
      "firstName": "สมชาย",
      "lastName": "ใจดี",
      "phone": "0812345678",
      "gender": "MALE",
      "role": "CAREGIVER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 1.2 เข้าสู่ระบบ

| รายการ       | ค่า               |
| ------------ | ----------------- |
| **Method**   | `POST`            |
| **Endpoint** | `/api/auth/login` |
| **Auth**     | ไม่ต้อง           |

**Request Body:**

```json
{
  "identifier": "somchai@example.com",
  "password": "Password123!"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "somchai@example.com",
      "firstName": "สมชาย",
      "lastName": "ใจดี",
      "phone": "0812345678",
      "role": "CAREGIVER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 1.3 เข้าสู่ระบบผู้ดูแลระบบ

| รายการ       | ค่า                     |
| ------------ | ----------------------- |
| **Method**   | `POST`                  |
| **Endpoint** | `/api/auth/admin-login` |
| **Auth**     | ไม่ต้อง                 |

**Request Body:**

```json
{
  "email": "admin@fallhelp.com",
  "password": "Password123!"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@fallhelp.com",
      "firstName": "ผู้ดูแล",
      "lastName": "ระบบ",
      "role": "ADMIN"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error (403):** `role_not_allowed` เมื่อบัญชีที่เข้าสู่ระบบไม่ใช่ `ADMIN`

---

### 1.4 ขอรหัส OTP (ลืมรหัสผ่าน)

| รายการ       | ค่า                     |
| ------------ | ----------------------- |
| **Method**   | `POST`                  |
| **Endpoint** | `/api/auth/request-otp` |
| **Auth**     | ไม่ต้อง                 |

**Request Body:**

```json
{
  "email": "somchai@example.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "OTP sent to somchai@example.com",
    "referenceCode": "XPQL",
    "expiresInMinutes": 5
  }
}
```

**Error (500):** `email_send_failed` เมื่อ backend ส่ง OTP ผ่าน Resend ไม่สำเร็จ

---

### 1.5 ยืนยัน OTP

| รายการ       | ค่า                    |
| ------------ | ---------------------- |
| **Method**   | `POST`                 |
| **Endpoint** | `/api/auth/verify-otp` |
| **Auth**     | ไม่ต้อง                |

**Request Body:**

```json
{
  "email": "somchai@example.com",
  "code": "123456"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "message": "OTP verified successfully"
  }
}
```

---

### 1.6 ตั้งรหัสผ่านใหม่

| รายการ       | ค่า                        |
| ------------ | -------------------------- |
| **Method**   | `POST`                     |
| **Endpoint** | `/api/auth/reset-password` |
| **Auth**     | ไม่ต้อง                    |

**Request Body:**

```json
{
  "email": "somchai@example.com",
  "code": "123456",
  "newPassword": "NewPassword123!"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}
```

---

### 1.7 ดูข้อมูลผู้ใช้ปัจจุบัน (Canonical Route)

| รายการ       | ค่า             |
| ------------ | --------------- |
| **Method**   | `GET`           |
| **Endpoint** | `/api/users/me` |
| **Auth**     | Bearer Token    |

> route นี้ย้ายออกจาก `auth` มาอยู่ใต้ resource `users/me` แล้ว แต่ยังอ้างไว้ในหมวด auth เพื่อให้เห็น session-related flow ครบชุด

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "somchai@example.com",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "phone": "0812345678",
    "gender": "MALE",
    "profileImage": "https://...",
    "role": "CAREGIVER"
  }
}
```

---

### 1.8 ออกจากระบบ

| รายการ       | ค่า                |
| ------------ | ------------------ |
| **Method**   | `POST`             |
| **Endpoint** | `/api/auth/logout` |
| **Auth**     | Bearer Token       |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

> ล้าง push token ออกจาก DB เพื่อหยุดส่ง Expo Push Notification ไปยังอุปกรณ์นั้น

---

## 2. Users - `/api/users`

### 2.1 ดูโปรไฟล์ผู้ใช้ปัจจุบัน

| รายการ       | ค่า             |
| ------------ | --------------- |
| **Method**   | `GET`           |
| **Endpoint** | `/api/users/me` |
| **Auth**     | Bearer Token    |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "somchai@example.com",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "phone": "0812345678",
    "gender": "MALE",
    "profileImage": "https://..."
  }
}
```

---

### 2.2 แก้ไขโปรไฟล์ผู้ใช้ปัจจุบัน

| รายการ       | ค่า             |
| ------------ | --------------- |
| **Method**   | `PATCH`         |
| **Endpoint** | `/api/users/me` |
| **Auth**     | Bearer Token    |

**Request Body:**

```json
{
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "phone": "0812345678",
  "email": "somchai@example.com",
  "gender": "MALE",
  "profileImage": "https://example.com/uploads/profiles/abc.webp"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid",
    "email": "somchai@example.com",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "phone": "0812345678",
    "gender": "MALE",
    "profileImage": "https://example.com/uploads/profiles/abc.webp"
  }
}
```

---

### 2.3 เปลี่ยนรหัสผ่าน

| รายการ       | ค่า                      |
| ------------ | ------------------------ |
| **Method**   | `PUT`                    |
| **Endpoint** | `/api/users/me/password` |
| **Auth**     | Bearer Token             |

**Request Body:**

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

---

### 2.4 อัปเดต Push Token

| รายการ       | ค่า                        |
| ------------ | -------------------------- |
| **Method**   | `PUT`                      |
| **Endpoint** | `/api/users/me/push-token` |
| **Auth**     | Bearer Token               |

**Request Body:**

```json
{
  "pushToken": "ExponentPushToken[xxxx]"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Push token updated successfully"
  }
}
```

---

## 3. Elders - `/api/elders`

### 3.1 สร้างข้อมูลผู้สูงอายุ

| รายการ       | ค่า           |
| ------------ | ------------- |
| **Method**   | `POST`        |
| **Endpoint** | `/api/elders` |
| **Auth**     | Bearer Token  |

> `dateOfBirth` ใช้รูปแบบ `YYYY-MM-DD` และ API จะตอบกลับเป็นรูปแบบเดียวกัน

**Request Body:**

```json
{
  "firstName": "สมศรี",
  "lastName": "ใจดี",
  "gender": "FEMALE",
  "dateOfBirth": "1958-05-15",
  "height": 155,
  "weight": 50,
  "diseases": "เบาหวาน, ความดันโลหิตสูง",
  "houseNumber": "123",
  "villageNumber": "2",
  "villageName": "สุขุมวิทวิลล์",
  "subdistrict": "คลองตัน",
  "district": "วัฒนา",
  "province": "กรุงเทพมหานคร",
  "zipcode": "10110"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "สร้างผู้สูงอายุใหม่สำเร็จ",
  "data": {
    "id": "uuid",
    "firstName": "สมศรี",
    "lastName": "ใจดี",
    "gender": "FEMALE",
    "dateOfBirth": "1958-05-15",
    "diseases": "เบาหวาน, ความดันโลหิตสูง"
  }
}
```

---

### 3.2 ดูข้อมูลผู้สูงอายุปัจจุบัน

| รายการ       | ค่า                   |
| ------------ | --------------------- |
| **Method**   | `GET`                 |
| **Endpoint** | `/api/elders/current` |
| **Auth**     | Bearer Token          |

ใช้กับ single-caregiver model เพื่อดึง elder คนเดียวที่ผูกกับผู้ใช้ปัจจุบัน ถ้ายังไม่มี elder จะคืน `data: null`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "สมศรี",
    "lastName": "ใจดี",
    "gender": "FEMALE",
    "device": {
      "deviceCode": "AB12CD34",
      "pairingStatus": "PAIRED",
      "onlineStatus": "OFFLINE",
      "isOnline": false,
      "wifiStatus": "CONNECTED"
    }
  }
}
```

---

### 3.3 ดูข้อมูลผู้สูงอายุตาม id

| รายการ       | ค่า               |
| ------------ | ----------------- |
| **Method**   | `GET`             |
| **Endpoint** | `/api/elders/:id` |
| **Auth**     | Bearer Token      |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "สมศรี",
    "lastName": "ใจดี",
    "gender": "FEMALE",
    "dateOfBirth": "1958-05-15",
    "height": 155,
    "weight": 50,
    "diseases": "เบาหวาน",
    "houseNumber": "123",
    "villageNumber": "2",
    "villageName": "สุขุมวิทวิลล์",
    "district": "วัฒนา",
    "province": "กรุงเทพมหานคร",
    "device": {
      "deviceCode": "AB12CD34",
      "pairingStatus": "PAIRED",
      "onlineStatus": "ONLINE",
      "wifiStatus": "CONNECTED"
    },
    "emergencyContacts": []
  }
}
```

---

### 3.4 แก้ไขข้อมูลผู้สูงอายุ

| รายการ       | ค่า               |
| ------------ | ----------------- |
| **Method**   | `PUT`             |
| **Endpoint** | `/api/elders/:id` |
| **Auth**     | Bearer Token      |

**Request Body:** เหมือนข้อ 3.1 แต่ส่งเฉพาะ field ที่ต้องการแก้ได้

**Response (200):**

```json
{
  "success": true,
  "message": "อัปเดตผู้สูงอายุสำเร็จ",
  "data": {
    "id": "uuid",
    "firstName": "สมศรี",
    "lastName": "ใจดี"
  }
}
```

---

## 4. Devices - `/api/devices`

### 4.1 ค้นหาอุปกรณ์ด้วย Device Code

| รายการ       | ค่า                                |
| ------------ | ---------------------------------- |
| **Method**   | `GET`                              |
| **Endpoint** | `/api/devices/by-code/:deviceCode` |
| **Auth**     | Bearer Token                       |

ใช้สำหรับตรวจสอบข้อมูลอุปกรณ์หลังผู้ใช้สแกน QR แล้ว ไม่ได้คืนภาพ QR สำเร็จรูปจาก backend

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "device-uuid",
    "deviceCode": "AB12CD34",
    "serialNumber": "ESP32-6C689BDAF380",
    "status": "UNPAIRED"
  }
}
```

---

### 4.2 ตั้งค่า WiFi ให้อุปกรณ์

| รายการ       | ค่า                            |
| ------------ | ------------------------------ |
| **Method**   | `PUT`                          |
| **Endpoint** | `/api/devices/:id/wifi-config` |
| **Auth**     | Bearer Token                   |

**Request Body:**

```json
{
  "ssid": "MyWiFi",
  "wifiPassword": "wifi-password"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "ส่งค่า WiFi ให้อุปกรณ์แล้ว (รอสถานะการเชื่อมต่อ)",
  "data": {
    "config": {
      "deviceId": "device-uuid",
      "wifiStatus": "CONFIGURING"
    },
    "ack": {
      "requestId": "req-001",
      "timestamp": 1742012345678
    }
  }
}
```

---

### 4.3 ดูการตั้งค่า WiFi ของอุปกรณ์

| รายการ       | ค่า                            |
| ------------ | ------------------------------ |
| **Method**   | `GET`                          |
| **Endpoint** | `/api/devices/:id/wifi-config` |
| **Auth**     | Bearer Token                   |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "deviceId": "device-uuid",
    "wifiStatus": "CONNECTED",
    "updatedAt": "2026-03-15T08:30:00.000Z"
  }
}
```

---

## 5. Device Pairings - `/api/device-pairings`

### 5.1 จับคู่อุปกรณ์กับผู้สูงอายุ

| รายการ       | ค่า                    |
| ------------ | ---------------------- |
| **Method**   | `POST`                 |
| **Endpoint** | `/api/device-pairings` |
| **Auth**     | Bearer Token           |

**Request Body:**

```json
{
  "deviceCode": "AB12CD34",
  "elderId": "elder-uuid"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "จับคู่อุปกรณ์สำเร็จ",
  "data": {
    "id": "uuid",
    "deviceCode": "AB12CD34",
    "serialNumber": "ESP32-6C689BDAF380",
    "elderId": "elder-uuid",
    "status": "PAIRED"
  }
}
```

---

### 5.2 ยกเลิกการจับคู่อุปกรณ์

| รายการ       | ค่า                              |
| ------------ | -------------------------------- |
| **Method**   | `DELETE`                         |
| **Endpoint** | `/api/device-pairings/:deviceId` |
| **Auth**     | Bearer Token                     |

**Response (200):**

```json
{
  "success": true,
  "message": "ยกเลิกการจับคู่สำเร็จ",
  "data": {
    "id": "uuid",
    "status": "UNPAIRED",
    "elderId": null
  }
}
```

---

## 6. Events - `/api/events`

### 6.1 ดูรายการเหตุการณ์

| รายการ       | ค่า                                                                 |
| ------------ | ------------------------------------------------------------------- |
| **Method**   | `GET`                                                               |
| **Endpoint** | `/api/events`                                                       |
| **Auth**     | Bearer Token                                                        |
| **Query**    | `?elderId=uuid&startDate=...&endDate=...&page=1&limit=20` |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fallStage": "PENDING_CONFIRMATION",
      "bpm": null,
      "magnitude": 9.95,
      "postureDelta": 45.2,
      "timestamp": "2026-05-10T10:05:00Z",
      "cancelledAt": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

---

### 6.2 ดูรายละเอียดเหตุการณ์

| รายการ       | ค่า               |
| ------------ | ----------------- |
| **Method**   | `GET`             |
| **Endpoint** | `/api/events/:id` |
| **Auth**     | Bearer Token      |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fallStage": "CONFIRMED",
    "bpm": 82,
    "magnitude": 9.95,
    "postureDelta": 45.2,
    "timestamp": "2026-05-10T10:05:00Z",
    "cancelledAt": null,
    "elder": { "...": "..." },
    "device": { "...": "..." }
  }
}
```

---

> ⚠️ **ข้อเท็จจริงเกี่ยวกับ Cancel vs Acknowledge ในแอป:**

| การกระทำ        | ผู้ดำเนินการ                          | เปลี่ยน DB               | ผล                                                          |
| --------------- | ------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| **Cancel**      | ผู้สวมใส่ — กดปุ่ม GPIO27 ภายใน 15 วิ | ✅ ตั้งค่า `cancelledAt` | ยกเลิกเหตุการได้จริง                                        |
| **Acknowledge** | ผู้ดูแล — กดรับทราบแล้วในแอป          | ❌ ไม่เปลี่ยน            | `setFallStatus('NORMAL')` local state เท่านั้น — ไม่ยิง API |

> 🔒 **Current rule:** ผู้ดูแลทำได้เพียง **Acknowledge ในแอป** เท่านั้น — `fall_cancelled` ต้องมาจาก MQTT device flow เท่านั้น

---

### 6.3 สรุปรายเดือน

| รายการ       | ค่า                                |
| ------------ | ---------------------------------- |
| **Method**   | `GET`                              |
| **Endpoint** | `/api/events/summary/monthly`      |
| **Auth**     | Bearer Token                       |
| **Query**    | `?elderId=uuid&month=12&year=2026` |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "year": 2026,
    "month": 12,
    "fallCount": 3,
    "heartRateAtFallHigh": 1,
    "heartRateAtFallNormal": 1,
    "heartRateAtFallLow": 0,
    "heartRateAtFallUnknown": 1,
    "peakHour": 16
  }
}
```

> **หมายเหตุ:** ฟิลด์ `heartRateAtFall*` แสดงการกระจายของ BPM เฉพาะบน FALL events ที่ยืนยันแล้ว (thresholds: Low < 60, Normal 60–100, High > 100 BPM; Unknown = ไม่มีข้อมูล HR)

---

## 7. Emergency Contacts - `/api/elders/:elderId/emergency-contacts`

> **⚠️ API Refactored (May 2026):**
> Endpoints changed from flat routes (`/api/emergency-contacts`) to nested under elders (`/api/elders/:elderId/emergency-contacts`)
> **Reason:** RESTful resource hierarchy — contacts belong to an elder
> **Note:** `elderId` comes from the URL path parameter

### 7.1 เพิ่มเบอร์ติดต่อฉุกเฉิน

| รายการ       | ค่า                                       |
| ------------ | ----------------------------------------- |
| **Method**   | `POST`                                    |
| **Endpoint** | `/api/elders/:elderId/emergency-contacts` |
| **Auth**     | Bearer Token (Required)                   |

**Request Body:**

```json
{
  "name": "นายสมชาย ใจดี",
  "phone": "0812345678",
  "relationship": "ญาติ"
}
```

**Required:** `name`, `phone`
**Optional:** `relationship` — คำอธิบายความสัมพันธ์กับผู้สูงอายุ เช่น `ครอบครัว`, `ญาติ`, `เพื่อนบ้าน`, `ผู้ดูแล`, `เพื่อน` หรือคำที่ผู้ใช้ระบุเอง
**Priority:** Auto-assigned (first contact = 1, increments automatically)

**Response (201):**

```json
{
  "success": true,
  "message": "เพิ่มเบอร์ติดต่อฉุกเฉินสำเร็จ",
  "data": {
    "id": "contact-001",
    "name": "นายสมชาย ใจดี",
    "phone": "0812345678",
    "relationship": "ญาติ",
    "priority": 1
  }
}
```

---

### 7.2 ดูรายการเบอร์ติดต่อฉุกเฉิน

| รายการ       | ค่า                                       |
| ------------ | ----------------------------------------- |
| **Method**   | `GET`                                     |
| **Endpoint** | `/api/elders/:elderId/emergency-contacts` |
| **Auth**     | Bearer Token (Required)                   |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "contact-001",
      "name": "นายสมชาย",
      "phone": "0812345678",
      "relationship": "ญาติ",
      "priority": 1
    },
    {
      "id": "contact-002",
      "name": "นางสมหญิง",
      "phone": "0898765432",
      "relationship": "ผู้ดูแล",
      "priority": 2
    }
  ]
}
```

---

### 7.3 แก้ไขเบอร์ติดต่อฉุกเฉิน

| รายการ       | ค่า                                                  |
| ------------ | ---------------------------------------------------- |
| **Method**   | `PATCH`                                              |
| **Endpoint** | `/api/elders/:elderId/emergency-contacts/:contactId` |
| **Auth**     | Bearer Token (Required)                              |

**Request Body:**

```json
{
  "name": "นายสมชาย ใจดี",
  "phone": "0811111111",
  "relationship": "เพื่อนบ้าน"
}
```

**Optional:** Any field can be updated (omitted fields stay unchanged)

**Response (200):**

```json
{
  "success": true,
  "message": "อัปเดตเบอร์ติดต่อฉุกเฉินสำเร็จ",
  "data": {
    "id": "contact-001",
    "priority": 1
  }
}
```

---

### 7.4 ลบเบอร์ติดต่อฉุกเฉิน

| รายการ       | ค่า                                                  |
| ------------ | ---------------------------------------------------- |
| **Method**   | `DELETE`                                             |
| **Endpoint** | `/api/elders/:elderId/emergency-contacts/:contactId` |
| **Auth**     | Bearer Token (Required)                              |

**Response (200):**

```json
{
  "success": true,
  "message": "ลบเบอร์ติดต่อฉุกเฉินสำเร็จ"
}
```

---

### 7.5 จัดเรียงลำดับเบอร์ติดต่อ

| รายการ       | ค่า                                             |
| ------------ | ----------------------------------------------- |
| **Method**   | `PATCH`                                         |
| **Endpoint** | `/api/elders/:elderId/emergency-contacts/order` |
| **Auth**     | Bearer Token (Required)                         |

**Request Body:**

```json
{
  "contactIds": ["contact-002", "contact-001", "contact-003"]
}
```

**Notes:**

- Priority is assigned sequentially: 1st contact = priority 1, 2nd = 2, etc.
- Minimum 2 contacts required to reorder
- Uses database transaction to prevent race conditions

**Response (200):**

```json
{
  "success": true,
  "message": "จัดลำดับเบอร์ติดต่อฉุกเฉินสำเร็จ"
}
```

---

## 8. Notifications - `/api/notifications`

### 8.1 ดูรายการแจ้งเตือน

| รายการ       | ค่า                   |
| ------------ | --------------------- |
| **Method**   | `GET`                 |
| **Endpoint** | `/api/notifications`  |
| **Auth**     | Bearer Token          |
| **Query**    | `?page=1&pageSize=20` |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "ตรวจพบการหกล้ม!",
      "message": "นางสมศรี อาจหกล้ม",
      "isRead": false,
      "eventId": "event-uuid",
      "event": {
        "id": "event-uuid",
        "fallStage": "CONFIRMED",
        "timestamp": "2026-05-10T10:05:00Z"
      },
      "createdAt": "2026-05-10T10:05:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 20,
  "totalPages": 2
}
```

> `Notification` อ้างอิง `Event` ผ่าน FK (`eventId -> events.id`) แบบ required
> ฝั่ง API จะ map `event` กลับมาให้ทุกครั้งที่อ่านรายการ เพื่อให้ mobile/admin trace กลับไปยัง event ต้นทางได้เสมอ

---

### 8.2 ดูจำนวนแจ้งเตือนที่ยังไม่อ่าน

| รายการ       | ค่า                               |
| ------------ | --------------------------------- |
| **Method**   | `GET`                             |
| **Endpoint** | `/api/notifications/unread-count` |
| **Auth**     | Bearer Token                      |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

---

### 8.3 ทำเครื่องหมายว่าอ่านแล้ว

| รายการ       | ค่า                      |
| ------------ | ------------------------ |
| **Method**   | `PATCH`                  |
| **Endpoint** | `/api/notifications/:id` |
| **Auth**     | Bearer Token             |

**Request Body:**

```json
{
  "isRead": true
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Notification updated"
}
```

---

### 8.4 ทำเครื่องหมายว่าอ่านแล้วทั้งหมด

| รายการ       | ค่า                  |
| ------------ | -------------------- |
| **Method**   | `PATCH`              |
| **Endpoint** | `/api/notifications` |
| **Auth**     | Bearer Token         |

**Request Body:**

```json
{
  "action": "mark_all_read"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

## 9. Admin - `/api/admin`

> **สำหรับผู้ดูแลระบบเท่านั้น (Admin Role)**

### 9.1 ลงทะเบียนอุปกรณ์ใหม่ (Admin)

| รายการ       | ค่า                  |
| ------------ | -------------------- |
| **Method**   | `POST`               |
| **Endpoint** | `/api/admin/devices` |
| **Auth**     | Bearer Token (Admin) |

**Request Body:**

```json
{
  "serialNumber": "ESP32-6C689BDAF380"
}
```

`serialNumber` ต้องอยู่ในรูปแบบ `ESP32-XXXXXXXXXXXX` โดย `X` คือเลขฐาน 16 จำนวน 12 ตัวตาม serial ที่ firmware สร้างจาก ESP32 chip ID

**Response (201):**

```json
{
  "success": true,
  "message": "Device created successfully",
  "data": {
    "id": "device-uuid",
    "deviceCode": "AB12CD34",
    "serialNumber": "ESP32-6C689BDAF380",
    "status": "UNPAIRED"
  }
}
```

---

### 9.2 ดูรายการอุปกรณ์ทั้งหมด

| รายการ       | ค่า                  |
| ------------ | -------------------- |
| **Method**   | `GET`                |
| **Endpoint** | `/api/admin/devices` |
| **Auth**     | Bearer Token (Admin) |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "device-uuid",
      "deviceCode": "AB12CD34",
      "serialNumber": "ESP32-6C689BDAF380",
      "status": "PAIRED",
      "onlineStatus": "ONLINE",
      "isOnline": true,
      "lastOnline": "2026-04-10T09:20:00.000Z",
      "elderId": "elder-uuid"
    }
  ]
}
```

---

### 9.3 ลบอุปกรณ์

| รายการ       | ค่า                      |
| ------------ | ------------------------ |
| **Method**   | `DELETE`                 |
| **Endpoint** | `/api/admin/devices/:id` |
| **Auth**     | Bearer Token (Admin)     |

**Response (200):**

```json
{
  "success": true,
  "message": "Device deleted successfully"
}
```

---

### 9.4 บังคับยกเลิกการจับคู่อุปกรณ์

| รายการ       | ค่า                             |
| ------------ | ------------------------------- |
| **Method**   | `POST`                          |
| **Endpoint** | `/api/admin/devices/:id/unpair` |
| **Auth**     | Bearer Token (Admin)            |

**Response (200):**

```json
{
  "success": true,
  "message": "Device unpaired successfully"
}
```

---

## 10. Health Check - `/internal/health`

### 10.1 ตรวจสอบสถานะระบบ

| รายการ       | ค่า                |
| ------------ | ------------------ |
| **Method**   | `GET`              |
| **Endpoint** | `/internal/health` |
| **Auth**     | ไม่ต้อง            |

**Response (200 / 503):**

```json
{
  "status": "ok",
  "timestamp": "2026-03-15T08:30:00.000Z",
  "uptime": "2h 15m",
  "responseTimeMs": 12,
  "services": {
    "database": "connected",
    "mqtt": "connected"
  },
  "version": "1.0.0"
}
```

---

## 11. Real-time Communication

### 11.1 MQTT Topics (IoT → Backend)

| Topic                 | คำอธิบาย                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `device/+/event`      | Unified event หลักจาก firmware ปัจจุบัน เช่น `suspected_fall`, `fall_confirmed`, `fall_cancelled`, `heart_rate_*` |
| `device/+/fall`       | Legacy fall payload compatibility                                                                                 |
| `device/+/heartrate`  | Legacy heart-rate payload compatibility                                                                           |
| `device/+/status`     | สถานะอุปกรณ์ / WiFi / heartbeat                                                                                   |
| `device/+/config/ack` | ACK หลังอุปกรณ์รับคำสั่ง config                                                                                   |
| `device/+/lwt`        | broker แจ้งว่าอุปกรณ์หลุดแบบผิดปกติ                                                                               |
| `events/+`            | mock events compatibility สำหรับบาง flow ทดสอบ                                                                    |

---

### 11.2 Socket.io Events (Backend → Mobile)

| Event                  | คำอธิบาย                                                                      | Payload                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `fall_detected`        | แจ้งเตือนการล้มที่ยืนยันแล้ว (stage 2A / CRITICAL)                            | `{ eventId, elderId, elderName, deviceId, deviceCode, timestamp, accelerationMagnitude, bpm? }`     |
| `event_status_changed` | lifecycle signal ภายในสำหรับ mobile pending guard ไม่ใช่ caregiver alert หลัก | `{ eventId?, elderId, deviceId, deviceCode, status, timestamp, bpm? }`                              |
| `heart_rate_update`    | อัปเดตค่า heart rate แบบ real-time                                            | `{ elderId, elderName, deviceId, deviceCode, heartRate, confidence?, timestamp }`                   |
| `device_status_update` | สถานะ online/offline ของอุปกรณ์ ส่งไปยัง elder room ของ caregiver              | `{ deviceId, deviceCode, elderId, elderName, online, signalStrength?, wifiSSID?, timestamp, source?, serverTimestamp?, deviceTimestamp? }` |
| `system_message`       | ข้อความ broadcast ทั่วระบบ                                                    | `{ message, data?, timestamp }`                                                                     |

`suspected_fall` และ `fall_cancelled` ยังคงไม่สร้าง caregiver alert หรือ Push Notification แต่ backend จะส่ง `event_status_changed` ให้ mobile ใช้เป็น internal guard ระหว่างรอยืนยัน/ยกเลิก

---

## 12. Database Schema

| ตาราง            | คำอธิบาย                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| User             | ผู้ดูแล (Caregiver) และ Admin                                            |
| AuthOtp          | รหัส OTP สำหรับ forgot password (ลบอัตโนมัติหลังหมดอายุ)                 |
| Elder            | ผู้สูงอายุที่ถูกดูแล — 1 User ↔ 1 Elder (FK โดยตรง ไม่มี junction table) |
| Device           | อุปกรณ์ IoT (ESP32), pairing state, `wifiStatus`, และ `lastOnline`       |
| Event            | เหตุการณ์การล้ม พร้อม BPM snapshot ณ ขณะเกิดเหตุ (PK: id, indexed by timestamp) |
| Notification     | ประวัติการแจ้งเตือนจาก event ที่ยืนยันแล้ว — FK แบบ required ไปยัง Event ผ่าน `eventId` |
| EmergencyContact | เบอร์ติดต่อฉุกเฉิน                                                       |

---

## 13. Security

| ฟีเจอร์              | รายละเอียด                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| **Authentication**   | JWT (หมดอายุ 7 วัน)                                                        |
| **Password**         | bcrypt hashing                                                             |
| **Rate Limiting**    | API: 100/15นาที, Auth: 5/15นาที, OTP: 3/10นาที                             |
| **Access Control**   | JWT + ownership check + `requireAdmin` ตาม route                           |
| **Input Validation** | custom `validate(ValidationRule[])` factory ใน `middlewares/validation.ts` |

---

## 14. Error Responses

```json
{
  "error": true,
  "message": "ข้อความแสดงข้อผิดพลาด",
  "statusCode": 400
}
```

| Status Code | ความหมาย                            |
| :---------: | ----------------------------------- |
|     400     | Bad Request - ข้อมูลไม่ถูกต้อง      |
|     401     | Unauthorized - ไม่ได้ Login         |
|     403     | Forbidden - ไม่มีสิทธิ์เข้าถึง      |
|     404     | Not Found - ไม่พบข้อมูล             |
|     429     | Too Many Requests - เกิน Rate Limit |
|     500     | Internal Server Error               |

---

## Related Docs

- [System Design](../architecture/system-design.md)
- [Data Model](../architecture/data-model.md)
- [Backend AI Context](../ai/backend.md)
- [Admin AI Context](../ai/admin.md)
