# FallHelp ESP32 Firmware

## Doc Meta

- Audience: Hardware Dev, Backend Dev, Mobile Dev, QA
- Source of Truth: `src/main_firmware/`, `src/sensor_tuning/`, and firmware runbooks under `docs/`
- Status: Active
- Last Updated: May 30, 2026

---

**Firmware Scope:** WiFi + MQTT + BLE Provisioning + Sensor Runtime

เอกสารนี้เป็นหน้าเริ่มต้นของฝั่ง Arduino
เน้น 3 อย่างเท่านั้น:

1. เริ่มใช้งานให้ได้เร็ว
2. รู้ว่าเรื่องไหนต้องไปอ่านไฟล์ไหน
3. เห็นโครงสร้างไฟล์โค้ด Arduino แบบรวม

---

## 1) Start Here

กรณีใช้งานมี 2 ทาง:

ก่อนเริ่มรอบทดสอบจริง ให้ยึดเฟสจาก
[START_HERE.md](START_HERE.md)

1. เชื่อมระบบเต็ม (Backend + Mobile):
   - เปิด `firmware/esp32/src/main_firmware/main_firmware.ino`
   - Arduino IDE จะ compile `.ino` ทุกไฟล์ใน `main_firmware/` รวมกันเป็น sketch เดียว
   - ไปต่อที่ [ESP32 System Operation Guide](docs/guides/Esp32SystemOperationGuide.md)
2. เทส/จูนเซนเซอร์ก่อนเชื่อมระบบ:
   - เปิด `firmware/esp32/src/sensor_tuning/sensor_tuning.ino`
   - ไปต่อที่ [Sensor Hardware-Only Tuning Guide](docs/guides/SensorHardwareOnlyTuningGuide.md)

---

## 2) ถ้าจะทำอะไร ให้ไปไฟล์ไหน

| งานที่ต้องทำ                                  | ไฟล์เอกสารหลัก (Owner Doc)                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| Runtime/BLE/WiFi/MQTT/NVS/คำสั่งระบบ          | [ESP32 System Operation Guide](docs/guides/Esp32SystemOperationGuide.md)          |
| จูนฮาร์ดแวร์ล้วน (ยังไม่คุย backend)          | [Sensor Hardware-Only Tuning Guide](docs/guides/SensorHardwareOnlyTuningGuide.md) |
| จูนตรวจจับการล้ม (MPU6050)                    | [MPU6050 Fall Guide](docs/components/mpu6050.md)                                  |
| จูนชีพจร (XD-58C / PPG)                       | [XD-58C Pulse Guide](docs/components/pulse-sensor.md)                             |
| ปุ่มยกเลิกการแจ้งเตือน                        | [False Alarm Cancel Button Guide](docs/components/cancel-button.md)               |
| ลำโพง/เสียงแจ้งเตือน                          | [Grove - Speaker Alert Guide](docs/components/speaker-alert.md)                     |
| เก็บข้อมูล Fall Detection Sensor Lab (optional) | [Fall Detection Sensor Lab](fall_detection_sensor_lab/README.md)                 |
| Quickstart ตรวจระบบ ESP32                       | [START_HERE](START_HERE.md)                                                      |
| คู่มือการใช้งานจริง (Guide)                   | [Practical Operation Guide](docs/guides/PracticalOperationGuide.md)               |

หมายเหตุ:

- รายละเอียด runtime constants, serial commands, troubleshooting ฝั่งระบบ ให้ยึด `Esp32SystemOperationGuide.md` เป็นหลัก
- README นี้ไม่ลงรายละเอียดเชิงลึกซ้ำ

---

## 3) โครงสร้างไฟล์โค้ด Arduino

