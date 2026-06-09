// esp32_sensor_tuning.ino — เฟิร์มแวร์ Hardware-only สำหรับปรับจูนเซนเซอร์
// ไม่มีระบบ BLE Provisioning และไม่รับ Config จาก Backend
// รองรับ: WiFi + MQTT + Serial Monitor สำหรับจูนค่าแบบ Real-time

#include "build_profile.h"
#include "types.h"
#include <ArduinoJson.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>

// ====================================================================
// [1] ค่ากำหนด WiFi และ MQTT สำหรับรอบจูน (Local WiFi & MQTT)
// ====================================================================
// ข้อมูลรหัสผ่าน WiFi และ Local MQTT IP (wifi_secrets.h)
#if defined(__has_include)
#if __has_include("wifi_secrets.h")
#include "wifi_secrets.h"
#endif
#endif

#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

#ifndef LOCAL_MQTT_HOST
#define LOCAL_MQTT_HOST ""
#endif
#ifndef LOCAL_MQTT_PORT
#define LOCAL_MQTT_PORT 1883
#endif

// ====================================================================
// [2] ค่าตั้งต้นของ runtime (Runtime Config)
// ====================================================================
#define ALERT_SPEAKER_PIN 25
#define WIFI_CONNECT_TIMEOUT_MS 15000UL    // รอต่อ WiFi สูงสุด 15 วินาที
#define WIFI_RETRY_INTERVAL_MS 5000UL      // หน่วงเวลา 5 วินาทีก่อนลองต่อ WiFi ใหม่
#define STATUS_PUBLISH_INTERVAL_MS 15000UL // ส่งสถานะเครื่อง (Online) ทุกๆ 15 วิ
#define MQTT_RETRY_BASE_MS 2000UL          // เวลาเริ่มต้นในการพยายามต่อ MQTT ใหม่ (2 วิ)
#define MQTT_RETRY_MAX_MS 10000UL          // รอสูงสุด 10 วินาทีในการต่อ MQTT

// ====================================================================
// [3] สถานะรวมของ firmware จูน (Global Objects & State)
// ====================================================================
Preferences preferences;           // สำหรับอ่าน/เขียนข้อมูลลงหน่วยความจำบอร์ด
                                  // ใช้กับ runtime profile / MQTT config เท่านั้น
WiFiClient wifiClient;             // สำหรับ Local MQTT (ไม่มี TLS)
PubSubClient mqtt(wifiClient);

String deviceSerial = ""; // ชื่อรหัสของบอร์ด (อิงจาก MAC Address)
String mqttServer = "";
unsigned long nextWifiRetryAt = 0;
unsigned long nextMqttRetryAt = 0;
unsigned long lastStatusPublishAt = 0;
int mqttFailCount = 0; // นับจำนวนครั้งที่ต่อ MQTT พลาด
bool wifiCredentialWarned = false;
bool simulatedFallActive = false;
unsigned long simulatedFallStartTime = 0;
bool mqttPulseModeHinted = false;
String serialCommandBuffer = ""; // บัฟเฟอร์เก็บข้อความคำสั่งที่พิมพ์เข้ามา
bool mqttRuntimeEnabled = true;  // สวิตช์เปิด/ปิดการใช้ MQTT
bool wifiRuntimeEnabled = true;  // สวิตช์เปิด/ปิดการใช้ WiFi runtime

static constexpr size_t SERIAL_CMD_MAX_LEN = 180; // ความยาวคำสั่งสูงสุด

// สถานะการประมวลผลคำสั่ง
enum CommandExecStatus : uint8_t
{
  CMD_EXEC_OK = 0,
  CMD_EXEC_ERROR = 1,
  CMD_EXEC_UNKNOWN = 2
};

// ====================================================================
// [4] ฟังก์ชันจากโมดูลอื่น (External Functions)
// ====================================================================
void initRuntimeProfileDefaults();
unsigned long getFallCancelTimeoutMs();
const char *getFallRuntimeProfileName();

void initSensorLogRuntimeState();
bool handleSensorLogCommand(const String &cmdLower);
void printSensorLogStatus();
const char *getSensorLogProfileName();
unsigned long getSensorRawLogIntervalMs();
bool isMpuDiagnosticMode();
bool isSoftwareCalibrationMode();

bool initSensorManager();
void updateSensorManager();
void printSensorStatus();

bool initAlertSystem();
void setSpeakerOutputEnabled(bool enabled);
bool isSpeakerOutputEnabled();
void alertFall();
void cancelFallAlert();
bool isFallAlertActive();

bool initFalseAlarmCancelButton();
void resetFalseAlarmCancelButton();
void setLastFallTimestamp(unsigned long timestamp);
bool consumeCancelButtonConfirmed();

void setPulsePlotterMode(bool enabled);
bool isPulsePlotterMode();
void printHeartRateZoneConfig();

void setFallDetectionSensitivity(int sensitivity);
int getFallDetectionSensitivity();
float getAccelThreshold();
unsigned long getDurationThreshold();
float getPostureThreshold();

extern PulseSensorData pulseData;
extern void publishHeartRateEvent(String eventType);

