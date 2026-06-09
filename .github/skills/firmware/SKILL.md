# Skill: firmware

Thin Copilot wrapper for firmware, sensor tuning, and hardware debugging in FallHelp.

## Canonical Sources

1. `AGENTS.md`
2. `docs/ai/AI_QUICKSTART.md`
3. `docs/ai/AI_MODULE_ROUTER.md`
4. `docs/ai/firmware.md`
5. `firmware/esp32/START_HERE.md`
6. `.agent/skills/iot-firmware-expert/SKILL.md`
7. `.agent/skills/fall-detection-sensor-lab/SKILL.md`

If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Inputs

- `topic=fall-pipeline|ble-provisioning|sensor-tuning|pulse-signal|build-profile|mqtt-payload|hardware-pins|cancel-button`
- `goal=debug|tune|review|next-step`
- `path=<session-folder-or-report>`

## Checklist

1. Distinguish `main_firmware` from `sensor_tuning` before changing anything.
2. Preserve the 2-stage fall flow, device-only cancel, and 15-second cancel window.
3. Read sensor-lab evidence before fall tuning or pulse analysis.
4. Tune at most one parameter per cycle and document the reason.
5. Separate hardware limits from filtering, thresholds, BLE, MQTT, or backend integration issues.

## Verification

```bash
npm run infra:scan
npm run sensor-lab -- validate   # only if sensor-lab data was collected
```
