# Testing Theory Reference

> Authority: ISTQB, IEEE, Martin Fowler — TestPyramid

---

## Testing Pyramid

```
        ▲
       /  \        UAT — real users test
      /    \
     /------\
    /        \     E2E — full system flow (UI→API→DB)
   /          \
  /------------\
 /              \   Integration — real modules working together
/                \
/------------------\
|   Unit Test       | → single function, isolated
\------------------/
```

**Principle:** More unit tests, fewer UAT — lower layers are faster and cheaper.

---

## Test Types

### Unit Test
| | |
|---|---|
| **What** | Tests a single function/method in isolation |
| **Characteristics** | Mocks all dependencies (DB, API, network) |
| **Speed** | < 1 second per test |
| **Best for** | Service logic, utils, controller response shape, context state |

### Integration Test
| | |
|---|---|
| **What** | Tests real interaction between modules |
| **Characteristics** | Uses real DB, real HTTP, does not mock core dependencies |
| **Speed** | 1–10 seconds per test |
| **Best for** | API routes, auth flow, DB constraints, cross-layer business rules |

### E2E Test
| | |
|---|---|
| **What** | Tests the full system from the user's perspective |
| **Characteristics** | Real UI + real API + real DB |
| **Speed** | 10–60 seconds per test |
| **Tools** | Detox, Maestro (Mobile), Playwright (Web) |

### UAT (User Acceptance Test)
| | |
|---|---|
| **What** | Real users verify that the software meets requirements |
| **Characteristics** | Manual — follows test scenarios |
| **Record results** | `docs/testing/<feature>.md` |

---

## Key Terms

### Smoke Test
Basic check that the system starts up after deploy or a major merge.
Example: verify that `/api/health` returns 200.

### Regression Test
Verifies that new code changes do not break existing behavior.
Every `npm test` run acts as a regression test automatically.

### Load / Stress Test
| | Load Test | Stress Test |
|---|---|---|
| **Goal** | Measure throughput at normal load | Find the breaking point |
| **Tools** | k6, Artillery | k6, Artillery |

### Mocking & Stubbing

| Term | Meaning |
|---|---|
| **Mock** | Replaces a dependency + tracks calls (how many times, with what args) |
| **Stub** | Returns a fixed value, ignores behavior |
| **Spy** | Wraps the real function to observe calls, while still running real logic |
| **Fixture** | Stable test data used across tests |

---

## V&V — Verification & Validation

| | Verification | Validation |
|---|---|---|
| **Question** | "Are we building it right?" | "Are we building the right thing?" |
| **Done by** | Developer / QA | User / Stakeholder |
| **Method** | Unit test, Integration test, Code review | UAT, Demo, User feedback |

> Verification = check the process / Validation = check the product

---

## References

- [ISTQB Glossary](https://glossary.istqb.org/)
- [Martin Fowler — TestPyramid](https://martinfowler.com/bliki/TestPyramid.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest](https://github.com/ladjs/supertest)
