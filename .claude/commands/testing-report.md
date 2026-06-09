# /testing-report

Thin Claude wrapper for feature-level test coverage analysis in FallHelp.

## Canonical Sources

1. `AGENTS.md`
2. `docs/ai/AI_QUICKSTART.md`
3. `docs/ai/AI_MODULE_ROUTER.md`
4. `.agent/skills/testing-expert/SKILL.md`
5. `docs/testing/`

If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Inputs

- `feature=<name>`

## Checklist

1. Read the real code and existing tests for the feature.
2. Compare expected business behavior against actual coverage.
3. Write the report to `docs/testing/<feature>.md` using project terminology.
4. Call out missing coverage, risky mocks, and verification gaps.

## Verification

```bash
npm run audit:instructions
npm run infra:scan
```
