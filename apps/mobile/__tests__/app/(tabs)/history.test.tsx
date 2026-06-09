import React from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import HistoryScreen, { filterVisibleHistoryEvents } from '../../../app/(tabs)/history';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

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

jest.mock('../../../hooks/useCurrentElder', () => ({
  useCurrentElder: () => ({
    data: { id: 'elder-1', device: { id: 'device-1' } },
    isLoading: false,
  }),
}));

jest.mock('../../../store/useDeviceSetupStore', () => ({
  useDeviceSetupStore: {
    getState: () => ({ setElderConfig: jest.fn() }),
  },
}));

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(() => ({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
      isError: false,
    })),
  };
});

const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockedUseQuery = useQuery as jest.Mock;

describe('HistoryScreen', () => {
  beforeEach(() => {
    mockedUseLocalSearchParams.mockReturnValue({});
    mockedUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
      isError: false,
    });
  });

  it('renders history header', () => {
    const { getByText } = renderWithProviders(<HistoryScreen />);

    expect(getByText('ประวัติเหตุการณ์')).toBeTruthy();
  });

  it('renders only confirmed fall events in history list', () => {
    mockedUseQuery.mockReturnValue({
      data: [
        {
          id: 'event-confirmed',
          elderId: 'elder-1',
          deviceId: 'device-1',
          fallStage: 'CONFIRMED',
          timestamp: '2026-04-14T03:30:00.000Z',
          bpm: 108,
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
      isError: false,
    });

    const { getAllByText, queryByText } = renderWithProviders(<HistoryScreen />);

    expect(getAllByText('ตรวจพบเหตุหกล้ม').length).toBe(1);
    expect(queryByText('ไม่มีประวัติเหตุการณ์ผิดปกติ')).toBeNull();
  });

  it('filters out pending events and keeps confirmed/cancelled history', () => {
    const result = filterVisibleHistoryEvents([
      {
        id: 'event-confirmed',
        elderId: 'elder-1',
        deviceId: 'device-1',
        fallStage: 'CONFIRMED',
        timestamp: '2026-04-14T03:30:00.000Z',
        bpm: 108,
      } as never,
      {
        id: 'event-pending',
        elderId: 'elder-1',
        deviceId: 'device-1',
        fallStage: 'PENDING_CONFIRMATION',
        timestamp: '2026-04-14T03:20:00.000Z',
      } as never,
      {
        id: 'event-cancelled',
        elderId: 'elder-1',
        deviceId: 'device-1',
        fallStage: 'CANCELLED',
        timestamp: '2026-04-14T03:10:00.000Z',
        cancelledAt: '2026-04-14T03:10:10.000Z',
      } as never,
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('event-confirmed');
    expect(result[1]?.id).toBe('event-cancelled');
  });
});
