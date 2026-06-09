# IoT Debug Checklist

Use this reference when firmware behavior is wrong or unstable.

## Hardware / Runtime Triage

- Confirm the correct firmware variant is flashed
- Check power, cable stability, and serial output first
- Verify sensor initialization before reasoning about thresholds
- Confirm WiFi and MQTT state before assuming backend bugs
- Check the active runtime profile and cancel timeout before reproducing a fall-flow issue

## Symptom Guide

- No fall events:
  - check MPU6050 init, sensor loop timing, and threshold values
- Repeated false alarms:
  - inspect ADL logs, sensitivity profile, and posture/impact thresholds
- Cancel button not working:
  - verify GPIO27 wiring, active window timing, and fall-state gating
- BLE provisioning fails:
  - verify service UUIDs, characteristic flow, BLE advertising state, and WiFi retry logic
- MQTT appears connected but backend behavior is wrong:
  - inspect topic names, payload shape, serial number usage, and backend validators

## Cross-Stack Sanity Check

- If the device publishes correctly but the system still behaves wrong, inspect:
  - backend MQTT handler / validator
  - event persistence and timestamp handling
  - Socket.io / push side effects
  - mobile/admin rendering assumptions
