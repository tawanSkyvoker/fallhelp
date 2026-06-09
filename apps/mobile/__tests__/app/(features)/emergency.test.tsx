import React from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import EmergencyContactsScreen from '../../../app/(features)/(emergency)/contacts';
import AddEmergencyContactScreen from '../../../app/(features)/(emergency)/add';
import EditEmergencyContactScreen from '../../../app/(features)/(emergency)/edit';
import EmergencyCallScreen from '../../../app/(features)/(emergency)/call';
import { useLocalSearchParams } from 'expo-router';

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  const stableQueryResult = {
    data: [{ id: 'contact-1', name: 'Test Contact', phone: '0800000000', relationship: 'Child' }],
    isLoading: false,
    refetch: jest.fn(),
  };
  const stableMutationResult = {
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  };
  const stableQueryClient = {
    invalidateQueries: jest.fn(),
    getQueryData: jest.fn(() => [
      { id: 'contact-1', name: 'Test Contact', phone: '0800000000', relationship: 'Child' },
    ]),
    setQueryData: jest.fn(),
  };
  return {
    ...actual,
    useQuery: jest.fn(() => stableQueryResult),
    useMutation: jest.fn(() => stableMutationResult),
    useQueryClient: jest.fn(() => stableQueryClient),
  };
});

jest.mock('../../../hooks/useCurrentElder', () => ({
  useCurrentElder: () => ({
    data: { id: 'elder-1', accessLevel: 'OWNER' },
    isLoading: false,
  }),
}));

jest.mock('../../../hooks/useCurrentElder', () => ({
  useCurrentElder: () => ({
    data: { id: 'elder-1' },
  }),
}));

jest.mock('../../../hooks/useNavBarInset', () => ({
  useNavBarInset: () => 0,
}));

jest.mock('../../../hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({
    setHasChanges: jest.fn(),
    resetChanges: jest.fn(),
    modalProps: { visible: false },
  }),
}));

jest.mock('../../../components/ConfirmModal', () => ({
  ConfirmModal: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mockReact = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View: mockView } = require('react-native');
    return mockReact.createElement(mockView, { testID: 'confirm-modal' });
  },
}));

jest.mock('../../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

jest.mock('../../../utils/errorHelper', () => ({
  showErrorMessage: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;

describe('Emergency screens', () => {
  beforeEach(() => {
    mockedUseLocalSearchParams.mockReturnValue({ id: 'contact-1' });
  });

  it('renders emergency contacts screen', () => {
    const { getByText } = renderWithProviders(<EmergencyContactsScreen />);

    expect(getByText('จัดการเบอร์ติดต่อฉุกเฉิน')).toBeTruthy();
  });

  it('renders add emergency contact screen', () => {
    const { getByText } = renderWithProviders(<AddEmergencyContactScreen />);

    expect(getByText('เพิ่มเบอร์ติดต่อฉุกเฉิน')).toBeTruthy();
  });

  it('renders edit emergency contact screen', async () => {
    const { findByText } = renderWithProviders(<EditEmergencyContactScreen />);

    expect(await findByText('แก้ไขเบอร์ติดต่อฉุกเฉิน')).toBeTruthy();
  });

  it('renders emergency call screen', () => {
    const { getByText } = renderWithProviders(<EmergencyCallScreen />);

    expect(getByText('โทรฉุกเฉิน')).toBeTruthy();
  });
});
