# Validation Map

Choose validation based on what changed.

## Routine Commands

Use these first for small local changes:

- Lint:
  - `nx affected -t lint --fix`
  - or the affected module's lint script

- Formatting:
  - run the affected module's prettier/format command when formatting may have changed

- Tests:
  - run targeted tests for the touched behavior

- Typecheck:
  - run the affected module's typecheck when TypeScript types, imports, or build-sensitive code changed

## Full / Close-Out Commands

- Runtime/docs/config/env changes:
  - `npm run infra:scan`

- Pre-commit or final close-out for business logic, types, safety-critical flows, schema, protocol, or cross-stack changes:
  - `npm run infra:scan:strict`

- If integration DB is unavailable for a required strict scan:
  - `npm run infra:scan:strict:no-integration`

## Watchman-Safe Test Variants

- Backend:
  - `npm run --prefix apps/backend-api test -- --watchman=false`

- Mobile:
  - `npm run --prefix apps/mobile test:light -- --watchman=false`

## Comment Audit

For heavy logic edits or new features, also run:

- `npm run audit:comments:strict`

## Sync Checklist Before Closing

- Update `docs/ai/*` if architecture, schema, or core flow changed
- Sync thin tool adapters if canonical AI workflow changed
- Report any validation gaps explicitly
