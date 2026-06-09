const PASSWORD_FAILURE_MESSAGES = new Set([
  'ตั้งค่า WiFi ไม่สำเร็จ',
  'เชื่อมต่อ WiFi ไม่สำเร็จ',
  'WiFi connection failed. Check SSID/password.',
]);

const BACKEND_CONFIRMATION_FAILURE_MESSAGES = new Set([
  'ยืนยันอุปกรณ์ออนไลน์ไม่สำเร็จ',
  'WiFi connected, but MQTT server is unavailable.',
]);

interface WiFiProvisioningFailureOptions {
  readonly wifiConnectedViaBle?: boolean;
}

export function getWiFiProvisioningFailureMessage(
  message: string,
  options: WiFiProvisioningFailureOptions = {},
): string {
  if (options.wifiConnectedViaBle || BACKEND_CONFIRMATION_FAILURE_MESSAGES.has(message)) {
    return 'เชื่อมต่อ WiFi สำเร็จแล้ว แต่ยังยืนยันอุปกรณ์ออนไลน์กับระบบไม่ได้\nกรุณาตรวจสอบว่า MQTT/backend ทำงานอยู่ แล้วลองอีกครั้ง';
  }

  if (PASSWORD_FAILURE_MESSAGES.has(message)) {
    return 'รหัสผ่าน WiFi อาจไม่ถูกต้อง\nกรุณาตรวจสอบและลองใหม่อีกครั้ง';
  }

  if (message === 'BLE connection was interrupted before confirmation.') {
    return 'การเชื่อมต่อ Bluetooth หลุดก่อนอุปกรณ์ส่งสถานะกลับมา\nกรุณาอยู่ใกล้อุปกรณ์แล้วลองใหม่อีกครั้ง';
  }

  if (message === 'Timed out while waiting for device provisioning status.') {
    return 'ยังไม่ได้รับสถานะจากอุปกรณ์ภายในเวลาที่กำหนด\nกรุณาลองใหม่อีกครั้ง';
  }

  return message;
}
