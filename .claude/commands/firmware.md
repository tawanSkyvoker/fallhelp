# /firmware

Thin Claude wrapper for firmware work in FallHelp.

## Canonical Sources

1. `AGENTS.md`
2. `docs/ai/AI_QUICKSTART.md`
3. `docs/ai/AI_MODULE_ROUTER.md`
4. `docs/ai/firmware.md`
5. `firmware/esp32/START_HERE.md`
6. `.agent/skills/fallhelp-fullstack-agent/SKILL.md`
7. `.agent/skills/iot-firmware-expert/SKILL.md`
8. `.agent/skills/fall-detection-sensor-lab/SKILL.md`

If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Inputs

- `topic=fall-pipeline|ble-provisioning|sensor-tuning|pulse-signal|build-profile|mqtt-payload|hardware-pins|cancel-button`
- `goal=debug|tune|review|next-step`
- `path=<session-folder-or-report>`

## Checklist

1. Distinguish `main_firmware` from `sensor_tuning` before changing anything.
2. Preserve the 2-stage fall flow and the 15-second cancel window unless the whole system is updated together.
3. Use the IoT skill references when the work involves coding patterns, tuning, or hardware debugging depth.
4. For fall tuning or pulse analysis, read sensor-lab evidence first and tune at most one parameter per cycle.
5. Separate hardware limitations from filtering, thresholds, BLE, MQTT, or backend integration issues.
6. Keep comments brief and focused on constraints or hardware rationale.

## Verification

```bash
npm run infra:scan
npm run sensor-lab -- validate   # only if sensor-lab data was collected
```
