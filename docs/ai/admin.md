# FallHelp Admin — Deep Research

## Doc Meta

- Audience: AI agents, admin web developers, reviewers touching `apps/admin/`
- Source of Truth: `apps/admin/src/`, admin hooks/pages, and backend admin surface
- Status: Active
- Last Updated: June 3, 2026

---

## Overview

> Deep-read date: 2026-05-21

เอกสารนี้รวบรวมข้อมูลสถาปัตยกรรมและรายละเอียดทางเทคนิคของระบบ **Admin Panel** เพื่อเป็นข้อมูลอ้างอิงสำหรับ AI Agent และนักพัฒนา
หลังจากปรับลดขอบเขตการทำงาน (YAGNI) เพื่อตัดระบบจัดการผู้ใช้และผู้สูงอายุที่ไม่เกี่ยวข้องออกแล้ว ระบบ Admin Panel จะทำหน้าที่หลักเพียง **การจัดการอุปกรณ์ตรวจจับการหกล้ม (Device Management)** เท่านั้น

---

## 1. Project Structure (`apps/admin/src/`)

```
apps/admin/src/
├── main.tsx                   # React DOM entry point
├── App.tsx                    # Providers + React Router + ProtectedRoute
├── index.css                  # Global TailwindCSS styles
├── pages/
│   ├── Login.tsx              # หน้าเข้าสู่ระบบสำหรับ Admin
│   └── Devices.tsx            # หน้าหลักจัดการอุปกรณ์ (CRUD + QR + pair/unpair)
├── constants/                 # ค่าคงที่ (Domain, Status maps)
├── layouts/
│   └── AdminLayout.tsx        # Top navbar layout wrapper
├── hooks/
│   └── useAdminDevices.ts     # React Query hook สำหรับจัดการข้อมูลอุปกรณ์
├── config/
│   └── env.ts                 # Runtime-safe VITE_* env boundary
├── context/
│   ├── AuthContext.tsx        # จัดการ Token และสถานะล็อกอิน
│   └── ThemeContext.tsx       # light/dark mode
├── services/
│   ├── api.ts                 # Axios instance
│   ├── adminAuthService.ts    # Admin login API service
│   └── adminDeviceService.ts  # Admin device API services
├── components/
│   ├── StatusBadge.tsx        # ป้ายสถานะการเชื่อมต่อและการจับคู่
│   ├── Pagination.tsx         # ส่วนควบคุมการเปลี่ยนหน้าข้อมูล
│   ├── LoadingSkeleton.tsx    # หน้าจอโหลดข้อมูลแบบ Skeleton
│   └── EmptyState.tsx         # หน้าจอแสดงสถานะไม่มีข้อมูล
├── __tests__/                 # การทดสอบหน่วย (Unit testing)
├── types/
│   └── index.ts               # โครงสร้าง Type definitions ทั้งหมด (Device status, properties)
└── utils/
    ├── logger.ts              # คลาสสำหรับจัดการ Logs
    ├── configValidator.ts     # ตรวจสอบค่า VITE_* env ตอนเริ่มต้นระบบ
    └── deviceSerial.ts        # ฟังก์ชันตรวจสอบและล้างข้อมูล Serial Number
```

---

## 2. App Shell (`App.tsx`)

### Provider Order

```
ThemeProvider
  QueryClientProvider
    AuthProvider
        BrowserRouter
          Routes
            /login        → <Login />
            /             → <ProtectedRoute> → <AdminLayout>
                              index         → <Devices />
```

- `ProtectedRoute` จะแสดง `LoadingSkeleton` ขณะโหลด และรีไดเรกต์ไปที่ `/login` หากผู้ใช้ยังไม่ได้ล็อกอิน

---

## 3. Auth + API

### `context/AuthContext.tsx`

```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(token: string, user: User): void;
  logout(): void;
}
```

**Authentication Flow:**

- บันทึก Token ลงใน `sessionStorage` เพื่อป้องกันข้อมูลสูญหายระหว่างการรีเฟรชหน้าเว็บ
- ดักจับสิทธิ์การเข้าใช้งานผ่าน `requireAdmin` บน Backend
- หากพบสถานะ 401 (Unauthorized) ผ่าน Axios interceptor ระบบจะทำการล้างข้อมูลการเชื่อมต่อและทำ `logout()` อัตโนมัติ

---

## 4. Pages & Business Logic

### `pages/Devices.tsx`

ทำหน้าที่เป็นหน้าจอบริหารจัดการอุปกรณ์ทั้งหมดในระบบ โดยมีฟังก์ชันสำคัญดังนี้:

- **Device List:** แสดงรายการอุปกรณ์ในรูปแบบตาราง รองรับการจัดหน้า (Pagination)
- **Summary Metrics:** แสดงจำนวนอุปกรณ์ทั้งหมด, ผูกแล้ว, ยังไม่ผูก และออนไลน์
- **Register Device:** เปิดกล่องข้อความ (Modal) เพื่อลงทะเบียนอุปกรณ์ใหม่ด้วย Serial Number
- **Pairing QR Code:** แสดง QR Code สำหรับส่งมอบให้ Caregiver ไปสแกนจับคู่ผ่านแอปมือถือ
- **Unpair Action:** บังคับตัดการเชื่อมต่อ (Unpair) อุปกรณ์ออกจากผู้สูงอายุในกรณีที่ต้องการเปลี่ยนเครื่อง
- **Delete Action:** ลบอุปกรณ์ที่ลงทะเบียนผิดพลาดออกจากระบบ (ลบได้เฉพาะอุปกรณ์ที่สถานะเป็น **ยังไม่ผูก (UNPAIRED)** เท่านั้น)

