/**
 * @file SensorLogging.ino
 * @brief ระบบจัดการการแสดงผล log และคำสั่งจูน runtime ของ sensor_tuning
 *
 * หน้าที่หลัก:
 * - รวมสถานะ log ของ IMU, PPG และ fall flow ไว้ที่ไฟล์เดียว
 * - ใช้โปรไฟล์เดียวสำหรับรอบจูน และคุม raw log แยกต่างหาก
 * - คุม raw log ให้เปิดเฉพาะตอนผู้ใช้สั่ง เพื่อกัน Serial Monitor ไหลตั้งแต่บูต
 * - ให้สถานะ log อยู่ใน RAM เท่านั้น เพื่อให้ทุก session เริ่มจากค่าเริ่มต้นที่คาดเดาได้
 */

#include "types.h"
#include "build_profile.h"

#include <stdarg.h>
#include <string.h>

// ============================================================================
// [1] การประกาศการเชื่อมต่อกับโมดูลอื่น (External Dependencies)
// ============================================================================

const char *getFallRuntimeProfileName();
void setPulsePlotterMode(bool enabled);
bool isPulsePlotterMode();

// ============================================================================
// [2] การตั้งค่าและค่าคงที่ของระบบ log (Configuration & Constants)
// ============================================================================

// sensor_tuning ใช้โปรไฟล์เดียวสำหรับรอบจูนทั้งหมด
#define SENSOR_LOG_PROFILE_TUNING 1

// ค่าเริ่มต้นของรอบจูน
#define SENSOR_LOG_RAW_INTERVAL_DEFAULT_MS 300UL
#define SENSOR_LOG_RAW_INTERVAL_PPG_TUNING_MS 200UL
#define SENSOR_LOG_RAW_INTERVAL_MPU_TUNING_MS 300UL
#define SENSOR_LOG_RAW_INTERVAL_MIN_MS 100UL
#define SENSOR_LOG_RAW_INTERVAL_MAX_MS 5000UL

#ifndef FALLHELP_SENSOR_LOG_PROFILE_DEFAULT
#define FALLHELP_SENSOR_LOG_PROFILE_DEFAULT SENSOR_LOG_PROFILE_TUNING
#endif

#ifndef FALLHELP_SENSOR_RAW_ENABLED_DEFAULT
#define FALLHELP_SENSOR_RAW_ENABLED_DEFAULT 1
#endif

// ============================================================================
// [3] ตัวแปรสถานะของโมดูล (Module State)
// ============================================================================

uint8_t sensorLogProfileMode = SENSOR_LOG_PROFILE_TUNING;
uint16_t sensorLogMask = 0;
unsigned long sensorRawLogIntervalMs = SENSOR_LOG_RAW_INTERVAL_DEFAULT_MS;

// ============================================================================
// [4] ฟังก์ชันย่อยภายในโมดูล (Internal Helpers)
// ============================================================================

/**
 * ตรวจสอบว่า profile ที่รับเข้ามาเป็นค่าที่ระบบรองรับหรือไม่
 *
 * @param mode ค่า profile ที่ต้องการตรวจสอบ
 * @return true เมื่อเป็นโปรไฟล์รอบจูนที่ระบบรองรับ
 */
static bool isValidSensorLogProfile(uint8_t mode)
{
  return mode == SENSOR_LOG_PROFILE_TUNING;
}

/**
 * สร้าง bitmask ของ channel log ตาม profile และสถานะ raw log ปัจจุบัน
 *
 * หลักการของ sensor_tuning รอบนี้คือใช้โปรไฟล์เดียว และให้ raw log เปิดแบบตั้งใจเท่านั้น
 *
 * @param mode profile ปัจจุบัน
 * @param rawEnabled สถานะว่า raw log เปิดอยู่หรือไม่
 * @return bitmask ของ channel ที่อนุญาตให้พิมพ์
 */
