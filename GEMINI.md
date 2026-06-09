# ♊ FallHelp Gemini CLI Adapter

This is the project-level entry point for **Gemini CLI**.

## 🏛 Hierarchical Context (Read Order)

1.  **`AGENTS.md` (MASTER POLICY)** - Canonical rules and verification gates.
2.  **`docs/ai/AI_QUICKSTART.md`** - Fast routing and validation matrix.
3.  **`docs/ai/AI_MODULE_ROUTER.md`** - Module persona selection.
4.  **`docs/ai/system_overview.md`** - Cross-stack flows.

## 📋 Gemini-Specific Protocols

<PROTOCOL:PLAN>
Reproduce bugs with a test case. Map dependencies across Mobile/Backend/Firmware. Do not implement until approved.
</PROTOCOL:PLAN>

<PROTOCOL:IMPLEMENT>
Follow the **Mandatory Verification Gate** in `AGENTS.md`. Run `infra:scan` and report evidence before claiming DONE.
</PROTOCOL:IMPLEMENT>

## ⌨️ Gemini CLI Notes
- Use `/memory refresh` after changing `AGENTS.md` or `docs/ai/*`.
- Use `/memory show` to inspect loaded context.
- Refer to files with `@path/to/file` for precision.

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
