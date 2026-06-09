import React from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import SetupEmptyStateScreen from '../../../app/(setup)/empty-state';
import { getCurrentElder } from '../../../services/elderService';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    signOut: jest.fn(),
  }),
}));

jest.mock('../../../services/elderService', () => ({
  getCurrentElder: jest.fn(async () => null),
}));

jest.mock('../../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

describe('SetupEmptyStateScreen (Empty State)', () => {
  const mockedGetCurrentElder = getCurrentElder as jest.MockedFunction<typeof getCurrentElder>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCurrentElder.mockResolvedValue(null);
  });

  it('renders getting started text', () => {
    const { getByText } = renderWithProviders(<SetupEmptyStateScreen />);
    expect(getByText('เริ่มต้นใช้งาน FallHelp')).toBeTruthy();
  });

  it('shows setup steps and register button', () => {
    const { getByText } = renderWithProviders(<SetupEmptyStateScreen />);
    expect(getByText('กรอกข้อมูลผู้สูงอายุ')).toBeTruthy();
    expect(getByText('เชื่อมต่ออุปกรณ์')).toBeTruthy();
    expect(getByText('ตั้งค่า WiFi')).toBeTruthy();
    expect(getByText('เริ่มลงทะเบียน')).toBeTruthy();
  });
});
