/**
 * @file FallDetectionConfig.ino
 * @brief FallDetectionConfig: จุดรวม threshold และ sensitivity ของ fall detection ใน Prototype firmware
 *
 * หน้าที่หลัก:
 * - เก็บค่า threshold หลักของ impact / stabilize duration / posture delta
 * - เก็บ cancel window ของ fall lifecycle ที่ใช้ร่วมกับปุ่ม GPIO27
 * - map sensitivity level ให้เป็นชุด threshold ที่ระบบใช้จริง
 * - persist ค่าปัจจุบันลง NVS เพื่อให้เครื่องบูตกลับมาด้วย behavior เดิม
 *
 * หมายเหตุ:
 * - ค่าชุดนี้ยังเป็นของ Prototype firmware ปัจจุบัน
 * - เมื่อ `sensor_tuning` สรุปค่าชุดใหม่แล้ว ค่อยอัปเดตรอบถัดไปแบบตั้งใจ
 */

#include "types.h"
#include <Preferences.h>

extern Preferences preferences;

// ============================================================================
// [1] ระดับความไวของระบบ (Sensitivity Levels)
// ============================================================================

#define FALLHELP_SENSITIVITY_LOW 0
#define FALLHELP_SENSITIVITY_MEDIUM 1
#define FALLHELP_SENSITIVITY_HIGH 2

// ============================================================================
// [2] ชุด threshold ของแต่ละโหมด (Threshold Presets)
// ============================================================================

#define IMU_BASELINE_ACCEL_THRESHOLD_DEFAULT 2.0f
#define IMU_BASELINE_DURATION_DEFAULT 1500
#define IMU_BASELINE_POSTURE_DELTA_DEFAULT 45.0f

#define IMU_LOW_ACCEL_THRESHOLD 2.8f
#define IMU_LOW_DURATION_THRESHOLD 2000
#define IMU_LOW_POSTURE_DELTA 60.0f

#define IMU_MED_ACCEL_THRESHOLD 2.0f
#define IMU_MED_DURATION_THRESHOLD 1500
#define IMU_MED_POSTURE_DELTA 45.0f

#define IMU_HIGH_ACCEL_THRESHOLD 1.6f
#define IMU_HIGH_DURATION_THRESHOLD 1000
#define IMU_HIGH_POSTURE_DELTA 35.0f

// cancel window เป็นกติกาของ fall lifecycle ไม่ใช่ config runtime แยก
#define FALLHELP_FALL_CANCEL_TIMEOUT_MS 15000UL

// ============================================================================
// [3] คีย์ NVS ของ fall detection config (NVS Keys)
// ============================================================================

#define FALLHELP_SENSITIVITY_KEY "fall_sens"
#define FALLHELP_ACCEL_TH_KEY "fall_accel"
#define FALLHELP_DUR_TH_KEY "fall_dur"
#define FALLHELP_POSTURE_TH_KEY "fall_post"

// ============================================================================
// [4] สถานะ threshold ที่ระบบใช้งานอยู่จริง (Active Runtime Values)
// ============================================================================

int currentSensitivity = FALLHELP_SENSITIVITY_MEDIUM;
float activeAccelThreshold = IMU_BASELINE_ACCEL_THRESHOLD_DEFAULT;
unsigned long activeDurationThreshold = IMU_BASELINE_DURATION_DEFAULT;
float activePostureThreshold = IMU_BASELINE_POSTURE_DELTA_DEFAULT;

// ============================================================================
// [5] Initialization และการเลือก sensitivity (Initialization & Presets)
// ============================================================================

void initFallDetectionConfig() {
  sensorLogf(SENSOR_LOG_SYSTEM, "FallDetectionConfig initialized");

  int savedSensitivity = preferences.getInt(FALLHELP_SENSITIVITY_KEY, FALLHELP_SENSITIVITY_MEDIUM);

  if (savedSensitivity < FALLHELP_SENSITIVITY_LOW || savedSensitivity > FALLHELP_SENSITIVITY_HIGH) {
    savedSensitivity = FALLHELP_SENSITIVITY_MEDIUM;
  }

  setFallDetectionSensitivity(savedSensitivity);

  sensorLogf(SENSOR_LOG_SYSTEM, "Runtime baseline: accel=%.2fg duration=%lums posture=%.0fdeg",
             activeAccelThreshold, activeDurationThreshold, activePostureThreshold);
}

