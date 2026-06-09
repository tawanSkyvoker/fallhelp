/**
 * @file SensorManager.ino
 * @brief ตัวกลางประสานการทำงานของเซนเซอร์และโมดูลประกอบใน sensor_tuning
 *
 * หน้าที่หลัก:
 * - MPU6050_Sensor.ino (Fall Detection)
 * - PulseSensor.ino (Heart Rate)
 * - FalseAlarmCancelButton.ino (False Alarm Cancel)
 * - AlertSystem.ino (Speaker)
 *
 * - เริ่มต้นเซนเซอร์แบบรวมศูนย์
 * - วน update แบบรวม
 * - เฝ้าดูสถานะและ retry เมื่อมี error
 * - ส่งสถานะเซนเซอร์ผ่าน MQTT
 *
 * ข้อจำกัด:
 * - ไฟล์นี้ควบคุมลำดับชีวิตของโมดูล แต่ไม่ควรย้าย logic เฉพาะทางของแต่ละเซนเซอร์เข้ามาปน
 */

#include "build_profile.h"

// ============================================================================
// [1] การตั้งค่าและค่าคงที่ (Configuration & Constants)
// ============================================================================

#define SENSOR_STATUS_INTERVAL 30000  // ms - ส่ง status ทุก 30s
#define SENSOR_ERROR_RETRY_DELAY 5000 // ms - retry sensor ที่ล้มเหลวทุก 5s
#define SENSOR_INIT_RETRY_DELAY SENSOR_ERROR_RETRY_DELAY

#ifndef ENABLE_MPU6050_SENSOR
#define ENABLE_MPU6050_SENSOR 0
#endif

#ifndef ENABLE_PULSE_SENSOR
#define ENABLE_PULSE_SENSOR 1
#endif

// ============================================================================
// [2] ตัวแปรสถานะของ Sensor Manager (Manager State)
// ============================================================================

struct SensorManagerState
{
  bool mpu6050Enabled;
  bool pulseSensorEnabled;
  bool falseAlarmCancelButtonEnabled;
  bool alertSystemEnabled;
  bool i2cBusInitialized;

  bool mpu6050Ready;
  bool pulseSensorReady;
  bool falseAlarmCancelButtonReady;
  bool alertSystemReady;

  unsigned long lastStatusPublish;
  unsigned long lastErrorCheck;

  bool isInitialized;
};

SensorManagerState sensorMgr = {ENABLE_MPU6050_SENSOR,
                                ENABLE_PULSE_SENSOR,
                                ENABLE_MPU6050_SENSOR,  // ปุ่ม falseAlarmCancel: ผูกกับ MPU6050
                                ENABLE_MPU6050_SENSOR,  // alertSystem: ผูกกับ MPU6050
                                false,
                                false,
                                false,
                                false,
                                false,
                                0,
                                0,
                                false};

// ============================================================================
// [3] ฟังก์ชันประกาศล่วงหน้า (Forward Declarations)
// ============================================================================

bool initSensorManager();
void updateSensorManager();
void publishSensorStatus();
void checkSensorErrors();
bool ensureI2CBus(bool forceReset = false);
void printI2CScan();
void enableSensor(String sensorName, bool enable);
bool isSensorReady(String sensorName);
void printSensorStatus();

// ============================================================================
// [4] ฟังก์ชันช่วยเหลือภายใน (Internal Helpers)
// ============================================================================

/**
 * ตรวจและเตรียม I2C bus ให้พร้อมใช้งาน
 *
 * ใช้ทั้งตอน init รอบแรกและตอน recovery หลังเซนเซอร์หลุด
 *
 * @param forceReset true เมื่อต้องการ end/begin bus ใหม่
 * @return true เมื่อ I2C bus พร้อมใช้งาน
 */
