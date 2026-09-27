/**
 * User Management (Super Admin only).
 *  - search users by full name, username or phone
 *  - users listed in an aligned table (Full Name · Username · Role · Phone · Status)
 *  - header "+" opens the Create User popup (role + default password)
 *  - tap a user to open the details popup: status and module access
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, TouchableOpacity, Switch, Modal, ScrollView,
} from 'react-native';
import { createAdminUser, listAdminUsers, listRoles, updateUser, getSession } from '../api';
import {
  Btn, Field, Screen, C, Badge, Empty, Dropdown, Toolbar, ToolInput, ToolCount, ClearFilters,
} from '../components/ui';
import { GRANTABLE_MODULES } from '../modules';

/** Display name of a user's role, as returned from the Role master. */
const roleNameOf = (u) => (u && (u.role_name || u.role)) || '—';

const COLUMNS = [
  { key: 'name', title: 'Full Name', flex: 1.5, minWidth: 140 },
  { key: 'username', title: 'Username', flex: 1.2, minWidth: 110 },
  { key: 'role', title: 'Role', flex: 1, minWidth: 104 },
  { key: 'phone', title: 'Phone', flex: 1.1, minWidth: 110 },
  { key: 'status', title: 'Status', flex: 0.9, minWidth: 88 },
];
const TABLE_MIN_WIDTH = COLUMNS.reduce((sum, c) => sum + c.minWidth, 0) + 24;

