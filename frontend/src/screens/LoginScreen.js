/** Login - role select (Super Admin / Admin) + username & password. */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { get, login, setSession } from '../api';
import { Btn, Field, C } from '../components/ui';

const ROLES = [
  { key: 'super_admin', label: 'Super Admin', icon: '🛡️' },
  { key: 'admin', label: 'Admin', icon: '👤' },
];

export default function LoginScreen({ nav }) {
  const [role, setRole] = useState('super_admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [serverOk, setServerOk] = useState(null);

  useEffect(() => {
    get('/health').then(() => setServerOk(true)).catch(() => setServerOk(false));
  }, []);

  async function doLogin() {
    if (!username.trim() || !password) {
      setErr('Enter your username and password.');
      return;
    }
    setBusy(true); setErr('');
    try {
      const r = await login(role, username.trim(), password);
      setSession({ ...r.user, must_change_password: r.must_change_password });
      if (r.must_change_password) {
        // Force the reset screen before any ERP access.
        nav.reset('resetPassword');
      } else {
        nav.reset('dashboard');
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'android' ? undefined : 'padding'}
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />

        <View style={s.header}>
          <View style={s.logoBadge}><Text style={s.logoText}>SV</Text></View>
          <Text style={s.title}>Sri Varahi ERP</Text>
          <Text style={s.sub}>Module 1 · Purchase, Inward & Auction</Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionLabel}>Sign in as</Text>
          <View style={s.roleRow}>
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[s.roleBtn, active && s.roleBtnActive]}
                  onPress={() => setRole(r.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={s.roleIcon}>{r.icon}</Text>
                  <Text style={[s.roleText, active && s.roleTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Field
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            required
            autoCapitalize="none"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secure
            required
          />

          {err ? (
            <View style={s.errBox}>
              <Text style={s.errIcon}>⚠</Text>
              <Text style={s.errText}>{err}</Text>
            </View>
          ) : null}

          <Btn
            title={busy ? 'Signing in…' : 'Login'}
            onPress={doLogin}
            disabled={busy}
            style={{ marginTop: 14 }}
          />

          <TouchableOpacity
            style={s.forgot}
            onPress={() => nav.push('forgotPassword')}
            accessibilityRole="button"
          >
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {serverOk === false && (
          <Text style={s.serverWarn}>⚠ Cannot reach the server. Check your connection.</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 30 },
  logoBadge: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center', elevation: 3, marginBottom: 14,
  },
  logoText: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 25, fontWeight: '800', color: C.primary, textAlign: 'center' },
  sub: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: C.border, elevation: 2,
  },
  sectionLabel: {
    fontSize: 12, color: C.muted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  roleBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: '#fafbfa', alignItems: 'center', paddingVertical: 12, gap: 4,
  },
  roleBtnActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  roleIcon: { fontSize: 20 },
  roleText: { fontSize: 13.5, fontWeight: '700', color: C.muted },
  roleTextActive: { color: C.primary },
  errBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.dangerBg, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#f5c6c0', marginTop: 4,
  },
  errIcon: { color: C.danger, fontSize: 15, fontWeight: '800' },
  errText: { color: C.danger, flex: 1, fontSize: 13, lineHeight: 18 },
  forgot: { alignItems: 'center', padding: 12, marginTop: 2 },
  forgotText: { color: C.accentDark, fontWeight: '700', fontSize: 14 },
  serverWarn: {
    color: C.danger, textAlign: 'center', marginTop: 14, fontSize: 13,
  },
});
