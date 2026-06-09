# Fall Detection System

## Doc Meta

- Audience: Hardware/Backend/Mobile Dev, QA
- Source of Truth: [main_firmware/](../../firmware/esp32/src/main_firmware/), [fallHandler.ts](../../apps/backend-api/src/iot/handlers/fallHandler.ts), [eventService.ts](../../apps/backend-api/src/services/eventService.ts)
- Status: Active
- Last Updated: May 30, 2026

---

## Overview

ระบบตรวจจับการหกล้ม (Fall Detection) คือฟีเจอร์หลัก (Core Feature) ของ FallHelp ทำงานโดยการอ่านค่าจาก Sensor บนอุปกรณ์ ESP32 และส่งข้อมูลไปยัง Server เพื่อแจ้งเตือนผู้ดูแล

---

## 1. Hardware Detection (Edge)

อุปกรณ์ ESP32 ใช้ MPU6050 (Accelerometer + Gyroscope) ในการตรวจจับ

- **Algorithm:** Threshold-based (วัดความแรงจาก SVM + การเปลี่ยนมุมจาก Complementary Filter)
- **Logic:**
  1. หากความแรง SVM (Signal Vector Magnitude) > Threshold High (เช่น 2.0g) → **Possible Fall (Impact Spike)**
  2. รอตรวจสอบให้ผู้ใช้นิ่ง (Stabilization Window ประมาณ 1.5 วินาที)
  3. ตรวจสอบการเปลี่ยนมุม (Posture Delta) ที่คำนวณจากวงจร Complementary Filter
  4. หากองศาการเอียงเข้าข่ายท่านอนราบ (> 45 องศา) → ส่ง MQTT msg

### MQTT Payload (`device/{id}/event`)

Fields ที่ firmware ส่งจริง (`publishFallLifecycleEvent` ใน `MPU6050_Sensor.ino`):

```json
{
  "type": "suspected_fall",
  "timestamp": 123456789,
  "magnitude": 2.15,
  "postureDelta": 45.2
}
```

> - Firmware ส่งเฉพาะ processed evidence ที่ backend ใช้จริง: `magnitude` และ `postureDelta`
> - Backend เก็บลง DB เป็น field ตรงใน event ได้แก่ `fallStage`, `magnitude`, `postureDelta`
> - Backend ใช้ **Server Time** เป็น `timestamp` ที่ persist จริง แม้ payload จะมี `timestamp` มาด้วย

---

## 2. Backend Processing

Source: `apps/backend-api/src/iot/handlers/fallHandler.ts`

### Deduplication

เพื่อป้องกันการส่งซ้ำ (Network Jitter / Retries) ระบบจะเช็ค:

- **Suspected Fall:** 15 วินาที
- **Confirmed Fall:** 30 วินาที
- ค่านี้ไม่ใช่ cancel timeout 15 วินาที และใช้คนละวัตถุประสงค์กัน

### Event States

ระบบหลักปัจจุบันใช้ 2-stage lifecycle:

1. **Suspected:** อุปกรณ์ส่ง `suspected_fall` มาก่อน → Backend สร้าง Event พร้อม `fallStage=PENDING_CONFIRMATION`
2. **Confirmed:** ถ้าไม่ถูกยกเลิก → อุปกรณ์ส่ง `fall_confirmed` → Backend อัปเดต event เดิมเป็น `fallStage=CONFIRMED` และส่ง push notification

> กรณีไม่มี pending event เดิม backend ยังมี fallback ให้สร้าง confirmed event ใหม่ได้ เพื่อรองรับ compatibility กับ firmware/flow เก่า

### Lifecycle Rule

สำหรับเอกสารและ logic ของโปรเจกต์นี้ ให้ถือว่า `fallStage` คือ source of truth ของสถานะการล้ม

- `PENDING_CONFIRMATION` = ยังอยู่ในช่วงรอยืนยัน
- `CONFIRMED` = ยืนยันการล้มแล้ว
- `CANCELLED` = ผู้สวมใส่กดยกเลิกจากปุ่มที่อุปกรณ์แล้ว

field อื่นใช้ประกอบดังนี้:

- `cancelledAt` = เวลาเกิดการยกเลิกจริง
- `magnitude`, `postureDelta` = evidence ของการตรวจจับ

### Cancel Window (Firmware Constant)

- ค่าที่ใช้ใน `main_firmware`: `15000 ms` จาก `FallDetectionConfig.ino`
- เป็นกติกาฝั่ง firmware/business flow ไม่ถูก persist ลง event row แล้ว

---

## 3. False Alarm Cancellation (ยกเลิก False Alarm)

> **นิยามตายตัว:**
>
> - **Cancel** = เฉพาะผู้สวมใส่**กดปุ่มที่อุปกรณ์ (GPIO27)** ภายใน 15 วินาทีเท่านั้น → เปลี่ยน `cancelledAt` ใน DB จริง
> - **Acknowledge (ในแอป)** = ผู้ดูแลรับทราบเหตุการณ์แล้ว → **คืนเฉพาะมุมมองหน้าจอแอปเป็นปกติ** ไม่เปลี่ยนผลเหตุการณ์ใน DB

ระบบมี **2 เส้นทาง** หลังเกิด `suspected_fall`:

