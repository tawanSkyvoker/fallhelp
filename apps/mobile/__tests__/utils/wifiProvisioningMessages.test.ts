import { getWiFiProvisioningFailureMessage } from '../../utils/wifiProvisioningMessages';

describe('getWiFiProvisioningFailureMessage', () => {
  it('does not describe backend confirmation timeout as a wrong WiFi password after BLE connected', () => {
    expect(
      getWiFiProvisioningFailureMessage('เชื่อมต่อ WiFi ไม่สำเร็จ', {
        wifiConnectedViaBle: true,
      }),
    ).toContain('ยืนยันอุปกรณ์ออนไลน์กับระบบไม่ได้');
  });

  it('keeps credential failures focused on WiFi password checking', () => {
    expect(getWiFiProvisioningFailureMessage('เชื่อมต่อ WiFi ไม่สำเร็จ')).toContain(
      'รหัสผ่าน WiFi อาจไม่ถูกต้อง',
    );
  });
});
