import React from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import LoginScreen from '../../../app/(auth)/login';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
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
  login: jest.fn(async () => ({ token: 'token', user: { role: 'CAREGIVER' } })),
}));

jest.mock('../../../hooks/useNavBarInset', () => ({
  useNavBarInset: () => 0,
}));

describe('LoginScreen', () => {
  it('renders login form fields and button', () => {
    const { getByTestId, getByText } = renderWithProviders(<LoginScreen />);

    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByTestId('password-input')).toBeTruthy();
    expect(getByTestId('login-button')).toBeTruthy();
    expect(getByText('เข้าสู่ระบบ')).toBeTruthy();
  });
});
