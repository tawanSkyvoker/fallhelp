# Libraries & Dependencies

## Doc Meta

- Audience: Developers, QA
- Source of Truth: [../../package.json](../../package.json), [../../package-lock.json](../../package-lock.json), [../../apps/backend-api/package.json](../../apps/backend-api/package.json), [../../apps/mobile/package.json](../../apps/mobile/package.json), [../../apps/admin/package.json](../../apps/admin/package.json)
- Status: Active
- Last Updated: May 25, 2026 (Removed stale mobile picker dependency from lockfiles and inventory)

---

## Overview

รายชื่อ library ที่ใช้งานในแต่ละ module ของระบบ FallHelp พร้อมคำอธิบายว่าใช้ทำอะไรในโปรเจกต์นี้

---

## Root Tooling

### Production Dependencies

| Library  | Version | ใช้ทำอะไรในโปรเจกต์                                   |
| -------- | ------- | ----------------------------------------------------- |
| `dotenv` | ^17.3.1 | โหลด environment variables สำหรับ root-level scripts  |
| `mqtt`   | ^5.15.0 | MQTT client สำหรับ root-level IoT scripts และ tooling |

### Dev Dependencies

| Library                        | Version | ใช้ทำอะไร                                                                                                  |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------- |
| `@flowfuse/node-red-dashboard` | ^1.30.2 | Dashboard nodes สำหรับ Node-RED sensor-lab workflow                                                        |
| `concurrently`                 | ^9.1.0  | รันหลาย process พร้อมกันสำหรับ workflow ที่ root                                                           |
| `expo`                         | ~55.0.26 | Root-level Expo package สำหรับให้ hoisted Expo config plugins resolve `expo/config-plugins` ใน monorepo    |
| `kill-port`                    | ^2.0.1  | ปิด port dev มาตรฐานผ่าน `npm run dev:stop`                                                                |
| `markdownlint-cli2`            | ^0.21.0 | ตรวจคุณภาพ Markdown ของ `README.md`, `AGENTS.md`, `CLAUDE.md`, และ `docs/**/*.md` ผ่าน config กลางที่ root |
| `node-red`                     | ^4.1.8  | Runtime สำหรับ flow ที่ใช้ใน sensor-lab และการทดสอบ IoT                                                    |
| `nx`                           | 22.6.3  | จัดการ workspace/task orchestration ใน monorepo                                                            |
| `patch-package`                | ^8.0.1  | คง patch ของ dependency ที่ต้องแก้เฉพาะโปรเจกต์                                                            |
| `react`                        | 19.2.0  | Version override กลางให้ workspace ใช้ React ตรงกัน                                                        |
| `react-dom`                    | 19.2.0  | Version override กลางให้ web targets ใช้ React DOM ตรงกัน                                                  |
| `react-native-reanimated`      | 4.2.1   | Version override กลางให้ mobile animation runtime ตรงกับ Expo SDK 55                                       |
| `react-test-renderer`          | 19.2.0  | Version override กลางสำหรับ React test renderer                                                            |
| `typescript`                   | ^6.0.3  | TypeScript compiler กลางสำหรับ root-level scripts/tools                                                    |

### Root Overrides

Root `package.json` ใช้ `overrides` เพื่อ pin React family, Reanimated, Prisma, Vite/PostCSS, และ dependency ย่อยด้าน security/compatibility ให้ workspace resolve ตรงกัน ดู exact list ใน [../../package.json](../../package.json)

---

## Mobile (React Native + Expo SDK 55)

### Production Dependencies