static uint16_t buildSensorLogMaskForProfile(uint8_t mode, bool rawEnabled)
{
  (void)mode;
  uint16_t baseMask = SENSOR_LOG_SYSTEM | SENSOR_LOG_IMU_EVENT |
                      SENSOR_LOG_PPG_EVENT | SENSOR_LOG_FALL_FLOW;

  // raw log ต้องถูกเปิดแบบตั้งใจเท่านั้น เพื่อกัน serial ไหลเองหลังบูต
  if (rawEnabled)
  {
    baseMask |= SENSOR_LOG_IMU_RAW | SENSOR_LOG_PPG_RAW;
  }

  return baseMask;
}

/**
 * คืนค่า interval เริ่มต้นของ raw log สำหรับรอบจูน
 *
 * @param mode profile ปัจจุบัน
 * @return ความถี่เริ่มต้นของ raw log หน่วยเป็นมิลลิวินาที
 */
static unsigned long defaultRawIntervalForProfile(uint8_t mode)
{
  (void)mode;
  return SENSOR_LOG_RAW_INTERVAL_DEFAULT_MS;
}

/**
 * แปลงหมวดหมู่ log เป็นชื่อข้อความสำหรับพิมพ์บน Serial
 *
 * @param category หมวดหมู่ของ log
 * @return ชื่อสั้นของหมวดหมู่
 */
static const char *sensorLogCategoryName(uint16_t category)
{
  switch (category)
  {
  case SENSOR_LOG_SYSTEM:
    return "SYSTEM";
  case SENSOR_LOG_IMU_EVENT:
    return "IMU_EVENT";
  case SENSOR_LOG_IMU_RAW:
    return "IMU_RAW";
  case SENSOR_LOG_PPG_EVENT:
    return "PPG_EVENT";
  case SENSOR_LOG_PPG_RAW:
    return "PPG_RAW";
  case SENSOR_LOG_FALL_FLOW:
    return "FALL_FLOW";
  default:
    return "UNKNOWN";
  }
}

// ============================================================================
// [5] ฟังก์ชันสาธารณะสำหรับอ่าน/ตั้งค่าสถานะ log (Public Log State API)
// ============================================================================

/**
 * ตรวจสอบว่า channel ที่ระบุถูกเปิดอยู่หรือไม่
 *
 * @param category หมวดหมู่ log ที่ต้องการตรวจสอบ
 * @return true เมื่อ channel นั้นถูกเปิดใช้งาน
 */
bool isSensorLogEnabled(uint16_t category)
{
  return (sensorLogMask & category) != 0;
}

/**
 * สรุปสถานะ raw log ของระบบว่ามีการเปิด stream ดิบอยู่หรือไม่
 *
 * @return true เมื่อ IMU raw หรือ PPG raw ถูกเปิดอย่างน้อยหนึ่งช่อง
 */
bool isSensorRawLogEnabled()
{
  return isSensorLogEnabled(SENSOR_LOG_IMU_RAW) ||
         isSensorLogEnabled(SENSOR_LOG_PPG_RAW);
}

/**
 * ตรวจสอบว่าอยู่ในโหมด MPU diagnostic หรือไม่
 *
 * โหมดนี้ใช้เปิด raw log ของ IMU แบบตั้งใจในรอบจูน จึงให้ไฟล์อื่นใช้เช็ก
 * เพื่อหยุด flow บางส่วนที่ไม่ควรทำงานระหว่างดูค่าดิบ
 *
 * @return true เมื่อ build รองรับ MPU และ raw log ของ IMU ถูกเปิดอยู่
 */
bool isMpuDiagnosticMode()
{
#if ENABLE_MPU6050_SENSOR
  return isSensorLogEnabled(SENSOR_LOG_IMU_RAW);
#else
  return false;
#endif
}

/**
 * เปิดหรือปิด raw log สำหรับ session ปัจจุบัน
 *
 * @param enabled true เมื่อต้องการเปิด raw log
 */
void setSensorRawLogEnabled(bool enabled)
{
  if (enabled)
  {
    sensorLogMask |= SENSOR_LOG_IMU_RAW | SENSOR_LOG_PPG_RAW;
  }
  else
  {
    sensorLogMask &= ~(SENSOR_LOG_IMU_RAW | SENSOR_LOG_PPG_RAW);
  }
}

