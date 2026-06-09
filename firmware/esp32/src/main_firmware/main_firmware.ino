/**
 * @file main_firmware.ino
 * @brief MainFirmware: entrypoint หลักของ Prototype firmware สำหรับอุปกรณ์ FallHelp
 *
 * หน้าที่หลัก:
 * - orchestrate ลำดับ boot ของ BLE, WiFi, MQTT และเซนเซอร์ทั้งหมด
 * - ถือ shared runtime state ของเครื่อง เช่น provisioning, reconnect
 * - เป็นศูนย์กลางของ CLI/maintenance path โดยไม่เปลี่ยน invariant หลักของ fall pipeline
 */

#include "types.h"
#include "mqtt_secrets.h"
#include <ArduinoJson.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <stdarg.h>
#include <string.h>
#include <time.h>

// ============================================================================
// [1] สวิตช์ตั้งค่าการทำงานของ Prototype firmware (Configuration Switches)
// ============================================================================

#define ENABLE_SENSORS true
// เปิด SensorManager (MPU/Pulse/Button) โดยตัวเปิดจริงของแต่ละ sensor ยังถูกคุมต่อใน SensorManager.ino


// เปิดคำสั่ง maintenance / demo เช่น simulated fall ผ่าน WiFi/MQTT path



// UUID สำหรับ BLE provisioning ที่ mobile app ใช้ส่ง WiFi credential เข้าเครื่อง
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID_SSID "4fafc202-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID_PASSWORD "4fafc203-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID_STATUS "4fafc204-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_DEVICE_NAME_PREFIX "FallDetector-"

#define WIFI_CHECK_INTERVAL 5000
#define STATUS_INTERVAL 5000
#define BLE_ADVERTISING_DURATION 1800000
#define BLE_REOPEN_INTERVAL 600000
#define WIFI_CONNECT_RETRY_DELAY_MS 500
#define WIFI_BOOT_CONNECT_MAX_ATTEMPTS 30
#define MQTT_TLS_TIME_SYNC_TIMEOUT_MS 10000
#define MQTT_TLS_VALID_UNIX_TIME 1700000000UL

// MQTT transport profile:
// - Cloud HiveMQ ใช้ TLS บนพอร์ต 8883
// - Local Mosquitto ใช้ TCP ปกติบนพอร์ต 1883
// ถ้า mqtt_secrets.h รุ่นเก่ายังไม่มี FALLHELP_MQTT_USE_TLS จะเดาจากพอร์ตเพื่อให้ local upload เดิมใช้ได้
#ifndef FALLHELP_MQTT_USE_TLS
#if HIVEMQ_PORT == 8883
#define FALLHELP_MQTT_USE_TLS 1
#else
#define FALLHELP_MQTT_USE_TLS 0
#endif
#endif

#ifndef FALLHELP_MQTT_BROKER_LABEL
#if FALLHELP_MQTT_USE_TLS
#define FALLHELP_MQTT_BROKER_LABEL "HiveMQ Cloud"
#else
#define FALLHELP_MQTT_BROKER_LABEL "Local Mosquitto"
#endif
#endif

#ifndef HIVEMQ_TLS_VERIFY
#define HIVEMQ_TLS_VERIFY 0
#endif

#ifndef HIVEMQ_USERNAME
#define HIVEMQ_USERNAME ""
#endif

#ifndef HIVEMQ_PASSWORD
#define HIVEMQ_PASSWORD ""
#endif

// ============================================================================
// [2] ระบบพิมพ์ log กลางของ runtime (Runtime Serial Logging)
// ============================================================================

constexpr bool FALLHELP_RUNTIME_SERIAL_OUTPUT = true;
bool isRuntimeSerialOutputEnabled() { return FALLHELP_RUNTIME_SERIAL_OUTPUT; }