// ====================================================================
// [5] ฟังก์ชันภายในของไฟล์หลัก (Internal Functions)
// ====================================================================
String buildDeviceSerial();
void loadMQTTConfig();
void saveMQTTConfig(const String &server);
void setupMQTT();
void connectWiFiIfNeeded();
void reconnectMQTT();
void mqttCallback(char *topic, byte *payload, unsigned int length);
void publishStatus(bool online);
String getMqttCmdTopic();
String getMqttCmdAckTopic();
void publishCommandAck(const String &cmd, CommandExecStatus status,
                       const String &message, const String &requestId);
bool publishSimulatedFallLifecycleEvent(const char *type);
void startSimulatedFallAlert();
void stopSimulatedFallAlert(const char *reason);
void updateSimulatedFallAlert();
void handleSerialCommands();
CommandExecStatus executeCommand(const String &cmdRaw, bool fromMqtt,
                                 String *responseMessage);
void printHelp();
const char *mqttStateText(int state);
void printI2CScan();
void runAutoCalibrationTool(); // ฟังก์ชันสำหรับจูน Offset ใหม่

// ====================================================================
// ====================================================================
// [6] ลำดับเริ่มต้นของเครื่อง (Setup / ลำดับการบูต)
// หน้าที่: เตรียมความพร้อมพื้นฐาน เช่น เปิด Serial Monitor (ความเร็ว 115200),
// ดึง MAC Address มาตั้งชื่อบอร์ด, ต่อ WiFi และเรียก SensorManager ให้ตื่นขึ้นมาทำงาน
// ====================================================================
void setup()
{
  pinMode(ALERT_SPEAKER_PIN, OUTPUT);
  digitalWrite(ALERT_SPEAKER_PIN, LOW); // ปิดลำโพงไว้ก่อนกันเสียงดังตอนบูต

  Serial.begin(115200);
  delay(600);

  deviceSerial = buildDeviceSerial(); // สร้างชื่ออุปกรณ์จาก MAC Address

  // พิมพ์หน้าจอต้อนรับ
  Serial.println("\n==============================================");
  Serial.println(" FallHelp Hardware-Only Firmware");
  if (ENABLE_MQTT_RUNTIME)
  {
    Serial.println(" WiFi + MQTT + Sensor Tuning (No Backend Flow)");
  }
  else
  {
    Serial.println(" Local Serial Sensor Tuning (MQTT Disabled)");
  }
  Serial.println("==============================================");
  Serial.printf("Device Serial: %s\n", deviceSerial.c_str());

  preferences.begin("fallhelp_tune", false); // เปิดระบบหน่วยความจำแยกสำหรับโหมดจูน

  // โหลดค่าต่างๆ
  initRuntimeProfileDefaults();
  initSensorLogRuntimeState();
  if (!isSoftwareCalibrationMode())
  {
    if (ENABLE_MQTT_RUNTIME)
    {
      loadMQTTConfig();
      setupMQTT();
    }
    else
    {
      mqttServer = String(LOCAL_MQTT_HOST);
    }
  }

  // เริ่มต้นเซนเซอร์และฮาร์ดแวร์
  initAlertSystem();
#if ENABLE_SENSORS
  initSensorManager();
#endif

  // ✅ หากต้องการจูนหาค่า Offset ของ MPU6050 ใหม่ ให้เอาคอมเมนต์บรรทัดข้างล่างนี้ออก:
  // runAutoCalibrationTool(); 

  if (!isSoftwareCalibrationMode())
  {
    // ตั้งค่าการเชื่อมต่อ
    if (ENABLE_MQTT_RUNTIME)
    {
      mqtt.setCallback(mqttCallback);
      connectWiFiIfNeeded();
    }
    else
    {
      Serial.println("MQTT runtime: DISABLED (local serial tuning mode)");
    }

    // พิมพ์สรุปสถานะ
    Serial.printf("Runtime Profile: %s (%lu ms)\n", getFallRuntimeProfileName(),
                  getFallCancelTimeoutMs());
    Serial.printf("Sensor Log Mode: %s\n", getSensorLogProfileName());
    if (ENABLE_MQTT_RUNTIME)
    {
      Serial.printf("MQTT host: %s:%d\n", mqttServer.c_str(), LOCAL_MQTT_PORT);
    }
    else
    {
      Serial.println("MQTT host: DISABLED");
    }
    printHelp(); // แสดงคำสั่งที่ใช้ได้
  }
}

// ====================================================================
// [7] เครื่องมือช่วยปรับจูน (Tuning Utilities)
// ====================================================================

/**
 * ฟังก์ชันสำหรับจูนหาค่า Offset ของ MPU6050 ใหม่แบบละเอียด
 * วิธีใช้: เปิดคอมเมนต์เรียกใช้ใน setup() แล้ววางบอร์ดให้นิ่งบนพื้นราบที่สุด
 */
#if ENABLE_MPU6050_SENSOR
#include <MPU6050.h>
extern MPU6050RuntimeAddress mpu; // อ้างอิงตัวแปร mpu จากไฟล์ MPU6050_Sensor.ino