bool ensureI2CBus(bool forceReset)
{
  if (forceReset && sensorMgr.i2cBusInitialized) {
    Wire.end();
    sensorMgr.i2cBusInitialized = false;
    delay(20);
  }

  if (!sensorMgr.i2cBusInitialized) {
    sensorMgr.i2cBusInitialized = Wire.begin(21, 22); // ขา SDA=GPIO21, SCL=GPIO22
    if (!sensorMgr.i2cBusInitialized) {
      sensorLogf(SENSOR_LOG_SYSTEM, "I2C bus init failed");
      return false;
    }
    Wire.setClock(100000);
    delay(100);
  }

  return true;
}

/**
 * สแกน I2C bus แล้วพิมพ์ผลผ่าน Serial
 *
 * ใช้สำหรับงานฮาร์ดแวร์ดีบักตอนเซนเซอร์ไม่ตอบสนอง
 */
void printI2CScan()
{
  Serial.println("\n--- I2C Scan (GPIO21/GPIO22) ---");

  pinMode(21, INPUT_PULLUP);
  pinMode(22, INPUT_PULLUP);
  Serial.printf("Line level: SDA=%d SCL=%d (1=HIGH,0=LOW)\n", digitalRead(21),
                digitalRead(22));

  if (!ensureI2CBus(true)) {
    Serial.println("❌ I2C bus init failed");
    Serial.println("-------------------------------");
    return;
  }

  int foundCount = 0;
  for (uint8_t addr = 1; addr < 127; ++addr) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission(true);
    if (err == 0) {
      Serial.printf("✅ Found device: 0x%02X\n", addr);
      foundCount++;
    }
    delay(1);
  }

  if (foundCount == 0) {
    Serial.println("⚠️ No I2C device found");
  }
  Serial.printf("Total found: %d\n", foundCount);
  Serial.println("-------------------------------");
}

// ============================================================================
// [5] การเริ่มต้นระบบ (Initialization)
// ============================================================================

/**
 * เริ่มต้นเซนเซอร์และโมดูลประกอบทั้งหมด
 *
 * ฟังก์ชันนี้เป็นจุดรวมของการ init sensor_tuning ทั้งชุด
 * ถ้ามีอย่างน้อยหนึ่งโมดูลพร้อมใช้งาน จะถือว่า manager พร้อมเริ่ม loop ได้
 *
 * @return true เมื่อมีอย่างน้อยหนึ่งโมดูลพร้อมใช้งาน
 */
bool initSensorManager()
{
  Serial.println("\n╔══════════════════════════════════════════════════╗");
  Serial.println("║          Sensor Manager Initialization           ║");
  Serial.println("╚══════════════════════════════════════════════════╝");

  bool anySuccess = false;

  // เริ่มต้น Fall Detection Configuration (baseline สำหรับงานวิจัย)
  initFallDetectionConfig();

  // เริ่มต้น I2C สำหรับ MPU6050
  if (sensorMgr.mpu6050Enabled) {
    if (!ensureI2CBus(false)) {
      sensorMgr.mpu6050Ready = false;
      Serial.println("⚠️ I2C bus not ready (will retry)");
    } else {
      sensorMgr.mpu6050Ready = initMPU6050();
      if (sensorMgr.mpu6050Ready) {
        anySuccess = true;
        Serial.println("✅ MPU6050 enabled");
      } else {
        Serial.println("⚠️ MPU6050 initialization failed (will retry)");
      }
    }
  } else {
    Serial.println("⏭️  MPU6050 disabled");
  }

  // เริ่มต้น Pulse Sensor
  if (sensorMgr.pulseSensorEnabled) {
    sensorMgr.pulseSensorReady = initPulseSensor();
    if (sensorMgr.pulseSensorReady) {
      anySuccess = true;
      Serial.println("✅ Pulse Sensor enabled");
    } else {
      Serial.println("⚠️ Pulse Sensor initialization failed (will retry)");
    }
  } else {
    Serial.println("⏭️  Pulse Sensor disabled");
  }

  // เริ่มต้นปุ่มยกเลิก false alarm
  if (sensorMgr.falseAlarmCancelButtonEnabled) {
    sensorMgr.falseAlarmCancelButtonReady = initFalseAlarmCancelButton();
    if (sensorMgr.falseAlarmCancelButtonReady) {
      anySuccess = true;
      Serial.println("✅ False Alarm Cancel Button enabled");
    } else {
      Serial.println("⚠️ False Alarm Cancel Button initialization failed");
    }
  } else {
    Serial.println("⏭️  False Alarm Cancel Button disabled");
  }

  // เริ่มต้น Alert System
  if (sensorMgr.alertSystemEnabled) {
    sensorMgr.alertSystemReady = initAlertSystem();
    if (sensorMgr.alertSystemReady) {
      anySuccess = true;
      Serial.println("✅ Alert System enabled");
    } else {
      Serial.println("⚠️ Alert System initialization failed");
    }
  } else {
    Serial.println("⏭️  Alert System disabled");
  }

  sensorMgr.isInitialized = anySuccess;
  sensorMgr.lastStatusPublish = millis();
  sensorMgr.lastErrorCheck = millis();

  if (anySuccess) {
    Serial.println("\n✅ Sensor Manager initialized");
    printSensorStatus();
  } else {
    Serial.println(
        "\n❌ Sensor Manager initialization failed - no sensors ready");
  }

  return anySuccess;
}

