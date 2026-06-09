/**
 * @file MPU6050_Sensor.ino
 * @brief MPU6050Sensor: โมดูล IMU ของ main_firmware สำหรับอ่านการเคลื่อนไหวและตรวจ fall flow
 *
 * ใช้กับ: Fall Detection - ตรวจจับการหกล้มจากความเร่ง
 *
 * ฮาร์ดแวร์:
 * - MPU6050 (I2C) - SDA=GPIO21, SCL=GPIO22
 *
 * ความสามารถ:
 * - เฝ้าดูความเร่งแบบ raw 6-axis แบบ real-time
 * - ใช้ SVM ร่วมกับ complementary filter ในการตรวจ fall
 * - ปรับ sensitivity ได้ผ่าน FallDetectionConfig.ino
 * - ส่ง event ผ่าน MQTT
 */

#include "types.h"
#include <I2Cdev.h>
#include <MPU6050.h>
#include <Wire.h>

// ============================================================================
// [1] ค่าคงที่ของ MPU6050 และ fall pipeline (Configuration & Constants)
// ============================================================================
#define MPU6050_RECHECK_INTERVAL_MS 5000UL // ตรวจเช็กการเชื่อมต่อเซนเซอร์ทุก ๆ 5 วินาที
#define MPU6050_DEFAULT_ACCEL_OFFSET 0     // ค่า offset เริ่มต้นของ accelerometer
#define MPU6050_DEFAULT_GYRO_OFFSET 0      // ค่า offset เริ่มต้นของ gyroscope
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

// เปิดใช้ watchdog ที่จับ SVM spike จาก WiFi TX voltage sag ใน main_firmware
#define MPU6050_ENABLE_SVM_WATCHDOG true

#define MPU6050_GRAVITY_MS2 9.80665f
#define MPU6050_RAD_TO_DEG 57.2957795f
#define MPU6050_DEG_TO_RAD 0.0174532925f

// ค่าเผื่อฉุกเฉิน (ปกติจะใช้ค่าจาก FallDetectionConfig.ino)
#define FALL_THRESHOLD_ACCEL_DEFAULT 2.0f
#define FALL_THRESHOLD_DURATION_DEFAULT 1500

// ============================================================================
// [2] ค่า Software Offset จาก sensor_tuning (Calibration Values)
// ============================================================================
// คาลิเบรตผ่าน sensor_tuning firmware แล้ว — ห้ามแก้โดยไม่ calibrate ใหม่
// pose: คล้องคอยืนนิ่ง | 400 samples | 2026-03-30 | |mag|=1.248g
#define MPU_CAL_ACCEL_OFFSET_X_MS2  1.127f
#define MPU_CAL_ACCEL_OFFSET_Y_MS2  2.158f
#define MPU_CAL_ACCEL_OFFSET_Z_MS2 -0.036f
#define MPU_CAL_GYRO_OFFSET_X_RAD  -0.061f
#define MPU_CAL_GYRO_OFFSET_Y_RAD   0.011f
#define MPU_CAL_GYRO_OFFSET_Z_RAD  -0.020f

// เกณฑ์การคำนวณการหกล้ม
#define IMU_POSTURE_DELTA_THRESHOLD_DEG 45.0f

// ============================================================================
// [3] สถานะภายในของโมดูล IMU (Module State)
// ============================================================================
class MPU6050RuntimeAddress : public MPU6050
{
public:
  MPU6050RuntimeAddress(uint8_t address = MPU6050_DEFAULT_ADDRESS)
      : MPU6050(address) {}
  void setAddress(uint8_t address) { devAddr = address; }
};

MPU6050RuntimeAddress mpu;
MPU6050Data mpuData;
uint8_t activeMpuAddress = MPU6050_ADDR_AD0_LOW;
uint8_t activeWhoAmI = 0;

// SMA ใช้กรอง SVM ให้เสถียรก่อนเข้า fall state machine
#define SMA_WINDOW_SIZE 10
float svmBuffer[SMA_WINDOW_SIZE] = {0};
int svmIndex = 0;

// ตัวแปรจับเวลาสำหรับ Complementary Filter
unsigned long previousTime = 0;

