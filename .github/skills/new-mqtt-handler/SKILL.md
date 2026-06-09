# Skill: new-mqtt-handler

Thin Copilot wrapper for scaffolding a backend MQTT handler in FallHelp.

## Canonical Sources

1. `AGENTS.md`
2. `docs/ai/AI_QUICKSTART.md`
3. `docs/ai/AI_MODULE_ROUTER.md`
4. `docs/ai/backend.md`
5. `.agent/skills/fallhelp-fullstack-agent/SKILL.md`

If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Inputs

- `topicSuffix`
- `payloadInterfaceName`
- `payloadFields`
- `emitsSocket`
- `writesDb`

## Checklist

1. Confirm the topic and handler do not already exist.
2. Follow the existing MQTT flow: topics -> payload validator -> handler -> mqtt client registration.
3. Validate payloads before use, look up devices by serial number, and use server timestamps for storage.
4. Preserve fall-event invariants and avoid adding cancel semantics outside the established flow.
5. Follow the shared Thai-first comment standard; avoid import labels/banners and comment only non-obvious guards, side effects, or cross-file handoffs.
6. Add or update tests and docs if the handler changes runtime behavior or message contracts.

## Verification

```bash
npm run infra:scan
npm run infra:scan:strict
```
