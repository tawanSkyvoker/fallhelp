# FallHelp Project Structure

## Doc Meta

- Audience: Dev/QA/PM
- Source of Truth: repository tree + [package.json](../../package.json)
- Status: Active
- Last Updated: May 30, 2026

---

## Overview

โครงสร้างโปรเจค FallHelp แบ่งตาม domain หลัก: Backend, Mobile, Admin, Firmware (ESP32) และ Docs

---

## Tech Stack

| ส่วน            | เทคโนโลยี                                                             |
| --------------- | --------------------------------------------------------------------- |
| **Mobile App**  | Expo SDK 55 (React Native), TypeScript, Expo Router, React Query, NativeWind |
| **Backend**     | Node.js 24, Express v5, Prisma 7.8.0, PostgreSQL                                   |
| **Admin Panel** | Vite, React 19.2.0, TypeScript, TailwindCSS v4, React Router, React Query |
| **IoT Device**  | ESP32 + MPU6050 + Pulse Sensor XD-58C + Grove Speaker                 |

---

## Folder Structure

```
fallhelp/
├── README.md                 # Project overview
├── AGENTS.md                 # AI agent guidelines
├── .gitignore
├── package.json              # Root scripts: dev:all, infra:scan, monitors
├── .agent/                   # FallHelp-owned canonical AI skills
├── .agents/                  # Nx-managed workspace skills
├── patches/                  # patch-package overrides
├── scripts/                  # Shared repo automation grouped by role
│   ├── audit/                # audit:instructions, audit:comments:strict, infra:scan
│   ├── dev/                  # platform checks, install, dev launcher, postinstall
│   ├── env/                  # .env setup helpers
│   ├── iot/                  # Firmware monitor, MQTT monitor, Node-RED, sim fall
│   └── lib/                  # Shared script helpers
│
├── apps/
│   ├── backend-api/          # Express.js Backend
│   │   ├── src/
│   │   │   ├── server.ts     # HTTP + Socket.io + MQTT bootstrap
│   │   │   ├── app.ts        # Express app setup + routes
│   │   │   ├── prisma.ts     # Prisma client singleton
│   │   │   ├── schedulers/   # Background tasks
│   │   │   │   └── otpScheduler.ts # OTP cleanup scheduler bootstrap
│   │   │   ├── constants/    # Shared constants (Domain, thresholds)
│   │   │   ├── config/       # Env boundary + shared origin policy
│   │   │   ├── controllers/  # Request handlers
│   │   │   ├── services/     # Business logic
│   │   │   ├── routes/       # API endpoints
│   │   │   ├── middlewares/  # Auth, validation, rate limit
│   │   │   ├── utils/        # JWT, password, push notification
│   │   │   ├── iot/          # MQTT client, topics, validators, normalizer, handlers/
│   │   │   ├── realtime/     # Socket.io server manager
│   │   │   └── __tests__/    # Backend unit & integration tests
│   │   ├── prisma/           # Database schema & migrations
│   │   ├── scripts/          # Backend-local DB setup/verify scripts
│   │   ├── dist/             # TypeScript build output
│   │   ├── docs/             # Backend-local docs / notes
│   │   └── (ใช้ MQTT Broker ภายนอก) # ตั้งค่า broker ผ่าน OS service / infra ภายนอก repo
│
│   ├── mobile/               # React Native/Expo App
│   │   ├── app/              # Expo Router screens
│   │   │   ├── (auth)/       # Login, Register, Forgot Password, OTP
│   │   │   ├── (tabs)/       # Dashboard, History
│   │   │   ├── (setup)/      # First-time setup wizard
│   │   │   └── (features)/   # Device, Elder, Emergency, Notification, Report, Profile
│   │   ├── components/       # Reusable UI components
│   │   ├── context/          # Auth, Dialog providers
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API clients + BLE/WiFi helpers
│   │   ├── constants/        # Config, env boundary, Theme, Thresholds
│   │   ├── utils/            # Logger, setup storage, safeRouter, searchParams, helpers
│   │   ├── assets/           # Fonts, images, icons
│   │   ├── __tests__/        # Mobile unit/smoke tests
│   │   └── global.css        # NativeWind base styles
│
│   └── admin/                # Vite + React Admin Panel
│       └── src/
│           ├── App.tsx       # Providers + router + protected shell
│           ├── main.tsx      # React entry point
│           ├── pages/        # Login, Devices
│           ├── components/   # Reusable components
│           ├── constants/    # Shared constants
│           ├── config/       # Env boundary helpers
│           ├── context/      # Auth & Theme context
│           ├── hooks/        # TanStack Query hooks for cache/state
│           ├── layouts/      # Layout wrappers
│           ├── services/     # Axios client + Admin service layer
│           ├── types/        # Shared type definitions
│           ├── utils/        # Logger, config validation, date helpers
│           └── __tests__/    # Admin unit tests
│
├── firmware/esp32/                  # ESP32 Firmware (Hardware)
│   ├── README.md                    # Firmware overview & BLE provisioning
│   ├── START_HERE.md                # Quickstart for hardware testing
│   ├── src/
│   │   ├── main_firmware/   # Production firmware: BLE + WiFi + MQTT + sensors
│   │   │   ├── main_firmware.ino         # Orchestration & boot
│   │   │   ├── BLEProvisioning.ino       # BLE setup & callbacks
│   │   │   ├── WiFiConnectionManager.ino # WiFi loop & config
│   │   │   ├── FallDetectionConfig.ino   # Fall thresholds, sensitivity, cancel window
│   │   │   └── DeviceMqttClient.ino      # MQTT client & payloads
│   │   └── sensor_tuning/   # Calibration firmware (no full backend flow)
│   ├── fall_detection_sensor_lab/ # Fall Detection Sensor Lab flow, CSV scripts, and runs
│   └── docs/                 # Device/guides/references
│
└── docs/                     # Documentation
    ├── ai/                   # AI context memory per module
    ├── architecture/         # System design, data model, MQTT/IoT architecture
    ├── features/             # Feature specs, tech notes & UI/UX (merged)
    ├── api/                  # REST API reference
    ├── planning/             # Requirements & development roadmap
    ├── backlog/              # Future features not yet implemented
    ├── ops/                  # Deployment, troubleshooting, security
    └── testing/              # Testing glossary & strategy
```

