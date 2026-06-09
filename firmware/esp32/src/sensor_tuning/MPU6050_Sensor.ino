/**
 * @file MPU6050_Sensor.ino
 * @brief เซนเซอร์ MPU6050 สำหรับตรวจจับการหกล้มในโหมดจูน
 *
 * ใช้กับ: Fall Detection - ตรวจจับการหกล้มจากความเร่ง
 *
 * ฮาร์ดแวร์:
 * - MPU6050 (I2C) - SDA=GPIO21, SCL=GPIO22
 *
 * ความสามารถ:
 * - เฝ้าดูความเร่งแบบ raw 6-axis แบบ real-time
 * - ใช้ SVM ร่วมกับ complementary filter ในการตรวจ fall
 * - ปรับ sensitivity ได้
 * - ส่ง event ผ่าน MQTT
 */

#include "types.h"
#include <I2Cdev.h>
#include <MPU6050.h>
#include <Wire.h>

// ============================================================================
// [1] ค่าคงที่ของ MPU6050 และ fall pipeline (Configuration & Constants)
// ============================================================================
#define MPU6050_RECHECK_INTERVAL_MS 5000UL
#define MPU6050_DEFAULT_ACCEL_OFFSET 0
#define MPU6050_DEFAULT_GYRO_OFFSET 0
#define MPU6050_ADDR_AD0_LOW 0x68                      // I2C Address พื้นฐานเมื่อต่อขา AD0 ลง GND (ค่าที่ใช้บ่อยสุด)
#define MPU6050_ADDR_AD0_HIGH 0x69                     // I2C Address ทางเลือกเมื่อต่อขา AD0 เข้าไฟ 3.3V (ใช้เมื่อมีอุปกรณ์ I2C ซ้ำกัน)

// ตรวจ WHO_AM_I register เพื่อรองรับทั้ง MPU6050 แท้และ GY-521 clone chip
// ชิป clone บางรุ่นส่ง WHO_AM_I = 0x70 แทน 0x68
// ฟังก์ชัน testConnection() มาตรฐานรับแค่ 0x68 จึงใช้ไม่ได้กับ clone
#define MPU6050_WHO_AM_I_REG 0x75                      // ที่อยู่ (Address) ของ Register "WHO_AM_I" ใช้สำหรับตรวจสอบตัวตนของเซนเซอร์
#define MPU6050_WHO_AM_I_6050_LOW 0x68                 // ค่าตอบกลับของชิป MPU6050 แท้ (เมื่อต่อขา AD0 ลง GND)
#define MPU6050_WHO_AM_I_6050_HIGH 0x69                // ค่าตอบกลับของชิป MPU6050 แท้ (เมื่อต่อขา AD0 เข้าไฟ 3.3V)
#define MPU6050_WHO_AM_I_ALT_70 0x70                   // ค่าตอบกลับที่มักพบในชิปโคลน (Clone) ตามท้องตลาด
#define MPU6050_EXPECTED_ACCEL_RANGE MPU6050_ACCEL_FS_4 // ตั้งค่าความเร่ง (Accelerometer) ไว้ที่ ±4g (เหมาะกับการจับแรงกระแทกตอนล้ม)
#define MPU6050_EXPECTED_GYRO_RANGE MPU6050_GYRO_FS_500 // ตั้งค่าไจโรสโคป (Gyroscope) ไว้ที่ ±500 องศา/วินาที
#define MPU6050_ACCEL_SCALE_FACTOR_4G 8192.0f          // ตัวหารสำหรับแปลงค่าดิบความเร่งช่วง ±4g ให้เป็นหน่วยแรงโน้มถ่วง (g)
#define MPU6050_GYRO_SCALE_FACTOR_500DPS 65.5f         // ตัวหารสำหรับแปลงค่าดิบไจโรสโคปช่วง ±500 dps ให้เป็นหน่วยองศา/วินาที (deg/s)
#define MPU6050_ENABLE_SVM_WATCHDOG false
#define MPU6050_GRAVITY_MS2 9.80665f
#define MPU6050_RAD_TO_DEG 57.2957795f
#define MPU6050_DEG_TO_RAD 0.0174532925f

#define FALL_THRESHOLD_ACCEL_DEFAULT 2.0f
#define FALL_THRESHOLD_DURATION_DEFAULT 1500

// โหมดหาค่า software calibration offsets สำหรับ path ปัจจุบัน
// ใช้เมื่ออยากได้ค่า MPU_CAL_* ชุดใหม่ในหน่วยจริง (m/s² และ rad/s)
//
// *** ต้องเก็บค่าในท่าคล้องคอยืนนิ่งจริง — ไม่ใช่วางราบบนโต๊ะ ***
// เหตุผล: offset ที่ดีต้องสะท้อน gravity vector ในบริบทใช้งานจริง
// โต๊ะราบทำให้ Z = 1g, X/Y = 0 ซึ่งต่างจากท่าคล้องคอมาก → offset ผิดบริบท
// ส่วน gyro zero-rate offset ไม่ขึ้นกับท่า — เก็บท่าไหนก็ได้ผลเหมือนกัน
//
// วิธีใช้:
//   1. ตั้ง SOFTWARE_CALIBRATION_MODE เป็น true แล้วอัปโหลด
//   2. คล้องอุปกรณ์ที่คอในท่าปกติ ยืนนิ่ง หายใจตามปกติ
//   3. เปิด Serial Monitor — รอผ่าน warmup แล้วระบบเก็บค่าเอง
//   4. คัดลอกค่า MPU_CAL_* ที่พิมพ์ออกมาไปใส่ด้านล่าง
//   5. ตั้ง SOFTWARE_CALIBRATION_MODE กลับเป็น false แล้วอัปโหลดใหม่
#define SOFTWARE_CALIBRATION_MODE false
#define SOFTWARE_CALIBRATION_WARMUP_SAMPLES 100
#define SOFTWARE_CALIBRATION_CAPTURE_SAMPLES 400

// bridge ให้ sensor_tuning.ino เรียกใช้ค่านี้ได้ตอน runtime
// (sensor_tuning.ino ถูก compile ก่อนไฟล์นี้ จึงใช้ #if ตรงๆ ไม่ได้)
bool isSoftwareCalibrationMode() { return SOFTWARE_CALIBRATION_MODE; }

// ค่าคาลิเบรตจากท่าคล้องคอยืนนิ่ง (neck-mounted standing neutral pose) — 400 samples, 2026-03-30
// accel avg=(0.578, 1.106, -0.019)g |mag|=1.248g → offset ชดเชยให้ resting SVM → 1g
#define MPU_CAL_ACCEL_OFFSET_X_MS2  1.127f
#define MPU_CAL_ACCEL_OFFSET_Y_MS2  2.158f
#define MPU_CAL_ACCEL_OFFSET_Z_MS2 -0.036f
#define MPU_CAL_GYRO_OFFSET_X_RAD  -0.061f
#define MPU_CAL_GYRO_OFFSET_Y_RAD   0.011f
#define MPU_CAL_GYRO_OFFSET_Z_RAD  -0.020f