```
firmware/esp32/
├── README.md                              ← หน้าเริ่มต้น (ไฟล์นี้)
├── START_HERE.md                          ← ลำดับ phase การทดสอบ (ADL/Fall/Pulse)
├── docs/
│   ├── README.md                          ← สารบัญเอกสาร
│   ├── guides/                           ← คู่มือการทำงาน (runbook)
│   │   ├── Esp32SystemOperationGuide.md
│   │   ├── SensorHardwareOnlyTuningGuide.md
│   │   ├── PracticalOperationGuide.md
│   │   └── README.md
│   ├── devices/                           ← คู่มือรายอุปกรณ์
│   │   ├── mpu6050.md
│   │   ├── pulse-sensor.md
│   │   ├── cancel-button.md
│   │   └── speaker-alert.md
│   └── references/                        ← เอกสารทฤษฎี/แหล่งอ้างอิง

├── src/
│   ├── main_firmware/
│   │   ├── main_firmware.ino                  ← Main firmware entry
│   │   ├── BLEProvisioning.ino                ← BLE GATT Server & Provisioning
│   │   ├── WiFiConnectionManager.ino          ← WiFi connection & NVS Config
│   │   ├── DeviceMqttClient.ino               ← MQTT client & handlers
│   │   ├── (sensor log controls in `main_firmware.ino`)
│   │   ├── SensorManager.ino                  ← Orchestrate all sensors/modules
│   │   ├── FallDetectionConfig.ino            ← Fall thresholds, sensitivity & cancel window
│   │   ├── MPU6050_Sensor.ino                 ← Fall detection (IMU)
│   │   ├── PulseSensor.ino                    ← Heart-rate / PPG pipeline
│   │   ├── FalseAlarmCancelButton.ino         ← Cancel button logic (GPIO27)
│   │   ├── AlertSystem.ino                    ← Speaker alert system (GPIO25)
│   │   └── types.h                            ← Shared type definitions
│   └── sensor_tuning/
│       ├── sensor_tuning.ino            ← Hardware-only main entry
│       ├── build_profile.h                    ← single-sensor profile for tuning
│       ├── wifi_secrets.h                     ← WiFi credentials (not committed)
│       ├── SensorLogging.ino                  ← Advanced logging for tuning
│       └── (sensor modules same as main firmware but isolated mode)
├── fall_detection_sensor_lab/          ← Fall Detection Sensor Lab
│   ├── README.md / trial_protocol.md / csv_schema.md / selection_guide.md
│   ├── chapter_usage.md / notes.md
│   ├── examples/                      ← mock CSV/MD (format เท่านั้น)
│   ├── node-red/                      ← flow source + Dockerfile + runtime/
│   │   ├── flows/                     ← fall-detection-sensor-lab-flow.v2.json
│   │   └── runtime/                   ← Node-RED userDir (ignored)
│   ├── scripts/                       ← validate / summarize / generate (.mjs)
│   ├── runs/Sxx/                      ← raw/ + selected/ + session_notes.md
│   └── exports/                       ← ตารางบทที่ 3 / บทที่ 5 (generated)
└── README.md                              ← หน้าเริ่มต้น (ไฟล์นี้)
```

---

## 4) Hardware Mapping (Current)

| Component     | Pin            | Purpose                       |
| ------------- | -------------- | ----------------------------- |
| MPU6050       | SDA=21, SCL=22 | Fall detection (accel + gyro) |
| XD-58C Pulse  | GPIO34 (ADC)   | Heart-rate / PPG              |
| Cancel Button | GPIO27         | Cancel suspected fall         |
| Grove - Speaker | GPIO25 (PWM)   | Local alert                   |

---

## 5) Required Libraries

- BLEDevice / BLEServer / BLEUtils / BLE2902 (ESP32 BLE)
- PubSubClient (MQTT)
- ArduinoJson
- I2Cdev + MPU6050
- PulseSensorPlayground
- Wire (I2C)
- Built-in: WiFi, Preferences

---

## 6) Build Verify (ก่อนใช้จริง)

รันจาก root โปรเจกต์:

```bash
# เช็กสภาพแวดล้อมก่อน (ช่วยดู arduino-cli, core, libraries, และ serial port)
node scripts/iot/firmware-doctor.mjs

# ติดตั้ง Arduino libraries ที่ firmware ใช้ (ทำครั้งแรกหรือหลังย้ายเครื่อง)
node scripts/iot/firmware-arduino-cli.mjs deps

# Main firmware (firmware หลัก)
node scripts/iot/firmware-arduino-cli.mjs compile main

# Hardware-only tuning firmware
node scripts/iot/firmware-arduino-cli.mjs compile tuning
```

หมายเหตุ:

- `main_firmware` จะเกินขนาดถ้าใช้ `PartitionScheme=default` (1.2MB APP)
- สำหรับงานจริงให้ใช้ `PartitionScheme=huge_app` (3MB APP)
- default FQBN ของ repo ใช้ `esp32:esp32:esp32`
- helper จะพยายามหา `arduino-cli` จาก `PATH` ก่อน แล้ว fallback ไปยัง path มาตรฐานของแต่ละ OS
- ถ้าไม่กำหนดพอร์ตเอง helper จะลอง auto-detect จาก `arduino-cli board list` ก่อน แล้วค่อย fallback เป็น `/dev/ttyUSB0` บน Unix หรือ `COM3` บน Windows
- ถ้า monitor/upload/compile ติดเพราะเครื่องยังไม่พร้อม ให้เริ่มจาก `node scripts/iot/firmware-doctor.mjs`
- ถ้าจะ upload ให้ใช้ `node scripts/iot/firmware-arduino-cli.mjs upload main` หรือ `node scripts/iot/firmware-arduino-cli.mjs upload tuning`
- ถ้าพอร์ตไม่ใช่ค่า default ให้ override ด้วย `FIRMWARE_PORT=/dev/ttyUSB0` หรือ `FIRMWARE_PORT=COM5`
- PowerShell ใช้ `$env:FIRMWARE_PORT='COM5'; node scripts/iot/firmware-arduino-cli.mjs upload main`
- PowerShell สำหรับ monitor ใช้ `$env:MONITOR_PORT='COM5'; node scripts/iot/firmware-monitor.mjs`

---

## 7) Quick End-to-End Flow

1. Upload firmware to ESP32
2. Admin สร้าง device จาก serial ของ ESP32
3. Mobile ทำ BLE provisioning (ส่ง SSID/Password)
4. ESP32 ต่อ WiFi และ MQTT
5. ทดสอบ flow เซนเซอร์/แจ้งเตือนตามคู่มืออุปกรณ์แต่ละตัว

สำหรับรายละเอียดทีละขั้น:

- [ESP32 System Operation Guide](docs/guides/Esp32SystemOperationGuide.md)
- [Practical Operation Guide](docs/guides/PracticalOperationGuide.md)

---

## 8) Documentation

- [Arduino Docs Index](docs/README.md)
- [ESP32 System Operation Guide](docs/guides/Esp32SystemOperationGuide.md)
- [Practical Operation Guide](docs/guides/PracticalOperationGuide.md)
- [Sensor Hardware-Only Tuning Guide](docs/guides/SensorHardwareOnlyTuningGuide.md)
- [MPU6050 Fall Guide](docs/components/mpu6050.md)
- [XD-58C Pulse Guide](docs/components/pulse-sensor.md)
- [False Alarm Cancel Button Guide](docs/components/cancel-button.md)
- [Grove - Speaker Alert Guide](docs/components/speaker-alert.md)

---

## 9) คำศัพท์ที่ใช้ (Glossary)

| คำศัพท์            | ความหมายในโปรเจกต์นี้                               |
| ------------------ | --------------------------------------------------- |
| `ESP32 Firmware`   | โค้ดที่ทำงานบนบอร์ด ESP32 ของ FallHelp              |
| `BLE Provisioning` | การตั้งค่า WiFi ผ่าน Bluetooth จากมือถือ            |
| `MQTT`             | โปรโตคอลส่งข้อความระหว่างอุปกรณ์กับ backend         |
| `Runtime Constants` | ค่าคงที่ของ runtime เช่น cancel window และ retry budget |
| `Sensor Runtime`   | การทำงานร่วมกันของเซนเซอร์ตอนระบบกำลังรัน           |
| `Owner Doc`        | ไฟล์เอกสารหลักของแต่ละหัวข้อที่ต้องยึดเป็นแหล่งจริง |
| `Sensor Lab`       | ชุดงานเก็บค่าเซนเซอร์และตรวจ log เพื่อช่วยจูนระบบ    |
| `NVS`              | หน่วยเก็บค่าถาวรบน ESP32 ที่คงอยู่หลังรีบูต         |

---

**Last Updated:** May 30, 2026
**Status:** Active (Owner-doc structure enabled)
