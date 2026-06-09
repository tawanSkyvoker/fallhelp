import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import ForgotPasswordScreen from '../../../app/(auth)/forgot-password';
import VerifyOtpScreen from '../../../app/(auth)/verify-otp';
import ResetPasswordScreen from '../../../app/(auth)/reset-password';
import AuthSuccessScreen from '../../../app/(auth)/success';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { resetPassword } from '../../../services/authService';
import { showDialog } from '../../../utils/dialogService';
import { safeRouter } from '../../../utils/safeRouter';

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

jest.mock('../../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

jest.mock('../../../utils/errorHelper', () => ({
  showErrorMessage: jest.fn(),
}));

jest.mock('../../../services/authService', () => ({
  requestOtp: jest.fn(async () => ({ referenceCode: 'REF123', expiresInMinutes: 5 })),
  verifyOtp: jest.fn(async () => ({ success: true })),
  resetPassword: jest.fn(async () => undefined),
}));

jest.mock('../../../hooks/useNavBarInset', () => ({
  useNavBarInset: () => 0,
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockedResetPassword = resetPassword as jest.Mock;
const mockedShowDialog = showDialog as jest.Mock;
const mockedSafeRouter = safeRouter as jest.Mocked<typeof safeRouter>;

describe('Auth extra screens', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({ signIn: jest.fn() });
    mockedUseLocalSearchParams.mockReturnValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders forgot password screen', () => {
    const { getByText, getByTestId } = renderWithProviders(<ForgotPasswordScreen />);

    expect(getByText('ลืมรหัสผ่าน')).toBeTruthy();
    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByTestId('send-otp-button')).toBeTruthy();
  });

  it('renders verify OTP screen', () => {
    mockedUseLocalSearchParams.mockReturnValue({
      email: 'test@example.com',
      referenceCode: 'REF123',
      expiresInMinutes: '5',
    });

    jest.useFakeTimers();
    const { getByText, getByTestId } = renderWithProviders(<VerifyOtpScreen />);

    expect(getByText('ยืนยันรหัส OTP')).toBeTruthy();
    expect(getByTestId('otp-input')).toBeTruthy();

    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders reset password screen', () => {
    mockedUseLocalSearchParams.mockReturnValue({
      email: 'test@example.com',
      code: '123456',
    });

    const { getByText, getByTestId } = renderWithProviders(<ResetPasswordScreen />);

    expect(getByText('ตั้งรหัสผ่านใหม่')).toBeTruthy();
    expect(getByTestId('newPassword-input')).toBeTruthy();
    expect(getByTestId('confirmPassword-input')).toBeTruthy();
  });

  it('renders success screen for reset password', () => {
    mockedUseLocalSearchParams.mockReturnValue({
      type: 'reset_password',
      token: 'token',
    });

    const { getByText, getByTestId } = renderWithProviders(<AuthSuccessScreen />);

    expect(getByText('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว')).toBeTruthy();
    expect(getByTestId('success-icon')).toBeTruthy();
  });

  it('redirects to forgot password when OTP expires on reset password screen', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      email: 'test@example.com',
      code: '123456',
    });
    mockedResetPassword.mockRejectedValueOnce({
      code: 'otp_expired',
      message: 'OTP expired',
    });

    const { getByTestId, getByText } = renderWithProviders(<ResetPasswordScreen />);

    fireEvent.changeText(getByTestId('newPassword-input'), 'Password1');
    fireEvent.changeText(getByTestId('confirmPassword-input'), 'Password1');
    fireEvent.press(getByText('บันทึกรหัสผ่านใหม่'));

    await waitFor(() => {
      expect(mockedShowDialog).toHaveBeenCalledWith(
        'รหัส OTP ใช้ไม่ได้แล้ว',
        'รหัส OTP หมดอายุหรือไม่ถูกต้อง กรุณาขอรหัสใหม่อีกครั้ง',
        [{ text: 'ตกลง', onPress: expect.any(Function) }],
      );
    });

    const dialogActions = mockedShowDialog.mock.calls[0]?.[2] as
      | { text: string; onPress?: () => void }[]
      | undefined;
    dialogActions?.[0]?.onPress?.();

    expect(mockedSafeRouter.replace).toHaveBeenCalledWith({
      pathname: '/(auth)/forgot-password',
      params: { email: 'test@example.com' },
    });
  });

  it('redirects to forgot password when OTP record is already missing', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      email: 'test@example.com',
      code: '123456',
    });
    mockedResetPassword.mockRejectedValueOnce({
      code: 'otp_not_found',
      message: 'ไม่พบรหัส OTP หรือรหัสหมดอายุแล้ว',
    });

    const { getByTestId, getByText } = renderWithProviders(<ResetPasswordScreen />);

    fireEvent.changeText(getByTestId('newPassword-input'), 'Password1');
    fireEvent.changeText(getByTestId('confirmPassword-input'), 'Password1');
    fireEvent.press(getByText('บันทึกรหัสผ่านใหม่'));

    await waitFor(() => {
      expect(mockedShowDialog).toHaveBeenCalledWith(
        'รหัส OTP ใช้ไม่ได้แล้ว',
        'รหัส OTP หมดอายุหรือไม่ถูกต้อง กรุณาขอรหัสใหม่อีกครั้ง',
        [{ text: 'ตกลง', onPress: expect.any(Function) }],
      );
    });

    const dialogActions = mockedShowDialog.mock.calls[0]?.[2] as
      | { text: string; onPress?: () => void }[]
      | undefined;
    dialogActions?.[0]?.onPress?.();

    expect(mockedSafeRouter.replace).toHaveBeenCalledWith({
      pathname: '/(auth)/forgot-password',
      params: { email: 'test@example.com' },
    });
  });

  it('redirects to forgot password when reset password only exposes status 422', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      email: 'test@example.com',
      code: '123456',
    });
    mockedResetPassword.mockRejectedValueOnce({
      status: 422,
      message: 'OTP has expired. Please request a new one.',
    });

    const { getByTestId, getByText } = renderWithProviders(<ResetPasswordScreen />);

    fireEvent.changeText(getByTestId('newPassword-input'), 'Password1');
    fireEvent.changeText(getByTestId('confirmPassword-input'), 'Password1');
    fireEvent.press(getByText('บันทึกรหัสผ่านใหม่'));

    await waitFor(() => {
      expect(mockedShowDialog).toHaveBeenCalledWith(
        'รหัส OTP ใช้ไม่ได้แล้ว',
        'รหัส OTP หมดอายุหรือไม่ถูกต้อง กรุณาขอรหัสใหม่อีกครั้ง',
        [{ text: 'ตกลง', onPress: expect.any(Function) }],
      );
    });

    const dialogActions = mockedShowDialog.mock.calls[0]?.[2] as
      | { text: string; onPress?: () => void }[]
      | undefined;
    dialogActions?.[0]?.onPress?.();

    expect(mockedSafeRouter.replace).toHaveBeenCalledWith({
      pathname: '/(auth)/forgot-password',
      params: { email: 'test@example.com' },
    });
  });
});
