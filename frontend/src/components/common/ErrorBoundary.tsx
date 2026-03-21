import React from 'react';
import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { logErrorToServer } from '../../api/errorLogs';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Log to backend error log table
    logErrorToServer({
      source: 'FRONTEND',
      severity: 'ERROR',
      errorType: error.name || 'ReactError',
      message: error.message,
      stackTrace: [error.stack, '\n--- Component Stack ---\n', errorInfo.componentStack].filter(Boolean).join(''),
      pageUrl: window.location.pathname,
      component: errorInfo.componentStack
        ? (errorInfo.componentStack.match(/at\s+(\w+)/)?.[1] || undefined)
        : undefined,
      userAgent: navigator.userAgent,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Stack align="center" justify="center" style={{ minHeight: '50vh', padding: 24 }}>
          <Alert
            color="red"
            icon={<IconAlertCircle size={24} />}
            title="Something went wrong"
            style={{ maxWidth: 600, width: '100%' }}
          >
            <Stack gap="sm">
              <Text size="sm">
                {this.state.error?.message || 'An unexpected error occurred.'}
              </Text>
              <Stack gap="xs" align="flex-start">
                <Button variant="light" color="red" size="xs" onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button variant="outline" color="red" size="xs" onClick={this.handleReload}>
                  Reload Page
                </Button>
              </Stack>
            </Stack>
          </Alert>
        </Stack>
      );
    }

    return this.props.children;
  }
}
