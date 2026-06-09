# 🕵️ FallHelp Claude Code Onboarding

This file is the **Claude Code** onboarding manual. It provides high-level context and constraints for the FallHelp project.

## 🏛 Hierarchical Context (Read Order)

Claude Code MUST traverse the documentation in this order to avoid instruction drift:

1. **`AGENTS.md` (MASTER POLICY)** - Read this for canonical project rules and verification gates.
2. **`docs/ai/AI_QUICKSTART.md`** - Fast routing and validation checklists.
3. **`docs/ai/AI_MODULE_ROUTER.md`** - Determine your module persona (Senior Mobile, Backend, or Firmware).
4. **`docs/ai/system_overview.md`** - Cross-stack flows and shared invariants.

## 🛠 Tech Stack

- **Frameworks:** React Native (Expo 55), Express v5, React 19 (Admin).
- **ORM/DB:** Prisma + PostgreSQL.
- **Communication:** MQTT (Firmware/Backend), Socket.io (Backend/Mobile).
- **Styling:** NativeWind (Mobile), TailwindCSS (Admin).

## 🚫 Forbidden (Don'ts)

- **Do NOT** hardcode secrets (passwords, tokens). Use `.env`.
- **Do NOT** use `any` types. Use `unknown` or proper interfaces.
- **Do NOT** use `Cancel` terminology for Caregivers. Use `Acknowledge`.
- **Do NOT** bypass the **Mandatory Verification Gate** (Lint/Test/Scan).
- **Do NOT** write logic-heavy files without a short JSDoc-style Thai header.

## ⌨️ Essential Commands

- **Install:** `npm install`
- **Lint & Fix:** `nx affected -t lint --fix`
- **Verify Logic:** `npm run infra:scan:strict`
- **Audit AI:** `npm run audit:instructions` (Run after editing instructions)

## 🗺 Project Structure

- `apps/mobile`: Expo React Native app.
- `apps/backend-api`: Node.js Express server + MQTT handlers.
- `apps/admin`: React Vite admin panel for device management.
- `firmware/esp32`: Arduino/C++ fall detection logic.
- `docs/ai`: Comprehensive AI-specific technical documentation.

## 🔍 Module-Specific Slash Commands

- `/firmware`: Hardware/Sensor tuning.
- `/debug-mqtt-device-flow`: End-to-end event pipeline debugging.
- `/qa-review`: Perform a technical review of changes.

---

**Policy Note:** This file is a thin adapter. If it conflicts with `AGENTS.md`, `AGENTS.md` wins. Keep domain truth in the canonical layer.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
