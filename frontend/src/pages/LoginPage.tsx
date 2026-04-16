import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
 TextInput,
 PasswordInput,
 Button,
 Text,
 Title,
 Stack,
 Alert,
 Divider,
} from '@mantine/core';
import { useComputedColorScheme } from '@mantine/core';
import { IconAlertCircle, IconClockOff, IconShield } from '@tabler/icons-react';
import { useAuth } from '../auth/AuthContext';
import apiClient from '../api/client';
import {
 DEEP_BLUE, DEEP_BLUE_HEX, AQUA, AQUA_HEX, DEEP_BLUE_TINTS, SURFACE_FAINT,
 FONT_FAMILY, SHADOW,
} from '../brandTokens';

const PROVIDER_LABELS: Record<string, string> = {
 GOOGLE:    'Google Workspace',
 MICROSOFT: 'Microsoft Entra ID',
 OKTA:      'Okta',
 CUSTOM:    'SSO',
};

export default function LoginPage() {
 const { login } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const isDark = useComputedColorScheme('light') === 'dark';

 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 // SSO availability — fetched from the public /api/auth/sso-status endpoint
 const [ssoEnabled,   setSsoEnabled]   = useState(false);
 const [ssoProvider,  setSsoProvider]  = useState('SSO');

 useEffect(() => {
   apiClient.get('/auth/sso-status')
     .then(({ data }) => {
       setSsoEnabled(data.enabled ?? false);
       setSsoProvider(PROVIDER_LABELS[data.provider] ?? 'SSO');
     })
     .catch(() => { /* SSO status unavailable — suppress silently */ });
 }, []);

 const locationState = location.state as { from?: { pathname: string }; expired?: boolean } | null;
 const from    = locationState?.from?.pathname ?? '/';
 const expired = !!locationState?.expired;

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
 fontFamily: FONT_FAMILY,
 }}>

 {/* ── Left panel: brand / logo ── */}
 <div style={{
 flex: '0 0 45%',
 backgroundColor: DEEP_BLUE_HEX,
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 justifyContent: 'center',
 padding: '48px',
 position: 'relative',
 overflow: 'hidden',
 }}>
 {/* Subtle decorative gradient overlay */}
 <div style={{
 position: 'absolute',
 inset: 0,
 background: `radial-gradient(ellipse at 30% 40%, rgba(45,204,211,0.08) 0%, transparent 70%)`,
 pointerEvents: 'none',
 }} />

 {/* Logo mark — Aqua triangle, fully opaque stroke + fill */}
 <svg width="60" height="56" viewBox="0 0 52 48" fill="none" style={{ marginBottom: 20, position: 'relative', filter: `drop-shadow(0 0 12px ${AQUA_HEX}88)` }}>
   <polygon points="26,0 52,48 0,48" fill="none" stroke={AQUA_HEX} strokeWidth="3.5" />
   <polygon points="26,10 44,44 8,44" fill={AQUA_HEX} opacity="0.35" />
 </svg>

 {/* Title — use explicit inline style with !important equivalent via direct string */}
 <div style={{
   color: '#FFFFFF',
   fontFamily: FONT_FAMILY,
   fontWeight: 300,
   fontSize: 34,
   letterSpacing: '0.1em',
   textAlign: 'center',
   lineHeight: 1.25,
   position: 'relative',
   textShadow: `0 0 32px ${AQUA_HEX}44`,
   userSelect: 'none',
 }}>
   ENGINEERING<br />PORTFOLIO<br />PLANNER
 </div>

 <div style={{
   width: 56,
   height: 3,
   background: `linear-gradient(90deg, transparent, ${AQUA_HEX}, transparent)`,
   borderRadius: 2,
   marginTop: 24,
   marginBottom: 24,
   position: 'relative',
 }} />

 </div>

 {/* ── Right panel: login form ── */}
 <div className="login-form-panel" style={{
 flex: 1,
 backgroundColor: isDark ? 'rgba(26,29,39,0.95)' : '#FFFFFF',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 padding: '48px',
 }}>
 <div style={{ width: '100%', maxWidth: 396 }}>

 <Title
 order={2}
 style={{
 color: isDark ? '#ffffff' : DEEP_BLUE,
 fontFamily: FONT_FAMILY,
 fontWeight: 300,
 fontSize: 32,
 marginBottom: 6,
 }}
 >
 Welcome
 </Title>

 <Text style={{
 color: isDark ? 'rgba(255,255,255,0.7)' : DEEP_BLUE_TINTS[50],
 fontSize: 14,
 fontFamily: FONT_FAMILY,
 marginBottom: 32,
 }}>
 Log in to manage your portfolio and view reports.
 </Text>

 {expired && (
 <Alert
 icon={<IconClockOff size={16} />}
 color="orange"
 variant="light"
 mb="md"
 style={{ borderRadius: 8 }}
 >
 Your session has expired. Please sign in again.
 </Alert>
 )}

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
 fontFamily: FONT_FAMILY,
 fontWeight: 500,
 fontSize: 13,
 color: isDark ? 'rgba(255,255,255,0.85)' : DEEP_BLUE,
 marginBottom: 4,
 },
 input: {
 fontFamily: FONT_FAMILY,
 fontSize: 14,
 backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
 borderColor: isDark ? 'rgba(255,255,255,0.12)' : DEEP_BLUE_TINTS[10],
 color: isDark ? '#fff' : undefined,
 borderRadius: 6,
 height: 42,
 '&:focus': { borderColor: AQUA },
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
 fontFamily: FONT_FAMILY,
 fontWeight: 500,
 fontSize: 13,
 color: isDark ? 'rgba(255,255,255,0.85)' : DEEP_BLUE,
 marginBottom: 4,
 },
 input: {
 fontFamily: FONT_FAMILY,
 fontSize: 14,
 backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
 borderColor: isDark ? 'rgba(255,255,255,0.12)' : DEEP_BLUE_TINTS[10],
 color: isDark ? '#fff' : undefined,
 borderRadius: 6,
 height: 42,
 },
 }}
 />
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
 <Link
 to="/forgot-password"
 style={{
 fontSize: 13,
 color: isDark ? '#4ecca9' : AQUA,
 fontFamily: FONT_FAMILY,
 textDecoration: 'none',
 }}
 >
 Forgot password?
 </Link>
 </div>
 </div>

 <button
 type="submit"
 className="login-submit-btn"
 disabled={loading}
 style={{
   width: '100%',
   backgroundColor: (!username || !password) ? '#4a6080' : DEEP_BLUE_HEX,
   color: '#ffffff',
   borderRadius: 6,
   height: 44,
   fontFamily: FONT_FAMILY,
   fontWeight: 500,
   fontSize: 16,
   letterSpacing: '0.01em',
   border: 'none',
   marginTop: 8,
   boxShadow: SHADOW.sm,
   cursor: (!username || !password) ? 'not-allowed' : 'pointer',
   opacity: loading ? 0.7 : 1,
   transition: 'background-color 0.2s ease',
 }}
 >
 {loading ? 'Signing in…' : 'Log In'}
 </button>

 {ssoEnabled && (
   <>
     <Divider
       label="or"
       labelPosition="center"
       my="xs"
       styles={{ label: { color: isDark ? 'rgba(255,255,255,0.4)' : DEEP_BLUE_TINTS[40], fontFamily: FONT_FAMILY, fontSize: 12 } }}
     />
     <Button
       component="a"
       href="/oauth2/authorization/sso"
       fullWidth
       variant="outline"
       leftSection={<IconShield size={16} />}
       style={{
         borderColor: isDark ? 'rgba(255,255,255,0.2)' : DEEP_BLUE_TINTS[20],
         color: isDark ? '#fff' : DEEP_BLUE,
         borderRadius: 6,
         height: 44,
         fontFamily: FONT_FAMILY,
         fontWeight: 500,
         fontSize: 15,
       }}
     >
       Sign in with {ssoProvider}
     </Button>
   </>
 )}

 </Stack>
 </form>

 </div>
 </div>
 </div>
 );
}
