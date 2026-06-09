import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import ElderInfoScreen from '../../../app/(features)/(elder)/elder-info';
import EditElderInfoScreen from '../../../app/(features)/(elder)/edit';

jest.mock('../../../hooks/useNavBarInset', () => ({
  useNavBarInset: () => 0,
}));

const mockElder = {
  id: 'elder-1',
  firstName: 'Test',
  lastName: 'User',
  accessLevel: 'OWNER',
  dateOfBirth: '2000-01-01',
};

const mockElderResult = {
  data: mockElder,
  isLoading: false,
  isFetched: true,
  isError: false,
  refetch: jest.fn(),
};
const mockReact = React;
const mockView = View;

jest.mock('../../../hooks/useCurrentElder', () => ({
  useCurrentElder: () => mockElderResult,
}));

jest.mock('../../../components/CascadingAddressPicker', () => ({
  CascadingAddressPicker: () =>
    mockReact.createElement(mockView, { testID: 'cascading-address-picker' }),
}));

jest.mock('../../../components/FloatingLabelDatePicker', () => ({
  FloatingLabelDatePicker: () => mockReact.createElement(mockView, { testID: 'date-picker' }),
}));

jest.mock('../../../components/GenderSelect', () => ({
  GenderSelect: () => mockReact.createElement(mockView, { testID: 'gender-select' }),
}));

jest.mock('../../../components/ConfirmModal', () => ({
  ConfirmModal: () => mockReact.createElement(mockView, { testID: 'confirm-modal' }),
}));

jest.mock('../../../hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({
    setHasChanges: jest.fn(),
    resetChanges: jest.fn(),
    modalProps: { visible: false },
  }),
}));

jest.mock('../../../services/elderService', () => ({
  getElder: jest.fn(async () => mockElder),
  updateElder: jest.fn(async () => ({ id: 'elder-1' })),
}));

jest.mock('../../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

jest.mock('../../../utils/errorHelper', () => ({
  showErrorMessage: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

describe('Elder screens', () => {
  const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;

  beforeEach(() => {
    mockedUseLocalSearchParams.mockReturnValue({ elderId: 'elder-1' });
  });

  it('renders elder info screen', async () => {
    const { findByText } = renderWithProviders(<ElderInfoScreen />);

    expect(await findByText('ข้อมูลผู้สูงอายุ')).toBeTruthy();
  });

  it('renders edit elder screen', async () => {
    const { findByText } = renderWithProviders(<EditElderInfoScreen />);

    expect(await findByText('แก้ไขข้อมูลผู้สูงอายุ')).toBeTruthy();
  });
});
