import React from 'react';
import { render } from '@testing-library/react-native';

import { WiFiNetworkList } from '../../components/WiFiNetworkList';

jest.mock('../../services/wifiScannerService', () => ({
  wifiScannerService: {
    isSecured: jest.fn(() => false),
  },
}));

const createNetwork = (SSID: string, level: number) => ({
  SSID,
  BSSID: `bssid-${SSID}`,
  level,
  frequency: 2412,
  capabilities: '',
  timestamp: 1,
});

describe('WiFiNetworkList', () => {
  it('renders WiFi signal icons by RSSI level', () => {
    const { getByTestId } = render(
      <WiFiNetworkList
        networks={[
          createNetwork('excellent', -45),
          createNetwork('good', -60),
          createNetwork('fair', -75),
          createNetwork('weak', -90),
        ]}
        isScanning={false}
        onNetworkSelect={jest.fn()}
        onScanAgain={jest.fn()}
        onManualInput={jest.fn()}
      />,
    );

    expect(getByTestId('wifi-signal-wifi-strength-4')).toBeTruthy();
    expect(getByTestId('wifi-signal-wifi-strength-3')).toBeTruthy();
    expect(getByTestId('wifi-signal-wifi-strength-2')).toBeTruthy();
    expect(getByTestId('wifi-signal-wifi-strength-1')).toBeTruthy();
  });
});
