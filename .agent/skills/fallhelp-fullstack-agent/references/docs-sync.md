# Docs Sync Reference

Use this reference when code changes may affect documentation or AI context.

## Owner-Doc Rule

- One feature should have one owner document in `docs/features/`
- Other docs should summarize and link back to the owner doc
- If documents conflict, the owner doc wins

## Placement Guide

- `docs/architecture/` — system structure, data model, integration boundaries
- `docs/features/` — user-facing behavior, acceptance scope, and implementation notes
- `docs/api/` — canonical API and realtime contracts
- `docs/ops/` — runbooks, troubleshooting, recovery
- `docs/testing/` — durable testing guidance and reports
- `docs/ai/` — AI-only context memory and workflow support

## Sync Rules

- API changes -> update owner doc + `docs/api/`
- Schema changes -> update owner doc + architecture docs + `docs/ai/system_overview.md`
- MQTT topic/payload or realtime contract changes -> update relevant feature/API docs + `docs/ai/backend.md`
- Cross-stack behavior changes -> update the owner doc for that flow, not scattered mentions only
- AI workflow changes -> update `AGENTS.md` first, then sync adapters and relevant references
- Use `drift-checklist.md` before closing instruction-layer changes so wrappers and audits stay aligned

## Link Rules

- Use relative Markdown links
- Do not leave links to deleted files, routes, functions, or screens
- Prefer linking back to owner docs over duplicating behavior text

## Verification

```bash
npm run infra:scan
npm run audit:instructions
```
