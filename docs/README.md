# FallHelp Documentation

> Comprehensive documentation index for the FallHelp project.
>
> **Audience:** Developers, QA, PM  
> **Language:** English (technical terms) / Thai (where noted)  
> **Status:** Active — Last Updated: June 8, 2026

---

## Quick Start (Reading Flow)

Start here depending on your role:

| Role             | Recommended Reading Path                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend Dev**  | [System Design](architecture/system-design.md) → [API Reference](api/api-reference.md) → [API Verification](ops/api-verification.md) → [Local Deployment](ops/local-deployment.md) |
| **Mobile Dev**   | [Device Pairing](features/device-pairing.md) → [UI/UX Spec](features/dashboard.md#uiux-guidelines)                                                                                      |
| **Admin Dev**    | [Admin Panel](features/admin-panel.md) → [API Reference](api/api-reference.md)                                                                                                          |
| **Hardware Dev** | [Device Pairing (BLE)](features/device-pairing.md) → [Firmware README](../firmware/esp32/README.md) → [MPU6050 Guide](../firmware/esp32/docs/components/mpu6050.md)                     |
| **QA / PM**      | [Functional Requirements](planning/functional-requirements.md) → [Development Plan](planning/development-plan.md)                                                                        |

---

## Source Of Truth Map

ใช้ตารางนี้เป็นกติกาหลักเวลาเอกสารชนกัน:

| Domain                        | Owner Doc                                                              | ใช้เมื่อ                                                      | Supporting Docs                                                     |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| ระบบภาพรวม                    | [architecture/system-design.md](architecture/system-design.md)         | ต้องการภาพรวมทั้งระบบและการเชื่อมกันของแต่ละโมดูล             | `architecture/project-structure.md`, `ai/system_overview.md`        |
| โครงสร้าง repo                | [architecture/project-structure.md](architecture/project-structure.md) | ต้องการ tree ปัจจุบัน, entry points, package scope            | `ai/backend.md`, `ai/mobile.md`, `ai/admin.md`, `ai/firmware.md`    |
| REST API                      | [api/api-reference.md](api/api-reference.md)                           | ต้องการ endpoint, request/response, realtime payloads         | `architecture/data-model.md`                                        |
| Data model                    | [architecture/data-model.md](architecture/data-model.md)               | ต้องการภาพรวม schema, relation, และ event lifecycle           | `ai/backend.md`                                                     |

| Event/Fall flow               | [features/fall-detection.md](features/fall-detection.md)               | ต้องการ behavior ของ suspected/confirmed/cancelled            | `architecture/iot-mqtt.md`, `architecture/data-model.md`            |
| MQTT/IoT protocol             | [architecture/iot-mqtt.md](architecture/iot-mqtt.md)                   | ต้องการ topic, payload, dedup, RESET_WIFI flow                | `features/device-pairing.md`, `ai/firmware.md`                      |
| Mobile navigation/app shell   | [ai/mobile.md](ai/mobile.md)                                           | ต้องการรู้ entry files, route groups, provider stack          | `features/*.md`, `features/dashboard.md#uiux-guidelines`            |
| Admin app                     | [ai/admin.md](ai/admin.md)                                             | ต้องการรู้ route/page scope และ backend surface ที่ admin ใช้ | `features/admin-panel.md`                                           |
| Backend internals             | [ai/backend.md](ai/backend.md)                                         | ต้องการ controller/service/iot/socket structure               | `architecture/system-design.md`, `api/api-reference.md`             |
| Firmware                      | [ai/firmware.md](ai/firmware.md)                                       | ต้องการเข้าใจ firmware structure และ hardware flow            | `features/fall-detection.md`, `architecture/iot-mqtt.md`            |
| Authentication                | [features/auth.md](features/auth.md)                                   | ต้องการ auth user flow ปัจจุบัน                               | `api/api-reference.md`                                              |
| Device pairing                | [features/device-pairing.md](features/device-pairing.md)               | ต้องการ flow การผูกอุปกรณ์และ setup                           | `architecture/iot-mqtt.md`                                          |
| User account lifecycle        | [features/user-account.md](features/user-account.md)                   | ต้องการ profile/password/push-token flow ปัจจุบัน             | `api/api-reference.md`                                              |
| Local development environment | [ops/cross-platform-development.md](ops/cross-platform-development.md) | ต้องการกติกา Windows/Ubuntu/WSL และการ reinstall              | `README.md`, `package.json`                                         |
| Product requirements          | [planning/functional-requirements.md](planning/functional-requirements.md) | ต้องการขอบเขต product ปัจจุบัน                            | `planning/development-plan.md`, `features/*.md`                     |
| UI behavior                   | [features/dashboard.md](features/dashboard.md)                         | ต้องการดู state/interaction ระดับหน้าจอ                       | `features/*.md`                                                     |

### Document Status Rules

- `Active`: อธิบาย behavior ปัจจุบัน ต้องตรงกับโค้ดและโครงสร้างจริง
- `Planned`: เป็นอนาคตหรือ roadmap ยังใช้เป็น source of truth สำหรับ runtime ปัจจุบันไม่ได้
- `Historical`: เป็นบันทึกการเปลี่ยนแปลงหรือ migration note ใช้อ้างบริบทย้อนหลังเท่านั้น

---

## Directory Structure

```
docs/
├── architecture/    # ARCHITECTURE — system design, data model, MQTT/IoT
├── features/        # FEATURES — feature specs, tech notes, and UI/UX (merged)
├── api/             # API — REST API reference
├── planning/        # PLANNING — requirements & development roadmap
├── backlog/         # BACKLOG — future features, not yet implemented
├── ops/             # OPS — deployment, troubleshooting, security
├── testing/         # TESTING — glossary & test strategy
├── ai/              # AI — agent context memory
```

---

## Folder Responsibilities

ใช้กติกานี้เวลาจะสร้างไฟล์ใหม่หรือย้ายไฟล์เก่า:

| Folder          | Primary Responsibility                                      | Put It Here When                                                                                              |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `architecture/` | ภาพรวมระบบและโครงสร้างข้ามโมดูล                             | เอกสารอธิบาย system design, data model, integration boundary, event flow ระดับระบบ                            |
| `features/`     | owner docs ของฟีเจอร์, implementation notes, และ UI/UX spec | เอกสารตอบว่า feature ทำงานอย่างไร ทั้งมุมผู้ใช้, เทคนิค, protocol, constraint, invariant, และ screen behavior |
| `api/`          | canonical API contract                                      | เอกสารที่เป็น truth หลักของ endpoint, payload, request/response                                               |
| `planning/`     | งานที่ยังไม่ปิดและ roadmap                                  | เอกสารที่พูดถึง milestone, remaining work, requirements                                                       |
| `backlog/`      | ฟีเจอร์ในอนาคตที่ยังไม่ implement                           | feature spec ของฟีเจอร์ที่วางแผนไว้แต่ไม่ได้ทำในโปรเจคนี้                                                    |
| `ops/`          | runbook และ operational guidance                            | setup, verification, deployment, troubleshooting, environment rules                                           |
| `testing/`      | test knowledge ที่ยังใช้ได้ต่อเนื่อง                        | glossary, strategy, testing rules, reusable QA guidance                                                       |
| `ai/`           | AI agent context memory                                     | persona/router/deep context สำหรับ agent ไม่ใช่ owner doc ของ product behavior                               |

### Placement Rules

- ถ้าไม่แน่ใจว่าไฟล์เป็น owner doc หรือ supporting doc ให้ตัดสินจากคำถามนี้: "ทีมควรเชื่อไฟล์นี้เป็นตัวจริงของ behavior ปัจจุบันหรือไม่"

---

## `docs/ai/` — AI Context Memory

> **Audience:** AI agents, Developers

| Document                                      | Description                                     |
| --------------------------------------------- | ----------------------------------------------- |
| [INDEX.md](ai/INDEX.md)                       | ภาพรวมการใช้ชุดเอกสาร AI context                |
| [AI_MODULE_ROUTER.md](ai/AI_MODULE_ROUTER.md) | เลือก persona ตามโมดูลที่กำลังแตะ               |
| [agent-reference.md](ai/agent-reference.md)   | Quick reference สำหรับ tree, commands, hardware |
| [system_overview.md](ai/system_overview.md)   | ภาพรวม cross-module และ shared invariants       |
| [backend.md](ai/backend.md)                   | Backend deep context                            |
| [mobile.md](ai/mobile.md)                     | Mobile deep context                             |
| [admin.md](ai/admin.md)                       | Admin deep context                              |
| [firmware.md](ai/firmware.md)                 | Firmware deep context                           |

---

## `docs/architecture/` — System Architecture

> **Audience:** Backend Dev, IoT Dev, Architects

| Document                                                  | Description                                        |
| --------------------------------------------------------- | -------------------------------------------------- |
| [system-design.md](architecture/system-design.md)         | High-level architecture, component flow, providers |
| [project-structure.md](architecture/project-structure.md) | Folder layout + tech stack breakdown               |
| [data-model.md](architecture/data-model.md)               | ERD diagram, cascade rules, indexes, event lifecycle, constrained TEXT fields |
| [iot-mqtt.md](architecture/iot-mqtt.md)                   | MQTT topics, 2-stage fall detection, deduplication |

---

## `docs/features/` — Features, Tech Notes & UI/UX

> **Audience:** PM, Mobile Dev, Backend Dev, Hardware Dev, QA

| Document                                              | Description                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| [auth.md](features/auth.md)                           | JWT, OTP, Register / Login flow + implementation notes           |
| [user-account.md](features/user-account.md)           | Profile, push token management + implementation notes            |
| [device-pairing.md](features/device-pairing.md)       | Device pairing + BLE WiFi provisioning + implementation contract |
| [fall-detection.md](features/fall-detection.md)       | Core pipeline: Sensor → MQTT → Alert → Cancel (15s timeout)      |
| [notifications.md](features/notifications.md)         | Push + Socket + in-app notification logic + Expo Push guide      |
| [realtime.md](features/realtime.md)                   | Socket.io events, rooms, connection flow, payloads               |
| [dashboard.md](features/dashboard.md)                 | หน้า Dashboard หลัก + Full UI/UX specification & screen flows    |
| [elder-profile.md](features/elder-profile.md)         | จัดการข้อมูลผู้สูงอายุ (ดู/แก้ไข)                               |
| [event-history.md](features/event-history.md)         | ประวัติเหตุการณ์ + รายงานสรุปรายเดือน                            |
| [emergency-contact.md](features/emergency-contact.md) | CRUD, priority, reorder emergency contacts                       |
| [admin-panel.md](features/admin-panel.md)             | Admin panel flows + feature scope                                |
| [libraries.md](features/libraries.md)                 | Dependency inventory by module                                   |

---

## `docs/backlog/` — Future Features

> **Audience:** Developer, PM
> ฟีเจอร์ที่วางแผนไว้แต่ยังไม่ได้ implement ในโปรเจคนี้

| Document                                               | Description                                  |
| ------------------------------------------------------ | -------------------------------------------- |
| [multi-user-access.md](backlog/multi-user-access.md)   | เชิญสมาชิกครอบครัวดูแลร่วม (Multi-Caregiver) |
| [account-deletion.md](backlog/account-deletion.md)     | ลบบัญชีผู้ใช้                                |
| [health-data-export.md](backlog/health-data-export.md) | ส่งออกรายงานสุขภาพ PDF/CSV (ประกอบพบแพทย์)   |

---

## `docs/api/` — API Reference

> **Audience:** Backend Dev, Mobile Dev, Admin Dev

| Document                                 | Description                          |
| ---------------------------------------- | ------------------------------------ |
| [api-reference.md](api/api-reference.md) | Complete REST API endpoint reference |

---

## `docs/planning/` — Requirements & Roadmap

> **Audience:** PM, Backend Dev, QA

| Document                                                          | Description                                  |
| ----------------------------------------------------------------- | -------------------------------------------- |
| [functional-requirements.md](planning/functional-requirements.md) | FR for Caregiver & Admin + primary use cases |
| [development-plan.md](planning/development-plan.md)               | Roadmap + milestone tracking                 |

---

## `docs/ops/` — Deployment, Security & Troubleshooting

> **Audience:** DevOps, QA, Project Manager

| Document                                                           | Description                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| [api-verification.md](ops/api-verification.md)                     | Local/API smoke test runbook with Postman collection |
| [cross-platform-development.md](ops/cross-platform-development.md) | Windows/Ubuntu/WSL local development rules           |
| [local-deployment.md](ops/local-deployment.md)                     | Step-by-step local deployment guide                  |

---

## `docs/testing/` — Testing

> **Audience:** QA, Developers

| Document                                                           | Description                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [feature-test-checklist.md](testing/feature-test-checklist.md)     | Feature coverage matrix and release verification checklist         |
| [e2e-critical-path.md](testing/e2e-critical-path.md)               | E2E strategy for fall, pairing, mobile, admin, and hardware flows  |
| [simulator-guide.md](testing/simulator-guide.md)                   | Backend simulator commands for fall, push, and event data          |
| [testing-glossary.md](testing/testing-glossary.md)                 | Testing terminology (Unit / Integration / E2E / UAT / V&V)         |

## Related Documentation (Outside `docs/`)

| Location                                                                                                  | Description                                            |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [firmware/esp32/README.md](../firmware/esp32/README.md)                                                   | ESP32 firmware overview + BLE provisioning             |
| [firmware/esp32/docs/README.md](../firmware/esp32/docs/README.md)                                         | Firmware hardware documentation index                  |
| [firmware/esp32/docs/guides/](../firmware/esp32/docs/guides/)                                             | Firmware runbooks (operation/tuning workflow)          |
| [firmware/esp32/docs/components/](../firmware/esp32/docs/components/)                                     | Device component owner docs (MPU/Pulse/Button/Speaker) |
| [apps/backend-api/docs/api/postman_collection.json](../apps/backend-api/docs/api/postman_collection.json) | Postman collection                                     |
| [AGENTS.md](../AGENTS.md)                                                                                 | AI copilot guide for this project                      |

---

## Document Standard

All documents in this project follow this template:

```markdown
# Title

## Doc Meta

- Audience: ...
- Source of Truth: <link to relevant source code>
- Status: Active / Planned / Historical
- Last Updated: May 21, 2026

## Overview

Short description of scope and purpose.

## [Main Content]

...

## Related Docs

- `Link to related document: ../features/<owner-doc>.md`
```

**File naming:** `kebab-case.md` (e.g., `fall-detection.md`)

**Linking rule:** Always use relative paths so links work in any Markdown viewer.

**Conflict resolution:** If two documents conflict, the owner document wins — fix cross-links accordingly.
