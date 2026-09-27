/** User Creation (Super Admin only) - create Admin users with the default password. */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { ScrollView } from 'react-native';
import { createAdminUser, listAdminUsers } from '../api';
import { Btn, Field, Card, Screen, C, SectionTitle, Badge, Empty } from '../components/ui';

const ROLE_TONE = { super_admin: 'warning', admin: 'success' };

export default function UserCreationScreen({ nav }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [users, setUsers] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setUsers(await listAdminUsers()); } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  async function submit() {
    setErr(''); setOkMsg('');
    if (!username.trim() || !name.trim()) { setErr('Username and full name are required.'); return; }
    if (!phone.trim() && !email.trim()) {
      setErr('Provide a phone number or an email (needed for password recovery).');
      return;
    }
    setBusy(true);
    try {
      await createAdminUser({
        username: username.trim(),
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      setOkMsg(`User "${username.trim()}" created. Default password: pass@123 — they must set a new password on first login.`);
      setUsername(''); setName(''); setPhone(''); setEmail('');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="User Creation" onBack={nav.pop} error={err}>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 44 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
      >
        <Card>
          <SectionTitle>New Admin user</SectionTitle>
          <Field label="Username" value={username} onChangeText={setUsername} placeholder="e.g. ravi.kumar" required />
          <Field label="Full name" value={name} onChangeText={setName} placeholder="e.g. Ravi Kumar" required />
          <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="Registered phone for OTP" keyboard="phone-pad" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="Registered email for OTP" keyboard="email-address" />
          <Text style={s.note}>
            The new user gets the default password{' '}
            <Text style={s.bold}>pass@123</Text> and must change it at first login.
          </Text>
          <Btn title={busy ? 'Creating…' : 'Create user'} onPress={submit} disabled={busy} />
          {!!okMsg && (
            <View style={s.okBox}>
              <Text style={s.okText}>✓ {okMsg}</Text>
            </View>
          )}
        </Card>

        <SectionTitle>Existing users</SectionTitle>
        <Card>
          {!users && <Text style={s.muted}>Loading…</Text>}
          {users && users.length === 0 && <Empty>No users yet.</Empty>}
          {users && users.map((u) => (
            <View key={u.id} style={s.userRow}>
              <View style={s.userMain}>
                <Text style={s.userName}>{u.name}{u.username ? ` (${u.username})` : ''}</Text>
                <Text style={s.userSub} numberOfLines={1}>
                  {[u.phone, u.email].filter(Boolean).join(' · ') || 'no contact registered'}
                </Text>
              </View>
              <Badge tone={ROLE_TONE[u.role] || 'neutral'}>{u.role.replace('_', ' ')}</Badge>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  note: { color: C.muted, fontSize: 12.5, lineHeight: 18, marginBottom: 8 },
  bold: { fontWeight: '800', color: C.primary },
  okBox: {
    backgroundColor: C.primaryLight, borderRadius: 10, padding: 12,
    marginTop: 12, borderWidth: 1, borderColor: '#cfe4d1',
  },
  okText: { color: C.primary, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  muted: { color: C.muted },
  userRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f2ee',
  },
  userMain: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: C.text },
  userSub: { fontSize: 12, color: C.muted, marginTop: 2 },
});