#define IMU_POSTURE_DELTA_THRESHOLD_DEG 45.0f

// ============================================================================
// [2] สถานะภายในของโมดูล IMU (Module State)
// ============================================================================
// MPU6050RuntimeAddress ถูกย้ายไปไว้ใน types.h เพื่อให้ทุกไฟล์เห็นได้ตั้งแต่ต้น
MPU6050RuntimeAddress mpu;
MPU6050Data mpuData;
uint8_t activeMpuAddress = MPU6050_ADDR_AD0_LOW;
uint8_t activeWhoAmI = 0;

// ตัวกรอง SMA
#define SMA_WINDOW_SIZE 10
float svmBuffer[SMA_WINDOW_SIZE] = {0};
int svmIndex = 0;

// SVM ดิบล่าสุด (ก่อนกรอง SMA) สำหรับ Fall Detection Sensor Lab log เท่านั้น
// เก็บค่าเฉย ๆ ไม่นำกลับเข้าสู่ fall-detection logic
float lastSvmRawG = 0;

// ตัวกรอง complementary
unsigned long previousTime = 0;

// สถานะ fall detection
// ค่าคอนฟิกจาก FallDetectionConfig.ino
extern float activeAccelThreshold;
extern unsigned long activeDurationThreshold;
extern float activePostureThreshold;

unsigned long lastMpuConnectionCheck = 0;
unsigned long lastSensorRead = 0;
uint8_t svmAnomalyCount = 0;                           // นับ SVM ผิดปกติต่อเนื่อง
static const uint8_t SVM_ANOMALY_REINIT_THRESHOLD = 3; // ผิดปกติ 3 ครั้งติดกันแล้ว reinit
unsigned long mpuReinitCooldownUntil = 0;              // เวลาสิ้นสุด cooldown หลัง reinit (ms)
unsigned long lastMpuConfigDriftLogTime = 0;
unsigned long lastMpuAbnormalDetailLogTime = 0;
int16_t lastRawAccelX = 0;
int16_t lastRawAccelY = 0;
int16_t lastRawAccelZ = 0;
int16_t lastRawGyroX = 0;
int16_t lastRawGyroY = 0;
int16_t lastRawGyroZ = 0;
uint8_t lastObservedAccelRange = MPU6050_EXPECTED_ACCEL_RANGE;
uint8_t lastObservedGyroRange = MPU6050_EXPECTED_GYRO_RANGE;
float lastObservedAccelScaleFactor = MPU6050_ACCEL_SCALE_FACTOR_4G;
float lastObservedGyroScaleFactor = MPU6050_GYRO_SCALE_FACTOR_500DPS;

// ตัวแปรของ state machine ตรวจ fall
enum FallState
{
  IDLE,
  IMPACT_DETECTED,
  WAIT_STABILIZE,
  POSTURE_CHECK
};
FallState currentFallState = IDLE;

unsigned long fallDetectedTime = 0;
bool fallDetected = false;
bool pendingFallActive = false;
unsigned long pendingFallStartTime = 0;
unsigned long impactEndTime = 0;

// ภาพ snapshot ตอน impact
float pendingFallAccelX = 0;
float pendingFallAccelY = 0;
float pendingFallAccelZ = 0;
float pendingFallGyroX = 0;
float pendingFallGyroY = 0;
float pendingFallGyroZ = 0;
float pendingFallMagnitude = 0;
float pendingPostureDeltaDeg = 0;

// ค่าตั้งต้นของ posture
float impactStartPitchDeg = 0;
float impactStartRollDeg = 0;
float postureDeltaAtDetectionDeg = 0;
bool baselineReset = false;

// ตัวแปร log
unsigned long lastImuRawLogTime = 0;

// Fall Detection Sensor Lab: ส่ง imu_sample เป็นระยะ เพื่อให้ non-fall trial
// (standing_still/walking_normal/running_light/sit_normal) มีข้อมูล sensor
// แม้ไม่เกิด impact. ส่งเฉพาะ lab topic เท่านั้น ไม่แตะ production event flow.
#define IMU_SAMPLE_INTERVAL_MS 300UL
unsigned long lastImuSampleTime = 0;
bool softwareCalibrationStarted = false;
bool softwareCalibrationCompleted = false;
bool softwareCalibrationWarmupDone = false;
unsigned long softwareCalibrationWarmupStartMs = 0;
uint8_t softwareCalibrationLastCountdown = 0;
uint16_t softwareCalibrationSampleCount = 0;
double softwareCalibrationAccelXSum = 0.0;
double softwareCalibrationAccelYSum = 0.0;
double softwareCalibrationAccelZSum = 0.0;
double softwareCalibrationGyroXSum = 0.0;
double softwareCalibrationGyroYSum = 0.0;
double softwareCalibrationGyroZSum = 0.0;

// ============================================================================
// [3] การเชื่อมต่อกับโมดูลอื่นและประกาศฟังก์ชันล่วงหน้า
// ============================================================================
// ฟังก์ชันประกาศล่วงหน้า
void sensorLogf(uint16_t category, const char *fmt, ...);
bool isSensorLogEnabled(uint16_t category);
unsigned long getSensorRawLogIntervalMs();
bool isMpuDiagnosticMode();
void publishFallLifecycleEvent(const char *type);
void publishLabImuLog(const char *logType, const char *stateStr,
                      const char *decisionStr, float orientationDeltaDeg);
void startPendingFallConfirmation();
void resetFallDetection();
void setLastFallTimestamp(unsigned long timestamp);
bool isAlertSystemReady();
void alertFall();
unsigned long getFallCancelTimeoutMs();
bool consumeCancelButtonConfirmed();
void cancelFallAlert();

// ============================================================================
// [4] Helper Functions ของ IMU config/recovery
// ============================================================================

bool isAcceptedWhoAmI(uint8_t whoAmI)
{
  return whoAmI == MPU6050_WHO_AM_I_6050_LOW ||
         whoAmI == MPU6050_WHO_AM_I_6050_HIGH ||
         whoAmI == MPU6050_WHO_AM_I_ALT_70;
}

void applyMPU6050MeasurementConfig()
{
  mpu.setFullScaleAccelRange(MPU6050_EXPECTED_ACCEL_RANGE);
  mpu.setFullScaleGyroRange(MPU6050_EXPECTED_GYRO_RANGE);
}

void applyMPU6050OffsetConfig()
{
  // sensor_tuning ใช้ calibration offsets แบบ software อย่างเดียว
  // จึงบังคับให้ register offsets เป็นศูนย์เสมอเพื่อตัด source of drift แบบเดิม
  mpu.setXGyroOffset(MPU6050_DEFAULT_GYRO_OFFSET);
  mpu.setYGyroOffset(MPU6050_DEFAULT_GYRO_OFFSET);
  mpu.setZGyroOffset(MPU6050_DEFAULT_GYRO_OFFSET);
  mpu.setXAccelOffset(MPU6050_DEFAULT_ACCEL_OFFSET);
  mpu.setYAccelOffset(MPU6050_DEFAULT_ACCEL_OFFSET);
  mpu.setZAccelOffset(MPU6050_DEFAULT_ACCEL_OFFSET);
}