// ============================================================================
// [6] วนรอบอัปเดตหลัก (Main Update Flow)
// ============================================================================

/**
 * อัปเดตเซนเซอร์ทั้งหมดใน main loop
 *
 * ลำดับของฟังก์ชันนี้สำคัญ เพราะเป็นตัวกำหนดว่าโมดูลไหนถูกอัปเดตก่อนหลัง
 * และเมื่อใดจึงควรเข้าเส้นทาง retry หรือ publish status
 */
void updateSensorManager()
{
  if (!sensorMgr.isInitialized) {
    // ลองเริ่มต้นทั้งหมดแบบ backoff เมื่อยังไม่มีเซนเซอร์พร้อม
    if (millis() > 2000 &&
        millis() - sensorMgr.lastErrorCheck >= SENSOR_INIT_RETRY_DELAY) {
      sensorMgr.lastErrorCheck = millis();
      initSensorManager();
    }
    return;
  }

  // อัปเดตเซนเซอร์แต่ละตัวเมื่อเปิดใช้งานและพร้อมแล้ว
  if (sensorMgr.mpu6050Enabled && sensorMgr.mpu6050Ready) {
    updateMPU6050();
  }

  if (sensorMgr.pulseSensorEnabled && sensorMgr.pulseSensorReady) {
    updatePulseSensor();
  }

  if (sensorMgr.falseAlarmCancelButtonEnabled &&
      sensorMgr.falseAlarmCancelButtonReady) {
    updateFalseAlarmCancelButton();
  }

  if (sensorMgr.alertSystemEnabled && sensorMgr.alertSystemReady) {
    updateAlertSystem();
  }

  // ตรวจ error ของเซนเซอร์เป็นระยะ
  if (millis() - sensorMgr.lastErrorCheck >= SENSOR_ERROR_RETRY_DELAY) {
    checkSensorErrors();
    sensorMgr.lastErrorCheck = millis();
  }

  // ส่งสถานะเซนเซอร์เป็นระยะ
  if (millis() - sensorMgr.lastStatusPublish >= SENSOR_STATUS_INTERVAL) {
    publishSensorStatus();
    sensorMgr.lastStatusPublish = millis();
  }
}

// ============================================================================
// [7] Error Recovery และการรายงานสถานะ (Recovery & Status Reporting)
// ============================================================================

/**
 * ตรวจ error ของเซนเซอร์แล้ว retry การเริ่มต้นเท่าที่จำเป็น
 *
 * แนวคิดคือ retry เฉพาะโมดูลที่ยังไม่พร้อม เพื่อไม่ไปกระทบโมดูลที่ทำงานปกติอยู่แล้ว
 */