template <typename T>
inline void runtimeLogPrint(const T &value)
{
  if (!isRuntimeSerialOutputEnabled())
    return;
  Serial.print(value);
}
inline void runtimeLogPrintln()
{
  if (!isRuntimeSerialOutputEnabled())
    return;
  Serial.println();
}
template <typename T>
inline void runtimeLogPrintln(const T &value)
{
  if (!isRuntimeSerialOutputEnabled())
    return;
  Serial.println(value);
}
inline void runtimeLogPrintf(const char *fmt, ...)
{
  if (!isRuntimeSerialOutputEnabled() || fmt == nullptr)
    return;
  char buffer[320];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buffer, sizeof(buffer), fmt, args);
  va_end(args);
  Serial.print(buffer);
}

// ============================================================================
// [3] ค่าคงที่ hardware และ shared runtime state (Hardware & Shared State)
// ============================================================================

#define ALERT_SPEAKER_PIN 25

// NVS + network client ของ Prototype firmware
Preferences preferences;
WiFiClient wifiClient;
WiFiClientSecure wifiClientSecure;
PubSubClient mqtt(wifiClientSecure);


// Shared machine state ที่หลาย flow ใช้ร่วมกัน
String deviceSerial = "";
String savedSSID = "";
String savedPassword = "";
unsigned long lastStatusTime = 0;
unsigned long lastWifiCheckTime = 0;
unsigned long lastBleLogTime = 0;
bool bleProvisioning = false;
unsigned long bleStartTime = 0;
bool shouldConnect = false;
bool isConnecting = false;

unsigned long nextWifiRetryAt = 0;
unsigned long nextMqttRetryAt = 0;
unsigned long lastAutoRestartAt = 0;
unsigned long lastBleReopenTime = 0;
unsigned long pendingStatusRetryAt = 0; // ส่ง status ซ้ำหลัง MQTT ต่อสำเร็จ (กัน QoS 0 หลุด)

int wifiFailCount = 0;
int mqttFailCount = 0;

// Pending WiFi config state — commit-after-success flow (ไม่เขียนทับ credential เดิมจนกว่า connect สำเร็จ)
String pendingSSID = "";
String pendingPassword = "";
bool hasPendingWiFiConfig = false;

extern PulseSensorData pulseData;
void publishHeartRateReading();

// ============================================================================
// [4] ประกาศฟังก์ชันข้ามโมดูล (Cross-Module Function Prototypes)
// ============================================================================

// Logging API ที่ไฟล์ sensor module เรียกกลับมายัง main_firmware
void sensorLogf(uint16_t category, const char *fmt, ...);
bool isSensorLogEnabled(uint16_t category);
unsigned long getSensorRawLogIntervalMs();

// Configuration / connectivity
void loadWiFiConfig();
bool saveWiFiConfig(String ssid, String password);
void clearWiFiConfig();
bool loadPendingWiFiConfig();
void savePendingWiFiConfig(String ssid, String password);
void commitPendingWiFiConfig();
void clearPendingWiFiConfig();
void loadMQTTConfig();
void saveMQTTConfig(String server);
unsigned long getFallCancelTimeoutMs();
int getWiFiProvisioningMaxAttempts();
void setupBLE();
void startBLEAdvertising();
void stopBLEAdvertising();
void updateBLEStatus(uint8_t status);
void resetBLESession();
void connectToWiFi();
void startStationMode();
void setupMQTT();
void reconnectMQTT();
void mqttCallback(char *topic, byte *payload, unsigned int length);
const char *getMqttBrokerLabel();
bool isMqttTlsEnabled();
bool isMqttSecretPlaceholder(const char *value);
bool isMqttAuthConfigured();
bool ensureMqttTlsClockSynced();
bool connectMqttWithLastWill(const String &clientId, const String &willTopic, const String &willPayload);
void publishStatus(bool online);
bool publishConfigAck(const String &requestId, bool success, const String &reason, const String &ipAddress);

void handleSerialCommands();

