# Module Routing

Use the touched path to decide which deep context files to read.

## Repository-Wide

- `AGENTS.md` — canonical project rules
- `docs/ai/AI_MODULE_ROUTER.md` — module persona selector
- `docs/ai/agent-reference.md` — quick structure, commands, hardware, operator mode
- `docs/ai/system_overview.md` — shared system behavior and cross-module flow

## Path Mapping

- `apps/backend-api/**`
  - Read `docs/ai/backend.md`
  - Start from `apps/backend-api/src/server.ts`, `apps/backend-api/src/app.ts`, `apps/backend-api/prisma/schema.prisma`

- `apps/mobile/**`
  - Read `docs/ai/mobile.md`
  - Start from `apps/mobile/app/_layout.tsx`, `apps/mobile/context/AuthContext.tsx`, `apps/mobile/hooks/useSocketConnection.ts`

- `apps/admin/**`
  - Read `docs/ai/admin.md`
  - Start from `apps/admin/src/App.tsx`

- `firmware/esp32/**`
  - Read `docs/ai/firmware.md`
  - Read `.agent/skills/iot-firmware-expert/SKILL.md` for coding, tuning, and debugging depth
  - Read `.agent/skills/fall-detection-sensor-lab/SKILL.md` for sensor-lab runs, CSV checks, and report tables
  - Start from `firmware/esp32/src/main_firmware/main_firmware.ino` plus the relevant split module (`BLEProvisioning.ino`, `WiFiConnectionManager.ino`, `DeviceMqttClient.ino`) or `firmware/esp32/src/sensor_tuning/sensor_tuning.ino`

- `docs/**`
  - Read the owner doc plus any related `docs/ai/*` file if the docs describe architecture, flows, or terminology

## Multi-Module Changes

If a task touches more than one top-level module, read `docs/ai/system_overview.md` before editing.
