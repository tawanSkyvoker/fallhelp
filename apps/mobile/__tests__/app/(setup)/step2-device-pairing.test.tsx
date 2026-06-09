import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import Step2DevicePairingScreen from '../../../app/(setup)/step2-device-pairing';
import { pairDevice } from '../../../services/deviceService';

jest.mock('../../../services/deviceService', () => ({
  pairDevice: jest.fn(async () => ({ id: 'device-1', serialNumber: 'ESP32-TEST' })),
  unpairDevice: jest.fn(async () => undefined),
}));

jest.mock('../../../services/elderService', () => ({
  getCurrentElder: jest.fn(async () => ({ id: 'elder-1' })),
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

jest.mock('../../../hooks/useNavBarInset', () => ({
  useNavBarInset: () => 0,
}));

jest.mock('../../../hooks/useNavigationBar', () => ({
  useDarkNavigationBarWhen: jest.fn(),
}));

jest.mock('../../../utils/setupStorage', () => ({
  getSetupDeviceId: jest.fn(async () => null),
  getSetupElderId: jest.fn(async () => 'elder-1'),
  setSetupElderId: jest.fn(async () => undefined),
  setSetupDeviceId: jest.fn(async () => undefined),
  setSetupSerialNumber: jest.fn(async () => undefined),
  clearSetupDeviceId: jest.fn(async () => undefined),
  setSetupStep: jest.fn(async () => undefined),
}));

describe('Step2 (Device Pairing)', () => {
  it('renders pairing title', () => {
    const { getAllByText } = renderWithProviders(<Step2DevicePairingScreen />);

    expect(getAllByText('ติดตั้งอุปกรณ์').length).toBeGreaterThan(0);
  });

  it('uses the QR scan success view after manual pairing succeeds', async () => {
    const { getByText, getByTestId } = renderWithProviders(<Step2DevicePairingScreen />);

    fireEvent.press(getByText('กรอกรหัสอุปกรณ์ด้วยตนเอง'));
    fireEvent.changeText(getByTestId('floating-label-input'), '832CE051');
    fireEvent.press(getByText('ยืนยันรหัสอุปกรณ์'));

    await waitFor(() => {
      expect(pairDevice).toHaveBeenCalledWith({ deviceCode: '832CE051', elderId: 'elder-1' });
      expect(getByTestId('qr-pairing-success')).toBeTruthy();
    });
  });
});
