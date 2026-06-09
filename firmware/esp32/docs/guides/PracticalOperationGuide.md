# Practical Operation Guide

## Doc Meta

- Audience: Hardware Dev, QA, PM
- Source of Truth: `firmware/esp32/src/`, `firmware/esp32/docs/`
- Status: Active
- Last Updated: May 30, 2026

---

## Overview

ไฟล์นี้เป็น dispatcher กลางก่อนเริ่มงาน ESP32 ใช้เพื่อเลือก firmware, หลักฐาน, และ definition of done ให้ตรงกับงาน

---

## Step 1 - Choose One Work Mode

เลือกได้หนึ่งอย่างต่อรอบ:

| Work mode                 | Firmware / module              | ใช้เมื่อ                                               |
| ------------------------- | ------------------------------ | ------------------------------------------------------ |
| System Integration        | `main_firmware`                | ต้องพิสูจน์ BLE, WiFi, MQTT, fall flow, backend/mobile |
| MPU Calibration / Tuning  | `sensor_tuning`                | ต้องดู calibration, SVM, postureDelta, threshold       |
| Pulse Rest / Motion       | `sensor_tuning`                | ต้องดู PPG signal, BPM, reject reason                  |
| Fall Detection Sensor Lab | `sensor_tuning` + Node-RED lab | ต้องเก็บ IMU trial เป็น CSV                            |

กติกา:

1. 1 รอบ = 1 เป้าหมาย
2. 1 รอบ = ปรับได้ 1 ค่า
3. ห้ามผสม system integration, sensor tuning, และ Sensor Lab ใน session เดียวกัน

---

## Step 2 - Select Firmware

| งาน                       | ไฟล์หลัก                                             |
| ------------------------- | ---------------------------------------------------- |
| System Integration        | `firmware/esp32/src/main_firmware/main_firmware.ino` plus sibling `.ino` modules |
| Sensor tuning             | `firmware/esp32/src/sensor_tuning/sensor_tuning.ino` |
| Fall Detection Sensor Lab | `firmware/esp32/fall_detection_sensor_lab/`          |

For System Integration, keep responsibilities separated: `BLEProvisioning.ino` handles BLE status/credentials, `WiFiConnectionManager.ino` handles WiFi/NVS/pending rollback, and `DeviceMqttClient.ino` handles MQTT commands and publishes.

ถ้าใช้ `sensor_tuning`:

1. เปิด `firmware/esp32/src/sensor_tuning/build_profile.h`
2. เลือก `FALLHELP_SINGLE_SENSOR_MPU6050` หรือ `FALLHELP_SINGLE_SENSOR_PULSE`
3. ตรวจ build profile ก่อน compile ทุกครั้ง

---

## Step 3 - Pre-Flight Checklist

ต้องผ่านก่อนเริ่มรอบ:

1. Upload firmware ถูกตัว
2. เปิด Serial Monitor `115200`
3. รัน `info`
4. รัน `profile` ถ้า firmware รองรับ
5. ถ้าเป็น MPU ให้วาง/สวมอุปกรณ์นิ่ง 3-5 วินาทีหลัง boot
6. ถ้าใช้ Local Mosquitto service ให้รัน `npm run mqtt:check` ก่อน flash/provision เพื่อยืนยันว่า Mosquitto running และ ESP32 จะต่อ host LAN IP ที่ port `1883` ได้
7. ถ้าเป็น Fall Detection Sensor Lab ให้เปิด Node-RED ตาม [../../fall_detection_sensor_lab/README.md](../../fall_detection_sensor_lab/README.md)
8. เตรียมไฟล์ notes/log ให้ตรงกับงาน

---

## Step 4 - Choose Evidence

| Work mode                 | หลักฐานหลัก                         | หลักฐานเสริม                      |
| ------------------------- | ----------------------------------- | --------------------------------- |
| System Integration        | Serial + backend/mobile observation | MQTT monitor                      |
| MPU Calibration / Tuning  | Serial log                          | CSV เฉพาะรอบที่ต้องเทียบเป็นตาราง |
| Pulse Rest / Motion       | Serial log                          | CSV เฉพาะรอบที่ต้องเทียบเป็นตาราง |
| Fall Detection Sensor Lab | Node-RED CSV                        | Serial log, session notes         |

Node-RED CSV ไม่ใช่ default ของทุกงาน ใช้เป็นหลักฐานหลักเฉพาะ Fall Detection Sensor Lab

---

## Step 5 - Run The Right Guide

| Work mode                 | Guide                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| System Integration        | [Esp32SystemOperationGuide.md](Esp32SystemOperationGuide.md)                                                                          |
| MPU Calibration / Tuning  | [SensorHardwareOnlyTuningGuide.md](SensorHardwareOnlyTuningGuide.md) + [../components/mpu6050.md](../components/mpu6050.md)           |
| Pulse Rest / Motion       | [SensorHardwareOnlyTuningGuide.md](SensorHardwareOnlyTuningGuide.md) + [../components/pulse-sensor.md](../components/pulse-sensor.md) |
| Fall Detection Sensor Lab | [../../fall_detection_sensor_lab/README.md](../../fall_detection_sensor_lab/README.md)                                                |

---

## Step 6 - Close The Round

ก่อนปิดรอบ ต้องตอบได้:

1. รอบนี้ใช้ firmware/module อะไร
2. รอบนี้ปรับค่าอะไร หรือไม่ได้ปรับค่า
3. หลักฐานหลักอยู่ที่ไหน
4. ผลดีขึ้น แย่ลง หรือยังสรุปไม่ได้ เพราะอะไร
5. รอบถัดไปควรคงค่าเดิมหรือปรับ 1 ค่าไหน

---

## Definition Of Done

ถือว่าปิดรอบได้เมื่อ:

1. log หรือ CSV เปิดอ่านได้จริง
2. notes บอกเงื่อนไขรอบนั้นครบ
3. ไม่มีการปรับหลายค่าพร้อมกันแบบย้อนวิเคราะห์ไม่ได้
4. ถ้าแตะระบบเต็ม ต้องไม่ทำให้ cancel/confirm flow เปลี่ยนความหมาย

---

## Related Docs

- [Esp32SystemOperationGuide.md](Esp32SystemOperationGuide.md)
- [SensorHardwareOnlyTuningGuide.md](SensorHardwareOnlyTuningGuide.md)
- [../components/mpu6050.md](../components/mpu6050.md)
- [../components/pulse-sensor.md](../components/pulse-sensor.md)
- [../../fall_detection_sensor_lab/README.md](../../fall_detection_sensor_lab/README.md)
