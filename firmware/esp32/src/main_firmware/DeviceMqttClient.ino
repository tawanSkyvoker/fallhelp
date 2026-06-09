/**
 * @file DeviceMqttClient.ino
 * @brief DeviceMqttClient: จัดการการรับส่งข้อมูลผ่านโปรโตคอล MQTT ของอุปกรณ์ FallHelp
 *
 * หน้าที่หลัก:
 * - เชื่อมต่อและรักษาการเชื่อมต่อกับ MQTT Broker (สนับสนุนทั้ง Local TCP และ Secure TLS กับ HiveMQ Cloud)
 * - ตรวจสอบและซิงค์เวลา NTP สำหรับการตรวจสอบความปลอดภัยของ SSL/TLS certificate
 * - สมัครข้อมูลและรับคำสั่งควบคุมระยะไกล (เช่น RESET_WIFI, RESET_NVS) ผ่าน config topic
 * - รายงานสถานะการเชื่อมต่อเครื่อง (keep-alive, status heartbeat) และส่งรายงานการตั้งค่ากลับไปยัง backend (config ACK)
 */

#include "types.h"
#include "mqtt_secrets.h"
#include <ArduinoJson.h>
#include <WiFi.h>

extern Preferences preferences;

// ============================================================================
// [1] DeviceMqttClient: device-side MQTT client ของ ESP32
// ============================================================================

