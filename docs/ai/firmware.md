# FallHelp Firmware / ESP32 — Deep Research

## Doc Meta

- Audience: AI agents, firmware developers, reviewers touching `firmware/esp32/`
- Source of Truth: `firmware/esp32/`, firmware runbooks, and backend MQTT/runtime contracts that consume device payloads
- Status: Active
- Last Updated: May 30, 2026

---

## Overview

> Deep-read date: 2026-05-10

Use this file as firmware system memory.
Follow the workflow in `AGENTS.md`: focused local fixes may proceed directly, but protocol, threshold, timing, or safety-critical changes should be planned first.

---

## 1. Firmware Overview

Two firmware variants:

| Firmware          | Directory                           | Purpose                                                                   |
| ----------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| **main_firmware** | `firmware/esp32/src/main_firmware/` | Main Prototype firmware: BLE + WiFi + MQTT + Sensors + Alert              |
| **sensor_tuning** | `firmware/esp32/src/sensor_tuning/` | Hardware calibration only (no backend), hardcoded WiFi, has SensorLogging |

`firmware/esp32/fall_detection_sensor_lab/` is the **Fall Detection Sensor Lab** lab module.
It is not required by the active FallHelp runtime, but it is used for thesis ch.3 & ch.5 data collection via Node-RED FlowFuse Dashboard 2.0.
Do not assume new firmware changes must be accompanied by fresh `sensor-lab` data unless the task explicitly asks for Fall Detection Sensor Lab work.

### Main Firmware Files (`main_firmware/`)

| File                         | Boundary | Purpose                                                                 |
| ---------------------------- | -------- | ----------------------------------------------------------------------- |
| `main_firmware.ino`          | Runtime entry | setup(), loop(), boot orchestration, shared state, Serial CLI      |
| `BLEProvisioning.ino`        | BLE module | BLE GATT server, provisioning callbacks, status characteristic       |
| `WiFiConnectionManager.ino`  | WiFi module | WiFi connection loop, provisioning retry budget, pending config flow, NVS credential management |
| `DeviceMqttClient.ino`       | MQTT module | MQTT client, TLS clock sync, command topic handlers, event publishing |
| `MPU6050_Sensor.ino`         | Sensor module | IMU sensor: accel+gyro read, Complementary Filter, fall detection logic |
| `PulseSensor.ino`            | Sensor module | PPG heart rate: peak detection, BPM calc, 3-zone system             |
| `FalseAlarmCancelButton.ino` | Local control | Cancel button: GPIO27, press detection, 15s timeout logic           |
| `SensorManager.ino`          | Orchestration | Sensor orchestration: init, read cycle, timing                      |
| `AlertSystem.ino`            | Local alert | Grove Speaker: alarm patterns, duration control                       |
| `FallDetectionConfig.ino`    | Config | Fall detection thresholds, event evaluation duration, posture delta, sensitivity, and fixed 15s false-alarm cancel window |
| `types.h`                    | Shared header | Shared states, externs, MPU6050Data, PulseSensorData, etc.          |
| `mqtt_secrets.h`             | Local secret | MQTT broker profile/credentials for HiveMQ Cloud or local Mosquitto (gitignored) |
| `mqtt_secrets.h.example`     | Template | Template for MQTT broker profiles and credentials                         |

Arduino IDE compiles every `.ino` file in `main_firmware/` together as one sketch. Keep `main_firmware.ino` as the boot/orchestration entrypoint, and keep BLE, WiFi, and MQTT behavior in the split modules above so future edits start at the right boundary.

### Sensor Tuning Firmware Additional Files

| File                | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `SensorLogging.ino` | MQTT-based sensor data logging (for Fall Detection Sensor Lab) |
| `build_profile.h`   | Build-time profile configuration                |
| `wifi_secrets.h`    | Hardcoded WiFi credentials (tuning only)        |

**Timing rule:** prefer `millis()`-style non-blocking control flow by default.
If a short `delay()` is genuinely required for hardware stabilization or protocol timing, keep it minimal and document the reason near the code.

---