| Library                                     | Version  | ใช้ทำอะไรในโปรเจกต์                                                            |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `expo`                                      | ~55.0.26 | Expo SDK หลัก — runtime, build pipeline, และ managed workflow                  |
| `expo-router`                               | ~55.0.16 | File-based routing ทุกหน้าใน `app/` directory                                  |
| `react`                                     | 19.2.0   | Core React                                                                     |
| `react-native`                              | 0.83.6   | Core React Native                                                              |
| `react-dom`                                 | 19.2.0   | React DOM สำหรับ web target (Expo web)                                         |
| `@tanstack/react-query`                     | ^5.90.21 | Data fetching, caching, และ invalidation ทุก API call ในแอป                    |
| `axios`                                     | ^1.16.0  | HTTP client ติดต่อ backend API (`services/`)                                   |
| `socket.io-client`                          | ^4.8.3   | รับ real-time event จาก backend — fall alert, heart rate update, device status |
| `zustand`                                   | ^5.0.12  | Global state สำหรับ realtime stores และ lightweight runtime state              |
| `nativewind`                                | ^4.2.2   | Tailwind CSS สำหรับ React Native (ใช้ `className` บน component ทุกหน้า)        |
| `tailwindcss`                               | ^3.4.17  | Utility class engine ของ NativeWind                                            |
| `expo-font`                                 | ~55.0.8  | โหลด Kanit และ Material Symbols Outlined (`components/MaterialSymbol.tsx`)     |
| `expo-secure-store`                         | ~55.0.14 | เก็บ JWT token อย่างปลอดภัย                                                    |
| `@react-native-async-storage/async-storage` | 2.2.0    | เก็บข้อมูลถาวรที่ไม่ sensitive เช่น preferences                                |
| `expo-notifications`                        | ~55.0.23 | รับและจัดการ Expo Push Notification (fall alert)                               |
| `expo-device`                               | ~55.0.17 | ตรวจสอบว่ารันบน physical device จริงก่อนขอ push token                          |
| `expo-constants`                            | ~55.0.16 | ดึง app config เช่น `expoConfig` สำหรับ build                                  |
| `react-native-ble-manager`                  | ^12.4.5  | BLE สำหรับ provisioning อุปกรณ์ ESP32 ผ่านหน้า pairing wizard                  |
| `react-native-wifi-reborn`                  | ^4.13.6  | สแกนรายการ WiFi รอบข้างใน flow BLE WiFi provisioning ของ mobile                |
| `expo-camera`                               | ~55.0.19 | สแกน QR code ตอน device pairing                                                |
| `react-native-safe-area-context`            | ~5.6.2   | SafeArea insets สำหรับ notch และ nav bar                                       |
| `expo-navigation-bar`                       | ~55.0.13 | ซ่อน/ควบคุม Android navigation bar                                             |
| `expo-system-ui`                            | ~55.0.18 | กำหนดสี background ระดับ system UI                                             |
| `react-native-screens`                      | ~4.23.0  | Native screen optimization ร่วมกับ expo-router                                 |
| `react-native-gesture-handler`              | ~2.30.0  | Gesture recognition พื้นฐาน (swipe, tap)                                       |
| `react-native-reanimated`                   | 4.2.1    | Animation engine (ใช้กับ gesture และ layout animation)                         |
| `react-native-worklets`                     | 0.7.4    | Worklet runtime ที่ Reanimated 4 ต้องการ                                       |
| `react-native-draggable-flatlist`           | ^4.0.3   | รายการ emergency contacts ที่ลากเพื่อเรียงลำดับได้                             |
| `react-native-keyboard-aware-scroll-view`   | ^0.9.5   | Scroll view ที่ขยับขึ้นอัตโนมัติเมื่อ keyboard เปิด                            |
| `react-native-paper`                        | ^5.15.0  | UI component บางส่วนที่ใช้ Material Design                                     |
| `react-native-toast-message`                | ^2.3.3   | Toast แจ้งผลสำเร็จ/ผิดพลาดใน flow ต่าง ๆ                                       |
| `expo-image`                                | ~55.0.11 | แสดงรูปภาพแบบ optimized พร้อม caching                                          |
| `expo-image-picker`                         | ^55.0.20 | เลือก/แก้ไขรูปโปรไฟล์ผ่าน Expo Image Picker                                    |
| `expo-splash-screen`                        | ~55.0.21 | ควบคุม splash screen ให้ค้างรอจนโหลด font/auth เสร็จ                           |
| `expo-status-bar`                           | ~55.0.6  | ควบคุมสี status bar                                                            |
| `expo-linking`                              | ~55.0.15 | Deep link สำหรับ push notification tap                                         |
| `expo-web-browser`                          | ~55.0.16 | เปิด URL ใน in-app browser                                                     |
| `expo-build-properties`                     | ~55.0.14 | กำหนด native build config (minSdk, NSUsage strings)                            |
| `expo-dev-client`                           | ~55.0.35 | Dev build client สำหรับ custom native modules                                  |
| `react-native-web`                          | ~0.21.2  | Web compatibility layer สำหรับ Expo web target                                 |
| `@react-navigation/native`                  | ^7.1.8   | Navigation core (ใช้ร่วมกับ expo-router)                                       |
| `@react-navigation/native-stack`            | ^7.3.16  | Native stack navigator                                                         |

