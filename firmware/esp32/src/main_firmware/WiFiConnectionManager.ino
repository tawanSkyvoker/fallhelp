/**
 * @file WiFiConnectionManager.ino
 * @brief WiFiConnectionManager: ควบคุมสถานะและจัดการการเชื่อมต่อเครือข่าย WiFi ของอุปกรณ์ FallHelp
 *
 * หน้าที่หลัก:
 * - จัดการการเชื่อมต่อ WiFi ในโหมด Station (STA) และขั้นตอนการเชื่อมโยงเครือข่าย (radio handoff)
 * - บันทึกและโหลดข้อมูลการตั้งค่า WiFi (credentials) ทั้งแบบถาวรและแบบชั่วคราว (pending config) ในหน่วยความจำ NVS
 * - จัดการการสลับระหว่างโหมด BLE provisioning และโหมดเชื่อมต่อ WiFi (radio coexistence)
 * - ตรวจสอบความถูกต้องของการเชื่อมต่อแบบ commit-after-success และการ rollback ค่าเก่าหากเชื่อมต่อไม่สำเร็จ
 */

#include "types.h"
#include <BLEDevice.h>
#include <WiFi.h>

// ============================================================================
// [1] WiFiConnectionManager: การเชื่อมต่อ WiFi และ Config
// ============================================================================

#define WIFI_PROVISIONING_MAX_ATTEMPTS 40
// 40 x 500ms = 20 วินาที ช่วยรองรับ router ที่แจก DHCP ช้ากว่าปกติ

void connectToWiFi()
{
  isConnecting = true;

  // รีเซ็ต BLE status ก่อนเริ่ม provision รอบใหม่เพื่อกัน mobile อ่านสถานะค้าง
  updateBLEStatus(0x00);
  delay(100);

  updateBLEStatus(0x01);

  // รอให้ notify CONNECTING ไปถึง mobile ก่อนค่อย handoff ไป WiFi
  delay(1500);

  // BLE กับ WiFi ใช้ radio เดียวกัน ต้องหยุด advertising ก่อนเริ่ม auth handshake เสมอ
  if (bleProvisioning)
  {
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("📡 หยุด BLE advertising ก่อนเชื่อม WiFi (radio coexistence)...");
    BLEDevice::stopAdvertising();
    bleProvisioning = false;
    delay(300); // รอให้ radio handoff เสร็จ
  }

  // ลำดับ reset radio ถูกจัดให้ conservative เพื่อเลี่ยง failed connect จาก coexistence state
  WiFi.mode(WIFI_STA);
  delay(300);

  WiFi.persistent(false);      // ไม่เขียน WiFi config ลง NVS อัตโนมัติ
  WiFi.disconnect(true, true); // eraseap=true, wifioff=true
  delay(800);                  // รอให้ radio reset เสร็จสมบูรณ์

  WiFi.setAutoReconnect(true); // เปิดใหม่ก่อน connect — BLE หยุดแล้ว radio ว่างให้ WiFi ใช้เต็ม
  WiFi.setTxPower(WIFI_POWER_11dBm); // ลด current spike เพื่อลดผลข้างเคียงกับ IMU
  WiFi.setSleep(false);              // ลด radio state transition ระหว่าง sensor ทำงาน
  WiFi.begin(savedSSID.c_str(), savedPassword.c_str());
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintf("📶 Connecting to '%s'", savedSSID.c_str());
  // ใช้เวลาไม่เกิน 20 วินาทีในการรอเชื่อมต่อ เพื่อรองรับ router ที่แจก DHCP ช้า
  int maxAttempts = max(WIFI_PROVISIONING_MAX_ATTEMPTS, 20);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts)
  {
    delay(500);
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrint(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    if (isRuntimeSerialOutputEnabled())
    {
      runtimeLogPrintln(" Connected!");
      runtimeLogPrintf("IP: %s\n", WiFi.localIP().toString().c_str());
    }
    updateBLEStatus(0x02);
    wifiFailCount = 0;
    saveWiFiConfig(savedSSID, savedPassword);

    // ส่ง CONNECTED ซ้ำเล็กน้อยก่อน deinit เพื่อลดโอกาส packet loss ที่ฝั่งมือถือพลาด state สุดท้าย
    for (int i = 0; i < 2; i++)
    {
      delay(300);
      updateBLEStatus(0x02);
    }
    delay(300); // รอให้ notify สุดท้ายถึง mobile
    // ปิด BLE หลังส่ง CONNECTED ซ้ำ เพื่อคืน heap และ radio ให้ WiFi/MQTT runtime
    suppressBleAutoRestart = true;
    stopBLEAdvertising();
    BLEDevice::deinit(true);
    suppressBleAutoRestart = false;

    setupMQTT();
    reconnectMQTT(); // เชื่อมต่อ MQTT ทันที ไม่ต้องรอ loop() รอบถัดไป
    isConnecting = false;
  }
  else
  {
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln(" Failed!");
    updateBLEStatus(0x03);

    // ล้าง credentials และเปิด BLE ใหม่ให้ผู้ใช้ลองอีกครั้ง
    savedSSID = "";
    savedPassword = "";
    isConnecting = false;

    delay(500); // รอให้แอปมือถืออ่านสถานะ FAILED ก่อน

    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("📡 ล้าง session แล้วเริ่ม BLE ใหม่หลัง WiFi ล้มเหลว...");
    resetBLESession();
  }
}