## 2. Fall Detection Pipeline (Step-by-Step)

```
1. MPU6050 reads accel(X,Y,Z) + gyro(X,Y,Z) every loop cycle
   ↓
2. Complementary Filter computes pitch + roll from accel + gyro
   ↓
3. SVM (Signal Vector Magnitude) = √(accelX² + accelY² + accelZ²)
   ↓
4. Threshold Check (FallDetectionConfig):
   - SVM > FALL_THRESHOLD (impact detected)
   - postureDelta = |currentAngle - preImpactAngle| (posture change)
   - postureDelta > POSTURE_THRESHOLD (person went from upright to horizontal)
   ↓
5. suspected_fall event triggered
   - AlertSystem starts alarm (Grove Speaker GPIO25)
   - MQTT publish: device/{serialNumber}/event
     payload: { type: "suspected_fall", timestamp, magnitude, postureDelta }
   - Cancel timeout starts (fixed 15s in current prototype firmware)
   ↓
6. Cancel Window (15 seconds):
   ├── GPIO27 button pressed → fall_cancelled
   │   - Stop alarm
   │   - MQTT publish: device/{serialNumber}/event { type: "fall_cancelled" }
   │   - Reset fall state
   │
   └── Timeout (no button press) → fall_confirmed
       - Alarm continues / changes pattern
       - MQTT publish: device/{serialNumber}/event { type: "fall_confirmed", magnitude, ... }
```

> ⚠️ **`mpu on` disables fall detection entirely.**
> The command `mpu on` enables IMU diagnostic stream (`isMpuDiagnosticMode()=true`), which completely disables fall detection. Never send `mpu on` during fall/ADL recording sessions — no `fall_confirmed` events will be generated.
> Node-RED was fixed (2026-03-30) to not send `mpu on` automatically when starting Fall/ADL sessions.

---

## 3. MPU6050 Calibration

### Method

Calibrate with device worn in actual use position (neck-mount, standing still). Never calibrate flat on a table — the orientation is wrong and offsets will be incorrect.

### Process

- Set `SOFTWARE_CALIBRATION_MODE true` in `sensor_tuning/MPU6050_Sensor.ino`
- Upload → open Serial Monitor → 3-second warmup countdown → 400 samples collected automatically
- Use EN/RST button on ESP32 board to reboot for multiple calibration rounds (no need to unplug USB)
- Choose the round where `|mag| (accel magnitude)` is closest to `1.0g`
- Copy `MPU_CAL_*` values back into code, set `SOFTWARE_CALIBRATION_MODE false`

### Locked Values (2026-03-30)

```cpp
// pose: คล้องคอยืนนิ่ง | 400 samples | 2026-03-30 | |mag|=1.248g
#define MPU_CAL_ACCEL_OFFSET_X_MS2  1.127f
#define MPU_CAL_ACCEL_OFFSET_Y_MS2  2.158f
#define MPU_CAL_ACCEL_OFFSET_Z_MS2 -0.036f
#define MPU_CAL_GYRO_OFFSET_X_RAD  -0.061f
#define MPU_CAL_GYRO_OFFSET_Y_RAD   0.011f
#define MPU_CAL_GYRO_OFFSET_Z_RAD  -0.020f
```

These values are locked in both `sensor_tuning` and `main_firmware`. Do not change unless the mounting position changes.

### swCal vs hwOff

- **swCal** = software offsets applied after I2C read in firmware (`MPU_CAL_*` defines) — used in both firmwares
- **hwOff** = hardware register offsets in IC — intentionally 0 in this project, never set

---

## 4. MQTT Topics (ESP32 Side)

### Published by ESP32

| Topic                        | Payload Type           | When                                              |
| ---------------------------- | ---------------------- | ------------------------------------------------- |
| `device/{serial}/event`      | Fall event envelope    | suspected_fall, fall_confirmed, tuning simulation |
| `device/{serial}/heartrate`  | HeartRatePayload       | Every HR reading (normal + abnormal)              |
| `device/{serial}/status`     | DeviceStatusPayload    | On connect, periodic heartbeat                    |
| `device/{serial}/config/ack` | DeviceConfigAckPayload | After applying config from backend                |

