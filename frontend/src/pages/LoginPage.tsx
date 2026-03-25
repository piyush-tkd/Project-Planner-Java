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
import {
 DEEP_BLUE, AQUA, AQUA_TINTS, DEEP_BLUE_TINTS,
 FONT_FAMILY, SHADOW,
} from '../brandTokens';

export default function LoginPage() {
 const { login } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();

 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

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
 fontFamily: FONT_FAMILY,
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

 {/* Logo mark — Aqua triangle */}
 <svg width="52" height="48" viewBox="0 0 52 48" fill="none" style={{ marginBottom: 16, position: 'relative' }}>
 <polygon points="26,0 52,48 0,48" fill="none" stroke={AQUA} strokeWidth="4" />
 <polygon points="26,10 44,44 8,44" fill={AQUA} opacity="0.25" />
 </svg>

 <Title
 order={1}
 style={{
 color: '#FFFFFF',
 fontFamily: FONT_FAMILY,
 fontWeight: 300,
 fontSize: 36,
 letterSpacing: '0.04em',
 textAlign: 'center',
 lineHeight: 1.1,
 position: 'relative',
 }}
 >
 ENGINEERING<br />PORTFOLIO<br />PLANNER
 </Title>

 <div style={{
 width: 48,
 height: 3,
 backgroundColor: AQUA,
 borderRadius: 2,
 marginTop: 24,
 marginBottom: 24,
 position: 'relative',
 }} />

 <Text style={{
 color: AQUA_TINTS[50],
 fontSize: 13,
 fontFamily: FONT_FAMILY,
 textAlign: 'center',
 position: 'relative',
 letterSpacing: '0.02em',
 }}>
 Baylor Genetics
 </Text>
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
 fontFamily: FONT_FAMILY,
 fontWeight: 300,
 fontSize: 32,
 marginBottom: 6,
 }}
 >
 Welcome
 </Title>

 <Text style={{
 color: DEEP_BLUE_TINTS[50],
 fontSize: 14,
 fontFamily: FONT_FAMILY,
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
 fontFamily: FONT_FAMILY,
 fontWeight: 500,
 fontSize: 13,
 color: DEEP_BLUE,
 marginBottom: 4,
 },
 input: {
 fontFamily: FONT_FAMILY,
 fontSize: 14,
 borderColor: DEEP_BLUE_TINTS[10],
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
 color: DEEP_BLUE,
 marginBottom: 4,
 },
 input: {
 fontFamily: FONT_FAMILY,
 fontSize: 14,
 borderColor: DEEP_BLUE_TINTS[10],
 borderRadius: 6,
 height: 42,
 },
 }}
 />
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
 <Anchor
 href="#"
 style={{
 fontSize: 13,
 color: AQUA,
 fontFamily: FONT_FAMILY,
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
 borderRadius: 6,
 height: 44,
 fontFamily: FONT_FAMILY,
 fontWeight: 500,
 fontSize: 16,
 letterSpacing: '0.01em',
 border: 'none',
 marginTop: 8,
 boxShadow: SHADOW.sm,
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