bool ensureMPU6050RuntimeConfig(bool logRecovery)
{
  uint8_t accelRange = mpu.getFullScaleAccelRange();
  uint8_t gyroRange = mpu.getFullScaleGyroRange();

  if (accelRange == MPU6050_EXPECTED_ACCEL_RANGE &&
      gyroRange == MPU6050_EXPECTED_GYRO_RANGE)
  {
    return true;
  }

  if (logRecovery)
  {
    sensorLogf(SENSOR_LOG_SYSTEM,
               "MPU config drift detected (accel=%u expected=%u gyro=%u expected=%u) -> reapply",
               accelRange, MPU6050_EXPECTED_ACCEL_RANGE,
               gyroRange, MPU6050_EXPECTED_GYRO_RANGE);
  }

  applyMPU6050MeasurementConfig();
  applyMPU6050OffsetConfig();
  delay(2);

  accelRange = mpu.getFullScaleAccelRange();
  gyroRange = mpu.getFullScaleGyroRange();

  if (accelRange != MPU6050_EXPECTED_ACCEL_RANGE ||
      gyroRange != MPU6050_EXPECTED_GYRO_RANGE)
  {
    if (logRecovery)
    {
      sensorLogf(SENSOR_LOG_SYSTEM,
                 "MPU config restore failed (accel=%u gyro=%u)",
                 accelRange, gyroRange);
    }
    return false;
  }

  if (logRecovery)
  {
    sensorLogf(SENSOR_LOG_SYSTEM,
               "MPU config restored (accel=%u gyro=%u)",
               accelRange, gyroRange);
  }

  return true;
}

float getAccelScaleFactorForRange(uint8_t accelRange)
{
  switch (accelRange)
  {
  case MPU6050_ACCEL_FS_2:
    return 16384.0f;
  case MPU6050_ACCEL_FS_4:
    return 8192.0f;
  case MPU6050_ACCEL_FS_8:
    return 4096.0f;
  case MPU6050_ACCEL_FS_16:
    return 2048.0f;
  default:
    return MPU6050_ACCEL_SCALE_FACTOR_4G;
  }
}

float getGyroScaleFactorForRange(uint8_t gyroRange)
{
  switch (gyroRange)
  {
  case MPU6050_GYRO_FS_250:
    return 131.0f;
  case MPU6050_GYRO_FS_500:
    return 65.5f;
  case MPU6050_GYRO_FS_1000:
    return 32.8f;
  case MPU6050_GYRO_FS_2000:
    return 16.4f;
  default:
    return MPU6050_GYRO_SCALE_FACTOR_500DPS;
  }
}

float getSoftwareAccelOffsetXG()
{
#if SOFTWARE_CALIBRATION_MODE
  return 0.0f;
#else
  return MPU_CAL_ACCEL_OFFSET_X_MS2 / MPU6050_GRAVITY_MS2;
#endif
}

float getSoftwareAccelOffsetYG()
{
#if SOFTWARE_CALIBRATION_MODE
  return 0.0f;
#else
  return MPU_CAL_ACCEL_OFFSET_Y_MS2 / MPU6050_GRAVITY_MS2;
#endif
}

float getSoftwareAccelOffsetZG()
{
#if SOFTWARE_CALIBRATION_MODE
  return 0.0f;
#else
  return MPU_CAL_ACCEL_OFFSET_Z_MS2 / MPU6050_GRAVITY_MS2;
#endif
}

float getSoftwareGyroOffsetXDps()
{
#if SOFTWARE_CALIBRATION_MODE
  return 0.0f;
#else
  return MPU_CAL_GYRO_OFFSET_X_RAD * MPU6050_RAD_TO_DEG;
#endif
}

float getSoftwareGyroOffsetYDps()
{
#if SOFTWARE_CALIBRATION_MODE
  return 0.0f;
#else
  return MPU_CAL_GYRO_OFFSET_Y_RAD * MPU6050_RAD_TO_DEG;
#endif
}

float getSoftwareGyroOffsetZDps()
{
#if SOFTWARE_CALIBRATION_MODE
  return 0.0f;
#else
  return MPU_CAL_GYRO_OFFSET_Z_RAD * MPU6050_RAD_TO_DEG;
#endif
}

// ============================================================================
// [5] เครื่องมือ software calibration สำหรับ neutral pose
// ============================================================================

void printSoftwareCalibrationInstructions()
{
  Serial.println("🧪 SOFTWARE_CALIBRATION_MODE=ON");
  Serial.println("   คล้องอุปกรณ์ที่คอ ยืนนิ่ง หายใจตามปกติ แล้วรอเก็บตัวอย่าง");
  Serial.printf("   warmup=%u samples  capture=%u samples\n",
                SOFTWARE_CALIBRATION_WARMUP_SAMPLES,
                SOFTWARE_CALIBRATION_CAPTURE_SAMPLES);
  Serial.println("   💡 เก็บหลายรอบ: กด EN/RST บนบอร์ด (ไม่ต้องถอด USB)");
}

