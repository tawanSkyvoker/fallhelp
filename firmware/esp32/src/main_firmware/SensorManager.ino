/**
 * @file SensorManager.ino
 * @brief SensorManager: ตัว orchestrator ของเซนเซอร์ทั้งหมดใน `main_firmware`
 *
 * หน้าที่หลัก:
 * - คุมการ init / update / recovery ของ IMU, pulse sensor, cancel button และ alert system
 * - แยกสถานะ enabled ออกจาก ready เพื่อให้ firmware รู้ว่า "ตั้งใจเปิด" กับ "พร้อมใช้งานจริง" ต่างกัน
 * - ส่ง sensor heartbeat ขึ้น MQTT เพื่อช่วยตรวจสุขภาพฮาร์ดแวร์ในระบบรวม
 */

#include "types.h"
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <Wire.h>

// ============================================================================
// [1] ค่าคงที่ด้านเวลา (Timing Configuration)
// ============================================================================
#define SENSOR_STATUS_INTERVAL 30000     // ส่งรายงานสถานะเซนเซอร์ขึ้น Cloud ทุกๆ 30 วินาที
#define SENSOR_INIT_RETRY_DELAY 5000    // ถ้าเซนเซอร์หลุด ให้พยายามต่อใหม่ทุกๆ 5 วินาที

// ============================================================================
// [2] สถานะรวมของเซนเซอร์ (Sensor Manager State)
// ============================================================================

struct SensorManagerState {
  bool mpu6050Enabled;                 // อนุญาตให้ใช้ MPU6050 ไหม?
  bool pulseSensorEnabled;             // อนุญาตให้ใช้เซนเซอร์ชีพจรไหม?
  bool falseAlarmCancelButtonEnabled;  // อนุญาตให้ใช้ปุ่มยกเลิกไหม?
  bool alertSystemEnabled;             // อนุญาตให้ใช้เสียงเตือนไหม?
  bool i2cBusInitialized;              // ระบบสายส่งข้อมูล I2C พร้อมหรือยัง?

  bool mpu6050Ready;                   // MPU6050 เชื่อมต่อสำเร็จและพร้อมใช้
  bool pulseSensorReady;               // ชีพจรพร้อมใช้
  bool falseAlarmCancelButtonReady;    // ปุ่มกดพร้อมใช้
  bool alertSystemReady;               // ลำโพงพร้อมใช้

  unsigned long lastStatusPublish;     // เวลาล่าสุดที่ส่งสถานะขึ้น Cloud
  unsigned long lastErrorCheck;        // เวลาล่าสุดที่เช็คว่ามีเซนเซอร์ตัวไหนพังไหม

  bool isInitialized;                  // ตัวจัดการเซนเซอร์ภาพรวมพร้อมทำงานแล้ว
};

SensorManagerState sensorMgr = {true, true, true, true, false, false, false, false, false, 0, 0, false};

// ประกาศฟังก์ชันให้มองเห็นกัน
bool initSensorManager();
void updateSensorManager();
void publishSensorStatus();
void checkSensorErrors();
bool ensureI2CBus(bool forceReset = false);
void enableSensor(String sensorName, bool enable);
bool isSensorReady(String sensorName);
void printSensorStatus();

// ============================================================================
// [3] การจัดการ I2C bus (I2C Bus Management)
// ============================================================================

bool ensureI2CBus(bool forceReset) {
  // หากสั่งบังคับรีเซ็ต (เช่น เซนเซอร์ค้าง) ให้ปิด I2C ทิ้งก่อน
  if (forceReset && sensorMgr.i2cBusInitialized) {
    Wire.end();
    sensorMgr.i2cBusInitialized = false;
    delay(20);
  }

  // ถ้า I2C ยังไม่เปิด ให้ทำการเปิดใช้งานที่ขา 21 (SDA) และ 22 (SCL)
  if (!sensorMgr.i2cBusInitialized) {
    sensorMgr.i2cBusInitialized = Wire.begin(21, 22);
    if (!sensorMgr.i2cBusInitialized) {
      sensorLogf(SENSOR_LOG_SYSTEM, "I2C bus init failed");
      return false;
    }
    Wire.setClock(100000); // ตั้งความเร็วการคุยที่ 100kHz (มาตรฐาน)
    delay(20);
  }

  return true;
}

