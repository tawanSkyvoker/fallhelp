import React from 'react';
import { View } from 'react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import RegisterScreen from '../../../app/(auth)/register';
const mockReact = React;
const mockView = View;

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
  register: jest.fn(async () => ({ token: 'token' })),
}));

jest.mock('../../../components/GenderSelect', () => ({
  GenderSelect: () => mockReact.createElement(mockView, { testID: 'gender-select' }),
}));

jest.mock('../../../components/PasswordStrengthIndicator', () => ({
  PasswordStrengthIndicator: () =>
    mockReact.createElement(mockView, { testID: 'password-strength' }),
}));

jest.mock('../../../hooks/useNavBarInset', () => ({
  useNavBarInset: () => 0,
}));

describe('RegisterScreen', () => {
  it('renders registration form and submit button', () => {
    const { getByTestId, getAllByText } = renderWithProviders(<RegisterScreen />);

    expect(getByTestId('firstName-input')).toBeTruthy();
    expect(getByTestId('lastName-input')).toBeTruthy();
    expect(getByTestId('phone-input')).toBeTruthy();
    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByTestId('password-input')).toBeTruthy();
    expect(getByTestId('register-button')).toBeTruthy();
    expect(getAllByText('ลงทะเบียน').length).toBeGreaterThan(0);
  });
});