void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintf("\n📨 มีข้อความเข้ามา [%s]\n", topic);

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error)
  {
    if (isRuntimeSerialOutputEnabled())
    {
      runtimeLogPrint("❌ แปลง JSON ไม่สำเร็จ: ");
      runtimeLogPrintln(error.c_str());
    }
    return;
  }



  String configTopic = "device/" + deviceSerial + "/config";
  if (String(topic) == configTopic)
  {
    String requestId = "";
    if (doc["requestId"].is<const char *>())
      requestId = doc["requestId"].as<String>();

    if (doc["action"].is<const char *>())
    {
      String action = doc["action"];
      if (action == "RESET_WIFI")
      {
        if (doc["deviceSerial"].is<const char *>())
        {
          String targetSerial = doc["deviceSerial"];
          if (targetSerial != deviceSerial)
          {
            if (isRuntimeSerialOutputEnabled())
              runtimeLogPrintln("⚠️ ข้ามคำสั่ง reset เพราะ serial ไม่ตรง");
            return;
          }
        }
        if (isRuntimeSerialOutputEnabled())
          runtimeLogPrintln("🔄 ได้รับคำสั่ง RESET_WIFI");
        if (requestId.length() > 0)
          publishConfigAck(requestId, true, "RESET_WIFI_ACCEPTED", "");
        publishStatus(false); // แจ้ง offline แบบสุภาพ
        mqtt.disconnect();
        clearWiFiConfig();
        delay(500);
        ESP.restart();
        return;
      }
      else if (action == "RESET_NVS" || action == "CLEAR_NVS")
      {
        if (doc["deviceSerial"].is<const char *>())
        {
          String targetSerial = doc["deviceSerial"];
          if (targetSerial != deviceSerial)
          {
            if (isRuntimeSerialOutputEnabled())
              runtimeLogPrintln("⚠️ ข้ามคำสั่ง reset NVS เพราะ serial ไม่ตรง");
            return;
          }
        }
        if (isRuntimeSerialOutputEnabled())
          runtimeLogPrintln("🔄 ได้รับคำสั่ง RESET_NVS / CLEAR_NVS ผ่าน MQTT");
        if (requestId.length() > 0)
          publishConfigAck(requestId, true, "RESET_NVS_ACCEPTED", "");
        publishStatus(false); // แจ้ง offline แบบสุภาพ
        mqtt.disconnect();

        // ล้างข้อมูล Preferences ทั้งหมดใน namespace หลัก
        preferences.clear();

        // ล้าง internal WiFi flash ของ ESP32
        WiFi.disconnect(true, true);
        WiFi.mode(WIFI_OFF);

        delay(1000);
        ESP.restart();
        return;
      }
    }

    if (doc["wifiSSID"].is<const char *>() && doc["wifiPassword"].is<const char *>())
    {
      String newSSID = doc["wifiSSID"];
      String newPass = doc["wifiPassword"];

      if (isRuntimeSerialOutputEnabled())
      {
        runtimeLogPrintln("⚙️ ได้รับค่า WiFi ใหม่ผ่าน MQTT!");
        runtimeLogPrintf("   SSID: %s\n", newSSID.c_str());
      }

      if (newSSID.length() == 0)
      {
        if (isRuntimeSerialOutputEnabled())
          runtimeLogPrintln("❌ ปฏิเสธ WiFi config: SSID ว่าง");
        if (requestId.length() > 0)
          publishConfigAck(requestId, false, "SSID_EMPTY", "");
        return;
      }

      // ตรวจสอบว่าค่าใหม่เหมือนกับค่าเดิมที่ใช้อยู่หรือไม่
      if (newSSID == savedSSID && newPass == savedPassword)
      {
        if (isRuntimeSerialOutputEnabled())
          runtimeLogPrintln("ℹ️ WiFi config ใหม่เหมือนกับค่าเดิม — ไม่ต้องรีสตาร์ต");
        if (requestId.length() > 0)
          publishConfigAck(requestId, true, "WIFI_CONFIG_NO_CHANGE", "Already connected to this network");
        return;
      }

      // บันทึกเป็น pending — ยังไม่ overwrite credential เดิม
      // commit เป็นค่าถาวรเมื่อ connect สำเร็จ หรือ rollback อัตโนมัติถ้าล้มเหลว
      savePendingWiFiConfig(newSSID, newPass);
      if (requestId.length() > 0)
      {
        publishConfigAck(requestId, true, "WIFI_PENDING_VERIFY", "");
      }

      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintln("🔄 บันทึก pending WiFi config แล้ว รีสตาร์ตเพื่อทดสอบ...");
      publishStatus(false); // แจ้ง offline แบบสุภาพ
      mqtt.disconnect();
      delay(1200);
      ESP.restart();
      return;
    }

    if (requestId.length() > 0)
    {
      publishConfigAck(requestId, false, "INVALID_CONFIG_PAYLOAD", "");
    }

    if (doc["mqttServer"].is<const char *>())
    {
      String newMQTTServer = doc["mqttServer"];
      if (isRuntimeSerialOutputEnabled())
      {
        runtimeLogPrintln("⚙️ ได้รับค่า MQTT server ใหม่ผ่าน MQTT!");
        runtimeLogPrintf("   MQTT Server: %s\n", newMQTTServer.c_str());
      }
      saveMQTTConfig(newMQTTServer);
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintln("🔄 รีสตาร์ตเพื่อใช้ค่า MQTT server ใหม่...");
      publishStatus(false); // แจ้ง offline แบบสุภาพ
      mqtt.disconnect();
      delay(1000);
      ESP.restart();
    }
  }
}

