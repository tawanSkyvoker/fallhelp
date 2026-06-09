# System Design & Architecture

## Doc Meta

- Audience: Backend/Mobile/Admin Dev, QA
- Source of Truth: [apps/backend-api/src/](../../apps/backend-api/src), [apps/mobile/app/](../../apps/mobile/app), [apps/admin/src/](../../apps/admin/src)
- Status: Active
- Last Updated: May 10, 2026

---

## Overview

เอกสารนี้อธิบายสถาปัตยกรรมหลักของระบบ FallHelp: IoT ingestion, Database, Mobile App, Admin Panel และ Notification System

---

## System Flow (High-level)

```
IoT Device → MQTT → Backend API/Realtime Layer → (Socket.io + Push) → Mobile
                                              ↘ DB (PostgreSQL)
Admin Panel → Backend API → DB
```

---

## 1) Database Architecture (PostgreSQL)

We use PostgreSQL to store event data from IoT devices (Fall Detection & Heart Rate).

### Setup & Reset

```bash
npm run db:reset --prefix apps/backend-api
```

### Verification

```bash
npm run db:verify --prefix apps/backend-api
```

**Checks:** Prisma migrations, tables/constraints, indexes, and data integrity checks

---

## 2) Mobile App Architecture

### Core Providers & App Shell (`apps/mobile/app/_layout.tsx`)

- **AuthProvider** - auth state + token
- **DialogProvider** - centralized dialogs
- **useSocketConnection + Zustand stores** - realtime socket lifecycle และ runtime telemetry state
- **React Query** - caching + fetching
- **SafeAreaProvider + PaperProvider** - UI base
- **useProtectedRoute** - route guard
- **usePushNotifications** - Expo Push token registration + foreground push fallback invalidation

### Error Handling

- Logger: `apps/mobile/utils/logger.ts`
- API interceptor: `apps/mobile/services/api.ts`
- Error boundaries: `expo-router` + custom `ErrorBoundary`

### Real-time Events

- `fall_detected`, `event_status_changed`, `heart_rate_update`, `device_status_update`, `system_message`

---

## 3) Admin Panel Architecture

### Auth & Routing

- `apps/admin/src/App.tsx` uses `AuthProvider`, `ThemeProvider`, `React Query`
- **ProtectedRoute** enforces login
- **No public admin register/reset** (seed/admin-managed only)

### API Client

- `apps/admin/src/services/api.ts` attaches JWT
- Auto-redirect on 401 (non-login request)

---

## 4) Background Scheduler Architecture

Scheduled tasks ปัจจุบันถูก bootstrap ผ่าน `initSchedulers()` ใน `apps/backend-api/src/schedulers/otpScheduler.ts` และถูกเรียกครั้งเดียวใน `server.ts` หลัง HTTP server เริ่มทำงาน

| Scheduler    | Location          | Schedule         | Purpose                      |
| ------------ | ----------------- | ---------------- | ---------------------------- |
| `otpCleanup` | `otpScheduler.ts` | Hourly + startup | ลบ OTP หมดอายุใน `auth_otps` |

> ถ้าจะเพิ่ม scheduler ใหม่ในโครงสร้างปัจจุบัน ให้เพิ่ม logic ลงไฟล์ scheduler bootstrap ที่ใช้งานจริง หรือแยก helper ใหม่แล้ว import เข้ามาที่ `otpScheduler.ts` ในโฟลเดอร์ `schedulers`

---

## 5) Notification System Architecture

### Backend

- `notificationService.ts` creates notification records
- `pushNotification.ts` sends Expo Push for confirmed fall alerts
- `userRoutes` exposes `/api/users/me/push-token`
- `authRoutes` exposes `/api/auth/logout` to clear `users.pushToken` when the mobile app signs out
- `fallHandler.ts` emits Socket.io before push/notification side effects so the dashboard card updates first
- `notifications.eventId` เป็น required FK ไปยัง `events.id` เพื่อให้ join เหตุการณ์ตรงจาก relational model

### Mobile

- `notificationService.ts` handles list/read/read-all/unread count
- Notifications screen: `apps/mobile/app/(features)/(notification)/notifications.tsx`
- Unread badge: `apps/mobile/app/(tabs)/dashboard.tsx`
- `useSocketConnection.ts` refetches unread count and notification list together after confirmed fall so the badge does not appear before the notification list item

---

## Related Docs

- [`project-structure.md`](project-structure.md)
- [`../planning/functional-requirements.md`](../planning/functional-requirements.md)
- [`../tech/api-reference.md`](../api/api-reference.md)

---
