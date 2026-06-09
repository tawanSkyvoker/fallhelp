# IoT & MQTT Architecture

## Doc Meta

- Audience: Backend Dev / IoT Dev
- Source of Truth: [mqttClient.ts](../../apps/backend-api/src/iot/mqttClient.ts), [topics.ts](../../apps/backend-api/src/iot/topics.ts), [handlers/](../../apps/backend-api/src/iot/handlers)
- Status: Active
- Last Updated: May 30, 2026

---

## Overview

FallHelp ใช้ **MQTT Protocol** เป็นช่องทางหลักในการสื่อสารระหว่าง ESP32 IoT Device กับ Backend Server สำหรับส่งข้อมูล Sensor แบบ Real-time (Fall Detection, Heart Rate, Device Status)

---

## System Architecture

โครงหลักของระบบคือ `ESP32 -> MQTT Broker -> Backend API -> Socket.io / Push / PostgreSQL`

- Firmware ส่ง unified event, status, และ config ACK ผ่าน MQTT
- Backend เป็นศูนย์กลางของ validation, dedup, persistence, realtime broadcast, และ push notification
- Mobile รับทั้ง Socket.io และ push ตามประเภทเหตุการณ์
- Admin อ่านข้อมูลผ่าน backend และ refresh สถานะอุปกรณ์/เหตุการณ์ด้วย polling/invalidation

---

## MQTT Topic Structure

### Subscribe Topics (Backend ← Device)

| Topic Pattern         | Handler              | Description                                                       |
| :-------------------- | :------------------- | :---------------------------------------------------------------- |
| `device/+/fall`       | `fallHandler`        | Fall detection event via direct topic                             |
| `device/+/heartrate`  | `heartRateHandler`   | Heart rate reading                                                |
| `device/+/status`     | `statusHandler`      | Device online/offline status                                      |
| `device/+/event`      | `handleUnifiedEvent` | Unified event format (primary — suspected/confirmed/cancelled/hr) |
| `device/+/config/ack` | `handleConfigAck`    | Config update acknowledgement (WiFi provisioning ACK)             |
| `device/+/lwt`        | `statusHandler`      | Last Will & Testament — Broker ส่งเมื่ออุปกรณ์หลุดแบบผิดปกติ      |
| `events/+`            | `handleUnifiedEvent` | Alternative unified event topic                                   |

### Publish Topics (Backend → Device)

| Topic                      | Purpose                                           |
| :------------------------- | :------------------------------------------------ |
| `device/{deviceId}/config` | ส่ง Configuration ไปยัง Device (WiFi, Thresholds) |

> **Note:** `+` ใน topic pattern คือ MQTT Wildcard ที่จับ `deviceId` (Serial Number ของ ESP32)

---

## Message Payloads

### Fall Detection Payload

Fields ที่ firmware ส่งจริง (`publishFallLifecycleEvent` ใน `MPU6050_Sensor.ino`):

```json
{
  "type": "suspected_fall",
  "timestamp": 123456999,
  "magnitude": 9.95,
  "postureDelta": 45.2
}
```

> - `main_firmware` payload ส่งเฉพาะ processed snapshot อย่าง `magnitude` และ `postureDelta`
> - backend ยัง map alias ของ `postureDelta` บางแบบได้เพื่อรองรับ payload รุ่นเก่า
> - Backend ใช้ **Server Time** ตอน persist เสมอ แม้ payload จะส่ง `timestamp` แบบ `millis()` มา

### Heart Rate Payload

Fields ที่ firmware ส่งจริง (จาก `topics.ts - HeartRatePayload`):

```json
{
  "heartRate": 85,
  "zone": "normal",
  "confidence": "high",
  "isAbnormal": false,
  "alertType": null
}
```

> - `zone`: `"low"` | `"normal"` | `"high"` — โซนอัตราการเต้นหัวใจ
> - `confidence`: `"none"` | `"low"` | `"medium"` | `"high"` — ความน่าเชื่อถือของสัญญาณ PPG
> - `alertType`: `"LOW"` | `"HIGH"` | `null` — ส่งมาเฉพาะกรณีผิดปกติ
> - `timestamp` จาก ESP32 คือ `millis()` — backend ใช้ **Server Time** แทนเสมอ
> - ค่า `confidence: "none"` → Mobile แสดง `--` แทน BPM (สัญญาณไม่น่าเชื่อถือ)

### Device Status Payload