### Subscribed by ESP32

| Topic                    | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `device/{serial}/config` | Receive WiFi config, RESET_WIFI commands |

### Payload Structures

**Fall event payload**:

```json
{
  "type": "suspected_fall" | "fall_confirmed",
  "timestamp": <millis()>,
  "magnitude": <SVM float>,
  "postureDelta": <angle change float>
}
```

Note: `main_firmware` payload ส่งเฉพาะ processed snapshot ที่ backend ใช้จริง และไม่ส่ง raw accel / raw gyro เข้า event pipeline แล้ว เพราะ firmware สรุปผลออกมาเป็น `magnitude` และ `postureDelta` ให้ก่อน

Timestamp note: `timestamp` is `millis()` (uptime ms since boot), not Unix time. Node-RED should add its own wall-clock timestamp for cross-session correlation.

`fall_cancelled` payload (from FalseAlarmCancelButton.ino):

```json
{ "type": "fall_cancelled", "timestamp": <millis()>, "eventId": "<id if set>" }
```

Note: `fall_cancelled` has no `eventId` link to `suspected_fall`/`fall_confirmed` — correlation must be done by timestamp proximity.

Node-RED CSV only records `fall_confirmed` rows (not `suspected_fall` or `fall_cancelled`). To analyze false alarms that were cancelled, check Serial logs.

**Heart rate payload**:

```json
{
  "timestamp": <millis()>,
  "heartRate": <int BPM>,
  "zone": "low" | "normal" | "high",
  "confidence": "none" | "low" | "medium" | "high",
  "isAbnormal": <bool>,
  "alertType": "LOW" | "HIGH"
}
```

**Status payload**:

```json
{
  "timestamp": <millis()>,
  "online": true,
  "signalStrength": <RSSI dBm>,
  "ip": "<IP address>"
}
```

Runtime cadence: main firmware publishes device status every 5 seconds while WiFi/MQTT is connected, plus one retry 2 seconds after MQTT connects to reduce startup packet loss.

### Node-RED Fall Detection Sensor Lab IMU log

- Flow: `firmware/esp32/fall_detection_sensor_lab/node-red/flows/fall-detection-sensor-lab-flow.v2.json`
- Subscribe topic: `device/+/lab/imu` (published by `sensor_tuning` only; main runtime event topics untouched)
- Primary UI: Node-RED Dashboard at `/ui` (requires `@flowfuse/node-red-dashboard` devDependency). No manual inject nodes — Session ID input, 9 activity buttons, auto trial ID, 10s countdown, manual Stop, live values/chart/status
- Output: 1 Trial = 1 CSV `{sessionId}_{trialId}_{activityLabel}.csv` under `fall_detection_sensor_lab/runs/Sxx/raw/`; Node-RED auto-fills metadata (sessionId from input, trialId auto-increment, activityLabel/expectedType from the pressed activity button, note optional)
- Broker credentials set in Node-RED editor/env (`MQTT_USERNAME`/`MQTT_PASSWORD`), not committed in the flow JSON
- Capture: `sensor_tuning` publishes periodic `imu_sample` (non-fall coverage) plus `imu_impact` / `imu_decision` snapshots for thesis ch.3 (calculation) and ch.5 (Basic Activity Collection results). Manual Stop only — raw CSV may include post-action movement; summarize/select scripts pick event values (impact/peak + imu_decision)

---

## 5. BLE Provisioning Flow