void reconnectMQTT()
{
  if (mqtt.connected())
    return;
  if (millis() < nextMqttRetryAt)
    return;

  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintf("   กำลังเชื่อมต่อ %s (%s:%d)...\n", getMqttBrokerLabel(), HIVEMQ_HOST, HIVEMQ_PORT);

  String clientId = "ESP32-" + deviceSerial.substring(deviceSerial.length() - 6);
  // แยก LWT ออกจาก /status เพื่อให้ backend แยก offline-from-broker ออกจาก heartbeat ปกติได้ชัด
  String willTopic = "device/" + deviceSerial + "/lwt";
  String willPayload = "{\"online\":false,\"source\":\"lwt\",\"timestamp\":" + String(millis()) + "}";

  if (connectMqttWithLastWill(clientId, willTopic, willPayload))
  {
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln(" เชื่อมต่อแล้ว!");
    mqttFailCount = 0;

    String configTopic = "device/" + deviceSerial + "/config";
    mqtt.subscribe(configTopic.c_str());
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintf("   subscribe แล้ว: %s\n", configTopic.c_str());



    publishStatus(true);
    // ส่ง status ซ้ำอีกครั้งเพื่อกัน packet loss บน QoS 0 หลังเพิ่งต่อ broker ได้
    pendingStatusRetryAt = millis() + 2000;
  }
  else
  {
    if (isRuntimeSerialOutputEnabled())
    {
      runtimeLogPrintf(" เชื่อมต่อไม่สำเร็จ (rc=%d)\n", mqtt.state());

#if FALLHELP_MQTT_USE_TLS
      char tlsError[128] = {0};
      const int tlsErrorCode = wifiClientSecure.lastError(tlsError, sizeof(tlsError));
      runtimeLogPrintf("   TLS error: code=%d message=%s\n", tlsErrorCode, tlsError);
#endif

      runtimeLogPrintf("   Heap: free=%u maxAlloc=%u\n", ESP.getFreeHeap(), ESP.getMaxAllocHeap());
    }

    mqttFailCount++;
    unsigned long backoff = min(5000UL << min(mqttFailCount, 3), 60000UL);
    nextMqttRetryAt = millis() + backoff;

    if (mqttFailCount >= 10)
    {
      if (isRuntimeSerialOutputEnabled())
      {
        runtimeLogPrintln("\n⚠️ MQTT ต่อไม่สำเร็จซ้ำหลายครั้ง!");
        runtimeLogPrintln("🔄 เริ่ม BLE provisioning เพื่อให้ตั้ง WiFi ใหม่...");
      }
      mqttFailCount = 0;
      resetBLESession();
    }
  }
}

const char *getMqttBrokerLabel()
{
  return FALLHELP_MQTT_BROKER_LABEL;
}

bool isMqttTlsEnabled()
{
#if FALLHELP_MQTT_USE_TLS
  return true;
#else
  return false;
#endif
}

bool isMqttSecretPlaceholder(const char *value)
{
  if (value == nullptr)
    return true;
  return strcmp(value, "your-username") == 0 || strcmp(value, "your-password") == 0;
}

bool isMqttAuthConfigured()
{
  return HIVEMQ_USERNAME[0] != '\0' && HIVEMQ_PASSWORD[0] != '\0' &&
         !isMqttSecretPlaceholder(HIVEMQ_USERNAME) &&
         !isMqttSecretPlaceholder(HIVEMQ_PASSWORD);
}

bool ensureMqttTlsClockSynced()
{
#if FALLHELP_MQTT_USE_TLS && HIVEMQ_TLS_VERIFY
  time_t now = time(nullptr);
  if (now > MQTT_TLS_VALID_UNIX_TIME)
    return true;

  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintln("⏱️ TLS: กำลัง sync เวลา NTP ก่อนตรวจ certificate...");

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  const unsigned long startedAt = millis();
  while (time(nullptr) <= MQTT_TLS_VALID_UNIX_TIME &&
         millis() - startedAt < MQTT_TLS_TIME_SYNC_TIMEOUT_MS)
  {
    delay(200);
  }

  now = time(nullptr);
  if (now <= MQTT_TLS_VALID_UNIX_TIME)
  {
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("⚠️ TLS: sync เวลาไม่สำเร็จ — strict certificate อาจต่อ MQTT ไม่ผ่าน");
    return false;
  }

  if (isRuntimeSerialOutputEnabled())
  {
    struct tm timeInfo;
    gmtime_r(&now, &timeInfo);

    char timeBuffer[32];
    strftime(timeBuffer, sizeof(timeBuffer), "%Y-%m-%d %H:%M:%S UTC", &timeInfo);
    runtimeLogPrintf("✅ TLS: เวลาเครื่องพร้อมแล้ว (%s)\n", timeBuffer);
  }

  return true;
#else
  return true;
#endif
}