// ดึงตัวแปรตั้งค่าความไวมาจาก FallDetectionConfig.ino
extern float activeAccelThreshold;
extern unsigned long activeDurationThreshold;
extern float activePostureThreshold;

unsigned long lastMpuConnectionCheck = 0;
unsigned long lastSensorRead = 0;
uint8_t svmAnomalyCount = 0;                           // นับ SVM ผิดปกติต่อเนื่อง
static const uint8_t SVM_ANOMALY_REINIT_THRESHOLD = 3; // ผิดปกติ 3 ครั้งติดกัน → reinit
unsigned long mpuReinitCooldownUntil = 0;              // เวลาสิ้นสุด cooldown หลัง reinit (ms)
unsigned long lastMpuConfigDriftLogTime = 0;
unsigned long lastMpuAbnormalDetailLogTime = 0;

// ค่า raw ล่าสุดจาก I2C — ใช้ในการ log ตรวจสอบ
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

// state machine ของ fall flow ภายในฝั่งอุปกรณ์
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

// snapshot หลักฐานช่วง impact เพื่อใช้เป็น evidence ของ event ที่ตรวจพบ
float pendingFallAccelX = 0;
float pendingFallAccelY = 0;
float pendingFallAccelZ = 0;
float pendingFallGyroX = 0;
float pendingFallGyroY = 0;
float pendingFallGyroZ = 0;
float pendingFallMagnitude = 0;
float pendingPostureDeltaDeg = 0;

// baseline ท่าทางที่ snapshot ตอนเริ่ม impact เพื่อเทียบ posture change ภายหลัง
float impactStartPitchDeg = 0;
float impactStartRollDeg = 0;
float postureDeltaAtDetectionDeg = 0;
bool baselineReset = false;

unsigned long lastImuRawLogTime = 0;

// ============================================================================
// [4] การเชื่อมต่อกับโมดูลอื่น (External Dependencies)
// ============================================================================
void sensorLogf(uint16_t category, const char *fmt, ...);
bool isSensorLogEnabled(uint16_t category);
unsigned long getSensorRawLogIntervalMs();
void publishFallLifecycleEvent(const char *type);
void startPendingFallConfirmation();
void resetFallDetection();
void setLastFallTimestamp(unsigned long timestamp);
bool isAlertSystemReady();
void alertFall();
unsigned long getFallCancelTimeoutMs();
bool consumeCancelButtonConfirmed();
void cancelFallAlert();

// ============================================================================
// [5] Helper Functions ของ IMU config/recovery
// ============================================================================

// รองรับทั้งชิปแท้และ clone ที่ส่ง WHO_AM_I ต่างจากมาตรฐานเล็กน้อย
bool isAcceptedWhoAmI(uint8_t whoAmI)
{
  return whoAmI == MPU6050_WHO_AM_I_6050_LOW ||
         whoAmI == MPU6050_WHO_AM_I_6050_HIGH ||
         whoAmI == MPU6050_WHO_AM_I_ALT_70;
}

// บังคับช่วงการวัดให้ตรงกับค่าที่ algorithm นี้คาดไว้เสมอ
void applyMPU6050MeasurementConfig()
{
  mpu.setFullScaleAccelRange(MPU6050_EXPECTED_ACCEL_RANGE);
  mpu.setFullScaleGyroRange(MPU6050_EXPECTED_GYRO_RANGE);
}

// ใช้ software calibration อย่างเดียว — hardware register offsets เป็นศูนย์เสมอ
// เพื่อตัด source of drift จาก hardware offset ที่ไม่ตรงกับ mounted pose จริง
void applyMPU6050OffsetConfig()
{
  mpu.setXGyroOffset(MPU6050_DEFAULT_GYRO_OFFSET);
  mpu.setYGyroOffset(MPU6050_DEFAULT_GYRO_OFFSET);
  mpu.setZGyroOffset(MPU6050_DEFAULT_GYRO_OFFSET);
  mpu.setXAccelOffset(MPU6050_DEFAULT_ACCEL_OFFSET);
  mpu.setYAccelOffset(MPU6050_DEFAULT_ACCEL_OFFSET);
  mpu.setZAccelOffset(MPU6050_DEFAULT_ACCEL_OFFSET);
}

