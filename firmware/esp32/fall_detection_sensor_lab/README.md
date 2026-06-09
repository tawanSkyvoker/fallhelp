# Fall Detection Sensor Lab

โฟลเดอร์นี้ใช้สำหรับเก็บ Log จากเซ็นเซอร์ MPU6050 เพื่อใช้ประกอบการเขียนบทที่ 3 และบทที่ 5 ของโครงการ FallHelp

## เป้าหมาย

| เรื่อง | รายละเอียด |
|---|---|
| ใช้ทำอะไร | เก็บข้อมูลจากอุปกรณ์สวมใส่เพื่ออธิบายการตรวจจับการหกล้ม |
| ใช้กับบทที่ 3 | อธิบายที่มาของ `magnitude` และ `postureDelta` |
| ใช้กับบทที่ 5 | สรุปผลการทดสอบจากท่าจำลองและกิจกรรมพื้นฐาน |
| Firmware ที่ใช้ | `firmware/esp32/src/sensor_tuning/` |
| MQTT Topic | `device/{deviceSerial}/lab/imu` |
| Output | CSV แยกตามรอบทดลอง |

## หลักการทำงาน

```text
MPU6050
→ อ่านค่า ax, ay, az, gx, gy, gz
→ คำนวณ magnitude / SVM
→ ตรวจ impact threshold
→ คำนวณ Pitch / Roll
→ คำนวณ postureDelta
→ ตัดสินผล
→ ส่ง Log ไป Node-RED
→ บันทึก CSV
```

## Fall Detection Sensor Lab Dashboard (Node-RED)

flow `node-red/flows/fall-detection-sensor-lab-flow.v2.json` มี Web UI (@flowfuse/node-red-dashboard) ที่ `/ui`
ชื่อหน้า Dashboard คือ **Fall Detection Sensor Lab**
สำหรับเก็บข้อมูลคนเดียว ลดการกรอกมือ:

ทางหลักของรอบนี้คือ Docker service:

```bash
npm run sensor-lab -- node-red up
```

คำสั่ง Docker ที่ใช้บ่อย:

```bash
npm run sensor-lab -- node-red build
npm run sensor-lab -- node-red rebuild
npm run sensor-lab -- node-red logs
npm run sensor-lab -- node-red sync-flow
```

host fallback สำหรับ developer ใช้ `node scripts/iot/node-red-launch.mjs` แต่ workflow
หลักของ Lab ให้ยึด Docker/env/secrets เพื่อให้ MQTT config ไม่ฝังอยู่ใน flow JSON

