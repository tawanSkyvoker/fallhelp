# Skill: debug-ble-provisioning

Thin Copilot wrapper for BLE provisioning debugging in FallHelp.

## Canonical Sources

1. `AGENTS.md`
2. `docs/ai/AI_QUICKSTART.md`
3. `docs/ai/AI_MODULE_ROUTER.md`
4. `docs/ai/firmware.md`
5. `docs/ai/mobile.md`
6. `.agent/skills/iot-firmware-expert/SKILL.md`
7. `.agent/skills/fallhelp-fullstack-agent/SKILL.md`

If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Inputs

- `symptom=scan|connect|credential-write|wifi-join|mqtt-after-wifi|reset-wifi`
- `deviceLog=<path>`
- `mobileLog=<path>`

## Checklist

1. Verify whether the issue is BLE advertising, characteristic writes, WiFi join, or post-provision MQTT flow.
2. Inspect both the ESP32 BLE flow and the mobile pairing path before changing code.
3. Preserve UUID, status, and provisioning semantics unless the contract intentionally changes.
4. Update docs if setup flow behavior or runtime statuses changed.

## Verification

```bash
npm run infra:scan
```