```
1. ESP32 boots with no WiFi config in NVS
   → Enters BLE advertising mode
   → Service UUID: "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
   → Characteristics:
     - SSID: "4fafc202-1fb5-459e-8fcc-c5c9c331914b" (write)
     - Password: "4fafc203-1fb5-459e-8fcc-c5c9c331914b" (write)
     - Status: "4fafc204-1fb5-459e-8fcc-c5c9c331914b" (read+notify)

2. Mobile app scans for BLE devices with matching service UUID
   → Connects to ESP32
   → Writes SSID + Password to characteristics

3. ESP32 receives credentials
   → Updates BLE status to CONNECTING (0x01)
   → Stops BLE advertising
   → Attempts WiFi connection

4. WiFi result:
   ├── Success: Status → CONNECTED (0x02)
   │   → Save credentials to NVS
   │   → Notify CONNECTED, deinit BLE (free memory), then start MQTT connection
   │
   ├── Failed: Status → FAILED (0x03) or INVALID (0x04)
   │   → Resume BLE advertising
   │   → Allow retry
   │
   └── MQTT unavailable has no active BLE terminal status in current firmware

5. On RESET_WIFI command (from backend MQTT or manual):
   → Clear NVS WiFi credentials
   → Restart into BLE mode

6. On RESET_NVS / CLEAR_NVS command (from backend MQTT or manual):
   → Clear all NVS Preferences (WiFi, sensitivity, threshold configurations)
   → Clear internal WiFi flash
   → Restart into BLE mode
```

---

## 6. Data Structures (`types.h`)

```cpp
// Logging categories (bitmask)
enum SensorLogCategory : uint16_t {
  SENSOR_LOG_SYSTEM     = 1<<0,  // System events
  SENSOR_LOG_IMU_EVENT  = 1<<1,  // IMU fall events
  SENSOR_LOG_IMU_RAW    = 1<<2,  // Raw IMU data stream
  SENSOR_LOG_PPG_EVENT  = 1<<3,  // Pulse events (beat, zone change)
  SENSOR_LOG_PPG_RAW    = 1<<4,  // Raw PPG data
  SENSOR_LOG_FALL_FLOW  = 1<<5,  // Fall flow: detect → confirm/cancel
};

// IMU sensor data
struct MPU6050Data {
  float accelX, accelY, accelZ;    // Acceleration (includes gravity)
  float gyroX, gyroY, gyroZ;       // Gyroscope
  float totalAccel;                 // SVM magnitude
  float pitch, roll;                // Complementary Filter angles
  bool isInitialized;
};

// Cancel button state
struct FalseAlarmCancelButtonState {
  bool lastState, currentState, isPressed, isInitialized;
  unsigned long lastPressTime, pressStartTime, lastFallTimestamp;
  String activeFallEventId;
};

// Pulse sensor data
struct PulseSensorData {
  int rawValue;
  float voltage;
  int heartRate;                    // BPM
  String zone;                      // "low", "normal", "high"
  bool isInitialized;
  unsigned long lastPeakTime, lastCalculationTime;
  int peakCount;
  int peakBuffer[100];              // Rolling buffer
  int bufferIndex;
};

// Alert system state
struct AlertSystemState {
  bool isPlaying, isInitialized;
  unsigned long alertStartTime, alertDuration;
  int currentPattern, patternCount;
};
```

---

## 7. Sensor Tuning vs Main Firmware

| Feature       | `main_firmware` (Main)         | `sensor_tuning` (Calibration)      |
| ------------- | ------------------------------ | ---------------------------------- |
| WiFi          | BLE provisioning + NVS         | Hardcoded in `wifi_secrets.h`      |
| MQTT          | HiveMQ TLS or Local Mosquitto via `mqtt_secrets.h` | Local Mosquitto (lab)              |
| BLE           | Full provisioning flow         | None                               |
| Logging       | Runtime log categories         | SensorLogging.ino (MQTT telemetry) |
| Runtime constants | FallDetectionConfig.ino + WiFiConnectionManager.ino | RuntimeProfile.ino + build_profile.h (tuning-local) |
| Purpose       | Prototype wearable             | Lab calibration + data collection  |
| Cancel button | Full flow + MQTT publish       | Local only (no backend)            |

### build_profile.h — Build Modes