| ส่วน | หน้าที่ |
|---|---|
| Session ID input | ตั้งครั้งเดียว เช่น `S01` (รองรับเฉพาะตัวเลขหรือ S##, ระบบจะสร้างโฟลเดอร์ `raw/`, `selected/` และ `session_notes.md` ให้อัตโนมัติ พร้อมรีเซ็ตฟอร์ม) |
| Next Trial | แสดง `trialId` ถัดไป auto-increment |
| Trial Control | แยกปุ่มเป็น 2 ฝั่ง: Normal / Daily Activities และ Fall Simulations |
| ปุ่ม 9 ท่า | กดแล้วตั้ง `activityLabel` + `expectedType` อัตโนมัติ โดยท่าปกติอยู่ฝั่งซ้าย และท่าล้มอยู่ฝั่งขวา |
| Countdown | นับถอยหลัง 10 วินาทีก่อนเริ่มบันทึก (ไม่มีเสียงใน dashboard) |
| Stop Trial | หยุดบันทึกเอง (manual, ไม่มี auto-stop) |
| System / Trial Info | Operator-style multiline status with visible status dots for MQTT, Device, IMU sample, optional Warning, Last seen, Last seen age, Current activity/expected type, Next trial ID, Topic `device/+/lab/imu`, และ trial metadata (อัปเดตทุก 1 วิ) |
| Current Trial Metadata | แสดง `sessionId`, `trialId`, `activityLabel`, `expectedType`, `recordingState`, และ `Last Saved CSV` ในกล่องเดียวกับ System / Trial Info |
| Recording State | Ready / Countdown / Recording / Stopped / CSV Saved / Countdown cancelled |
| Live Sensor | แยกกลุ่ม Acceleration, Gyroscope, Impact, Posture, Decision |
| Live Charts | Chart A = Impact Magnitude (SVM) จาก payload `svmFiltered` พร้อม `impactThreshold`; Chart B = Attitude & Posture Delta จาก `pitch`, `roll`, `postureDelta` พร้อม `postureThreshold`; X axis ใช้ `Time`, Y axis ใช้ `SVM Filtered (g)` และ `Degrees (deg)` |

MQTT runtime config อ่านจาก env:

| Env | ใช้ทำอะไร |
|---|---|
| `MQTT_BROKER_HOST` | broker host เช่น `host.docker.internal` (local service) หรือ cloud MQTT host |
| `MQTT_BROKER_PORT` | broker port เช่น `1883` หรือ `8883` |
| `MQTT_USE_TLS` | `true` สำหรับ TLS, `false` สำหรับ local no-TLS |
| `MQTT_USERNAME` | username จาก `.env` จริง หรือว่างได้สำหรับ local no-auth |
| `MQTT_PASSWORD` | password จาก `.env` จริง หรือว่างได้สำหรับ local no-auth |

ห้าม commit ค่า `.env` จริงหรือ credential ของ MQTT ลง flow/docs

Readiness thresholds: Device Online = lab message ≤ 3s, Stale = > 3–10s,
Offline = ไม่มี/ > 10s; Sensor Receiving = `imu_sample` ≤ 3s

ขั้นตอน: ตั้ง Session → กดปุ่มท่า → Countdown 10 วิ → ทำท่า → กด Stop →
ได้ `{sessionId}_{trialId}_{activityLabel}.csv` ใน `runs/Sxx/raw/` (1 Trial = 1 CSV)

ชื่อที่ใช้ในแต่ละชั้นข้อมูล:

| ชั้นข้อมูล | ชื่อที่ใช้ |
|---|---|
| Live payload / Dashboard chart | `svmFiltered` แสดงเป็น `Impact Magnitude (SVM)` และ series `Magnitude (SVM)` |
| Raw CSV | `svm_filtered_g` |
| Export summary | `magnitude_g` |

> raw CSV อาจมี movement ช่วง post-action (ลุก/เดินกลับมากด Stop) ได้
> workflow นี้จึงเก็บ raw log ก่อน แล้วใช้ `selection_guide.md` คัดช่วง event หลักภายหลัง

> firmware `sensor_tuning` ส่ง `imu_sample` เป็นระยะ (ทุก ~300ms) เพื่อให้ท่า non-fall
> ที่ไม่เกิด impact ยังมีข้อมูล sensor; Node-RED เป็นตัวคุมช่วงบันทึก (recording window)
> ส่งเฉพาะ lab topic ไม่กระทบ production event flow และไม่แก้ `main_firmware`

## ทดสอบ pipeline (ไม่ต้องใช้ฮาร์ดแวร์)

```bash
npm run sensor-lab -- test
```

จำลอง sensor publish `device/+/lab/imu` ตาม `publishLabImuLog()` จริง →
รัน function ของ Node-RED flow ที่ commit จริง → ครบ 24 trials →
validate / summarize / generate + ตรวจ contract firmware↔flow↔schema.
เขียนลง temp dir เท่านั้น ไม่แตะ `runs/` จริง

## กฎสำคัญ

| กฎ | รายละเอียด |
|---|---|
| 1 Trial | ทำ 1 ท่าเท่านั้น |
| 1 Trial | ได้ 1 CSV file |
| Metadata | Node-RED เป็นผู้เติม |
| Firmware | ส่งเฉพาะค่า sensor และผลคำนวณ |
| Raw Data | เก็บไว้ใน `runs/Sxx/raw/` |
| Selected Data | ให้ AI Agent คัดไปไว้ใน `runs/Sxx/selected/` |
| Export | ใช้เตรียมตารางสำหรับบทที่ 3 และบทที่ 5 |

## โครงสร้างข้อมูล

| Folder/File | หน้าที่ |
|---|---|
| `trial_protocol.md` | ขั้นตอน session/trial และรายการท่าที่ต้องเก็บ |
| `csv_schema.md` | ความหมายของ column ใน CSV และรูปแบบตัวเลข |
| `selection_guide.md` | วิธีให้ AI Agent คัดข้อมูล |
| `chapter_usage.md` | วิธีนำข้อมูลไปใช้ในบทที่ 3 และบทที่ 5 |
| `session_notes.md` | จดปัญหาและข้อสังเกตของแต่ละเซสชัน |
| `node-red/` | Flow source, Dockerfile, entrypoint, และ runtime ของ Node-RED |
| `node-red/flows/` | Source flow ที่ commit ลง Git |
| `node-red/runtime/` | Runtime userDir ของ Node-RED, ถูก ignore ไม่ใช่ source |
| `runs/Sxx/raw/` | CSV ดิบ |
| `runs/Sxx/selected/` | CSV ที่คัดแล้ว |
| `exports/` | ตาราง/ตัวอย่างที่พร้อมนำไปใช้ในเล่ม |

## หมายเหตุสำคัญ

ไฟล์ใน `examples/` เป็นข้อมูลจำลองเพื่อแสดง **format เท่านั้น** ไม่ใช่ผลทดสอบจริง
ห้าม claim ว่าเป็นผลทดสอบจริงจนกว่าจะมี CSV จริงจากการเก็บข้อมูล
