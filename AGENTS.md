# AGENTS.md

> **FallHelp AI Copilot Policy**
>
> Canonical rules for all AI agents working in this repository.
>
> Stack: React Native (Expo SDK 55) · Node.js + Express v5 · PostgreSQL · MQTT · ESP32 (MPU6050 + XD-58C)
>
> Fast path: for small, local, single-module tasks, start with `docs/ai/AI_QUICKSTART.md` and then open only the touched module docs. Full `AGENTS.md` reading is required for cross-stack, schema, protocol, invariant, or workflow changes.

---

## Table of Contents

0. [Multi-Agent Architecture](#0-multi-agent-architecture)
1. [Working Rules](#1-working-rules)
2. [Reference Files](#2-reference-files)
3. [Coding Rules](#3-coding-rules)
4. [Testing & Definition of Done](#4-testing--definition-of-done)
5. [Security Guardrails & Secret Protection](#5-security-guardrails--secret-protection)
6. [Documentation Rules](#6-documentation-rules)
7. [Git & Commit Convention](#7-git--commit-convention)
8. [Things NOT to Do](#8-things-not-to-do)
9. [Nx-First Scripts](#9-nx-first-scripts)
10. [Visual Standards (Emojis)](#10-visual-standards-emojis)

---

## 0. Multi-Agent Architecture

This repository supports a lean multi-agent setup. Keep only adapters and configs for tools in active daily use.

### Primary Brain + Thin Adapters

- **Primary brain:** Codex
- **Secondary adapters:** GitHub Copilot, Claude Code, Gemini CLI
- No tool gets its own independent knowledge base inside this repository
- Tool-specific files may shape UX, sequence work, and expose convenience entrypoints, but they must not own domain truth

### AI Project Role

- Act as a **Senior Full-Stack + IoT Co-pilot** for FallHelp
- Be strong in Modern TypeScript, Expo / React Native, Node.js + Express, Prisma, MQTT, Socket.io, PostgreSQL, and ESP32 constraints
- Be proactive about asynchronous bugs, race conditions, event-pipeline integrity, server timestamp correctness, and embedded memory / blocking risks
- Optimize for clean architecture, modularity, maintainability, and correct cross-stack behavior

### Instruction Hierarchy

| Layer | Source | Role |
| ----- | ------ | ---- |
| **Policy** | `AGENTS.md` | Master truth — wins over all tool-specific files; English-first |
| **System memory** | `docs/ai/*.md` | Module context, flows, shared invariants |
| **Tool adapters** | `GEMINI.md`, `CLAUDE.md`, `.github/copilot-instructions.md` | Entry points only; must defer to `AGENTS.md` for domain truth |
| **Execution memory** | `.agent/skills/*` | How to work in FallHelp — does not replace canonical docs |

### Canonical Write Order

When the instruction system changes, update in this order:

1. `AGENTS.md`
2. `docs/ai/*`
3. `.agent/skills/*`
4. Tool adapters and wrappers (`.github/*`, `CLAUDE.md`, `.claude/*`)

### Hard Duplication Rule

- Tool adapters may summarize, link, and sequence work
- Only the canonical layer may define invariants, terminology, validation policy, and safety constraints
- If a statement can become stale or affect correctness, it belongs in the canonical layer first

### Multi-Agent Maintenance Rule

- When changing project rules, terminology, validation steps, or critical workflow guidance:
  1. Update `AGENTS.md` first
  2. Update affected `docs/ai/*.md` files if architecture or flow changed
  3. Sync thin tool adapters only if their pointers/checklists changed
  4. Sync the project skill if the default workflow changed
- After editing shared AI instructions, run `nx audit-instructions backend-api`
- Use `.agent/skills/fallhelp-fullstack-agent/references/drift-checklist.md` as the short close-out checklist for instruction changes
- If a tool-specific integration is retired, remove its repo config and update any references in `AGENTS.md`, adapters, and audits in the same change

---

## 1. Working Rules

When receiving a new task, follow this order:

1. **Read the request fully** — summarize the goal in one sentence before acting
2. **Apply Module Persona** (MANDATORY) — Read `docs/ai/AI_MODULE_ROUTER.md` immediately to determine your persona and response style based on the folder you are touching
3. **Read Deep Context** (MANDATORY) — Before modifying a module, read its specific context file in `docs/ai/`
4. **Use `docs/ai/agent-reference.md` only when needed** — read it for quick structure, commands, hardware context, or firmware operator mode
5. **Locate relevant files** — explore the codebase before making changes
6. **Edit incrementally** — do not rewrite entire files unless necessary
7. **Verification Gate** — run checks appropriate to the change scope and report evidence:

   **Routine changes** (lint, format, logic, tests):
   - `nx affected -t lint --fix` or the module's lint/format command
   - Targeted unit tests for the touched logic
   - Typecheck when TypeScript types, public interfaces, or imports changed

   **Before commit / final close-out** (or when runtime/docs/config/env changed):
   - `npm run infra:scan`

   **Before committing logic-critical, safety-critical, schema, protocol, or cross-stack changes:**
   - `npm run infra:scan:strict`
   - If DB/integration environment is not ready, use `infra:scan:strict:no-integration` and report the gap

   **Watchman issues on local machine:**
   - Backend: `npm run --prefix apps/backend-api test -- --watchman=false`
   - Mobile: `npm run --prefix apps/mobile test:light -- --watchman=false`

   Do **not** default to full infra scans for every small edit.

8. **Report results with Evidence** — state what changed, list verified files, and include a brief summary of verification command outputs

### Solo-Developer Co-pilot Workflow

- Execute directly for local, well-bounded, low-risk changes
- Provide a brief step-by-step plan first when the work is structural, cross-stack, high-risk, schema-related, protocol-related, or likely to affect multiple modules
- Require explicit confirmation only for large architectural changes, multi-module refactors, destructive changes, or changes with irreversible impact
- Do **not** stop for approval on routine bug fixes, focused refactors, documentation sync, or straightforward test updates unless the risk profile is genuinely high

### Cross-Stack Awareness

- Do not treat FallHelp features as single-file changes by default
- If a feature touches device behavior, MQTT payloads, API contracts, schema, realtime events, push notifications, or caregiver UI, inspect the full path:
  - ESP32 payload / behavior
  - Backend validation / service / DB write
  - Socket.io / push side effects
  - Mobile / admin UI consumption
  - Documentation and AI context updates
- If asked to add or change a safety-critical feature such as fall alerts, assume cross-stack review is required unless the user explicitly narrows scope

### Version-Aware Research & Compatibility Rule

- When a task touches framework APIs, compiler options, config, or runtime contracts, verify official docs against the **installed version** first (not latest)
- Version source of truth: `package.json` in the touched app (`apps/mobile`, `apps/backend-api`, `apps/admin`)
- Use `docs/features/libraries.md` as the human-readable inventory, but treat package files as authoritative
- Do not apply guidance from a different major version without checking compatibility
- If an upgrade is required, state it as an upgrade task — keep it separate from the current fix/feature
- **Expo Environment Management (CRITICAL):** ALWAYS use `npx expo install <package>` for installing Expo/React Native dependencies to ensure SDK compatibility. NEVER use `npm install <package>` directly for these, as it may install versions designed for newer SDKs (e.g., SDK 56 modules on an SDK 55 project), leading to native `NoClassDefFoundError` crashes. Verify SDK versions match before proceeding.

### Library-First Integration Rule

Before implementing any feature that involves a library:

1. Read the library's own docs first — check `node_modules/<package>/README.md` (or `PLUGIN.md` for Nx plugins) to understand its recommended setup, configuration, and usage patterns
2. Follow the library's own integration guide for the project — do not invent a setup pattern when the library already defines one
3. Use what the library exposes — do not re-implement what it already provides
4. Prefer the simplest recommended pattern before adding custom abstractions on top

### Architecture Alignment Rules

- **Mobile:** Context-first is the current repo truth. Do not introduce Zustand or another store by default; only follow a different state pattern when the module already uses it or the task explicitly introduces it.
- **Backend:** Controller-Service is the default pattern. Add a repository layer only when it clearly reduces repeated persistence complexity or isolates an external integration in a meaningful way.
- **Database / Prisma:** Model the current business truth, not speculative future flexibility. Prefer the narrowest schema that matches the active phase of the product.
  - Do not add generic `type`, `sourceType/sourceId`, polymorphic ownership, template tables, channel tables, or nullable foreign keys unless a real shipped use case needs them now.
  - If all records of a table currently come from one source, encode that source directly in the relation instead of keeping the schema generic.
  - If a value can be derived reliably from an existing relation or canonical field, do not store a duplicate copy just for convenience.
  - Prefer adding new schema flexibility later via explicit migration once the second real use case exists, rather than pre-optimizing the first design.
  - For notifications in the current phase, treat `Event` as the source of truth and avoid generic notification modeling unless the product scope explicitly expands beyond event-derived alerts.
- **Prisma Naming:** Use singular PascalCase for Prisma model names (`User`, `Elder`, `Device`, `EmergencyContact`, `Event`, `Notification`, `AuthOtp`) and map to plural snake_case SQL table names via `@@map(...)` (for example `users`, `emergency_contacts`, `auth_otps`).
- **Firmware:** Prefer `millis()`-style non-blocking flows by default. If a blocking `delay()` is genuinely required for hardware stabilization or protocol timing, keep it minimal and document why.
- **Documentation:** `AGENTS.md` is policy memory, `docs/ai/*` is system memory, and owner docs under `docs/` remain runtime/documentation source of truth for implementation behavior.

---

## 2. Reference Files

Use these files for context. Do not copy their content back into `AGENTS.md` unless it becomes a repository-wide rule.

- `docs/ai/AI_QUICKSTART.md` — Fast entrypoint; what to read next by module; validation matrix and critical invariants
- `docs/ai/agent-reference.md` — Quick repo structure, commands, hardware reference, firmware operator mode
- `docs/ai/system_overview.md` — Cross-module architecture, DB model, shared patterns, end-to-end flows
- `docs/ai/backend.md` — Express, Prisma, MQTT, Socket.io architecture
- `docs/ai/mobile.md` — Expo Router, providers, BLE, socket connection flow, setup flow
- `docs/ai/admin.md` — Admin panel architecture and API usage
- `docs/ai/firmware.md` — Firmware architecture, fall detection state machine, pinout, sensor-lab context
- `apps/mobile/package.json`, `apps/backend-api/package.json`, `apps/admin/package.json` — Version source-of-truth
- `docs/features/libraries.md` — Human-readable dependency inventory; update when packages change
- `docs/README.md` — Documentation source-of-truth map
- `firmware/esp32/START_HERE.md` — Sensor-lab sequence and hardware workflow
- `docs/planning/development-plan.md` — Roadmap and progress tracking

### Skill Directories

> ⚠️ `.agent/` (singular) = FallHelp-owned. `.agents/` (plural) = Nx-managed. Do NOT merge these two directories.

| Tool | Skill Directory | Purpose |
| ---- | --------------- | ------- |
| **Codex / Nx-aware agents** | `.agents/skills/` | Workspace discovery, task running, and Nx workflows |
| **Claude Code** | `.claude/commands/` | Slash commands — wraps skills below |
| **FallHelp Canonical** | `.agent/skills/` | FallHelp-specific canonical skills (do not modify with Nx tooling) |
| **GitHub Copilot** | `.github/skills/` + `.github/agents/` | Copilot scaffold skills + agent instructions |
| **Gemini CLI** | `GEMINI.md` | Thin project context adapter; points back to canonical sources |

**FallHelp canonical skills (`.agent/skills/`):**

| Skill | Purpose |
| ----- | ------- |
| `fallhelp-fullstack-agent` | Project-wide workflow, invariants, module routing |
| `iot-firmware-expert` | ESP32 coding, sensor tuning, BLE/MQTT device behavior, embedded debugging |
| `fall-detection-sensor-lab` | Fall Detection Sensor Lab workflow, CSV checks, report tables, and tuning notes |
| `diagram-expert` | Architecture diagrams (Sequence, ER, Class, UseCase) |
| `testing-expert` | Test coverage analysis and feature test reports |

**Nx workspace skills (`.agents/skills/`):**

| Skill | Purpose |
| ----- | ------- |
| `nx-workspace` | Query projects, targets, and dependencies |
| `nx-generate` | Scaffold apps, libs, and project structure |
| `nx-run-tasks` | Run build/test/lint through nx |
| `nx-plugins` | Manage Nx plugins |
| `nx-import` | Import existing projects into the workspace |
| `monitor-ci` | Monitor CI pipeline state |
| `link-workspace-packages` | Link local workspace packages |

**GitHub Copilot skills (`.github/skills/`):**

| Skill | Purpose |
| ----- | ------- |
| `new-api-endpoint` | Scaffold backend REST endpoint (controller → service → route → test) |
| `new-mobile-screen` | Scaffold mobile screen (Expo Router + NativeWind + React Query) |
| `new-mqtt-handler` | Scaffold MQTT topic handler (topics → validator → handler → register) |
| `firmware` | Firmware, sensor tuning, pulse-signal review, and hardware debugging |
| `debug-ble-provisioning` | Debug BLE pairing / WiFi provisioning across ESP32 and mobile flow |
| `debug-mqtt-device-flow` | Debug ESP32 publish -> backend consume -> socket/push flow |

---

## 3. Coding Rules

### TypeScript (All Services)

- TypeScript strict mode is enabled everywhere
- Avoid `any` — use `unknown` and mandate strict narrowing (e.g., Type Guards, Zod validation) before use
- Use Discriminated Unions for distinct state machines (e.g., `suspected_fall`, `fall_cancelled`, `fall_confirmed`)
- Prefer `interface` for object structures/classes and `type` for unions/function signatures
- Explicitly define Return Types for all public functions, services, and API handlers
- Export types from a central `types/` directory per package (use `readonly` for immutable payloads)
- Use extensionless imports — no `.js` extensions
- Prefer relative imports for local workspace code instead of `@/` aliases when practical, especially in `apps/mobile`; this keeps TypeScript, Metro, Jest, ESLint, and runtime resolution aligned without extra alias mapping.
- Use aliases only when an app or package still has an explicit local convention/config requiring them.

### React / React Native (Mobile & Admin)

- Functional components + hooks only
- Do not change existing component patterns without a reason
- Keep screen components thin — move logic into custom hooks (`hooks/`)
- Context providers live in `context/` — do not nest them ad-hoc
- Follow the current Context-first architecture unless the task explicitly introduces a new store pattern

### Backend (Express v5)

- Controller-Service is the default application pattern in this repository
- Keep routes and controllers thin; introduce a repository layer only when it materially improves isolation or reuse
- Use `async/await` with proper try/catch or `express-async-handler`
- All logs must include relevant context such as `deviceId`, `userId`, and `error`
- All MQTT payloads **must be validated** via `payloadValidator.ts` before use
- Never expose internal error details in HTTP responses

### Arduino / ESP32

- Prefer non-blocking `millis()`-based control flow by default
- If `delay()` is unavoidable, keep it minimal and document the hardware reason nearby
- **Never break** the core fall pipeline: `suspected_fall → fall_cancelled / fall_confirmed`
- The false alarm cancel button (GPIO27) can **only** be pressed by the device wearer
- Cancelling via the physical button stops the local alert and sends `fall_cancelled` to the backend
- Cancelling does **not** retract push notifications already delivered
- The false alarm cancellation timeout is **15 seconds** — do not change it without updating firmware, backend, docs, and tests together
- Tune **one parameter per cycle** and document every change
- Keep raw logs separate from summary tables
- `main_firmware` = Prototype firmware
- `sensor_tuning` = isolated hardware calibration

### Cancel vs Acknowledge — Terminology (Enforced System-wide)

| Term | Who | Trigger | DB Change | Scope |
| ---- | --- | ------- | --------- | ----- |
| **Cancel** | Device wearer | GPIO27 button press ≤ 15s | ✅ `fallStage = CANCELLED` + `cancelledAt` | Entire system |
| **Acknowledge** | Caregiver | In-app button (`รับทราบแล้ว`) | ❌ None | UI / Alert overlay only |

- `fall_cancelled` MQTT event, `fallStage = CANCELLED`, and `cancelledAt` in DB **must only originate from the device button flow**
- Caregiver app actions use **in-app acknowledge only**

### Code Cleanup & Refactoring — YAGNI Enforcement

When making multi-file changes:

1. Search for orphaned references after removing or renaming code
2. Remove dead tests, mocks, and unused route definitions
3. Verify there are no dangling API endpoints or unused client calls
4. Remove commented-out code blocks instead of leaving them in files
5. If file/folder structure, entry points, or module boundaries change, update affected `knip.json` (entry/project/workspace globs) in the same change

Dead code checklist:

- Backend: routes, controllers, services, types, tests
- Mobile: service calls, UI screens, navigation references
- Admin: service calls, components, routes
- Database: unused fields require migration planning
- Docs: API specs, README examples, architecture diagrams

### Code Commenting Rules

- Use Thai as the default language for code comments
- Keep important technical terms in English when clearer
- Explain intent, business rules, constraints, and side effects; avoid trivial narration
- Prefer file-level JSDoc-style headers for logic-heavy files that explain what happens in the file, not decorative banner lines
- Avoid import group labels, long separator banners, and line-by-line narration; let imports and simple code speak for themselves
- Add short inline comments only near non-obvious guards, async timing, cross-file side effects, and business rules
- Use `ไฟล์ถัดไป: path/to/file.ts` breadcrumbs only when a reader genuinely needs to follow a cross-file flow
- Remove stale comments when behavior changes
- Use `.agent/skills/fallhelp-fullstack-agent/references/commenting.md` as the detailed comment reference

Before concluding a task that heavily modifies logic or creates new features, agents **should** run:

```bash
npm run audit:instructions
```

Before concluding a task that edits shared AI instructions, agents **should** run:

```bash
nx audit-instructions backend-api
```

---

## 4. Testing & Definition of Done

Before closing any task, verify and **report evidence** for:

- [ ] Code compiles / runs in the affected scope
- [ ] Linting & Formatting passes (Evidence: `nx affected -t lint` output summary)
- [ ] Relevant tests pass (Evidence: `test` output summary showing passed counts)
- [ ] Existing flows are not broken
- [ ] No secrets committed to version control
- [ ] `npm run infra:scan` passes before commit/final close-out or when runtime/docs/config/env changed
- [ ] `npm run infra:scan:strict` passes before commit/final close-out of logic/type-critical, safety-critical, schema, protocol, or cross-stack changes
- [ ] `knip.json` in affected modules is synced when structure/entry paths changed, and dead-code scan for those modules is rerun
- [ ] `docs/ai/*.md` is updated when architecture, database schema, or core flow changes
- [ ] `AGENTS.md` and thin adapters are synced if canonical AI workflow changed

### Continuous Integration (CI) Guidelines

To maintain fast feedback loops and avoid wasting GitHub Actions build minutes, we adhere to the following CI standards:

- **Main-Only Push CI:** The active solo-developer baseline uses `main` as the only working/release branch. Routine CI runs on pushes to `main`; pull-request CI is optional and reserved for external review, experiments, or temporary collaboration branches.
- **Auto-Cancellation (Concurrency Guard):** The CI workflow uses `concurrency` with `cancel-in-progress: true`. If a new push or PR update occurs while a previous CI job is still running, the older job is automatically cancelled to save queue wait time and actions quota.
- **Nx Affected First:** We optimize CI checks using `nx affected` instead of `--all` where possible. This ensures we only run checks (lint, test, build, typecheck) on projects that have changed, saving substantial developer and CI run time.

---

## 5. Security Guardrails & Secret Protection

### Secret Protection (CRITICAL)

AI Agents are prone to hardcoding values for convenience. This is strictly forbidden in FallHelp.

- **Zero Hardcoding Policy**: Never hardcode passwords, API keys, JWT secrets, or database URLs in source code, tests, scripts, or documentation.
- **Environment Variables**: Use `.env` files for local development and ensure they are listed in `.gitignore`. Provide `.env.example` with dummy values.
- **SQL Scripts**: SQL setup scripts must use placeholders (e.g., `<PASSWORD>`) instead of real credentials.
- **Test Code**: Integration tests must derive credentials from environment variables or use a dedicated test database configuration. Never hardcode a connection string with a password in `env-setup.ts` or similar files.
- **Pre-Commit Verification**: Before committing, agents MUST check for accidental leaks of common patterns (passwords, base64 strings, long hex strings).
- **Leak Recovery**: If a secret is accidentally committed:
  1. Rotate/Change the secret in the real system immediately.
  2. Use `git filter-repo` or `git filter-branch` to purge the secret from the entire Git history.
  3. Force-push the cleaned history to the remote repository.

### Security Standards

- Fall detection events and auth flows are high-impact — test thoroughly before deploying.
- Always verify user/device ownership before returning any data.
- JWT validation lives in `apps/backend-api/src/middlewares/auth.ts` — do not bypass it.
- Rate limiting is configured in `apps/backend-api/src/middlewares/rateLimit.ts`.
- **AI Self-Audit**: After completing a task, agents should perform a "Security Sanity Check" to ensure no debug tokens or hardcoded credentials were left behind.

---

## 6. Documentation Rules

- Keep one owner doc per feature in `docs/features/`
- Other docs summarize and link back to the owner doc
- Use relative links and do not leave stale references to deleted code, routes, or screens
- **When starting to edit a doc file, update its `Last Updated` field first — before changing any content.**
- If code, schema, API, MQTT contracts, or cross-stack behavior changes, update the related docs in the same change
- If package dependencies change, sync `docs/features/libraries.md` with the package files in the same change
- If canonical AI workflow changes, update `AGENTS.md` first and then sync thin adapters
- Use `.agent/skills/fallhelp-fullstack-agent/references/docs-sync.md` as the detailed docs-sync reference

---

## 7. Git & Commit Convention

Use Conventional Commits:

```text
<type>(<scope>): <short description>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `style`, `perf`

Scopes: `backend`, `mobile`, `admin`, `firmware`, `docs`, `infra`

Rules:

- 1 commit = 1 logical change
- Keep commits small and reviewable
- Do not mix feature changes with formatting fixes
- Do **not** auto-commit, push, or create PRs unless the user explicitly asks

### Branch & Release Workflow

- Default working branch is `main`
- Continue day-to-day implementation, cleanup, and verification directly on `main`
- Routine solo-dev release flow is local verification → commit → push to `main` → GitHub Actions CI
- Before pushing to `main`, run the validation required by the change scope and report evidence in the working notes or final response
- Pull Requests are not required for routine solo development
- Use a temporary branch and PR only when external review, risky experimentation, or collaboration is explicitly needed
- If a PR is used, AI agents MUST run git command logs (for example `git log origin/main..HEAD --oneline` or `git log -n 10`) before writing the PR description, and the PR must not be merged until required CI checks are green

### Main Push Review Gate

Every push to `main` should be preceded by a focused review pass for bugs, regressions, stale docs/config drift, missing tests, and accidental secrets.

For the current solo-developer workflow:

- GitHub review approval is not required when no second human reviewer is available
- The required release gate is local verification appropriate to the change scope before pushing
- GitHub Actions on `main` acts as the remote CI confirmation after push
- If CI fails on `main`, treat it as the next highest-priority fix and avoid stacking unrelated changes on top

---

## 8. Things NOT to Do

| ❌ Don't | ✅ Do instead |
| -------- | ------------ |
| Leave dead code or commented-out routes after refactoring | Remove completely — Git history preserves it |
| Create functions without checking if UI will use them | Verify full data flow: UI → Service → API → DB |
| Remove backend function without checking mobile/admin imports | Search the entire codebase for the function name before deletion |
| Keep "TODO" or "FIXME" comments for features never implemented | Either implement now or remove — don't leave aspirational code |
| Leave test suites for deleted functions | Remove tests when removing implementation |
| Rewrite entire files for a single-line fix | Edit only the relevant lines |
| Change code without checking test impact | Check `__tests__/` first |
| Give theoretical answers when the user needs working code | Provide a code change + verify it |
| Ask the user to do everything manually if the agent can run it | Run scripts, then report results |
| Commit with vague messages like `fix stuff` | Use Conventional Commits |
| Mix multiple unrelated changes in one commit | One logical change per commit |
| Hardcode secrets in source files | Use `.env` and `.env.example` |
| Change the 15-second cancel timeout without a full-system update | Update firmware, backend, docs, and tests together |
| Write that the caregiver cancels a fall via the app | Only the **device wearer** cancels via GPIO27 — caregiver can only **Acknowledge** (reset UI view, no DB change) |
| Write that cancelling a false alarm removes the push notification | Push notifications already delivered are **not** retracted — Acknowledge only resets the alert overlay in the app |
| Use the word "cancel" for the caregiver's app action | Use **Acknowledge** or **Reset view** — `cancel` / `fall_cancelled` / `fallStage = CANCELLED` / `cancelledAt` are reserved for the device button flow only |
| Add backend mutation to caregiver acknowledge flows | Keep **Acknowledge view** local to the app — `fall_cancelled` / `fallStage = CANCELLED` / `cancelledAt` must originate from MQTT device flow only |

---

## 9. Nx-First Scripts

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

AI agents MUST prefer root-level `npm run` scripts or direct `nx` commands over running tools directly.

- **Explore:** Invoke the `nx-workspace` skill first to query projects, targets, and dependencies.
- **Run:** Always prefer `nx run`, `nx run-many`, or `nx affected` instead of the underlying tool directly.
- **Affected:** Use `nx affected -t <target>` to run only on changed code.
- **Prefix:** Prefix nx commands with the workspace's package manager: `npm exec nx ...`
- **Scaffold:** For creating apps, libs, or project structure, invoke the `nx-generate` skill FIRST.
- **Docs:** Use `nx_docs` or `--help` for unfamiliar flags — NEVER guess CLI parameters.
- **Discovery:** Use `nx show projects` or `nx graph` to understand dependencies before structural changes.

When to use `nx_docs`:

- ✅ Advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- ❌ Basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know

<!-- nx configuration end-->

---

## 10. Visual Standards (Emojis)

Emojis in `AGENTS.md`, `GEMINI.md`, and `CLAUDE.md` are visual anchors for agents (e.g., 📱 Mobile, ⚙️ Backend, 🧊 Nx, ⚠️ Invariants). Do not add decorative emojis to source code, commit messages, or technical docs.

---

## Active Tooling Baseline

Daily agents: **OpenAI Codex**, **GitHub Copilot**, **Claude Code**, **Gemini CLI**. Remove repo-specific config for any tool no longer in active use instead of keeping it "just in case".
