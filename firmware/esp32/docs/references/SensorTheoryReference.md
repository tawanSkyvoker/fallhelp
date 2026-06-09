# Sensor Theory Reference

## Doc Meta

- Audience: Dev, QA, Stakeholder, ผู้วิจัย
- Source of Truth: firmware source, component owner docs, curated references
- Status: Active
- Last Updated: May 18, 2026

---

## Overview

ไฟล์นี้อธิบายหลักการของ IMU fall detection และ PPG signal processing ใน FallHelp

ไฟล์นี้ไม่ใช่ runbook และไม่ใช่ที่ประกาศผลรอบทดลองปัจจุบัน

---

## Firmware Values vs Research Values

แยกความหมายให้ชัด:

| ประเภทค่า | ความหมาย |
| --- | --- |
| Firmware value | ค่าที่ source code ใช้อยู่จริง |
| Research/reference value | ค่าจากวรรณกรรมหรือ baseline เชิงทฤษฎี |
| Tuning candidate | ค่าที่เสนอทดลองในรอบ tuning |
| Full-study result | ผลสรุปจาก dataset/protocol เต็ม ซึ่งยังไม่ใช่ scope ของ Fall Detection Sensor Lab |

ค่าที่ใช้จริงต้องอ้าง firmware source ก่อนเสมอ

---

## MPU6050 Fall Detection Concepts

SVM:

```text
SVM = sqrt(ax^2 + ay^2 + az^2)
```

ใช้วัด magnitude ของแรงลัพธ์จาก accelerometer

Posture change:

```text
postureDelta = angle difference around impact window
```

ใช้แยกกิจกรรมแรงแต่ไม่ล้มออกจาก posture change ที่เข้าข่ายล้ม

Fall detection ใน firmware เป็น threshold-based hybrid approach:

```text
impact magnitude gate
  + duration/stabilization gate
  + postureDelta gate
  -> suspected_fall
  -> cancel/confirm layer
```

ค่า prototype ปัจจุบันใน owner docs:

| ค่า | ความหมาย |
| --- | --- |
| `2.0g` | default impact threshold |
| `1500 ms` | default duration/stabilization threshold |
| `45 deg` | default posture threshold |
| `15000 ms` | cancel window |

---

## Complementary Filter

FallHelp ใช้ complementary filter เพื่อรวม accelerometer และ gyroscope สำหรับ pitch/roll

แนวคิด:

1. Gyroscope ตอบสนองเร็ว แต่ drift ได้
2. Accelerometer อ้าง gravity ได้ แต่ถูกรบกวนเมื่อมีแรงกระแทก
3. complementary filter ผสมสองแหล่งข้อมูลเพื่อให้ angle stable ขึ้น

สูตรในแนวคิด:

```cpp
pitch = 0.98f * (pitch + gyroX * dt) + 0.02f * accelPitch;
roll = 0.98f * (roll + gyroY * dt) + 0.02f * accelRoll;
```

ให้ดู source จริงก่อนอ้างรายละเอียด implementation:

1. `firmware/esp32/src/main_firmware/MPU6050_Sensor.ino`
2. `firmware/esp32/src/sensor_tuning/MPU6050_Sensor.ino`

---

## PPG Concepts

PPG วัดชีพจรจากการเปลี่ยนแปลงของแสงที่สัมพันธ์กับ blood volume

ข้อจำกัดหลัก:

1. motion artifact
2. contact pressure ของ ear clip
3. ambient light / sensor placement
4. perfusion ที่ตำแหน่งวัด

Firmware จึงใช้ guardrails เช่น:

| ค่า | ใช้ทำอะไร |
| --- | --- |
| `PULSE_THRESHOLD_10BIT` | threshold waveform |
| `VALID_BPM_MIN` / max | ตัด BPM ที่ไม่สมเหตุสมผล |
| `SIGNAL_AMP_MIN/MAX` | quality gate จาก amplitude |
| `HEART_RATE_STALE_TIMEOUT_MS` | reset เมื่อไม่มี beat ใหม่ |

Pulse data ใช้เพื่อ monitoring ไม่ใช่ medical diagnosis

---

## Noise Reduction Principles

1. จูนทีละ 1 ค่า
2. แยก MPU, Pulse, และ system integration เป็นคนละรอบ
3. เก็บ raw log ก่อน summary
4. เทียบผลกับรอบที่เงื่อนไขใกล้กัน
5. อย่าถือว่าผลใน lab เท่ากับผลใน real-world

---

## Interpretation Boundaries

1. Fall Detection Sensor Lab เป็น Basic Activity Collection เฉพาะ IMU
2. ไม่สรุปผลเชิงสถิติเป็นผลปัจจุบัน
3. งานเชิงปริมาณของ Pulse เป็น future work แยกจาก Fall Detection Sensor Lab
4. FallHelp เป็น monitoring system ไม่ใช่ medical diagnostic device

---

## Related Docs

- [ProjectAlignedResearch.md](ProjectAlignedResearch.md)
- [TechnicalGlossary.md](TechnicalGlossary.md)
- [../components/mpu6050.md](../components/mpu6050.md)
- [../components/pulse-sensor.md](../components/pulse-sensor.md)
- [../guides/SensorHardwareOnlyTuningGuide.md](../guides/SensorHardwareOnlyTuningGuide.md)
