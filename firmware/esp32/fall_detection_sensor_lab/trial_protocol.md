# Trial Protocol

เอกสารนี้ใช้กำหนดขั้นตอนการเก็บ Log จากอุปกรณ์สวมใส่ โดยใช้ `sensor_tuning` และ Node-RED

## ขอบเขตการเก็บข้อมูล

การเก็บข้อมูลนี้เป็นชุดเก็บท่าพื้นฐาน หรือ Basic Activity Collection สำหรับอธิบายการทำงานของระบบต้นแบบ

| กฎ | รายละเอียด |
|---|---|
| 1 Trial | ทำ 1 ท่าเท่านั้น |
| 1 Trial | ได้ 1 CSV file |
| จำนวนรอบ | เท่ากับจำนวน Trial |
| Firmware | ใช้ `sensor_tuning` |
| Sensor | MPU6050 |
| Metadata | เติมโดย Node-RED |
| ภาพประกอบ | ถ่ายภาพท่าทดสอบไว้ใช้บทที่ 5 |

## ขั้นตอนก่อนเริ่ม Session

| ลำดับ | ขั้นตอน |
|---:|---|
| 1 | อัปโหลด firmware `sensor_tuning` |
| 2 | ตรวจสอบว่าอุปกรณ์เชื่อม Wi-Fi / MQTT ได้ |
| 3 | เปิด Node-RED ผ่าน Docker เป็นหลัก: `npm run sensor-lab -- node-red up` |
| 4 | เปิด Dashboard `Fall Detection Sensor Lab` ที่ `/ui` แล้วกรอก `Session ID` เช่น `1`, `01` หรือ `S01` ระบบจะสร้างโฟลเดอร์ให้โดยอัตโนมัติ (กรอกครั้งเดียวต่อรอบ) |
| 5 | ดู System / Trial Info: สถานะ MQTT, Device, IMU sample, Recording เป็น dot/badge สีชัดเจน, Last seen age ต่ำกว่า 3s และไม่มี `Warning: No recent IMU sample` ก่อนเริ่มเก็บ |
| 6 | สวมอุปกรณ์ในตำแหน่งเดิมทุกครั้ง |
| 7 | ตรวจสอบว่า CSV จะถูกบันทึกใน `runs/S01/raw/` |
| 8 | เตรียมพื้นที่ทดสอบ โดยท่าล้มต้องทำบนเบาะหรือฟูก |

Node-RED ใช้ FlowFuse Dashboard 2.0 และ flow `fall-detection-sensor-lab-flow.v2.json`
โดยอ่าน MQTT broker จาก env (`MQTT_BROKER_HOST`, `MQTT_BROKER_PORT`,
`MQTT_USE_TLS`, `MQTT_USERNAME`, `MQTT_PASSWORD`) ห้ามใส่ host/credential จริงใน flow JSON

## ขั้นตอนต่อ 1 Trial

ผู้ทดลองทำคนเดียว ใช้ Dashboard เป็นหลัก กดปุ่มท่าเดียว metadata ตั้งอัตโนมัติ

| ลำดับ | ขั้นตอน |
|---:|---|
| 1 | กดปุ่มท่าที่จะเก็บใน Dashboard (ท่าปกติอยู่ฝั่ง Normal / Daily Activities, ท่าล้มอยู่ฝั่ง Fall Simulations) — `activityLabel`, `expectedType`, `trialId` ถูกตั้งอัตโนมัติ |
| 2 | Dashboard เริ่ม **Countdown 10 วินาที** ใช้เดินไปตำแหน่งทดสอบ/เตรียมตัวบนเบาะ |
| 3 | Countdown จบ → สถานะ "Recording: action" → เริ่มบันทึก |
| 4 | นิ่ง 2–3 วินาที (baseline) แล้วทำท่าที่กำหนด 1 ท่า |
| 5 | ค้างท่าหลังเหตุการณ์ 3–5 วินาที |
| 6 | กด **Stop Trial** เอง (ไม่มี auto-stop รอบนี้) |
| 7 | ตรวจว่า CSV ถูกสร้าง, Current Trial Metadata แสดง `Last Saved CSV` ล่าสุด และ Dashboard แสดง Next Trial เพิ่มเป็นรอบถัดไปอัตโนมัติ |
| 8 | จด `note` หากมีเหตุการณ์ผิดปกติ |
| 9 | ถ่ายภาพท่าทดสอบสำหรับบทที่ 5 หากยังไม่มีภาพ |

