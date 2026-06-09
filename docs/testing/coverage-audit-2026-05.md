# System Coverage Audit Report

> **Date:** May 2026
> **Scope:** Backend, Mobile, and Admin Applications
> **Objective:** Identify gaps between implementation (src) and test coverage (**tests**) across all 3 modules.

---

## 1. Test Execution Summary

All existing tests were executed across the workspace:

| Module | Status | Unit Tests | Integration Tests | Notes |
|---|---|---|---|---|
| **Backend** | ✅ PASS | 47 Suites, 824 Tests | N/A | Tests pass, but some async handlers leaked (force exit required). |
| **Mobile** | ✅ PASS | 40 Suites, 205 Tests | N/A | Passed cleanly. |
| **Admin** | ✅ PASS | 4 Suites, 10 Tests | N/A | Passed cleanly. |

---

## 2. Code vs Test Analysis (Coverage Gaps)

We compared the actual implementation files against the test files to find missing test coverage.

### 🟢 Backend API

The backend is highly tested (Services and Controllers are 100% covered by test files), but there are a few utility functions missing tests:

**Missing Tests:**

* ~~`utils/deviceSemantics.ts` - Maps `Device.status` to `pairingStatus` and derives `onlineStatus`.~~ (✅ Added)
* ~~`utils/deviceSerial.ts` - Validates and normalizes `ESP32-` serial patterns.~~ (✅ Added)

### 🔵 Mobile App

The mobile app has good coverage for services and stores, but lacks tests for several hardware-related hooks and UI utilities.

**Missing Service Tests:**

* `services/bleService.ts`
* `services/wifiScannerService.ts`
* `services/index.ts` (Export aggregator)

**Missing Hooks Tests:**

* `hooks/useProtectedRoute.ts` - Critical navigation guard.
* `hooks/useRouterGuard.ts` - Router patching for cold starts.
* `hooks/useCurrentElder.ts`
* `hooks/useNavBarInset.ts`
* `hooks/useNavigationBar.ts`
* `hooks/usePushNotifications.ts`
* `hooks/useUnsavedChanges.ts`

**Missing Utils Tests:**

* `utils/blePermissions.ts`
* `utils/dialogService.ts`
* ~~`utils/errorHelper.ts` - Maps API errors to Thai error messages.~~ (✅ Added)
* ~~`utils/heartRate.ts` - HR thresholds (`HR_HIGH_THRESHOLD`, `HR_LOW_THRESHOLD`).~~ (✅ Added)
* `utils/keyboard.ts`
* `utils/logger.ts`
* ~~`utils/modalGuard.ts` - Prevents multiple modals.~~ (✅ Added)
* `utils/passwordPolicy.ts`
* `utils/setupStorage.ts`
* `utils/toast.ts`

### 🟣 Admin Device Management

The admin app now focuses on device operations. It has tests for the device page, login page, admin layout, and env validation, but still lacks direct coverage for the custom device hook.

**Missing Tests:**

* `hooks/useAdminDevices.ts`

---

## 3. Recommendations

Based on the `testing-expert` skill, here is the prioritized list of what we should write next to ensure business logic is robust:

1. **Mobile Router Guards:** Test `useProtectedRoute` and `useRouterGuard` because they control access to the app's features and handle routing race conditions.
2. **Mobile Error & Display Helpers:** Test `errorHelper.ts`, `heartRate.ts` and `modalGuard.ts` to ensure users see correct Thai labels and UI states.
3. **Backend Serial & Status:** Test `deviceSerial.ts` and `deviceSemantics.ts` to ensure hardware edge cases are validated correctly.
4. **Admin Device Hook:** Test `useAdminDevices.ts` to verify API mapping, polling, mutation invalidation, and loading/error states.