void handleSoftwareCalibrationSample(float accelXRawG, float accelYRawG, float accelZRawG,
                                     float gyroXRawDps, float gyroYRawDps, float gyroZRawDps)
{
#if !SOFTWARE_CALIBRATION_MODE
  (void)accelXRawG;
  (void)accelYRawG;
  (void)accelZRawG;
  (void)gyroXRawDps;
  (void)gyroYRawDps;
  (void)gyroZRawDps;
  return;
#else
  if (softwareCalibrationCompleted)
  {
    return;
  }

  if (!softwareCalibrationStarted)
  {
    softwareCalibrationStarted = true;
    softwareCalibrationWarmupStartMs = millis();
    softwareCalibrationLastCountdown = 3;
    printSoftwareCalibrationInstructions();
    Serial.println("   ⏳ 3...");
  }

  if (!softwareCalibrationWarmupDone)
  {
    unsigned long elapsed = millis() - softwareCalibrationWarmupStartMs;
    uint8_t secondsLeft = (elapsed < 3000) ? (3 - (uint8_t)(elapsed / 1000)) : 0;

    if (secondsLeft < softwareCalibrationLastCountdown && secondsLeft > 0)
    {
      softwareCalibrationLastCountdown = secondsLeft;
      Serial.printf("   ⏳ %u...\n", secondsLeft);
    }

    if (elapsed < 3000)
    {
      return;
    }

    softwareCalibrationWarmupDone = true;
    Serial.println("✅ เริ่มเก็บค่า — ยืนนิ่งๆ ไว้เลยครับ");
    return;
  }

  softwareCalibrationAccelXSum += accelXRawG;
  softwareCalibrationAccelYSum += accelYRawG;
  softwareCalibrationAccelZSum += accelZRawG;
  softwareCalibrationGyroXSum += gyroXRawDps;
  softwareCalibrationGyroYSum += gyroYRawDps;
  softwareCalibrationGyroZSum += gyroZRawDps;
  ++softwareCalibrationSampleCount;

  if (softwareCalibrationSampleCount % 50 == 0)
  {
    Serial.printf("📌 Capture progress: %u/%u\n",
                  softwareCalibrationSampleCount,
                  SOFTWARE_CALIBRATION_CAPTURE_SAMPLES);
  }

  if (softwareCalibrationSampleCount < SOFTWARE_CALIBRATION_CAPTURE_SAMPLES)
  {
    return;
  }

  const float avgAccelXG = static_cast<float>(softwareCalibrationAccelXSum / softwareCalibrationSampleCount);
  const float avgAccelYG = static_cast<float>(softwareCalibrationAccelYSum / softwareCalibrationSampleCount);
  const float avgAccelZG = static_cast<float>(softwareCalibrationAccelZSum / softwareCalibrationSampleCount);
  const float avgGyroXDps = static_cast<float>(softwareCalibrationGyroXSum / softwareCalibrationSampleCount);
  const float avgGyroYDps = static_cast<float>(softwareCalibrationGyroYSum / softwareCalibrationSampleCount);
  const float avgGyroZDps = static_cast<float>(softwareCalibrationGyroZSum / softwareCalibrationSampleCount);

  const float avgAccelMagnitudeG =
      sqrtf(avgAccelXG * avgAccelXG +
            avgAccelYG * avgAccelYG +
            avgAccelZG * avgAccelZG);

  float accelOffsetXMs2 = 0.0f;
  float accelOffsetYMs2 = 0.0f;
  float accelOffsetZMs2 = 0.0f;
  if (avgAccelMagnitudeG > 0.0001f)
  {
    const float normalizedX = avgAccelXG / avgAccelMagnitudeG;
    const float normalizedY = avgAccelYG / avgAccelMagnitudeG;
    const float normalizedZ = avgAccelZG / avgAccelMagnitudeG;
    const float magnitudeErrorG = avgAccelMagnitudeG - 1.0f;

    // ปรับเฉพาะตามแนวแรงโน้มถ่วงที่วัดได้จริง
    // เพื่อให้ resting SVM ใกล้ 1g โดยไม่บังคับ orientation ให้กลายเป็น flat reference
    accelOffsetXMs2 = normalizedX * magnitudeErrorG * MPU6050_GRAVITY_MS2;
    accelOffsetYMs2 = normalizedY * magnitudeErrorG * MPU6050_GRAVITY_MS2;
    accelOffsetZMs2 = normalizedZ * magnitudeErrorG * MPU6050_GRAVITY_MS2;
  }

  const float gyroOffsetXRad = avgGyroXDps * MPU6050_DEG_TO_RAD;
  const float gyroOffsetYRad = avgGyroYDps * MPU6050_DEG_TO_RAD;
  const float gyroOffsetZRad = avgGyroZDps * MPU6050_DEG_TO_RAD;

  softwareCalibrationCompleted = true;

  Serial.println("==================================================");
  Serial.println(" Recommended MPU_CAL_* values");
  Serial.println(" Reference pose: current mounted neutral pose");
  Serial.println("==================================================");
  Serial.printf("#define MPU_CAL_ACCEL_OFFSET_X_MS2 %.3ff\n", accelOffsetXMs2);
  Serial.printf("#define MPU_CAL_ACCEL_OFFSET_Y_MS2 %.3ff\n", accelOffsetYMs2);
  Serial.printf("#define MPU_CAL_ACCEL_OFFSET_Z_MS2 %.3ff\n", accelOffsetZMs2);
  Serial.printf("#define MPU_CAL_GYRO_OFFSET_X_RAD %.3ff\n", gyroOffsetXRad);
  Serial.printf("#define MPU_CAL_GYRO_OFFSET_Y_RAD %.3ff\n", gyroOffsetYRad);
  Serial.printf("#define MPU_CAL_GYRO_OFFSET_Z_RAD %.3ff\n", gyroOffsetZRad);
  Serial.println("==================================================");
  Serial.printf("Averages: accel_g=(%.3f, %.3f, %.3f) |mag|=%.3f gyro_dps=(%.3f, %.3f, %.3f)\n",
                avgAccelXG, avgAccelYG, avgAccelZG,
                avgAccelMagnitudeG,
                avgGyroXDps, avgGyroYDps, avgGyroZDps);
  Serial.println("💡 ถ้าเก็บหลายรอบ: เลือกรอบที่ |mag| ใกล้ 1.000 ที่สุด");
  Serial.println("✅ คัดลอกค่าด้านบนแล้วตั้ง SOFTWARE_CALIBRATION_MODE = false อัปโหลดใหม่");
#endif
}

bool readWhoAmI(uint8_t addr, uint8_t &whoAmI, uint8_t &txErr,
                uint8_t &rxCount)
{
  whoAmI = 0;
  txErr = 0;
  rxCount = 0;

  Wire.beginTransmission(addr);
  Wire.write(MPU6050_WHO_AM_I_REG);
  txErr = Wire.endTransmission(false);
  if (txErr != 0)
    return false;

  rxCount = Wire.requestFrom(static_cast<int>(addr), 1, true);
  if (rxCount != 1)
    return false;

  whoAmI = static_cast<uint8_t>(Wire.read());
  return true;
}

// ============================================================================
// [6] การเริ่มต้นเซนเซอร์ IMU (Initialization)
// ============================================================================
bool initMPU6050()
{
  const uint8_t fallbackAddress =
      (activeMpuAddress == MPU6050_ADDR_AD0_LOW) ? MPU6050_ADDR_AD0_HIGH
                                                 : MPU6050_ADDR_AD0_LOW;
  const uint8_t probeOrder[2] = {activeMpuAddress, fallbackAddress};
  bool connectionReady = false;

  for (uint8_t i = 0; i < 2; ++i)
  {
    const uint8_t addr = probeOrder[i];
    uint8_t whoAmI = 0;
    uint8_t txErr = 0;
    uint8_t rxCount = 0;

    mpu.setAddress(addr);
    mpu.initialize();
    if (readWhoAmI(addr, whoAmI, txErr, rxCount) && isAcceptedWhoAmI(whoAmI))
    {
      activeMpuAddress = addr;
      activeWhoAmI = whoAmI;
      connectionReady = true;
      break;
    }
  }

  if (!connectionReady)
  {
    sensorLogf(SENSOR_LOG_SYSTEM,
               "MPU6050 identity check failed (checked 0x68/0x69)");
    return false;
  }

  // ตั้งช่วงการวัดและ offsets ให้กลับสู่ค่าที่ firmware คาดไว้ทุกครั้ง
  applyMPU6050MeasurementConfig();
  applyMPU6050OffsetConfig();

  if (!ensureMPU6050RuntimeConfig(false))
  {
    sensorLogf(SENSOR_LOG_SYSTEM,
               "MPU6050 config verify failed right after init");
    return false;
  }

  sensorLogf(SENSOR_LOG_SYSTEM,
             "MPU config ready (register_offsets=OFF software_offsets=%s calibration_mode=%s accel_range=%u gyro_range=%u)",
             SOFTWARE_CALIBRATION_MODE ? "BYPASS" : "ON",
             SOFTWARE_CALIBRATION_MODE ? "ON" : "OFF",
             mpu.getFullScaleAccelRange(), mpu.getFullScaleGyroRange());

  for (int i = 0; i < SMA_WINDOW_SIZE; i++)
  {
    svmBuffer[i] = 1.0f;
  }
  previousTime = millis();

  mpuData.isInitialized = true;
  lastMpuConnectionCheck = millis();

  if (activeWhoAmI == MPU6050_WHO_AM_I_ALT_70)
  {
    // ชิป clone — WHO_AM_I=0x70 แทน 0x68 ที่คาดไว้
    // ยังทำงานได้ แต่ค่า offset และ noise อาจต่างจากชิปแท้
    // ควร calibrate ใหม่และทดสอบ threshold ซ้ำก่อนใช้งานจริง
    Serial.println("⚠️  [WHO_AM_I] ตรวจพบ clone chip (WHO_AM_I=0x70)");
    Serial.println("⚠️  ชิปนี้ทำงานได้ แต่ควร calibrate offset ใหม่และทดสอบ threshold ซ้ำ");
    sensorLogf(SENSOR_LOG_IMU_EVENT,
               "MPU initialized (Raw 6-Axis, addr=0x%02X who=0x%02X) [CLONE CHIP]",
               activeMpuAddress, activeWhoAmI);
  }
  else
  {
    sensorLogf(SENSOR_LOG_IMU_EVENT,
               "MPU6050 initialized (Raw 6-Axis, addr=0x%02X who=0x%02X) [Genuine]",
               activeMpuAddress, activeWhoAmI);
  }
  return true;
}

