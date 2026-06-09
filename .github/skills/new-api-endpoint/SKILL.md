# Skill: new-api-endpoint

Thin Copilot wrapper for scaffolding a backend REST endpoint in FallHelp.

## Canonical Sources

1. `AGENTS.md`
2. `docs/ai/AI_QUICKSTART.md`
3. `docs/ai/AI_MODULE_ROUTER.md`
4. `docs/ai/backend.md`
5. `.agent/skills/fallhelp-fullstack-agent/SKILL.md`

If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Inputs

- `resource`
- `method`
- `routePath`
- `auth`
- `adminOnly`

## Checklist

1. Confirm the route/resource does not already exist.
2. Follow the existing backend flow: controller -> service -> validation -> route -> test.
3. Keep controllers thin, use the shared Prisma singleton, and preserve Event lifecycle rules (`fallStage`, `cancelledAt`, and server timestamps).
4. Follow the shared Thai-first comment standard; avoid import labels/banners and comment only non-obvious guards, side effects, or cross-file handoffs.
5. Add or update tests for auth, happy path, and key failure cases.
6. Update docs if the endpoint changes public behavior or contracts.

## Verification

```bash
npm run infra:scan
npm run infra:scan:strict
```