void runAutoCalibrationTool() {
  Serial.println("\n[CALIBRATION TOOL] เริ่มต้นกระบวนการจูนหาค่า Offset ใหม่...");
  Serial.println("[CALIBRATION TOOL] ⚠️ คำเตือน: กรุณาวางอุปกรณ์ให้นิ่งที่สุดบนพื้นราบ ⚠️");
  
  // ให้เวลาเตรียมตัว 5 วินาที
  for(int i=5; i>0; i--) {
    Serial.printf("[CALIBRATION TOOL] จะเริ่มใน %d...\n", i);
    delay(1000);
  }

  Serial.println("[CALIBRATION TOOL] กำลังเริ่มการคำนวณ (ใช้เวลาประมาณ 30-60 วินาที)...");
  
  // รีเซ็ต Offset เป็น 0 ก่อนเริ่มจูน
  mpu.setXAccelOffset(0);
  mpu.setYAccelOffset(0);
  mpu.setZAccelOffset(0);
  mpu.setXGyroOffset(0);
  mpu.setYGyroOffset(0);
  mpu.setZGyroOffset(0);

  // ใช้ฟังก์ชัน Calibration ภายในของ Library (วนซ้ำ 15 รอบเพื่อความแม่นยำ)
  mpu.CalibrateAccel(15);
  mpu.CalibrateGyro(15);

  Serial.println("\n==================================================");
  Serial.println("🎯 จูนเสร็จสิ้น! ค่า Locked Offsets ใหม่ของคุณคือ:");
  Serial.println("==================================================");
  Serial.println("// ก๊อปปี้ส่วนนี้ไปวางแทนที่ในไฟล์ MPU6050_Sensor.ino");
  Serial.printf("#define MPU_OFFSET_ACCEL_X %d\n", mpu.getXAccelOffset());
  Serial.printf("#define MPU_OFFSET_ACCEL_Y %d\n", mpu.getYAccelOffset());
  Serial.printf("#define MPU_OFFSET_ACCEL_Z %d\n", mpu.getZAccelOffset());
  Serial.printf("#define MPU_OFFSET_GYRO_X  %d\n", mpu.getXGyroOffset());
  Serial.printf("#define MPU_OFFSET_GYRO_Y  %d\n", mpu.getYGyroOffset());
  Serial.printf("#define MPU_OFFSET_GYRO_Z  %d\n", mpu.getZGyroOffset());
  Serial.println("==================================================");
  Serial.println("[CALIBRATION TOOL] ระบบหยุดการทำงานเพื่อให้คุณก๊อปปี้ค่า");
  
  while(1) { delay(100); } // หยุดรอ
}
#else
void runAutoCalibrationTool() {
  Serial.println("[CALIBRATION TOOL] MPU6050 is disabled in this build profile (PULSE mode).");
}
#endif // ENABLE_MPU6050_SENSOR

// ====================================================================
// [8] วงรอบหลักของ firmware จูน (Main Loop / วงรอบการทำงานหลัก)
// หน้าที่: รันตลอดเวลาเพื่อ 1. รอรับคำสั่งจาก Serial, 2. เลี้ยงการเชื่อมต่อ WiFi/MQTT,
// และ 3. ที่สำคัญที่สุดคือคอยสั่งให้ SensorManager ไปกวาดข้อมูลจากเซนเซอร์ทุกตัว
// (ห้ามใส่ delay นานๆ เด็ดขาด เพราะจะทำให้กราฟที่ได้ออกมาสะดุด)
// ====================================================================
void loop()
{
  handleSerialCommands(); // คอยเช็คว่าผู้ใช้พิมพ์คำสั่งอะไรมาใน Serial ไหม

  // ระบบรักษาการเชื่อมต่อเครือข่าย (ข้ามทั้งหมดเมื่ออยู่ในโหมด calibration)
  if (!isSoftwareCalibrationMode() && ENABLE_MQTT_RUNTIME && wifiRuntimeEnabled)
  {
    connectWiFiIfNeeded(); // ถ้า WiFi หลุด ให้ต่อใหม่

    if (WiFi.status() == WL_CONNECTED && mqttRuntimeEnabled)
    {
      reconnectMQTT(); // ถ้า MQTT หลุด ให้ต่อใหม่
      if (mqtt.connected())
      {
        mqtt.loop();

        // ส่งสถานะเครื่อง (Online) ตามรอบเวลา
        if (millis() - lastStatusPublishAt >= STATUS_PUBLISH_INTERVAL_MS)
        {
          publishStatus(true);
          lastStatusPublishAt = millis();
        }
      }
    }
  }

// อัปเดตการอ่านค่าเซนเซอร์
#if ENABLE_SENSORS
  updateSensorManager();
#endif

  updateSimulatedFallAlert(); // อัปเดตสถานะจำลองการล้ม
}

// ====================================================================
// [9] การเชื่อมต่อเครือข่ายและ MQTT (Connectivity)
// ====================================================================

String buildDeviceSerial()
{
  uint64_t chipId = ESP.getEfuseMac();
  char serialBuf[20];
  snprintf(serialBuf, sizeof(serialBuf), "ESP32-%012llX", chipId);
  return String(serialBuf);
}

void loadMQTTConfig()
{
  if (!ENABLE_MQTT_RUNTIME)
  {
    mqttServer = String(LOCAL_MQTT_HOST);
    return;
  }

  String stored = preferences.getString("mqttServer", "");
  if (stored.length() == 0)
  {
    mqttServer = String(LOCAL_MQTT_HOST);
    Serial.printf("MQTT host from default: %s\n", mqttServer.c_str());
    return;
  }

  mqttServer = stored;
  Serial.printf("MQTT host from NVS: %s\n", mqttServer.c_str());
}

