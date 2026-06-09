/**
 * @file FallDetectionConfig.ino
 * @brief ระบบกำหนดค่า threshold สำหรับการตรวจจับการล้มของ sensor_tuning
 *
 * หน้าที่หลัก:
 * - รวม baseline threshold ของรอบจูนไว้จุดเดียว
 * - แปลง sensitivity level ให้กลายเป็น active threshold ที่โมดูล MPU ใช้งานจริง
 * - เปิดช่องให้ตั้งค่า custom threshold แบบละเอียดหลังวิเคราะห์ผลรอบทดสอบ
 *
 * ข้อจำกัด:
 * - ไฟล์นี้ไม่ตัดสินผลการล้มเอง แต่เป็นแหล่งค่าที่ state machine ใน MPU ใช้อ้างอิง
 * - ถ้าจะจูน ต้องปรับทีละค่าและเก็บหลักฐานรอบใหม่เสมอ
 */

#include "types.h"

// ============================================================================
// [1] Baseline Threshold จากงานอ้างอิง (Reference Baseline)
// ============================================================================

// Acceleration threshold (หน่วย g)
// ใช้เป็น gate แรกของการตรวจ impact
#define IMU_BASELINE_ACCEL_THRESHOLD_MIN 1.6f // ค่าต่ำสุด (ไวมาก)
#define IMU_BASELINE_ACCEL_THRESHOLD_DEFAULT 2.0f // ค่ามาตรฐาน (สมดุล)
#define IMU_BASELINE_ACCEL_THRESHOLD_MAX 2.8f // ค่าสูงสุด (ไวน้อย)

// Duration threshold (หน่วย ms)
// ใช้รอให้ช่วง impact สงบก่อนเข้าสู่การเช็กท่าทาง
#define IMU_BASELINE_DURATION_MIN 1000 // สั้นสุด (ไว)
#define IMU_BASELINE_DURATION_DEFAULT 1500 // มาตรฐาน (สมดุล)
#define IMU_BASELINE_DURATION_MAX 2000 // นานสุด (เสถียร)

// ============================================================================
// [2] แนวคิดของอัลกอริทึมที่ threshold ชุดนี้รองรับ
// ============================================================================

// ในเวอร์ชันนี้ เซนเซอร์ MPU6050 ถูกประมวลผลผ่านอัลกอริทึม Raw 6-Axis
// เพื่อหาแรงกระแทก (SVM) และใช้วงจร Complementary Filter เพื่อคำนวณ
// ค่า Pitch และ Roll แทน DMP เพื่อแก้ไขปัญหาความต้านทานแรงกระแทก
//
// การใช้ความเร็วหมุน (Gyro rate) ตรงๆ เกิด false alarm risk ง่าย (เช่น สะบัดคอ)
// เราจึงใช้ Posture Delta (การเปลี่ยนแปลงองศารวมใน 3 มิติหลังจบการเคลื่อนไหว)
// มายืนยันการล้มแทน ซึ่งเสถียรและสะท้อนพฤติกรรม "เสียสมดุลจนล้มตัวลง" ได้ดีกว่า
//
// อ่านเพิ่มเติมที่: docs/tech/fall-detection-system.md
// ============================================================================

// Posture threshold (หน่วยองศา)
// ใช้ยืนยันว่าหลัง impact ท่าทางเปลี่ยนไปมากพอจนเข้าข่ายล้มจริง
#define IMU_BASELINE_POSTURE_THRESHOLD_MIN 35.0f     // เปลี่ยนน้อยก็จับ (ไว)
#define IMU_BASELINE_POSTURE_THRESHOLD_DEFAULT 45.0f // มาตรฐาน
#define IMU_BASELINE_POSTURE_THRESHOLD_MAX 60.0f     // ต้องเปลี่ยนเยอะถึงจับ (ยาก)

// ชุดค่านี้เก็บไว้เป็น baseline สำหรับงานวิจัย/เอกสาร แม้รอบนี้ logic หลักยังไม่ได้ใช้ตรง ๆ
#define IMU_BASELINE_POST_FALL_WINDOW 2000         // ดูข้อมูลอีก 2 วินาทีหลังล้ม
#define IMU_BASELINE_POST_FALL_ACCEL_THRESHOLD 0.5 // แรง G ต่ำมากหลังล้ม (นอนราบ)

// ระดับ sensitivity ที่ใช้เลือก threshold แบบเป็น preset
#define SENSITIVITY_LOW 0
#define SENSITIVITY_MEDIUM 1
#define SENSITIVITY_HIGH 2

// ============================================================================
// [3] สถานะการตั้งค่าปัจจุบัน (Current Active Configuration)
// ============================================================================

// ค่าพวกนี้จะเปลี่ยนไปตาม sensitivity ที่เลือก
int currentSensitivity = SENSITIVITY_MEDIUM;

// Active threshold คือค่าที่ MPU6050_Sensor.ino ใช้จริงใน runtime
float activeAccelThreshold = IMU_BASELINE_ACCEL_THRESHOLD_DEFAULT;
unsigned long activeDurationThreshold = IMU_BASELINE_DURATION_DEFAULT;
float activePostureThreshold = IMU_BASELINE_POSTURE_THRESHOLD_DEFAULT;

