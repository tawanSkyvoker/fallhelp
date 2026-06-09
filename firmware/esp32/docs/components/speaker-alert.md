# Grove - Speaker Alert Guide

## Doc Meta

- Audience: Hardware Dev, QA
- Source of Truth: `firmware/esp32/src/main_firmware/AlertSystem.ino`, `firmware/esp32/src/sensor_tuning/AlertSystem.ino`
- Status: Active
- Last Updated: May 18, 2026

---

## Overview

Speaker output ใช้แจ้งเตือนผู้สวมใส่เมื่อ firmware เข้าสู่ fall alert flow และต้องหยุดตรงจังหวะเมื่อ cancel หรือ reset state สำเร็จ

เอกสารนี้ใช้คำว่า `speaker`, `alert sound`, หรือ `device sound behavior` ตาม terminology ของ repo

---

## Scope

ไฟล์นี้ครอบคลุม:

1. ข้อเท็จจริงของ speaker output
2. ความต่างระหว่าง `main_firmware` และ `sensor_tuning`
3. device sound behavior ที่ต้องรักษา
4. checklist สำหรับทดสอบเสียงเตือน

ไฟล์นี้ไม่ครอบคลุม:

1. การเปลี่ยน fall detection threshold
2. การเปลี่ยน cancel timeout
3. การเพิ่มเสียงใน Node-RED Dashboard หรือ mobile app
4. การเปลี่ยน payload หรือ alert flow

---

## Hardware Facts

| รายการ | ค่า |
| --- | --- |
| Component | Grove - Speaker |
| Output pin | `GPIO25` |
| Firmware API | `AlertSystem` |
| Output type | PWM tone ผ่าน speaker |
| Boot safety | บังคับ output LOW / duty 0 ตอนเริ่มต้น |

Variant-specific values:

| Firmware | Fall tone | Repeat interval | Default speaker state |
| --- | --- | --- | --- |
| `main_firmware` | `1800 Hz` | `800 ms` | enabled |
| `sensor_tuning` | `800 Hz` | `1500 ms` | controlled by tuning build/profile |

ค่าข้างต้นมาจาก source ปัจจุบัน ไม่ควรสรุปเป็นค่าเดียวร่วมกันทั้งสอง firmware

---

## Firmware Ownership

| Firmware | บทบาทของ speaker |
| --- | --- |
| `main_firmware` | alert sound ของ prototype runtime flow |
| `sensor_tuning` | ใช้เปิด/ปิดเสียงระหว่าง hardware tuning และ simulation |

`sensor_tuning` มีคำสั่ง runtime สำหรับเปิด/ปิด speaker output ระหว่างทดสอบ เพื่อเลี่ยงเสียงรบกวนในรอบจูนที่ไม่ต้องใช้เสียง

---

## Runtime Behavior

### Fall Alert

```text
suspected_fall
  -> AlertSystem starts alert sound
  -> speaker repeats pattern while alert state is active
```

### Cancel

```text
GPIO27 cancel within timeout
  -> fall_cancelled
  -> AlertSystem stops speaker output
  -> output returns LOW / duty 0
```

### Confirm / Reset

เมื่อ firmware จบ alert state หรือ reset pending fall state แล้ว speaker ต้องไม่ค้างเสียงต่อ

ข้อควรระวัง:

1. Speaker เป็น local device feedback ไม่ใช่ backend notification
2. ไม่มี dashboard audio ใน Fall Detection Sensor Lab
3. การเปลี่ยนเสียงต้องไม่เปลี่ยน fall detection decision หรือ MQTT payload

---

## Test Checklist

### Basic Output Check

1. Upload firmware variant ที่ต้องการทดสอบ
2. เปิด Serial Monitor `115200`
3. ยืนยันว่า speaker init สำเร็จ
4. ถ้าเป็น `sensor_tuning` และเสียงถูกปิด ให้เปิดด้วยคำสั่ง `speaker` หรือคำสั่งที่ firmware แสดงใน help

### Fall Alert Sound Check

1. รัน `sim fall`
2. ยืนยันว่า alert sound เริ่มเมื่อเข้า fall alert state
3. ยืนยันว่า pattern เล่นซ้ำตาม firmware variant ที่ใช้

### Stop Sound Check

1. ระหว่าง alert sound ให้กด cancel ภายใน 15 วินาที
2. ยืนยันว่าเสียงหยุดทันทีเมื่อ cancel สำเร็จ
3. ทดสอบอีกครั้งโดยปล่อยให้ timeout แล้วตรวจว่าเสียงไม่ค้างหลัง state reset

---

## Evidence To Collect

| งาน | หลักฐาน |
| --- | --- |
| Init | Serial log ที่ระบุ speaker/AlertSystem พร้อมใช้งาน |
| Start alert | Serial log + observation ว่าเสียงเริ่มเมื่อ `suspected_fall` |
| Stop on cancel | Serial log + observation ว่าเสียงหยุดเมื่อ `fall_cancelled` |
| No stuck output | observation หลัง reset state ว่า GPIO25 ไม่ค้างเสียง |

ไม่ต้องใช้ Node-RED CSV เพื่อพิสูจน์ speaker behavior ยกเว้นรอบนั้นเป็น Sensor Lab ที่ต้องเก็บข้อมูลแยกอยู่แล้ว

---

## Troubleshooting

### ไม่มีเสียง

ตรวจ:

1. Speaker ต่อกับ `GPIO25` ถูกต้องหรือไม่
2. firmware variant เปิด speaker output อยู่หรือไม่
3. อยู่ใน alert state จริงหรือไม่
4. PWM attach สำเร็จหรือไม่
5. ภาคจ่ายไฟพอสำหรับ speaker หรือไม่

### เสียงไม่หยุด

ตรวจ:

1. cancel flow ทำงานจริงหรือไม่
2. `AlertSystem` ได้รับคำสั่ง stop หรือ reset state หรือไม่
3. PWM ถูก set กลับเป็น tone 0 / duty 0 หรือไม่
4. simulation หรือ alert state ยัง active อยู่หรือไม่

### เสียงผิด pattern หรือผิดความถี่

ตรวจ:

1. กำลังทดสอบ `main_firmware` หรือ `sensor_tuning`
2. ใช้ค่าความถี่ของ firmware variant นั้น ไม่ใช้ค่าของอีก variant
3. มีการแก้ `AlertSystem.ino` โดยไม่ได้ sync docs/tests หรือไม่

### เสียงดังตอน boot

ตรวจ:

1. GPIO25 ถูกบังคับ LOW ตอน setup หรือไม่
2. PWM duty เริ่มต้นเป็น 0 หรือไม่
3. สาย speaker หรือ module มี floating input หรือไม่

---

## Related Docs

- [../guides/Esp32SystemOperationGuide.md](../guides/Esp32SystemOperationGuide.md)
- [../guides/PracticalOperationGuide.md](../guides/PracticalOperationGuide.md)
- [cancel-button.md](cancel-button.md)
- [mpu6050.md](mpu6050.md)
