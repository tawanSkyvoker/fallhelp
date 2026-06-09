import React from 'react';
import { View } from 'react-native';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import Step1ElderInfoScreen from '../../../app/(setup)/step1-elder-info';
const mockReact = React;
const mockView = View;

jest.mock('../../../services/elderService', () => ({
  createElder: jest.fn(async () => ({ id: 'elder-1' })),
  updateElder: jest.fn(async () => ({ id: 'elder-1' })),
  getElder: jest.fn(async () => null),
}));

jest.mock('../../../components/CascadingAddressPicker', () => ({
  CascadingAddressPicker: () =>
    mockReact.createElement(mockView, { testID: 'cascading-address-picker' }),
}));

jest.mock('../../../components/FloatingLabelDatePicker', () => ({
  FloatingLabelDatePicker: () => mockReact.createElement(mockView, { testID: 'date-picker' }),
}));

jest.mock('../../../components/LoadingScreen', () => ({
  LoadingScreen: () => mockReact.createElement(mockView, { testID: 'loading-screen' }),
}));

jest.mock('../../../components/GenderSelect', () => ({
  GenderSelect: () => mockReact.createElement(mockView, { testID: 'gender-select' }),
}));

jest.mock('../../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

jest.mock('../../../utils/errorHelper', () => ({
  showErrorMessage: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  debug: jest.fn(),
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

jest.mock('../../../hooks/useNavBarInset', () => ({
  useNavBarInset: () => 0,
}));

describe('Step1 (Elder Info)', () => {
  it('renders wizard title after load', async () => {
    const { findByText } = renderWithProviders(<Step1ElderInfoScreen />);

    expect(await findByText('ข้อมูลผู้สูงอายุ')).toBeTruthy();
  });
});