void startStationMode()
{
  // ถ้ามี pending config ให้ลองก่อน — ยังไม่ commit จน connect สำเร็จ
  String trySSID     = hasPendingWiFiConfig ? pendingSSID     : savedSSID;
  String tryPassword = hasPendingWiFiConfig ? pendingPassword : savedPassword;

  WiFi.persistent(false);      // ไม่เขียน WiFi config ลง internal flash อัตโนมัติ
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true); // boot path: ไม่มี BLE แย่งแล้ว ให้ AutoReconnect ทำงานได้เต็มที่
  WiFi.setTxPower(WIFI_POWER_11dBm); // ลด TX power เพื่อลด current spike → กัน voltage sag บน MPU6050
  WiFi.setSleep(false);              // ปิด modem sleep เพื่อลด radio state transition ระหว่างใช้ MPU6050
  WiFi.begin(trySSID.c_str(), tryPassword.c_str());

  if (isRuntimeSerialOutputEnabled())
  {
    if (hasPendingWiFiConfig)
      runtimeLogPrintf("📶 ทดสอบ WiFi ใหม่ (pending): '%s'", trySSID.c_str());
    else
      runtimeLogPrintf("📶 Connecting to '%s'", trySSID.c_str());
  }
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < WIFI_BOOT_CONNECT_MAX_ATTEMPTS)
  {
    delay(500);
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrint(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    if (isRuntimeSerialOutputEnabled())
    {
      runtimeLogPrintln(" Connected!");
      runtimeLogPrintf("IP: %s\n", WiFi.localIP().toString().c_str());
    }
    wifiFailCount = 0;

    if (hasPendingWiFiConfig)
    {
      // commit: pending กลายเป็น credential ถาวร ล้าง pending slot
      commitPendingWiFiConfig();
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintln("✅ commit WiFi ใหม่สำเร็จ — credential เดิมถูกแทนที่แล้ว");
    }

    setupMQTT();
  }
  else
  {
    if (hasPendingWiFiConfig)
    {
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintln("\n❌ WiFi ใหม่ต่อไม่สำเร็จ (ให้โอกาสครั้งเดียว) กำลัง rollback ไปค่าเดิม...");

      // ล้างค่าที่เพิ่งรับมาทิ้งไป
      clearPendingWiFiConfig();
      delay(500);

      // รีสตาร์ตเพื่อให้เครื่องกลับไปใช้ค่า savedSSID (ตัวเดิม) ทันที
      ESP.restart();
      return;
    }

    // ไม่มี pending (ต่อ WiFi ตัวเดิมไม่ติด)
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln(" เชื่อมต่อไม่สำเร็จ!");

    if (wifiFailCount < 1)
    {
       // ลองครั้งแรกไม่ติด ให้โอกาสฮาร์ดแวร์ Restart ตัวเอง 1 รอบ
       wifiFailCount++;
       if (isRuntimeSerialOutputEnabled())
         runtimeLogPrintln("🔄 ลองรีสตาร์ตตัวเอง 1 ครั้ง เพื่อพยายามเชื่อมต่อ WiFi เดิมใหม่...");
       delay(500);
       ESP.restart();
       return;
    }

    // ถ้ารอบ 2 ก็ยังไม่ติดอีก ยอมแพ้ แล้วเปิด BLE
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("❌ ไม่สามารถเชื่อมต่อ WiFi เดิมได้ เริ่ม BLE Provisioning...");

    wifiFailCount = 0; // ล้างเผื่อไว้สำหรับการต่อรอบหน้า
    setupBLE();
    startBLEAdvertising();
  }
}

