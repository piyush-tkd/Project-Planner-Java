import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  TextInput,
  PasswordInput,
  Button,
  Text,
  Title,
  Stack,
  Alert,
  Anchor,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../auth/AuthContext';

// Baylor Genetics brand colors from Figma OOPPv2
const DEEP_BLUE  = '#0C2340';
const AGUA       = '#1F9196';
const GREY_400   = '#9EA8B3';
const GREY_200   = '#E5E8EC';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch {
      setError('Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      fontFamily: 'Barlow, system-ui, sans-serif',
    }}>

      {/* ── Left panel: brand / logo ── */}
      <div style={{
        flex: '0 0 45%',
        backgroundColor: DEEP_BLUE,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
      }}>
        {/* Logo mark — teal triangle/arrow icon mimicking Baylor Genetics mark */}
        <svg width="52" height="48" viewBox="0 0 52 48" fill="none" style={{ marginBottom: 16 }}>
          <polygon points="26,0 52,48 0,48" fill="none" stroke={AGUA} strokeWidth="4" />
          <polygon points="26,10 44,44 8,44" fill={AGUA} opacity="0.25" />
        </svg>

        <Title
          order={1}
          style={{
            color: '#FFFFFF',
            fontFamily: 'Barlow, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: '0.04em',
            textAlign: 'center',
            lineHeight: 1.15,
          }}
        >
          ENGINEERING<br />PORTFOLIO<br />PLANNER
        </Title>

        <div style={{
          width: 48,
          height: 3,
          backgroundColor: AGUA,
          borderRadius: 2,
          marginTop: 24,
          marginBottom: 24,
        }} />

      </div>

      {/* ── Right panel: login form ── */}
      <div style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
      }}>
        <div style={{ width: '100%', maxWidth: 396 }}>

          <Title
            order={2}
            style={{
              color: DEEP_BLUE,
              fontFamily: 'Barlow, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 28,
              marginBottom: 6,
            }}
          >
            Welcome!
          </Title>

          <Text style={{
            color: GREY_400,
            fontSize: 14,
            fontFamily: 'Barlow, system-ui, sans-serif',
            marginBottom: 32,
          }}>
            Log in to manage your portfolio and view reports.
          </Text>

          {error && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="red"
              variant="light"
              mb="md"
              style={{ borderRadius: 8 }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Username"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.currentTarget.value)}
                required
                autoFocus
                autoComplete="username"
                styles={{
                  label: {
                    fontFamily: 'Barlow, system-ui, sans-serif',
                    fontWeight: 600,
                    fontSize: 13,
                    color: DEEP_BLUE,
                    marginBottom: 4,
                  },
                  input: {
                    fontFamily: 'Barlow, system-ui, sans-serif',
                    fontSize: 14,
                    borderColor: GREY_200,
                    borderRadius: 6,
                    height: 40,
                    '&:focus': { borderColor: AGUA },
                  },
                }}
              />

              <div>
                <PasswordInput
                  label="Password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.currentTarget.value)}
                  required
                  autoComplete="current-password"
                  styles={{
                    label: {
                      fontFamily: 'Barlow, system-ui, sans-serif',
                      fontWeight: 600,
                      fontSize: 13,
                      color: DEEP_BLUE,
                      marginBottom: 4,
                    },
                    input: {
                      fontFamily: 'Barlow, system-ui, sans-serif',
                      fontSize: 14,
                      borderColor: GREY_200,
                      borderRadius: 6,
                      height: 40,
                    },
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <Anchor
                    href="#"
                    style={{
                      fontSize: 13,
                      color: AGUA,
                      fontFamily: 'Barlow, system-ui, sans-serif',
                      textDecoration: 'none',
                    }}
                    onClick={e => e.preventDefault()}
                  >
                    Forgot password?
                  </Anchor>
                </div>
              </div>

              <Button
                type="submit"
                fullWidth
                loading={loading}
                disabled={!username || !password}
                style={{
                  backgroundColor: DEEP_BLUE,
                  borderRadius: 40,
                  height: 42,
                  fontFamily: 'Barlow, system-ui, sans-serif',
                  fontWeight: 600,
                  fontSize: 16,
                  letterSpacing: '0.01em',
                  border: 'none',
                  marginTop: 8,
                }}
              >
                Log In
              </Button>
            </Stack>
          </form>

        </div>
      </div>
    </div>
  );
}
