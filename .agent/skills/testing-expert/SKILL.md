---
name: testing-expert
description: >
  Testing Expert for FallHelp — covers all test layers (Unit, Integration, E2E, UAT),
  helps write tests, analyzes whether tests actually cover the real business logic,
  and writes feature test reports to docs/testing/.
allowed-tools: Read, Glob, Grep
---

# Testing Expert — FallHelp

> "A good test doesn't just pass — it proves the code logic is actually correct."

---

## When to Use This Skill

| Situation | Action |
|---|---|
| Writing new tests | Always read `references/fallhelp-patterns.md` first |
| Deciding if tests are sufficient | Read `references/testing-theory.md` → compare coverage against logic |
| Writing a feature test report | Read `references/feature-report-template.md` → write to `docs/testing/` |
| Unsure whether a mock pattern is correct | Read `references/fallhelp-patterns.md` → section: Known Pitfalls |

---

## Core Workflow

```
1. Read the real code first (controller / service / context / screen)
2. Identify the key business logic that must be verified
3. Compare against existing tests — is coverage sufficient?
4. Write tests or fill the gaps
5. Run tests → record results in docs/testing/<feature>.md
```

**Never** write tests that mock everything to the point where nothing real is verified.

---

## Selective References

Read only what is needed for the task:

| File | Read when |
|---|---|
| `references/testing-theory.md` | Deciding which test type is appropriate for the task |
| `references/fallhelp-patterns.md` | Writing tests in the FallHelp project (Jest, Supertest, mocking) |
| `references/feature-report-template.md` | Recording test results in `docs/testing/` |

---

## Test Layers in FallHelp

| Layer | Used for | Tools | Command |
|---|---|---|---|
| **Unit** | service, utils, controller logic | Jest + mock | `npm test` (backend/mobile/admin) |
| **Integration** | API routes + real DB | Jest + Supertest | `npm run test:integration` |
| **Smoke** | health check after deploy | integration test | `/api/health` |
| **UAT** | user tests real flows | manual | record in `docs/testing/` |

---

## Feature Report

After verifying a feature, record the results in `docs/testing/`:

```
docs/testing/
├── auth.md          ← register/login/logout/OTP/reset-password
├── elder.md         ← CRUD elder profile
├── device.md        ← pairing/unpair/WiFi
├── fall-flow.md     ← 2-stage fall: suspected → cancelled/confirmed
├── notification.md  ← notifications
└── ...
```

Use the template from `references/feature-report-template.md`.
