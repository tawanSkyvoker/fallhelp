import React from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import DevicePairingScreen from '../../../app/(features)/(device)/device-pairing';
import DeviceWifiSetupScreen from '../../../app/(features)/(device)/device-wifi-setup';
import DeviceBleWifiSetupScreen from '../../../app/(features)/(device)/device-ble-wifi-setup';
import DeviceWifiReconfigScreen from '../../../app/(features)/(device)/device-wifi-reconfig';
import { useLocalSearchParams } from 'expo-router';
import { bleService } from '../../../services/bleService';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { wifiScannerService } from '../../../services/wifiScannerService';
import { showDialog } from '../../../utils/dialogService';
import { Keyboard } from 'react-native';

const mockCurrentElder = {
  id: 'elder-1',
  accessLevel: 'OWNER',
  device: {
    id: 'device-1',
    deviceCode: 'DEVICE123',
    serialNumber: 'SN-1',
    isOnline: false,
    onlineStatus: 'OFFLINE',
    lastOnline: null as string | null,
  },
};

const mockSensorState = {
  isConnected: false,
  socketConnected: false,
  lastHeartUpdate: null,
  lastStatusUpdate: null,
};

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(() => ({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
      error: null,
    })),
    useMutation: jest.fn(() => ({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
    })),
    useQueryClient: jest.fn(() => ({
      invalidateQueries: jest.fn(),
    })),
  };
});
jest.mock('../../../hooks/useCurrentElder', () => ({
  useCurrentElder: () => ({
    data: mockCurrentElder,
    isLoading: false,
  }),
}));

jest.mock('../../../store/useSensorStore', () => ({
  useSensorStore: jest.fn((selector) => (selector ? selector(mockSensorState) : mockSensorState)),
}));

jest.mock('../../../hooks/useNavBarInset', () => ({
  useNavBarInset: () => 0,
}));

jest.mock('../../../hooks/useNavigationBar', () => ({
  useTransparentNavigationBar: jest.fn(),
  useDarkNavigationBarWhen: jest.fn(),
}));

jest.mock('../../../components/WiFiNetworkList', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockReact = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: mockText, TouchableOpacity: mockTouchableOpacity } = require('react-native');
  return {
    WiFiNetworkList: ({
      onNetworkSelect,
    }: {
      onNetworkSelect?: (network: {
        SSID: string;
        BSSID: string;
        level: number;
        frequency: number;
        capabilities: string;
        timestamp: number;
      }) => void;
    }) =>
      mockReact.createElement(
        mockTouchableOpacity,
        {
          testID: 'wifi-network-list',
          onPress: () =>
            onNetworkSelect?.({
              SSID: 'Enterprise WiFi',
              BSSID: 'bssid-enterprise',
              level: -45,
              frequency: 2412,
              capabilities: '[EAP][ESS]',
              timestamp: 1,
            }),
        },
        mockReact.createElement(mockText, null, 'Enterprise WiFi'),
      ),
  };
});
jest.mock('../../../services/wifiScannerService', () => ({
  wifiScannerService: {
    isAvailable: jest.fn(async () => true),
    getCurrentSSID: jest.fn(async () => null),
    loadCachedNetworks: jest.fn(async () => ({ networks: [] })),
    scanNetworks: jest.fn(async () => ({ networks: [] })),
    isSecured: jest.fn(() => true),
  },
}));

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
    initialize: jest.fn(async () => false),
    getState: jest.fn(async () => 'off'),
    onStateChange: jest.fn(() => ({ remove: jest.fn() })),
    stopScan: jest.fn(),
    disconnect: jest.fn(async () => undefined),
    scanForDevices: jest.fn(),
    connectToDevice: jest.fn(async () => true),
    isConnected: jest.fn(async () => true),
    sendWiFiCredentials: jest.fn(async () => ({ success: true })),
  },
}));

jest.mock('../../../utils/keyboard', () => ({
  runAfterKeyboardDismiss: jest.fn((callback: () => void) => {
    callback();
    return jest.fn();
  }),
}));

jest.mock('../../../utils/blePermissions', () => ({
  checkBLEPermissions: jest.fn(async () => true),
  requestBLEPermissions: jest.fn(async () => ({ granted: true })),
}));

jest.mock('../../../services/deviceService', () => ({
  pairDevice: jest.fn(async () => ({ id: 'device-1', serialNumber: 'SN-1' })),
  configureWifi: jest.fn(async () => ({})),
  getDeviceConfig: jest.fn(async () => ({ wifiStatus: 'CONNECTED' })),
}));

jest.mock('../../../services/userService', () => ({
  getProfile: jest.fn(async () => ({ firstName: 'Test', lastName: 'User' })),
}));