| Mode                             | Value | Sensors     | Use case                                                        |
| -------------------------------- | ----- | ----------- | --------------------------------------------------------------- |
| `FALLHELP_SINGLE_SENSOR_MPU6050` | 1     | MPU only    | Phase 1: Tune fall detection thresholds                         |
| `FALLHELP_SINGLE_SENSOR_PULSE`   | 2     | Pulse only  | Phase 2: Tune pulse sensor thresholds                           |
| `FALLHELP_SENSOR_COMBINED`       | 3     | MPU + Pulse | Phase 3: Combined recording — fall events + HR data in parallel |
| `FALLHELP_SINGLE_SENSOR_NONE`    | 0     | None        | Minimal boot test                                               |

**Rule:** Use SINGLE_SENSOR modes when tuning thresholds (isolate variables). Use COMBINED only after both sensors are individually tuned, for collecting fall+pulse data in the same session. Node-RED routes both streams to separate CSVs automatically — correlate by `Timestamp_ms`.

---

## 8. Fall Detection Sensor Lab (`firmware/esp32/fall_detection_sensor_lab/`)

```
fall_detection_sensor_lab/
├── README.md            # Overview + workflow (Thai)
├── trial_protocol.md    # Session/trial steps and 9 activities
├── csv_schema.md        # CSV column meaning and number formatting
├── selection_guide.md   # Criteria for AI agent to pick selected trials
├── chapter_usage.md     # How data maps into thesis ch.3 & ch.5
├── notes.md             # Issue log + post-collection checklist
├── examples/            # Mock CSV/MD format samples (NOT real results)
├── node-red/            # Node-RED flow source, Dockerfile, entrypoint, runtime/
│   ├── flows/           # fall-detection-sensor-lab-flow.v2.json
│   └── runtime/         # Node-RED userDir, ignored
├── scripts/             # validate_sensor_lab_log / summarize_selected / generate_chapter_examples (.mjs)
├── runs/Sxx/            # raw/ (Node-RED CSV), selected/ (AI-picked), session_notes.md
└── exports/             # selected_values_table.csv + ch.3/ch.5 markdown (generated)
```

### Scope

- **Basic Activity Collection only** — illustrative/proof-of-concept data for thesis ch.3 (how `magnitude` & `postureDelta` are computed) and ch.5 (Basic Activity test results)
- 9 activities, 24 trials, single session (`S01`), single subject; simulated falls onto padded surface
- Data shape is fixed to IMU activity CSV: `imu_sample`, `imu_impact`, and `imu_decision` rows for the selected trial window
- `sensor_tuning` adds `device/{serial}/lab/imu` publishing only; `main_firmware` and runtime event topics are untouched

### Workflow

```
sensor_tuning  → device/{serial}/lab/imu (imu_sample, imu_impact, imu_decision)
  → Node-RED Dashboard /ui → auto metadata (button+countdown), 1 Trial = 1 CSV → runs/Sxx/raw/
  → AI agent   → pick representative trials → runs/Sxx/selected/
  → npm run sensor-lab -- summarize → exports/selected_values_table.csv
  → npm run sensor-lab -- chapters  → exports/examples_for_fall_detection_sensor_lab.md + examples_for_chapter_5.md
```

Validate raw CSV anytime: `npm run sensor-lab -- validate`.

Framing note: example/export files show **format only** — never claim real results until real CSV is collected from a session.

---

## 9. Hardware Pin Map

| GPIO | Component         | Function                        |
| ---- | ----------------- | ------------------------------- |
| 25   | Grove Speaker SIG | Alert alarm output              |
| 27   | Push Button       | False alarm cancel (15s window) |
| 21   | MPU6050 SDA       | I2C data                        |
| 22   | MPU6050 SCL       | I2C clock                       |
| 34   | XD-58C Pulse      | ADC input (PPG analog signal)   |

---

## Working Note

- Separate Prototype firmware decisions from calibration-only behavior before changing code
- For changes affecting payload shape, fall timing, cancel flow, or device status behavior, review backend consumer expectations and update docs in the same change

---

## Related Docs

- [System Overview](system_overview.md)
- [IoT MQTT Architecture](../architecture/iot-mqtt.md)
- [Fall Detection System](../features/fall-detection.md)
- [Firmware Practical Operation Guide](../../firmware/esp32/docs/guides/PracticalOperationGuide.md)
