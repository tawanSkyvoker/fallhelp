# AI Context Memory

## Doc Meta

- Audience: AI agents, developers maintaining AI context docs
- Source of Truth: `docs/ai/` document set + [../../AGENTS.md](../../AGENTS.md)
- Status: Active
- Last Updated: May 10, 2026

---

## Overview

> Fast boot for agents: start with [AI_QUICKSTART.md](AI_QUICKSTART.md).
> Use this file as the map of the `docs/ai/` set, not as the first detailed instruction file.

โฟลเดอร์นี้ (`/docs/ai/`) ใช้สำหรับเก็บเอกสารข้อมูล Research และ Architecture บริบทต่างๆ ของโปรเจกต์ (System Context) ที่จัดทำขึ้นเพื่อให้ AI Agent ตัวใหม่ หรือ Developer สามารถทำความเข้าใจระบบได้อย่างรวดเร็ว

ชุดเอกสารนี้รองรับ workflow แบบ lean โดยยึด `AGENTS.md` เป็น policy กลาง และให้ adapter ของแต่ละเครื่องมืออ้างกลับมาที่นี่แทนการคัดลอกกติกายาวๆ ซ้ำหลายไฟล์

## Memory Contract

- `AGENTS.md` = policy memory
- `docs/ai/*` = system memory
- `.agent/skills/*` = execution memory
- tool adapters = access layer
- subagents = narrow specialists

หลักการคือ ถ้าข้อความใดมีโอกาส drift แล้วกระทบ correctness ให้เก็บไว้ในชั้น canonical ก่อน แล้วค่อยให้ adapter ของแต่ละ tool ชี้กลับมาใช้

## 📂 โครงสร้างเอกสารปัจจุบัน

- `AI_QUICKSTART.md` - จุดเริ่มต้นแบบเร็วสำหรับ agent: route ต่อไป, validation matrix, invariants สำคัญ
- `AI_MODULE_ROUTER.md` - ใช้เลือก persona ตามโมดูลที่จะทำงาน
- `agent-reference.md` - quick reference สำหรับ structure, commands, hardware, operator mode
- `system_overview.md` - ภาพรวมระบบกว้างๆ, Flow หลัก, Database Schema
- `backend.md` - โครงสร้าง Backend (Express, Prisma, MQTT)
- `mobile.md` - โครงสร้าง Mobile App (Expo, Navigation, BLE, Contexts + stores)
- `admin.md` - โครงสร้าง Admin Web (React 19, Vite, Tailwind)
- `firmware.md` - โครงสร้าง Firmware ESP32 (Fall detection, BLE Provisioning)

## 💡 แนวทางการใช้งาน

1. เริ่มจาก `AI_QUICKSTART.md` เพื่อหาเส้นทางอ่านต่อแบบเร็ว
2. อ่าน `AI_MODULE_ROUTER.md` เพื่อเลือกโมดูลก่อนทุกครั้ง
3. ถ้าต้องการ quick reference ให้เปิด `agent-reference.md`
4. อ่าน `system_overview.md` เมื่อ task แตะมากกว่า 1 โมดูล
5. อ่านเฉพาะไฟล์ context ของโมดูลที่กำลังแก้จริง (`backend.md`, `mobile.md`, `admin.md`, `firmware.md`)
6. เมื่อมีการเปลี่ยนแปลงสถาปัตยกรรม (Architecture), endpoint หลัก, หรือ flow สำคัญ ให้อัปเดตเอกสารเหล่านี้ให้ทันโค้ดเสมอ
7. ถ้าไฟล์ใดใน `docs/ai/` ว่าง หรือยังอ้าง path/flow เก่า ให้ถือว่าเอกสารนั้นยังไม่พร้อมใช้งานและควรอัปเดตก่อนใช้เป็น context หลัก
8. ถ้าใช้เครื่องมือใหม่ เช่น Antigravity ให้ชี้มันกลับมาที่ `AGENTS.md` และ `docs/ai/*` ก่อน โดยไม่สร้าง knowledge tree ใหม่จนกว่าจะยืนยัน format/config ที่ tool รองรับ

---

## Related Docs

- [AI Module Router](AI_MODULE_ROUTER.md)
- [AI Quick Start](AI_QUICKSTART.md)
- [Agent Reference](agent-reference.md)
- [System Overview](system_overview.md)
- [AGENTS.md](../../AGENTS.md)
