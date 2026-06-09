# Sensor Hardware-Only Tuning Guide

## Doc Meta

- Audience: Hardware Dev, QA
- Source of Truth: `firmware/esp32/src/sensor_tuning/`, component owner docs
- Status: Active
- Last Updated: May 18, 2026

---

## Overview

ไฟล์นี้เป็น runbook สำหรับ `sensor_tuning` ใช้จูน MPU6050 หรือ XD-58C โดยลดตัวแปรจาก backend/mobile

ไม่ใช่ runbook ของ `main_firmware` และไม่ใช่ lab manual รายละเอียดของ Fall Detection Sensor Lab

---

## Scope

ใช้ไฟล์นี้เมื่อ:

1. ต้อง calibrate MPU6050
2. ต้องดู SVM, postureDelta, หรือ threshold ใน `sensor_tuning`
3. ต้องดู PPG rest/motion และ reject reason
4. ต้องเตรียมค่าที่จะย้ายกลับไป `main_firmware`

ให้ไป Sensor Lab โดยตรงเมื่อ:

1. ต้องเก็บ 24 trials
2. ต้องใช้ Node-RED Dashboard เป็นหลัก
3. ต้อง validate/summarize/generate chapter exports

---

## Step 1 - Select Sensor Build

เปิด `firmware/esp32/src/sensor_tuning/build_profile.h`

เลือกอย่างใดอย่างหนึ่ง:

```cpp
#define FALLHELP_SINGLE_SENSOR FALLHELP_SINGLE_SENSOR_MPU6050
// หรือ
#define FALLHELP_SINGLE_SENSOR FALLHELP_SINGLE_SENSOR_PULSE
```

กติกา:

1. ห้ามจูน MPU และ Pulse พร้อมกันในรอบเดียว
2. ถ้าจะเปลี่ยน sensor ให้ปิดรอบเดิมก่อน
3. บันทึก build profile ที่ใช้ใน notes ของรอบนั้น

---

## Step 2 - MPU Calibration Path

ใช้เมื่อยังไม่มีค่า `MPU_CAL_*` ที่ตรงกับตำแหน่งติดตั้งปัจจุบัน

1. ตั้ง `SOFTWARE_CALIBRATION_MODE true`
2. Upload `sensor_tuning.ino`
3. สวมอุปกรณ์ตำแหน่งจริง
4. ยืนนิ่งระหว่าง warmup และ sample collection
5. เก็บ 400 samples
6. เลือกรอบที่ magnitude ใกล้ `1.0g` ที่สุด
7. copy ค่า `MPU_CAL_*` ลง `sensor_tuning`
8. เปลี่ยน `SOFTWARE_CALIBRATION_MODE false`
9. copy ค่าเดียวกันไป `main_firmware` เฉพาะเมื่อมีหลักฐานครบ

รายละเอียด sensor ให้ดู [../components/mpu6050.md](../components/mpu6050.md)

---

## Step 3 - Tuning Evidence

เลือก evidence ตามงาน:

| งาน | หลักฐานหลัก | หลักฐานเสริม |
| --- | --- | --- |
| MPU calibration | Serial output ของ `MPU_CAL_*` | notes ของ pose/sample count |
| MPU threshold tuning | Serial log ของ SVM/postureDelta/gate | CSV เฉพาะรอบที่ต้องเทียบเป็นตาราง |
| Pulse rest/motion | Serial log ของ BPM/reject reason | CSV เฉพาะรอบที่ต้องเทียบเป็นตาราง |
| Fall Detection Sensor Lab | Node-RED CSV | Serial log และ session notes |

---

## Step 4 - Run Sensor Workflow

### MPU Tuning

1. ยืนยัน `FALLHELP_SINGLE_SENSOR_MPU6050`
2. ยืนยัน `SOFTWARE_CALIBRATION_MODE false`
3. Upload `sensor_tuning.ino`
4. เปิด Serial Monitor `115200`
5. รัน `info`
6. ดู gate จาก log: SVM, duration, postureDelta
7. ปรับทีละ 1 ค่าเท่านั้น

### Pulse Rest / Motion

1. ยืนยัน `FALLHELP_SINGLE_SENSOR_PULSE`
2. Upload `sensor_tuning.ino`
3. หนีบ ear clip ในตำแหน่งใช้งานจริง
4. เก็บ Rest ก่อน Motion
5. ดู BPM, confidence, amplitude, IBI, และ reject reason
6. ปรับทีละ 1 ค่าเท่านั้น

### Fall Detection Sensor Lab

1. ใช้ workflow ใน [../../fall_detection_sensor_lab/README.md](../../fall_detection_sensor_lab/README.md)
2. เปิด Node-RED Dashboard ที่ `/ui`
3. เก็บ 1 trial = 1 CSV
4. รัน `npm run sensor-lab -- validate`

Fall Detection Sensor Lab เป็น Basic Activity Collection ไม่ใช่ sensor log collection

---

## Step 5 - Move Values Back To main_firmware

ค่อยย้ายค่ากลับไป `main_firmware` เมื่อ:

1. มี log ดิบของรอบล่าสุด
2. รู้ว่าปรับค่าใดเพียงค่าเดียว
3. อธิบายผลก่อน/หลังได้
4. สำหรับ MPU ต้องไม่ทำให้ cancel/confirm flow เปลี่ยนความหมาย
5. สำหรับ Pulse ต้องไม่ทำให้ runtime UI ตีความ heart rate ผิดจาก contract เดิม

`main_firmware` ไม่ใช่พื้นที่ลองค่าระหว่างจูน

---

## Troubleshooting

### MQTT / Node-RED ไม่มา

ใช้เฉพาะงานที่ตั้งใจเก็บผ่าน Node-RED เช่น Fall Detection Sensor Lab

ตรวจ:

1. Node-RED ทำงานอยู่หรือไม่
2. broker/env config ถูกหรือไม่
3. firmware build profile ตรงกับ sensor หรือไม่
4. calibration mode ปิดอยู่หรือไม่

### MPU ไม่ Detect

ตรวจ:

1. อยู่ใน `sensor_tuning` และเลือก MPU build หรือไม่
2. เปิด `mpu on` diagnostic mode ค้างอยู่หรือไม่
3. SVM หรือ postureDelta gate ไหน block อยู่
4. calibration ตรงกับตำแหน่งสวมใส่จริงหรือไม่

### Pulse Reject เยอะ

ตรวจ:

1. ear clip
2. สาย ADC
3. amplitude range
4. motion artifact

---

## Related Docs

- [PracticalOperationGuide.md](PracticalOperationGuide.md)
- [../components/mpu6050.md](../components/mpu6050.md)
- [../components/pulse-sensor.md](../components/pulse-sensor.md)
- [../../fall_detection_sensor_lab/README.md](../../fall_detection_sensor_lab/README.md)