// ตรวจและกู้ config drift ของ register เมื่อเจอ brownout/voltage sag หรือ state เพี้ยน
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

// getter ค่า software offset ในหน่วย g (accel) และ deg/s (gyro)
float getSoftwareAccelOffsetXG() { return MPU_CAL_ACCEL_OFFSET_X_MS2 / MPU6050_GRAVITY_MS2; }
float getSoftwareAccelOffsetYG() { return MPU_CAL_ACCEL_OFFSET_Y_MS2 / MPU6050_GRAVITY_MS2; }
float getSoftwareAccelOffsetZG() { return MPU_CAL_ACCEL_OFFSET_Z_MS2 / MPU6050_GRAVITY_MS2; }
float getSoftwareGyroOffsetXDps() { return MPU_CAL_GYRO_OFFSET_X_RAD * MPU6050_RAD_TO_DEG; }
float getSoftwareGyroOffsetYDps() { return MPU_CAL_GYRO_OFFSET_Y_RAD * MPU6050_RAD_TO_DEG; }
float getSoftwareGyroOffsetZDps() { return MPU_CAL_GYRO_OFFSET_Z_RAD * MPU6050_RAD_TO_DEG; }

// อ่าน WHO_AM_I ตรงจาก register เพื่อไม่ต้องพึ่ง helper ที่รองรับชิปแท้แคบเกินไป
bool readWhoAmI(uint8_t addr, uint8_t &whoAmI, uint8_t &txErr, uint8_t &rxCount)
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
// [7] การเริ่มต้นเซนเซอร์ IMU (Initialization)
// ============================================================================
bool initMPU6050()
{
  // probe ทั้ง 0x68 และ 0x69 เพื่อรองรับการต่อ AD0 ต่างกันหรือโมดูลคนละล็อต
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
    sensorLogf(SENSOR_LOG_SYSTEM, "MPU6050 identity check failed (checked 0x68/0x69)");
    return false;
  }

  // ตั้งช่วงการวัดและ offsets ให้กลับสู่ค่าที่ firmware คาดไว้ทุกครั้ง
  applyMPU6050MeasurementConfig();
  applyMPU6050OffsetConfig();

  if (!ensureMPU6050RuntimeConfig(false))
  {
    sensorLogf(SENSOR_LOG_SYSTEM, "MPU6050 config verify failed right after init");
    return false;
  }

  sensorLogf(SENSOR_LOG_SYSTEM,
             "MPU config ready (register_offsets=OFF software_offsets=ON accel_range=%u gyro_range=%u)",
             mpu.getFullScaleAccelRange(), mpu.getFullScaleGyroRange());

  // prefill SVM buffer เป็น 1g เพื่อไม่ให้รอบแรก ๆ ของค่าเฉลี่ยเพี้ยนมากเกินไป
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
    Serial.println("  [WHO_AM_I] ตรวจพบ clone chip (WHO_AM_I=0x70)");
    Serial.println("  ชิปนี้ทำงานได้ แต่ควร calibrate offset ใหม่และทดสอบ threshold ซ้ำ");
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
// [8] วงรอบอ่านค่า IMU หลัก (Main Sensor Loop)
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
                 "MPU connection lost/invalid identity (addr=0x%02X tx=%u rx=%u who=0x%02X)",
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

  // อ่าน raw 6 แกนรวดเดียวแล้วค่อยแปลงตาม range register จริงของชิปตอนนั้น
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

  // เก็บ raw ไว้ใช้ใน log ตรวจสอบ
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

  // แปลงค่า raw → หน่วยจริง (ก่อน apply software offset)
  float accelXRawG = ax / accelScaleFactor;
  float accelYRawG = ay / accelScaleFactor;
  float accelZRawG = az / accelScaleFactor;

  float gyroXRawDps = gx / gyroScaleFactor;
  float gyroYRawDps = gy / gyroScaleFactor;
  float gyroZRawDps = gz / gyroScaleFactor;

  // apply software calibration offset ในหน่วยจริงหลังแปลง scale แล้ว
  float accelX = accelXRawG - getSoftwareAccelOffsetXG();
  float accelY = accelYRawG - getSoftwareAccelOffsetYG();
  float accelZ = accelZRawG - getSoftwareAccelOffsetZG();

  float gyroX = gyroXRawDps - getSoftwareGyroOffsetXDps();
  float gyroY = gyroYRawDps - getSoftwareGyroOffsetYDps();
  float gyroZ = gyroZRawDps - getSoftwareGyroOffsetZDps();

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

  // log เมื่อ SVM ห่างจาก 1g ผิดปกติ ใช้ตรวจสอบว่า calibration ถูกต้อง
  bool abnormalSample = fabs(svmFiltered - 1.0f) >= 0.20f;
  if (abnormalSample &&
      millis() - lastMpuAbnormalDetailLogTime >= 400UL)
  {
    lastMpuAbnormalDetailLogTime = millis();
    sensorLogf(
        SENSOR_LOG_SYSTEM,
        "MPU abnormal  rawA=(%d,%d,%d) rawG=(%d,%d,%d)  accel=(%.2f,%.2f,%.2f)g  svm=%.2fg  "
        "fsRange[acc=%u gyr=%u]  swCal[acc=(%.3f,%.3f,%.3f)g  gyr=(%.2f,%.2f,%.2f)dps]",
        ax, ay, az, gx, gy, gz, accelX, accelY, accelZ, svmFiltered,
        accelRange, gyroRange,
        getSoftwareAccelOffsetXG(), getSoftwareAccelOffsetYG(), getSoftwareAccelOffsetZG(),
        getSoftwareGyroOffsetXDps(), getSoftwareGyroOffsetYDps(), getSoftwareGyroOffsetZDps());
  }

  // ── ตัวเฝ้าระวัง SVM ผิดปกติ (SVM Anomaly Watchdog) ─────────────────
  // ช่วง WiFi TX peak → voltage sag → state ของ MPU6050 เพี้ยน
  // ค่า WHO_AM_I ยังผ่าน recheck แต่ range/offset registers รีเซ็ต → SVM อ่าน 2x
  // ต้อง force full reinit และรอ cooldown 500ms ก่อนตัดสินใจ reinit อีก