export default function UserCreationScreen({ nav }) {
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [roles, setRoles] = useState([]);

  const me = getSession();
  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: String(r.id), label: r.role_name })),
    [roles],
  );

  const loadRoles = useCallback(async () => {
    try { setRoles(await listRoles()); } catch (e) { setErr(e.message); }
  }, []);

  const load = useCallback(async () => {
    try { setUsers(await listAdminUsers()); } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  const shown = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    if (!q) return users;
    const digits = q.replace(/\D/g, '');
    return users.filter((u) =>
      (u.name || '').toLowerCase().includes(q)
      || (u.username || '').toLowerCase().includes(q)
      || (u.phone || '').toLowerCase().includes(q)
      || (!!digits && (u.phone || '').replace(/\D/g, '').includes(digits)));
  }, [users, search]);

  async function onCreated(user) {
    setCreateOpen(false);
    setOkMsg(`${roleNameOf(user)} "${user.username}" created. Default password: pass@123 — they must set a new password on first login.`);
    await load();
  }

  function onUpdated(updated) {
    setUsers((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    setSelected(updated);
  }

  const toolbar = (
    <Toolbar>
      <ToolInput value={search} onChangeText={setSearch} placeholder="Search name, username, phone" />
      {users ? <ToolCount shown={shown.length} total={users.length} /> : null}
      {search ? <ClearFilters onPress={() => setSearch('')} /> : null}
    </Toolbar>
  );

  return (
    <Screen
      title="User Management"
      nav={nav}
      onBack={nav.pop}
      error={err}
      toolbar={toolbar}
      headerAction={{ label: 'Create User', showLabel: true, onPress: () => { setErr(''); loadRoles(); setCreateOpen(true); }, testID: 'header-create-user' }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 44 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
      >
        {!!okMsg && (
          <TouchableOpacity style={s.okBox} onPress={() => setOkMsg('')} accessibilityRole="button" accessibilityLabel="Dismiss message">
            <Text style={s.okText}>✓ {okMsg}</Text>
            <Text style={s.okClose}>✕</Text>
          </TouchableOpacity>
        )}

        <View style={s.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ flex: 1, minWidth: TABLE_MIN_WIDTH }}>
              <View style={[s.tr, s.thead]}>
                {COLUMNS.map((c) => (
                  <Text key={c.key} style={[s.th, { flex: c.flex, minWidth: c.minWidth }]} numberOfLines={1}>{c.title}</Text>
                ))}
              </View>

              {!users && <Text style={s.muted}>Loading…</Text>}
              {users && users.length === 0 && <Empty>No users yet. Tap ＋ Create User to add one.</Empty>}
              {users && users.length > 0 && shown.length === 0 && <Empty>No users match “{search.trim()}”.</Empty>}

              {shown.map((u, i) => (
                <TouchableOpacity
                  key={u.id}
                  style={[s.tr, i % 2 === 1 && s.trAlt]}
                  onPress={() => setSelected(u)}
                  accessibilityRole="button"
                  accessibilityLabel={`${u.name}, ${roleNameOf(u)}, ${u.active ? 'Active' : 'Inactive'}`}
                >
                  <Text style={[s.td, s.tdName, col(0)]} numberOfLines={1}>{u.name}</Text>
                  <Text style={[s.td, col(1)]} numberOfLines={1}>{u.username || '—'}</Text>
                  <View style={[s.tdCell, col(2)]}>
                    <Badge tone="warning">{roleNameOf(u)}</Badge>
                  </View>
                  <Text style={[s.td, col(3)]} numberOfLines={1}>{u.phone || '—'}</Text>
                  <View style={[s.tdCell, col(4)]}>
                    <Badge tone={u.active ? 'success' : 'danger'}>{u.active ? 'Active' : 'Inactive'}</Badge>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
        {users && users.length > 0 && (
          <Text style={s.listHint}>Tap a user to view details, status and module access.</Text>
        )}
      </ScrollView>

      <CreateUserModal
        visible={createOpen}
        roleOptions={roleOptions}
        onClose={() => setCreateOpen(false)}
        onCreated={onCreated}
      />
      <UserDetailsModal
        user={selected}
        isMe={!!(me && selected && me.id === selected.id)}
        onClose={() => setSelected(null)}
        onUpdated={onUpdated}
      />
    </Screen>
  );
}

const col = (i) => ({ flex: COLUMNS[i].flex, minWidth: COLUMNS[i].minWidth });

/* ---------- Popup shell ---------- */

function Popup({ visible, title, onClose, children, footer }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.popup}>
          <View style={s.popHead}>
            <Text style={s.popTitle} numberOfLines={1}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={s.popClose} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={s.popCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.popBody} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={s.popFoot}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Create User ---------- */

function CreateUserModal({ visible, roleOptions, onClose, onCreated }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (visible) {
      setUsername(''); setName(''); setPhone(''); setEmail(''); setErr('');
      setRole(roleOptions[0] ? roleOptions[0].value : '');
    }
    // reset only when the popup opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible && !role && roleOptions[0]) setRole(roleOptions[0].value);
  }, [visible, role, roleOptions]);

  async function submit() {
    setErr('');
    if (!username.trim() || !name.trim()) { setErr('Username and full name are required.'); return; }
    if (!role) { setErr('Select a role.'); return; }
    if (!phone.trim() && !email.trim()) {
      setErr('Provide a phone number or an email (needed for password recovery).');
      return;
    }
    setBusy(true);
    try {
      const created = await createAdminUser({
        username: username.trim(),
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        role_id: role,
      });
      await onCreated(created);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popup
      visible={visible}
      title="Create User"
      onClose={onClose}
      footer={(
        <>
          <Btn title="Cancel" kind="secondary" onPress={onClose} style={s.footBtn} />
          <Btn title={busy ? 'Creating…' : 'Create User'} onPress={submit} disabled={busy} style={s.footBtn} />
        </>
      )}
    >
      {!!err && <Text style={s.popErr}>⚠ {err}</Text>}
      <Field label="Full name" value={name} onChangeText={setName} placeholder="e.g. Ravi Kumar" required />
      <Field label="Username" value={username} onChangeText={setUsername} placeholder="e.g. ravi.kumar" required />
      <Dropdown label="Role" options={roleOptions} value={role} onChange={setRole} required />
      <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="Registered phone for OTP" keyboard="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="Registered email for OTP" keyboard="email-address" />
      <Text style={s.note}>
        The new user gets the default password{' '}
        <Text style={s.bold}>pass@123</Text> and must change it at first login.
      </Text>
    </Popup>
  );
}

/* ---------- User details ---------- */

function UserDetailsModal({ user, isMe, onClose, onUpdated }) {
  const [draftActive, setDraftActive] = useState(true);
  const [draftModules, setDraftModules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const userId = user ? user.id : null;
  useEffect(() => {
    if (!user) return;
    setDraftActive(!!user.active);
    setDraftModules((user.modules || []).filter((m) => GRANTABLE_MODULES.some((g) => g.key === m)));
    setErr(''); setSavedMsg('');
    // re-seed only when a different user is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function toggleModule(key) {
    setSavedMsg('');
    setDraftModules((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  async function save() {
    setSaving(true); setErr(''); setSavedMsg('');
    try {
      const changes = { modules: draftModules };
      if (draftActive !== !!user.active) changes.active = draftActive;
      const updated = await updateUser(user.id, changes);
      onUpdated(updated);
      setSavedMsg('Changes saved.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;
  return (
    <Popup
      visible
      title="User Details"
      onClose={onClose}
      footer={(
        <>
          <Btn title="Close" kind="secondary" onPress={onClose} style={s.footBtn} />
          <Btn title={saving ? 'Saving…' : 'Save Changes'} onPress={save} disabled={saving} style={s.footBtn} />
        </>
      )}
    >
      {!!err && <Text style={s.popErr}>⚠ {err}</Text>}
      {!!savedMsg && <Text style={s.savedText}>✓ {savedMsg}</Text>}

      <View style={s.infoGrid}>
        <Info label="Full Name" value={user.name} />
        <Info label="Username" value={user.username} />
        <Info label="Role" value={<Badge tone="warning">{roleNameOf(user)}</Badge>} />
        <Info label="Phone" value={user.phone} />
        <Info label="Email" value={user.email} last />
      </View>

      <Text style={s.modHead}>STATUS</Text>
      <View style={s.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.switchLabel}>{draftActive ? 'Active' : 'Inactive'}</Text>
          <Text style={[s.switchSub, { color: draftActive ? C.primary : C.tomato }]}>
            {draftActive ? 'Can sign in' : 'Sign-in blocked'}
          </Text>
        </View>
        <Switch
          value={draftActive}
          onValueChange={(v) => { setSavedMsg(''); setDraftActive(v); }}
          disabled={isMe}
          trackColor={{ false: '#e6c4bd', true: '#a9cf9b' }}
          thumbColor={draftActive ? C.primary : C.tomato}
          accessibilityLabel="Active status"
        />
      </View>
      {isMe && <Text style={s.selfNote}>You cannot deactivate your own account.</Text>}

      <View style={s.modHeadRow}>
        <Text style={s.modHead}>MODULE PERMISSIONS</Text>
        <Text style={s.modCount}>{draftModules.length} of {GRANTABLE_MODULES.length} enabled</Text>
      </View>
      {user.role === 'super_admin' && (
        <Text style={s.selfNote}>Super Admins always keep User Management.</Text>
      )}
      {GRANTABLE_MODULES.map((m) => {
        const on = draftModules.includes(m.key);
        return (
          <View key={m.key} style={s.modRow}>
            <Text style={s.modIcon}>{m.icon}</Text>
            <Text style={[s.modTitle, !on && s.modTitleOff]}>{m.title}</Text>
            <Switch
              value={on}
              onValueChange={() => toggleModule(m.key)}
              trackColor={{ false: '#dfe2dc', true: '#a9cf9b' }}
              thumbColor={on ? C.primary : '#f4f4f2'}
              accessibilityLabel={`${m.title} access`}
            />
          </View>
        );
      })}
    </Popup>
  );
}

function Info({ label, value, last }) {
  return (
    <View style={[s.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={s.infoLabel}>{label}</Text>
      <View style={s.infoValueWrap}>
        {typeof value === 'string' || value == null
          ? <Text style={s.infoValue} numberOfLines={2}>{value || '—'}</Text>
          : value}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  okBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: C.primaryLight, borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#cfe4d1',
  },
  okText: { flex: 1, color: C.primary, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  okClose: { color: C.primary, fontSize: 14, fontWeight: '800' },
  muted: { color: C.muted, padding: 14 },
  listHint: { color: C.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },

  tableCard: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', elevation: 1,
  },
  tr: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 48,
    borderBottomWidth: 1, borderBottomColor: '#eef0ec',
  },
  trAlt: { backgroundColor: '#fafbfa' },
  thead: { backgroundColor: C.primaryLight, minHeight: 40, borderBottomColor: '#cfe4d1' },
  th: {
    fontSize: 11, fontWeight: '800', color: C.primaryDark, letterSpacing: 0.6,
    textTransform: 'uppercase', paddingRight: 10,
  },
  td: { fontSize: 13.5, color: C.text, paddingRight: 10 },
  tdName: { fontWeight: '700' },
  tdCell: { paddingRight: 10, alignItems: 'flex-start' },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 18,
  },
  popup: {
    width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: '#fff',
    borderRadius: 14, overflow: 'hidden', elevation: 8,
  },
  popHead: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  popTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '800' },
  popClose: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  popCloseText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  popBody: { flexGrow: 0 },
  popFoot: {
    flexDirection: 'row', gap: 10, padding: 12,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: '#fafbfa',
  },
  footBtn: { flex: 1, marginTop: 0 },
  popErr: {
    color: C.danger, backgroundColor: C.dangerBg, borderRadius: 8, padding: 10,
    fontSize: 13, fontWeight: '600', marginBottom: 12,
  },
  note: { color: C.muted, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  bold: { fontWeight: '800', color: C.primary },

  infoGrid: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#eef0ec',
  },
  infoLabel: { width: 96, fontSize: 12, fontWeight: '700', color: C.muted },
  infoValueWrap: { flex: 1, alignItems: 'flex-start' },
  infoValue: { fontSize: 14, fontWeight: '600', color: C.text },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  switchSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  selfNote: { fontSize: 11.5, color: C.muted, marginTop: 4 },
  modHeadRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  modHead: {
    fontSize: 11, fontWeight: '800', color: C.accentDark, letterSpacing: 1,
    marginTop: 18, marginBottom: 6,
  },
  modCount: { fontSize: 12, color: C.muted },
  modRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#eef0ec',
  },
  modIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  modTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  modTitleOff: { color: C.muted },
  savedText: {
    color: C.primary, backgroundColor: C.primaryLight, borderRadius: 8, padding: 10,
    fontWeight: '700', fontSize: 13, marginBottom: 12,
  },
});
