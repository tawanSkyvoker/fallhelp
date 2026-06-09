# FallHelp Backend

Express v5 + TypeScript API for FallHelp, including MQTT ingestion, Socket.io realtime events, and PostgreSQL persistence.

## Scope

- REST API for mobile/admin clients
- MQTT handlers for IoT events (`fall`, `fall_cancelled`, `heartrate`, `status`)
- Socket.io realtime broadcasting
- Prisma data access and migrations

## Source Layout

```text
src/
├── app.ts
├── server.ts
├── controllers/
├── services/
├── routes/
├── middlewares/
├── iot/
│   ├── mqttClient.ts
│   ├── topics.ts
│   ├── payloadValidator.ts
│   ├── eventNormalizer.ts
│   └── handlers/
│       ├── fallHandler.ts
│       ├── fallCancelledHandler.ts
│       ├── heartRateHandler.ts
│       └── statusHandler.ts
└── realtime/
    └── socketServer.ts
```

Runtime note: confirmed fall handling updates the event first, emits Socket.io realtime alerts, then creates notification history and sends Expo Push.

## Quick Start

```bash
cd apps/backend-api
npm install
cp .env.example .env

# Update .env before running:
# DATABASE_URL, DATABASE_URL_DOCKER, JWT_SECRET, ENCRYPTION_KEY, MQTT_BROKER_URL

npm run prisma:migrate
npm run prisma:seed
npm run db:verify
npm run dev
```

Default local URLs:

- API: `http://localhost:3000`
- Health (internal): `http://localhost:3000/internal/health`

## Docker Compose

ไฟล์ [`../../docker-compose.yml`](../../docker-compose.yml) ที่ root ใช้ยก `backend`, `admin` และ `tunnel` ขึ้นพร้อมกันได้ (Mosquitto รันเป็น native service แยกต่างหาก)
โดย `npm run env:setup` จะสร้าง root `.env` เป็น symlink ไปที่ `apps/backend-api/.env`
เพื่อให้ Docker Compose อ่านค่า secret/local config ได้อัตโนมัติ

```bash
docker compose up -d --build --pull always
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

ค่าปริยาย:

- Backend: `http://localhost:3000`
- Admin: `http://localhost:5173`

หมายเหตุ runtime ปัจจุบัน:

- Docker image ของ backend รันจาก `dist/server.js` ไม่ได้รัน `tsx src/server.ts` ใน container แล้ว
- image ถูกลดขนาดโดยติดตั้งเฉพาะ production dependencies ของ backend ใน runtime stage
- ยังรองรับ `docker compose exec backend npx prisma migrate deploy` ตามเดิม
- ถ้าต้องการ Cloudflare named tunnel ให้เพิ่ม `--profile tunnel`

Admin จะ build ด้วย `VITE_API_URL=http://localhost:3000/api` โดยอัตโนมัติ
ถ้าต้องการ override ตอน build ให้ตั้ง `ADMIN_VITE_API_URL`

คำสั่ง cleanup ที่ใช้บ่อย:

```bash
docker builder prune -f
docker image prune -f
```

ถ้าต้องการดูขนาด image ปัจจุบัน:

```bash
docker image ls fallhelp-backend fallhelp-admin
docker system df
```

## Commands

```bash
npm run dev                  # API only (hot reload, uses external MQTT broker)
npm run dev:server           # API only (hot reload)
npm run build                # TypeScript build
npm run typecheck            # TypeScript check (no emit)
npm run lint                 # ESLint
npm run lint:fix             # ESLint autofix
npm run test:ci              # Unit tests (CI/sandbox-safe, no watchman)
npm run test -- --watchman=false
npm run db:test:setup        # Create/recreate fallhelp_test schema from current Prisma schema history
npm run test:integration     # Auto-prepare fallhelp_test, then run integration tests
npm run test:integration:raw # Run integration tests without re-preparing the test DB
npm run db:reset             # Reset DB + schema setup
npm run db:verify            # Verify PostgreSQL schema objects required by runtime
npm run prisma:studio        # Prisma Studio
```

## Environment

Use `apps/backend-api/.env.example` as source of truth. Important groups:

- Database: `DATABASE_URL`, `DATABASE_URL_DOCKER`
- Auth: `JWT_SECRET`, `JWT_EXPIRES_IN`
- Server: `PORT`, `NODE_ENV`, `LOG_LEVEL`
- MQTT: `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_DISABLED`
- Runtime tuning: `DEVICE_ONLINE_THRESHOLD_MS`, `WIFI_CONFIGURING_STALE_MS`
- Security: `ENCRYPTION_KEY` (32 chars exactly)

## Verify Before PR

```bash
npm run build
npm run typecheck
npm run lint
npm run test:ci
npm run test -- --watchman=false
```

If integration environment is ready (DB + broker):

```bash
npm run test:integration
```

`test:integration` จะ derive URL จาก `apps/backend-api/.env`, สร้างฐาน `fallhelp_test` ถ้ายังไม่มี, แล้ว recreate `public` schema ของ test DB ก่อน apply migration history ปัจจุบันทุกครั้ง
เพื่อกันปัญหา "มี test DB แต่ schema ไม่ครบ" โดยไม่แตะ dev DB หลัก

## Related Docs

- Root guide: [`../../README.md`](../../README.md)
- API docs package: [`./docs/README.md`](./docs/README.md)
- API reference: [`../../docs/api/api-reference.md`](../../docs/api/api-reference.md)
- Postman collection: [`./docs/api/postman_collection.json`](./docs/api/postman_collection.json)
- MQTT technical notes: [`../../docs/architecture/iot-mqtt.md`](../../docs/architecture/iot-mqtt.md)
- Project documentation index: [`../../docs/README.md`](../../docs/README.md)
