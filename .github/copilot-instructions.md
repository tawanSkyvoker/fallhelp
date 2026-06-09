# FallHelp Copilot Instructions

Use `AGENTS.md` as the canonical rule source for this repository.
This file is a thin adapter only.

Before editing:

1. Read `AGENTS.md`
2. Read `docs/ai/AI_QUICKSTART.md`
3. Read `docs/ai/AI_MODULE_ROUTER.md`
4. Read `docs/ai/system_overview.md` when the task touches more than one module
5. Read the relevant deep context file in `docs/ai/`

Module mapping:

- `apps/backend-api/**` -> `docs/ai/backend.md`
- `apps/mobile/**` -> `docs/ai/mobile.md`
- `apps/admin/**` -> `docs/ai/admin.md`
- `firmware/esp32/**` -> `docs/ai/firmware.md`

Keep repo-specific truth in `AGENTS.md`, `docs/ai/*`, and `.agent/skills/*`.
Do not add new business rules to this file.
For structural, cross-stack, schema, or protocol changes, follow the solo-developer co-pilot workflow defined in `AGENTS.md`.
For comment-heavy edits, use `.agent/skills/fallhelp-fullstack-agent/references/commenting.md` after reading `AGENTS.md`.

If a rule here conflicts with `AGENTS.md`, follow `AGENTS.md`.

## 🚨 Mandatory Verification Gate

After changes, you MUST run relevant tests and scans. You ARE NOT finished until you report evidence of:
- `nx affected -t lint --fix`
- Unit tests for the touched logic
- `npm run infra:scan` or `npm run infra:scan:strict`