// Alert / sensors / local fall controls
bool isAlertSystemReady();
bool initAlertSystem();
void updateAlertSystem();
void alertSuccess();
void alertFall();
void stopAlert();
void cancelFallAlert();
bool isFallAlertActive();
void setSpeakerOutputEnabled(bool enabled);
bool isSpeakerOutputEnabled();
bool initFalseAlarmCancelButton();
void updateFalseAlarmCancelButton();
void setLastFallTimestamp(unsigned long timestamp);

void setActiveFallEventId(String eventId);
void resetFalseAlarmCancelButton();
bool consumeCancelButtonConfirmed();

void setFallDetectionSensitivity(int sensitivity);
int getFallDetectionSensitivity();
float getAccelThreshold();
unsigned long getDurationThreshold();
bool initSensorManager();
void updateSensorManager();
bool isPendingFallActive();

// ============================================================================

// ============================================================================
// ============================================================================
// [6] setup() ของเครื่อง (Boot Sequence / ลำดับการบูตระบบ)
// หน้าที่: ฟังก์ชันนี้จะถูกเรียกเพียง "ครั้งเดียว" เมื่อเสียบปลั๊กหรือกดปุ่ม Reset
// จะทำการเตรียมความพร้อมของ Hardware, อ่านค่าเดิมจากหน่วยความจำ (NVS), 
// เปิด Bluetooth เพื่อรอรับการตั้งค่า WiFi (Provisioning) และสั่งเปิดเซนเซอร์ทั้งหมด
// ============================================================================
void setup()
{
  pinMode(ALERT_SPEAKER_PIN, OUTPUT);
  digitalWrite(ALERT_SPEAKER_PIN, LOW);

  Serial.begin(115200);
  delay(1000);

  if (isRuntimeSerialOutputEnabled())
  {
    runtimeLogPrintln("\n╔══════════════════════════════════════════════════╗");
    runtimeLogPrintln("║      FallHelp ESP32 v1.0 - Prototype Runtime     ║");
    runtimeLogPrintln("║       BLE Provisioning | WiFi | MQTT | CLI       ║");
    runtimeLogPrintln("╚══════════════════════════════════════════════════╝");
  }

  uint64_t chipId = ESP.getEfuseMac();
  char serialBuf[20];
  snprintf(serialBuf, sizeof(serialBuf), "ESP32-%012llX", chipId);
  deviceSerial = String(serialBuf);
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintf("Device Serial: %s\n", deviceSerial.c_str());

  // เปิด namespace หลักของ Prototype firmware ก่อนโหลด config/runtime state ทุกชุด
  preferences.begin("fallhelp", false);
  loadWiFiConfig();
  loadPendingWiFiConfig(); // ตรวจ pending config ก่อนตัดสินใจ boot path
  loadMQTTConfig();
  if (isRuntimeSerialOutputEnabled())
  {
    runtimeLogPrintf("Fall cancel timeout: %lu ms\n", getFallCancelTimeoutMs());
    runtimeLogPrintf("WiFi provisioning attempts: %d\n", getWiFiProvisioningMaxAttempts());
  }

#if ENABLE_SENSORS
  initSensorManager();
#endif

  mqtt.setCallback(mqttCallback);

  if (savedSSID.length() > 0 || hasPendingWiFiConfig)
  {
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("\n📶 WiFi config found, connecting...");
    startStationMode();
  }
  else
  {
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("\n📡 No WiFi config, starting BLE Provisioning...");
    setupBLE();
    startBLEAdvertising();
  }

  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintln("\n✅ Ready (Serial CLI commands are ENABLED for Demo/Maintenance)");
}

