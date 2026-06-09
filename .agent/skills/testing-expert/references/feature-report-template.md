# Feature Report Template

> Use this template to record test results in `docs/testing/<feature>.md`.
> Goal: prove that the code behaves correctly according to its business logic.

---

## How to Use

1. Copy the template below and create a new file in `docs/testing/`
2. Name the file after the feature: `auth.md`, `elder.md`, `fall-flow.md`, etc.
3. Fill in based on the real code — never invent logic that is not in the code
4. Update whenever logic changes or tests are re-run

---

## Template

```markdown
# Feature Test Report — [Feature Name]

## Overview

| | |
|---|---|
| **Feature** | [feature name] |
| **Business Logic** | [1-3 sentence summary] |
| **Files** | `apps/backend-api/src/...`, `apps/mobile/...` |
| **Last Verified** | YYYY-MM-DD |
| **Test Results** | ✅ All Pass / ❌ N Failing |

---

## Business Logic to Verify

> Derived from the real code — every item must have a test.

1. [Logic 1 — e.g. "unauthenticated requests must receive 401"]
2. [Logic 2 — e.g. "duplicate email must throw error code 'email_taken'"]
3. [Logic 3 — ...]

---

## Test Coverage

| Logic | Test Name | Type | File | Status |
|---|---|---|---|---|
| [logic 1] | `should reject unauthenticated requests` | Integration | `auth.integration.test.ts` | ✅ |
| [logic 2] | `should return 409 for duplicate email` | Integration | `auth.integration.test.ts` | ✅ |
| [logic 3] | `should hash password before storing` | Unit | `authService.test.ts` | ✅ |

---

## Verification Evidence

### [Logic 1]: [logic name]
```
Test: "should reject unauthenticated requests"
Input:  POST /api/... (no Authorization header)
Expect: status 401
Result: ✅ PASS
```

### [Logic 2]: [logic name]
```
Test: "should return 409 for duplicate email"
Input:  POST /api/auth/register { email: "existing@test.com" }
Expect: status 409, error.code = "email_taken"
Result: ✅ PASS
```

---

## Edge Cases Verified

| Scenario | Expected | Status |
|---|---|---|
| [edge case 1] | [expected result] | ✅ / ❌ |
| [edge case 2] | [expected result] | ✅ / ❌ |

---

## Gap / Known Issues

- [ ] [logic without a test]
- [ ] [scenario not yet verified]

_Or write "No gaps" if fully covered._

---

## Run Command

\`\`\`bash
# Unit tests
cd apps/backend-api && npm test -- --testPathPattern="<file>"

# Integration tests
cd apps/backend-api && npm run test:integration -- --testPathPattern="<file>"
\`\`\`
```

---

## Expected Files in `docs/testing/`

```
docs/testing/
├── auth.md              ← register, login, logout, OTP, reset password
├── elder.md             ← CRUD elder profile
├── device.md            ← pairing, unpair, WiFi config
├── emergency-contact.md ← CRUD + reorder
├── fall-flow.md         ← 2-stage fall: suspected → cancelled/confirmed
├── notification.md      ← list, unread-count, mark-read
├── feedback.md          ← COMMENT + REPAIR_REQUEST
└── event.md             ← list events, monthly summary
```
