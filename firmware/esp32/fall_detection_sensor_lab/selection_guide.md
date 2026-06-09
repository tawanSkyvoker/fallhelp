# Selection Guide สำหรับ AI Agent

เอกสารนี้ใช้กำหนดวิธีให้ AI Agent คัดข้อมูลจาก `runs/Sxx/raw/` ไปยัง `runs/Sxx/selected/`

## เป้าหมาย

| ใช้กับ | ต้องการข้อมูลแบบไหน |
|---|---|
| บทที่ 3 | ตัวอย่างที่อธิบายการคำนวณได้ชัด |
| บทที่ 5 | ตัวอย่างผลทดสอบแต่ละท่า |

## Input

| แหล่งข้อมูล | รายละเอียด |
|---|---|
| `runs/Sxx/raw/*.csv` | CSV ดิบจาก Node-RED |
| `runs/Sxx/session_notes.md` | หมายเหตุของ session |
| `notes.md` | ปัญหารวมของ Lab |

## Output

| Output | รายละเอียด |
|---|---|
| `runs/Sxx/selected/*.csv` | CSV ที่เลือกแล้ว |
| `exports/selected_values_table.csv` | ตารางรวมค่าที่ใช้ในบทที่ 5 |
| `exports/examples_for_fall_detection_sensor_lab.md` | ตัวอย่างคำนวณสำหรับบทที่ 3 |
| `exports/examples_for_chapter_5.md` | ตารางผลสำหรับบทที่ 5 |

## เกณฑ์คัดเลือก Trial

| เกณฑ์ | เงื่อนไข |
|---|---|
| ท่าตรง | `activity_label` ตรงกับท่าที่ทำจริง |
| ข้อมูลครบ | มีข้อมูล impact และ decision |
| ค่าอ่านง่าย | มี `svm_filtered_g` และ `posture_delta_deg` ชัดเจน |
| ใช้เขียนได้ | อธิบายเหตุผลการตัดสินได้ |
| ไม่มีปัญหารุนแรง | ไม่มี note ว่า MQTT หลุดหรืออุปกรณ์หลุด |

## Trial ที่ควรเลือก

| ประเภท | ควรเลือกอย่างน้อย |
|---|---:|
| Fall case | 2–3 ตัวอย่าง |
| Non-fall case | 2–3 ตัวอย่าง |
| False-alarm candidate | 1–2 ตัวอย่าง |
| Running case | 1 ตัวอย่าง |
| Normal activity | 1 ตัวอย่าง |

## ตัวอย่างการคัด

| Activity | เลือกเมื่อ |
|---|---|
| `side_fall_left` | มี impact สูง, postureDelta สูง, decision เป็น `suspected_fall` |
| `forward_fall` | pitchDelta หรือ postureDelta สูงชัดเจน |
| `sit_hard` | magnitude สูง แต่ postureDelta ต่ำกว่า threshold |
| `running_light` | magnitude แกว่ง แต่ decision ไม่ใช่ fall |
| `standing_still` | ค่า magnitude ใกล้ baseline และไม่มี fall event |

## กฎเลือกค่าจาก raw → selected (สำคัญ)

raw CSV รอบนี้ใช้ Manual Stop จึงมีหลาย row ต่อ trial (`imu_sample` ระหว่างทาง,
`imu_impact`, `imu_decision`) และอาจมี movement ช่วงลุก/เดินกลับมากด Stop
**ห้ามใช้ค่า late post-action เป็นค่าหลักของบทที่ 5**

| Field | กฎเลือกค่า |
|---|---|
| `magnitude_g` | ใช้ `svm_filtered_g` จาก row `imu_impact` (ถ้าหลาย row ใช้ค่าสูงสุด); ถ้าไม่มี impact ใช้ peak `svm_filtered_g` ใน trial |
| `posture_delta_deg` | ใช้จาก row `imu_decision` |
| `decision` | ใช้จาก row `imu_decision` |
| non-fall sample-only | ไม่มี `imu_decision` ได้ — ใช้ peak `svm_filtered_g` ของ `imu_sample` เป็น magnitude |
| late post-action | ไม่ใช้เป็นค่าหลัก (เป็นแค่ช่วงลุก/เดินกลับ) |

`scripts/summarize_selected.mjs` ทำกฎนี้ให้อัตโนมัติ (format-aware: raw multi-row
ที่มีคอลัมน์ `type` ใช้ impact/peak; ไฟล์ aggregated row เดียวอ่านค่าตรง)

## รูปแบบชื่อไฟล์ใน selected

```text
fall_side_left_T05.csv
fall_forward_T11.csv
non_fall_sit_hard_T04.csv
non_fall_running_light_T03.csv
normal_standing_T01.csv
```
