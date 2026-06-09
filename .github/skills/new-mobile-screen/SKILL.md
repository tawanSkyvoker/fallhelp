# Skill: new-mobile-screen

Thin Copilot wrapper for scaffolding a mobile screen in FallHelp.

## Canonical Sources

1. `AGENTS.md`
2. `docs/ai/AI_QUICKSTART.md`
3. `docs/ai/AI_MODULE_ROUTER.md`
4. `docs/ai/mobile.md`
5. `.agent/skills/fallhelp-fullstack-agent/SKILL.md`

If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Inputs

- `group`
- `subgroup`
- `filename`
- `purpose`
- `requiresAuth`
- `hasApiQuery`
- `apiServiceName`

## Checklist

1. Confirm the route file does not already exist.
2. Follow the existing Expo Router, service, and hook patterns in the touched area.
3. Preserve provider order, protected-route behavior, and current navigation conventions.
4. Keep UI consistent with project rules: Kanit, NativeWind, no purple, no direct `router` import.
5. Follow the shared Thai-first comment standard; avoid import labels/banners and comment only non-obvious guards, side effects, or cross-file handoffs.
6. Add or update a smoke test and any needed service/query-key wiring.

## Verification

```bash
npm run infra:scan
npm run infra:scan:strict
```
