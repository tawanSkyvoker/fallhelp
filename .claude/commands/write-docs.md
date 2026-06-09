# /write-docs

Thin Claude wrapper for documentation work in FallHelp.

## Canonical Sources

1. `AGENTS.md`
2. `docs/ai/AI_QUICKSTART.md`
3. `docs/ai/AI_MODULE_ROUTER.md`
4. `docs/README.md`
5. `.agent/skills/fallhelp-fullstack-agent/SKILL.md`
6. `.agent/skills/fallhelp-fullstack-agent/references/docs-sync.md`

If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Inputs

- `target=<doc-path>`
- `section=<section-name>`
- `type=audit`

## Checklist

1. Identify the owner doc before editing.
2. Keep docs aligned with current code, routes, schema, and terminology.
3. Prefer links back to owner docs over duplicated explanation.
4. Update AI docs too when runtime truth or workflow changed.

## Verification

```bash
npm run infra:scan
npm run audit:instructions
```
