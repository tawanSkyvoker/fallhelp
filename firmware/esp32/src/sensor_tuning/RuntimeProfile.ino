/**
 * @file RuntimeProfile.ino
 * @brief โปรไฟล์ runtime แบบคงที่สำหรับ firmware จูนเซนเซอร์
 *
 * จุดตั้งค่าหลัก:
 * - ล็อก profile เป็น STANDARD
 * - timeout ยกเลิกการหกล้มคงที่ที่ 15000 ms
 * - ไม่มีคำสั่งสลับ profile ใน firmware ชุดนี้
 */

// ============================================================================
// [1] ค่าคงที่ของ runtime profile (Runtime Constants)
// ============================================================================

#define FALLHELP_RUNTIME_PROFILE_STANDARD 1
#define FALLHELP_CANCEL_TIMEOUT_MS 15000UL
#define FALLHELP_WIFI_PROVISION_ATTEMPTS 16

#ifndef FALLHELP_RUNTIME_PROFILE
#define FALLHELP_RUNTIME_PROFILE FALLHELP_RUNTIME_PROFILE_STANDARD
#endif

// ============================================================================
// [2] สถานะ runtime ของ firmware จูน (Runtime State)
// ============================================================================

#include "build_profile.h"

uint8_t runtimeProfileMode = FALLHELP_RUNTIME_PROFILE;

/**
 * ตั้งค่า runtime profile เริ่มต้นของ firmware จูน
 *
 * sensor_tuning รอบนี้ล็อก profile ไว้ตายตัว จึงไม่ต้องอ่านค่าจาก NVS
 * ชื่อฟังก์ชันจงใจสื่อให้ตรงกับพฤติกรรมจริงของโมดูลนี้
 */
void initRuntimeProfileDefaults()
{
  runtimeProfileMode = FALLHELP_RUNTIME_PROFILE_STANDARD;
}

/**
 * คืนค่า timeout ของ cancel window สำหรับ suspected fall
 */
unsigned long getFallCancelTimeoutMs()
{
  (void)runtimeProfileMode;
  return FALLHELP_CANCEL_TIMEOUT_MS;
}

/**
 * คืนจำนวนครั้งสูงสุดที่อนุญาตให้ลองต่อ WiFi ใหม่
 */
int getWiFiProvisioningMaxAttempts()
{
  (void)runtimeProfileMode;
  return FALLHELP_WIFI_PROVISION_ATTEMPTS;
}

/**
 * คืนชื่อ runtime profile ที่แสดงบน Serial
 */
const char *getFallRuntimeProfileName()
{
  return "STANDARD";
}