```json
{
  "online": true,
  "signalStrength": -45,
  "firmwareVersion": "1.2.0",
  "ip": "192.168.1.105"
}
```

### Device Config Payload (Backend → Device)

```json
{
  "fallThreshold": 2.5,
  "hrLowThreshold": 60,
  "hrHighThreshold": 100,
  "wifiSSID": "HomeWiFi",
  "wifiPassword": "password123",
  "requestId": "uuid-for-ack"
}
```

### Config ACK Payload (Device → Backend)

```json
{
  "requestId": "uuid-for-ack",
  "success": true,
  "ip": "192.168.1.105"
}
```

---

## Unified Event Format

ESP32 ส่ง Event ผ่าน Topic เดียว (`device/{id}/event` หรือ `events/{id}`):

```json
{
  "type": "fall" | "suspected_fall" | "fall_confirmed" | "heart_rate" | "fall_cancelled",
  "event": "low" | "high" | "critical",
  "bpm": 85,
  "magnitude": 9.95,
  "postureDelta": 45.2
}
```

**Backend Route Logic:**

| `type`                              | Handler                   | Action                        |
| :---------------------------------- | :------------------------ | :---------------------------- |
| `fall`, `fall_confirmed`            | `fallHandler` (confirmed) | สร้าง CRITICAL Event + Notify |
| `suspected_fall`                    | `fallHandler` (suspected) | สร้าง WARNING Event (pending) |
| `heart_rate`, `hr`                  | `heartRateHandler`        | ส่ง BPM realtime              |
| `heart_rate_high`, `heart_rate_low` | `heartRateHandler`        | ส่ง BPM realtime แบบผิดปกติ   |
| `fall_cancelled`, `fall_cancel`     | `fallCancelledHandler`    | ยกเลิก Fall Event ล่าสุด      |

---

## 2-Stage Fall Confirmation

**Cancel Window:**

- Firmware constant: `15000 ms` (`FALLHELP_FALL_CANCEL_TIMEOUT_MS`)
- Source of Truth: `firmware/esp32/src/main_firmware/FallDetectionConfig.ino`
- เป็น business/firmware invariant ไม่ถูก persist ลง event row

### นิยาม Cancel vs Acknowledge (ตายตัว)

| การกระทำ        | ผู้ดำเนินการ        | ตริกเกอร์                 | เปลี่ยน DB                              |
| --------------- | ------------------- | ------------------------- | --------------------------------------- |
| **Cancel**      | ผู้สวมใส่           | กดปุ่ม GPIO27 ภายใน 15 วิ | ✅ ตั้งค่า `cancelledAt`                |
| **Acknowledge** | ผู้ดูแล (Caregiver) | กด `รับทราบแล้ว` ในแอป    | ❌ ไม่เปลี่ยน (คืน UI เป็นปกติเท่านั้น) |

> `fall_cancelled` ใน DB **ต้องมาจาก MQTT device flow เท่านั้น** — Caregiver หรือ Backend ไม่สามารถ set `cancelledAt` โดยตรงได้

### Backend -> Mobile Realtime Status

เมื่อ backend รับ unified fall events แล้วจะส่ง caregiver alert เฉพาะเหตุที่ยืนยันแล้ว ส่วน `event_status_changed` เป็น lifecycle signal ภายในของ mobile:

1. `suspected_fall` → บันทึก `PENDING_CONFIRMATION` แล้วส่ง `event_status_changed/FALL_SUSPECTED`; ไม่ส่ง Push
2. `fall_confirmed` → อัปเดต `CONFIRMED` แล้วส่ง `fall_detected` + `event_status_changed/FALL_CONFIRMED` + Push
3. `fall_cancelled` → อัปเดต `CANCELLED` แล้วส่ง `event_status_changed/FALL_CANCELLED`; ไม่ส่ง Push

---

## Heart Rate Realtime Behavior (Current)

### Normal BPM Streaming

Firmware ส่ง `heart_rate` แบบ `event=normal` ต่อเนื่องเพื่อให้แอปเห็น BPM สดในสถานะปกติ:

- ส่งทันทีเมื่อโซนกลับเข้า `normal`
- ส่งต่อเนื่องทุกประมาณ 5 วินาทีระหว่าง `normal`

### Abnormal BPM

- `low` / `high` / `critical` route ผ่าน `heartRateHandler` เช่นกัน แต่ไม่สร้าง DB event
- BPM ทุกค่า (ปกติและผิดปกติ) emit เป็น `heart_rate_update` ไป mobile เหมือนกัน
- ถ้าเกิด fall ในเวลาใกล้เคียง BPM ล่าสุดจาก in-memory cache (`latestHeartRateByDevice`) จะถูกแนบไปกับ FALL event `bpm` field