#if MPU6050_ENABLE_SVM_WATCHDOG
  if (millis() < mpuReinitCooldownUntil)
  {
    // อยู่ใน cooldown หลัง reinit — ข้ามการตรวจ watchdog รอให้ voltage stabilize
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

  // 3) ฟิวชันสัญญาณด้วย Complementary Filter
  unsigned long currentTime = millis();
  float dt = (currentTime - previousTime) / 1000.0f;
  previousTime = currentTime;

  // กันค่า dt กระโดดตอน loop สะดุด/เพิ่งเริ่มรอบ
  if (dt > 0.1f)
    dt = 0.01f;

  // Accelerometer ให้มุมอ้างอิงระยะยาว, Gyro ให้การตอบสนองระยะสั้น
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
// [9] อัลกอริทึมตรวจจับการล้ม (Fall Detection Logic)
// ============================================================================

// snapshot มุม ณ ช่วงเริ่ม impact เพื่อใช้เป็น baseline ของ posture delta รอบนี้
void resetImpactBaseline()
{
  impactStartPitchDeg = mpuData.pitch;
  impactStartRollDeg = mpuData.roll;
  baselineReset = true;
}

// ใช้แกนที่เปลี่ยนมากสุดเป็น posture delta ของรอบนี้
// จับทั้งการคว่ำ/หงายและการเอียงข้างโดยไม่ต้องเดาทิศล้มล่วงหน้า
float calculateOrientationDeltaDeg()
{
  if (!baselineReset)
    return 0.0f;
  float pitchDelta = fabs(mpuData.pitch - impactStartPitchDeg);
  float rollDelta = fabs(mpuData.roll - impactStartRollDeg);
  return pitchDelta > rollDelta ? pitchDelta : rollDelta;
}

// state machine หลักของการตรวจล้มในฝั่งอุปกรณ์
bool detectFall()
{
  if (pendingFallActive)
    return false;
  if (!mpuData.isInitialized)
    return false;

  // ใช้ threshold runtime ปัจจุบัน ถ้าไม่มีให้ fallback ไปค่า default
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
    // ขั้นที่ 1: จับ impact spike จาก SVM ที่ผ่านการกรองแล้ว
    if (mpuData.totalAccel > threshold)
    {
      resetImpactBaseline();
      fallDetectedTime = millis();
      currentFallState = IMPACT_DETECTED;

      // เก็บ snapshot ของช่วง impact ไว้ใช้เป็น evidence ของ event นี้
      pendingFallAccelX = mpuData.accelX;
      pendingFallAccelY = mpuData.accelY;
      pendingFallAccelZ = mpuData.accelZ;
      pendingFallGyroX = mpuData.gyroX;
      pendingFallGyroY = mpuData.gyroY;
      pendingFallGyroZ = mpuData.gyroZ;
      pendingFallMagnitude = mpuData.totalAccel;

      sensorLogf(SENSOR_LOG_FALL_FLOW, "Impact Spike Detected: SVM=%.2f g", mpuData.totalAccel);
    }
    break;

  case IMPACT_DETECTED:
    // ขั้นที่ 2: รอให้ phase ของแรงกระแทกจบก่อนเริ่มจับท่าหลังล้ม
    if (mpuData.totalAccel < 1.2f || (millis() - fallDetectedTime > 1000))
    {
      impactEndTime = millis();
      currentFallState = WAIT_STABILIZE;
      sensorLogf(SENSOR_LOG_FALL_FLOW, "Impact Over. Waiting for stabilization...");
    }
    break;

  case WAIT_STABILIZE:
  {
    // ขั้นที่ 3: รอ stabilization window เพื่อไม่ตัดสิน posture เร็วเกินไป
    unsigned long waitDuration = activeDurationThreshold > 0 ? activeDurationThreshold : FALL_THRESHOLD_DURATION_DEFAULT;
    if (millis() - impactEndTime >= waitDuration)
    {
      currentFallState = POSTURE_CHECK;
    }
  }
  break;

  case POSTURE_CHECK:
  {
    // ขั้นที่ 4: เทียบท่าหลัง impact กับ baseline ก่อน impact
    float orientationDeltaDeg = calculateOrientationDeltaDeg();
    float postureThreshold = activePostureThreshold > 0 ? activePostureThreshold : IMU_POSTURE_DELTA_THRESHOLD_DEG;

    if (orientationDeltaDeg >= postureThreshold)
    {
      // posture change มากพอ → ยอมรับว่าเป็นเหตุการณ์ล้ม
      if (!fallDetected)
      {
        fallDetected = true;
        postureDeltaAtDetectionDeg = orientationDeltaDeg;

        sensorLogf(SENSOR_LOG_FALL_FLOW,
                   "FALL DETECTED (CF): SVM=%.2f pitch=%.1f roll=%.1f post_delta=%.1f(th=%.1f)",
                   mpuData.totalAccel, mpuData.pitch, mpuData.roll,
                   orientationDeltaDeg, postureThreshold);

        currentFallState = IDLE;
        return true;
      }
    }
    else
    {
      // impact ผ่าน แต่ posture ไม่ถึงเกณฑ์ → จัดเป็น recovered movement
      sensorLogf(SENSOR_LOG_FALL_FLOW,
                 "Impact Ignored (Recovered): post_delta=%.1f(th=%.1f)",
                 orientationDeltaDeg, postureThreshold);
      currentFallState = IDLE;
      baselineReset = false;
    }
  }
  break;
  }

  // safety reset กัน state ค้างเมื่อ flow เงียบไปนานเกินไป
  if (!pendingFallActive && fallDetected && (millis() - fallDetectedTime > 5000))
  {
    resetFallDetection();
  }

  return false;
}

