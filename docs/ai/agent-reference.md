# FallHelp Agent Reference

## Doc Meta

- Audience: AI agents, developers needing quick repo orientation
- Source of Truth: current repo structure, common commands, and firmware operator workflow
- Status: Active
- Last Updated: May 30, 2026

---

## Overview

> Quick reference for AI agents and developers.
>
> Use this file when you need repository structure, key entry points, commands, hardware quick facts, firmware operator mode, or current project notes.

---

## 1. Project Structure (Quick Reference)

```text
fallhelp/
├── apps/
│   ├── backend-api/      # Express v5 REST API + MQTT handlers + Socket.io
│   ├── mobile/           # React Native app (Expo SDK 55, Expo Router)
│   └── admin/            # Admin device management panel (React 19 + Vite + TailwindCSS)
├── scripts/             # Shared audit/dev/env/iot/docker helpers
├── firmware/esp32/
│   ├── src/
│   │   ├── main_firmware/ # MAIN firmware: orchestrated multi-file Arduino sketch
│   │   └── sensor_tuning/ # Hardware-only tuning firmware (no backend)
│   ├── fall_detection_sensor_lab/ # Fall Detection Sensor Lab (optional)
│   └── docs/             # Firmware guides, component docs, and references
├── docs/
│   ├── ai/              # AI context memory and quick references
│   ├── api/             # API reference
│   ├── architecture/    # System design and data models
│   ├── backlog/         # Planned features (not yet implemented)
│   ├── features/        # Feature specs + technical implementation (merged)
│   ├── ops/             # Deployment and troubleshooting
│   ├── planning/        # Requirements and roadmap
│   └── testing/         # Testing strategy and glossary
└── .agent/
    └── skills/          # Workspace AI skills
```

## 2. Key Files to Know

| File                                                 | Purpose                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `apps/backend-api/src/server.ts`                     | App entry point                                                 |
| `apps/backend-api/src/iot/mqttClient.ts`             | MQTT connection & topic routing                                 |
| `apps/backend-api/src/schedulers/otpScheduler.ts`    | Background scheduler bootstrap                                  |
| `apps/backend-api/prisma/schema.prisma`              | Database schema (source of truth)                               |
| `apps/mobile/app/_layout.tsx`                        | Root layout + all providers                                     |
| `apps/mobile/context/AuthContext.tsx`                | Auth state management                                           |
| `apps/mobile/hooks/useSocketConnection.ts`           | Real-time socket lifecycle hook                                 |
| `apps/admin/src/App.tsx`                             | Admin app entry + routing                                       |
| `firmware/esp32/src/main_firmware/main_firmware.ino`         | Main ESP32 sketch: boot orchestration, shared state, Serial CLI  |
| `firmware/esp32/src/main_firmware/BLEProvisioning.ino`       | BLE GATT server, provisioning callbacks, status characteristic   |
| `firmware/esp32/src/main_firmware/WiFiConnectionManager.ino` | WiFi connect/retry, NVS credentials, pending config rollback     |
| `firmware/esp32/src/main_firmware/DeviceMqttClient.ino`      | MQTT transport, command topic handling, status/config ACK publish |
| `firmware/esp32/START_HERE.md`                       | Fall Detection Sensor Lab data-collection quickstart (optional) |
| `firmware/esp32/src/sensor_tuning/build_profile.h`   | Single-sensor profile for tuning                                |

Firmware note: `main_firmware/` is one Arduino sketch split into multiple `.ino` files. Open/upload `main_firmware.ino`, then inspect the sibling module that owns the behavior being changed.

---

## 3. Hardware Reference (ESP32 Device)

### Microcontroller & Sensors

| Component       | Model                              | Purpose                                    |
| --------------- | ---------------------------------- | ------------------------------------------ |
| Microcontroller | ESP32-DevKitC V4 (ESP32-WROOM-32U) | Main processing unit, WiFi, BLE            |
| IMU Sensor      | GY-521 MPU6050                     | Fall detection (Accelerometer + Gyroscope) |
| Pulse Sensor    | XD-58C                             | Heart rate monitoring (PPG, earclip)       |

### Power System

| Component       | Model                   | Purpose                                |
| --------------- | ----------------------- | -------------------------------------- |
| Battery         | LiPo 3.7V 1200mAh       | Main power source                      |
| Charging Module | TP4056 LiPo             | USB charging with LED status indicator |
| Power Module    | Step-Up Boost 3.7V → 5V | Voltage conversion for 5V components   |

### Peripherals