/**
 * คืนค่า interval ปัจจุบันของ raw log
 *
 * @return ระยะห่างระหว่าง log แต่ละบรรทัด หน่วยเป็นมิลลิวินาที
 */
unsigned long getSensorRawLogIntervalMs() { return sensorRawLogIntervalMs; }

/**
 * ตั้งค่า interval ของ raw log พร้อมตรวจสอบขอบเขตที่ยอมรับได้
 *
 * @param intervalMs ค่า interval ใหม่ หน่วยเป็นมิลลิวินาที
 * @return true เมื่อตั้งค่าสำเร็จ
 */
bool setSensorRawLogIntervalMs(unsigned long intervalMs)
{
  if (intervalMs < SENSOR_LOG_RAW_INTERVAL_MIN_MS ||
      intervalMs > SENSOR_LOG_RAW_INTERVAL_MAX_MS)
  {
    return false;
  }

  sensorRawLogIntervalMs = intervalMs;
  return true;
}

/**
 * พิมพ์ structured log ลง Serial ตามหมวดหมู่ที่กำหนด
 *
 * ถ้า channel นั้นปิดอยู่ หรืออยู่ใน plotter mode ของ pulse sensor
 * ฟังก์ชันจะไม่พิมพ์อะไรเพื่อป้องกัน noise ในรอบทดสอบ
 *
 * @param category หมวดหมู่ log
 * @param fmt รูปแบบข้อความแบบ printf
 */
void sensorLogf(uint16_t category, const char *fmt, ...)
{
#if SOFTWARE_CALIBRATION_MODE
  // ระหว่างเก็บ calibration samples ไม่แสดง SLOG ใดทั้งสิ้น
  // เพื่อให้ output มีเฉพาะ progress และผลลัพธ์ calibration เท่านั้น
  (void)category;
  (void)fmt;
  return;
#endif
  if (!isSensorLogEnabled(category))
  {
    return;
  }

#if ENABLE_PULSE_SENSOR
  // ตัว Serial Plotter อ่านตัวเลขทุก token บน Serial
  // จึงต้องปิด SLOG แบบมีโครงสร้างตอนอยู่ใน plotter mode เพื่อไม่ให้ timestamp
  // ดันสเกลกราฟเพี้ยน
  if (isPulsePlotterMode())
  {
    return;
  }
#endif

  char message[256];
  va_list args;
  va_start(args, fmt);
  vsnprintf(message, sizeof(message), fmt, args);
  va_end(args);

  Serial.printf("[SLOG][%s][%lu] %s\n", sensorLogCategoryName(category),
                millis(), message);
}

/**
 * คืนชื่อ profile ปัจจุบันเป็นข้อความที่พร้อมแสดงผล
 *
 * @return ชื่อโปรไฟล์ของงานจูน
 */
const char *getSensorLogProfileName()
{
  return "TUNING";
}

/**
 * ตั้งค่าสถานะ log เริ่มต้นของ session ปัจจุบัน
 *
 * หลักการสำคัญ:
 * - sensor_tuning ใช้โปรไฟล์เดียว
 * - raw log แยกจาก profile และจะไม่เปิดเองถ้าไม่ได้ถูกสั่งไว้
 * - reboot แต่ละครั้งต้องกลับมาที่ค่า default เดิม เพื่อให้ Node-RED เป็นตัว arm/disarm รอบจูน
 */
void initSensorLogRuntimeState()
{
  uint8_t defaultProfile = FALLHELP_SENSOR_LOG_PROFILE_DEFAULT;
  if (!isValidSensorLogProfile(defaultProfile))
  {
    defaultProfile = SENSOR_LOG_PROFILE_TUNING;
  }

  sensorLogProfileMode = defaultProfile;

  // แยก profile ออกจากสถานะ raw log เพื่อให้ boot แบบ quiet ได้จริงทุกครั้ง
  bool defaultRawEnabled = FALLHELP_SENSOR_RAW_ENABLED_DEFAULT ? true : false;
  sensorLogMask =
      buildSensorLogMaskForProfile(sensorLogProfileMode, defaultRawEnabled);

  sensorRawLogIntervalMs = defaultRawIntervalForProfile(sensorLogProfileMode);
}

