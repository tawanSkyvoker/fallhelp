# /debug-ble-provisioning

Thin Claude wrapper for BLE provisioning debugging in FallHelp.

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

1. Verify whether the problem is in BLE advertising, credential write, WiFi join, or post-provision MQTT flow.
2. Inspect the ESP32 BLE UUID/characteristic flow and the mobile pairing path before changing code.
3. Preserve provisioning semantics unless the task explicitly changes the contract.
4. Update docs if UUIDs, statuses, or setup flow behavior changed.

## Verification

```bash
npm run infra:scan
```
