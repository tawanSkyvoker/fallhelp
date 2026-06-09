/**
 * @file BLEProvisioning.ino
 * @brief BLEProvisioning: จัดการ BLE GATT server สำหรับการรับตั้งค่า WiFi ของอุปกรณ์ FallHelp
 *
 * หน้าที่หลัก:
 * - เริ่มต้นบริการ BLE GATT server (SSID, Password, Status characteristics)
 * - รับข้อมูล WiFi credentials (SSID และ Password) จากแอปพลิเคชันมือถือ (Mobile App)
 * - รายงานสถานะการเชื่อมต่อ WiFi กลับไปยังแอปพลิเคชันมือถือผ่าน status characteristic
 * - ควบคุมลำดับโฆษณา (BLE Advertising) และการจัดการ session เพื่ออำนวยความสะดวกในการจัดสรรสิทธิ์ (provisioning)
 */

#include "types.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// BLE provisioning state
BLEServer *pServer = nullptr;
BLECharacteristic *pCharSSID = nullptr;
BLECharacteristic *pCharPassword = nullptr;
BLECharacteristic *pCharStatus = nullptr;
bool deviceConnected = false;
bool suppressBleAutoRestart = false;

// ============================================================================
// [1] callback ของ BLE provisioning (BLE Provisioning Callbacks)
// ============================================================================
class MyServerCallbacks : public BLEServerCallbacks
{
  void onConnect(BLEServer *pServer)
  {
    deviceConnected = true;
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("📱 BLE Client Connected");
  }

  void onDisconnect(BLEServer *pServer)
  {
    deviceConnected = false;
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("📱 BLE Client Disconnected");

    if (!suppressBleAutoRestart && WiFi.status() != WL_CONNECTED && !isConnecting)
    {
      delay(500);
      pServer->startAdvertising();
      bleProvisioning = true;
      bleStartTime = millis();
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintln("🔄 BLE Advertising restarted");
    }
  }
};

class SSIDCallbacks : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic *pCharacteristic)
  {
    String value = pCharacteristic->getValue();
    if (value.length() > 0)
    {
      savedSSID = value;
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintf("📶 Received SSID: %s\n", savedSSID.c_str());
    }
  }
};

class PasswordCallbacks : public BLECharacteristicCallbacks
{
  void onWrite(BLECharacteristic *pCharacteristic)
  {
    String value = pCharacteristic->getValue();
    savedPassword = value;
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("🔐 Received Password: ***");

    if (savedSSID.length() > 0)
    {
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintln("\n⏳ WiFi connection scheduled...");
      shouldConnect = true;
    }
    else
    {
      if (isRuntimeSerialOutputEnabled())
        runtimeLogPrintln("⚠️ SSID not set yet");
      updateBLEStatus(0x04);
    }
  }
};

// ============================================================================
// [2] BLEProvisioning: ลำดับ BLE provisioning
// ============================================================================

void setupBLE()
{
  String shortId = deviceSerial.substring(deviceSerial.length() - 6);
  String bleName = String(BLE_DEVICE_NAME_PREFIX) + shortId;

  BLEDevice::init(bleName.c_str());
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCharSSID = pService->createCharacteristic(CHAR_UUID_SSID, BLECharacteristic::PROPERTY_WRITE);
  pCharSSID->setCallbacks(new SSIDCallbacks());

  pCharPassword = pService->createCharacteristic(CHAR_UUID_PASSWORD, BLECharacteristic::PROPERTY_WRITE);
  pCharPassword->setCallbacks(new PasswordCallbacks());

  pCharStatus = pService->createCharacteristic(CHAR_UUID_STATUS, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharStatus->addDescriptor(new BLE2902());

  uint8_t initialStatus = 0x00;
  pCharStatus->setValue(&initialStatus, 1);
  pService->start();

  if (isRuntimeSerialOutputEnabled())
  {
    runtimeLogPrintln("\n--- BLE provisioning ready ---");
    runtimeLogPrintf("Device Name: %s\n", bleName.c_str());
    runtimeLogPrintf("Service UUID: %s\n", SERVICE_UUID);
  }
}

void startBLEAdvertising()
{
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);

  // ช่วง Advertising: 0x30 = 30ms, 0x60 = 60ms
  // ค่า 0x06–0x12 (3.75–11.25ms) สั้นเกินไป — Android scanner บางรุ่นจะ filter packet ที่ถี่เกิน
  // ตั้ง 30–60ms เป็นช่วงที่ Android scan mode BALANCED รับได้ดีที่สุด
  pAdvertising->setMinInterval(0x30); // 30ms
  pAdvertising->setMaxInterval(0x60); // 60ms

  // ปิด WiFi AutoReconnect ระหว่าง BLE provisioning — ทั้งสองใช้ radio เดียวกัน
  // ถ้าปล่อยให้ AutoReconnect รันพร้อมกับ BLE จะเกิด ASSOC_EXPIRE และ BLE packet loss
  WiFi.setAutoReconnect(false);
  BLEDevice::startAdvertising();
  bleProvisioning = true;
  bleStartTime = millis();

  if (isRuntimeSerialOutputEnabled())
  {
    runtimeLogPrintln("📡 เริ่ม BLE Advertising แล้ว (interval: 30-60ms)");
    runtimeLogPrintln("📱 เปิดแอปมือถือเพื่อกรอก WiFi");
  }
}

void stopBLEAdvertising()
{
  if (bleProvisioning)
  {
    BLEDevice::stopAdvertising();
    bleProvisioning = false;
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintln("📡 หยุด BLE Advertising แล้ว");
  }
}

void resetBLESession()
{
  if (isRuntimeSerialOutputEnabled())
    runtimeLogPrintln("🔁 รีเซ็ต BLE session...");

  suppressBleAutoRestart = true;
  stopBLEAdvertising();
  shouldConnect = false;
  isConnecting = false;
  deviceConnected = false;

  WiFi.setAutoReconnect(false);
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_OFF);
  delay(300);

  BLEDevice::deinit(true);
  delay(300);

  pServer = nullptr;
  pCharSSID = nullptr;
  pCharPassword = nullptr;
  pCharStatus = nullptr;

  setupBLE();
  updateBLEStatus(0x00);
  suppressBleAutoRestart = false;
  startBLEAdvertising();
}

void updateBLEStatus(uint8_t status)
{
  if (pCharStatus != nullptr)
  {
    pCharStatus->setValue(&status, 1);
    pCharStatus->notify();

    const char *statusText;
    switch (status)
    {
    case 0x00:
      statusText = "IDLE";
      break;
    case 0x01:
      statusText = "CONNECTING";
      break;
    case 0x02:
      statusText = "CONNECTED";
      break;
    case 0x03:
      statusText = "FAILED";
      break;
    case 0x04:
      statusText = "INVALID";
      break;
    default:
      statusText = "UNKNOWN";
      break;
    }
    if (isRuntimeSerialOutputEnabled())
      runtimeLogPrintf("📲 อัปเดต BLE status: %s (0x%02X)\n", statusText, status);
  }
}
