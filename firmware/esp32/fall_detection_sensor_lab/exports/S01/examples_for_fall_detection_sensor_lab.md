# ตัวอย่างสำหรับ Fall Detection Sensor Lab

> สร้างอัตโนมัติจาก selected_values_table.csv

## ตัวอย่าง Fall Case

| Field | Value |
|---|---:|
| Activity | side_fall_left |
| Trial | T06 |
| Magnitude | 2.06g |
| postureDelta | 144.15° |
| decision | suspected_fall |

## วิธีคำนวณ magnitude

```text
SVM = √(ax² + ay² + az²)
```

## วิธีคำนวณ postureDelta

```text
pitchDelta = |pitchAfter - pitchBefore|
rollDelta  = |rollAfter - rollBefore|
postureDelta = max(pitchDelta, rollDelta)
```

## การตัดสิน

```text
Fall Suspected = (magnitude > impactThreshold) AND (postureDelta > postureThreshold)
```