/**
 * ยืนยันการใช้โปรไฟล์ของระบบ log
 *
 * sensor_tuning รอบนี้ตั้งใจใช้โปรไฟล์เดียว (`TUNING`) จึงไม่เปิดช่องให้สลับไปโหมดอื่น
 * ฟังก์ชันนี้คงไว้เพื่อให้ command path เดิมยังเรียกใช้งานได้โดยไม่ทำให้ API แตก
 *
 * @param profileName ชื่อ profile ที่รับจากคำสั่ง
 * @return true เมื่อตั้งค่าเป็นโปรไฟล์รอบจูนได้สำเร็จ
 */
bool setSensorLogProfile(const String &profileName)
{
  String normalized = profileName;
  normalized.trim();
  normalized.toUpperCase();

  if (!(normalized == "TUNING" || normalized == "TEST" || normalized == "DEMO"))
  {
    return false;
  }

  sensorLogProfileMode = SENSOR_LOG_PROFILE_TUNING;

  bool keepRawEnabled = isSensorRawLogEnabled();
  sensorLogMask =
      buildSensorLogMaskForProfile(sensorLogProfileMode, keepRawEnabled);
  sensorRawLogIntervalMs = defaultRawIntervalForProfile(sensorLogProfileMode);

  return true;
}

/**
 * แสดงสถานะย่อของระบบ log เพื่อให้ผู้ใช้ตรวจรอบทดสอบได้เร็ว
 *
 * ข้อความถูกย่อให้ดูจาก Serial Monitor ได้ง่าย แต่ยังเก็บข้อมูลที่จำเป็น
 * เช่น mode, raw status, interval และ channel ที่เปิดอยู่
 */
void printSensorLogStatus()
{
  Serial.printf("[LOG] mode=%s raw=%s interval=%lu ms\n",
                getSensorLogProfileName(),
                isSensorRawLogEnabled() ? "ON" : "OFF",
                sensorRawLogIntervalMs);
  Serial.printf("[LOG] ch: sys=%s imu_evt=%s imu_raw=%s ppg_evt=%s ppg_raw=%s fall=%s\n",
                isSensorLogEnabled(SENSOR_LOG_SYSTEM) ? "ON" : "OFF",
                isSensorLogEnabled(SENSOR_LOG_IMU_EVENT) ? "ON" : "OFF",
                isSensorLogEnabled(SENSOR_LOG_IMU_RAW) ? "ON" : "OFF",
                isSensorLogEnabled(SENSOR_LOG_PPG_EVENT) ? "ON" : "OFF",
                isSensorLogEnabled(SENSOR_LOG_PPG_RAW) ? "ON" : "OFF",
                isSensorLogEnabled(SENSOR_LOG_FALL_FLOW) ? "ON" : "OFF");
}

// ============================================================================
// [6] ตัวแปลคำสั่งจาก Serial / MQTT command channel (Command Handling)
// ============================================================================

/**
 * ประมวลผลคำสั่งของระบบ log
 *
 * คำสั่งชุดนี้ใช้สำหรับเปิด/ปิด raw preset ของการจูนและควบคุม raw log
 * โดยไม่ต้องแก้โค้ดแล้วอัปโหลดใหม่ทุกครั้ง
 *
 * @param cmdLower ข้อความคำสั่งที่ถูก normalize เป็น lowercase แล้ว
 * @return true เมื่อคำสั่งนี้เป็นของระบบ log และถูกจัดการแล้ว
 */