void saveMQTTConfig(const String &server)
{
  if (!ENABLE_MQTT_RUNTIME)
  {
    mqttServer = server;
    return;
  }

  preferences.putString("mqttServer", server);
  mqttServer = server;
  Serial.printf("MQTT host saved: %s\n", mqttServer.c_str());
}

void setupMQTT()
{
  if (!ENABLE_MQTT_RUNTIME)
    return;
  if (mqttServer.length() == 0)
    return;

  mqtt.setServer(mqttServer.c_str(), LOCAL_MQTT_PORT);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(60);
}

// ฟังก์ชันสำหรับต่อ WiFi (ถ้ายังไม่ต่อ)
void connectWiFiIfNeeded()
{
  if (!ENABLE_MQTT_RUNTIME || !wifiRuntimeEnabled)
    return;
  if (WiFi.status() == WL_CONNECTED)
    return;

  if (strlen(WIFI_SSID) == 0)
  {
    if (!wifiCredentialWarned)
    {
      Serial.println("⚠️ WiFi credentials are empty. Create wifi_secrets.h from wifi_secrets.h.example.");
      wifiCredentialWarned = true;
    }
    return;
  }

  if (millis() < nextWifiRetryAt)
    return;
  nextWifiRetryAt = millis() + WIFI_RETRY_INTERVAL_MS;

  Serial.printf("📶 Connecting WiFi '%s'...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setTxPower(WIFI_POWER_11dBm); // ลด TX power เพื่อลด current spike → ป้องกัน voltage sag บน MPU6050
  WiFi.setSleep(false);              // ปิด modem sleep เพื่อลด state transition ของวิทยุระหว่างจูนเซนเซอร์
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_CONNECT_TIMEOUT_MS)
  {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.printf("✅ WiFi connected: %s\n", WiFi.localIP().toString().c_str());
    nextMqttRetryAt = 0;
    reconnectMQTT();
    return;
  }

  Serial.println("❌ WiFi connect timeout. Retry later.");
}

// ฟังก์ชันสำหรับต่อ MQTT พร้อมกลไก Backoff (หน่วงเวลาเพิ่มขึ้นเรื่อยๆ ถ้าต่อไม่ติด)
void reconnectMQTT()
{
  if (!ENABLE_MQTT_RUNTIME || !mqttRuntimeEnabled)
    return;
  if (mqtt.connected() || WiFi.status() != WL_CONNECTED || mqttServer.length() == 0)
    return;
  if (millis() < nextMqttRetryAt)
    return;

  String clientId = "ESP32-" + deviceSerial.substring(deviceSerial.length() - 6);
  String willTopic = "device/" + deviceSerial + "/status";
  String willPayload = "{\"online\":false,\"timestamp\":" + String(millis()) + "}";

  Serial.print("📡 Connecting MQTT...");
  if (mqtt.connect(clientId.c_str(), willTopic.c_str(), 1, true, willPayload.c_str()))
  {
    Serial.println(" connected");
    mqttFailCount = 0;
    nextMqttRetryAt = 0;

    // ติดตามช่องคำสั่งเพื่อรับคำสั่งจากระยะไกล
    String cmdTopic = getMqttCmdTopic();
    if (mqtt.subscribe(cmdTopic.c_str(), 1))
    {
      Serial.printf("✅ MQTT command topic subscribed: %s\n", cmdTopic.c_str());
    }
    else
    {
      Serial.printf("❌ Failed to subscribe command topic: %s\n", cmdTopic.c_str());
    }
    Serial.println("ℹ️ Hardware-only mode: config topic is disabled, command topic is enabled");
    publishStatus(true);
    return;
  }

  // ถ้าต่อไม่ติด ให้เพิ่มระยะเวลารอ (Backoff) ป้องกันการสแปมเซิร์ฟเวอร์
  mqttFailCount++;
  unsigned long backoff = MQTT_RETRY_BASE_MS << min(mqttFailCount, 3);
  nextMqttRetryAt = millis() + min(backoff, MQTT_RETRY_MAX_MS);

  int state = mqtt.state();
  Serial.printf(" failed (rc=%d: %s), retry in %lu ms\n", state,
                mqttStateText(state), nextMqttRetryAt - millis());

#if ENABLE_PULSE_SENSOR && !ENABLE_MPU6050_SENSOR
  if (!mqttPulseModeHinted && state == -2)
  {
    mqttPulseModeHinted = true;
    Serial.println("ℹ️ Pulse-only tuning can proceed via USB Serial even when MQTT is disconnected.");
  }
#endif
}

// รับข้อความจาก MQTT
void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  if (!ENABLE_MQTT_RUNTIME)
    return;

  String topicStr = String(topic);
  String cmdTopic = getMqttCmdTopic();

  if (topicStr != cmdTopic)
  {
    Serial.printf("📨 Ignored inbound MQTT topic: %s\n", topic);
    return;
  }

  String payloadText;
  payloadText.reserve(length + 1);
  for (unsigned int i = 0; i < length; i++)
  {
    payloadText += (char)payload[i];
  }
  payloadText.trim();

  // แปลง JSON ให้เป็นคำสั่ง
  String commandText = payloadText;
  String requestId = "";
  if (payloadText.length() > 0 && payloadText[0] == '{')
  {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payloadText);
    if (!err)
    {
      if (doc["cmd"].is<const char *>())
      {
        commandText = String(doc["cmd"].as<const char *>());
      }
      if (doc["requestId"].is<const char *>())
      {
        requestId = String(doc["requestId"].as<const char *>());
      }
    }
  }

  String responseMessage;
  CommandExecStatus status = executeCommand(commandText, true, &responseMessage);
  publishCommandAck(commandText, status, responseMessage, requestId);
}

