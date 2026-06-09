# Device Pairing & WiFi Configuration

# ขั้นตอนการจับคู่อุปกรณ์และตั้งค่า WiFi

## Doc Meta

- Audience: Mobile/Backend/Hardware Dev, QA
- Source of Truth: `apps/mobile/app/(features)/(device)/` + [firmware/esp32/README.md](../../firmware/esp32/README.md), `apps/backend-api/src/routes/devicePairingRoutes.ts`, `apps/mobile/app/(features)/(device)/device-wifi-setup.tsx`, `apps/mobile/app/(features)/(device)/device-ble-wifi-setup.tsx`, `apps/mobile/app/(features)/(device)/device-wifi-reconfig.tsx`
- Status: Active
- Last Updated: May 21, 2026

---

คู่มือนี้อธิบาย Flow การจับคู่อุปกรณ์ ESP32 กับแอป (อัปเดต: พฤษภาคม 2026)

---

## Overview

การจับคู่อุปกรณ์มี 2 ขั้นตอนหลัก:

1. **Device Pairing** - ผูกอุปกรณ์กับผู้สูงอายุ
2. **WiFi Configuration** - ตั้งค่า WiFi ให้อุปกรณ์ผ่าน BLE (Bluetooth Low Energy)

FallHelp now uses **Bluetooth Low Energy (BLE)** for first-time WiFi provisioning instead of AP Mode. This provides a better user experience with all setup happening within the mobile app.

For device management after setup, mobile enters `device-wifi-setup.tsx` first and then chooses the actual path from device state:

- device online → `device-wifi-reconfig.tsx` (backend/MQTT command path)
- device offline → `device-ble-wifi-setup.tsx` (BLE provisioning path)

---

## Feature Requirements

### Phase 1: Device Pairing (ผูกอุปกรณ์)

**Flow Diagram:**

```
Admin สร้างอุปกรณ์ → QR Code บนกล่อง → ผู้ใช้สแกน → อุปกรณ์ถูกผูก
```

**ขั้นตอน:**

| Step | Action                      | API                                                        |
| :--: | --------------------------- | ---------------------------------------------------------- |
|  1   | Admin สร้างอุปกรณ์ในระบบ    | `POST /api/admin/devices`                                  |
|  2   | ผู้ใช้สร้างข้อมูลผู้สูงอายุ | `POST /api/elders`                                         |
|  3   | ผู้ใช้สแกน QR Code จากกล่อง | `GET /api/devices/by-code/:code` เพื่อตรวจสอบข้อมูลอุปกรณ์ |
|  4   | แอปเรียก API ผูกอุปกรณ์     | `POST /api/device-pairings`                                |

#### QR Code Format

```json
{
  "deviceCode": "FH-DEV-001",
  "serialNumber": "ESP32-XXXXXXXXXXXX"
}
```

### Phase 2: WiFi Configuration (ตั้งค่า WiFi ผ่าน BLE)

#### วิธีปัจจุบัน: BLE Provisioning

```
ผู้ใช้เปิด Step 3 → แอปสแกน BLE → เลือกอุปกรณ์ → เลือก WiFi → ส่งรหัสผ่าน → สำเร็จ
```

**ขั้นตอน:**

| Step | Action                                 | รายละเอียด                     |
| :--: | -------------------------------------- | ------------------------------ |
|  1   | ESP32 เริ่ม BLE advertising            | ชื่ออุปกรณ์: `FallHelp-XXXXXX` |
|  2   | ผู้ใช้เปิด Step 3 ในแอป                | แอปสแกนหา BLE อัตโนมัติ        |
|  3   | ผู้ใช้เลือกอุปกรณ์ที่ตรงกับรหัส        | ตรวจสอบจาก Device Code         |
|  4   | ผู้ใช้เลือก WiFi จากรายการ หรือกรอกเอง | รองรับสแกน WiFi ในแอป          |
|  5   | ผู้ใช้กรอกรหัสผ่าน WiFi                | ส่งผ่าน BLE ไปยัง ESP32        |
|  6   | ESP32 ทดสอบเชื่อมต่อจริง               | ใช้เวลา ~10 วินาที             |
|  7   | สำเร็จ → ESP32 Restart + Online        | ส่งสถานะไป Backend             |

