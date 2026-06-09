# การนำข้อมูลไปใช้ในบทที่ 3 และบทที่ 5

เอกสารนี้อธิบายว่าข้อมูลจาก Lab จะถูกนำไปใช้ในเล่มอย่างไร

## ภาพรวม

| บท | ใช้ข้อมูลเพื่อ |
|---|---|
| บทที่ 3 | อธิบายหลักการคำนวณและการตัดสินของระบบ |
| บทที่ 5 | แสดงผลการทดสอบจากท่าจำลองและกิจกรรมพื้นฐาน |

## ใช้กับบทที่ 3

| ข้อมูล | ใช้เขียนเรื่อง |
|---|---|
| `ax_g`, `ay_g`, `az_g` | ที่มาของ `magnitude` |
| `svm_filtered_g` | ค่าแรงกระแทกที่ใช้ตัดสิน impact |
| `impact_threshold_g` | เกณฑ์ตรวจจับแรงกระแทก |
| `pitch_before_deg`, `roll_before_deg` | ท่าทางก่อนเกิดเหตุ |
| `pitch_after_deg`, `roll_after_deg` | ท่าทางหลังเกิดเหตุ |
| `posture_delta_deg` | ที่มาของ `postureDelta` |
| `posture_threshold_deg` | เกณฑ์ตรวจจับการเปลี่ยนท่าทาง |
| `decision` | ผลการตัดสินของระบบ |

## รูปแบบการเขียนบทที่ 3

```text
อ่านค่า ax, ay, az
→ คำนวณ magnitude
→ เทียบ impact threshold
→ อ่าน Pitch/Roll ก่อนและหลังเหตุการณ์
→ คำนวณ postureDelta
→ เทียบ posture threshold
→ สรุป decision
```

## ใช้กับบทที่ 5

| ข้อมูล | ใช้เขียนเรื่อง |
|---|---|
| `activity_label` | แสดงว่าทดสอบท่าใด |
| `expected_type` | ระบุประเภทของท่า |
| `magnitude_g` | แสดงค่าแรงกระแทก (peak) จาก `selected_values_table.csv` |
| `posture_delta_deg` | แสดงการเปลี่ยนท่าทาง |
| `decision` | แสดงผลที่ระบบตัดสิน |
| ภาพท่าทดสอบ | ใช้ประกอบผลการทดสอบ |

## ตารางผลบทที่ 5

| Trial | ท่าพื้นฐานที่ทดสอบ | ประเภท | Magnitude | Posture Delta | ผลที่ระบบตรวจจับ | สรุป |
|---|---|---|---|---|---|---|
| T01 | ยืนนิ่ง | ไม่ล้ม | - | - | - | - |
| T02 | วิ่งเบา ๆ | ไม่ล้ม | - | - | - | - |
| T03 | นั่งลงแรง | ไม่ล้ม | - | - | - | - |
| T04 | ล้มด้านซ้าย | ล้ม | - | - | - | - |

## Mapping ตารางบทที่ 5

| คอลัมน์ | มาจาก |
|---|---|
| Trial | `trial_id` |
| ท่าพื้นฐานที่ทดสอบ | `activity_label` แปลงเป็นภาษาไทย |
| ประเภท | `expected_type` แปลงเป็นภาษาไทย |
| Magnitude | `magnitude_g` จาก `selected_values_table.csv` |
| Posture Delta | `posture_delta_deg` (จาก row `imu_decision`) |
| ผลที่ระบบตรวจจับ | `decision` แปลงเป็นภาษาไทย |
| สรุป | AI Agent สรุปจากค่า Log |

`magnitude_g` สร้างโดย `scripts/summarize_selected.mjs` ไม่ใช่ `svm_filtered_g` ดิบ:

- raw multi-row log: ใช้ peak `svm_filtered_g` ของ row `imu_impact` ก่อน
  (ถ้าไม่มี impact ใช้ peak `svm_filtered_g` ทุก row ใน trial)
- non-fall sample-only log: ใช้ peak `svm_filtered_g` ภายใน trial
- `posture_delta_deg` / `decision` มาจาก row `imu_decision`
- ไม่ใช้ค่า late post-action (ช่วงลุก/เดินกลับมากด Stop) เป็นค่าหลัก

## Decision Translation

| decision | แสดงในเล่ม |
|---|---|
| `ignored` | ไม่พบการล้ม |
| `suspected_fall` | ตรวจพบการล้ม |
| `fall_confirmed` | ยืนยันการล้ม |
| `fall_cancelled` | ยกเลิกการแจ้งเตือน |
