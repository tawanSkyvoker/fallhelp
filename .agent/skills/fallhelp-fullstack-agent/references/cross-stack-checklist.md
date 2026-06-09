# Cross-Stack Checklist

Use this checklist when a task may affect more than one module or runtime boundary.

## Trigger Conditions

Run this checklist when the change touches any of the following:

- ESP32 payload shape or event timing
- MQTT topics or payload validation
- Backend API contracts or DB schema
- Socket.io events or push-notification behavior
- Mobile/admin UI that depends on realtime or event data

## Checklist

1. Identify the full flow before editing:
   - device / firmware
   - backend validation / service / DB
   - realtime / push side effects
   - mobile/admin consumption
   - docs and AI context
2. Confirm canonical invariants still hold:
   - `suspected_fall -> fall_cancelled / fall_confirmed`
   - `Cancel` is device-only
   - caregiver uses `Acknowledge` (`รับทราบแล้ว`), not `Cancel`
   - server timestamps are used for persistence
   - `Device.status` remains pairing state only
3. Update docs in the same change:
   - owner doc in `docs/`
   - `docs/ai/*` if system behavior or workflow truth changed
4. Run validation by scope:
   - `npm run infra:scan`
   - `npm run infra:scan:strict` for logic/type-critical changes
5. Report the cross-stack impact explicitly in the final summary
