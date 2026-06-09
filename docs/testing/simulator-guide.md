# Simulator Guide

## Doc Meta

- Audience: Developer, QA
- Source of Truth: `apps/backend-api/scripts/sim-*.ts`
- Status: Active
- Last Updated: May 10, 2026

---

## Overview

FallHelp มี simulator scripts สำหรับทดสอบ fall pipeline แบบ manual โดยไม่ต้องรอสัญญาณจากอุปกรณ์จริง
ทุก script อยู่ใน `apps/backend-api/scripts/` และรันผ่าน npm scripts ของ `apps/backend-api`

---

## เลือก Script ไหน?

```
ต้องการทดสอบอะไร?
│
├─ หน้า Monthly Report / Event History (ข้อมูลย้อนหลังหลายวัน)
│    └─→ sim:events
│
├─ Push Notification + หน้าแจ้งเตือน (ทดสอบเร็ว ไม่ต้องรอ)
│    └─→ sim:push
│
└─ Full 2-stage pipeline พร้อม cancel window จริง
     ├─ ไม่มีอุปกรณ์ / ไม่ต้องการให้อุปกรณ์ตื่น
     │    └─→ sim:fall  (default)
     └─ มีอุปกรณ์ online และต้องการทดสอบ firmware จริง
          └─→ sim:fall --hardware
```

---

## sim:events — Seed ข้อมูลย้อนหลัง

**ไฟล์:** `scripts/sim-events.ts`

สร้าง FALL events กระจายในเดือนปัจจุบัน (เวลาไทย UTC+7) สำหรับทดสอบ Monthly Report และ Event History

### ต้องการ

| สิ่งที่ต้องรัน | จำเป็น |
|---|---|
| Database (PostgreSQL) | ✅ |
| Backend server | ❌ |
| MQTT broker | ❌ |
| อุปกรณ์ ESP32 | ❌ |

### Commands

```bash
# seed 10 events (6 CRITICAL + 4 WARNING)
npm run sim:events

# ล้างข้อมูลทดสอบทั้งหมดในเดือนปัจจุบัน
npm run sim:events -- --clear
```

### Events ที่สร้าง

| ประเภท | Severity | จำนวน | วัตถุประสงค์ |
|---|---|---|---|
| FALL + ชีพจรสูง (>100 BPM) | CRITICAL | 3 | ทดสอบ HR badge สีแดง |
| FALL + ชีพจรปกติ (60–100) | CRITICAL | 2 | ทดสอบ HR badge สีเขียว |
| FALL + ชีพจรต่ำ (<60) | CRITICAL | 1 | ทดสอบ HR badge สีน้ำเงิน |
| FALL (suspected) | WARNING | 4 | ทดสอบ peak hour (02:xx น.) |

> **หมายเหตุ:** WARNING events จะไม่แสดงในหน้า Event History (ถูก filter ออก) แต่ใช้ทดสอบ peak hour ใน Monthly Report

---

## sim:push — Push Notification (Bypass Hardware)

**ไฟล์:** `scripts/sim-push.ts`

สร้าง FALL CRITICAL event ตรงเข้า DB แล้วยิง Push Notification ทันที ไม่ผ่าน MQTT หรือ 2-stage flow

### ต้องการ

| สิ่งที่ต้องรัน | จำเป็น |
|---|---|
| Database (PostgreSQL) | ✅ |
| Backend server | ❌ |
| MQTT broker | ❌ |
| อุปกรณ์ ESP32 | ❌ |

### Commands

```bash
# สร้าง FALL event + ส่ง Push (BPM สุ่ม 85–124)
npm run sim:push

# กำหนด BPM เอง
npm run sim:push -- --bpm 120
```

---

## sim:fall — Full 2-Stage Pipeline

**ไฟล์:** `scripts/sim-fall.ts`

จำลอง fall pipeline แบบครบวงจรพร้อม cancel window รองรับ 2 โหมด

---

### โหมด 1: No-Hardware (default)

ส่ง MQTT events ตรงไปหา broker แทน ESP32 โดย script จำลอง 2-stage เอง

**topic ที่ใช้:** `device/{serialNumber}/event` — เป็น topic ที่ ESP32 *publish* ไม่ใช่ subscribe
ดังนั้นแม้อุปกรณ์จริงต่ออยู่และมีแบต **อุปกรณ์จะไม่ตื่นหรือทำงานใดๆ**

#### ต้องการ

