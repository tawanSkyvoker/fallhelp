# /debug-mqtt-device-flow

Thin Claude wrapper for debugging the device-to-backend MQTT flow in FallHelp.

## Canonical Sources

1. `AGENTS.md`
2. `docs/ai/AI_QUICKSTART.md`
3. `docs/ai/AI_MODULE_ROUTER.md`
4. `docs/ai/firmware.md`
5. `docs/ai/backend.md`
6. `.agent/skills/iot-firmware-expert/SKILL.md`
7. `.agent/skills/fallhelp-fullstack-agent/SKILL.md`

If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Inputs

- `symptom=no-publish|wrong-topic|payload-invalid|backend-not-consuming|socket-missing|push-missing`
- `deviceLog=<path>`
- `backendLog=<path>`

## Checklist

1. Identify whether the break is at publish, topic routing, payload validation, DB write, socket emit, or push side effect.
2. Inspect both the ESP32 publish path and backend MQTT handler path before changing code.
3. Preserve event semantics, especially fall-flow terminology and device-only cancel behavior.
4. Update docs if topics, payload shape, or runtime contracts changed.

## Verification

```bash
npm run infra:scan
npm run infra:scan:strict
```