// ============================================================================
// [10] ช่วงรอยืนยัน / ยกเลิกหลัง suspected fall (Confirmation Flow)
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

// monitor cancel window ระหว่าง suspected fall
void updatePendingFallConfirmation()
{
  if (!pendingFallActive)
    return;

  // cancel จากปุ่มผู้สวมอุปกรณ์เท่านั้น
  if (consumeCancelButtonConfirmed())
  {
    pendingFallActive = false;
    resetFallDetection();
    sensorLogf(SENSOR_LOG_FALL_FLOW, "Pending fall cancelled by local button");
    return;
  }

  // ครบ cancel timeout แล้วจึงเลื่อน suspected → confirmed
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

// เริ่ม suspected fall flow ทันทีที่ state machine ยืนยันเหตุการณ์ล้ม
void startPendingFallConfirmation()
{
  if (pendingFallActive)
    return;

  pendingFallActive = true;
  pendingFallStartTime = millis();

  // ค่า impact snapshot ถูกเก็บมาตั้งแต่ช่วง detectFall() แล้ว
  pendingPostureDeltaDeg = postureDeltaAtDetectionDeg;

  setLastFallTimestamp(pendingFallStartTime);

  if (isAlertSystemReady())
  {
    alertFall();
  }

  // ส่ง suspected_fall ให้ backend เก็บ lifecycle; UI ผู้ดูแลจะรู้เมื่อ confirm เท่านั้น
  publishFallLifecycleEvent("suspected_fall");
  sensorLogf(SENSOR_LOG_FALL_FLOW, "Pending fall confirmation started");
}

void publishFallEvent() { startPendingFallConfirmation(); }

// ============================================================================
// [11] การส่ง fall lifecycle event ผ่าน MQTT (MQTT Publish)
// ============================================================================
void publishFallLifecycleEvent(const char *type)
{
  if (!mqtt.connected())
    return;

  String topic = "device/" + deviceSerial + "/event";
  JsonDocument doc;
  doc["type"] = type;
  doc["timestamp"] = millis();

  // backend ฝั่งหลักเก็บเฉพาะ evidence ที่ใช้จริงของเหตุการณ์
  doc["magnitude"] = pendingFallMagnitude;
  doc["postureDelta"] = pendingPostureDeltaDeg;

  // ส่ง BPM ณ ขณะตรวจพบการล้มโดยตรง แทนที่จะให้ backend ใช้ cache
  // ถ้า 0 = เซนเซอร์ไม่ได้สัญญาณ backend จะเก็บเป็น bpm = null
  PulseSensorData pulseAtFall = getPulseSensorData();
  doc["bpm"] = pulseAtFall.heartRate;

  char buffer[512];
  serializeJson(doc, buffer);
  mqtt.publish(topic.c_str(), buffer);
}

// ============================================================================
// [12] Hook ที่ SensorManager เรียกใช้ใน loop (Update Hook)
// ============================================================================
void updateMPU6050()
{
  updatePendingFallConfirmation();
  readMPU6050();

  // raw log สำหรับ diagnostic — แสดง calibrated value และ raw ประกอบ
  if (isSensorLogEnabled(SENSOR_LOG_IMU_RAW) && mpuData.isInitialized &&
      millis() - lastImuRawLogTime >= getSensorRawLogIntervalMs())
  {
    lastImuRawLogTime = millis();
    sensorLogf(SENSOR_LOG_IMU_RAW,
               "accel=(%.2f,%.2f,%.2f)g  pitch=%.1f  roll=%.1f  svm=%.2fg  rawA=(%d,%d,%d)",
               mpuData.accelX, mpuData.accelY, mpuData.accelZ,
               mpuData.pitch, mpuData.roll, mpuData.totalAccel,
               lastRawAccelX, lastRawAccelY, lastRawAccelZ);
  }

  // state machine ตรวจล้มได้แล้วค่อยเริ่ม suspected flow
  if (!pendingFallActive && detectFall())
  {
    publishFallEvent();
  }
}

// ============================================================================
// [13] API สาธารณะของโมดูล (Public Module API)
// ============================================================================
MPU6050Data getMPU6050Data() { return mpuData; }
bool isMPU6050Ready() { return mpuData.isInitialized; }
bool isPendingFallActive() { return pendingFallActive; }