bool connectMqttWithLastWill(const String &clientId, const String &willTopic, const String &willPayload)
{
  if (isMqttAuthConfigured())
  {
    return mqtt.connect(clientId.c_str(), HIVEMQ_USERNAME, HIVEMQ_PASSWORD,
                        willTopic.c_str(), 1, false, willPayload.c_str());
  }

  return mqtt.connect(clientId.c_str(),
                      willTopic.c_str(), 1, false, willPayload.c_str());
}

void setupMQTT()
{
  // เลือก transport ให้ตรง broker: Cloud = TLS, Local Mosquitto = TCP ปกติ
#if FALLHELP_MQTT_USE_TLS
  mqtt.setClient(wifiClientSecure);
#if HIVEMQ_TLS_VERIFY
  ensureMqttTlsClockSynced();

  // โหมด Strict: ตรวจสอบ CA cert จริง (แนะนำสำหรับ firmware หลัก)
  wifiClientSecure.setCACert(HIVEMQ_ROOT_CA);
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintln("🔒 TLS: ตรวจสอบแบบ strict (โหลด CA cert แล้ว)");
#else
  // โหมด Dev/test: ข้ามการตรวจ cert — ง่ายกว่า ไม่ต้องจัดการ certificate
  wifiClientSecure.setInsecure();
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintln("⚠️  MQTT TLS: insecure mode (dev/prototype)");
#endif
#else
  mqtt.setClient(wifiClient);
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintln("🔌 MQTT Transport: plain TCP (Local Mosquitto)");
#endif

  if (isRuntimeSerialOutputEnabled())
  {
    runtimeLogPrintf("\n📡 MQTT Broker [%s]: %s:%d\n", getMqttBrokerLabel(), HIVEMQ_HOST, HIVEMQ_PORT);
    runtimeLogPrintf("🔐 MQTT Auth: %s\n", isMqttAuthConfigured() ? "username/password" : "none");
  }

  mqtt.setServer(HIVEMQ_HOST, HIVEMQ_PORT);
  mqtt.setBufferSize(512);
  // ค่า LWT จะถูก trigger เมื่อ broker ไม่ได้รับ PINGREQ ในประมาณ 1.5x keepalive
  mqtt.setKeepAlive(isMqttTlsEnabled() ? 30 : 15);
}

void publishStatus(bool online)
{
  if (!mqtt.connected())
    return;
  String topic = "device/" + deviceSerial + "/status";
  JsonDocument doc;
  doc["timestamp"] = millis();
  doc["online"] = online;
  doc["wifiSSID"] = WiFi.SSID();
  doc["signalStrength"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  char buffer[128];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));
  mqtt.publish(topic.c_str(), (uint8_t *)buffer, len, true);
}

bool publishConfigAck(const String &requestId, bool success, const String &reason, const String &ipAddress)
{
  if (!mqtt.connected())
    return false;
  if (requestId.length() == 0)
    return false;
  String topic = "device/" + deviceSerial + "/config/ack";
  JsonDocument doc;
  doc["requestId"] = requestId;
  doc["success"] = success;
  doc["timestamp"] = millis();
  if (reason.length() > 0)
    doc["reason"] = reason;
  if (ipAddress.length() > 0)
    doc["ip"] = ipAddress;
  char buffer[256];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));
  return mqtt.publish(topic.c_str(), (uint8_t *)buffer, len);
}

// ─── MQTT Config Helpers ─────────────────────────────────────────────────────

void loadMQTTConfig()
{
  // ไม่ต้องโหลดจาก NVS อีกต่อไป — broker กำหนดใน mqtt_secrets.h
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintf("📡 MQTT Broker [%s]: %s:%d\n", getMqttBrokerLabel(), HIVEMQ_HOST, HIVEMQ_PORT);
}

void saveMQTTConfig(String server)
{
  // ไม่ต้อง save อีกต่อไป — แก้ HIVEMQ_HOST ใน mqtt_secrets.h โดยตรง
  (void)server;
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintln("⚠️  saveMQTTConfig: ไม่มีผล — ให้แก้ HIVEMQ_HOST ใน mqtt_secrets.h แทน");
}