void publishStatus(bool online)
{
  if (!ENABLE_MQTT_RUNTIME || !mqtt.connected())
    return;

  String topic = "device/" + deviceSerial + "/status";
  JsonDocument doc;
  doc["timestamp"] = millis();
  doc["online"] = online;
  doc["signalStrength"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();

  char buffer[128];
  serializeJson(doc, buffer);
  mqtt.publish(topic.c_str(), buffer, true);
}

String getMqttCmdTopic() { return "device/" + deviceSerial + "/cmd"; }
String getMqttCmdAckTopic() { return "device/" + deviceSerial + "/cmd_ack"; }

void publishCommandAck(const String &cmd, CommandExecStatus status,
                       const String &message, const String &requestId)
{
  if (!ENABLE_MQTT_RUNTIME || !mqtt.connected())
    return;

  JsonDocument doc;
  doc["timestamp"] = millis();
  doc["deviceSerial"] = deviceSerial;
  doc["cmd"] = cmd;
  doc["ok"] = status == CMD_EXEC_OK;
  doc["status"] = status == CMD_EXEC_OK ? "ok" : (status == CMD_EXEC_UNKNOWN ? "unknown" : "error");
  doc["message"] = message;
  if (requestId.length() > 0)
  {
    doc["requestId"] = requestId;
  }

  char payloadBuffer[320];
  size_t written = serializeJson(doc, payloadBuffer, sizeof(payloadBuffer));
  if (written > 0)
  {
    mqtt.publish(getMqttCmdAckTopic().c_str(), payloadBuffer, false);
  }
}

// ====================================================================
// [10] การจำลองเหตุการณ์การล้ม (Simulation Flow)
// ====================================================================

bool publishSimulatedFallLifecycleEvent(const char *type)
{
  if (!ENABLE_MQTT_RUNTIME)
    return false;
  if (!mqtt.connected())
  {
    Serial.printf("⚠️ Cannot publish simulated %s - MQTT not connected\n", type);
    return false;
  }

  String topic = "device/" + deviceSerial + "/event";
  JsonDocument doc;

  doc["type"] = type; 
  doc["source"] = "simulation";
  doc["timestamp"] = millis();
  
  // ค่าคงที่สำหรับทดสอบ (Simple Test Values)
  // 3.5g และ 60 deg เป็นค่าที่ชัวร์ว่าล้มแน่นอนสำหรับทุก threshold
  doc["magnitude"] = 3.50;
  doc["postureDelta"] = 60.0;

  char buffer[384];
  serializeJson(doc, buffer);

  bool published = mqtt.publish(topic.c_str(), buffer);
  if (published)
  {
    Serial.printf("📤 Simulated %s published to MQTT\n", type);
  }
  else
  {
    Serial.printf("❌ Failed to publish simulated %s\n", type);
  }

  return published;
}

void startSimulatedFallAlert()
{
  if (simulatedFallActive)
  {
    Serial.println("ℹ️ Simulation already active");
    return;
  }

  if (!initFalseAlarmCancelButton())
  {
    Serial.println("❌ Cannot start simulation: cancel button not ready");
    return;
  }

  simulatedFallActive = true;
  simulatedFallStartTime = millis();
  resetFalseAlarmCancelButton();
  setLastFallTimestamp(simulatedFallStartTime);
  alertFall();
  publishSimulatedFallLifecycleEvent("suspected_fall");

  Serial.printf("🚨 Simulated fall alert started (%lus timeout period)\n",
                getFallCancelTimeoutMs() / 1000UL);
}

void stopSimulatedFallAlert(const char *reason)
{
  if (!simulatedFallActive)
    return;

  simulatedFallActive = false;
  simulatedFallStartTime = 0;
  cancelFallAlert();
  resetFalseAlarmCancelButton();

  if (reason != nullptr && reason[0] != '\0')
  {
    Serial.printf("🛑 Simulated fall alert stopped: %s\n", reason);
  }
  else
  {
    Serial.println("🛑 Simulated fall alert stopped");
  }
}

void updateSimulatedFallAlert()
{
  if (!simulatedFallActive)
    return;

  // เลิกถ้ากดปุ่ม
  if (consumeCancelButtonConfirmed())
  {
    stopSimulatedFallAlert("cancel button pressed");
    return;
  }

  // ส่งแจ้งเตือนถ้าหมดเวลา 15 วิ
  unsigned long elapsed = millis() - simulatedFallStartTime;
  if (elapsed < getFallCancelTimeoutMs())
  {
    return;
  }

  publishSimulatedFallLifecycleEvent("fall_confirmed");
  stopSimulatedFallAlert("cancel timeout elapsed");
}

// ====================================================================
// [11] ระบบรับคำสั่งผ่าน Serial (Command Line Interface)
// ====================================================================

// อ่านข้อความที่พิมพ์เข้ามาทีละตัวอักษรจนกว่าจะกด Enter (\n)
void handleSerialCommands()
{
  while (Serial.available() > 0)
  {
    char ch = static_cast<char>(Serial.read());

    if (ch == '\r')
      continue;

    if (ch == '\n')
    {
      String cmd = serialCommandBuffer;
      serialCommandBuffer = "";
      cmd.trim();
      if (cmd.length() > 0)
      {
        (void)executeCommand(cmd, false, nullptr);
      }
      continue;
    }

    // ป้องกันบัฟเฟอร์ล้น
    if (serialCommandBuffer.length() >= SERIAL_CMD_MAX_LEN)
    {
      serialCommandBuffer = "";
      Serial.println("❌ Serial command too long. Cleared buffer.");
      continue;
    }

    serialCommandBuffer += ch;
  }
}

// ประมวลผลคำสั่งต่างๆ ที่พิมพ์เข้ามา
CommandExecStatus executeCommand(const String &cmdRaw, bool fromMqtt,
                                 String *responseMessage)
{
  String cmd = cmdRaw;
  cmd.trim();
  if (cmd.length() == 0)
  {
    if (responseMessage != nullptr)
      *responseMessage = "Empty command";
    return CMD_EXEC_ERROR;
  }

  String cmdLower = cmd;
  cmdLower.toLowerCase();

  // ส่งให้ SensorLogging จัดการพวกลอจิกเปิด/ปิด Log
  if (handleSensorLogCommand(cmdLower))
  {
    if (responseMessage != nullptr)
      *responseMessage = "Sensor log command applied";
    return CMD_EXEC_OK;
  }

  // ---------------- หมวดทั่วไป ----------------
  if (cmdLower == "help")
  {
    printHelp();
    if (responseMessage != nullptr)
      *responseMessage = "Help printed";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "info")
  {
    Serial.printf("Device: %s\n", deviceSerial.c_str());
    if (ENABLE_MQTT_RUNTIME)
    {
      Serial.printf("WiFi runtime: %s\n", wifiRuntimeEnabled ? "ON" : "OFF");
      Serial.printf("MQTT runtime: %s\n", mqttRuntimeEnabled ? "ON" : "OFF");
      Serial.printf("WiFi: %s\n", WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
      if (WiFi.status() == WL_CONNECTED)
      {
        Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
      }
      Serial.printf("MQTT host: %s:%d\n", mqttServer.c_str(), LOCAL_MQTT_PORT);
      Serial.printf("MQTT: %s\n", mqtt.connected() ? "CONNECTED" : "DISCONNECTED");
    }
    else
    {
      Serial.println("WiFi: DISABLED");
      Serial.println("MQTT: DISABLED");
    }
    Serial.printf("Runtime Profile: %s (%lu ms)\n", getFallRuntimeProfileName(), getFallCancelTimeoutMs());
    printSensorLogStatus();
    printSensorStatus();
    if (responseMessage != nullptr)
      *responseMessage = "Info printed";
    return CMD_EXEC_OK;
  }

  // ---------------- หมวด Network ----------------
  if (cmdLower == "wifi status")
  {
    if (!ENABLE_MQTT_RUNTIME)
    {
      Serial.println("WiFi: DISABLED");
      if (responseMessage != nullptr)
        *responseMessage = "WiFi disabled in this firmware build";
      return CMD_EXEC_OK;
    }
    Serial.printf("WiFi: %s\n", WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
    if (WiFi.status() == WL_CONNECTED)
    {
      Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
    }
    if (responseMessage != nullptr)
      *responseMessage = WiFi.status() == WL_CONNECTED ? "WiFi connected" : "WiFi disconnected";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "wifi reconnect")
  {
    if (!ENABLE_MQTT_RUNTIME)
    {
      if (responseMessage != nullptr)
        *responseMessage = "WiFi disabled in this firmware build";
      return CMD_EXEC_ERROR;
    }
    if (fromMqtt)
    {
      if (responseMessage != nullptr)
        *responseMessage = "wifi reconnect is serial-only for safety";
      return CMD_EXEC_ERROR;
    }
    WiFi.disconnect();
    nextWifiRetryAt = 0;
    Serial.println("🔄 WiFi reconnect requested");
    if (responseMessage != nullptr)
      *responseMessage = "WiFi reconnect requested";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "wifi on")
  {
    if (!ENABLE_MQTT_RUNTIME)
    {
      if (responseMessage != nullptr)
        *responseMessage = "WiFi disabled in this firmware build";
      return CMD_EXEC_ERROR;
    }

    wifiRuntimeEnabled = true;
    nextWifiRetryAt = 0;
    Serial.println("✅ WiFi runtime enabled");
    connectWiFiIfNeeded();
    if (responseMessage != nullptr)
      *responseMessage = "WiFi runtime enabled";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "wifi off")
  {
    if (!ENABLE_MQTT_RUNTIME)
    {
      if (responseMessage != nullptr)
        *responseMessage = "WiFi disabled in this firmware build";
      return CMD_EXEC_ERROR;
    }

    mqttRuntimeEnabled = false;
    wifiRuntimeEnabled = false;
    if (mqtt.connected())
    {
      publishStatus(false);
      mqtt.disconnect();
    }
    WiFi.disconnect(true, false);
    Serial.println("✅ WiFi runtime disabled (MQTT disconnected too)");
    if (responseMessage != nullptr)
      *responseMessage = "WiFi runtime disabled";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "mqtt show")
  {
    if (!ENABLE_MQTT_RUNTIME)
    {
      Serial.println("MQTT runtime: DISABLED");
      if (responseMessage != nullptr)
        *responseMessage = "MQTT disabled in this firmware build";
      return CMD_EXEC_OK;
    }
    Serial.printf("MQTT host: %s\n", mqttServer.c_str());
    Serial.printf("MQTT port: %d\n", LOCAL_MQTT_PORT);
    Serial.printf("MQTT connected: %s\n", mqtt.connected() ? "YES" : "NO");
    Serial.printf("MQTT cmd topic: %s\n", getMqttCmdTopic().c_str());
    Serial.printf("MQTT cmd ack topic: %s\n", getMqttCmdAckTopic().c_str());
    if (responseMessage != nullptr)
      *responseMessage = "MQTT status printed";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "mqtt on")
  {
    if (!ENABLE_MQTT_RUNTIME)
    {
      if (responseMessage != nullptr)
        *responseMessage = "MQTT disabled in this firmware build";
      return CMD_EXEC_ERROR;
    }

    wifiRuntimeEnabled = true;
    mqttRuntimeEnabled = true;
    nextWifiRetryAt = 0;
    nextMqttRetryAt = 0;
    mqttFailCount = 0;
    Serial.println("✅ MQTT runtime enabled");
    connectWiFiIfNeeded();
    if (WiFi.status() == WL_CONNECTED)
    {
      reconnectMQTT();
    }
    if (responseMessage != nullptr)
      *responseMessage = "MQTT runtime enabled";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "mqtt off")
  {
    if (!ENABLE_MQTT_RUNTIME)
    {
      if (responseMessage != nullptr)
        *responseMessage = "MQTT disabled in this firmware build";
      return CMD_EXEC_ERROR;
    }

    mqttRuntimeEnabled = false;
    if (mqtt.connected())
    {
      publishStatus(false);
      mqtt.disconnect();
    }
    Serial.println("✅ MQTT runtime disabled (WiFi remains available)");
    if (responseMessage != nullptr)
      *responseMessage = "MQTT runtime disabled";
    return CMD_EXEC_OK;
  }

  // ตัวอย่างคำสั่งเปลี่ยน IP ของ MQTT: "mqtt host 192.168.1.100"
  if (cmdLower.startsWith("mqtt host "))
  {
    if (!ENABLE_MQTT_RUNTIME)
    {
      if (responseMessage != nullptr)
        *responseMessage = "MQTT disabled in this firmware build";
      return CMD_EXEC_ERROR;
    }
    if (fromMqtt)
    {
      if (responseMessage != nullptr)
        *responseMessage = "mqtt host is serial-only for safety";
      return CMD_EXEC_ERROR;
    }

    String newHost = cmd.substring(10);
    newHost.trim();
    if (newHost.length() == 0)
    {
      Serial.println("❌ Invalid MQTT host. Use: mqtt host <ip-or-hostname>");
      if (responseMessage != nullptr)
        *responseMessage = "Invalid MQTT host";
      return CMD_EXEC_ERROR;
    }

    saveMQTTConfig(newHost);
    setupMQTT();
    mqtt.disconnect();
    nextMqttRetryAt = 0;
    mqttFailCount = 0;
    Serial.printf("✅ MQTT host updated: %s\n", mqttServer.c_str());
    reconnectMQTT();
    if (responseMessage != nullptr)
      *responseMessage = "MQTT host updated";
    return CMD_EXEC_OK;
  }

  // ... (คำสั่งอื่นๆ เช่น mqtt reset, mqtt on, mqtt off, profile)
  // ---------------- หมวด ปรับแต่งเซนเซอร์ (Tuning) ----------------

  if (cmdLower == "fall config")
  {
    Serial.printf("Fall sensitivity: %d (0=low,1=medium,2=high)\n", getFallDetectionSensitivity());
    Serial.printf("Accel threshold: %.2f g\n", getAccelThreshold());
    Serial.printf("Duration threshold: %lu ms\n", getDurationThreshold());
    Serial.printf("Posture threshold: %.0f deg\n", getPostureThreshold());
    if (responseMessage != nullptr)
      *responseMessage = "Fall config printed";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "fall sensitivity low")
  {
    setFallDetectionSensitivity(0);
    Serial.println("✅ Fall sensitivity set to LOW");
    if (responseMessage != nullptr)
      *responseMessage = "Fall sensitivity set to low";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "fall sensitivity medium")
  {
    setFallDetectionSensitivity(1);
    Serial.println("✅ Fall sensitivity set to MEDIUM");
    if (responseMessage != nullptr)
      *responseMessage = "Fall sensitivity set to medium";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "fall sensitivity high")
  {
    setFallDetectionSensitivity(2);
    Serial.println("✅ Fall sensitivity set to HIGH");
    if (responseMessage != nullptr)
      *responseMessage = "Fall sensitivity set to high";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "plot ppg")
  {
    bool nextEnabled = !isPulsePlotterMode();
    setPulsePlotterMode(nextEnabled);
    Serial.printf("✅ PPG plotter mode %s\n", nextEnabled ? "enabled" : "disabled");
    if (responseMessage != nullptr)
      *responseMessage = nextEnabled ? "PPG plotter enabled" : "PPG plotter disabled";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "sim fall")
  {
    if (simulatedFallActive)
    {
      stopSimulatedFallAlert("manual stop");
      if (responseMessage != nullptr)
        *responseMessage = simulatedFallActive ? "Simulated fall still active" : "Simulated fall stopped";
    }
    else
    {
      startSimulatedFallAlert();
      if (responseMessage != nullptr)
        *responseMessage = "Simulated fall started";
    }
    return CMD_EXEC_OK;
  }

  if (cmdLower == "sim_hr_high")
  {
    Serial.println("💓 [SIM] Simulating HIGH Heart Rate...");
    pulseData.heartRate = 130;
    pulseData.zone = "high";
    publishHeartRateEvent("high");
    if (responseMessage != nullptr)
      *responseMessage = "Simulated HIGH HR sent";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "sim_hr_low")
  {
    Serial.println("💓 [SIM] Simulating LOW Heart Rate...");
    pulseData.heartRate = 45;
    pulseData.zone = "low";
    publishHeartRateEvent("low");
    if (responseMessage != nullptr)
      *responseMessage = "Simulated LOW HR sent";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "test_alert")
  {
    Serial.println("🔊 [ALERT] Testing speaker system...");
    alertFall();
    delay(3000);
    cancelFallAlert();
    Serial.println("🔇 [ALERT] Test complete.");
    if (responseMessage != nullptr)
      *responseMessage = "Alert test complete";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "i2c scan")
  {
    printI2CScan(); // เช็คสาย I2C ว่าต่อถูกไหม เผื่อเซนเซอร์หาไม่เจอ
    if (responseMessage != nullptr)
      *responseMessage = "I2C scan printed";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "reboot")
  {
    if (fromMqtt)
    {
      if (responseMessage != nullptr)
        *responseMessage = "reboot is serial-only for safety";
      return CMD_EXEC_ERROR;
    }
    Serial.println("🔄 Rebooting...");
    delay(300);
    ESP.restart();
    if (responseMessage != nullptr)
      *responseMessage = "Rebooting";
    return CMD_EXEC_OK;
  }

  if (cmdLower == "reset_nvs" || cmdLower == "reset nvs")
  {
    if (fromMqtt)
    {
      if (responseMessage != nullptr)
        *responseMessage = "reset_nvs is serial-only for safety";
      return CMD_EXEC_ERROR;
    }
    Serial.println("🔄 Clearing all saved preferences (NVS)...");
    preferences.clear();
    Serial.println("🔄 NVS Cleared. Restarting device in 3 seconds...");
    if (responseMessage != nullptr)
      *responseMessage = "NVS cleared. Rebooting...";
    delay(3000);
    ESP.restart();
    return CMD_EXEC_OK;
  }

  Serial.printf("❓ Unknown command: %s\n", cmd.c_str());
  Serial.println("Type 'help' for available commands.");
  if (responseMessage != nullptr)
    *responseMessage = "Unknown command";
  return CMD_EXEC_UNKNOWN;
}

// ====================================================================
// [12] เมนูช่วยเหลือและข้อความสถานะ (Help & Status Text)
// ====================================================================

// พิมพ์เมนูคำสั่งสำหรับรอบจูนปัจจุบัน
void printHelp()
{
  Serial.println("\nCommands:");
  if (ENABLE_MQTT_RUNTIME)
  {
    Serial.printf("  MQTT remote command topic: %s\n", getMqttCmdTopic().c_str());
    Serial.printf("  MQTT ack topic: %s\n", getMqttCmdAckTopic().c_str());
    Serial.println("  Example payloads:");
    Serial.println("    plain: mpu test");
    Serial.println("    json : {\"cmd\":\"fall sensitivity high\",\"requestId\":\"C01-01\"}");
  }
  else
  {
    Serial.println("  MQTT runtime: disabled (PPG local tuning mode)");
  }
  Serial.println("  info               - show runtime/wifi/mqtt/sensor status");
  Serial.println("  wifi on|off        - enable/disable WiFi runtime");
  Serial.println("  wifi reconnect     - reconnect WiFi immediately");
  Serial.println("  mqtt show          - show MQTT runtime status");
  Serial.println("  mqtt on|off        - enable/disable MQTT while keeping WiFi available");
  Serial.println("  fall config        - show active fall thresholds (ดูค่าเกณฑ์การล้มปัจจุบัน)");
  Serial.println("  fall sensitivity low|medium|high (ปรับความไวการล้ม)");
  Serial.println("  i2c scan           - scan I2C bus on GPIO21/22 (สแกนสายสัญญาณ)");
  Serial.println("  sim fall           - toggle simulated fall start/stop (จำลองการล้ม)");
  Serial.println("  sim_hr_high        - send HIGH heart rate (130 BPM) manually");
  Serial.println("  sim_hr_low         - send LOW heart rate (45 BPM) manually");
  Serial.println("  test_alert         - test speaker 3 seconds");
  Serial.println("  reset_nvs          - completely clear memory and reboot");
  Serial.println("  reboot             - restart ESP32");
}

// แปลง MQTT state code เป็นข้อความที่อ่านง่ายบน Serial
const char *mqttStateText(int state)
{
  switch (state)
  {
  case -4:
    return "connection timeout";
  case -3:
    return "connection lost";
  case -2:
    return "TCP connect failed (host/port unreachable)";
  case -1:
    return "disconnected";
  case 0:
    return "connected";
  case 1:
    return "bad protocol";
  case 2:
    return "bad client id";
  case 3:
    return "server unavailable";
  case 4:
    return "bad credentials";
  case 5:
    return "not authorized";
  default:
    return "unknown";
  }
}
