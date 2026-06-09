# E2E Critical Path Strategy

## Doc Meta

- Audience: Developers, QA, reviewers
- Source of Truth: current simulator scripts, mobile app test IDs, backend MQTT/API contracts
- Status: Active
- Last Updated: May 21, 2026

---

## Overview

FallHelp should keep E2E coverage small and focused. The repository already has broad unit and integration coverage, so E2E should verify only the flows where a single module test cannot prove the product behavior.

Use E2E for cross-boundary, safety-critical paths:

- MQTT fall lifecycle -> backend persistence -> Socket / Push side effects
- Mobile setup and device provisioning
- Mobile fall alert visibility and acknowledge behavior
- Admin login and device management smoke checks
- Hardware-backed ESP32 simulation when release confidence requires it

Do not use E2E as the default for pure helpers, small UI-only states, isolated service functions, or documentation-only changes.

---

## E2E Levels

| Level | Scope | Tool / Evidence | Status |
|---|---|---|---|
| Backend pipeline E2E | MQTT -> backend handler -> DB / Socket / Push side effects | `npm run iot:sim-fall` with API/mobile observation | Ready via existing simulator |
| Mobile app E2E | Real app screens on Android/iOS dev build | Maestro or manual UAT with stable `testID` | Planned |
| Admin web E2E | Browser login and device management smoke | Playwright | Planned |
| Hardware E2E | ESP32 command -> firmware -> MQTT -> backend/mobile | `npm run iot:sim-fall -- --hardware` and device observation | Manual hardware validation |

---

## Critical Flows

### 1. Fall Confirmed Alert

This is the highest-value E2E path because it proves the safety pipeline across MQTT, backend, realtime events, notifications, and caregiver UI.

```text
simulator publishes suspected_fall
  -> backend creates PENDING_CONFIRMATION event
  -> backend emits event_status_changed / FALL_SUSPECTED
  -> simulator waits cancel window
  -> simulator publishes fall_confirmed
  -> backend updates Event to CONFIRMED
  -> backend emits fall_detected + event_status_changed / FALL_CONFIRMED
  -> backend creates Notification and attempts Push
  -> mobile dashboard shows fall alert
```

Command:

```bash
npm run iot:sim-fall -- --fast
```

Expected evidence:

- Backend receives `suspected_fall` and `fall_confirmed` in order.
- Database event transitions from pending confirmation to critical/confirmed.
- Socket emits `event_status_changed` for suspected and confirmed stages.
- Socket emits `fall_detected` only after confirmed fall.
- Notification record is created for the confirmed fall.
- Mobile alert overlay/card appears for the caregiver.

### 2. False Alarm Cancellation

Cancellation is safety-critical because only the device wearer can cancel via GPIO27 within the 15-second window.

Recommended E2E shape:

```text
device or simulator publishes suspected_fall
  -> backend creates PENDING_CONFIRMATION event
  -> device wearer presses GPIO27 before timeout
  -> firmware publishes fall_cancelled
  -> backend updates Event to CANCELLED with cancelledAt
  -> backend emits event_status_changed / FALL_CANCELLED
  -> mobile clears or de-emphasizes the pending fall view
```

Current status:

- Backend and mobile unit coverage validate the cancel vs acknowledge contract.
- Simulator-driven cancel mode is ready via `npm run iot:sim-fall -- --cancel` (can be combined with `--fast`).
- Hardware validation is still the most reliable way to prove GPIO27 behavior.

Expected evidence:

- No caregiver app action writes `fallStage = CANCELLED`.
- No confirmed fall push notification is created after timely cancel.
- Mobile uses acknowledge/reset view only for caregiver-side UI dismissal.

### 3. Device Pairing / WiFi Setup

This should become a mobile E2E flow once the dev build and selectors are stable.

Recommended E2E shape:

```text
fresh app state
  -> login or register
  -> open setup flow
  -> grant BLE permissions
  -> scan/select device
  -> submit WiFi credentials
  -> backend/device association appears
  -> dashboard shows device status
```

Current status:

- Unit tests cover setup screens, auth context, and device actions.
- Full BLE automation needs Maestro/device-lab wiring because simulator-only tests cannot prove OS permission and BLE behavior.

Expected selector work before automation:

- Stable `testID` on setup entry points.
- Stable `testID` on BLE scan state, device row, WiFi form, submit action, and success/error states.
- A documented test fixture device or simulator mode.

### 4. Admin Smoke

Admin E2E should stay shallow and prove only that the deployed web app can authenticate and read the device management table.

Recommended E2E shape:

```text
open admin app
  -> login
  -> device management page loads
  -> device table or empty state renders
  -> register-device modal or QR/print action opens
```

Current status:

- Jest coverage exists for auth, layout, device page behavior, and env validation.
- Playwright is not wired yet.

---

## When E2E Is Required

Require E2E or simulator-backed evidence when a change touches:

- Fall lifecycle state transitions (`suspected_fall`, `fall_confirmed`, `fall_cancelled`)
- MQTT topic contracts or payload validation
- Socket.io event names or payloads
- Push notification creation or delivery conditions
- Mobile fall alert display, acknowledge/reset behavior, or setup flow
- Device pairing, WiFi provisioning, BLE permission flow, or firmware command flow
- Admin auth or device management data-loading paths used for operations review

E2E is usually not required for:

- Pure formatting or copy changes
- Isolated utility functions with good unit coverage
- Component-only visual states with existing focused tests
- Backlog-only or planning document updates

---

## Minimum Release Evidence

For normal releases:

```bash
npm run infra:scan
npm run --prefix apps/mobile test:light -- --watchman=false
npm run --prefix apps/admin test -- --runInBand --watchman=false
```

For safety-critical fall/device changes, add:

```bash
npm run iot:sim-fall -- --fast
```

Then manually verify mobile/admin effects until Maestro and Playwright suites are wired.

For hardware release confidence, add:

```bash
npm run iot:sim-fall -- --hardware
```

---

## Related Docs

- [Feature Test Checklist](./feature-test-checklist.md)
- [Simulator Guide](./simulator-guide.md)
- [Testing Glossary](./testing-glossary.md)
- [Fall Detection System](../features/fall-detection.md)
