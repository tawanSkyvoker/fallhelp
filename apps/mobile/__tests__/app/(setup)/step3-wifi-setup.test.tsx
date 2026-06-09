/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { fireEvent, waitFor } from '@testing-library/react-native';
import Step3WifiSetupScreen from '../../../app/(setup)/step3-wifi-setup';
import { bleService } from '../../../services/bleService';
import { wifiScannerService } from '../../../services/wifiScannerService';
import { showDialog } from '../../../utils/dialogService';
import { runAfterKeyboardDismiss } from '../../../utils/keyboard';

jest.mock('../../../services/bleService', () => ({
  BLEProvisioningStatus: {
    CONNECTING: 0x01,
    CONNECTED: 0x02,
    FAILED: 0x03,
    INVALID: 0x04,
    MQTT_UNAVAILABLE: 0x05,
    TRANSPORT_ERROR: 0xf0,
    TIMEOUT: 0xf1,
  },
  State: {
    PoweredOn: 'on',
    PoweredOff: 'off',
    Unsupported: 'unsupported',
    Unauthorized: 'unauthorized',
  },
  bleService: {
    stopScan: jest.fn(),
    disconnect: jest.fn(async () => undefined),
    connectToDevice: jest.fn(async () => true),
    scanForDevices: jest.fn(),
    initialize: jest.fn(async () => false),
    isConnected: jest.fn(async () => true),
    getState: jest.fn(async () => 'off'),
    onStateChange: jest.fn(() => ({ remove: jest.fn() })),
    sendWiFiCredentials: jest.fn(async () => ({ success: true })),
  },
}));

jest.mock('../../../components/WiFiNetworkList', () => {
  const mockReact = require('react');
  const { Text: mockText, TouchableOpacity: mockTouchableOpacity } = require('react-native');

  return {
    WiFiNetworkList: ({ onNetworkSelect }: { onNetworkSelect: (network: unknown) => void }) =>
      mockReact.createElement(
        mockTouchableOpacity,
        {
          testID: 'unknown-security-network',
          onPress: () =>
            onNetworkSelect({
              SSID: 'Home WiFi',
              BSSID: 'bssid-home',
              level: -45,
              frequency: 2412,
              capabilities: '[WPA2-PSK-CCMP][ESS]',
              timestamp: 1,
            }),
        },
        mockReact.createElement(mockText, null, 'Home WiFi'),
      ),
  };
});

jest.mock('../../../utils/keyboard', () => ({
  runAfterKeyboardDismiss: jest.fn((callback: () => void) => {
    callback();
    return jest.fn();
  }),
}));

jest.mock('../../../services/wifiScannerService', () => ({
  wifiScannerService: {
    isAvailable: jest.fn(async () => true),
    getCurrentSSID: jest.fn(async () => null),
    loadCachedNetworks: jest.fn(async () => ({ networks: [] })),
    scanNetworks: jest.fn(async () => ({ networks: [], error: null })),
    isSecured: jest.fn(() => true),
  },
}));

jest.mock('../../../services/elderService', () => ({
  getCurrentElder: jest.fn(async () => null),
}));

jest.mock('../../../utils/blePermissions', () => ({
  checkBLEPermissions: jest.fn(async () => true),
  requestBLEPermissions: jest.fn(async () => ({ granted: true })),
}));

const mockSensorState = {
  isConnected: false,
  lastStatusUpdate: null,
  lastHeartUpdate: null,
};

jest.mock('../../../store/useSensorStore', () => ({
  useSensorStore: jest.fn((selector) => (selector ? selector(mockSensorState) : mockSensorState)),
}));

jest.mock('../../../store/useDeviceSetupStore', () => ({
  useDeviceSetupStore: Object.assign(
    jest.fn((selector) => selector({ elderId: undefined, deviceId: undefined })),
    { getState: () => ({ setElderConfig: jest.fn() }) },
  ),
}));