---

## 5. React Query Hooks

### `hooks/useAdminDevices.ts`

- **Queries:**
  - `useAdminDevices(params)`: ทำงานร่วมกับ `adminDeviceService.getAllDevices` เพื่อดึงข้อมูลอุปกรณ์ตามเงื่อนไข คัดกรอง และจัดหน้า
- **Mutations:**
  - `useCreateDevice()`: ลงทะเบียนอุปกรณ์ใหม่ คืนค่าผลลัพธ์เป็นข้อมูลอุปกรณ์พร้อมรหัสสิทธิ์การจับคู่ (Pairing Code)
  - `useUnpairDevice()`: ส่งคำขอทาง API เพื่อตัดความสัมพันธ์กับผู้สูงอายุ
  - `useDeleteDevice()`: ลบข้อมูลอุปกรณ์ออกจากระบบ

---

## 6. Backend Endpoints Used

| Method | Endpoint                     | Hook            | Service Function       | Purpose                        |
| ------ | ---------------------------- | --------------- | ---------------------- | ------------------------------ |
| POST   | `/auth/admin-login`          | Login.tsx       | loginAdmin             | ล็อกอินเข้าสู่ระบบผู้ดูแล      |
| GET    | `/users/me`                  | AuthContext     | Inline context call    | ตรวจสอบ Token ตอนเริ่มต้น      |
| GET    | `/admin/devices`             | useAdminDevices | getAllDevices          | ดึงรายการอุปกรณ์ทั้งหมด        |
| POST   | `/admin/devices`             | useCreateDevice | createDevice           | ลงทะเบียนอุปกรณ์ใหม่           |
| DELETE | `/admin/devices/{id}`        | useDeleteDevice | deleteDevice           | ลบอุปกรณ์ที่ยังไม่ผูก          |
| POST   | `/admin/devices/{id}/unpair` | useUnpairDevice | unpairDevice           | บังคับยกเลิกการจับคู่อุปกรณ์   |

---

## 7. Polling Strategy

- ระบบดึงข้อมูลรายการอุปกรณ์แบบอัตโนมัติ (Polling) ด้วย React Query ทุกๆ **10 วินาที** เพื่ออัปเดตสถานะการออนไลน์และระดับแบตเตอรี่แบบกึ่งเรียลไทม์
- ฝั่ง Admin Panel **ไม่มีการเชื่อมต่อผ่าน Socket.io** เพื่อความเรียบง่ายและลดภาระการประมวลผลของเว็บบราวเซอร์

---

## 8. Testing

### Test Files

```
__tests__/
├── setup.ts
├── jest.polyfills.js
├── pages/
│   ├── Devices.test.tsx
│   └── Login.test.tsx
└── utils/
    └── configValidator.test.ts
```

### Run Commands

```bash
# รันการทดสอบทั้งหมด
npm run test

# รันโหมด Watcher สำหรับนักพัฒนา
npm run test:watch
```

---

## 9. Conventions

### Naming

- Components/Pages: PascalCase (เช่น `Devices.tsx`)
- Hooks: camelCase ขึ้นต้นด้วย `useAdmin` (เช่น `useAdminDevices.ts`)
- Utilities/Services: camelCase
- Constants: UPPER_SNAKE_CASE

### Naming & Coding Guardrails

- ใช้ภาษาไทยในการอธิบาย Code Comment เป็นหลักเพื่อความสอดคล้องกับนโยบายของโครงการ
- ห้ามใช้สีกลุ่มม่วง (Purple/Violet) ในโทนสีหลัก (เว้นแต่ป้ายระบุสิทธิ์ ADMIN ในการแสดงผลบางจุด)
- ระบบสีและโครงสร้างความสวยงามถูกควบคุมผ่าน **TailwindCSS v4**

---

## 10. Key Constraints (กฎเหล็กห้ามละเมิด)

1. ทุกเส้นทางการเชื่อมต่อ API ของผู้ดูแลระบบ (Admin) ต้องผ่าน `requireAdmin` middleware ฝั่ง Backend เสมอ
2. สถานะ `device.status` หมายถึง **สถานะการผูกคู่อุปกรณ์** (`PAIRED` / `UNPAIRED`) ไม่ใช่สถานะการเชื่อมต่อเครือข่าย
3. สถานะการออนไลน์ (Online / Offline) ให้คำนวณจากฟิลด์ `lastOnline` (หากได้รับการอัปเดตครั้งล่าสุดไม่เกิน 1 นาที ให้ถือว่าออนไลน์) ไม่มีการเก็บสถานะออนไลน์เป็นฟิลด์ถาวรในฐานข้อมูล
4. อุปกรณ์จะลบออกจากระบบได้ก็ต่อเมื่อมีสถานะการผูกคู่เป็น **ยังไม่ผูก (UNPAIRED)** เท่านั้น หากต้องการลบตัวที่ผูกอยู่ ต้องสั่งยกเลิกการผูกคู่ (Unpair) ก่อนเสมอ
5. ฝั่ง Admin **ไม่มีฟังก์ชันยกเลิก (Cancel) เหตุการณ์หกล้ม** เนื่องจากการยกเลิกเหตุการณ์ (False Alarm) ทำได้เฉพาะผู้สูงอายุที่กดปุ่มจริง (GPIO27) บนอุปกรณ์เท่านั้น

---

## Related Docs

- [System Overview](system_overview.md)
- [Admin Panel](../features/admin-panel.md)
- [API Reference](../api/api-reference.md)
- [Backend Deep Research](backend.md)