void sensorLogf(uint16_t category, const char *fmt, ...);

// ============================================================================
// [4] ฟังก์ชันกำหนดค่า (Configuration API)
// ============================================================================

/**
 * ตั้งค่าความไวของการตรวจจับการล้มผ่าน preset
 *
 * การเปลี่ยน sensitivity คือการขยับ threshold ทั้งชุดพร้อมกัน
 * จึงเหมาะกับการปรับแบบกว้างก่อนเข้า fine-tune ทีละค่า
 *
 * @param sensitivity 0=LOW, 1=MEDIUM, 2=HIGH
 */
void setFallDetectionSensitivity(int sensitivity)
{
  currentSensitivity = sensitivity;

  switch (sensitivity)
  {
  case SENSITIVITY_LOW:
    // LOW = ลด false alarm risk โดยบังคับให้ผ่าน gate ยากขึ้นทุกมิติ
    activeAccelThreshold = IMU_BASELINE_ACCEL_THRESHOLD_MAX;
    activeDurationThreshold = IMU_BASELINE_DURATION_MAX;
    activePostureThreshold = IMU_BASELINE_POSTURE_THRESHOLD_MAX;
    sensorLogf(SENSOR_LOG_SYSTEM,
               "Fall detection sensitivity: LOW (ลด False Positive - เน้นชัวร์)");
    break;

  case SENSITIVITY_MEDIUM:
    // MEDIUM = baseline กลาง ใช้เป็นจุดเริ่มต้นของการทดสอบส่วนใหญ่
    activeAccelThreshold = IMU_BASELINE_ACCEL_THRESHOLD_DEFAULT;
    activeDurationThreshold = IMU_BASELINE_DURATION_DEFAULT;
    activePostureThreshold = IMU_BASELINE_POSTURE_THRESHOLD_DEFAULT;
    sensorLogf(SENSOR_LOG_SYSTEM, "Fall detection sensitivity: MEDIUM (สมดุล)");
    break;

  case SENSITIVITY_HIGH:
    // HIGH = เน้นไม่พลาดเหตุการณ์จริง แต่ต้องระวัง normal activity trigger มากขึ้น
    activeAccelThreshold = IMU_BASELINE_ACCEL_THRESHOLD_MIN;
    activeDurationThreshold = IMU_BASELINE_DURATION_MIN;
    activePostureThreshold = IMU_BASELINE_POSTURE_THRESHOLD_MIN;
    sensorLogf(SENSOR_LOG_SYSTEM,
               "Fall detection sensitivity: HIGH (ไวมาก - ระวังลั่นเอง)");
    break;

  default:
    currentSensitivity = SENSITIVITY_MEDIUM;
    activeAccelThreshold = IMU_BASELINE_ACCEL_THRESHOLD_DEFAULT;
    activeDurationThreshold = IMU_BASELINE_DURATION_DEFAULT;
    activePostureThreshold = IMU_BASELINE_POSTURE_THRESHOLD_DEFAULT;
    break;
  }

  sensorLogf(SENSOR_LOG_SYSTEM,
             "Thresholds: accel=%.2fg duration=%lums posture=%.0fdeg",
             activeAccelThreshold, activeDurationThreshold,
             activePostureThreshold);
}

/**
 * ตั้งค่า Threshold เองแบบละเอียด (Custom)
 * (ใช้สำหรับจูนละเอียดหลังจากการเทสแล้ว)
 * @param accelThreshold แรง G (g)
 * @param durationThreshold เวลา (ms)
 * @param postureThreshold การเปลี่ยนองศา (deg)
 */
void setCustomFallThresholds(float accelThreshold, unsigned long durationThreshold,
                             float postureThreshold)
{
  activeAccelThreshold = accelThreshold;
  activeDurationThreshold = durationThreshold;
  activePostureThreshold = postureThreshold;

  sensorLogf(
      SENSOR_LOG_SYSTEM,
      "Custom thresholds set: accel=%.2fg duration=%lums posture=%.0fdeg",
      activeAccelThreshold, activeDurationThreshold, activePostureThreshold);
}

/**
 * ดึงค่าความไวปัจจุบัน
 */
int getFallDetectionSensitivity() { return currentSensitivity; }

/**
 * ดึงค่า Accel Threshold ปัจจุบัน
 */
float getAccelThreshold() { return activeAccelThreshold; }

/**
 * ดึงค่า Duration Threshold ปัจจุบัน
 */
unsigned long getDurationThreshold() { return activeDurationThreshold; }

/**
 * ดึงค่า Posture Threshold ปัจจุบัน
 */
float getPostureThreshold() { return activePostureThreshold; }

/**
 * เริ่มต้นค่า Fall Detection
 */
void initFallDetectionConfig()
{
  // ตั้งค่าเริ่มต้นเป็น baseline กลาง เพื่อให้รอบแรกเริ่มจากค่าที่สมดุลก่อน
  setFallDetectionSensitivity(SENSITIVITY_MEDIUM);

  sensorLogf(SENSOR_LOG_SYSTEM, "FallDetectionConfig initialized");
  sensorLogf(SENSOR_LOG_SYSTEM,
             "Research baseline: 2.3g @ 150ms, posture delta 35deg");
}