| สิ่งที่ต้องรัน | จำเป็น |
|---|---|
| Database (PostgreSQL) | ✅ |
| Backend server | ✅ |
| MQTT broker | ✅ |
| อุปกรณ์ ESP32 | ❌ (ต่ออยู่ก็ไม่กระทบ) |

#### Commands

```bash
# รัน pipeline พร้อม cancel window 15s (เหมือนจริง)
npm run sim:fall

# เร่งเวลา — cancel window 3s (สำหรับ dev)
npm run sim:fall -- --fast

# กำหนด cancel window เอง (หน่วย: วินาที)
npm run sim:fall -- --timeout 8

# จำลองการกดยกเลิก (Cancel mode) - ส่ง fall_cancelled แทน confirmed
npm run sim:fall -- --cancel

# ระบุ serialNumber เอง (ข้าม DB query)
npm run sim:fall -- --serial ESP32-XXXXXXXXXXXX
```

#### Flow

```
script
  │
  ├─ [1/2] publish suspected_fall ──→ broker ──→ backend fallHandler
  │                                              └─ สร้าง PENDING_CONFIRMATION event
  │                                              └─ emit event_status_changed / FALL_SUSPECTED
  │                                              └─ no caregiver alert / push
  │
  ├─ ⏱  รอ cancel window (15s / --fast 3s / --timeout N)
  │
  └─ [2/2] publish fall_confirmed ──→ broker ──→ backend fallHandler
                                                 └─ อัปเดตเป็น CRITICAL event
                                                 └─ สร้าง Notification record
                                                 └─ ส่ง Push Notification
                                                 └─ emit fall_detected + event_status_changed / FALL_CONFIRMED
                                                 
  *(ถ้ารันด้วย --cancel)*
  └─ [2/2] publish fall_cancelled ──→ broker ──→ backend fallCancelledHandler
                                                 └─ อัปเดต Event เป็น CANCELLED
                                                 └─ emit event_status_changed / FALL_CANCELLED
                                                 └─ ❌ ไม่ส่ง Push Notification
```

---

### โหมด 2: Hardware (`--hardware`)

ส่ง `{ cmd: "sim_fall" }` ไปยัง ESP32 แล้วให้ firmware จัดการ 2-stage pipeline เอง

**topic ที่ใช้:** `device/{serialNumber}/cmd` — ESP32 subscribe อยู่ → firmware ตื่นและทำงานจริง

#### ต้องการ

| สิ่งที่ต้องรัน | จำเป็น |
|---|---|
| Database (PostgreSQL) | ✅ |
| Backend server | ✅ |
| MQTT broker | ✅ |
| อุปกรณ์ ESP32 | ✅ (ต้อง online) |

#### Commands

```bash
npm run sim:fall -- --hardware

# ระบุ serial เอง
npm run sim:fall -- --hardware --serial ESP32-XXXXXXXXXXXX
```

---

## เปรียบเทียบสรุป

| | sim:events | sim:push | sim:fall | sim:fall --hardware |
|---|---|---|---|---|
| ต้องการ backend server | ❌ | ❌ | ✅ | ✅ |
| ต้องการ MQTT broker | ❌ | ❌ | ✅ | ✅ |
| ต้องการ ESP32 online | ❌ | ❌ | ❌ | ✅ |
| อุปกรณ์ต่ออยู่จะตื่นไหม | ❌ | ❌ | ❌ | ✅ |
| ผ่าน fallHandler จริง | ❌ | ❌ | ✅ | ✅ |
| Socket lifecycle emit ทำงาน | ❌ | ❌ | ✅ | ✅ |
| Push Notification | ❌ | ✅ | ✅ | ✅ |
| มี cancel window จริง | ❌ | ❌ | ✅ | ✅ |
| เหมาะกับ | Monthly Report / History | Push / Notification UI | Pipeline + Socket + Push | End-to-end จริง |

---

## รัน script จาก root (ทางเลือก)

```bash
# sim:fall เท่านั้นที่ expose ไว้ที่ root
npm run iot:sim-fall               # = sim:fall (no-hardware)
npm run iot:sim-fall -- --hardware # = sim:fall --hardware
```

---

## Related

- [Testing Glossary](./testing-glossary.md)
- [Feature Test Checklist](./feature-test-checklist.md)
- [E2E Critical Path Strategy](./e2e-critical-path.md)
- Script source: `apps/backend-api/scripts/sim-*.ts`