jest.mock('../../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

jest.mock('../../../hooks/useNavBarInset', () => ({
  useNavBarInset: () => 0,
}));

jest.mock('../../../utils/setupStorage', () => ({
  setSetupStep: jest.fn(async () => undefined),
  getSetupSerialNumber: jest.fn(async () => 'ESP32-6C689BDAF380'),
  setSetupElderId: jest.fn(async () => undefined),
  setSetupDeviceId: jest.fn(async () => undefined),
  setSetupSerialNumber: jest.fn(async () => undefined),
  getSetupElderId: jest.fn(async () => 'elder-1'),
  getSetupDeviceId: jest.fn(async () => 'device-1'),
  clearSetupTransientForCurrentUser: jest.fn(async () => undefined),
}));

const mockedBleService = bleService as jest.Mocked<typeof bleService>;
const mockedWifiScannerService = wifiScannerService as jest.Mocked<typeof wifiScannerService>;
const mockedShowDialog = showDialog as jest.MockedFunction<typeof showDialog>;
const mockedRunAfterKeyboardDismiss = runAfterKeyboardDismiss as jest.MockedFunction<
  typeof runAfterKeyboardDismiss
>;

describe('Step3 (WiFi Setup)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBleService.initialize.mockResolvedValue(false);
    mockedBleService.getState.mockResolvedValue('off' as never);
  });

  it('renders bluetooth prompt when BLE is off', async () => {
    const { findByText } = renderWithProviders(<Step3WifiSetupScreen />);

    expect(await findByText('เปิด Bluetooth ก่อนเริ่มตั้งค่า')).toBeTruthy();
  });

  it('connects to BLE device when discovered name ends with serial suffix', async () => {
    mockedBleService.initialize.mockResolvedValue(true);
    mockedBleService.getState.mockResolvedValue('on' as never);
    mockedBleService.scanForDevices.mockImplementation(async (onDeviceFound) => {
      onDeviceFound({
        id: 'ble-device-1',
        name: 'FallDetector-DAF380',
        rssi: -35,
      });
    });

    renderWithProviders(<Step3WifiSetupScreen />);

    await waitFor(() => {
      expect(mockedBleService.connectToDevice).toHaveBeenCalledWith('ble-device-1');
    });
  });

  it('requires a password before provisioning a secured selected network', async () => {
    mockedBleService.initialize.mockResolvedValue(true);
    mockedBleService.getState.mockResolvedValue('on' as never);
    mockedBleService.scanForDevices.mockImplementation(async (onDeviceFound) => {
      onDeviceFound({
        id: 'ble-device-1',
        name: 'FallDetector-DAF380',
        rssi: -35,
      });
    });
    mockedWifiScannerService.scanNetworks.mockResolvedValue({
      networks: [
        {
          SSID: 'Home WiFi',
          BSSID: 'bssid-home',
          level: -45,
          frequency: 2412,
          capabilities: '[WPA2-PSK-CCMP][ESS]',
          timestamp: 1,
        },
      ],
    });
    mockedWifiScannerService.isSecured.mockReturnValue(true);

    const { findByTestId, findByText } = renderWithProviders(<Step3WifiSetupScreen />);

    fireEvent.press(await findByTestId('unknown-security-network'));
    expect(await findByText('กรอกรหัสผ่าน')).toBeTruthy();

    fireEvent.press(await findByText('เชื่อมต่อ'));

    await waitFor(() => {
      expect(mockedShowDialog).toHaveBeenCalledWith('ต้องระบุรหัสผ่าน', 'กรุณาระบุรหัสผ่าน WiFi');
      expect(mockedBleService.sendWiFiCredentials).not.toHaveBeenCalled();
    });
  });

  it('waits for keyboard dismissal before returning from password screen to WiFi list', async () => {
    mockedBleService.initialize.mockResolvedValue(true);
    mockedBleService.getState.mockResolvedValue('on' as never);
    mockedBleService.scanForDevices.mockImplementation(async (onDeviceFound) => {
      onDeviceFound({
        id: 'ble-device-1',
        name: 'FallDetector-DAF380',
        rssi: -35,
      });
    });
    mockedWifiScannerService.scanNetworks.mockResolvedValue({
      networks: [
        {
          SSID: 'Home WiFi',
          BSSID: 'bssid-home',
          level: -45,
          frequency: 2412,
          capabilities: '[WPA2-PSK-CCMP][ESS]',
          timestamp: 1,
        },
      ],
    });
    mockedWifiScannerService.isSecured.mockReturnValue(true);

    const { findByTestId, findByText } = renderWithProviders(<Step3WifiSetupScreen />);

    fireEvent.press(await findByTestId('unknown-security-network'));
    expect(await findByText('กรอกรหัสผ่าน')).toBeTruthy();

    fireEvent.press(await findByTestId('back-button'));

    await waitFor(() => {
      expect(mockedRunAfterKeyboardDismiss).toHaveBeenCalled();
    });
    expect(await findByText('เลือก WiFi')).toBeTruthy();
  });
});
