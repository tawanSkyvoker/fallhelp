# FallHelp Testing Patterns

> Project-specific patterns — read before writing any test.

---

## Stack by Module

| Module | Framework | Config | Command |
|---|---|---|---|
| **Backend Unit** | Jest + ts-jest | `jest.config.cjs` | `npm test` |
| **Backend Integration** | Jest + Supertest + ESM | `jest.integration.config.cjs` | `npm run test:integration` |
| **Mobile** | Jest + RNTL | `jest.config.cjs` / `jest.light.config.cjs` | `npm test` / `npm run test:light` |
| **Admin** | Jest + React Testing Library | `jest.config.cjs` | `npm test` |

---

## Backend Unit Test Pattern

### Service Mock (Factory Pattern)

```typescript
// Correct — stable reference, TS-compatible
const mockCreate = jest.fn();
jest.mock('../../../services/elderService', () => ({
  createElder: (...args: unknown[]) => mockCreate(...args),
}));

// Wrong — new reference on every call → useEffect infinite loop
jest.mock('../../../services/elderService', () => ({
  createElder: jest.fn(),
}));
```

### Prisma Mock

Prisma 7.8.0 uses `import.meta.url` (ESM-only) — must map in `jest.config.cjs`:

```js
moduleNameMapper: {
  '^.*/generated/prisma/client$': '<rootDir>/src/__tests__/__mocks__/generatedPrismaClient.ts',
}
```

### asyncHandler + flushPromises

`asyncHandler` returns a plain function — `await controller(req, res, next)` resolves **before** `.catch(next)` fires:

```typescript
const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve));

await controller(req, res, next);
await flushPromises(); // needed for reject case only
expect(next).toHaveBeenCalled();
```

---

## Backend Integration Test Pattern

```typescript
import request from 'supertest';
import { app, prisma, cleanDatabase, disconnectDatabase, registerUser, authHeader } from './helpers';

describe('Feature Integration', () => {
  beforeAll(async () => { await cleanDatabase(); });
  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('should do something', async () => {
    const { token } = await registerUser({ firstName: 'Test', lastName: 'User' });
    const res = await request(app)
      .post('/api/endpoint')
      .set(authHeader(token!))
      .send({ field: 'value' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
```

**Key points:**

- Must run with `--runInBand` (included in `npm run test:integration`) — prevents DB conflicts
- Call `await cleanDatabase()` in `beforeAll` for each describe block that needs a clean state
- Create Device via `prisma.device.create()` directly (no public endpoint exists)
- Create Notification/Event via `prisma.notification.create()` / `prisma.event.create()` directly

---

## Mobile Unit Test Pattern

### Context / Hook Test

```typescript
import { renderHook, act } from '@testing-library/react-native';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ContextProvider>{children}</ContextProvider>
);

const { result } = renderHook(() => useMyContext(), { wrapper });

act(() => {
  result.current.setState('value');
});
expect(result.current.state).toBe('value');
```

### Stable Mock Reference (prevents OOM)

```typescript
// Correct — stable references in factory closure, created once
jest.mock('../../hooks/useUnsavedChanges', () => {
  const setHasChanges = jest.fn();
  const resetChanges = jest.fn();
  return {
    useUnsavedChanges: () => ({ setHasChanges, resetChanges, modalProps: { visible: false } }),
  };
});

// Wrong — new jest.fn() on every render → useEffect deps change every cycle → infinite loop → OOM
jest.mock('../../hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({ setHasChanges: jest.fn() }), // ← new ref every call!
}));
```

### Service Mock (Mobile)

```typescript
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../../services/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
  toApiError: (err: unknown) => err,
}));
```

### Realtime Mock (`useSocketConnection` + stores)

```typescript
const mockSensorState = {
  isConnected: false,
  socketConnected: false,
  setIsConnected: jest.fn(),
  setSocketConnected: jest.fn(),
  resetSensorState: jest.fn(),
};

jest.mock('../../store/useSensorStore', () => ({
  useSensorStore: Object.assign(
    jest.fn((selector) => (selector ? selector(mockSensorState) : mockSensorState)),
    { getState: () => mockSensorState, setState: jest.fn() },
  ),
}));

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
  connect: jest.fn(),
  emit: jest.fn(),
  removeAllListeners: jest.fn(), // required — useSocketConnection calls this in cleanup
  connected: false,
};
```

Current mobile realtime architecture is no longer `SocketContext`; prefer mocking `useSocketConnection` side effects and the stores it updates.

---

## Known Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| `Cannot use 'import.meta' outside a module` | Prisma 7.8.0 ESM import | Add `moduleNameMapper` for generated client |
| `next` not called in error test | asyncHandler timing | Add `await flushPromises()` after controller call |
| Worker OOM / SIGTERM | Unstable mock reference → infinite render | Move `jest.fn()` into factory closure |
| `removeAllListeners is not a function` | Socket mock missing cleanup method | Add `removeAllListeners: jest.fn()` to mock socket |
| `createTestElder failed: 409` | 1 User → 1 Elder constraint | Use a new user for each elder required |
| Integration tests DB conflict | Parallel file execution | Use `npm run test:integration` which includes `--runInBand` |

---

## Test Count Source

Do not keep static test totals in this skill. Use `docs/testing/feature-test-checklist.md`
as the current inventory and re-count from the workspace before writing a coverage report.
