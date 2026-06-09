import { wifiScannerService, type WiFiNetwork } from '../../services/wifiScannerService';
import WifiManager from 'react-native-wifi-reborn';
import { PermissionsAndroid, Platform } from 'react-native';

jest.mock('react-native-wifi-reborn', () => ({
  __esModule: true,
  default: {
    reScanAndLoadWifiList: jest.fn(),
    loadWifiList: jest.fn(),
    getCurrentWifiSSID: jest.fn(),
    getBSSID: jest.fn(),
    getCurrentSignalStrength: jest.fn(),
    getFrequency: jest.fn(),
  },
}));

const createNetwork = (capabilities: string): WiFiNetwork => ({
  SSID: 'Home WiFi',
  BSSID: '00:11:22:33:44:55',
  level: -50,
  frequency: 2412,
  capabilities,
  timestamp: 1,
});

const mockedWifiManager = WifiManager as jest.Mocked<typeof WifiManager>;

describe('wifiScannerService', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

    mockedWifiManager.reScanAndLoadWifiList.mockResolvedValue([]);
    mockedWifiManager.loadWifiList.mockResolvedValue([]);
    mockedWifiManager.getCurrentWifiSSID.mockResolvedValue('');
    mockedWifiManager.getBSSID.mockResolvedValue('');
    mockedWifiManager.getCurrentSignalStrength.mockResolvedValue(-127);
    mockedWifiManager.getFrequency.mockResolvedValue(0);
  });

  it('keeps fresh security capabilities when the current WiFi snapshot has stronger signal', async () => {
    mockedWifiManager.reScanAndLoadWifiList.mockResolvedValue([
      createNetwork('[WPA2-PSK-CCMP][ESS]'),
    ]);
    mockedWifiManager.getCurrentWifiSSID.mockResolvedValue('"Home WiFi"');
    mockedWifiManager.getBSSID.mockResolvedValue('current-bssid');
    mockedWifiManager.getCurrentSignalStrength.mockResolvedValue(-30);
    mockedWifiManager.getFrequency.mockResolvedValue(2412);

    const result = await wifiScannerService.scanNetworks();

    expect(result.networks).toHaveLength(1);
    expect(result.networks[0]?.capabilities).toBe('[WPA2-PSK-CCMP][ESS]');
  });

  it('does not return networks before security capabilities are known', async () => {
    mockedWifiManager.getCurrentWifiSSID.mockResolvedValue('"Home WiFi"');
    mockedWifiManager.getBSSID.mockResolvedValue('current-bssid');
    mockedWifiManager.getCurrentSignalStrength.mockResolvedValue(-30);
    mockedWifiManager.getFrequency.mockResolvedValue(2412);

    const result = await wifiScannerService.scanNetworks();

    expect(result.networks).toEqual([]);
  });

  it('does not read the current phone WiFi snapshot while building scan results', async () => {
    mockedWifiManager.reScanAndLoadWifiList.mockResolvedValue([
      createNetwork('[WPA2-PSK-CCMP][ESS]'),
    ]);

    await wifiScannerService.scanNetworks();

    expect(mockedWifiManager.getCurrentWifiSSID).not.toHaveBeenCalled();
    expect(mockedWifiManager.getBSSID).not.toHaveBeenCalled();
    expect(mockedWifiManager.getCurrentSignalStrength).not.toHaveBeenCalled();
    expect(mockedWifiManager.getFrequency).not.toHaveBeenCalled();
  });

  it('detects explicitly open networks', () => {
    expect(wifiScannerService.isSecured(createNetwork('[ESS]'))).toBe(false);
  });

  it('detects password-protected networks', () => {
    expect(wifiScannerService.isSecured(createNetwork('[WPA2-PSK-CCMP][ESS]'))).toBe(true);
  });
});
