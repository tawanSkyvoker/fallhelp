import React from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import DeviceInfoScreen from '../../../app/(features)/(device)/device-info';

jest.mock('../../../hooks/useCurrentElder', () => ({
  useCurrentElder: () => ({
    data: {
      id: 'elder-1',
      accessLevel: 'OWNER',
      device: {
        id: 'device-1',
        deviceCode: 'ABCD1234',
        serialNumber: 'ESP32-TEST',
        status: 'ACTIVE',
        config: { wifiStatus: 'CONNECTED' },
      },
    },
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

const mockSensorState = {
  isConnected: false,
  socketConnected: false,
  lastHeartUpdate: null,
  lastStatusUpdate: null,
};

jest.mock('../../../store/useSensorStore', () => ({
  useSensorStore: jest.fn((selector) => (selector ? selector(mockSensorState) : mockSensorState)),
}));

jest.mock('../../../store/useDeviceSetupStore', () => ({
  useDeviceSetupStore: {
    getState: () => ({ setElderConfig: jest.fn() }),
  },
}));

jest.mock('../../../services/deviceService', () => ({
  unpairDevice: jest.fn(async () => undefined),
}));

jest.mock('../../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

jest.mock('../../../utils/errorHelper', () => ({
  showErrorMessage: jest.fn(),
}));

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

describe('DeviceInfoScreen', () => {
  it('renders device settings section', () => {
    const { getByText } = renderWithProviders(<DeviceInfoScreen />);

    expect(getByText('การจัดการอุปกรณ์')).toBeTruthy();
  });
});
