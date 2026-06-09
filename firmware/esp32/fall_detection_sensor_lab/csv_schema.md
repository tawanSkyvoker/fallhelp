# CSV Schema

เอกสารนี้อธิบายความหมายของ column ที่ใช้ในไฟล์ CSV จาก Node-RED

## Metadata

| Column | ความหมาย | ตัวอย่าง |
|---|---|---|
| `session_id` | รหัสชุดการเก็บข้อมูล | `S01` |
| `trial_id` | รหัสรอบทดลอง | `T01` |
| `activity_label` | ท่าที่ทำจริง | `side_fall_left` |
| `expected_type` | ประเภทของท่า | `fall` |
| `timestamp_ms` | เวลาในอุปกรณ์ (millis uptime) | `123456` |
| `note` | หมายเหตุ | `fall on mattress` |

## Sensor Raw Data

| Column | ความหมาย | หน่วย |
|---|---|---|
| `ax_g` | ความเร่งแกน X | g |
| `ay_g` | ความเร่งแกน Y | g |
| `az_g` | ความเร่งแกน Z | g |
| `gx_dps` | ความเร็วเชิงมุมแกน X | deg/s |
| `gy_dps` | ความเร็วเชิงมุมแกน Y | deg/s |
| `gz_dps` | ความเร็วเชิงมุมแกน Z | deg/s |

## Impact Data

| Column | ความหมาย | ใช้ทำอะไร |
|---|---|---|
| `svm_raw_g` | ค่า SVM ก่อนกรอง | ดูแรงกระแทกดิบ |
| `svm_filtered_g` | ค่า SVM หลังกรอง | ใช้เทียบ impact threshold |
| `impact_threshold_g` | ค่าเกณฑ์แรงกระแทก | ใช้ตัดสิน impact |

## Posture Data

| Column | ความหมาย | ใช้ทำอะไร |
|---|---|---|
| `pitch_deg` | มุม Pitch ปัจจุบัน | ดูท่าทาง |
| `roll_deg` | มุม Roll ปัจจุบัน | ดูท่าทาง |
| `pitch_before_deg` | Pitch ก่อน/ขณะ impact | คำนวณ delta |
| `roll_before_deg` | Roll ก่อน/ขณะ impact | คำนวณ delta |
| `pitch_after_deg` | Pitch หลังรอ stabilization | คำนวณ delta |
| `roll_after_deg` | Roll หลังรอ stabilization | คำนวณ delta |
| `pitch_delta_deg` | การเปลี่ยน Pitch | ใช้หา postureDelta |
| `roll_delta_deg` | การเปลี่ยน Roll | ใช้หา postureDelta |
| `posture_delta_deg` | ค่าการเปลี่ยนท่าทางสูงสุด | ใช้เทียบ posture threshold |
| `posture_threshold_deg` | ค่าเกณฑ์ท่าทาง | ใช้ตัดสิน posture |

## Decision Data

| Column | ความหมาย | ตัวอย่าง |
|---|---|---|
| `type` | ประเภท log | `imu_sample`, `imu_impact`, `imu_decision` |
| `state` | สถานะของ fall detection | `IDLE`, `POSTURE_CHECK` |
| `decision` | ผลที่ระบบตัดสิน | `sample`, `pending`, `suspected_fall`, `ignored` |
| `stabilize_ms` | เวลารอให้ท่าทางนิ่ง | `1500` |

> `imu_sample` = snapshot เป็นระยะจาก `sensor_tuning` (ทุก ~300ms) ให้ท่า non-fall
> ที่ไม่เกิด impact ยังมีข้อมูล sensor. ท่า non-fall อาจมีแต่ `imu_sample`
> ไม่มี `imu_decision` ได้ — ถือว่าถูกต้อง

## Number Formatting

ปัดทศนิยมเฉพาะ Sensor Lab path (sensor_tuning lab payload + Dashboard +
summarize/export scripts) ไม่กระทบ main_firmware / production payload / DB schema
คงค่าเป็นตัวเลข (number)

| Field | ทศนิยม |
|---|---|
| `ax_g`, `ay_g`, `az_g` | 3 |
| `gx_dps`, `gy_dps`, `gz_dps` | 2 |
| `svm_raw_g`, `svm_filtered_g` | 3 |
| `magnitude_g` (export `selected_values_table.csv`) | 2 |
| `pitch_deg`, `roll_deg`, `pitch_before_deg`, `roll_before_deg`, `pitch_after_deg`, `roll_after_deg`, `pitch_delta_deg`, `roll_delta_deg`, `posture_delta_deg` | 2 |
| `impact_threshold_g`, `posture_threshold_deg` | 2 |
| `timestamp_ms`, `stabilize_ms` | integer |
