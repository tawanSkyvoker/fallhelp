# FallHelp Admin

React + Vite web admin panel for FallHelp device operations.

## Scope

- Device management view for registered ESP32 devices
- Admin authentication and protected routes
- API integration for device list, register, delete, and force-unpair workflows

## Quick Start

```bash
cd apps/admin
npm install
cp .env.example .env
npm run dev
```

Default local URL: `http://localhost:5173`  
Expected backend API URL: `http://localhost:3000/api`

## Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run preview
```

## Docker

สามารถรันผ่าน compose ที่ root ได้จาก [`../../docker-compose.yml`](../../docker-compose.yml)

```bash
docker compose --env-file apps/backend-api/.env up -d --build --pull always admin
```

ค่าปริยายของหน้าเว็บใน container คือ `http://localhost:5173`

## Environment

Use `apps/admin/.env.example` as source of truth.

- `VITE_API_URL=http://localhost:3000/api`

## Data Layer

- `src/services/api.ts` เป็น Axios instance กลางสำหรับ base URL, auth token, interceptors และ 401 handling
- `src/services/adminAuthService.ts` รับผิดชอบการเข้าสู่ระบบของผู้ดูแลระบบ
- `src/services/adminDeviceService.ts` รวม fetch/mutation functions ของ Admin API สำหรับ device list, register, delete และ force-unpair
- `src/hooks/useAdminDevices.ts` รับผิดชอบ TanStack Query cache/state ของหน้า Devices เช่น `queryKey`, polling interval และ invalidation

## Verify Before PR

```bash
npm run build
npm run typecheck
npm run lint
npm run test
```

## Related Docs

- Root guide: [`../../README.md`](../../README.md)
- Documentation index: [`../../docs/README.md`](../../docs/README.md)
- Admin feature spec: [`../../docs/features/admin-panel.md`](../../docs/features/admin-panel.md)
