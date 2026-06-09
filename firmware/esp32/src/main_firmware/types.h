/**
 * @file types.h
 * @brief ชนิดข้อมูลกลางของ `main_firmware`
 */

#ifndef TYPES_H
#define TYPES_H

#include <Arduino.h>
#include <MPU6050.h>
#include <PubSubClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>

// shared runtime state ที่ไฟล์ใน main_firmware ใช้ร่วมกัน
extern String deviceSerial;
extern String savedSSID;
extern String savedPassword;
extern String pendingSSID;
extern String pendingPassword;
extern bool hasPendingWiFiConfig;
extern bool bleProvisioning;
extern bool suppressBleAutoRestart;
extern unsigned long bleStartTime;
extern bool shouldConnect;
extern bool isConnecting;
extern int wifiFailCount;
extern unsigned long nextWifiRetryAt;
extern int mqttFailCount;
extern unsigned long nextMqttRetryAt;
extern unsigned long pendingStatusRetryAt;

extern WiFiClient wifiClient;
extern WiFiClientSecure wifiClientSecure;
extern PubSubClient mqtt;

/**
 * หน้าที่หลัก:
 * - รวมชนิดข้อมูลที่หลายโมดูลต้องใช้ร่วมกันไว้ที่จุดเดียว
 * - ทำให้ Prototype firmware อ้าง state และ payload ภายในด้วยชื่อที่สม่ำเสมอ
 * - คง contract ภายในของระบบรวมโดยไม่ต้องประกาศ struct ซ้ำในแต่ละไฟล์
 */

// main_firmware ใช้ runtime logger กลางจากไฟล์หลัก
bool isRuntimeSerialOutputEnabled();

// ============================================================================
// [1] หมวดหมู่ log ของระบบรวม (Shared Logging Categories)
// ============================================================================

// ใช้ bitmask เพื่อให้เปิด/ปิดหลายหมวดพร้อมกันได้โดยไม่ต้องมีตัวแปร boolean แยกทุกหมวด
enum SensorLogCategory : uint16_t
{
  SENSOR_LOG_SYSTEM = 1 << 0,    // ระบบทั่วไป: boot, connect, reconnect
  SENSOR_LOG_IMU_EVENT = 1 << 1, // เหตุการณ์จาก IMU เช่น suspected/confirmed
  SENSOR_LOG_IMU_RAW = 1 << 2,   // ค่าดิบ IMU ใช้เฉพาะตอน diagnostic
  SENSOR_LOG_PPG_EVENT = 1 << 3, // beat/zone/recovery ของ pulse sensor
  SENSOR_LOG_PPG_RAW = 1 << 4,   // raw PPG สำหรับ diagnostic
  SENSOR_LOG_FALL_FLOW = 1 << 5  // ขั้นของ fall pipeline ทั้งเส้น
};

// ============================================================================
// [2] โครงสร้างข้อมูล IMU (MPU6050 Data Structures)
// ============================================================================

struct MPU6050Data
{
  float accelX, accelY, accelZ; // ค่าความเร่งแกน X, Y, Z (รวมแรงโน้มถ่วง)
  float gyroX, gyroY, gyroZ;    // ค่าการหมุน (Gyroscope)
  float totalAccel;             // ผลรวมความเร่งทั้งหมด (Magnitude) ใช้เช็คแรงกระแทก
  float pitch;                  // มุม pitch จาก complementary filter
  float roll;                   // มุม roll จาก complementary filter
  bool isInitialized;
};

// ============================================================================
// [3] โครงสร้างข้อมูลปุ่มยกเลิก false alarm (Cancel Button State)
// ============================================================================

struct FalseAlarmCancelButtonState
{
  bool lastState;
  bool currentState;
  unsigned long lastPressTime;
  unsigned long pressStartTime;
  bool isPressed;
  bool isInitialized;
  unsigned long lastFallTimestamp; // เวลาที่ตรวจพบการล้มครั้งล่าสุด (ใช้คำนวณหมดเวลายกเลิก)
  String activeFallEventId;        // รหัสอ้างอิงเหตุการณ์ล้ม (ใช้ส่งไปบอก Backend ว่ายกเลิกเคสไหน)
};

// ============================================================================
// [4] โครงสร้างข้อมูลเซนเซอร์ชีพจร (Pulse Sensor Data)
// ============================================================================

#define PULSE_BUFFER_SIZE 100

struct PulseSensorData
{
  int rawValue;  // ค่าดิบจาก ADC
  float voltage; // แปลงเป็นแรงดันเพื่อใช้ดูคุณภาพสัญญาณ
  int heartRate; // BPM ล่าสุดที่ผ่านการประมวลผลแล้ว
  String zone;   // low / normal / high / unknown
  bool isInitialized;
  unsigned long lastPeakTime; // เวลา beat ล่าสุด
  int peakCount;              // จำนวน beat ที่รับเข้าแล้ว
  int peakBuffer[PULSE_BUFFER_SIZE];
  int bufferIndex;
  unsigned long lastCalculationTime; // เวลาที่คำนวณ BPM ล่าสุด
};

// ============================================================================
// [5] โครงสร้างข้อมูลระบบเสียงเตือน (Alert System State)
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
