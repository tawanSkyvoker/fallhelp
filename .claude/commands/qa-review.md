# /qa-review

Thin Claude wrapper for review passes in FallHelp.

## Canonical Sources

1. `AGENTS.md`
2. `docs/ai/AI_QUICKSTART.md`
3. `docs/ai/AI_MODULE_ROUTER.md`
4. `docs/ai/system_overview.md`
5. `.agent/skills/testing-expert/SKILL.md`

If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Inputs

- `scope=feature|pr|develop`
- `file=<path>`

## Checklist

1. Review correctness first, then tests, docs, invariants, and security.
2. Check that touched code still follows module-specific patterns from `docs/ai/*`.
3. Flag stale docs, missing tests, risky merge side effects, and invariant breaks.
4. Use a reviewer mindset: findings first, summary second.

## Verification

```bash
npm run infra:scan
npm run infra:scan:strict
```