bool handleSensorLogCommand(const String &cmdLower)
{
#if ENABLE_PULSE_SENSOR
  if (cmdLower == "ppg on")
  {
    setSensorLogProfile("TUNING");
    setSensorRawLogEnabled(true);
    setSensorRawLogIntervalMs(SENSOR_LOG_RAW_INTERVAL_PPG_TUNING_MS);
    Serial.println("✅ PPG tuning mode ON (raw=ON, interval=200 ms)");
    printSensorLogStatus();
    return true;
  }
  if (cmdLower == "ppg off")
  {
    setSensorLogProfile("TUNING");
    setSensorRawLogEnabled(false);
    setSensorRawLogIntervalMs(defaultRawIntervalForProfile(SENSOR_LOG_PROFILE_TUNING));
    Serial.println("✅ PPG tuning mode OFF (raw=OFF)");
    printSensorLogStatus();
    return true;
  }
#else
  if (cmdLower == "ppg on" || cmdLower == "ppg off")
  {
    Serial.println("❌ ppg on/off ใช้ได้เฉพาะบิลด์ PULSE mode");
    return true;
  }
#endif

  if (cmdLower == "mpu on")
  {
#if ENABLE_MPU6050_SENSOR
    setSensorLogProfile("TUNING");
    setSensorRawLogEnabled(true);
    setSensorRawLogIntervalMs(SENSOR_LOG_RAW_INTERVAL_MPU_TUNING_MS);
    Serial.println("✅ MPU tuning mode ON (raw=ON, interval=300 ms)");
    printSensorLogStatus();
#else
    Serial.println("❌ mpu on is available only in MPU mode build.");
#endif
    return true;
  }

  if (cmdLower == "mpu off")
  {
#if ENABLE_MPU6050_SENSOR
    setSensorLogProfile("TUNING");
    setSensorRawLogEnabled(false);
    setSensorRawLogIntervalMs(
        defaultRawIntervalForProfile(SENSOR_LOG_PROFILE_TUNING));
    Serial.println("✅ MPU tuning mode OFF (raw=OFF)");
    printSensorLogStatus();
#else
    Serial.println("❌ mpu off is available only in MPU mode build.");
#endif
    return true;
  }

  if (cmdLower == "mpu test")
  {
#if ENABLE_MPU6050_SENSOR
    bool mpuTestActive = isSensorRawLogEnabled();

    if (mpuTestActive)
    {
      setSensorLogProfile("TUNING");
      setSensorRawLogEnabled(false);
      setSensorRawLogIntervalMs(
          defaultRawIntervalForProfile(SENSOR_LOG_PROFILE_TUNING));
      Serial.println("✅ MPU tuning mode OFF (raw=OFF)");
    }
    else
    {
      setSensorLogProfile("TUNING");
      setSensorRawLogEnabled(true);
      setSensorRawLogIntervalMs(SENSOR_LOG_RAW_INTERVAL_MPU_TUNING_MS);
      Serial.println("✅ MPU tuning mode ON (raw=ON, interval=300 ms)");
    }
    printSensorLogStatus();
#else
    Serial.println("❌ mpu test is available only in MPU mode build.");
#endif
    return true;
  }

  if (cmdLower == "log status")
  {
    printSensorLogStatus();
    return true;
  }

  if (cmdLower == "log raw")
  {
    bool nextEnabled = !isSensorRawLogEnabled();
    setSensorRawLogEnabled(nextEnabled);
    Serial.printf("✅ Sensor raw logs %s\n", nextEnabled ? "enabled" : "disabled");
    printSensorLogStatus();
    return true;
  }

  if (cmdLower.startsWith("log interval "))
  {
    String value = cmdLower.substring(String("log interval ").length());
    long interval = value.toInt();
    if (interval <= 0 ||
        !setSensorRawLogIntervalMs((unsigned long)interval))
    {
      Serial.printf("❌ Invalid interval. Use %lu-%lu ms\n",
                    SENSOR_LOG_RAW_INTERVAL_MIN_MS,
                    SENSOR_LOG_RAW_INTERVAL_MAX_MS);
    }
    else
    {
      Serial.printf("✅ Sensor raw log interval set: %lu ms\n",
                    sensorRawLogIntervalMs);
    }
    return true;
  }

  if (cmdLower == "log help")
  {
    Serial.println("Log commands:");
    Serial.println("  ppg on/off       - toggle PPG tuning raw preset");
    Serial.println("  mpu on/off       - MPU diagnostic only (not fall/ADL mode)");
    Serial.println("  mpu test         - toggle MPU tuning preset");
    Serial.println("  log status       - show current log state");
    Serial.println("  log raw          - toggle raw sensor logs");
    Serial.println("  log interval N   - set raw log interval (100-5000 ms)");
    return true;
  }

  return false;
}
