# FallHelp Mobile

React Native (Expo SDK 55) caregiver application for FallHelp.  
Supports authentication, elder/device management, realtime alerts, and monitoring flows.

## Scope

- Caregiver app UX and navigation (Expo Router)
- API integration with backend
- Socket realtime event handling
- BLE/WiFi setup flow for device provisioning
- Expo Push registration, backend logout push-token cleanup, and notification badge/list sync

## Route Structure

```text
app/
├── (auth)/          # Login/register/OTP/password flows
├── (setup)/         # Empty state + 3-step onboarding wizard
├── (tabs)/
│   ├── dashboard.tsx
│   └── history.tsx
└── (features)/
    ├── (device)/        # device-pairing, device-wifi-setup (+ internal reconfig/BLE subflows), device-info
    ├── (elder)/         # elder-info, edit
    ├── (emergency)/     # contacts, add, edit, call
    ├── (notification)/  # notifications
    ├── (report)/        # report-summary
    └── (profile)/       # profile-info, edit-info, change-email/password, edit-phone
```

## Runtime Notes

- Dashboard card state is driven by Socket.io realtime events.
- The notification badge and notification list are synced from backend notification records together, so the red dot should not appear before the list item exists.
- Logout calls backend `/api/auth/logout` before clearing the local JWT so `users.pushToken` is cleared server-side.

## Quick Start

```bash
cd apps/mobile
npm install
cp .env.example .env

# Update .env for your machine/network
npx expo start
```

Run targets:

```bash
npm run android
npm run ios
npm run web
```

## Commands

```bash
npm run start
npm run typecheck
npm run lint
npm run lint:fix
npm run test -- --watchman=false
npm run test:light -- --watchman=false
npm run test:coverage
```

## EAS Build

Install `eas-cli` as a devDependency of this app and run it through the local package manager entrypoint.

```bash
cd apps/mobile
npm exec eas login
npm exec eas build --platform android --profile development
```

Use the same local entrypoint for any other EAS commands.

## Environment

Use `apps/mobile/.env.example` as source of truth.

- `EXPO_PUBLIC_API_URL` (recommended)
- `EXPO_PUBLIC_SOCKET_URL` (optional override)
- `EXPO_PUBLIC_FORCE_PUBLIC` (force public URL when using Expo tunnel)
- `GOOGLE_SERVICES_JSON_BASE64` (optional for EAS Android build)

## Verify Before PR

```bash
npm run typecheck
npm run lint
npm run test:light -- --watchman=false
```

## Related Docs

- Root guide: [`../../README.md`](../../README.md)
- Device pairing flow & BLE/WiFi provisioning: [`../../docs/features/device-pairing.md`](../../docs/features/device-pairing.md)
- Dashboard: [`../../docs/features/dashboard.md`](../../docs/features/dashboard.md)
- Notification system: [`../../docs/features/notifications.md`](../../docs/features/notifications.md)
- Fall detection feature: [`../../docs/features/fall-detection.md`](../../docs/features/fall-detection.md)