| Component                       | Purpose                                 |
| ------------------------------- | --------------------------------------- |
| Large Push Button Module        | False alarm cancellation (15s timeout)  |
| Grove Speaker Module            | Audible alert on fall detection         |
| Slide Switch SS12D00 G4 (3-Pin) | Device power on/off                     |
| Easy Earclip Mount              | Stable PPG sensor attachment at earlobe |
| PCB Circuit Board               | Component integration                   |
| Neck Strap                      | Wearable form factor for elderly user   |

### Passive & Protection Components

| Component               | Value / Spec             | Placement                                                 |
| ----------------------- | ------------------------ | --------------------------------------------------------- |
| Electrolytic Capacitor  | 1000 µF 16V              | Close to VIN / GND pins of ESP32                          |
| Electrolytic Capacitor  | 470 µF 16V               | Close to VCC of Grove Speaker Module                      |
| Ceramic Capacitor (104) | 0.1 µF (100 nF)          | Bypass — close to IC pins of ESP32, MPU6050, Pulse Sensor |
| Resistor                | 10 kΩ                    | Pull-down on Grove Speaker SIG to GND                     |
| Kapton Tape             | Heat-resistant insulator | Applied on PCB surface before mounting the battery        |
| Double-sided Tape       | Adhesive mount           | Securing the LiPo battery to the board                    |

---

## 4. Full Command Reference (package.json)

Always prefer these root-level `npm run` commands over manual `cd` and local commands.

### Development & Orchestration

| Command                      | Characteristic / Purpose                                    |
| :--------------------------- | :---------------------------------------------------------- |
| `npm run dev:all`            | Launches Backend, Mobile, and Admin concurrently.           |
| `npm run build:all`          | Build all production-ready apps (Nx run-many).              |
| `npm run test:all`           | Run unit tests across all projects (Nx run-many).           |
| `npm run lint:all`           | Run lint across all projects (Nx run-many).                 |
| `npm run typecheck:all`      | Run type-check across all projects (Nx run-many).           |
| `npm run dev:backend-mobile` | Launches only Backend and Mobile.                           |
| `npm run dev:backend-admin`  | Launches only Backend and Admin.                            |
| `npm run dev:stop`           | Force kills all development ports (3000, 8081, 5173, 5174). |
| `npm run env:setup`          | Interactive setup for `.env` files.                         |
| `npm run install:all`        | Clean install of all dependencies.                          |

### Workspace (Nx Direct)

| Command               | Characteristic / Purpose                            |
| :-------------------- | :-------------------------------------------------- |
| `nx run-many -t dev`  | Start all dev servers concurrently using Nx.        |
| `nx affected -t test` | Run tests only on affected projects.                |
| `nx show projects`    | List all projects in the workspace.                 |
| `nx graph`            | Visualize project and task dependencies.            |
| `npm run nx:reset`    | **Recovery:** Fix Nx Daemon issues and clear cache. |

### IoT & Firmware (firmware/esp32)

| Command                                                  | Characteristic / Purpose                                       |
| :------------------------------------------------------- | :------------------------------------------------------------- |
| `node scripts/iot/firmware-doctor.mjs`                   | Check ESP32 environment and toolchain.                         |
| `node scripts/iot/firmware-arduino-cli.mjs deps`         | Install Arduino library dependencies.                          |
| `node scripts/iot/firmware-arduino-cli.mjs compile main` | Compile the main firmware.                                     |
| `node scripts/iot/firmware-arduino-cli.mjs upload main`  | Upload main firmware to ESP32.                                 |
| `node scripts/iot/firmware-monitor.mjs`                  | Open serial monitor for ESP32.                                 |
| `npm run iot:sim-fall`                                   | Simulate a fall event via MQTT (for testing backend/mobile).   |
| `npm run mqtt:check`                                     | Verify local Mosquitto service is reachable on localhost:1883. |
| `npm run mqtt:monitor`                                   | Watch all project-relevant MQTT traffic.                       |

### Audit & Verification

| Command                             | Characteristic / Purpose                                                          |
| :---------------------------------- | :-------------------------------------------------------------------------------- |
| `nx affected -t lint --fix`         | Routine first pass for affected code formatting/linting.                          |
| Module `test` / `typecheck` scripts | Routine targeted checks for touched behavior and TypeScript changes.              |
| Module `format` / Prettier scripts  | Use when formatting may have changed.                                             |
| `npm run infra:scan`                | Use before commit/final close-out, or for runtime/docs/config changes.            |
| `npm run infra:scan:strict`         | Use before commit/final close-out for logic/type-critical or cross-stack changes. |
| `npm run audit:instructions`        | **Required** after changing `AGENTS.md`, `GEMINI.md`, or `CLAUDE.md`.             |
| `npm run audit:comments:strict`     | Check Thai-first comment compliance.                                              |
| `npm run docs:lint`                 | Ensure documentation follows Markdown standards.                                  |