**เงื่อนไขที่ต้องมี:**

- เปิด Bluetooth บนมือถือ
- Android ต้องเปิด Location เพื่อสแกน WiFi
- ESP32 อยู่ในระยะ BLE (ประมาณ 10-30 เมตร)

### Device Status Flow

```
UNPAIRED → PAIRED
```

> สถานะ **ออนไลน์/ออฟไลน์ของอุปกรณ์** ไม่ได้เก็บใน `Device.status` — คำนวณจาก `device.lastOnline` timestamp ใน backend เสมอ

| Status   | Description               |
| -------- | ------------------------- |
| UNPAIRED | ยังไม่ได้ผูกกับผู้สูงอายุ |
| PAIRED   | ผูกกับผู้สูงอายุแล้ว      |

**ความต่างระหว่าง `wifiStatus` และ `lastOnline`:**

- `wifiStatus` ใช้ตอบคำถามเรื่องการเชื่อม WiFi และ provisioning
  - `CONNECTED` = อุปกรณ์รายงานว่าเชื่อม WiFi ได้แล้ว
  - `DISCONNECTED` = อุปกรณ์ยังไม่เชื่อม WiFi หรือหลุดออกจาก WiFi
  - `CONFIGURING` = กำลังอยู่ใน flow ตั้งค่า WiFi
  - `ERROR` = flow ตั้งค่า WiFi ล้มเหลวหรือไม่ได้ ACK ตามที่คาด
- `lastOnline` ใช้ตอบคำถามเรื่อง presence
  - backend เห็นอุปกรณ์มีชีวิตล่าสุดเมื่อไร
  - ตอนนี้ UI ควรตีความว่า online หรือ offline
- สรุป:
  - ใช้ `wifiStatus` สำหรับข้อความแนว "กำลังตั้งค่า", "เชื่อม WiFi สำเร็จ", "ตั้งค่าไม่สำเร็จ"
  - ใช้ `lastOnline` สำหรับ badge หรือสถานะ `ออนไลน์ / ออฟไลน์`

---

## QR Code Pairing Flow

### Quick Setup Flow

#### 1. ESP32 Setup

```bash
1. Upload firmware to ESP32
2. ESP32 starts BLE advertising as "FallHelp-XXXXXX"
3. Check Serial Monitor for device code
```

#### 2. Admin Panel

```bash
1. Login to Admin Panel
2. Devices → Create New Device
3. Enter Serial Number from ESP32
4. Save device
```

#### 3. Mobile App Setup

```bash
1. Open FallHelp Mobile App
2. Start Setup Wizard → Step 3
3. App auto-scans for BLE devices
4. Select your "FallHelp-XXXXXX" device
5. Choose WiFi network from list, or enter the SSID manually when the network is hidden
6. Enter WiFi password
7. Wait for BLE WiFi result, then backend/socket online confirmation (up to 20 seconds)
8. Success! Device is online
```

#### 4. Backend ACK Verification (Production)

```bash
1. Mobile sends WiFi credentials via BLE directly to ESP32
2. ESP32 writes WiFi credentials to NVS and connects to WiFi
3. ESP32 connects to MQTT Broker
4. ESP32 publishes Online status via MQTT
5. Backend updates device status and notifies Mobile app via Socket.io
```

Final flow used in product:

`mobile -> BLE -> esp32 -> NVS -> esp32 Online -> backend socket`

Mobile treats BLE `CONNECTED (0x02)` as "ESP32 connected to WiFi" only, not final app success. The app keeps the provisioning screen open until Socket.io or backend polling confirms `wifiStatus=CONNECTED`/`isOnline=true` within **20 seconds**. If the password is wrong, ESP32 sends BLE `FAILED (0x03)` and the app shows a retry dialog — the user can re-enter the password immediately without needing to power-cycle the device, since the firmware now resets the BLE/WiFi provisioning session automatically on failure. If retry still fails, the caregiver should power-cycle the device before starting again.

_(Note: The backend `PUT /api/devices/:id/wifi-config` endpoint and `device/{serial}/config` MQTT topic are for remote reconfiguration from app/backend flows, not the initial Mobile BLE setup.)_

In current mobile implementation, device details should route caregivers to the `device-wifi-setup.tsx` smart entrypoint. That entrypoint may continue to BLE provisioning or backend reconfiguration depending on whether the device is already online.

