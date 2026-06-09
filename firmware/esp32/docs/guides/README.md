# ESP32 Guides Index

## Doc Meta

- Audience: Hardware Dev, QA, AI Agents
- Source of Truth: `firmware/esp32/docs/guides/`, `firmware/esp32/docs/components/`
- Status: Active
- Last Updated: May 18, 2026

---

## Overview

`guides/` คือ runbook layer สำหรับลงมือทำงานกับ ESP32 ให้ถูกโหมด

อ่านตามลำดับนี้:

1. เริ่มที่ [PracticalOperationGuide.md](PracticalOperationGuide.md) เพื่อเลือกงานและหลักฐาน
2. ถ้าเป็นระบบเต็ม ให้ไป [Esp32SystemOperationGuide.md](Esp32SystemOperationGuide.md)
3. ถ้าเป็น sensor tuning ให้ไป [SensorHardwareOnlyTuningGuide.md](SensorHardwareOnlyTuningGuide.md)
4. ถ้าต้องรู้รายละเอียดรายอุปกรณ์ ให้เปิด component guide ที่เกี่ยวข้อง

---

## Choose Your Guide

| สถานการณ์ | เอกสารที่ต้องเปิด | ผลลัพธ์ที่ควรได้ |
| --- | --- | --- |
| ยังไม่แน่ใจว่างานนี้คืออะไร | [PracticalOperationGuide.md](PracticalOperationGuide.md) | เลือก firmware, evidence, และ definition of done ได้ |
| เช็ก BLE, WiFi, MQTT, fall flow กับ backend/mobile | [Esp32SystemOperationGuide.md](Esp32SystemOperationGuide.md) | system integration checklist |
| จูน MPU หรือ Pulse โดยลดตัวแปรจาก backend/mobile | [SensorHardwareOnlyTuningGuide.md](SensorHardwareOnlyTuningGuide.md) | hardware-only tuning workflow |
| เก็บข้อมูล Fall Detection Sensor Lab | [../../fall_detection_sensor_lab/README.md](../../fall_detection_sensor_lab/README.md) | lab workflow, protocol, CSV pipeline |

---

## Component Follow-Up

หลังเลือก guide แล้ว ให้เปิด owner doc รายอุปกรณ์เมื่อจำเป็น:

- [../components/mpu6050.md](../components/mpu6050.md)
- [../components/pulse-sensor.md](../components/pulse-sensor.md)
- [../components/cancel-button.md](../components/cancel-button.md)
- [../components/speaker-alert.md](../components/speaker-alert.md)

---

## Boundaries

1. `main_firmware` ใช้สำหรับ system integration และ runtime prototype flow
2. `sensor_tuning` ใช้สำหรับ hardware tuning และ lab collection
3. Fall Detection Sensor Lab เป็น Basic Activity Collection ไม่ใช่ sensor log collection
4. Node-RED CSV เป็นหลักฐานหลักเฉพาะ Sensor Lab หรือรอบที่ตั้งใจเก็บ CSV

---

## Related Docs

- [../README.md](../README.md)
- [../references/README.md](../references/README.md)
- [../../fall_detection_sensor_lab/README.md](../../fall_detection_sensor_lab/README.md)