// ============================================================================
// [7] วงรอบอ่านค่า IMU หลัก (Main Sensor Loop)
// ============================================================================

void readMPU6050()
{
  if (!mpuData.isInitialized && !initMPU6050())
    return;

  // health check เป็นระยะเพื่อจับกรณีสายหลุดหรือ identity register เพี้ยน
  if (millis() - lastMpuConnectionCheck >= MPU6050_RECHECK_INTERVAL_MS)
  {
    lastMpuConnectionCheck = millis();
    uint8_t whoAmI = 0;
    uint8_t txErr = 0;
    uint8_t rxCount = 0;
    bool readOk = readWhoAmI(activeMpuAddress, whoAmI, txErr, rxCount);
    if (!readOk || !isAcceptedWhoAmI(whoAmI))
    {
      mpuData.isInitialized = false;
      sensorLogf(SENSOR_LOG_SYSTEM,
                 "MPU connection lost/invalid identity (addr=0x%02X tx=%u rx=%u "
                 "who=0x%02X)",
                 activeMpuAddress, txErr, rxCount, whoAmI);
      return;
    }
    activeWhoAmI = whoAmI;

    if (!ensureMPU6050RuntimeConfig(true))
    {
      mpuData.isInitialized = false;
      return;
    }
  }

  uint8_t accelRange = mpu.getFullScaleAccelRange();
  uint8_t gyroRange = mpu.getFullScaleGyroRange();

  if (accelRange != MPU6050_EXPECTED_ACCEL_RANGE ||
      gyroRange != MPU6050_EXPECTED_GYRO_RANGE)
  {
    bool shouldLog = millis() - lastMpuConfigDriftLogTime >= 1000UL;
    if (shouldLog)
    {
      lastMpuConfigDriftLogTime = millis();
    }

    if (!ensureMPU6050RuntimeConfig(shouldLog))
    {
      mpuData.isInitialized = false;
      return;
    }

    accelRange = mpu.getFullScaleAccelRange();
    gyroRange = mpu.getFullScaleGyroRange();
  }

  float accelScaleFactor = getAccelScaleFactorForRange(accelRange);
  float gyroScaleFactor = getGyroScaleFactorForRange(gyroRange);

  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

  lastRawAccelX = ax;
  lastRawAccelY = ay;
  lastRawAccelZ = az;
  lastRawGyroX = gx;
  lastRawGyroY = gy;
  lastRawGyroZ = gz;
  lastObservedAccelRange = accelRange;
  lastObservedGyroRange = gyroRange;
  lastObservedAccelScaleFactor = accelScaleFactor;
  lastObservedGyroScaleFactor = gyroScaleFactor;

  float accelXRawG = ax / accelScaleFactor;
  float accelYRawG = ay / accelScaleFactor;
  float accelZRawG = az / accelScaleFactor;

  float gyroXRawDps = gx / gyroScaleFactor;
  float gyroYRawDps = gy / gyroScaleFactor;
  float gyroZRawDps = gz / gyroScaleFactor;

  handleSoftwareCalibrationSample(
      accelXRawG, accelYRawG, accelZRawG,
      gyroXRawDps, gyroYRawDps, gyroZRawDps);

  float accelX = accelXRawG;
  float accelY = accelYRawG;
  float accelZ = accelZRawG;

  float gyroX = gyroXRawDps;
  float gyroY = gyroYRawDps;
  float gyroZ = gyroZRawDps;

  // apply software calibration ในหน่วยจริงหลังแปลง scale แล้ว
  accelX -= getSoftwareAccelOffsetXG();
  accelY -= getSoftwareAccelOffsetYG();
  accelZ -= getSoftwareAccelOffsetZG();
  gyroX -= getSoftwareGyroOffsetXDps();
  gyroY -= getSoftwareGyroOffsetYDps();
  gyroZ -= getSoftwareGyroOffsetZDps();

  mpuData.accelX = accelX;
  mpuData.accelY = accelY;
  mpuData.accelZ = accelZ;

  mpuData.gyroX = gyroX;
  mpuData.gyroY = gyroY;
  mpuData.gyroZ = gyroZ;

  // 1) คำนวณ SVM (Signal Vector Magnitude) จากค่าหลัง software offset
  // ใช้ทฤษฎีบทพีทาโกรัสแบบ 3 มิติ เพื่อหา "แรงลัพธ์รวม" ไม่ว่าเซนเซอร์จะหันไปทางไหน
  // หมายเหตุ: ขณะอยู่นิ่งๆ ค่า SVM จะเท่ากับ 1.0g (แรงโน้มถ่วงโลก) เสมอ
  float svmRaw = sqrt(pow(accelX, 2) + pow(accelY, 2) + pow(accelZ, 2));
  lastSvmRawG = svmRaw; // mirror สำหรับ lab log เท่านั้น ไม่กระทบ logic เดิม

  // 2) กรอง SVM ด้วย SMA (Simple Moving Average) ก่อนใช้เป็น evidence ของ impact
  // เอาค่ามาเฉลี่ยย้อนหลัง X ครั้ง (SMA_WINDOW_SIZE) เพื่อลด Noise (สัญญาณรบกวน)
  svmBuffer[svmIndex] = svmRaw;
  svmIndex = (svmIndex + 1) % SMA_WINDOW_SIZE;
  float svmFiltered = 0;
  for (int i = 0; i < SMA_WINDOW_SIZE; i++)
  {
    svmFiltered += svmBuffer[i];
  }
  svmFiltered /= SMA_WINDOW_SIZE;
  mpuData.totalAccel = svmFiltered;

  bool mpuDiagnosticMode = isMpuDiagnosticMode();
  // sensor_tuning ตอนนี้รองรับท่าติดตั้งจริงที่อาจเอียงถาวร
  // ดังนั้นห้ามใช้เกณฑ์รายแกนแบบ "ต้องใกล้ 0,0,1" เพราะจะฟ้อง false alarm ตลอด
  // ใช้ความผิดปกติของ magnitude เป็นหลักเพื่อจับอาการ 2g / drift ที่เราเคยเจอ
  bool abnormalSample = fabs(svmFiltered - 1.0f) >= 0.20f;

  if (!SOFTWARE_CALIBRATION_MODE &&
      abnormalSample &&
      millis() - lastMpuAbnormalDetailLogTime >= 400UL)
  {
    lastMpuAbnormalDetailLogTime = millis();
    sensorLogf(
        SENSOR_LOG_SYSTEM,
        "MPU abnormal  rawA=(%d,%d,%d) rawG=(%d,%d,%d)  accel=(%.2f,%.2f,%.2f)g  svm=%.2fg  "
        "fsRange[acc=%u gyr=%u]  scale[acc=%.0f gyr=%.1f]  "
        "swCal[acc=(%.3f,%.3f,%.3f)g  gyr=(%.2f,%.2f,%.2f)dps]",
        ax, ay, az, gx, gy, gz, accelX, accelY, accelZ, svmFiltered,
        accelRange, gyroRange, accelScaleFactor, gyroScaleFactor,
        getSoftwareAccelOffsetXG(), getSoftwareAccelOffsetYG(),
        getSoftwareAccelOffsetZG(), getSoftwareGyroOffsetXDps(),
        getSoftwareGyroOffsetYDps(), getSoftwareGyroOffsetZDps());
  }

  // watchdog นี้ใช้จับกรณี SVM เพี้ยนจาก state ของ MPU6050 ที่เสียหลัง radio spike
  // กรณี WiFi TX peak → voltage sag → register ของ MPU6050 เพี้ยน
  // แม้ WHO_AM_I ยังผ่าน recheck แต่ range/offset registers reset → SVM อ่านสูงผิดปกติ
  // การ write I2C รายรอบไม่ช่วย ต้อง force full reinit เท่านั้น
  // หลัง reinit ต้องรอ 500ms ก่อนตัดสินใจ reinit ซ้ำ กัน loop วนไม่หยุด
#if !SOFTWARE_CALIBRATION_MODE && MPU6050_ENABLE_SVM_WATCHDOG
  if (mpuDiagnosticMode)
  {
    svmAnomalyCount = 0;
  }
  else if (millis() < mpuReinitCooldownUntil)
  {
    // อยู่ในช่วง cooldown หลัง reinit — ข้าม watchdog รอให้ voltage นิ่ง
    svmAnomalyCount = 0;
  }
  else if (currentFallState == IDLE &&
           accelRange == MPU6050_EXPECTED_ACCEL_RANGE &&
           gyroRange == MPU6050_EXPECTED_GYRO_RANGE &&
           svmFiltered > 1.5f)
  {
    if (++svmAnomalyCount >= SVM_ANOMALY_REINIT_THRESHOLD)
    {
      sensorLogf(SENSOR_LOG_SYSTEM,
                 "[MPU WATCHDOG] SVM=%.2fg x%u — voltage sag, forcing reinit",
                 svmFiltered, svmAnomalyCount);
      mpuData.isInitialized = false;
      svmAnomalyCount = 0;
      mpuReinitCooldownUntil = millis() + 500; // cooldown 500ms
      return;
    }
  }
  else
  {
    svmAnomalyCount = 0;
  }
#endif

  unsigned long currentTime = millis();
  float dt = (currentTime - previousTime) / 1000.0f;
  previousTime = currentTime;

  // กันค่า dt กระโดดตอน loop สะดุด/เพิ่งเริ่มรอบ
  // ถ้าปล่อย dt ใหญ่เกินไป gyro integration จะพามุมเหวี่ยงจน baseline เพี้ยน
  if (dt > 0.1f)
    dt = 0.01f;

  // Accelerometer ให้มุมอ้างอิงระยะยาว แต่ไวต่อแรงกระแทก
  float accelPitch = atan2(accelY, accelZ) * 180.0f / M_PI;
  float accelRoll = atan2(-accelX, sqrt(pow(accelY, 2) + pow(accelZ, 2))) * 180.0f / M_PI;

  // Complementary Filter 98/2: (ฟิลเตอร์แบบเติมเต็ม)
  // เป็นการผสมข้อดีของเซนเซอร์ 2 ชนิดเข้าด้วยกัน:
  // - ฝั่ง Gyroscope: ตอบสนองไว หมุนปุ๊บรู้ปั๊บ แต่ถ้าปล่อยไว้นานๆ ค่าจะเพี้ยน (Drift)
  // - ฝั่ง Accelerometer: แม่นยำในระยะยาว (อิงแรงโน้มถ่วงเสมอ) แต่เวลาขยับเร็วๆ ค่าจะแกว่ง (Noise)
  // สัดส่วน 0.98 (Gyro) / 0.02 (Accel) จึงเป็นการประนีประนอมให้ได้มุมที่ทั้ง "ไว" และ "ไม่เพี้ยน"
  mpuData.pitch = 0.98f * (mpuData.pitch + gyroX * dt) + 0.02f * accelPitch;
  mpuData.roll = 0.98f * (mpuData.roll + gyroY * dt) + 0.02f * accelRoll;
}

