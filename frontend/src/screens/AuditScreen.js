/**
 * Audit / History - full trail of controlled actions.
 * FILTERS: free search (entity #id / action / reason / user), date,
 * action type and user - all combine and update the list live.
 */
import React, { useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { get } from '../api';
import { Card, Screen, Row, Field, Chip, SectionTitle, C, Empty } from '../components/ui';

export default function AuditScreen({ nav }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  // filters
  const [q, setQ] = useState('');
  const [dateF, setDateF] = useState('');
  const [actionF, setActionF] = useState('all');
  const [userF, setUserF] = useState('all');

  React.useEffect(() => { get('/audit?limit=200').then(setRows).catch((e) => setErr(e.message)); }, []);

  const actions = useMemo(
    () => ['all', ...Array.from(new Set((rows || []).map((r) => r.action))).sort()],
    [rows]
  );
  const users = useMemo(
    () => ['all', ...Array.from(new Set((rows || []).map((r) => r.changed_by_name).filter(Boolean))).sort()],
    [rows]
  );

  const text = q.trim().toLowerCase();
  const filtered = (rows || []).filter((a) => {
    if (actionF !== 'all' && a.action !== actionF) return false;
    if (userF !== 'all' && a.changed_by_name !== userF) return false;
    if (dateF && (a.created_at || '').slice(0, 10) !== dateF.trim()) return false;
    if (text) {
      const hay = [`${a.entity} #${a.entity_id}`, a.action, a.reason, a.changed_by_name]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });

  return (
    <Screen title="Audit / History" nav={nav} onBack={nav.pop} error={err}>
      <Card>
        <SectionTitle>Filter History</SectionTitle>
        <Field label="Search (record / action / reason / user)" value={q} onChangeText={setQ} placeholder="e.g. bill #6 / payment" />
        <Field label="Date (YYYY-MM-DD)" value={dateF} onChangeText={setDateF} placeholder="e.g. 2026-09-27" />
        <Text style={s.filterLabel}>Action type</Text>
        <View style={s.chipRow}>
          {actions.map((a) => (
            <Chip key={a} label={a === 'all' ? 'All' : a.replace(/_/g, ' ')}
              active={actionF === a} onPress={() => setActionF(a)} />
          ))}
        </View>
        {users.length > 2 && (
          <>
            <Text style={s.filterLabel}>User</Text>
            <View style={s.chipRow}>
              {users.map((u) => (
                <Chip key={u} label={u === 'all' ? 'All' : u}
                  active={userF === u} onPress={() => setUserF(u)} />
              ))}
            </View>
          </>
        )}
        <Text style={s.filterInfo}>{filtered.length} of {(rows || []).length} entries shown</Text>
      </Card>

      {filtered.map((a) => (
        <Card key={a.id}>
          <Row label={`${a.entity} #${a.entity_id}`} value={a.action} strong />
          <Row label="When" value={new Date(a.created_at).toLocaleString()} />
          {a.changed_by_name && <Row label="By" value={a.changed_by_name} />}
          {a.reason ? <Row label="Reason" value={a.reason} /> : null}
          {a.old_data && a.new_data ? (
            <Text style={s.diff} numberOfLines={4}>
              {JSON.stringify(a.old_data)}  →  {JSON.stringify(a.new_data)}
            </Text>
          ) : null}
        </Card>
      ))}
      {rows && filtered.length === 0 && <Empty>No audit entries match the current filters.</Empty>}
      {rows && rows.length === 0 && <Empty>No audit entries yet.</Empty>}
    </Screen>
  );
}

const s = StyleSheet.create({
  diff: { fontSize: 11, color: C.muted, marginTop: 6, backgroundColor: '#fafafa', padding: 6, borderRadius: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  filterLabel: { fontSize: 13, color: C.text, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  filterInfo: { fontSize: 12, color: C.muted, marginTop: 10 },
});