// เลือกหนึ่ง preset จาก sensitivity level แล้ว sync ลง NVS เฉพาะเมื่อค่าเปลี่ยน
void setFallDetectionSensitivity(int sensitivity) {
  bool changed = (sensitivity != currentSensitivity);
  currentSensitivity = sensitivity;
  if (changed) preferences.putInt(FALLHELP_SENSITIVITY_KEY, currentSensitivity);

  const char *sensName = "UNKNOWN";

  switch (sensitivity) {
  case FALLHELP_SENSITIVITY_LOW:
    activeAccelThreshold = IMU_LOW_ACCEL_THRESHOLD;
    activeDurationThreshold = IMU_LOW_DURATION_THRESHOLD;
    activePostureThreshold = IMU_LOW_POSTURE_DELTA;
    sensName = "LOW (ยาก)";
    break;

  case FALLHELP_SENSITIVITY_HIGH:
    activeAccelThreshold = IMU_HIGH_ACCEL_THRESHOLD;
    activeDurationThreshold = IMU_HIGH_DURATION_THRESHOLD;
    activePostureThreshold = IMU_HIGH_POSTURE_DELTA;
    sensName = "HIGH (ง่าย)";
    break;

  case FALLHELP_SENSITIVITY_MEDIUM:
  default:
    activeAccelThreshold = IMU_MED_ACCEL_THRESHOLD;
    activeDurationThreshold = IMU_MED_DURATION_THRESHOLD;
    activePostureThreshold = IMU_MED_POSTURE_DELTA;
    sensName = "MEDIUM (สมดุล)";
    break;
  }

  if (changed) {
    preferences.putFloat(FALLHELP_ACCEL_TH_KEY, activeAccelThreshold);
    preferences.putULong(FALLHELP_DUR_TH_KEY, activeDurationThreshold);
    preferences.putFloat(FALLHELP_POSTURE_TH_KEY, activePostureThreshold);
  }

  sensorLogf(SENSOR_LOG_SYSTEM, "Fall detection sensitivity: %s", sensName);
  sensorLogf(SENSOR_LOG_SYSTEM, "Thresholds: accel=%.2fg duration=%lums posture=%.0fdeg",
             activeAccelThreshold, activeDurationThreshold, activePostureThreshold);
}

// ============================================================================
// [6] Custom Threshold Override
// ============================================================================

void setCustomFallThresholds(float accelThreshold, unsigned long durationThreshold, float postureThreshold) {
  currentSensitivity = -1;
  preferences.putInt(FALLHELP_SENSITIVITY_KEY, currentSensitivity);

  activeAccelThreshold = accelThreshold;
  activeDurationThreshold = durationThreshold;
  activePostureThreshold = postureThreshold;

  preferences.putFloat(FALLHELP_ACCEL_TH_KEY, activeAccelThreshold);
  preferences.putULong(FALLHELP_DUR_TH_KEY, activeDurationThreshold);
  preferences.putFloat(FALLHELP_POSTURE_TH_KEY, activePostureThreshold);

  sensorLogf(SENSOR_LOG_SYSTEM, "Custom fall thresholds applied");
  sensorLogf(SENSOR_LOG_SYSTEM, "Thresholds: accel=%.2fg duration=%lums posture=%.0fdeg",
             activeAccelThreshold, activeDurationThreshold, activePostureThreshold);
}

// ============================================================================
// [7] Shared Getters
// ============================================================================

int getFallDetectionSensitivity() { return currentSensitivity; }

float getAccelThreshold() { return activeAccelThreshold; }

unsigned long getDurationThreshold() { return activeDurationThreshold; }

float getPostureThreshold() { return activePostureThreshold; }

unsigned long getFallCancelTimeoutMs() { return FALLHELP_FALL_CANCEL_TIMEOUT_MS; }