// ============================================================================
// [8] ตรรกะตรวจจับการหกล้ม (Fall Detection Logic)
// ============================================================================

void resetImpactBaseline()
{
  // จับ snapshot ของท่าทาง "ก่อน/ขณะเริ่ม impact" ทันที
  // เพื่อให้ขั้น posture check เปรียบเทียบกับท่าอ้างอิงของรอบนั้นจริง ๆ
  // ไม่ใช่เทียบกับค่าตั้งต้นตอนบูตเครื่อง
  impactStartPitchDeg = mpuData.pitch;
  impactStartRollDeg = mpuData.roll;
  baselineReset = true;
}

float calculateOrientationDeltaDeg()
{
  if (!baselineReset)
    return 0.0f;

  // ใช้แกนที่เปลี่ยนมากสุดเป็น posture delta ของรอบนี้
  // วิธีนี้ช่วยให้จับทั้งการคว่ำ/หงายและการเอียงข้างโดยไม่ต้องเดาทิศล้มล่วงหน้า
  float pitchDelta = fabs(mpuData.pitch - impactStartPitchDeg);
  float rollDelta = fabs(mpuData.roll - impactStartRollDeg);
  return pitchDelta > rollDelta ? pitchDelta : rollDelta;
}

bool detectFall()
{
#if SOFTWARE_CALIBRATION_MODE
  return false;
#endif
  if (pendingFallActive)
    return false;
  if (!mpuData.isInitialized)
    return false;

  float threshold = activeAccelThreshold > 0 ? activeAccelThreshold : FALL_THRESHOLD_ACCEL_DEFAULT;

  // ============================================================================
  // [Algorithm] Fall Detection State Machine (4 ขั้นตอน)
  // 1. IDLE           : รอจับแรงกระแทกที่รุนแรงเกินเกณฑ์ (Impact)
  // 2. IMPACT_DETECTED: เมื่อกระแทกแล้ว รอให้แรงสั่นสะเทือนลดลง
  // 3. WAIT_STABILIZE : หน่วงเวลาซักพัก (Delay) เพื่อให้ร่างกายหยุดนิ่งสนิทบนพื้น
  // 4. POSTURE_CHECK  : ตรวจสอบองศา (Orientation) ว่าเปลี่ยนไปจากตอนยืนหรือไม่
  //                     ถ้ามุมเปลี่ยนเยอะ = ล้มจริง, ถ้าน้อย = แค่กระโดดหรือนั่งแรงๆ
  // ============================================================================
  switch (currentFallState)
  {
  case IDLE:
    if (mpuData.totalAccel > threshold)
    {
      // ทันทีที่แรงกระแทกข้าม threshold ให้จำท่าทางปัจจุบันไว้ก่อน
      // baseline นี้คือจุดอ้างอิงสำหรับตอบคำถามว่า "หลัง impact แล้วร่างกายเปลี่ยนท่าไปมากพอไหม"
      resetImpactBaseline();
      fallDetectedTime = millis();
      currentFallState = IMPACT_DETECTED;

      pendingFallAccelX = mpuData.accelX;
      pendingFallAccelY = mpuData.accelY;
      pendingFallAccelZ = mpuData.accelZ;
      pendingFallGyroX = mpuData.gyroX;
      pendingFallGyroY = mpuData.gyroY;
      pendingFallGyroZ = mpuData.gyroZ;
      pendingFallMagnitude = mpuData.totalAccel;

      sensorLogf(SENSOR_LOG_FALL_FLOW, "Impact Spike Detected: SVM=%.2f g", mpuData.totalAccel);

      // Fall Detection Sensor Lab log: ส่งสแนปชอตตอนตรวจพบแรงกระแทก
      publishLabImuLog("imu_impact", "IMPACT_DETECTED", "pending", 0.0f);
    }
    break;

  case IMPACT_DETECTED:
    if (mpuData.totalAccel < 1.2f || (millis() - fallDetectedTime > 1000))
    {
      impactEndTime = millis();
      currentFallState = WAIT_STABILIZE;
      sensorLogf(SENSOR_LOG_FALL_FLOW, "Impact Over. Waiting for stabilization...");
    }
    break;

  case WAIT_STABILIZE:
  {
    unsigned long waitDuration = activeDurationThreshold > 0 ? activeDurationThreshold : FALL_THRESHOLD_DURATION_DEFAULT;
    if (millis() - impactEndTime >= waitDuration)
    {
      currentFallState = POSTURE_CHECK;
    }
  }
  break;

  case POSTURE_CHECK:
    float orientationDeltaDeg = calculateOrientationDeltaDeg();
    float postureThreshold = activePostureThreshold > 0 ? activePostureThreshold : IMU_POSTURE_DELTA_THRESHOLD_DEG;

    if (orientationDeltaDeg >= postureThreshold)
    {
      if (!fallDetected)
      {
        fallDetected = true;
        postureDeltaAtDetectionDeg = orientationDeltaDeg;

        sensorLogf(SENSOR_LOG_FALL_FLOW,
                   "FALL DETECTED (CF): SVM=%.2f pitch=%.1f roll=%.1f post_delta=%.1f(th=%.1f)",
                   mpuData.totalAccel, mpuData.pitch, mpuData.roll,
                   orientationDeltaDeg, postureThreshold);

        // Fall Detection Sensor Lab log: ผล posture check = สงสัยล้ม
        publishLabImuLog("imu_decision", "POSTURE_CHECK", "suspected_fall",
                         orientationDeltaDeg);

        currentFallState = IDLE;
        return true;
      }
    }
    else
    {
      sensorLogf(SENSOR_LOG_FALL_FLOW,
                 "Impact Ignored (Recovered): post_delta=%.1f(th=%.1f)",
                 orientationDeltaDeg, postureThreshold);

      // Fall Detection Sensor Lab log: ผล posture check = ไม่ใช่การล้ม
      publishLabImuLog("imu_decision", "POSTURE_CHECK", "ignored",
                       orientationDeltaDeg);

      currentFallState = IDLE;
      baselineReset = false;
    }
    break;
  }

  if (!pendingFallActive && fallDetected && (millis() - fallDetectedTime > 5000))
  {
    resetFallDetection();
  }

  return false;
}