---

## BLE WiFi Provisioning

### BLE Service Specification

**Service UUID:**

```
4fafc201-1fb5-459e-8fcc-c5c9c331914b
```

**Characteristics:**

| Characteristic | UUID                                   | Type        | Description       |
| -------------- | -------------------------------------- | ----------- | ----------------- |
| **SSID**       | `4fafc202-1fb5-459e-8fcc-c5c9c331914b` | Write       | WiFi network name |
| **Password**   | `4fafc203-1fb5-459e-8fcc-c5c9c331914b` | Write       | WiFi password     |
| **Status**     | `4fafc204-1fb5-459e-8fcc-c5c9c331914b` | Read/Notify | Connection status |

**Status Values:**

| Value  | Status     | Description                                                                 |
| ------ | ---------- | --------------------------------------------------------------------------- |
| `0x00` | IDLE       | Waiting for credentials                                                     |
| `0x01` | CONNECTING | Attempting WiFi connection                                                  |
| `0x02` | CONNECTED  | ESP32 connected to WiFi; Mobile still waits for backend online confirmation |
| `0x03` | FAILED     | Connection failed                                                           |
| `0x04` | INVALID    | Invalid credentials                                                         |

### Offline Detection (MQTT Last Will)

- ESP32 ตั้ง Last Will Testament เมื่อเชื่อมต่อ MQTT
- ถ้า ESP32 disconnect โดยไม่ graceful → MQTT broker ส่ง offline message
- Backend อัปเดต `lastOnline`/realtime state เพื่อให้ระบบคำนวณเป็น Offline อัตโนมัติ

### Mobile App Features

**WiFi Scanner:**

- ✅ Auto-scan WiFi networks on page load
- ✅ Display signal strength (color-coded)
- ✅ Show security type (WPA3/WPA2/WPA/WEP/Open)
- ✅ Sort by signal strength
- ✅ Indicate current network
- ✅ "Scan Again" button
- ✅ Manual input fallback

**BLE Connection:**

- ✅ Auto-connect by device code
- ✅ Device filtering
- ✅ Real-time status monitoring
- ✅ Timeout handling: **20 seconds** for provisioning online confirmation
- ✅ Silent BLE reconnect on retry (no flashing to ble-connecting screen)
- ✅ Clear error messages
- ✅ Back button accessible during BLE scan and WiFi selection steps

---

## Technical Implementation

### Pairing Layer Contract

```
Admin creates device → caregiver scans QR → backend validates deviceCode → pair to elder
```

- device lookup ใช้ `GET /api/devices/by-code/:deviceCode` และคืนข้อมูลอุปกรณ์สำหรับ pairing
- การผูกจริงใช้ `POST /api/device-pairings`
- การยกเลิกการผูกใช้ `DELETE /api/device-pairings/:deviceId`
- เมื่อ pair สำเร็จ backend ต้อง clear retained config command ของ serial นั้นแบบ best-effort
  เพื่อกันคำสั่ง `RESET_WIFI` ที่ค้างจากรอบ unpair ก่อนหน้าถูกส่งหลัง provisioning รอบใหม่
- เมื่อ unpair แล้ว backend ต้องส่ง `RESET_WIFI` ไปที่ `device/{serial}/config` แบบ retained พร้อม `requestId`
  เพื่อให้อุปกรณ์ที่ offline ตอนกด unpair ได้รับคำสั่งล้าง WiFi/NVS ทันทีเมื่อกลับมา online
- เมื่อ firmware ตอบ `config/ack` ด้วย `reason: "RESET_WIFI_ACCEPTED"` backend ต้อง clear retained config command
  เพื่อไม่ให้คำสั่ง reset ค้างไปกระทบการผูกครั้งถัดไป

### Provisioning Layer Contract

```
BLE scan → connect → send WiFi credentials → device joins WiFi/MQTT → backend observes online status
```

- provisioning transport คือ BLE
- การตั้งค่า WiFi สำเร็จจริงเมื่อ device เชื่อม WiFi/MQTT ได้ ไม่ใช่แค่ส่ง credential สำเร็จ
- ฝั่ง backend ใช้ MQTT `config` และ `config/ack` สำหรับบางคำสั่งควบคุม เช่น `RESET_WIFI`

