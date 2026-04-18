import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme, mergeThemeOverrides } from '@mantine/core';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Notifications, notifications } from '@mantine/notifications';
import ErrorBoundary from './components/common/ErrorBoundary';
import { logErrorToServer } from './api/errorLogs';
import { AuthProvider } from './auth/AuthContext';
import { OrgSettingsProvider } from './context/OrgSettingsContext';
import { FavoritesProvider } from './context/FavoritesContext';
import App from './App';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import './global.css';
import './styles/microinteractions.css';

import {
  DEEP_BLUE_HEX, AQUA_HEX, FONT_FAMILY,
  DEEP_BLUE_TINTS, AQUA_TINTS, LEGACY_BLUE_TINTS,
} from './brandTokens';
import { slateTheme } from './theme/slate';  // S3.1 — wire Slate design system

/**
 * Baylor Genetics — Brand Design Tokens (v01.1)
 * Slate design system is layered as the base; brand tokens extend it.
 *
 * Primary:   Deep Blue #0C2340  |  Aqua #2DCCD3
 * Font:      DIN Next LT Pro / Arial fallback
 */
const brandTheme = createTheme({
  primaryColor: 'aqua',        // Wrike-style teal CTA buttons + focus rings
  fontFamily: FONT_FAMILY,
  headings: {
    fontFamily: FONT_FAMILY,
    sizes: {
      // Wrike-style compact headings — bold, not oversized
      h1: { fontSize: '22px', lineHeight: '1.3', fontWeight: '700' },
      h2: { fontSize: '18px', lineHeight: '1.3', fontWeight: '700' },
      h3: { fontSize: '15px', lineHeight: '1.4', fontWeight: '600' },
      h4: { fontSize: '13px', lineHeight: '1.4', fontWeight: '600' },
    },
  },
  colors: {
    // Deep Blue — primary brand colour
    deepBlue: [
      DEEP_BLUE_TINTS[10],  // 0  #E7E9EC
      DEEP_BLUE_TINTS[20],  // 1  #CED3D9
      DEEP_BLUE_TINTS[30],  // 2  #B6BDC6
      DEEP_BLUE_TINTS[40],  // 3  #9EA7B3
      DEEP_BLUE_TINTS[50],  // 4  #85919F
      DEEP_BLUE_TINTS[60],  // 5  #6D7B8C
      DEEP_BLUE_TINTS[70],  // 6  #556579
      DEEP_BLUE_TINTS[80],  // 7  #3D4F66
      DEEP_BLUE_HEX,        // 8  #0C2340
      '#081A30',            // 9  darker
    ] as unknown as [string,string,string,string,string,string,string,string,string,string],

    // Aqua — accent / teal (#2DCCD3)
    aqua: [
      AQUA_TINTS[10],  // 0  #EAFAFB
      AQUA_TINTS[20],  // 1  #D5F5F6
      AQUA_TINTS[30],  // 2  #C0F0F2
      AQUA_TINTS[40],  // 3  #ABEBED
      AQUA_TINTS[50],  // 4  #96E5E9
      AQUA_TINTS[60],  // 5  #81E0E5
      AQUA_TINTS[70],  // 6  #6CDBE0
      AQUA_TINTS[80],  // 7  #57D6DC
      AQUA_HEX,        // 8  #2DCCD3
      '#25ADB3',       // 9  darker
    ] as unknown as [string,string,string,string,string,string,string,string,string,string],

    // Legacy Blue — secondary
    legacyBlue: [
      LEGACY_BLUE_TINTS[10],  // 0
      LEGACY_BLUE_TINTS[20],  // 1
      LEGACY_BLUE_TINTS[30],  // 2
      LEGACY_BLUE_TINTS[40],  // 3
      LEGACY_BLUE_TINTS[50],  // 4
      LEGACY_BLUE_TINTS[60],  // 5
      LEGACY_BLUE_TINTS[70],  // 6
      LEGACY_BLUE_TINTS[80],  // 7
      '#002F6C',              // 8
      '#002050',              // 9
    ] as unknown as [string,string,string,string,string,string,string,string,string,string],
  },
  defaultRadius: 'sm',
  components: {
    Button: {
      defaultProps: { radius: 'md' },
      styles: { root: { fontWeight: 600, letterSpacing: '0.01em' } },
    },
    Modal: {
      // keepMounted:false prevents Mantine from leaving 12+ empty portal shells in the DOM
      defaultProps: { size: 'xl', radius: 'md', keepMounted: false },
    },
    Card: {
      defaultProps: { radius: 'md', shadow: 'sm', withBorder: true },
      styles: {
        root: {
          borderColor: DEEP_BLUE_TINTS[10],   // static hex — fine for Mantine theme registration
          transition: 'box-shadow 200ms ease, transform 200ms ease',
        },
      },
    },
    Paper: {
      defaultProps: { radius: 'md' },
    },
    TextInput: {
      defaultProps: { radius: 'sm' },
      styles: { label: { fontWeight: 500, marginBottom: 4 } },
    },
    PasswordInput: {
      defaultProps: { radius: 'sm' },
      styles: { label: { fontWeight: 500, marginBottom: 4 } },
    },
    Select: {
      defaultProps: { radius: 'sm' },
      styles: { label: { fontWeight: 500, marginBottom: 4 } },
    },
    Table: {
      styles: {
        thead: { fontWeight: 700 },
      },
    },
    Notification: {
      defaultProps: { radius: 'md' },
    },
  },
});

// S3.1 — Merge slate as base layer; brand tokens override where they overlap
const theme = mergeThemeOverrides(slateTheme, brandTheme);

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

// ── Global error capture: unhandled JS errors + promise rejections ──
// Suppress harmless ResizeObserver loop errors (browser noise, not real bugs)
const SUPPRESSED_ERRORS = [
  'ResizeObserver loop',
  'ResizeObserver loop completed with undelivered notifications',
];

window.addEventListener('error', (event) => {
  // Skip harmless browser-internal errors
  if (SUPPRESSED_ERRORS.some(s => event.message?.includes(s))) return;

  logErrorToServer({
    source: 'FRONTEND',
    severity: 'ERROR',
    errorType: event.error?.name || 'UncaughtError',
    message: event.message || 'Unhandled error',
    stackTrace: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
    pageUrl: window.location.pathname,
    userAgent: navigator.userAgent,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  // Skip logging API errors — those are already captured by the axios interceptor
  if (reason?.message?.includes('error-logs')) return;
  logErrorToServer({
    source: 'FRONTEND',
    severity: 'ERROR',
    errorType: 'UnhandledRejection',
    message: reason?.message || String(reason),
    stackTrace: reason?.stack || undefined,
    pageUrl: window.location.pathname,
    userAgent: navigator.userAgent,
  });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <OrgSettingsProvider>
              <FavoritesProvider>
                <ErrorBoundary>
                  <App />
                </ErrorBoundary>
              </FavoritesProvider>
            </OrgSettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  </React.StrictMode>
);