// ============================================================================
// [9] ช่วงรอยืนยันและยกเลิกหลัง suspected fall (Confirmation Flow)
// ============================================================================

void resetFallDetection()
{
  fallDetected = false;
  fallDetectedTime = 0;
  postureDeltaAtDetectionDeg = 0;
  baselineReset = false;
  currentFallState = IDLE;

  if (!pendingFallActive)
  {
    pendingFallStartTime = 0;
    pendingFallAccelX = 0;
    pendingFallAccelY = 0;
    pendingFallAccelZ = 0;
    pendingFallGyroX = 0;
    pendingFallGyroY = 0;
    pendingFallGyroZ = 0;
    pendingFallMagnitude = 0;
    pendingPostureDeltaDeg = 0;
  }
}

void updatePendingFallConfirmation()
{
  if (!pendingFallActive)
    return;

  if (consumeCancelButtonConfirmed())
  {
    pendingFallActive = false;
    resetFallDetection();
    sensorLogf(SENSOR_LOG_FALL_FLOW, "Pending fall cancelled by local button");
    return;
  }

  unsigned long elapsed = millis() - pendingFallStartTime;
  if (elapsed >= getFallCancelTimeoutMs())
  {
    publishFallLifecycleEvent("fall_confirmed");
    cancelFallAlert();
    pendingFallActive = false;
    resetFallDetection();
    sensorLogf(SENSOR_LOG_FALL_FLOW, "Pending fall timeout reached -> fall confirmed");
  }
}

void startPendingFallConfirmation()
{
  if (pendingFallActive)
    return;

  pendingFallActive = true;
  pendingFallStartTime = millis();

  pendingPostureDeltaDeg = postureDeltaAtDetectionDeg;

  setLastFallTimestamp(pendingFallStartTime);

  if (isAlertSystemReady())
  {
    alertFall();
  }

  publishFallLifecycleEvent("suspected_fall");
  sensorLogf(SENSOR_LOG_FALL_FLOW, "Pending fall confirmation started");
}

void publishFallEvent() { startPendingFallConfirmation(); }

// ============================================================================
// [10] การส่ง event ของการล้มผ่าน MQTT (MQTT Publish)
// ============================================================================

