# Testing Glossary

## Doc Meta

- Audience: QA, Developers, PM
- Source of Truth: testing strategy, CI/local verification flow, and feature reports generated from the testing workflow
- Status: Active
- Last Updated: May 10, 2026

---

## Overview

เอกสารนี้ใช้เป็น glossary กลางสำหรับคำศัพท์การทดสอบที่ใช้ในโปรเจกต์ FallHelp เพื่อให้ทีมตีความคำว่า Unit, Integration, E2E, UAT, Smoke, Regression, และ V&V ตรงกันก่อนอ่าน test reports หรือสั่ง AI ให้ช่วยประเมิน coverage

---

## Core Terms

| Term | ความหมายใน FallHelp | ตัวอย่างใน repo |
| --- | --- | --- |
| Unit Test | ทดสอบ function, hook, helper, หรือ service แบบแยกส่วนและควบคุม dependency | backend service tests, payload validator tests |
| Integration Test | ทดสอบการทำงานร่วมกันของหลายชั้นใน module เดียวกัน | Express route + service + DB test doubles |
| End-to-End (E2E) | ทดสอบ flow ข้ามหลายระบบตั้งแต่ trigger ถึงผลลัพธ์ปลายทาง | ESP32 -> MQTT -> Backend -> Socket -> Mobile alert |
| Smoke Test | ชุดทดสอบสั้นเพื่อเช็กว่าระบบยัง boot/run ได้หลังเปลี่ยนแปลง | `infra:scan`, build, light tests |
| Regression Test | ทดสอบเพื่อกัน behavior เดิมพังหลัง refactor/fix | auth flow, event history, notification read state |
| UAT | ให้ผู้ใช้หรือ stakeholder ทดลองตาม scenario จริง | caregiver pairing, dashboard monitoring, feedback flow |
| Verification | เช็กว่า implementation ตรง spec หรือ runtime contract | API response shape, payload validation, docs sync กับ code |
| Validation | เช็กว่าสิ่งที่สร้างตอบโจทย์การใช้งานจริงของผู้ใช้ | alert readability, pairing usability, incident handling |

---

## V&V ในบริบทโปรเจกต์นี้

| Term | คำถามที่ใช้ตัดสิน | ตัวอย่าง |
| --- | --- | --- |
| Verification | "เราสร้างระบบตรงตามที่ออกแบบไว้ไหม" | route ตอบ status code ถูก, MQTT payload ผ่าน validator, docs sync กับ code |
| Validation | "สิ่งที่สร้างตอบโจทย์ผู้ใช้จริงไหม" | caregiver เข้าใจ alert flow, hardware setup ทำตาม runbook ได้, UAT ผ่าน |

---

## Recommended Evidence By Scope

| การเปลี่ยนแปลง | หลักฐานขั้นต่ำที่ควรมี |
| --- | --- |
| Docs, config, path updates | `npm run docs:lint`, `npm run infra:scan -- --skip-runtime-checks` |
| Backend logic | typecheck, lint, relevant Jest tests, `infra:scan:strict` |
| Mobile UI หรือ state flow | typecheck, lint/light tests ตาม scope, flow notes ใน owner docs |
| Firmware docs หรือ operator runbook | docs lint + cross-check กับ current firmware path/runbook |

---

## Feature Report Boundary

ถ้าต้องการสรุปผลการทดสอบรายฟีเจอร์ ให้ใช้ template จาก `.agent/skills/testing-expert/references/feature-report-template.md` แยกเป็น feature report ต่างหาก ไม่ควรยัดผลรันเฉพาะรอบลงใน glossary นี้

---

## Related Docs

- [Functional Requirements](../planning/functional-requirements.md)
- [System Design](../architecture/system-design.md)
- [Testing Expert Skill Template](../../.agent/skills/testing-expert/references/feature-report-template.md)