// ============================================================================
// [4] การเริ่มต้นเซนเซอร์ทั้งหมด (Initialization)
// ============================================================================

bool initSensorManager() {
  bool anySuccess = false;

  // โหลดค่า threshold/sensitivity ของ fall flow ก่อน init โมดูลที่ต้องใช้อ้างอิง
  initFallDetectionConfig();

  // 1. เริ่มต้น MPU6050
  if (sensorMgr.mpu6050Enabled) {
    if (!ensureI2CBus(false)) {
      sensorMgr.mpu6050Ready = false;
      if (isRuntimeSerialOutputEnabled())
        Serial.println("I2C bus not ready (will retry)");
    } else {
      sensorMgr.mpu6050Ready = initMPU6050();
      if (sensorMgr.mpu6050Ready) anySuccess = true;
    }
  }

  // 2. เริ่มต้นเซนเซอร์ชีพจร
  if (sensorMgr.pulseSensorEnabled) {
    sensorMgr.pulseSensorReady = initPulseSensor();
    if (sensorMgr.pulseSensorReady) anySuccess = true;
  }

  // 3. เริ่มต้นปุ่มยกเลิกฉุกเฉิน
  if (sensorMgr.falseAlarmCancelButtonEnabled) {
    sensorMgr.falseAlarmCancelButtonReady = initFalseAlarmCancelButton();
    if (sensorMgr.falseAlarmCancelButtonReady) anySuccess = true;
  }

  // 4. เริ่มต้นระบบเสียงเตือน
  if (sensorMgr.alertSystemEnabled) {
    sensorMgr.alertSystemReady = initAlertSystem();
    if (sensorMgr.alertSystemReady) anySuccess = true;
  }

  sensorMgr.isInitialized = anySuccess;
  sensorMgr.lastStatusPublish = millis();
  sensorMgr.lastErrorCheck = millis();

  if (!anySuccess) {
    if (isRuntimeSerialOutputEnabled())
      Serial.println("Sensor manager init failed: no sensors ready");
  }

  return anySuccess;
}

// ============================================================================
// [5] วงรอบหลักของตัวจัดการเซนเซอร์ (Main Update Loop)
// ============================================================================

void updateSensorManager() {
  // ถ้าระบบยังไม่มี sensor ตัวไหนพร้อม ให้ retry แบบถี่ต่ำเพื่อกัน boot loop รัวเกินไป
  if (!sensorMgr.isInitialized) {
    if (millis() > 2000 && millis() - sensorMgr.lastErrorCheck >= SENSOR_INIT_RETRY_DELAY) {
      sensorMgr.lastErrorCheck = millis();
      initSensorManager();
    }
    return;
  }

  if (sensorMgr.mpu6050Enabled && sensorMgr.mpu6050Ready) {
    updateMPU6050();
  }

  if (sensorMgr.pulseSensorEnabled && sensorMgr.pulseSensorReady) {
    updatePulseSensor();
  }

  if (sensorMgr.falseAlarmCancelButtonEnabled && sensorMgr.falseAlarmCancelButtonReady) {
    updateFalseAlarmCancelButton();
  }

  if (sensorMgr.alertSystemEnabled && sensorMgr.alertSystemReady) {
    updateAlertSystem();
  }

  if (millis() - sensorMgr.lastErrorCheck >= SENSOR_INIT_RETRY_DELAY) {
    checkSensorErrors();
    sensorMgr.lastErrorCheck = millis();
  }

  if (millis() - sensorMgr.lastStatusPublish >= SENSOR_STATUS_INTERVAL) {
    publishSensorStatus();
    sensorMgr.lastStatusPublish = millis();
  }
}

// ============================================================================
// [6] ระบบกู้คืนเซนเซอร์ (Auto-Recovery)
// ============================================================================

void checkSensorErrors() {
  if (sensorMgr.mpu6050Enabled && !sensorMgr.mpu6050Ready) {
    if (ensureI2CBus(true)) {
      sensorMgr.mpu6050Ready = initMPU6050();
    } else {
      sensorMgr.mpu6050Ready = false;
    }
  }

  if (sensorMgr.pulseSensorEnabled && !sensorMgr.pulseSensorReady) {
    sensorMgr.pulseSensorReady = initPulseSensor();
  }
}

