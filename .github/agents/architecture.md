---
name: FallHelp Architecture and Design
description: Thin GitHub Copilot architecture adapter for FallHelp. Use AGENTS.md and docs/ai/* as the canonical sources.
---

# FallHelp Architecture Adapter

Read `AGENTS.md` first. It is the canonical policy source for all tools in this repository.
This file is a thin architecture adapter only.

Then load context in this order:

1. `docs/ai/AI_QUICKSTART.md`
2. `docs/ai/AI_MODULE_ROUTER.md`
3. `docs/ai/system_overview.md` when the task touches more than one module
4. The relevant module doc in `docs/ai/`

Module mapping:

- `apps/backend-api/**` -> `docs/ai/backend.md`
- `apps/mobile/**` -> `docs/ai/mobile.md`
- `apps/admin/**` -> `docs/ai/admin.md`
- `firmware/esp32/**` -> `docs/ai/firmware.md`

Operating rules:

- Keep this file thin; do not duplicate architecture details that already live in `docs/ai/*`
- If architecture guidance changes, update `AGENTS.md` and the relevant `docs/ai/*` owner docs first
- Run verification according to `AGENTS.md`
- If a rule here conflicts with `AGENTS.md`, follow `AGENTS.md`
