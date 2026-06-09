import React from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import NotificationsScreen from '../../../app/(features)/(notification)/notifications';
import ReportSummaryScreen from '../../../app/(features)/(report)/report-summary';
import { useQuery } from '@tanstack/react-query';

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(() => ({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })),
    useQueryClient: jest.fn(() => ({
      invalidateQueries: jest.fn(),
    })),
  };
});

jest.mock('../../../hooks/useCurrentElder', () => ({
  useCurrentElder: () => ({
    data: { id: 'elder-1', device: { id: 'device-1' } },
  }),
}));

jest.mock('../../../store/useFallAlertStore', () => ({
  useFallAlertStore: jest.fn((selector) =>
    selector({
      fallStatus: null,
      lastFallUpdate: null,
      activeFallEventId: null,
      setFallStatus: jest.fn(),
      setLastFallUpdate: jest.fn(),
      setActiveFallEventId: jest.fn(),
    }),
  ),
}));

jest.mock('../../../store/useDeviceSetupStore', () => ({
  useDeviceSetupStore: {
    getState: () => ({ setElderConfig: jest.fn() }),
  },
}));

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    back: jest.fn(),
  },
}));

describe('Monitoring screens', () => {
  it('renders notifications screen', () => {
    const mockedUseQuery = useQuery as jest.Mock;
    mockedUseQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { getByText } = renderWithProviders(<NotificationsScreen />);

    expect(getByText('ประวัติการแจ้งเตือน')).toBeTruthy();
  });

  it('renders report summary screen', () => {
    const mockedUseQuery = useQuery as jest.Mock;
    mockedUseQuery.mockReturnValueOnce({
      data: {
        month: 'มกราคม',
        year: 2567,
        peakTimeRange: '00:00 - 01:00 น.',
        totalFallEvents: 0,
        heartRateAnomalies: { high: 0, low: 0 },
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { getByText } = renderWithProviders(<ReportSummaryScreen />);

    expect(getByText('รายงานสรุปประจำเดือน')).toBeTruthy();
  });
});
