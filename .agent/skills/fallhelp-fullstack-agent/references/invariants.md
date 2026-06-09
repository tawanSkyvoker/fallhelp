# FallHelp Invariants

These rules are easy for agents to break by accident. Treat them as hard constraints unless the user explicitly requests a coordinated system-wide change.

## Fall Flow

- Preserve `suspected_fall -> fall_cancelled / fall_confirmed`
- The false alarm cancel window is 15 seconds
- Do not change the timeout without updating firmware, backend, docs, and tests together

## Cancel vs Acknowledge

- `Cancel` belongs only to the device button flow
- `fall_cancelled`, `fallStage = CANCELLED`, and `cancelledAt` must only originate from the device
- Caregiver app actions must use `Acknowledge` (`รับทราบแล้ว`) semantics instead

## Notification Rules

- Confirmed fall -> push + realtime/in-app
- Heart-rate abnormal -> in-app/realtime, not push

## Data Model Rules

- Single-caregiver model: 1 user -> 1 elder
- `Device.status` means pairing state only
- Online/offline is derived from `lastOnline`
- `Notification.eventId` is a required FK to `Event.id` (`onDelete: Cascade`)
