#ifndef FALLHELP_BUILD_PROFILE_H
#define FALLHELP_BUILD_PROFILE_H

/**
 * @file build_profile.h
 * @brief จุดเลือก build mode ของ `sensor_tuning`
 *
 * หน้าที่หลัก:
 * - เลือกว่า firmware รอบนี้จูน MPU6050 หรือ Pulse Sensor
 * - กำหนดชุดโมดูลที่ต้องเปิด/ปิดตั้งแต่ compile time
 * - ระบุค่า default ที่ต้องนิ่งและคาดเดาได้ทุกครั้งหลังบูต
 */

// ============================================================================
// [1] ทางเลือกของ build mode (Build Mode Selection)
// ============================================================================

#define FALLHELP_SINGLE_SENSOR_NONE 0
#define FALLHELP_SINGLE_SENSOR_MPU6050 1
#define FALLHELP_SINGLE_SENSOR_PULSE 2
#define FALLHELP_SENSOR_COMBINED 3  // เปิดทั้งคู่: เก็บ fall + pulse พร้อมกัน (ไม่ใช่รอบจูน threshold)

#ifndef FALLHELP_SINGLE_SENSOR
// ค่าเริ่มต้นรอบนี้: จูน MPU6050 เพื่อหา threshold การล้ม
#define FALLHELP_SINGLE_SENSOR FALLHELP_SINGLE_SENSOR_MPU6050
#endif

// ============================================================================
// [2] การเปิด/ปิดโมดูลตาม build mode (Feature Gates)
// ============================================================================

#define ENABLE_SENSORS 1

#if FALLHELP_SINGLE_SENSOR == FALLHELP_SINGLE_SENSOR_MPU6050
// รอบจูน MPU6050: เปิด IMU, ปิด Pulse, เปิด MQTT เพื่อส่ง log เข้า Node-RED
#define ENABLE_MPU6050_SENSOR 1
#define ENABLE_PULSE_SENSOR 0
#define ENABLE_MQTT_RUNTIME 1
#elif FALLHELP_SINGLE_SENSOR == FALLHELP_SINGLE_SENSOR_PULSE
// รอบจูน Pulse: เปิด Pulse, ปิด IMU, เปิด MQTT เพื่อเก็บ CSV ผ่าน Node-RED
#define ENABLE_MPU6050_SENSOR 0
#define ENABLE_PULSE_SENSOR 1
#define ENABLE_MQTT_RUNTIME 1
#elif FALLHELP_SINGLE_SENSOR == FALLHELP_SENSOR_COMBINED
// รอบเก็บข้อมูลรวม: เปิดทั้ง IMU และ Pulse พร้อมกัน
// ใช้หลังจูน threshold แต่ละตัวเสร็จแล้ว เพื่อเก็บ fall event + HR ในเซสชันเดียว
// Node-RED บันทึกแยก 2 CSV: falls CSV และ pulse CSV → correlate ด้วย Timestamp_ms
#define ENABLE_MPU6050_SENSOR 1
#define ENABLE_PULSE_SENSOR 1
#define ENABLE_MQTT_RUNTIME 1
#else
// โหมดปิดเซนเซอร์ ใช้ตอนต้องการบูตขึ้นมาทดสอบสภาพระบบขั้นต่ำ
#define ENABLE_MPU6050_SENSOR 0
#define ENABLE_PULSE_SENSOR 0
#define ENABLE_MQTT_RUNTIME 0
#endif

// ============================================================================
// [3] ค่า default ของ firmware รอบจูน (Deterministic Boot Defaults)
// ============================================================================

// runtime profile คงที่เพื่อลดความซับซ้อนของรอบจูน
#define FALLHELP_RUNTIME_PROFILE 1

// boot แบบ quiet เสมอ และให้ Node-RED / command channel เป็นตัว arm raw log
#define FALLHELP_SENSOR_LOG_PROFILE_DEFAULT 1
#define FALLHELP_SENSOR_RAW_ENABLED_DEFAULT 0

// การจูนแบบ hardware-only ยังเปิด speaker เพื่อฟัง alert ระหว่างซิมูเลชันได้
#define FALLHELP_SPEAKER_OUTPUT_ENABLED_DEFAULT 1

#endif
