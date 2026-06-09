---
name: iot-firmware-expert
description: >
  IoT and firmware expert for FallHelp. Use when working on ESP32 code, fall-detection tuning,
  BLE provisioning, MQTT device payloads, hardware pin behavior, sensor debugging, or embedded
  reliability concerns such as timing, memory pressure, and blocking operations.
---

# IoT Firmware Expert

Use this skill when a task touches `firmware/esp32/**` or when backend/mobile work depends on device behavior, payloads, or tuning assumptions.

## Core Workflow

1. Read `AGENTS.md` for canonical safety and terminology rules.
2. Read `docs/ai/AI_QUICKSTART.md` for fast routing and validation.
3. Read `docs/ai/firmware.md` for current ESP32 architecture and MQTT contracts.
4. Read `firmware/esp32/START_HERE.md` when the task involves sensor tuning, sensor-lab runs, or operator commands.
5. Inspect the real firmware files before changing thresholds, timing, or payload structure.
6. If the change affects MQTT payloads, cancel semantics, timestamps, or provisioning flow, inspect backend/mobile consumers too.
7. Run the appropriate validation and report any hardware/runtime gaps explicitly.

## When To Use This Skill

- Writing or refactoring ESP32 firmware code
- Tuning MPU6050 thresholds, posture logic, or heart-rate sensor behavior
- Reviewing cancel-button behavior, alert timing, or device-state transitions
- Debugging BLE provisioning, WiFi setup, MQTT publish/subscribe flow, or hardware pin mapping
- Assessing embedded risks: blocking delays, heap fragmentation, noisy sensor readings, or unstable timing

## Non-Negotiable Invariants

- Preserve `suspected_fall -> fall_cancelled / fall_confirmed`
- `Cancel` is device-only via GPIO27 during the active window
- Keep caregiver `Acknowledge` (`รับทราบแล้ว`) separate from device-side `Cancel`
- Use server timestamps for persistence and cross-device coordination; device `millis()` is local runtime context only
- Do not change the 15-second cancel window without updating firmware, backend, docs, and tests together

## Selective References

Read only what the task needs:

- `references/coding-playbook.md` for implementation patterns and embedded guardrails
- `references/sensor-tuning-playbook.md` for threshold tuning and sensor-lab workflow
- `references/debug-checklist.md` for symptom-driven troubleshooting

## Sensor Lab Work

When the task is primarily about ADL, simulated-fall, pulse sessions, `summary.md`, or `REPORT.md`:

- Use `@[skills/fall-detection-sensor-lab]`
- Let that skill drive CSV checks and one-step tuning notes

## Cross-Stack Rule

If firmware changes affect payload shape, MQTT topics, online/offline semantics, or alert flow:

1. Inspect backend validators and handlers
2. Inspect mobile/admin consumers
3. Update `docs/ai/firmware.md` and any owner docs that describe the changed runtime truth

This skill sharpens IoT execution, but `AGENTS.md` remains the canonical policy source.