---

## Safety Mechanisms

### 1. Ghost Device Prevention

อุปกรณ์ที่ Unpaired แล้วแต่ยังส่งข้อมูลมา (Ghost Device):

```
Device UNPAIRED → MQTT message received → REJECT + Send RESET_WIFI command
```

### 2. Deduplication

ป้องกัน MQTT QoS 1 retransmission ทำให้เกิด Event ซ้ำ:

| Mode        | Dedup Window | Source (`fallHandler.ts`)      |
| :---------- | :----------- | :----------------------------- |
| `suspected` | 15 วินาที    | `FALL_PENDING_DEDUP_PERIOD_MS` |
| `confirmed` | 30 วินาที    | `FALL_DEDUP_PERIOD_MS`         |

> ℹ️ Dedup period เป็นกลไกป้องกัน MQTT QoS-1 retransmit — **ไม่เกี่ยวกับ cancel timeout 15 วินาทีที่กดปุ่มบนอุปกรณ์**

### 3. Config ACK with Timeout

เมื่อส่ง Config ไปยัง Device จะรอ ACK กลับมา:

- **Timeout:** 15 วินาที (default hardcoded ใน `waitForConfigAck()`, ไม่เกี่ยวกับ fall cancel timeout)
- ถ้าไม่ได้ ACK → Reject Promise
- ถ้า MQTT Disconnect → Reject ทุก Pending ACK

---

## Connection Management

**MQTTClientManager** เป็น Singleton:

| Feature              | Details                                            |
| :------------------- | :------------------------------------------------- |
| Auto-reconnect       | `reconnectPeriod: 2000ms`                          |
| Connect Timeout      | `15000ms` (Cloud handshake)                        |
| QoS Level            | 1 (At Least Once)                                  |
| Clean Session        | `true`                                             |
| TLS                  | `rejectUnauthorized: true` (HiveMQ Cloud เท่านั้น) |
| Credential Redaction | WiFi SSID/Password masked ใน Log                   |

### Dev Tools

```bash
# ตรวจสอบว่า Mosquitto service running
npm run mqtt:check

# Monitor MQTT messages realtime จาก ESP32 (ไม่ต้องเปิด backend)
npm run mqtt:monitor           # อ่าน MQTT_BROKER_URL จาก apps/backend-api/.env
npm run mqtt:monitor:local     # Mosquitto localhost:1883
npm run mqtt:monitor -- --topic "device/+/heartrate"  # filter topic
npm run mqtt:monitor -- --verbose   # raw JSON ทุก message
```

### Local Mosquitto Service For ESP32

Mosquitto รันเป็น **native service** บน host machine — ไม่ใช้ Docker

**ติดตั้ง:**

```bash
# Windows (Chocolatey)
choco install mosquitto
# จากนั้น copy config\mosquitto\mosquitto.conf → C:\Program Files\mosquitto\mosquitto.conf
# แล้ว restart service ใน Services.msc หรือ: net stop mosquitto && net start mosquitto

# Linux (Debian/Ubuntu)
sudo apt install mosquitto
sudo cp config/mosquitto/mosquitto.conf /etc/mosquitto/conf.d/fallhelp.conf
sudo systemctl enable --now mosquitto
```

**ตรวจสอบ:**

```bash
npm run mqtt:check
```

**ESP32 ใช้ LAN IP ของ host machine โดยตรง** (port 1883) — Mosquitto bind `0.0.0.0` แล้ว
ตั้ง `HIVEMQ_HOST` ใน `mqtt_secrets.h` เป็น LAN IP จริงของเครื่อง

**Firewall — เปิด inbound TCP 1883 สำหรับ LAN subnet:**

```powershell
# Windows (PowerShell as Admin)
New-NetFirewallRule -DisplayName "Mosquitto MQTT" -Direction Inbound -Protocol TCP -LocalPort 1883 -RemoteAddress LocalSubnet -Action Allow
```

```bash
# Linux
sudo ufw allow from 192.168.0.0/16 to any port 1883
```

---

## Related Docs

- [System Design](system-design.md)
- [Fall Detection System](../features/fall-detection.md)
- [BLE WiFi Provisioning](../features/device-pairing.md)
- [Firmware AI Context](../ai/firmware.md)
