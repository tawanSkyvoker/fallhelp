# FallHelp AI Quick Start

## Doc Meta

- Audience: AI agents and developers who need a fast repo entrypoint
- Source of Truth: [../../AGENTS.md](../../AGENTS.md) + `docs/ai/*`
- Status: Active
- Last Updated: June 8, 2026

---

## Start Here

1. Use this file as the fast-routing entrypoint for small, local, single-module tasks
2. Read `AGENTS.md` when the task is cross-stack, schema, protocol, invariant, or workflow-related
3. Read `docs/ai/AI_MODULE_ROUTER.md` for module persona
4. Use the routing map below to decide what to open next

## 🚨 Validation Matrix

AI agents MUST run validation based on the scope of change and **include the output summary** in the final response. For routine local edits, start with lightweight affected checks. Reserve full infra scans for pre-commit, final close-out, runtime/config/docs/env changes, and high-risk flows. **Prefer Nx commands** for faster execution and caching.

| If you touched...                         | Primary Nx Command                  | Legacy NPM Alias                | Purpose                                                      |
| :---------------------------------------- | :---------------------------------- | :------------------------------ | :----------------------------------------------------------- |
| **Any File (Format)**                     | `nx affected -t lint --fix`         | `npm run affected:lint`         | Ensure standard formatting and linting.                      |
| **Formatting-sensitive edits**            | module format/prettier target       | module `format` script          | Apply Prettier when text/layout formatting may have changed. |
| **Touched behavior**                      | targeted project test               | module `test` script            | Run focused tests for the touched behavior.                  |
| **TypeScript imports/types**              | project `typecheck` target          | module `typecheck` script       | Verify affected TypeScript compiles.                         |
| **Config / Docs / Env / final close-out** | `nx infra-scan backend-api`         | `npm run infra:scan`            | Verify runtime, doc links, and env integrity.                |
| **Pre-commit critical logic/types**       | `nx infra-scan-strict backend-api`  | `npm run infra:scan:strict`     | Deep verification of logic, types, and integration.          |
| **AI Instructions**                       | `nx audit-instructions backend-api` | `npm run audit:instructions`    | Check for instruction drift.                                 |
| **Comments / Refactor**                   | `nx audit-comments backend-api`     | `npm run audit:comments:strict` | Ensure Thai-first commenting standards.                      |

---

## ✅ Evidence-Based Definition of Done

You are NOT finished until you provide:

1. **Summary of changes:** What was modified?
2. **Command run:** Which verification script did you execute?
3. **Execution Evidence:** A brief snippet or summary of the PASS/FAIL result.

## 🚢 Solo Main Push Gate

For the current solo-developer workflow:

1. Work directly on `main`
2. Run validation required by the change scope before committing
3. Commit with a Conventional Commit message
4. Push to `main`
5. Treat GitHub Actions on `main` as the remote CI confirmation

Pull Requests are optional and should be reserved for external review, risky experiments, or temporary collaboration branches. If CI fails after a push to `main`, fix that failure before stacking unrelated work.

---

## 🧭 Fast Routing Guide

- [AGENTS.md](../../AGENTS.md)
- [AI Module Router](AI_MODULE_ROUTER.md)
- [Agent Reference](agent-reference.md)
- [System Overview](system_overview.md)
