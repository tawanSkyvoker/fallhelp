---
name: fallhelp-fullstack-agent
description: FallHelp project workflow and domain guardrails for backend, mobile, admin, firmware, docs, and multi-agent maintenance. Use when working inside this repository to choose the correct module context, preserve safety-critical behavior, run the right validation, and keep canonical instructions synchronized.
---

# FallHelp Fullstack Agent

Use this skill for work inside the FallHelp workspace.

## Core Workflow

1. Read `AGENTS.md` first for canonical rules.
2. Read `docs/ai/AI_QUICKSTART.md` for the fastest route into the correct docs and validation.
3. Read `docs/ai/AI_MODULE_ROUTER.md` to choose the module persona.
4. Read `docs/ai/agent-reference.md` when you need quick structure, commands, hardware context, or firmware operator mode.
5. Read `docs/ai/system_overview.md` for cross-module context when the task touches more than one layer.
6. Read the relevant module reference:
   - `docs/ai/backend.md`
   - `docs/ai/mobile.md`
   - `docs/ai/admin.md`
   - `docs/ai/firmware.md`
7. Inspect the real files before editing.
8. Edit incrementally.
9. Run the required validation for the scope of change.
10. If architecture, terminology, or workflow changed, sync `AGENTS.md`, `docs/ai/*`, and thin tool adapters.

## Solo-Developer Workflow

- Execute directly for local, well-bounded, low-risk changes
- Provide a brief plan first for structural, cross-stack, high-risk, schema, or protocol changes
- Require explicit confirmation only for large architectural changes, multi-module refactors, destructive actions, or irreversible impact
- Use `main` as the default working branch; routine solo work is local verification, commit, then push to `main` for GitHub Actions CI
- Use temporary branches and PRs only when external review, risky experimentation, or collaboration is explicitly needed

## Cross-Stack Thinking

- If a feature affects device behavior, MQTT payloads, API contracts, schema, realtime events, push notifications, or caregiver UI, inspect the whole flow before editing
- Update docs and AI context when the runtime truth changes

## Memory Model

- `AGENTS.md` = policy memory
- `docs/ai/*` = system memory
- `.agent/skills/*` = execution memory
- Tool adapters are access layers only
- Subagents must stay narrowly scoped

Do not introduce new business rules in tool-specific wrappers if the rule belongs in the canonical layer.

## Non-Negotiable Invariants

- `Cancel` is device-only via GPIO27 during the 15-second window.
- Caregiver actions are `Acknowledge` (`รับทราบแล้ว`) only and must not mutate cancellation state.
- Preserve the 2-stage fall flow: `suspected_fall -> fall_cancelled / fall_confirmed`.
- Preserve the single-caregiver model: 1 user -> 1 elder.
- Treat `Device.status` as pairing state only; online/offline is derived from `lastOnline`.

## Selective References

Read only the references needed for the task:

- `references/module-routing.md` for path-to-doc routing
- `references/invariants.md` for domain rules that are easy to break
- `references/cross-stack-checklist.md` for multi-module impact review
- `references/validation.md` for command selection and close-out checks
- `references/commenting.md` for the Thai-first file header, intent comment, and cross-file breadcrumb standard
- `references/docs-sync.md` for owner-doc placement and docs update rules
- `references/drift-checklist.md` for instruction-layer close-out checks

## Diagram Work

When the task involves creating or reviewing Architecture Diagrams (Use Case, Class, Sequence, ER):

- Use `@[skills/diagram-expert]` — Full-Stack Architecture Diagram Expert for FallHelp
- This skill knows the actual schema, MQTT topics, Socket.io events, and layer structure of FallHelp
- LLM Chat versions (Gemini Gem, ChatGPT, Claude.ai) are in `.agent/skills/diagram-expert/llm-chat/`

## IoT / Firmware Work

When the task involves ESP32 code, sensor tuning, BLE provisioning, MQTT device contracts, or hardware debugging:

- Use `@[skills/iot-firmware-expert]`
- Load its references selectively for coding, tuning, or troubleshooting depth

When the task is specifically about sensor-lab runs, CSV checks, summary scripts, or tuning notes from measured values:

- Use `@[skills/fall-detection-sensor-lab]`

Keep `AGENTS.md` as the canonical rule file. This skill summarizes workflow; it does not replace the repository policy.