// ============================================================================
// ============================================================================
// [7] loop() หลักของเครื่อง (Main Runtime Loop / วงรอบการทำงานหลัก)
// หน้าที่: ฟังก์ชันนี้จะถูกเรียกซ้ำๆ วนไปเรื่อยๆ ตลอดเวลาที่เปิดเครื่อง (เหมือนลูป while(true))
// กฎเหล็ก: ห้ามใช้คำสั่ง delay() นานๆ เด็ดขาด เพราะจะทำให้เซนเซอร์จับค่าไม่ทัน 
// ตัวระบบใช้วิธีเช็กเวลา (millis()) เพื่อทำหลายๆ อย่างสลับกันไป (Cooperative Multitasking)
// ============================================================================
void loop()
{
  bool wifiConnected = (WiFi.status() == WL_CONNECTED);

  if (bleProvisioning)
  {
    if (millis() - bleStartTime > BLE_ADVERTISING_DURATION)
    {
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintln("⏱️ BLE advertising timeout (30 min), stopping...");
      stopBLEAdvertising();
      lastBleReopenTime = millis();
    }
    else if (millis() - lastBleLogTime > 30000)
    {
      String shortId = deviceSerial.substring(deviceSerial.length() - 6);
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintf("📡 BLE Advertising... Name: %s%s (UUID: %s)\n", BLE_DEVICE_NAME_PREFIX, shortId.c_str(), SERVICE_UUID);
      lastBleLogTime = millis();
    }
  }
  else if (savedSSID.length() == 0 && millis() - lastBleReopenTime > BLE_REOPEN_INTERVAL)
  {
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("🔵 Periodic BLE wake-up (no WiFi config)...");
    setupBLE();
    startBLEAdvertising();
    lastBleReopenTime = millis();
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    if (!mqtt.connected())
    {
      reconnectMQTT();
    }
    mqtt.loop();

      // ส่ง status ซ้ำ 1 ครั้งหลัง MQTT ต่อสำเร็จครั้งแรก (กัน packet loss บน QoS 0)
    if (pendingStatusRetryAt > 0 && millis() >= pendingStatusRetryAt)
    {
      pendingStatusRetryAt = 0;
      if (mqtt.connected())
      {
        if (isRuntimeSerialOutputEnabled())
          runtimeLogPrintln("📡 Status retry (QoS 0 resilience)");
        publishStatus(true);
      }
    }

    if (millis() - lastStatusTime >= STATUS_INTERVAL)
    {
      publishStatus(true);
      lastStatusTime = millis();
    }
  }
  else if (!bleProvisioning)
  {
    if (savedSSID.length() > 0 && !isConnecting && !shouldConnect)
    {
      if (millis() - lastWifiCheckTime > WIFI_CHECK_INTERVAL)
      {
        if (isRuntimeSerialOutputEnabled())
          runtimeLogPrintln("⚠️ WiFi disconnected, reconnecting...");
        if (millis() >= nextWifiRetryAt)
        {
          WiFi.reconnect();
          unsigned long backoff = 5000UL << min(wifiFailCount, 3);
          nextWifiRetryAt = millis() + backoff;
        }
        lastWifiCheckTime = millis();
      }
    }
    else
    {
      if (millis() - lastWifiCheckTime > WIFI_CHECK_INTERVAL)
      {
        if (isRuntimeSerialOutputEnabled())
          runtimeLogPrintln("⚠️ No WiFi config found, starting BLE provisioning...");
        setupBLE();
        startBLEAdvertising();
        lastWifiCheckTime = millis();
      }
    }
  }

  if (shouldConnect)
  {
    shouldConnect = false;
    connectToWiFi();
  }

#if !ENABLE_SENSORS
  if (isFallAlertActive())
  {
    updateFalseAlarmCancelButton();
  }
#endif

#if ENABLE_SENSORS
  updateSensorManager();
#endif





  // เรียกใช้คำสั่ง CLI ทุก ๆ รอบ loop
  handleSerialCommands();

  // ไม่ใช้ delay() ที่นี่ — PulseSensorPlayground ใช้ software timer และต้องเรียก sawNewSample() ทุก 2ms
  // ถ้าใส่ delay(10) loop จะช้าเกินไปและทำให้ BPM คลาดเคลื่อน
}

