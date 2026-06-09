import React from 'react';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import SetupSavedSuccessScreen from '../../../app/(setup)/saved-success';

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Setup saved-success screen', () => {
  it('renders success content', () => {
    const { getByText } = renderWithProviders(<SetupSavedSuccessScreen />);

    expect(getByText('สำเร็จ!')).toBeTruthy();
    expect(getByText('กำลังเข้าสู่หน้าหลัก...')).toBeTruthy();
  });
});