### Sensor Lab (Thesis/Research)

| Command                       | Characteristic / Purpose                                |
| :---------------------------- | :------------------------------------------------------ |
| `npm run sensor-lab:all`      | Run full validation, summarization, and chapter export. |
| `npm run sensor-lab:validate` | Check collected raw CSV vs schema.                      |
| `npm run sensor-lab:node-red` | Rebuild and launch the Node-RED lab service.            |

---

## 5. Firmware Serial Commands

Type these in Arduino IDE Serial Monitor or VS Code Serial Monitor (115200 baud):

```text
info
profile
fall config
fall sensitivity low
fall sensitivity medium
fall sensitivity high
sensor status
ppg on / ppg off
mpu test
log raw
log interval <ms>
plot ppg
plot ppg status
hr config
speaker
speaker status
sim fall
sim status
mqtt off
mqtt on
reboot
```

> Log capture is done via the Node-RED flow `fall-detection-sensor-lab-flow.v2.json`, not `mosquitto_sub` as a substitute.
> See `firmware/esp32/fall_detection_sensor_lab/trial_protocol.md` for the per-session/per-trial steps.

---

## 5. Firmware Operator Mode

Use this when the user is actively testing with hardware and needs short commands only.

### Fall Detection Sensor Lab Trial — Agent Actions

1. Confirm `sensor_tuning` is flashed and the Node-RED Dashboard (`/ui`, flow `fall-detection-sensor-lab-flow.v2.json`) is running — Dashboard is the only workflow, no manual inject nodes
2. In the Dashboard: set Session ID once (e.g. S01); press the activity button matching the activity actually performed — `activityLabel`/`expectedType`/`trialId` are set automatically. Never guess the activity; use the user-provided label to pick the button
3. Activity button → 10s countdown → user performs 1 activity → press Manual Stop Trial (no auto-stop) — 1 Trial = 1 CSV `{sessionId}_{trialId}_{activityLabel}.csv` in `runs/Sxx/raw/`
4. After the session: fill `runs/Sxx/session_notes.md`; log issues in `notes.md`
5. `npm run sensor-lab -- validate` to check raw CSV vs schema
6. Pick representative trials into `runs/Sxx/selected/` per `selection_guide.md`
7. `npm run sensor-lab -- summarize` then `npm run sensor-lab -- chapters`

### Ground Rules

- Never guess activity type without a user-provided `activityLabel`
- 1 Trial = 1 activity = 1 CSV; do not merge activities into one file
- Filter boot logs by ignoring lines that do not contain `[SLOG]`
- `sim fall` can be used to test the full fall pipeline without a physical fall
- Example/export files show **format only** — never claim real results until real CSV is collected
- This is Basic Activity Collection (illustrative/proof-of-concept), not a sensor log collection: do not report classification metrics — they are out of scope

Note:

- `fall_detection_sensor_lab` is not part of the active system runtime
- Do not assume lab work is mandatory unless the user explicitly asks for data collection or thesis ch.3/ch.5 material
- `sensor_tuning` publishes `device/{serial}/lab/imu` only; `main_firmware` and runtime event topics are untouched

---

## 6. Current Project Notes

These notes are reference-only. Repository policy still lives in `AGENTS.md`.

### Current Status (May 2026)

Infrastructure and functional prototype flows are the main delivery focus. The `fall_detection_sensor_lab` lab (Basic Activity Collection for thesis ch.3/ch.5) is optional unless explicitly requested.

### Current Technical Focus

- Verify end-to-end fall flow on final hardware
- Keep mobile/backend/admin flows stable for demo and thesis delivery
- Keep `fall_detection_sensor_lab` lab infra ready for optional thesis ch.3/ch.5 data collection
- Keep backend Docker runtime lean (`dist/server.js` + backend-only production deps)

### Roadmap Pointers

- Product / implementation roadmap: `docs/planning/development-plan.md`
- Hardware testing workflow: `firmware/esp32/START_HERE.md`
- Fall Detection Sensor Lab: `firmware/esp32/fall_detection_sensor_lab/README.md`

---

## Related Docs

- [AI Module Router](AI_MODULE_ROUTER.md)
- [System Overview](system_overview.md)
- [Backend Deep Research](backend.md)
- [Firmware Deep Research](firmware.md)