`main_firmware/` is a multi-file Arduino sketch: upload/open `main_firmware.ino`, and Arduino IDE compiles the sibling `.ino` modules in the same folder into the same firmware image.

---

## Background Schedulers (`apps/backend-api/src/schedulers/otpScheduler.ts`)

Scheduled tasks ปัจจุบันถูก bootstrap ผ่าน `initSchedulers()` ใน `apps/backend-api/src/schedulers/otpScheduler.ts` และถูกเรียกครั้งเดียวใน `server.ts` หลัง HTTP server เริ่มทำงาน

| File              | Schedule               | Purpose                             |
| ----------------- | ---------------------- | ----------------------------------- |
| `otpScheduler.ts` | Every 1 hour + startup | ลบ OTP ที่หมดอายุออกจาก `auth_otps` |

---

## API Surface (Summary)

> รายละเอียดเต็ม: [`api-reference.md`](../api/api-reference.md)

| หมวด              | Endpoints                                                            |
| ----------------- | -------------------------------------------------------------------- |
| Auth              | register, login, request-otp, verify-otp, reset-password, logout, me |
| User              | profile, password, push-token, elders                                |
| Elder             | create, list, detail, update                                         |
| Device            | lookup by code, wifi-config (GET/PUT)                                |
| Device Pairing    | pair, unpair                                                         |
| Event             | list, detail, monthly summary                                        |
| Emergency Contact | CRUD, reorder (nested under elder)                                   |
| Notification      | list, unread-count, mark read (body-based), read-all                 |
| Admin             | devices create/list/delete/unpair                                    |

---

## Realtime Communication

### MQTT (IoT → Backend)

- `device/{id}/fall`
- `device/{id}/heartrate`
- `device/{id}/status`
- `device/{id}/event`
- `device/{id}/config/ack`
- `device/{id}/lwt`
- `events/{id}`

### Socket.io (Backend → Mobile)

- `fall_detected`
- `event_status_changed`
- `heart_rate_update`
- `device_status_update`
- `system_message`

---

## Related Docs

- [`system-design.md`](system-design.md)
- [`../planning/functional-requirements.md`](../planning/functional-requirements.md)
- [`../api/api-reference.md`](../api/api-reference.md)

---
