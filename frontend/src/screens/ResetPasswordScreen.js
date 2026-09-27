/** Forced password reset - first login of a newly created Admin. */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { changePassword, getSession, setSession } from '../api';
import { Btn, Field, Screen, C } from '../components/ui';

export default function ResetPasswordScreen({ nav }) {
  const user = getSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (!current || !next || !confirm) { setErr('Fill in all fields.'); return; }
    if (next !== confirm) { setErr('New password and confirmation do not match.'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      setSession({ ...user, must_change_password: false });
      nav.reset('dashboard'); // normal ERP access after reset
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Reset Password" error={err}>
      <View style={s.card}>
        <Text style={s.icon}>🔐</Text>
        <Text style={s.headline}>Welcome, {user ? user.name : ''}!</Text>
        <Text style={s.body}>
          For security you must set a new password before using the ERP.
          Your account currently uses the default password.
        </Text>
      </View>

      <View style={s.formCard}>
        <Field label="Current password (default)" value={current} onChangeText={setCurrent} secure required />
        <Field label="New password" value={next} onChangeText={setNext} secure required />
        <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secure required />
        <Text style={s.hint}>
          Minimum 8 characters with at least one letter and one number.
        </Text>
        <Btn title={busy ? 'Saving…' : 'Set new password'} onPress={submit} disabled={busy} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.primaryLight, borderRadius: 12, padding: 18,
    alignItems: 'center', borderWidth: 1, borderColor: '#cfe4d1', marginBottom: 12,
  },
  icon: { fontSize: 34, marginBottom: 8 },
  headline: { fontSize: 18, fontWeight: '800', color: C.primary, marginBottom: 6 },
  body: { fontSize: 13.5, color: C.text, textAlign: 'center', lineHeight: 20 },
  formCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border, elevation: 1,
  },
  hint: { color: C.muted, fontSize: 12, marginTop: -4, marginBottom: 8, lineHeight: 16 },
});
