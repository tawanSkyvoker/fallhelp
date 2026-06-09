# Drift Checklist

Use this reference before closing any change that touches `AGENTS.md`, `docs/ai/*`, `.agent/skills/*`, `.claude/*`, or `.github/*`.

## Canonical Update Order

1. Update `AGENTS.md` first if the rule or workflow changed
2. Update `docs/ai/*` if architecture, flow, or module context changed
3. Update `.agent/skills/*` if reusable execution workflow changed
4. Update wrappers/adapters only after the canonical layer is correct

## Anti-Drift Rules

- Do not add new business rules directly into wrappers
- Keep wrappers as route/checklist files, not independent knowledge bases
- Move repeated rule text back into canonical docs instead of copying it again
- If a statement can go stale and break correctness, it belongs in the canonical layer first

## Close-Out Checks

- Confirm all touched wrappers still point back to canonical sources
- Confirm renamed or deleted files are not referenced from AI docs or skills
- Confirm module-specific docs still match the current code paths
- Run `npm run audit:instructions`
- Run the appropriate infra scan for the scope of change

## Nx / Tooling Reminder

- Treat `.agents/skills/` as Nx-managed
- Treat `.agent/skills/` as FallHelp-owned canonical skills
- If tool-generated files reappear, decide whether they belong in the repo baseline before keeping them