> **หมายเหตุ Manual Stop:** เพราะทำคนเดียว หลังทำท่า/ล้มอาจต้องลุกขึ้นหรือเดินกลับมากด Stop
> ข้อมูลช่วง post-action (ลุก/เดินกลับ) จะติดอยู่ใน raw CSV ได้ — ยอมรับได้ เพราะ workflow
> มี raw → selected → exports และจะคัดเฉพาะค่าช่วง event หลักภายหลัง (ดู `selection_guide.md`)

## รูปแบบชื่อไฟล์

```text
S01_T01_standing_still.csv
S01_T02_walking_normal.csv
S01_T03_running_light.csv
S01_T04_sit_hard.csv
S01_T05_side_fall_left.csv
```

| ส่วน | ความหมาย |
|---|---|
| S01 | Session 01 |
| T01 | Trial 01 |
| standing_still | ท่าที่ทำ |
| .csv | ไฟล์ Log |

## รายการท่าพื้นฐานที่ต้องเก็บ

| Activity Label | ความหมาย | Expected Type | จำนวน Trial |
|---|---|---|---:|
| standing_still | ยืนนิ่ง | non_fall | 2 |
| walking_normal | เดินปกติ | non_fall | 2 |
| running_light | วิ่งเบา ๆ | non_fall | 3 |
| sit_normal | นั่งลงปกติ | non_fall | 2 |
| sit_hard | นั่งลงแรง | non_fall | 3 |
| side_fall_left | ล้มด้านซ้าย | fall | 3 |
| side_fall_right | ล้มด้านขวา | fall | 3 |
| forward_fall | ล้มไปข้างหน้า | fall | 3 |
| backward_fall | ล้มไปข้างหลัง | fall | 3 |

**รวมทั้งหมด 24 Trials**

## คำอธิบายท่าทดสอบ

| Activity Label | วิธีทำโดยย่อ |
|---|---|
| standing_still | ยืนนิ่ง 10–15 วินาที |
| walking_normal | เดินปกติ 10–15 วินาที |
| running_light | วิ่งเบา ๆ 10–15 วินาที |
| sit_normal | ยืน → นั่งลงปกติ → ค้าง 3–5 วินาที |
| sit_hard | ยืน → นั่งลงแรงกว่าปกติ → ค้าง 3–5 วินาที |
| side_fall_left | ล้มจำลองไปด้านซ้ายบนเบาะ |
| side_fall_right | ล้มจำลองไปด้านขวาบนเบาะ |
| forward_fall | ล้มจำลองไปข้างหน้าบนเบาะ |
| backward_fall | ล้มจำลองไปข้างหลังบนเบาะ |

## ภาพที่ควรถ่ายไว้

| ภาพ | ใช้ประกอบ |
|---|---|
| อุปกรณ์ที่สวมใส่ | สภาพแวดล้อมการทดสอบ |
| ยืนนิ่ง | กิจกรรมปกติ |
| เดินปกติ | กิจกรรมปกติ |
| วิ่งเบา ๆ | กิจกรรมที่มีแรงเคลื่อนไหว |
| นั่งลงแรง | กิจกรรมคล้ายล้ม |
| ล้มด้านซ้าย/ขวา | ท่าล้มด้านข้าง |
| ล้มไปข้างหน้า | ท่าล้มด้านหน้า |
| ล้มไปข้างหลัง | ท่าล้มด้านหลัง |
| หน้าจอแจ้งเตือน | ผลหลังระบบตรวจพบเหตุการณ์ |