// ============================================================================
// [7] การส่ง sensor heartbeat ขึ้น MQTT (Sensor Heartbeat Publishing)
// ============================================================================

void publishSensorStatus() {
  if (!mqtt.connected()) return;

  String topic = "device/" + deviceSerial + "/sensors/status";
  JsonDocument doc;
  doc["timestamp"] = millis();

  JsonObject mpu6050 = doc["mpu6050"].to<JsonObject>();
  mpu6050["enabled"] = sensorMgr.mpu6050Enabled;
  mpu6050["ready"] = sensorMgr.mpu6050Ready;
  if (sensorMgr.mpu6050Ready) {
    MPU6050Data mpuData = getMPU6050Data();
    mpu6050["accelX"] = mpuData.accelX;
    mpu6050["accelY"] = mpuData.accelY;
    mpu6050["accelZ"] = mpuData.accelZ;
    mpu6050["totalAccel"] = mpuData.totalAccel;
  }

  JsonObject pulse = doc["pulse"].to<JsonObject>();
  pulse["enabled"] = sensorMgr.pulseSensorEnabled;
  pulse["ready"] = sensorMgr.pulseSensorReady;
  if (sensorMgr.pulseSensorReady) {
    PulseSensorData pulseData = getPulseSensorData();
    pulse["heartRate"] = pulseData.heartRate;
    pulse["zone"] = pulseData.zone;
    pulse["rawValue"] = pulseData.rawValue;
  }

  JsonObject cancelButton = doc["falseAlarmCancel"].to<JsonObject>();
  cancelButton["enabled"] = sensorMgr.falseAlarmCancelButtonEnabled;
  cancelButton["ready"] = sensorMgr.falseAlarmCancelButtonReady;
  if (sensorMgr.falseAlarmCancelButtonReady) {
    FalseAlarmCancelButtonState cancelState = getFalseAlarmCancelButtonState();
    cancelButton["cancelTimeoutActive"] = isCancelTimeoutActive();
    cancelButton["lastFallTimestamp"] = cancelState.lastFallTimestamp;
  }

  char buffer[512];
  serializeJson(doc, buffer);
  mqtt.publish(topic.c_str(), buffer);
}

// ============================================================================
// [8] Utility / Getters / Setters
// ============================================================================

void printSensorStatus() {
  if (isRuntimeSerialOutputEnabled()) {
    Serial.println("\n--- Sensor Status ---");
    Serial.printf("MPU6050:     %s %s\n", sensorMgr.mpu6050Enabled ? "ENABLED" : "DISABLED", sensorMgr.mpu6050Ready ? "✅" : "❌");
    Serial.printf("Pulse Sensor: %s %s\n", sensorMgr.pulseSensorEnabled ? "ENABLED" : "DISABLED", sensorMgr.pulseSensorReady ? "✅" : "❌");
    Serial.printf("False Alarm Cancel: %s %s\n", sensorMgr.falseAlarmCancelButtonEnabled ? "ENABLED" : "DISABLED", sensorMgr.falseAlarmCancelButtonReady ? "✅" : "❌");
    Serial.printf("Alert System: %s %s\n", sensorMgr.alertSystemEnabled ? "ENABLED" : "DISABLED", sensorMgr.alertSystemReady ? "✅" : "❌");
    Serial.println("-------------------\n");
  }
}

void enableSensor(String sensorName, bool enable) {
  if (sensorName == "mpu6050") {
    sensorMgr.mpu6050Enabled = enable;
  } else if (sensorName == "pulse") {
    sensorMgr.pulseSensorEnabled = enable;
  } else if (sensorName == "falseAlarmCancel" || sensorName == "cancel") {
    sensorMgr.falseAlarmCancelButtonEnabled = enable;
  }
}

bool isSensorReady(String sensorName) {
  if (sensorName == "mpu6050") {
    return sensorMgr.mpu6050Ready;
  } else if (sensorName == "pulse") {
    return sensorMgr.pulseSensorReady;
  } else if (sensorName == "falseAlarmCancel" || sensorName == "cancel") {
    return sensorMgr.falseAlarmCancelButtonReady;
  } else if (sensorName == "alert") {
    return sensorMgr.alertSystemReady;
  }
  return false;
}
