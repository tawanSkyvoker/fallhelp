/**
 * bleService.ts
 *
 * ไฟล์นี้ใช้จัดการ BLE สำหรับตั้งค่า WiFi ให้ ESP32
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจสอบว่า Bluetooth พร้อมใช้งานหรือไม่
 * - สแกนหาอุปกรณ์ FallDetector / FallHelp
 * - เชื่อมต่อกับอุปกรณ์ผ่าน BLE
 * - ส่ง SSID และ Password ไปให้อุปกรณ์
 * - รอสถานะตอบกลับจาก ESP32
 */

import { Buffer } from 'buffer';
import type { EventSubscription } from 'react-native';
import BleManager, {
  BleState,
  type BleManagerDidUpdateValueForCharacteristicEvent,
  type Peripheral,
  type PeripheralInfo,
} from 'react-native-ble-manager';

import Logger from '../utils/logger';

export const State: {
  readonly PoweredOn: BleState.On;
  readonly PoweredOff: BleState.Off;
  readonly Unsupported: BleState.Unsupported;
  readonly Unauthorized: BleState.Unauthorized;
} = {
  PoweredOn: BleState.On,
  PoweredOff: BleState.Off,
  Unsupported: BleState.Unsupported,
  Unauthorized: BleState.Unauthorized,
};

export type BLEState = BleState;

// UUID เหล่านี้ต้องตรงกับฝั่ง ESP32
// ใช้บอกว่าแต่ละช่อง BLE เอาไว้ส่งหรือรับข้อมูลอะไร
export const BLE_CONFIG = {
  SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  CHAR_UUID_SSID: '4fafc202-1fb5-459e-8fcc-c5c9c331914b',
  CHAR_UUID_PASSWORD: '4fafc203-1fb5-459e-8fcc-c5c9c331914b',
  CHAR_UUID_STATUS: '4fafc204-1fb5-459e-8fcc-c5c9c331914b',
};

// รหัสสถานะที่ ESP32 ส่งกลับมาระหว่างตั้งค่า WiFi
// ตัวเลขต้องตรงกับ firmware ของ ESP32
export enum BLEProvisioningStatus {
  CONNECTING = 0x01,
  CONNECTED = 0x02,
  FAILED = 0x03,
  INVALID = 0x04,
  MQTT_UNAVAILABLE = 0x05,
  TRANSPORT_ERROR = 0xf0,
  TIMEOUT = 0xf1,
}

export interface BLEDevice {
  id: string;
  name: string | null;
  localName?: string | null;
  rssi: number | null;
}

export interface BLEProvisioningResult {
  success: boolean;
  status: BLEProvisioningStatus;
  message: string;
}

class BLEService {
  private connectedDevice: PeripheralInfo | null = null;
  private scanSubscription: EventSubscription | null = null;
  private started = false;

  private async ensureStarted(): Promise<void> {
    if (this.started) return;

    await BleManager.start({ showAlert: false });
    this.started = true;
  }

  /**
   * ตรวจว่า Bluetooth ของเครื่องพร้อมใช้งานหรือไม่
   */
  async initialize(): Promise<boolean> {
    try {
      const state = await this.getState();
      Logger.info('BLE State:', state);

      if (state === State.PoweredOff) {
        Logger.warn('Bluetooth is powered off');
        return false;
      }

      if (state === State.Unsupported) {
        Logger.error('Bluetooth is not supported on this device');
        return false;
      }

      return state === State.PoweredOn;
    } catch (error) {
      Logger.error('Error initializing BLE:', error);
      return false;
    }
  }

  /**
   * ฟังการเปลี่ยนสถานะ Bluetooth เช่น เปิดหรือปิด Bluetooth
   */
  onStateChange(callback: (state: BLEState) => void): EventSubscription {
    const subscription = BleManager.onDidUpdateState((event) => {
      callback(event.state);
    });

    void this.getState().then((state) => callback(state));

    return subscription;
  }

