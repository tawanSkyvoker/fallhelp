# START HERE — Fall Detection Sensor Lab Data-Collection Quickstart

> ไฟล์นี้ใช้สำหรับเก็บข้อมูล **Fall Detection Sensor Lab**
> ไม่ใช่ runbook บังคับของระบบ FallHelp หลัก ถ้าไม่ได้เก็บ dataset ข้ามไฟล์นี้ได้
>
> เอกสารเต็ม: `fall_detection_sensor_lab/README.md` + `trial_protocol.md`

---

## ใช้ไฟล์นี้เพื่ออะไร

ใช้เพื่อ:

- ต้องการเก็บข้อมูลท่าพื้นฐาน (9 activity, 24 trials) สำหรับบันทึกที่ 3 และบันทึกที่ 5
- ต้องการ log จาก `sensor_tuning` เข้า `fall_detection_sensor_lab/runs/`

ไม่จำเป็นเมื่อต้องการ:

- ทดสอบ functional prototype แบบ end-to-end
- สาธิต fall detection / BPM / notification pipeline
- พัฒนา mobile / backend / admin / main firmware ตาม flow ปกติ

---

## ภาพรวม: ทำอะไรก่อน-หลัง

```
Step 1: เตรียมเครื่อง + Node-RED Dashboard (/ui)
Step 2: กดปุ่มท่าใน Dashboard → Countdown 10s → Stop เอง (1 Trial = 1 CSV)
Step 3: validate raw CSV
Step 4: คัด selected → summarize → generate ch.3/ch.5
```

ชุดท่า: standing_still, walking_normal, running_light, sit_normal, sit_hard,
side_fall_left, side_fall_right, forward_fall, backward_fall — รวม 24 trials
(ดูจำนวนต่อท่าใน `trial_protocol.md`)

---

## Step 1 — เตรียมเครื่องก่อนเริ่มทุกครั้ง

### 1.1 ตั้งค่า firmware

เปิด `sensor_tuning/build_profile.h`:

```cpp
#define FALLHELP_SINGLE_SENSOR FALLHELP_SINGLE_SENSOR_MPU6050
```

Upload firmware → เปิด Serial Monitor (115200 baud)

### 1.2 ตรวจสอบก่อนเริ่มเสมอ

```
info          ← เช็ก WiFi และ MQTT เชื่อมต่อได้
profile       ← ยืนยัน cancel timeout = 15000ms
fall config   ← จด threshold ปัจจุบัน
sensor status ← เช็กว่า MPU6050 พร้อม
```

### 1.3 เปิด Node-RED Dashboard (เปิดค้างไว้ตลอด session)

```bash
npm run sensor-lab -- node-red up
```

ถ้าต้องเปิดแบบ host fallback สำหรับ developer:

```bash
npm install
node scripts/iot/node-red-launch.mjs
```

เปิด `http://localhost:1880`, source flow อยู่ที่
`fall_detection_sensor_lab/node-red/flows/fall-detection-sensor-lab-flow.v2.json`
แล้วเปิด Dashboard ที่ `http://localhost:1880/ui` (workflow หลักคือ Dashboard
ไม่มี manual inject แล้ว)

> ตั้ง broker credential ใน Node-RED editor/env (`MQTT_USERNAME`/`MQTT_PASSWORD`) — ไม่ commit ลง flow JSON
> `mosquitto_sub` ดูสดได้ แต่ไม่ใช้แทนไฟล์หลัก

### 1.4 ติด ESP32 คล้องคอ

- ตำแหน่งกลางคอ สายรัดไม่หลวมไม่แน่นเกิน ตำแหน่งเดิมทุก trial
- ไม่ให้ห้อยแกว่งอิสระ
- ท่าล้มต้องทำบนเบาะ/ฟูก เคลียร์พื้นที่ ≥ 2×2 เมตร

---

## Step 2 — เก็บข้อมูลทีละ Trial

ใช้ Dashboard ที่ `/ui` เป็น workflow เดียว (ผู้ทดลองคนเดียว กดน้อยสุด)
ต่อ 1 Trial = 1 ท่า = 1 CSV:

1. กรอก **Session ID** ใน Dashboard เช่น `S01` (ตั้งครั้งเดียวต่อรอบ)
2. กดปุ่มท่าที่จะเก็บ (1 ใน 9 ปุ่ม) — `activityLabel`, `expectedType`, `trialId`
   ถูกตั้งอัตโนมัติ (อย่าเดา activity — กดปุ่มที่ตรงท่าที่ทำจริง)
3. รอ **Countdown 10 วินาที** (เดินไปตำแหน่งทดสอบ/เตรียมตัวบนเบาะ)
4. Countdown จบ → สถานะ "Recording: action" → ทำท่า → ค้าง 3–5 วินาที
5. กด **Stop Trial** เอง (manual, ไม่มี auto-stop)
6. ตรวจว่าไฟล์ `Sxx_Txx_activity.csv` ถูกสร้างใน `fall_detection_sensor_lab/runs/Sxx/raw/`
   และ Dashboard เลื่อน Next Trial อัตโนมัติ
7. จด `note` ถ้ามีเหตุผิดปกติ; ถ่ายภาพท่าทดสอบสำหรับบทที่ 5
8. ทำครบ 24 trials ตาม `trial_protocol.md`

> raw CSV อาจมี movement ช่วงลุก/เดินกลับมากด Stop — ยอมรับได้ scripts คัด
> เฉพาะค่าช่วง event หลัก (impact/peak + imu_decision) ดู `selection_guide.md`

หลังจบ session: กรอก `runs/Sxx/session_notes.md` และ `notes.md` ทันที

---

## Step 3 — Validate raw CSV

```bash
npm run sensor-lab -- validate
```

ตรวจ required columns / metadata / มี `imu_decision` row — print PASS/FAIL ต่อไฟล์
ไฟล์ FAIL: ดูสาเหตุ แก้/เก็บซ้ำก่อนนำไปคัด

---

## Step 4 — คัด selected และสร้าง export

1. คัด trial ตัวแทนเข้า `runs/Sxx/selected/` ตามเกณฑ์ใน `selection_guide.md`
2. รวมเป็นตาราง:

```bash
npm run sensor-lab -- summarize
```

3. สร้าง markdown บทที่ 3 / บทที่ 5:

```bash
npm run sensor-lab -- chapters
```

ผลอยู่ใน `fall_detection_sensor_lab/exports/`

> example/export = format สำหรับจัดวางข้อมูลเท่านั้น ห้าม claim ผลจริงจนกว่าจะมี CSV จริงจากการเก็บ log

---

## Quick Reference — คำสั่งที่ใช้บ่อย

| คำสั่ง                    | ใช้เมื่อ                 |
| ------------------------- | ------------------------ |
| `info`                    | เช็กสถานะรวม             |
| `fall config`             | ดู threshold ปัจจุบัน    |
| `sensor status`           | เช็ก MPU6050 พร้อม       |
| `mpu test`                | เปิด/ปิดโหมดทดสอบ        |
| `sim fall`                | ทดสอบ flow โดยไม่ล้มจริง |
| `npm run sensor-lab -- validate` | ตรวจ raw CSV             |
| `npm run sensor-lab -- all`    | validate+summarize+chapters |

---

## ลำดับไฟล์เอกสาร (ถ้าต้องการอ่านเพิ่มเติม)

| ต้องการอะไร            | เปิดไฟล์นี้                                              |
| ---------------------- | -------------------------------------------------------- |
| workflow + กฎเก็บข้อมูล | `fall_detection_sensor_lab/README.md`                    |
| ขั้นตอน session/trial   | `fall_detection_sensor_lab/trial_protocol.md`                  |
| ความหมาย column CSV     | `fall_detection_sensor_lab/csv_schema.md`                    |
| เกณฑ์คัด selected       | `fall_detection_sensor_lab/selection_guide.md`           |
| นำไปใช้บทที่ 3/5        | `fall_detection_sensor_lab/chapter_usage.md`             |
| วิธีล้มแต่ละท่าละเอียด | `docs/components/FallDetectionGuide.md` → Section 6.3    |
| แก้ปัญหา MQTT/sensor    | `docs/guides/Esp32SystemOperationGuide.md` → Section 7   |
