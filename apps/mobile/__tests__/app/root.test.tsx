import React from 'react';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import ModalScreen from '../../app/modal';
import NotFoundScreen from '../../app/+not-found';

describe('Misc screens', () => {
  it('renders modal screen', () => {
    const { getByText } = renderWithProviders(<ModalScreen />);

    expect(getByText('Modal')).toBeTruthy();
  });

  it('renders not found screen', () => {
    const { getByText } = renderWithProviders(<NotFoundScreen />);

    expect(getByText('ไม่พบหน้านี้')).toBeTruthy();
  });
});