// ─── WiFi Config Helpers ─────────────────────────────────────────────────────

extern Preferences preferences;

void loadWiFiConfig()
{
  savedSSID = preferences.getString("ssid", "");
  savedPassword = preferences.getString("password", "");
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintf("📂 โหลด config แล้ว: SSID='%s'\n", savedSSID.c_str());
}

bool saveWiFiConfig(String ssid, String password)
{
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  String verifiedSSID = preferences.getString("ssid", "");
  String verifiedPassword = preferences.getString("password", "");
  bool saved = (verifiedSSID == ssid && verifiedPassword == password);
  if (saved)
  {
    savedSSID = ssid;
    savedPassword = password;
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("💾 บันทึก config แล้ว");
  }
  else
  {
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("❌ ตรวจสอบ config หลังเขียน NVS ไม่ผ่าน");
  }
  return saved;
}

void clearWiFiConfig()
{
  // 1) ล้างค่าใน Preferences namespace หลัก
  preferences.remove("ssid");
  preferences.remove("password");
  preferences.remove("pending_ssid");
  preferences.remove("pending_pass");
  savedSSID = "";
  savedPassword = "";
  pendingSSID = "";
  pendingPassword = "";
  hasPendingWiFiConfig = false;

  // 2) ล้าง internal WiFi flash ของ ESP32 ด้วย เพื่อไม่ให้ credential ค้างนอก Preferences
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_OFF);

  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintln("🗑️ ล้าง config แล้ว (NVS + WiFi flash)");
}

// ─── Pending WiFi Config Helpers (commit-after-success) ──────────────────────

// โหลด pending credential จาก NVS — คืนค่า true ถ้ามี pending รออยู่
bool loadPendingWiFiConfig()
{
  pendingSSID     = preferences.getString("pending_ssid", "");
  pendingPassword = preferences.getString("pending_pass", "");
  hasPendingWiFiConfig = (pendingSSID.length() > 0);
  if (hasPendingWiFiConfig && isRuntimeSerialOutputEnabled())
    runtimeLogPrintf("📂 พบ pending WiFi config: SSID='%s'\n", pendingSSID.c_str());
  return hasPendingWiFiConfig;
}

// บันทึก credential ใหม่เป็น pending (ยังไม่ overwrite ssid/password ที่ confirmed)
void savePendingWiFiConfig(String ssid, String password)
{
  preferences.putString("pending_ssid", ssid);
  preferences.putString("pending_pass", password);
  pendingSSID     = ssid;
  pendingPassword = password;
  hasPendingWiFiConfig = true;
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintf("💾 บันทึก pending WiFi config: SSID='%s'\n", ssid.c_str());
}

// commit: คัดลอก pending → ssid/password (confirmed), ล้าง pending slot
void commitPendingWiFiConfig()
{
  saveWiFiConfig(pendingSSID, pendingPassword);
  preferences.remove("pending_ssid");
  preferences.remove("pending_pass");
  pendingSSID     = "";
  pendingPassword = "";
  hasPendingWiFiConfig = false;
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintln("💾 commit pending WiFi config สำเร็จ");
}

// rollback: ล้าง pending slot โดยไม่แตะ ssid/password เดิม
void clearPendingWiFiConfig()
{
  preferences.remove("pending_ssid");
  preferences.remove("pending_pass");
  pendingSSID     = "";
  pendingPassword = "";
  hasPendingWiFiConfig = false;
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintln("🗑️ ล้าง pending WiFi config (rollback)");
}

int getWiFiProvisioningMaxAttempts()
{
  return WIFI_PROVISIONING_MAX_ATTEMPTS;
}