### Expo-Bundled Dependencies Used Directly

| Library              | Resolved Version | ใช้ทำอะไรในโปรเจกต์                                                                                                 |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@expo/vector-icons` | 15.1.1           | ไอคอนจาก Ionicons, MaterialIcons, และ MaterialCommunityIcons สำหรับ UI ที่ต้องใช้ glyph map ชัดเจน เช่น รายการ WiFi |

### Dev Dependencies

| Library                             | Version  | ใช้ทำอะไร                                   |
| ----------------------------------- | -------- | ------------------------------------------- |
| `typescript`                        | ~5.9.2   | Type checking สำหรับ Expo SDK 55            |
| `eslint`                            | ^9.30.1  | Linting                                     |
| `@eslint/eslintrc`                  | ^3.3.5   | ESLint flat-config compatibility            |
| `@eslint/js`                        | ^9.39.4  | ESLint recommended JavaScript rules         |
| `eslint-config-expo`                | ~55.0.1  | Expo ESLint preset                          |
| `eslint-config-prettier`            | ^10.1.8  | ปิด ESLint rules ที่ชนกับ Prettier          |
| `eslint-import-resolver-typescript` | ^4.4.4   | Resolve TypeScript imports ใน ESLint        |
| `eslint-plugin-prettier`            | ^5.5.5   | รัน Prettier ผ่าน ESLint                    |
| `eslint-plugin-unused-imports`      | ^4.4.1   | ตรวจ unused imports                         |
| `@typescript-eslint/eslint-plugin`  | ^8.56.1  | TypeScript lint rules                       |
| `@typescript-eslint/parser`         | ^8.56.1  | TypeScript parser สำหรับ ESLint             |
| `prettier`                          | ^3.8.1   | Code formatting                             |
| `jest`                              | ~29.7.0  | Test runner                                 |
| `jest-expo`                         | ~55.0.18 | Jest preset สำหรับ Expo project             |
| `@testing-library/react-native`     | ^13.3.3  | Component testing utilities                 |
| `@testing-library/jest-native`      | ^5.4.3   | Custom matchers สำหรับ React Native         |
| `@types/jest`                       | 29.5.14  | Jest type definitions                       |
| `@types/react`                      | ~19.2.10 | React type definitions                      |
| `react-test-renderer`               | 19.2.0   | Render component ใน test                    |
| `@expo/ngrok`                       | ^4.1.3   | Tunnel support สำหรับ `expo start --tunnel` |
| `knip`                              | ^6.0.5   | Dead-code scan ของ mobile package           |
| `patch-package`                     | ^8.0.1   | Patch node_modules bug โดยไม่ fork          |

---

## Backend (Node.js 24 + Express v5)

### Production Dependencies

| Library              | Version | ใช้ทำอะไรในโปรเจกต์                                                           |
| -------------------- | ------- | ----------------------------------------------------------------------------- |
| `express`            | ^5.2.1  | HTTP server หลัก — routing, middleware, error handling                        |
| `@prisma/client`     | 7.8.0   | ORM client สำหรับ query PostgreSQL                                            |
| `@prisma/adapter-pg` | 7.8.0   | Prisma adapter สำหรับ pg driver                                               |
| `mqtt`               | ^5.15.0 | MQTT client เชื่อมต่อ HiveMQ Cloud — รับ fall/heartrate/status จาก ESP32      |
| `socket.io`          | ^4.8.3  | Real-time server ส่ง event ไปยัง mobile app                                   |
| `jsonwebtoken`       | ^9.0.3  | สร้างและตรวจสอบ JWT auth token                                                |
| `bcryptjs`           | ^3.0.3  | Hash รหัสผ่านก่อนเก็บลง DB                                                    |
| `resend`             | ^6.9.2  | ส่ง email OTP สำหรับ forgot password flow                                     |
| `pg`                 | ^8.20.0 | PostgreSQL driver ที่ Prisma adapter ใช้เชื่อมต่อ database                    |
| `express-rate-limit` | ^8.2.1  | Rate limiting ป้องกัน brute force บน auth endpoints                           |
| `cors`               | ^2.8.6  | CORS middleware อนุญาต mobile app และ admin panel                             |
| `debug`              | ^4.4.3  | Namespace logging (`fallhelp:mqtt`, `fallhelp:socket` ฯลฯ) ไม่ใช้ console.log |
| `dotenv`             | ^17.3.1 | โหลด `.env` ทุก environment variable                                          |

### Dev Dependencies

| Library                            | Version | ใช้ทำอะไร                                              |
| ---------------------------------- | ------- | ------------------------------------------------------ |
| `prisma`                           | 7.8.0   | CLI — migrate, generate, seed, studio                  |
| `typescript`                       | ^6.0.3  | Type checking (strict mode)                            |
| `typescript-eslint`                | ^8.56.1 | Shared TypeScript ESLint tooling                       |
| `tsx`                              | ^4.21.0 | Run TypeScript โดยตรงพร้อม hot reload ตอน dev          |
| `ts-node-dev`                      | ^2.0.0  | Legacy TypeScript dev runner ที่ยังอยู่ใน package      |
| `eslint`                           | ^9.30.1 | Linting                                                |
| `@eslint/js`                       | ^9.30.1 | ESLint recommended JavaScript rules                    |
| `eslint-config-prettier`           | ^10.1.8 | ปิด ESLint rules ที่ชนกับ Prettier                     |
| `eslint-plugin-prettier`           | ^5.5.5  | รัน Prettier ผ่าน ESLint                               |
| `eslint-plugin-unused-imports`     | ^4.4.1  | ตรวจ unused imports                                    |
| `@typescript-eslint/eslint-plugin` | ^8.56.1 | TypeScript lint rules                                  |
| `@typescript-eslint/parser`        | ^8.56.1 | TypeScript parser สำหรับ ESLint                        |
| `prettier`                         | ^3.8.1  | Code formatting                                        |
| `jest`                             | 30.2.0  | Test runner                                            |
| `ts-jest`                          | ^29.4.6 | TypeScript transformer สำหรับ Jest                     |
| `supertest`                        | ^7.2.2  | HTTP integration test กับ Express app                  |
| `cross-env`                        | ^10.1.0 | Set environment variable ข้าม platform (Windows/Linux) |
| `concurrently`                     | ^9.2.1  | รัน script หลายตัวพร้อมกัน (dev:all)                   |
| `knip`                             | ^6.0.4  | Dead-code scan ของ backend package                     |
| `@types/cors`                      | ^2.8.19 | Type definitions สำหรับ CORS                           |
| `@types/debug`                     | ^4.1.12 | Type definitions สำหรับ debug                          |
| `@types/express`                   | ^5.0.6  | Type definitions สำหรับ Express v5                     |
| `@types/jest`                      | ^30.0.0 | Type definitions สำหรับ Jest                           |
| `@types/jsonwebtoken`              | ^9.0.10 | Type definitions สำหรับ jsonwebtoken                   |
| `@types/node`                      | ^25.3.0 | Type definitions สำหรับ Node.js                        |
| `@types/pg`                        | ^8.16.0 | Type definitions สำหรับ PostgreSQL driver              |
| `@types/supertest`                 | ^6.0.3  | Type definitions สำหรับ Supertest                      |

---

## Admin (React 19 + Vite)

### Production Dependencies

| Library                 | Version  | ใช้ทำอะไรในโปรเจกต์                                          |
| ----------------------- | -------- | ------------------------------------------------------------ |
| `react`                 | 19.2.0   | Core React                                                   |
| `react-dom`             | 19.2.0   | DOM renderer                                                 |
| `react-router-dom`      | ^7.13.1  | Client-side routing ทุกหน้าใน Admin panel                    |
| `@tanstack/react-query` | ^5.90.21 | Data fetching, caching, invalidation สำหรับ API call ทั้งหมด |
| `axios`                 | ^1.16.0  | HTTP client ติดต่อ backend API                               |
| `@heroicons/react`      | ^2.2.0   | ไอคอนทั่ว Admin UI                                           |
| `qrcode.react`          | ^4.2.0   | แสดง QR code สำหรับ device pairing ในหน้า admin              |
| `sonner`                | ^2.0.7   | Toast notification (success/error)                           |

### Dev Dependencies

| Library                       | Version  | ใช้ทำอะไร                                           |
| ----------------------------- | -------- | --------------------------------------------------- |
| `vite`                        | ^7.3.1   | Bundler และ dev server                              |
| `@vitejs/plugin-react`        | ^5.1.4   | Vite plugin สำหรับ React (Fast Refresh)             |
| `tailwindcss`                 | ^4.2.2   | Utility-first CSS styling ทั่ว Admin                |
| `@tailwindcss/vite`           | ^4.2.2   | Tailwind v4 integration กับ Vite                    |
| `postcss`                     | ^8.5.6   | CSS transformation pipeline                         |
| `typescript`                  | ^6.0.3   | Type checking                                       |
| `typescript-eslint`           | ^8.56.1  | Shared TypeScript ESLint tooling                    |
| `eslint`                      | ^9.39.1  | Linting                                             |
| `@eslint/js`                  | ^9.39.1  | ESLint recommended JavaScript rules                 |
| `eslint-config-prettier`      | ^10.1.8  | ปิด ESLint rules ที่ชนกับ Prettier                  |
| `eslint-plugin-prettier`      | ^5.5.5   | รัน Prettier ผ่าน ESLint                            |
| `eslint-plugin-react-hooks`   | ^7.0.1   | ตรวจ React Hooks rules                              |
| `eslint-plugin-react-refresh` | ^0.5.2   | ตรวจ Fast Refresh constraints                       |
| `globals`                     | ^17.3.0  | Browser/test globals สำหรับ ESLint config           |
| `prettier`                    | ^3.8.1   | Code formatting                                     |
| `jest`                        | ^30.2.0  | Test runner                                         |
| `ts-jest`                     | ^29.4.6  | TypeScript transformer สำหรับ Jest                  |
| `jest-environment-jsdom`      | ^30.2.0  | Browser environment สำหรับ component test           |
| `@testing-library/dom`        | ^10.4.1  | DOM testing utilities ที่ React Testing Library ใช้ |
| `@testing-library/react`      | ^16.3.2  | Component testing utilities                         |
| `@testing-library/jest-dom`   | ^6.9.1   | Custom DOM matchers                                 |
| `@types/jest`                 | ^30.0.0  | Type definitions สำหรับ Jest                        |
| `@types/node`                 | ^25.3.0  | Type definitions สำหรับ Node.js                     |
| `@types/react`                | ^19.2.14 | Type definitions สำหรับ React                       |
| `@types/react-dom`            | ^19.2.3  | Type definitions สำหรับ React DOM                   |
| `knip`                        | ^6.0.5   | Dead-code scan ของ admin package                    |

---

## Arduino (ESP32 Firmware)

### External Libraries (ติดตั้งผ่าน Arduino Library Manager)

| Library                 | ใช้ทำอะไรในโปรเจกต์                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `ArduinoJson`           | Serialize/deserialize JSON สำหรับ MQTT payload ทุก topic (fall, heartrate, status, config) |
| `PubSubClient`          | MQTT client บน ESP32 — publish/subscribe กับ HiveMQ Cloud ผ่าน TLS                         |
| `PulseSensorPlayground` | อ่านค่าชีพจรจาก XD-58C pulse sensor (GPIO34) พร้อม interrupt-based sampling                |
| `I2Cdev`                | I2C abstraction layer สำหรับอ่าน MPU6050                                                   |
| `MPU6050`               | Driver อ่านค่า accelerometer และ gyroscope (GPIO21/22 SDA/SCL) สำหรับตรวจจับการหกล้ม       |

### Built-in ESP32 Arduino Core (ไม่ต้อง install แยก)

| Library                                            | ใช้ทำอะไรในโปรเจกต์                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `WiFi`                                             | เชื่อมต่อ WiFi และจัดการ reconnect อัตโนมัติ                                 |
| `WiFiClientSecure`                                 | TLS client สำหรับ MQTT over TLS port 8883 (HiveMQ Cloud)                     |
| `BLEDevice` / `BLEServer` / `BLEUtils` / `BLE2902` | BLE GATT server สำหรับ provisioning WiFi credentials ผ่านแอปตอน pairing      |
| `Preferences`                                      | เก็บ WiFi SSID/password และ device config ใน NVS flash (ไม่หายเมื่อรีสตาร์ท) |
| `Wire`                                             | I2C communication bus สำหรับ MPU6050 (GPIO21=SDA, GPIO22=SCL)                |
| `stdarg.h`                                         | Variadic argument สำหรับ printf-style debug logging                          |

---

## Related Docs

- [Project Structure](../architecture/project-structure.md)
- [Cross-Platform Development](../ops/cross-platform-development.md)
- [Firmware AI Context](../ai/firmware.md)
