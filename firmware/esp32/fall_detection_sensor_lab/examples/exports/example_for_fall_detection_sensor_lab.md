# ตัวอย่างสำหรับ Fall Detection Sensor Lab

> หมายเหตุ: ไฟล์นี้เป็นตัวอย่าง format เท่านั้น ไม่ใช่ผลทดสอบจริง

## ตัวอย่าง Fall Case

| Field | Value |
|---|---:|
| Activity | side_fall_left |
| Trial | T05 |
| ax | 1.42g |
| ay | 1.66g |
| az | 0.88g |
| svmFiltered | 2.31g |
| impactThreshold | 2.0g |
| pitchBefore | 7.5° |
| rollBefore | 4.8° |
| pitchAfter | 19.2° |
| rollAfter | 63.0° |
| postureDelta | 58.2° |
| postureThreshold | 45° |
| decision | suspected_fall |

## วิธีคำนวณ magnitude

```text
SVM = √(ax² + ay² + az²)
SVM = √(1.42² + 1.66² + 0.88²)
    = 2.35g
```

## วิธีคำนวณ postureDelta

```text
pitchDelta = |19.2 - 7.5| = 11.7°
rollDelta  = |63.0 - 4.8| = 58.2°
postureDelta = max(11.7, 58.2) = 58.2°
```

## การตัดสิน

```text
Fall Suspected = (2.31 > 2.0) AND (58.2 > 45)
               = True
```
