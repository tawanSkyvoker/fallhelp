# False Alarm Cancel Button Guide

## Doc Meta

- Audience: Hardware Dev, Backend Dev, QA
- Source of Truth: `firmware/esp32/src/main_firmware/FalseAlarmCancelButton.ino`, `firmware/esp32/src/sensor_tuning/FalseAlarmCancelButton.ino`, `FallDetectionConfig.ino`
- Status: Active
- Last Updated: May 30, 2026

---

## Overview

ปุ่ม cancel มีหน้าที่เดียว: ให้ผู้สวมใส่ยกเลิก `suspected_fall` ภายใน cancel window ของอุปกรณ์

เอกสารนี้เป็น owner doc ของปุ่ม GPIO27 ไม่ใช่เอกสาร backend, mobile UI, หรือ Sensor Lab

---

## Scope

ไฟล์นี้ครอบคลุม:

1. ข้อเท็จจริงของปุ่มและ pin
2. กติกา cancel vs acknowledge
3. runtime behavior ของปุ่มใน fall flow
4. checklist สำหรับทดสอบปุ่มและหลักฐานที่ควรเก็บ

ไฟล์นี้ไม่ครอบคลุม:

1. การเปลี่ยน cancel timeout
2. การแก้ payload หรือ DB schema
3. การทำให้ caregiver app เป็นผู้ cancel เหตุล้ม
4. การวิเคราะห์ Fall Detection Sensor Lab CSV

---

## Hardware Facts

| รายการ | ค่า |
| --- | --- |
| Component | Large Push Button Module |
| Pin | `GPIO27` |
| Input mode | `INPUT_PULLUP` |
| Press logic | กด = `LOW`, ปล่อย = `HIGH` |
| Debounce | `50 ms` |
| Cancel window | `15000 ms` |

`GPIO27` ต้องต่อให้ปุ่มกดลง GND ได้จริง เพราะ firmware ใช้ pull-up ภายใน

---

## Firmware Ownership

| Firmware | หน้าที่ของปุ่ม |
| --- | --- |
| `main_firmware` | ใช้ใน flow ระบบหลัก: `suspected_fall -> fall_cancelled / fall_confirmed` |
| `sensor_tuning` | ใช้ทดสอบ fall flow ฝั่ง MPU และ simulation โดยไม่พึ่ง backend/mobile เต็มระบบ |

ค่าที่ต้องไม่เปลี่ยนโดยไม่ทำ cross-stack review:

1. `GPIO27`
2. `50 ms` debounce
3. `15000 ms` cancel timeout
4. ความหมายของ `fall_cancelled`

---

## Runtime Behavior

ลำดับการทำงาน:

```text
suspected_fall
  -> เปิด cancel window 15 วินาที
  -> ผู้สวมใส่กด GPIO27 ทันเวลา
  -> local alert sound หยุด
  -> firmware publish fall_cancelled ถ้า MQTT พร้อม
  -> reset pending fall state
```

ถ้ากดหลัง cancel window:

```text
suspected_fall
  -> cancel window หมดเวลา
  -> fall_confirmed
  -> การกดปุ่มหลังจากนั้นไม่ใช่ fall_cancelled ของเหตุนี้
```

กติกาธุรกิจ:

1. `Cancel` มาจากผู้สวมใส่ผ่านปุ่ม GPIO27 เท่านั้น
2. caregiver app ทำได้แค่ acknowledge/reset view ฝั่ง UI
3. cancel ไม่ retract push notification ที่ส่งไปแล้ว
4. `fall_cancelled`, `fallStage = CANCELLED`, และ `cancelledAt` ต้องมาจาก device button flow เท่านั้น

---

## Test Checklist

### Basic Hardware Check

1. Upload firmware ที่รองรับ fall flow
2. เปิด Serial Monitor `115200`
3. รัน `info`
4. ยืนยันว่า cancel button พร้อมใช้งาน และ timeout คือ `15000 ms`

### Cancel-In-Window Check

1. เริ่ม simulated fall ด้วย `sim fall`
2. รอให้เข้า `suspected_fall`
3. กดปุ่ม GPIO27 ภายใน 15 วินาที
4. ยืนยันว่า local alert sound หยุด
5. ถ้า MQTT พร้อม ให้ยืนยันว่ามี `fall_cancelled`

### Timeout Check

1. เริ่ม simulated fall ด้วย `sim fall`
2. ไม่กดปุ่มจนเกิน 15 วินาที
3. ยืนยันว่า flow ไป `fall_confirmed`
4. กดปุ่มหลัง timeout แล้วต้องไม่เปลี่ยนเหตุเดิมกลับเป็น cancel

---

## Evidence To Collect

| งาน | หลักฐาน |
| --- | --- |
| Hardware check | Serial log ที่แสดงปุ่มพร้อมใช้งาน |
| Cancel-in-window | Serial log ลำดับ `suspected_fall -> fall_cancelled` |
| Backend path | MQTT/backend monitor ที่เห็น `fall_cancelled` |
| Timeout path | Serial log ลำดับ `suspected_fall -> fall_confirmed` |

ถ้าเป็น system integration ให้เก็บ observation จาก backend/mobile เพิ่มด้วย แต่ไม่ต้องใช้ Node-RED Sensor Lab CSV

---

## Troubleshooting

### กดแล้วไม่มีผล

ตรวจ:

1. ปุ่มต่อกับ `GPIO27` และ GND ถูกต้องหรือไม่
2. อยู่ในสถานะ `suspected_fall` จริงหรือไม่
3. กดภายใน 15 วินาทีหรือไม่
4. firmware ที่ upload รองรับ fall flow หรือไม่

### กดครั้งเดียวแต่ระบบนับหลายครั้ง

ตรวจ:

1. สภาพปุ่มและสายสัญญาณ
2. debounce ยังเป็น `50 ms` หรือไม่
3. มี noise หรือสายหลวมที่ทำให้ state กระพริบหรือไม่

### Local Cancel ได้ แต่ Backend ไม่เห็น

ตรวจ:

1. MQTT connected อยู่หรือไม่
2. topic publish path ของ firmware ทำงานหรือไม่
3. backend MQTT consumer online อยู่หรือไม่
4. log ฝั่ง backend มี validation error หรือไม่

### Timeout ไม่ตรง 15 วินาที

ตรวจ:

1. `getFallCancelTimeoutMs()` ใน firmware variant ที่ใช้
2. มีการแก้ cancel timeout โดยไม่ได้ sync docs/tests หรือไม่

---

## Related Docs

- [../guides/Esp32SystemOperationGuide.md](../guides/Esp32SystemOperationGuide.md)
- [../guides/PracticalOperationGuide.md](../guides/PracticalOperationGuide.md)
- [mpu6050.md](mpu6050.md)
- [speaker-alert.md](speaker-alert.md)