void publishFallLifecycleEvent(const char *type)
{
  if (!mqtt.connected())
    return;

  String topic = "device/" + deviceSerial + "/event";
  JsonDocument doc;
  doc["type"] = type;
  doc["timestamp"] = millis();
  doc["magnitude"] = pendingFallMagnitude;
  doc["postureDelta"] = pendingPostureDeltaDeg;

  char buffer[512];
  serializeJson(doc, buffer);
  mqtt.publish(topic.c_str(), buffer);
}

// ============================================================================
// [10b] Lab log สำหรับ Fall Detection Sensor Lab (Lab IMU Log)
// ============================================================================
// ส่งค่า sensor/impact/posture/decision ไป topic แยก device/{serial}/lab/imu
// ใช้สำหรับเก็บข้อมูลงานวิจัยเท่านั้น ไม่แตะ event topic ของระบบจริง
// อ่านค่าจาก state ของ logic เดิมโดยตรง ไม่คำนวณซ้ำ
// Fall Detection Sensor Lab: ปัดทศนิยมเฉพาะ lab payload (ไม่กระทบ production/main_firmware)
// คงเป็นตัวเลข (number) ไม่ใช่ string
static float labRound(float v, uint8_t dp)
{
  float f = 1.0f;
  for (uint8_t i = 0; i < dp; i++)
    f *= 10.0f;
  return roundf(v * f) / f;
}

void publishLabImuLog(const char *logType, const char *stateStr,
                      const char *decisionStr, float orientationDeltaDeg)
{
  if (!mqtt.connected())
    return;

  float impactThreshold = activeAccelThreshold > 0 ? activeAccelThreshold
                                                   : FALL_THRESHOLD_ACCEL_DEFAULT;
  float postureThreshold = activePostureThreshold > 0 ? activePostureThreshold
                                                      : IMU_POSTURE_DELTA_THRESHOLD_DEG;
  unsigned long stabilizeMs = activeDurationThreshold > 0 ? activeDurationThreshold
                                                          : FALL_THRESHOLD_DURATION_DEFAULT;

  bool decided = (strcmp(logType, "imu_decision") == 0);
  float pitchAfter = decided ? mpuData.pitch : 0.0f;
  float rollAfter = decided ? mpuData.roll : 0.0f;
  float pitchDelta = decided ? fabs(mpuData.pitch - impactStartPitchDeg) : 0.0f;
  float rollDelta = decided ? fabs(mpuData.roll - impactStartRollDeg) : 0.0f;

  String topic = "device/" + deviceSerial + "/lab/imu";
  JsonDocument doc;
  doc["type"] = logType;
  doc["state"] = stateStr;
  doc["decision"] = decisionStr;
  doc["timestamp"] = millis();
  doc["ax"] = labRound(mpuData.accelX, 3);
  doc["ay"] = labRound(mpuData.accelY, 3);
  doc["az"] = labRound(mpuData.accelZ, 3);
  doc["gx"] = labRound(mpuData.gyroX, 2);
  doc["gy"] = labRound(mpuData.gyroY, 2);
  doc["gz"] = labRound(mpuData.gyroZ, 2);
  doc["svmRaw"] = labRound(lastSvmRawG, 3);
  doc["svmFiltered"] = labRound(mpuData.totalAccel, 3);
  doc["impactThreshold"] = labRound(impactThreshold, 2);
  doc["pitch"] = labRound(mpuData.pitch, 2);
  doc["roll"] = labRound(mpuData.roll, 2);
  doc["pitchBefore"] = labRound(impactStartPitchDeg, 2);
  doc["rollBefore"] = labRound(impactStartRollDeg, 2);
  doc["pitchAfter"] = labRound(pitchAfter, 2);
  doc["rollAfter"] = labRound(rollAfter, 2);
  doc["pitchDelta"] = labRound(pitchDelta, 2);
  doc["rollDelta"] = labRound(rollDelta, 2);
  doc["postureDelta"] = labRound(orientationDeltaDeg, 2);
  doc["postureThreshold"] = labRound(postureThreshold, 2);
  doc["stabilizeMs"] = stabilizeMs;

  char buffer[640];
  serializeJson(doc, buffer);
  mqtt.publish(topic.c_str(), buffer);
}

// ============================================================================
// [11] Hook ที่ SensorManager เรียกใช้ (Update Hook)
// ============================================================================

// Fall Detection Sensor Lab: ชื่อ state ปัจจุบันของ fall state machine (read-only)
static const char *labCurrentStateStr()
{
  switch (currentFallState)
  {
  case IMPACT_DETECTED:
    return "IMPACT_DETECTED";
  case WAIT_STABILIZE:
    return "WAIT_STABILIZE";
  case POSTURE_CHECK:
    return "POSTURE_CHECK";
  case IDLE:
  default:
    return "IDLE";
  }
}

// update path หลักของโมดูล IMU สำหรับรอบจูน
void updateMPU6050()
{
  bool mpuDiagnosticMode = isMpuDiagnosticMode();
  updatePendingFallConfirmation();
  readMPU6050();

  if (!SOFTWARE_CALIBRATION_MODE &&
      isSensorLogEnabled(SENSOR_LOG_IMU_RAW) && mpuData.isInitialized &&
      millis() - lastImuRawLogTime >= getSensorRawLogIntervalMs())
  {
    lastImuRawLogTime = millis();
    sensorLogf(
        SENSOR_LOG_IMU_RAW,
        "accel=(%.2f,%.2f,%.2f)g  pitch=%.1f  roll=%.1f  svm=%.2fg  rawA=(%d,%d,%d)",
        mpuData.accelX, mpuData.accelY, mpuData.accelZ,
        mpuData.pitch, mpuData.roll, mpuData.totalAccel,
        lastRawAccelX, lastRawAccelY, lastRawAccelZ);
  }

  if (mpuDiagnosticMode)
  {
    if (pendingFallActive || currentFallState != IDLE || fallDetected)
    {
      pendingFallActive = false;
      cancelFallAlert();
      resetFallDetection();
    }
    return;
  }

  // Fall Detection Sensor Lab: ส่ง imu_sample เป็นระยะระหว่างไม่มี impact/decision
  // เพื่อให้ non-fall trial มีข้อมูล sensor เพียงพอ. throttle ตาม interval,
  // หยุดส่งช่วง pendingFallActive เพื่อไม่ไปยุ่งกับ confirmation flow.
  // ส่งเฉพาะ lab topic ผ่าน publishLabImuLog เท่านั้น ไม่กระทบ fall logic.
  if (!pendingFallActive && mpuData.isInitialized &&
      millis() - lastImuSampleTime >= IMU_SAMPLE_INTERVAL_MS)
  {
    lastImuSampleTime = millis();
    publishLabImuLog("imu_sample", labCurrentStateStr(), "sample", 0.0f);
  }

  if (!pendingFallActive && detectFall())
  {
    publishFallEvent();
  }
}

// ============================================================================
// [12] API สาธารณะของโมดูล (Public Module API)
// ============================================================================

MPU6050Data getMPU6050Data() { return mpuData; }
bool isMPU6050Ready() { return mpuData.isInitialized; }
