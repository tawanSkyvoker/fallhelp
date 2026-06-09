# ESP32 System Operation Guide

## Doc Meta

- Audience: Hardware Dev, Backend Dev, QA
- Source of Truth: `firmware/esp32/src/main_firmware/`, backend MQTT/runtime contracts
- Status: Active
- Last Updated: May 30, 2026

---

## Overview

ไฟล์นี้เป็น runbook สำหรับตรวจ `main_firmware` แบบระบบเต็ม ตั้งแต่ boot, BLE provisioning, WiFi, MQTT, sensor readiness, ไปจนถึง fall flow

ใช้ไฟล์นี้เมื่อ:

1. ทำงานกับ `main_firmware`
2. ต้องพิสูจน์ว่า device เชื่อมกับ mobile/backend ได้
3. ต้องยืนยัน flow `suspected_fall -> fall_cancelled / fall_confirmed`

ไม่ใช้ไฟล์นี้เป็นคู่มือ Fall Detection Sensor Lab หรือ sensor tuning

---

## System Scope

`main_firmware` ครอบคลุม:

1. BLE provisioning เมื่อยังไม่มี WiFi config
2. WiFi และ MQTT runtime connection
3. MPU6050 fall detection
4. XD-58C heart rate monitoring
5. GPIO27 cancel button
6. GPIO25 speaker alert sound

Runtime code is split across the `main_firmware/` folder:

| File | Runtime responsibility |
| ---- | ---------------------- |
| `main_firmware.ino` | Boot orchestration, shared state, Serial CLI |
| `BLEProvisioning.ino` | BLE GATT server, WiFi credential characteristics, mobile status notify |
| `WiFiConnectionManager.ino` | WiFi connect/retry, NVS credential persistence, pending config rollback |
| `DeviceMqttClient.ino` | MQTT transport setup, backend command handling, status/config ACK publish |

---

## Step 1 - Boot And Runtime Check

1. Upload `firmware/esp32/src/main_firmware/main_firmware.ino` (Arduino IDE will compile all `.ino` files in the folder together)
2. เปิด Serial Monitor `115200`
3. รัน `info`
4. ตรวจค่า fall cancel timeout ใน output ของ `info`

ควรเห็น:

1. board boot สำเร็จ
2. sensor initialize ผ่าน
3. cancel timeout = `15000 ms`
4. WiFi provisioning attempts = `40`

---

## Step 2 - BLE Provisioning Path

ใช้เมื่อ device ยังไม่มี WiFi config ใน NVS:

1. device เข้า BLE advertising/provisioning mode
2. mobile app scan เจอ ESP32 service
3. mobile เขียน SSID/password
4. device ออกจาก BLE provisioning แล้วเริ่ม WiFi connect

ถ้า device มี WiFi config อยู่แล้ว ต้องข้าม BLE provisioning และเริ่ม WiFi/MQTT auto-connect

---

## Step 3 - WiFi And MQTT Check

เลือก MQTT profile ใน `firmware/esp32/src/main_firmware/mqtt_secrets.h` ก่อน upload:

1. HiveMQ Cloud: `HIVEMQ_PORT 8883`, `FALLHELP_MQTT_USE_TLS 1`, ใส่ username/password
2. Local Mosquitto: `HIVEMQ_PORT 1883`, `FALLHELP_MQTT_USE_TLS 0`, no-auth ให้ตั้ง username/password เป็น `""`

1. ยืนยันว่าได้ IP address
2. ยืนยันว่า MQTT broker connect สำเร็จ
3. ถ้าใช้ local tooling ให้เปิด MQTT monitor
4. ยืนยันว่า status/heartbeat ออกตามรอบ

ถ้า MQTT ไม่ขึ้น ให้ตรวจ:

1. broker host/port
2. TLS setting
3. username/password หรือ local no-auth profile
4. network route ระหว่าง device กับ broker

อย่า commit real credentials ลง source หรือ docs

---

## Step 4 - Sensor Readiness

ตรวจ sensor ตาม owner docs:

| Component | Owner doc | สิ่งที่ต้องเห็น |
| --- | --- | --- |
| MPU6050 | [../components/mpu6050.md](../components/mpu6050.md) | init ผ่าน, ไม่อยู่ใน `mpu on` diagnostic mode ระหว่าง fall test |
| XD-58C | [../components/pulse-sensor.md](../components/pulse-sensor.md) | raw/heart rate ไม่ค้างผิดปกติ |
| Cancel button | [../components/cancel-button.md](../components/cancel-button.md) | GPIO27 พร้อมใช้งาน |
| Speaker | [../components/speaker-alert.md](../components/speaker-alert.md) | AlertSystem init และ output ไม่ค้างเสียง |

---

## Step 5 - Fall Flow Check

ลำดับที่ต้องพิสูจน์:

```text
suspected_fall
  -> local alert sound starts
  -> user cancels via GPIO27 within 15s -> fall_cancelled
  OR
  -> timeout without cancel -> fall_confirmed
```

กติกาที่ต้องรักษา:

1. `Cancel` เป็น device-only action ผ่าน GPIO27
2. caregiver app ทำได้แค่ acknowledge/reset view
3. push notification ที่ส่งไปแล้วไม่ถูก retract
4. `fall_cancelled` ต้องมาจาก device button flow เท่านั้น

---

## Serial Commands

| คำสั่ง | ใช้ทำอะไร |
| --- | --- |
| `info` | ดู runtime, WiFi, MQTT, cancel timeout, และ WiFi provisioning attempts |
| `sensor status` | เช็ก sensor manager ถ้า firmware build รองรับ |
| `fall config` | ดูค่า fall detection ปัจจุบัน |
| `sim fall` | จำลอง fall flow เพื่อเช็ก alert/cancel |
| `speaker` / `speaker status` | ทดสอบ speaker output ถ้า firmware build รองรับ |
| `reset_nvs` | ล้าง WiFi/MQTT config แล้ว reboot |
| `reboot` | reboot board |

---

## Pass / Fail Criteria

ผ่านเมื่อ:

1. boot สม่ำเสมอ
2. BLE provisioning ใช้ได้เมื่อไม่มี WiFi config
3. WiFi + MQTT connect ได้จริง
4. sensor readiness ผ่าน
5. fall flow ครบทั้ง cancel และ confirm

ยังไม่ผ่านเมื่อ:

1. BLE ค้างหรือ provisioning ไม่สำเร็จ
2. WiFi สำเร็จแต่ MQTT ไม่ขึ้น
3. `suspected_fall` เกิดแต่ speaker/cancel ไม่สัมพันธ์
4. กด GPIO27 แล้วไม่เกิด `fall_cancelled`
5. timeout แล้วไม่เกิด `fall_confirmed`

---

## Evidence To Collect

1. Serial log ของ boot และ `info`
2. Serial/MQTT log ของ WiFi + MQTT connect
3. Serial log ของ fall flow
4. backend/mobile observation เฉพาะ system integration

ไม่ต้องใช้ Fall Detection Sensor Lab CSV เพื่อพิสูจน์ `main_firmware`

---

## Related Docs

- [PracticalOperationGuide.md](PracticalOperationGuide.md)
- [../components/mpu6050.md](../components/mpu6050.md)
- [../components/pulse-sensor.md](../components/pulse-sensor.md)
- [../components/cancel-button.md](../components/cancel-button.md)
- [../components/speaker-alert.md](../components/speaker-alert.md)