  /**
   * สแกนหาอุปกรณ์ BLE ของ FallHelp
   */
  async scanForDevices(
    onDeviceFound: (device: BLEDevice) => void,
    timeoutMs: number = 10000,
  ): Promise<void> {
    const foundDevices = new Set<string>();

    Logger.info('Starting BLE scan...');
    await this.ensureStarted();
    this.stopScan();

    this.scanSubscription = BleManager.onDiscoverPeripheral((device: Peripheral) => {
      const deviceName = device.name || device.advertising?.localName;
      if (!deviceName) return;

      const isFallDetector =
        deviceName.startsWith('FallDetector-') || deviceName.startsWith('FallHelp-');

      if (!isFallDetector || foundDevices.has(device.id)) return;

      foundDevices.add(device.id);
      Logger.info(`Found BLE device: ${deviceName} (RSSI: ${device.rssi})`);

      onDeviceFound({
        id: device.id,
        name: device.name ?? null,
        localName: device.advertising?.localName ?? null,
        rssi: device.rssi ?? null,
      });
    });

    await BleManager.scan({
      seconds: Math.max(1, Math.ceil(timeoutMs / 1000)),
      allowDuplicates: false,
    }).catch((error: unknown) => {
      Logger.error('BLE Scan error:', error);
    });

    setTimeout(() => {
      this.stopScan();
    }, timeoutMs);
  }

  /**
   * หยุดสแกน BLE
   */
  stopScan(): void {
    if (this.scanSubscription) {
      this.scanSubscription.remove();
      this.scanSubscription = null;
    }

    void BleManager.stopScan().catch((error: unknown) => {
      Logger.warn('BLE stop scan failed (non-fatal):', error);
    });

    Logger.info('BLE scan stopped');
  }

