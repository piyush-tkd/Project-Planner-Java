import React from 'react';
import { Button, Stack, Text, Title, Group } from '@mantine/core';
import { IconRefresh, IconHome, IconBug } from '@tabler/icons-react';
import { logErrorToServer } from '../../api/errorLogs';
import { DEEP_BLUE, AQUA, DEEP_BLUE_TINTS, FONT_FAMILY, SHADOW } from '../../brandTokens';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const WITTY_MESSAGES = [
  "Well, that wasn't in the sprint plan.",
  "Houston, we have a problem.",
  "The bytes hit a bump in the road.",
  "Something tripped over its own code.",
  "Our hamster fell off the wheel.",
  "Looks like we divided by zero somewhere.",
  "The matrix had a hiccup.",
  "Oops. Even good code has bad days.",
];

function getWittyMessage() {
  return WITTY_MESSAGES[Math.floor(Math.random() * WITTY_MESSAGES.length)];
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private wittyMessage: string;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.wittyMessage = getWittyMessage();
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.wittyMessage = getWittyMessage();
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

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 32,
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            maxWidth: 480,
            width: '100%',
            textAlign: 'center',
          }}>
            {/* Animated broken-circuit icon */}
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${DEEP_BLUE} 0%, ${DEEP_BLUE_TINTS[80]} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: SHADOW.lg,
            }}>
              <IconBug size={36} color={AQUA} stroke={1.5} />
            </div>

            <Title order={2} style={{
              color: DEEP_BLUE,
              fontFamily: FONT_FAMILY,
              fontWeight: 300,
              fontSize: 28,
              marginBottom: 8,
            }}>
              {this.wittyMessage}
            </Title>

            <Text size="sm" c="dimmed" style={{
              fontFamily: FONT_FAMILY,
              marginBottom: 24,
              lineHeight: 1.6,
            }}>
              Something unexpected happened. The error has been logged and our team will look into it.
              In the meantime, you can try refreshing or head back to the dashboard.
            </Text>

            {/* Error detail — collapsible */}
            {this.state.error?.message && (
              <div style={{
                background: DEEP_BLUE_TINTS[10],
                borderRadius: 8,
                padding: '10px 16px',
                marginBottom: 24,
                textAlign: 'left',
              }}>
                <Text size="xs" ff="monospace" c={DEEP_BLUE_TINTS[70]} style={{ wordBreak: 'break-word' }}>
                  {this.state.error.message}
                </Text>
              </div>
            )}

            <Group justify="center" gap="sm">
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="filled"
                onClick={this.handleReset}
                style={{
                  backgroundColor: DEEP_BLUE,
                  fontFamily: FONT_FAMILY,
                  fontWeight: 500,
                }}
              >
                Try Again
              </Button>
              <Button
                leftSection={<IconHome size={16} />}
                variant="light"
                color="teal"
                onClick={this.handleGoHome}
                style={{ fontFamily: FONT_FAMILY }}
              >
                Dashboard
              </Button>
            </Group>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