### MQTT Config ACK Protocol

**Config Command (Backend -> ESP32):**

Topic: `device/{serial}/config`

Payload:

```json
{
  "wifiSSID": "HomeWiFi",
  "wifiPassword": "password123",
  "requestId": "uuid-v4"
}
```

**Config ACK (ESP32 -> Backend):**

Topic: `device/{serial}/config/ack`

Payload:

```json
{
  "requestId": "uuid-v4",
  "success": true,
  "timestamp": 12345678,
  "reason": "WIFI_CONFIG_SAVED",
  "ip": "192.168.1.101"
}
```

Notes:

- `requestId` is required for correlation
- `success=false` should include `reason`
- `success=true` means config persisted on device (NVS), not final WiFi online confirmation
- Backend treats timeout/offline/publish error as failure and sets `wifiStatus=ERROR`
- Backend keeps `wifiStatus=CONFIGURING` after ACK; status topic updates it to `CONNECTED`/`DISCONNECTED`
- Backend does not persist `ssid` or `wifiPassword`; credentials stay on ESP32 NVS only

### Device State Semantics

`Device.status` หมายถึง pairing state เท่านั้น:

| Field      | Meaning            |
| ---------- | ------------------ |
| `UNPAIRED` | ยังไม่ผูกกับ elder |
| `PAIRED`   | ผูกกับ elder แล้ว  |

สิ่งที่ไม่ควรสับสน:

- online/offline ไม่ได้เก็บใน `Device.status`
- สถานะ online คำนวณจาก `lastOnline` freshness เท่านั้น ส่วน `wifiStatus` ใช้อธิบาย WiFi/provisioning state
- offline แบบกะทันหันอาจมาจาก MQTT Last Will (`device/+/lwt`)

### Cross-Module Constraints

- Mobile ต้องจัดการ BLE permission และ cleanup ของ connection/scan ให้ครบทุกครั้ง
- Backend ต้อง reject event จากอุปกรณ์ที่ `UNPAIRED` และส่ง retained `RESET_WIFI` กลับไปได้
- Firmware ต้องรักษา flow BLE provisioning และ MQTT reconnect ให้สอดคล้องกับ topic contract ปัจจุบัน
- Firmware ต้องล้างทั้ง confirmed WiFi credentials (`ssid/password`) และ pending credentials (`pending_ssid/pending_pass`)
  เมื่อรับ `RESET_WIFI`

### Permissions Required

**Android:**

```xml
<!-- Android 12+ -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

<!-- WiFi Scanner -->
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
```

**Note:** Location Services must be enabled for WiFi scanning on Android.

**iOS:**

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>FallHelp ต้องการใช้ Bluetooth เพื่อตั้งค่า WiFi ให้กับอุปกรณ์</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>FallHelp ต้องการตำแหน่งเพื่อสแกนหา WiFi networks</string>
```

### Security Considerations

**Current Implementation:**

- WiFi credentials sent over BLE in plaintext
- Relies on BLE's short range (10-30m) for security
- No encryption or pairing required
- Mock trigger web server is controlled by firmware flag (`ENABLE_MOCK_TRIGGERS`)

**Best Practices:**

- ✅ Configure WiFi in private location
- ✅ Ensure no unauthorized devices nearby
- ✅ Verify device code matches ESP32
- ⚠️ Don't configure in public places

**Future Enhancements:**

- BLE pairing with PIN code
- Credential encryption
- Device authentication via QR code

**Development Note:**

If QA needs simulated events, enable mock triggers manually in firmware by setting:

`#define ENABLE_MOCK_TRIGGERS true`

### Mobile App Implementation

```typescript
// หน้าจอตั้งค่า WiFi ผ่าน BLE
// เมื่อ BLE ส่งสถานะ CONNECTED แล้ว
const handleComplete = () => {
  router.replace("/(tabs)");
};
```

---

## Troubleshooting