void checkSensorErrors()
{
  // ลองเริ่มต้น MPU6050 ใหม่ถ้ายังไม่พร้อม
  if (sensorMgr.mpu6050Enabled && !sensorMgr.mpu6050Ready) {
    Serial.println("🔄 Retrying MPU6050 initialization...");
    if (ensureI2CBus(true)) {
      sensorMgr.mpu6050Ready = initMPU6050();
    } else {
      sensorMgr.mpu6050Ready = false;
    }
  }

  // ลองเริ่มต้น Pulse Sensor ใหม่ถ้ายังไม่พร้อม
  if (sensorMgr.pulseSensorEnabled && !sensorMgr.pulseSensorReady) {
    Serial.println("🔄 Retrying Pulse Sensor initialization...");
    sensorMgr.pulseSensorReady = initPulseSensor();
  }

  // ปุ่ม false alarm ไม่ต้อง retry เพราะถ้ามีฮาร์ดแวร์ก็ใช้งานได้ทันที
}

/** ส่งสถานะเซนเซอร์ไปยัง MQTT */
void publishSensorStatus()
{
  if (!mqtt.connected())
    return;

  String topic = "device/" + deviceSerial + "/sensors/status";
  JsonDocument doc;
  doc["timestamp"] = millis();

  // สถานะ MPU6050
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

  // สถานะ Pulse Sensor
  JsonObject pulse = doc["pulse"].to<JsonObject>();
  pulse["enabled"] = sensorMgr.pulseSensorEnabled;
  pulse["ready"] = sensorMgr.pulseSensorReady;
  if (sensorMgr.pulseSensorReady) {
    PulseSensorData pulseData = getPulseSensorData();
    pulse["heartRate"] = pulseData.heartRate;
    pulse["zone"] = pulseData.zone;
    pulse["rawValue"] = pulseData.rawValue;
  }

  // สถานะปุ่ม false alarm
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

  if (mqtt.publish(topic.c_str(), buffer)) {
    Serial.println("Sensor status published");
  }
}

/** แสดงสถานะเซนเซอร์ผ่าน Serial */
void printSensorStatus()
{
  Serial.println("\n--- Sensor Status ---");
  Serial.printf("MPU6050:     %s %s\n",
                sensorMgr.mpu6050Enabled ? "ENABLED" : "DISABLED",
                sensorMgr.mpu6050Ready ? "✅" : "❌");
  Serial.printf("Pulse Sensor: %s %s\n",
                sensorMgr.pulseSensorEnabled ? "ENABLED" : "DISABLED",
                sensorMgr.pulseSensorReady ? "✅" : "❌");
  Serial.printf("False Alarm Cancel: %s %s\n",
                sensorMgr.falseAlarmCancelButtonEnabled ? "ENABLED"
                                                        : "DISABLED",
                sensorMgr.falseAlarmCancelButtonReady ? "✅" : "❌");
  Serial.printf("Alert System: %s %s\n",
                sensorMgr.alertSystemEnabled ? "ENABLED" : "DISABLED",
                sensorMgr.alertSystemReady ? "✅" : "❌");
  Serial.println("-------------------\n");
}

// ============================================================================
// [8] ฟังก์ชันสาธารณะของ Manager (Public Control API)
// ============================================================================

/** เปิด/ปิดเซนเซอร์ */
void enableSensor(String sensorName, bool enable)
{
  if (sensorName == "mpu6050") {
    sensorMgr.mpu6050Enabled = enable;
    Serial.printf("MPU6050 %s\n", enable ? "enabled" : "disabled");
  } else if (sensorName == "pulse") {
    sensorMgr.pulseSensorEnabled = enable;
    Serial.printf("Pulse Sensor %s\n", enable ? "enabled" : "disabled");
  } else if (sensorName == "falseAlarmCancel" || sensorName == "cancel") {
    sensorMgr.falseAlarmCancelButtonEnabled = enable;
    Serial.printf("False Alarm Cancel Button %s\n",
                  enable ? "enabled" : "disabled");
  }
}

/** ตรวจว่าเซนเซอร์พร้อมหรือยัง */
bool isSensorReady(String sensorName)
{
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