  /**
   * เชื่อมต่อกับอุปกรณ์ BLE ตาม deviceId
   */
  async connectToDevice(deviceId: string): Promise<boolean> {
    Logger.info('Connecting to device:', deviceId);
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    try {
      await this.ensureStarted();

      await new Promise<void>((resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          void BleManager.disconnect(deviceId).catch(() => undefined);
          reject(new Error('Connection timeout'));
        }, 30000);

        BleManager.connect(deviceId)
          .then(async () => {
            Logger.info('Connected to device:', deviceId);

            this.connectedDevice = await BleManager.retrieveServices(deviceId, [
              BLE_CONFIG.SERVICE_UUID,
            ]);
            Logger.info('Services discovered');

            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
              timeoutHandle = null;
            }

            resolve();
          })
          .catch((error: unknown) => {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
              timeoutHandle = null;
            }

            reject(error);
          });
      });

      return true;
    } catch (error) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      const errMsg = error instanceof Error ? error.message : String(error);

      if (errMsg.includes('was disconnected') || errMsg.includes('cancelled')) {
        Logger.info('BLE connection cancelled by user or device');
      } else {
        Logger.error('Error connecting to device:', error);
      }

      return false;
    }
  }

  /**
   * ตัดการเชื่อมต่อจากอุปกรณ์ที่กำลังเชื่อมต่ออยู่
   */
  async disconnect(): Promise<void> {
    if (!this.connectedDevice) return;

    try {
      const deviceId = this.connectedDevice.id;
      this.connectedDevice = null;

      const isConnected = await BleManager.isPeripheralConnected(deviceId);

      if (isConnected) {
        await BleManager.disconnect(deviceId);
        Logger.info('Disconnected from device');
      }
    } catch (error) {
      Logger.warn('Error disconnecting (this is usually safe to ignore):', error);
    }
  }

  /**
   * ส่ง SSID และ Password ไปให้ ESP32 ผ่าน BLE
   */
  async sendWiFiCredentials(ssid: string, password: string): Promise<BLEProvisioningResult> {
    if (!this.connectedDevice) {
      return {
        success: false,
        status: BLEProvisioningStatus.TRANSPORT_ERROR,
        message: 'No device connected',
      };
    }

    try {
      const initialStatus = await this.readCurrentStatus();
      Logger.info('Initial BLE status before provisioning:', initialStatus);

      Logger.info('Writing SSID to BLE characteristic');
      await BleManager.write(
        this.connectedDevice.id,
        BLE_CONFIG.SERVICE_UUID,
        BLE_CONFIG.CHAR_UUID_SSID,
        this.stringToBytes(ssid),
      );

      Logger.info('Writing Password: ***');
      await BleManager.write(
        this.connectedDevice.id,
        BLE_CONFIG.SERVICE_UUID,
        BLE_CONFIG.CHAR_UUID_PASSWORD,
        this.stringToBytes(password),
      );

      const status = await this.waitForStatus(45000);

      if (status === BLEProvisioningStatus.CONNECTED) {
        return {
          success: true,
          status,
          message: 'WiFi connected successfully',
        };
      }

      if (status === BLEProvisioningStatus.FAILED) {
        return {
          success: false,
          status,
          message: 'WiFi connection failed. Check SSID/password.',
        };
      }

      if (status === BLEProvisioningStatus.INVALID) {
        return {
          success: false,
          status,
          message: 'Invalid credentials format',
        };
      }

      if (status === BLEProvisioningStatus.MQTT_UNAVAILABLE) {
        return {
          success: false,
          status,
          message: 'WiFi connected, but MQTT server is unavailable.',
        };
      }

      if (status === BLEProvisioningStatus.TRANSPORT_ERROR) {
        return {
          success: false,
          status,
          message: 'BLE connection was interrupted before confirmation.',
        };
      }

      if (status === BLEProvisioningStatus.TIMEOUT) {
        return {
          success: false,
          status,
          message: 'Timed out while waiting for device provisioning status.',
        };
      }

      return {
        success: false,
        status,
        message: 'Unknown status received',
      };
    } catch (error) {
      Logger.error('Error sending WiFi credentials:', error);

      return {
        success: false,
        status: BLEProvisioningStatus.TRANSPORT_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * รอสถานะการตั้งค่า WiFi จาก ESP32
   */
  private async waitForStatus(timeoutMs: number = 45000): Promise<BLEProvisioningStatus> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    const device = this.connectedDevice;
    let sawConnecting = false;
    let lastLoggedStatus: BLEProvisioningStatus | null = null;

    Logger.info(`Waiting for WiFi status via BLE notify (timeout: ${timeoutMs / 1000}s)...`);

    return new Promise<BLEProvisioningStatus>((resolve) => {
      let resolved = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let fallbackHandle: ReturnType<typeof setInterval> | null = null;
      let subscription: EventSubscription | null = null;

      const cleanupTimers = (): void => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        if (fallbackHandle) {
          clearInterval(fallbackHandle);
          fallbackHandle = null;
        }
      };

      const cleanup = (): void => {
        cleanupTimers();

        if (subscription) {
          subscription.remove();
          subscription = null;
        }
      };

      const finish = (status: BLEProvisioningStatus): void => {
        if (resolved) return;

        resolved = true;

        if (
          status === BLEProvisioningStatus.CONNECTED ||
          status === BLEProvisioningStatus.TRANSPORT_ERROR
        ) {
          cleanupTimers();
        } else {
          cleanup();
        }

        resolve(status);
      };

      const evaluateStatus = (status: BLEProvisioningStatus): boolean => {
        if (status !== lastLoggedStatus) {
          Logger.info(`BLE status: ${lastLoggedStatus} -> ${status}`);
          lastLoggedStatus = status;
        }

        if (status === BLEProvisioningStatus.CONNECTING) {
          sawConnecting = true;
          return false;
        }

        if (status === BLEProvisioningStatus.CONNECTED) {
          if (sawConnecting) {
            finish(status);
            return true;
          }

          return false;
        }

        if (
          status === BLEProvisioningStatus.FAILED ||
          status === BLEProvisioningStatus.INVALID ||
          status === BLEProvisioningStatus.MQTT_UNAVAILABLE
        ) {
          if (!sawConnecting) {
            Logger.info(`Ignoring stale terminal BLE status (${status}) from previous cycle`);
            return false;
          }

          finish(status);
          return true;
        }

        return false;
      };

      try {
        subscription = BleManager.onDidUpdateValueForCharacteristic(
          (event: BleManagerDidUpdateValueForCharacteristicEvent) => {
            if (resolved) return;
            if (event.peripheral !== device.id) return;
            if (event.service.toLowerCase() !== BLE_CONFIG.SERVICE_UUID.toLowerCase()) return;
            if (event.characteristic.toLowerCase() !== BLE_CONFIG.CHAR_UUID_STATUS.toLowerCase()) {
              return;
            }

            if (event.value.length > 0) {
              const status = this.bytesToNumber(event.value) as BLEProvisioningStatus;
              evaluateStatus(status);
            }
          },
        );

        void BleManager.startNotification(
          device.id,
          BLE_CONFIG.SERVICE_UUID,
          BLE_CONFIG.CHAR_UUID_STATUS,
        ).catch((error: unknown) => {
          Logger.warn('BLE notify start failed, falling back to polling:', error);
        });
      } catch (error) {
        Logger.warn('Failed to start BLE notify monitor, falling back to polling:', error);
      }

      fallbackHandle = setInterval(async () => {
        if (resolved || !this.connectedDevice) return;

        try {
          const isConn = await BleManager.isPeripheralConnected(device.id);
          if (!isConn) return;

          const value = await BleManager.read(
            device.id,
            BLE_CONFIG.SERVICE_UUID,
            BLE_CONFIG.CHAR_UUID_STATUS,
          );

          if (value.length > 0) {
            const status = this.bytesToNumber(value) as BLEProvisioningStatus;
            evaluateStatus(status);
          }
        } catch {
          // ถ้าอ่านไม่ได้ อาจเป็นเพราะ ESP32 ปิด BLE ไปแล้ว
          // ปล่อยให้ notify หรือ timeout จัดการต่อ
        }
      }, 3000);

      timeoutHandle = setTimeout(() => {
        if (!resolved) {
          Logger.warn('Provisioning status wait timed out');
          finish(BLEProvisioningStatus.TIMEOUT);
        }
      }, timeoutMs);
    });
  }

  /**
   * อ่านสถานะ BLE ปัจจุบันของ ESP32 หนึ่งครั้ง
   */
  private async readCurrentStatus(): Promise<BLEProvisioningStatus | null> {
    if (!this.connectedDevice) return null;

    try {
      const value = await BleManager.read(
        this.connectedDevice.id,
        BLE_CONFIG.SERVICE_UUID,
        BLE_CONFIG.CHAR_UUID_STATUS,
      );

      if (value.length === 0) return null;

      return this.bytesToNumber(value) as BLEProvisioningStatus;
    } catch (error) {
      Logger.warn('Failed to read initial BLE status', error);
      return null;
    }
  }

  /**
   * ดึงสถานะ Bluetooth ปัจจุบันของเครื่อง
   */
  async getState(): Promise<BLEState> {
    await this.ensureStarted();
    return await BleManager.checkState();
  }

  /**
   * ตรวจว่าอุปกรณ์ยังเชื่อมต่ออยู่หรือไม่
   */
  async isConnected(): Promise<boolean> {
    if (!this.connectedDevice) return false;

    try {
      const isConnected = await BleManager.isPeripheralConnected(this.connectedDevice.id);

      if (!isConnected) {
        this.connectedDevice = null;
      }

      return isConnected;
    } catch (error) {
      Logger.warn('Error checking BLE connection:', error);
      this.connectedDevice = null;
      return false;
    }
  }

  /**
   * ทำลาย BLE Manager
   */
  destroy(): void {
    this.stopScan();
  }

  private stringToBytes(str: string): number[] {
    // แปลงข้อความเป็น bytes ก่อนส่งผ่าน BLE
    // ใช้ Buffer เพื่อรองรับชื่อ WiFi ที่ไม่ใช่ภาษาอังกฤษ
    return Array.from(Buffer.from(str, 'utf-8'));
  }

  private bytesToNumber(bytes: number[]): number {
    // แปลงค่าจาก BLE กลับมาเป็นตัวเลข status
    const decoded = Buffer.from(bytes).toString('utf-8');
    return decoded.charCodeAt(0);
  }
}

// ใช้ instance เดียวร่วมกันทั้งแอป
export const bleService = new BLEService();