| ปัญหา                    | วิธีแก้ไข                                       |
| ------------------------ | ----------------------------------------------- |
| ไม่พบอุปกรณ์ BLE         | เปิด Bluetooth, เข้าใกล้อุปกรณ์, รีสตาร์ท ESP32 |
| เชื่อมต่อ BLE ไม่ได้     | ตรวจสอบ permission, ปิด/เปิด Bluetooth ใหม่     |
| ไม่พบ WiFi ในรายการ      | เปิด Location (Android), เปิด WiFi แล้วสแกนใหม่ |
| เชื่อมต่อ WiFi ไม่สำเร็จ | ตรวจสอบรหัสผ่านและระยะสัญญาณ WiFi               |
| อุปกรณ์ Offline อยู่ตลอด | ตรวจสอบ MQTT Server ทำงาน                       |

### ESP32 ไม่แสดงใน BLE Scan

**สาเหตุ:**

- ESP32 ไม่ได้เปิด BLE advertising
- อยู่นอกระยะ Bluetooth (>30m)
- Bluetooth ปิดอยู่บนมือถือ

**วิธีแก้:**

1. ตรวจสอบ Serial Monitor ว่า BLE advertising เริ่มแล้ว
2. เข้าใกล้ ESP32 (ภายใน 10m)
3. เปิด Bluetooth บนมือถือ
4. Restart ESP32 และลองใหม่

### ไม่สามารถเชื่อมต่อ BLE

**วิธีแก้:**

1. ตรวจสอบ BLE permissions ใน Settings
2. ปิด Bluetooth แล้วเปิดใหม่
3. Restart ESP32
4. Restart Mobile App

### WiFi Connection Failed

**วิธีแก้:**

1. ตรวจสอบรหัสผ่าน WiFi และลองกด **ลองใหม่** — อุปกรณ์จะรีเซ็ต BLE session อัตโนมัติหลัง WiFi fail
2. ตรวจสอบว่า ESP32 อยู่ในระยะ WiFi
3. ลองใช้ WiFi network อื่น
4. ตรวจสอบ Serial Monitor เพื่อดู error
5. หากลองใหม่หลายครั้งแล้วยังไม่สำเร็จ ให้ปิด-เปิดอุปกรณ์แล้วเริ่ม setup ใหม่

### WiFi Scanner ไม่แสดง Networks

**วิธีแก้:**

1. เปิด Location Services (Android)
2. อนุญาต Location Permission
3. เปิด WiFi
4. กด "Scan Again"

---

## Comparison: BLE vs AP Mode

| Feature         | AP Mode (Old) | BLE (New)        |
| --------------- | ------------- | ---------------- |
| WiFi Switching  | ❌ Required   | ✅ Not required  |
| In-App Setup    | ❌ No         | ✅ Yes           |
| WiFi Scanner    | ❌ No         | ✅ Yes           |
| Android UX      | ❌ Poor       | ✅ Good          |
| iOS UX          | ⚠️ OK         | ✅ Good          |
| Setup Time      | ~2-3 min      | ~30 sec          |
| Error Handling  | ❌ Limited    | ✅ Comprehensive |
| Status Feedback | ❌ No         | ✅ Real-time     |

---

## Testing Checklist

### ESP32

- [ ] BLE advertising starts on boot
- [ ] Device name shows correct code
- [ ] Accepts WiFi credentials via BLE
- [ ] Connects to WiFi successfully
- [ ] Sends status updates
- [ ] Connects to MQTT after WiFi

### Mobile App

- [ ] BLE permissions requested
- [ ] Device scan works
- [ ] Device filtering by code works
- [ ] WiFi scanner shows networks
- [ ] Network selection works
- [ ] Manual input works
- [ ] Status updates display
- [ ] Error messages clear
- [ ] Timeout handling works

### End-to-End

- [ ] Fresh ESP32 → Setup → Online
- [ ] Wrong password → Retry dialog (กรอกรหัสใหม่ได้ทันที ไม่ต้องรีเซ็ตอุปกรณ์)
- [ ] Retry reconnects BLE silently (ไม่กระพริบไปหน้าสแกน BLE)
- [ ] Provisioning timeout 20s → dialog ขึ้น, background ขาว
- [ ] Out of range → Timeout error
- [ ] Multiple devices → Correct selection
- [ ] Online device enters backend/MQTT reconfiguration path successfully
- [ ] Offline device enters BLE provisioning path successfully

---

## Related Docs

- [IoT MQTT Architecture](../architecture/iot-mqtt.md)
- [Firmware README](../../firmware/esp32/README.md)
- [Mobile AI Context](../ai/mobile.md)