### Flow A: ผู้สวมใส่ยันยันว่าไม่ได้ล้ม — Cancel (กดปุ่มบนอุปกรณ์ภายใน 15 วิ)

1. ผู้สวมใส่กดปุ่มยกเลิก (GPIO27) ภายใน 15 วินาที
2. เสียงเตือนหยุดทันที — อุปกรณ์ส่ง MQTT ไป topic `device/{serial}/event` พร้อม payload `type = "fall_cancelled"`
3. Backend (`fallCancelledHandler.ts`): ค้นหา Event ล่าสุดที่ยังเป็น `PENDING_CONFIRMATION` → อัปเดต `cancelledAt` และ `fallStage = CANCELLED`
4. Backend ส่ง `event_status_changed/FALL_CANCELLED` ให้ mobile clear pending guard แต่ไม่มี Push Notification เพราะเป็น lifecycle ที่จบก่อนยืนยัน

ถ้า `fall_cancelled` มาถึงช้าหลัง event ถูกเปลี่ยนเป็น `CONFIRMED` แล้ว backend ต้อง ignore เพื่อป้องกันการย้อนสถานะหลังส่ง Socket/Push ไปแล้ว

### Flow B: ไม่ได้กดปุ่ม → ระบบยืนยันการล้ม → ผู้ดูแล Acknowledge ในแอป

1. ครบ 15 วินาที → อุปกรณ์ส่ง `fall_confirmed` → Backend อัปเดต `fallStage = CONFIRMED` → ส่ง Push Notification + Socket (`fall_detected` และ `event_status_changed/FALL_CONFIRMED`)
2. **สถานะ FALL ค้างบนแอป** จนกว่าผู้ดูแลกด "รับทราบแล้ว" เอง
3. ผู้ดูแลกด Acknowledge (`รับทราบแล้ว`) → คืนเฉพาะมุมมองแอปเป็นปกติ (ปิด Alert overlay) — **`cancelledAt` ใน DB ไม่ถูกเปลี่ยน**

> ⚠️ **Push notification ที่ส่งไปแล้วจะไม่ถูก retract** ไม่ว่าผู้ดูแลจะ Acknowledge หรือไม่ การรับทราบอัปเดตเฉพาะสถานะในแอปเท่านั้น

---

## 4. Mobile Alert Handling

Source: `apps/mobile/hooks/useSocketConnection.ts` + `apps/mobile/store/useFallAlertStore.ts`

### Realtime Fall Lifecycle (Current)

Mobile เปลี่ยน fall alert state หลักจาก Socket `fall_detected` เท่านั้น ซึ่งหมายถึงเหตุล้มถูกยืนยันแล้ว
`suspected_fall` และ `fall_cancelled` ส่งเป็น `event_status_changed` เพื่อจัดการ pending guard ภายใน แต่ไม่แสดง caregiver alert และไม่สร้าง Push Notification

เมื่อได้รับสถานะ `FALL`:

- **Foreground:** เด้ง Full-screen Alert (Overlay) พร้อมเสียงไซเรน
- **Background:** แสดง Push Notification → กดแล้วเปิดมาหน้า Alert
- **Action:**
- **Acknowledge:** รับทราบ — ปิด Alert overlay บนแอปเท่านั้น **ไม่เปลี่ยน `cancelledAt` ใน DB**
  - **Call:** โทรหาผู้สูงอายุ/เบอร์ฉุกเฉิน
  - **Navigate:** ดูตำแหน่ง (Map)

---

## 5. Heart Rate at Fall Time

BPM ณ ขณะหกล้มถูกเก็บใน `Event.bpm` (Int?) ของ `FALL` event โดยตรง
กล่าวอีกแบบคือ backend เก็บเป็น fall event เดียวกัน แต่แนบข้อมูลชีพจรขณะเกิดเหตุเข้ามาด้วยเมื่อ sensor อ่านได้ทัน

- `bpm != null` → มีข้อมูลชีพจรจากอุปกรณ์ขณะหกล้ม
- `bpm == null` → ไม่มีข้อมูลชีพจร (sensor ไม่พร้อม หรือ firmware เก่า)
- Threshold: Low < 60 BPM, Normal 60–100 BPM, High > 100 BPM
- Monthly report แสดง HR distribution (high/normal/low/unknown) จาก FALL events เท่านั้น
- ไม่มี standalone HR notification อีกต่อไป

---

## Edge Cases

- **Device Offline:** ถ้าอุปกรณ์พังตอนล้ม → ไม่มี event (ตรวจสอบ online/offline จาก `lastOnline`; ใช้ `wifiStatus` เพื่ออธิบายสถานะ WiFi/provisioning)
- **Single-Caregiver Model:** ปัจจุบัน 1 User ↔ 1 Elder ดังนั้น flow แจ้งเตือนจะส่งหาเจ้าของ elder เพียงคนเดียว
- **Internet Loss:** ถ้าอุปกรณ์ต่อเน็ตไม่ได้ จะพยายามส่งซ้ำ (Retain msg หรือส่งเมื่อต่อติด)

---

## Related Docs

- [IoT MQTT Architecture](../architecture/iot-mqtt.md)
- [Data Model](../architecture/data-model.md)
- [Firmware AI Context](../ai/firmware.md)
- [Notification System](notifications.md)
