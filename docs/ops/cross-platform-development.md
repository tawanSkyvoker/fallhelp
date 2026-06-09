# Cross-Platform Development

## Doc Meta

- Audience: Developers, QA
- Source of Truth: `../../package.json`, `../../apps/backend-api/package.json`, `../../apps/mobile/package.json`, `../../apps/admin/package.json`, `../../scripts/dev/dev-all.mjs`, `../../scripts/iot/node-red-launch.mjs`, `../../scripts/iot/firmware-monitor.mjs`
- Status: Active
- Last Updated: May 21, 2026

## Overview

This repository is intended to work on both Windows and Linux Ubuntu with one shared source tree.

The main rule is simple: share the code, but do not share installed artifacts across operating systems. Each OS must install its own dependencies, caches, and native binaries locally.

This repo uses npm workspaces with a nested install strategy configured in [`.npmrc`](../../.npmrc).

## Supported Platforms

### Officially Intended Local Development Targets

- Windows 10/11
- Ubuntu 24.04 LTS or newer

WSL note:

- If you open the repo from Windows via `\\wsl.localhost\Ubuntu\...`, prefer repo launchers (`install:all`, `platform:check`, `dev:all`, `infra:scan`).
- If you work inside a WSL shell, treat it as Linux and reinstall dependencies there.

### Expected Limits

- Linux cannot run iOS Simulator. Use Android or Expo web on Ubuntu.
- Serial device names differ by OS:
  - Windows: `COMx`
  - Ubuntu: `/dev/ttyUSBx` or `/dev/ttyACMx`
- Native optional packages such as Rollup, esbuild, and Lightning CSS are installed per OS during `npm install` or `npm ci`.

## Setup Flow

### 1. Install Shared Prerequisites

- Node.js 24.x
- npm 10.x or newer
- Git

### 2. Install Service Prerequisites By Use Case

- Backend and full-stack local run:
  - PostgreSQL 18
  - Mosquitto 2.x
- Mobile on Android:
  - Android Studio + Android SDK
- Arduino workflow:
  - `arduino-cli` or Arduino IDE 2.x
- Node-RED sensor lab flow:
  - `node-red` installed in the repo (run `npm install` at root)

### 3. Clone And Install On The Current OS

Run a fresh install on each machine and OS:

```bash
npm run install:all
npm run platform:check
```

If a scope still fails `platform:check`, reinstall all workspace dependencies on the current OS:

```bash
npm run install:all
```

## Non-Negotiable Cross-Platform Rules

- Do not copy `node_modules/` from Windows to Ubuntu.
- Do not copy `node_modules/` from Ubuntu to Windows.
- Do not commit OS-specific build output or cache folders.
- Reinstall dependencies after switching OS, CPU architecture, or major Node version.
- Prefer Node-based scripts over shell-specific scripts for shared automation.
- Use `npm run platform:check` before debugging strange native-package failures.

## Platform Notes

### Root Scripts

The shared launcher and utility scripts are written to branch by platform when needed:

- `../../scripts/dev/dev-all.mjs`
- `../../scripts/iot/node-red-launch.mjs`
- `../../scripts/iot/firmware-monitor.mjs`

Use repo launchers as the default command surface across OSes.

### Windows Notes

- Firmware helpers try `arduino-cli board list` first to auto-detect the board port.
- If auto-detection finds nothing, the fallback port is `COM3`.
- To override the port in PowerShell:

```powershell
$env:FIRMWARE_PORT = "COM5"
node scripts/iot/firmware-arduino-cli.mjs upload main
```

- To override the serial monitor port in PowerShell:

```powershell
$env:MONITOR_PORT = "COM5"
node scripts/iot/firmware-monitor.mjs
```

- If a terminal keeps child processes alive after Ctrl+C, prefer the repo launcher scripts instead of hand-written shell chains.

### Ubuntu Notes

- Firmware helpers try `arduino-cli board list` first to auto-detect the board port.
- If auto-detection finds nothing, the fallback port is `/dev/ttyUSB0`.
- The user running Arduino tools may need serial permissions:

```bash
sudo usermod -aG dialout $USER
```

- Log out and back in after changing serial group membership.

### Mobile Notes

- Windows and Ubuntu can both run Expo development tooling.
- Ubuntu should target Android or web.
- iOS development remains macOS-only.

### Database And MQTT Notes

- When possible, prefer Docker or a documented local service setup so Windows and Ubuntu use the same service versions.
- Keep `.env` values OS-neutral unless a path or serial port must differ.

## Verification

After a fresh install on the current OS, verify the local toolchain with the commands relevant to your scope:

```bash
npm run platform:check
npm run backend:build
npm run admin:build
npm run --prefix apps/mobile typecheck
npm run infra:scan
```

For docs or config-only changes where runtime services are not ready yet, use the strict scan variant that matches the current environment and report any skipped integration coverage explicitly.

## Troubleshooting

### Native Module Missing After Moving Between OSes

Symptoms usually look like missing optional packages for Rollup, esbuild, or Lightning CSS.

Fix:

1. Reinstall dependencies on the current OS
2. Run `npm run platform:check`
3. Re-run the package command

### Firmware Monitor Cannot Open The Port On Ubuntu

Check:

1. Correct serial path such as `/dev/ttyUSB0`
2. USB cable and board power
3. `dialout` group membership

### Node-RED Command Fails

Install Node-RED first, then run:

```bash
node scripts/iot/node-red-launch.mjs
```

## Related Docs

- `Local deployment: ./local-deployment.md`
- `API verification: ./api-verification.md`
- `Local deployment: ./local-deployment.md`
- `Project structure: ../architecture/project-structure.md`
- `System design: ../architecture/system-design.md`
