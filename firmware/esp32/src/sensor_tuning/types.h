#ifndef TYPES_H
#define TYPES_H

/**
 * @file types.h
 * @brief โครงสร้างข้อมูลและ enum กลางของ firmware `sensor_tuning`
 *
 * หน้าที่หลัก:
 * - รวม data structures ที่แต่ละโมดูลใช้ร่วมกันไว้จุดเดียว
 * - ทำให้ไฟล์ `.ino` หลายตัวอ้างชนิดข้อมูลเดียวกันได้โดยไม่ต้องประกาศซ้ำ
 * - คงชื่อ field ให้ตรงกับความหมายของ sensor/runtime state ที่ใช้จริงในรอบจูน
 */

#include <Arduino.h>
#include <MPU6050.h>

// ============================================================================
// [1] หมวดหมู่ log กลางของระบบจูน (Shared Log Categories)
// ============================================================================

enum SensorLogCategory : uint16_t
{
  SENSOR_LOG_SYSTEM = 1 << 0,
  SENSOR_LOG_IMU_EVENT = 1 << 1,
  SENSOR_LOG_IMU_RAW = 1 << 2,
  SENSOR_LOG_PPG_EVENT = 1 << 3,
  SENSOR_LOG_PPG_RAW = 1 << 4,
  SENSOR_LOG_FALL_FLOW = 1 << 5
};

// ============================================================================
// [2] ตัวช่วยห่อ MPU6050 ที่สลับ I2C address ได้ runtime (MPU Wrapper)
// ============================================================================

/**
 * ห่อคลาส `MPU6050` เดิมเพื่อเปิดช่องให้ sensor_tuning เปลี่ยน address ระหว่างรันได้
 *
 * ใช้ในโหมดจูนเพื่อรองรับบอร์ดหรือ wiring ที่สลับ address ของโมดูล IMU
 * โดยไม่ต้อง fork library ภายนอก
 */
class MPU6050RuntimeAddress : public MPU6050
{
public:
  MPU6050RuntimeAddress(uint8_t address = MPU6050_DEFAULT_ADDRESS)
      : MPU6050(address) {}

  void setAddress(uint8_t address) { devAddr = address; }
};

// ============================================================================
// [3] โครงสร้างข้อมูลของ MPU6050 (IMU Data Structures)
// ============================================================================

struct MPU6050Data
{
  float accelX, accelY, accelZ; // ค่า accelerometer (g)
  float gyroX, gyroY, gyroZ;    // ค่า gyroscope (deg/s)
  float totalAccel;             // ขนาดความเร่งรวม (SVM)
  float pitch;                  // มุม pitch จาก complementary filter
  float roll;                   // มุม roll จาก complementary filter
  bool isInitialized;
};

// ============================================================================
// [4] สถานะปุ่มยกเลิก false alarm (Cancel Button State)
// ============================================================================

struct FalseAlarmCancelButtonState
{
  bool lastState;
  bool currentState;
  unsigned long lastPressTime;
  unsigned long pressStartTime;
  bool isPressed;
  bool isInitialized;
  unsigned long lastFallTimestamp; // ใช้เช็กว่าอยู่ใน cancel window หรือไม่
  String activeFallEventId;        // ID ของ fall flow ที่กำลังเปิดอยู่
};

// ============================================================================
// [5] โครงสร้างข้อมูลของ Pulse Sensor (Pulse Data Structures)
// ============================================================================

#define PULSE_BUFFER_SIZE 100

struct PulseSensorData
{
  int rawValue;  // ค่า ADC ดิบ (0-1023)
  float voltage; // แรงดันที่คำนวณจากค่า ADC
  int heartRate; // BPM ล่าสุดที่ผ่านทุก gate
  String zone;   // "low", "normal", "high", "unknown"
  bool isInitialized;
  unsigned long lastPeakTime;
  int peakCount;
  int peakBuffer[PULSE_BUFFER_SIZE];
  int bufferIndex;
  unsigned long lastCalculationTime;
};

// ============================================================================
// [6] สถานะของ Alert System (Alert State)
// ============================================================================

struct AlertSystemState
{
  bool isPlaying;
  unsigned long alertStartTime;
  unsigned long alertDuration;
  int currentPattern;
  int patternCount;
  bool isInitialized;
};

#endif