// ─── คำสั่ง Serial CLI ───────────────────────────────────────────────
void handleSerialCommands()
{
  if (Serial.available() > 0)
  {
    String input = Serial.readStringUntil('\n');
    input.trim();
    input.toLowerCase();

    if (input.length() == 0)
      return;

    if (isRuntimeSerialOutputEnabled())
    {
      runtimeLogPrintln("\n[DEBUG] รับคำสั่ง CLI: " + input);
    }

    if (input == "reset_nvs")
    {
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintln("[SYSTEM] กำลังลบ preferences ที่บันทึกไว้ทั้งหมด...");
      preferences.clear();
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintln("[SYSTEM] ล้าง NVS แล้ว กำลังรีสตาร์ตใน 3 วินาที...");
      delay(3000);
      ESP.restart();
    }
    else if (input == "info")
    {
      if (isRuntimeSerialOutputEnabled())
      {
        runtimeLogPrintln("---------- ข้อมูลอุปกรณ์ ----------");
        runtimeLogPrintf("Serial Number: %s\n", deviceSerial.c_str());
        runtimeLogPrintf("WiFi Status: %s\n", WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");
        runtimeLogPrintf("IP Address: %s\n", WiFi.localIP().toString().c_str());
        runtimeLogPrintf("MQTT Status: %s\n", mqtt.connected() ? "Connected" : "Disconnected");
        runtimeLogPrintf("MQTT Broker: %s (%s:%d)\n", getMqttBrokerLabel(), HIVEMQ_HOST, HIVEMQ_PORT);
        runtimeLogPrintf("MQTT Transport: %s\n", isMqttTlsEnabled() ? "TLS" : "plain TCP");
        runtimeLogPrintf("Fall cancel timeout: %lu ms\n", getFallCancelTimeoutMs());
        runtimeLogPrintf("WiFi provisioning attempts: %d\n", getWiFiProvisioningMaxAttempts());
        runtimeLogPrintln("---------------------------------");
      }
    }
    else
    {
      if (isRuntimeSerialOutputEnabled())
      {
        runtimeLogPrintln("[DEBUG] ไม่รู้จักคำสั่งนี้");
        runtimeLogPrintln("คำสั่งที่ใช้ได้: reset_nvs, info");
      }
    }
  }
}

// ─── ระบบ Sensor Logging ─────────────────────────────────────────────
bool isSensorLogEnabled(uint16_t category)
{
  if (!isRuntimeSerialOutputEnabled())
    return false;
  constexpr uint16_t FALLHELP_SENSOR_LOG_MASK = SENSOR_LOG_SYSTEM | SENSOR_LOG_IMU_EVENT | SENSOR_LOG_PPG_EVENT | SENSOR_LOG_FALL_FLOW;
  return (category & FALLHELP_SENSOR_LOG_MASK) != 0;
}

unsigned long getSensorRawLogIntervalMs() { return 1000UL; }

void sensorLogf(uint16_t category, const char *fmt, ...)
{
  if (!isSensorLogEnabled(category) || fmt == nullptr)
    return;
  const char *categoryLabel = "GEN";
  if (category & SENSOR_LOG_SYSTEM)
    categoryLabel = "SYSTEM";
  else if (category & SENSOR_LOG_IMU_EVENT)
    categoryLabel = "IMU";
  else if (category & SENSOR_LOG_PPG_EVENT)
    categoryLabel = "PPG";
  else if (category & SENSOR_LOG_FALL_FLOW)
    categoryLabel = "FALL";

  char message[320];
  va_list args;
  va_start(args, fmt);
  vsnprintf(message, sizeof(message), fmt, args);
  va_end(args);
  runtimeLogPrintf("[SLOG][%s] %s\n", categoryLabel, message);
}
