# Technical Glossary

## Doc Meta

- Audience: Hardware Dev, Backend Dev, QA, AI Agents
- Source of Truth: firmware source, backend contract docs, component owner docs
- Status: Active
- Last Updated: May 21, 2026

---

## Fall Detection

| Term | Meaning |
| --- | --- |
| `MPU6050` | IMU ที่มี accelerometer และ gyroscope |
| `SVM` | Signal Vector Magnitude, magnitude รวมของ acceleration |
| `Posture Delta` | การเปลี่ยนมุมร่างกาย/อุปกรณ์รอบช่วง impact |
| `Impact Threshold` | gate แรงกระแทกจาก SVM |
| `Duration Threshold` | gate เวลา/ช่วง stabilization |
| `Posture Threshold` | gate องศา posture change |
| `suspected_fall` | firmware พบเหตุเข้าข่ายล้มเบื้องต้น |
| `fall_confirmed` | ไม่มี cancel ภายในเวลา จึงยืนยันเหตุล้ม |
| `fall_cancelled` | ผู้สวมใส่กด GPIO27 ภายใน cancel window |

---

## Cancel vs Acknowledge

| Term | Actor | Effect |
| --- | --- | --- |
| `Cancel` | ผู้สวมใส่ผ่าน GPIO27 | เปลี่ยนเหตุเป็น `fall_cancelled` / `CANCELLED` |
| `Acknowledge` | caregiver ใน app | รับทราบหรือ reset view ฝั่ง UI ไม่เปลี่ยน DB fall stage |
| `Cancel Timeout` | firmware runtime | `15000 ms` ใน prototype ปัจจุบัน |

---

## Pulse / PPG

| Term | Meaning |
| --- | --- |
| `PPG` | Photoplethysmography, วัดชีพจรจากสัญญาณแสง |
| `BPM` | beats per minute |
| `IBI` | inter-beat interval |
| `Signal Amplitude` | peak-to-trough amplitude ที่ใช้ quality gate |
| `Beat accepted` | beat ที่ผ่าน gate และใช้คำนวณได้ |
| `Beat rejected` | beat ที่ไม่ผ่าน gate เช่น amplitude, IBI, BPM range |
| `Stale Timeout` | เวลาที่ไม่มี beat ใหม่จน firmware reset heart rate |

---

## MQTT / Runtime Topics

| Topic / Term | Meaning |
| --- | --- |
| `device/+/event` | MQTT event หลักของ runtime device flow |
| `device/<serial>/heartrate` | heart rate runtime publish path |
| `device/<serial>/status` | device online/status publish path |
| `device/<serial>/config` | backend ส่ง config ให้ device |
| `device/<serial>/config/ack` | device ตอบรับ config |
| `device/<serial>/lab/imu` | lab IMU topic จาก `sensor_tuning` สำหรับ Fall Detection Sensor Lab |

---

## Fall Detection Sensor Lab Terms

| Term | Meaning |
| --- | --- |
| Basic Activity Collection | เก็บตัวอย่าง IMU activity เพื่อบทที่ 3/5 ไม่ใช่ sensor log collection |
| Trial | 1 activity attempt = 1 CSV |
| `imu_sample` | periodic IMU sample ใน lab flow |
| `imu_impact` | snapshot ตอน impact |
| `imu_decision` | snapshot ตอน decision หลัง posture check |
| `selected_values_table.csv` | ตาราง selected rows จาก `npm run sensor-lab -- summarize` |

ห้ามตีความ Fall Detection Sensor Lab เป็นผลเชิงสถิติปัจจุบัน

---

## Backend Event Terms

| Term | Meaning |
| --- | --- |
| `fallStage` | DB stage เช่น `PENDING_CONFIRMATION`, `CONFIRMED`, `CANCELLED` |
| `cancelledAt` | เวลาที่ device cancel สำเร็จ |
| `fall_detected` | socket event หลัง fall ถูก confirmed |
| `Dedup` | การกัน event ซ้ำจาก MQTT retransmission |
| `Pending Fall Event` | event ล้มที่รอยืนยัน |
| `Confirmed Fall Event` | event ล้มที่ยืนยันแล้ว |

---

## Related Docs

- [SensorTheoryReference.md](SensorTheoryReference.md)
- [ProjectAlignedResearch.md](ProjectAlignedResearch.md)
- [../components/mpu6050.md](../components/mpu6050.md)
- [../components/pulse-sensor.md](../components/pulse-sensor.md)
- [../../../../docs/architecture/iot-mqtt.md](../../../../docs/architecture/iot-mqtt.md)