jest.mock('../../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

jest.mock('../../../utils/errorHelper', () => ({
  showErrorMessage: jest.fn(),
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
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockedBleService = bleService as jest.Mocked<typeof bleService>;
const mockedWifiScannerService = wifiScannerService as jest.Mocked<typeof wifiScannerService>;
const mockedShowDialog = showDialog as jest.MockedFunction<typeof showDialog>;

describe('Device extra screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Keyboard, 'dismiss');
    mockCurrentElder.device.isOnline = false;
    mockCurrentElder.device.onlineStatus = 'OFFLINE';
    mockCurrentElder.device.lastOnline = null;
    mockSensorState.isConnected = false;
    mockedBleService.initialize.mockResolvedValue(false);
    mockedBleService.getState.mockResolvedValue('off' as never);
  });

  it('renders device pairing screen', () => {
    mockedUseLocalSearchParams.mockReturnValue({});
    const { getByText } = renderWithProviders(<DevicePairingScreen />);

    expect(getByText('สแกน QR Code')).toBeTruthy();
  });

  it('renders device wifi setup screen', async () => {
    mockedUseLocalSearchParams.mockReturnValue({ serialNumber: 'SN-1', from: 'pairing' });
    const { findByText } = renderWithProviders(<DeviceWifiSetupScreen />);

    expect(await findByText('เปิด Bluetooth ก่อนเริ่มตั้งค่า')).toBeTruthy();
  });

  it('routes to online wifi reconfig path when device is freshly online', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      serialNumber: 'SN-1',
      deviceCode: 'DEVICE123',
      from: 'device-info',
    });
    mockCurrentElder.device.isOnline = true;
    mockCurrentElder.device.onlineStatus = 'ONLINE';
    mockCurrentElder.device.lastOnline = new Date().toISOString();

    const { findByText } = renderWithProviders(<DeviceWifiSetupScreen />);

    expect(await findByText('เลือก WiFi')).toBeTruthy();
  });

  it('falls back to BLE wifi setup when backend online snapshot is stale', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      serialNumber: 'SN-1',
      deviceCode: 'DEVICE123',
      from: 'device-info',
    });
    mockCurrentElder.device.isOnline = true;
    mockCurrentElder.device.onlineStatus = 'ONLINE';
    mockCurrentElder.device.lastOnline = new Date(Date.now() - 60_000).toISOString();
    mockSensorState.isConnected = false;
    mockSensorState.socketConnected = false;

    const { findByText, queryByText } = renderWithProviders(<DeviceWifiSetupScreen />);

    expect(await findByText('เปิด Bluetooth ก่อนเริ่มตั้งค่า')).toBeTruthy();
    expect(queryByText('เลือก WiFi')).toBeNull();
  });

  it('connects when BLE name ends with serial suffix (legacy prefix)', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      serialNumber: 'ESP32-6C689BDAF380',
      from: 'pairing',
    });
    mockedBleService.initialize.mockResolvedValue(true);
    mockedBleService.getState.mockResolvedValue('on' as never);
    mockedBleService.scanForDevices.mockImplementation(async (onDeviceFound) => {
      onDeviceFound({
        id: 'legacy-ble-id',
        name: 'FallHelp-DAF380',
        rssi: -42,
      });
    });

    renderWithProviders(<DeviceWifiSetupScreen />);

    await waitFor(() => {
      expect(mockedBleService.connectToDevice).toHaveBeenCalledWith('legacy-ble-id');
    });
  });

  it('requires password in BLE wifi setup using central secured-network detection', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      serialNumber: 'ESP32-6C689BDAF380',
      from: 'device-info',
    });
    mockedBleService.initialize.mockResolvedValue(true);
    mockedBleService.getState.mockResolvedValue('on' as never);
    mockedBleService.scanForDevices.mockImplementation(async (onDeviceFound) => {
      onDeviceFound({
        id: 'ble-device-1',
        name: 'FallHelp-DAF380',
        rssi: -42,
      });
    });
    mockedWifiScannerService.isSecured.mockReturnValue(true);
    mockedWifiScannerService.scanNetworks.mockResolvedValue({
      networks: [
        {
          SSID: 'Enterprise WiFi',
          BSSID: 'bssid-enterprise',
          level: -45,
          frequency: 2412,
          capabilities: '[EAP][ESS]',
          timestamp: 1,
        },
      ],
    });

    const { findByTestId, findByText } = renderWithProviders(<DeviceBleWifiSetupScreen />);

    fireEvent.press(await findByTestId('wifi-network-list'));
    expect(await findByText('กรอกรหัสผ่าน')).toBeTruthy();

    fireEvent.press(await findByText('เชื่อมต่อ'));

    await waitFor(() => {
      expect(mockedShowDialog).toHaveBeenCalledWith('ต้องระบุรหัสผ่าน', 'กรุณาระบุรหัสผ่าน WiFi');
      expect(mockedBleService.sendWiFiCredentials).not.toHaveBeenCalled();
    });
  });

  it('waits for keyboard dismissal before BLE wifi setup submits a password', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      serialNumber: 'ESP32-6C689BDAF380',
      from: 'device-info',
    });
    mockedBleService.initialize.mockResolvedValue(true);
    mockedBleService.getState.mockResolvedValue('on' as never);
    mockedBleService.scanForDevices.mockImplementation(async (onDeviceFound) => {
      onDeviceFound({
        id: 'ble-device-1',
        name: 'FallHelp-DAF380',
        rssi: -42,
      });
    });
    mockedWifiScannerService.isSecured.mockReturnValue(true);
    mockedWifiScannerService.scanNetworks.mockResolvedValue({
      networks: [
        {
          SSID: 'Enterprise WiFi',
          BSSID: 'bssid-enterprise',
          level: -45,
          frequency: 2412,
          capabilities: '[EAP][ESS]',
          timestamp: 1,
        },
      ],
    });

    const { findByTestId, findByText } = renderWithProviders(<DeviceBleWifiSetupScreen />);

    fireEvent.press(await findByTestId('wifi-network-list'));
    fireEvent.changeText(await findByTestId('floating-label-input'), 'password123');
    fireEvent.press(await findByText('เชื่อมต่อ'));

    await waitFor(() => {
      expect(Keyboard.dismiss).toHaveBeenCalled();
      expect(mockedBleService.sendWiFiCredentials).toHaveBeenCalledWith(
        'Enterprise WiFi',
        'password123',
      );
    });
  });

  it('waits for keyboard dismissal before BLE wifi setup returns from password screen', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      serialNumber: 'ESP32-6C689BDAF380',
      from: 'device-info',
    });
    mockedBleService.initialize.mockResolvedValue(true);
    mockedBleService.getState.mockResolvedValue('on' as never);
    mockedBleService.scanForDevices.mockImplementation(async (onDeviceFound) => {
      onDeviceFound({
        id: 'ble-device-1',
        name: 'FallHelp-DAF380',
        rssi: -42,
      });
    });
    mockedWifiScannerService.isSecured.mockReturnValue(true);
    mockedWifiScannerService.scanNetworks.mockResolvedValue({
      networks: [
        {
          SSID: 'Enterprise WiFi',
          BSSID: 'bssid-enterprise',
          level: -45,
          frequency: 2412,
          capabilities: '[EAP][ESS]',
          timestamp: 1,
        },
      ],
    });

    const { findByTestId, findByText } = renderWithProviders(<DeviceBleWifiSetupScreen />);

    fireEvent.press(await findByTestId('wifi-network-list'));
    expect(await findByText('กรอกรหัสผ่าน')).toBeTruthy();

    fireEvent.press(await findByTestId('back-button'));

    await waitFor(() => {
      expect(Keyboard.dismiss).toHaveBeenCalled();
    });
    expect(await findByText('เลือก WiFi')).toBeTruthy();
  });

  it('waits for keyboard dismissal before wifi reconfig submits a password', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      deviceCode: 'DEVICE123',
      from: 'device-info',
    });
    mockSensorState.isConnected = true;
    mockedWifiScannerService.isSecured.mockReturnValue(true);
    mockedWifiScannerService.scanNetworks.mockResolvedValue({
      networks: [
        {
          SSID: 'Enterprise WiFi',
          BSSID: 'bssid-enterprise',
          level: -45,
          frequency: 2412,
          capabilities: '[EAP][ESS]',
          timestamp: 1,
        },
      ],
    });

    const { findByTestId, findByText } = renderWithProviders(<DeviceWifiReconfigScreen />);

    fireEvent.press(await findByTestId('wifi-network-list'));
    fireEvent.changeText(await findByTestId('floating-label-input'), 'password123');
    fireEvent.press(await findByText('ยืนยันการตั้งค่า'));

    await waitFor(() => {
      expect(Keyboard.dismiss).toHaveBeenCalled();
    });
  });

  it('waits for keyboard dismissal before wifi reconfig returns from password screen', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      deviceCode: 'DEVICE123',
      from: 'device-info',
    });
    mockSensorState.isConnected = true;
    mockedWifiScannerService.isSecured.mockReturnValue(true);
    mockedWifiScannerService.scanNetworks.mockResolvedValue({
      networks: [
        {
          SSID: 'Enterprise WiFi',
          BSSID: 'bssid-enterprise',
          level: -45,
          frequency: 2412,
          capabilities: '[EAP][ESS]',
          timestamp: 1,
        },
      ],
    });

    const { findByTestId, findByText } = renderWithProviders(<DeviceWifiReconfigScreen />);

    fireEvent.press(await findByTestId('wifi-network-list'));
    expect(await findByText('กรอกรหัสผ่าน')).toBeTruthy();

    fireEvent.press(await findByTestId('back-button'));

    await waitFor(() => {
      expect(Keyboard.dismiss).toHaveBeenCalled();
    });
    expect(await findByText('เลือก WiFi')).toBeTruthy();
  });
});
