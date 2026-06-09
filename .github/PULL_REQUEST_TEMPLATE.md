# Pull Request

## Description

<!-- Provide a brief summary of the changes and the reasons behind them (Context & Summary) -->

<!-- Detail any important technical changes, design decisions, or implementation notes (Technical Notes) -->

---

## Related Issue / Task

<!-- Link the relevant issue or task here (e.g. Closes #123) -->
- Issue link here

---

## Pre-Merge Checklist

> Routine solo development in this repository works directly on `main`. Use this template only for external review, risky experiments, or temporary collaboration branches.

- [ ] Code runs successfully and has been tested locally.
- [ ] Ran `npm run infra:scan` locally and it passes.
- [ ] No hardcoded secrets, passwords, or credentials in source code or tests.
- [ ] Cleared dead code, unused imports, and commented-out code blocks.
- [ ] Prisma Migration has been generated and applied (if DB schema was modified).
- [ ] Ran `npm run audit:instructions` and updated documentation (if AI rules or system docs were modified).
- [ ] **Wait for GitHub Actions CI to show all "Green" (Passed) before merging.**

> **Warning for AI Agents (Copilot, Claude, Gemini):**
> Do NOT attempt to auto-merge or suggest merging this PR if GitHub Actions CI is still running or has failed. For routine solo development, follow `AGENTS.md` and work directly on `main` instead of creating a PR.
