# IoT Coding Playbook

Use this reference when writing or reviewing ESP32 code.

## Start From The Right Variant

- `main_firmware/` = production path with BLE + WiFi + MQTT + sensors
- `sensor_tuning/` = calibration and data-collection path
- Do not copy quick tuning shortcuts from `sensor_tuning/` into `main_firmware/` without justifying the production impact

## Embedded Guardrails

- Prefer `millis()`-based control flow over blocking delays
- If `delay()` is unavoidable, keep it short and explain the hardware reason near the code
- Avoid hidden state transitions; keep fall-flow state changes explicit
- Be careful with repeated dynamic `String` churn in hot paths when a stable buffer or fixed pattern would do
- Preserve pin-role meaning, especially GPIO27 cancel button and GPIO25 alert output

## Payload And Contract Rules

- Validate every device->backend contract against `docs/ai/firmware.md` and backend consumers
- Do not repurpose existing event names for a different semantic meaning
- Keep server-side persistence based on server timestamps; device timestamps are telemetry context only
- If payload shape changes, update validators, handlers, docs, and tests in the same change

## Safe Refactor Checklist

- Check both `main_firmware` and `sensor_tuning` before extracting shared logic
- Search for serial/operator commands that depend on the touched code path
- Preserve initialization order for sensors, BLE, WiFi, and MQTT unless the task is explicitly architectural
- Keep comments focused on constraints, calibration rationale, or side effects
