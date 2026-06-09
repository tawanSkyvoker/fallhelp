import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

export const renderWithProviders = (ui: React.ReactElement, options?: RenderOptions) => {
  const queryClient = makeQueryClient();
  const settings = { icon: () => null };

  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <PaperProvider settings={settings}>{ui}</PaperProvider>
      </SafeAreaProvider>
    </QueryClientProvider>,
    options,
  );
};
