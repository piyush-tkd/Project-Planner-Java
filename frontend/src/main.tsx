import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Notifications, notifications } from '@mantine/notifications';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AuthProvider } from './auth/AuthContext';
import App from './App';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

// Baylor Genetics / OOPPv2 design tokens (from Figma)
// Deep Blue 500: #0C2340  |  Agua 700: #1F9196  |  Font: Barlow
const theme = createTheme({
  primaryColor: 'deepBlue',
  fontFamily: 'Barlow, system-ui, sans-serif',
  headings: { fontFamily: 'Barlow, system-ui, sans-serif' },
  colors: {
    // Deep Blue scale — 500 = index 8 = #0C2340
    deepBlue: [
      '#E8ECF2',
      '#C6CEDB',
      '#A4AFC4',
      '#8191AD',
      '#5F7296',
      '#3D537F',
      '#1B3468',
      '#0F2550',
      '#0C2340',
      '#081A30',
    ] as unknown as [string,string,string,string,string,string,string,string,string,string],
    // Agua (teal) scale — 700 = index 5 = #1F9196
    agua: [
      '#E0F5F5',
      '#B3E6E8',
      '#80D4D7',
      '#4DC2C6',
      '#26B0B5',
      '#1F9196',
      '#1A7A7E',
      '#156366',
      '#0F4C4E',
      '#0A3536',
    ] as unknown as [string,string,string,string,string,string,string,string,string,string],
  },
  components: {
    Button: {
      defaultProps: { radius: 'xl' },
      styles: { root: { fontWeight: 600 } },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
  mutationCache: new MutationCache({
    onError: (error) => {
      notifications.show({
        title: 'Operation Failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
        color: 'red',
        autoClose: 5000,
      });
    },
  }),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  </React.StrictMode>
);
