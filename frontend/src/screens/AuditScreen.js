/**
 * Audit / History - full trail of controlled actions.
 * FILTERS: free search, date picker, action type, user, newest/oldest sort.
 */
import React, { useMemo, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { get } from '../api';
import {
  Card, Screen, Row, Chip, C, Empty,
  Toolbar, ToolInput, DateField, SortToggle, ToolCount, ClearFilters,
} from '../components/ui';

export default function AuditScreen({ nav }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  const [q, setQ] = useState('');
  const [dateF, setDateF] = useState('');
  const [actionF, setActionF] = useState('all');
  const [userF, setUserF] = useState('all');
  const [sort, setSort] = useState('newest');

  function clearFilters() {
    setQ('');
    setDateF('');
    setActionF('all');
    setUserF('all');
    setSort('newest');
  }

  // The selected date is filtered by the server, so older days are not cut off by the limit.
  React.useEffect(() => {
    const q = dateF ? `&date=${encodeURIComponent(dateF)}` : '';
    get(`/audit?limit=200${q}`).then((r) => { setRows(r); setErr(''); }).catch((e) => setErr(e.message));
  }, [dateF]);

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
    if (text) {
      const hay = [`${a.entity} #${a.entity_id}`, a.action, a.reason, a.changed_by_name]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  }).sort((a, b) => {
    const da = new Date(a.created_at || 0), db = new Date(b.created_at || 0);
    return sort === 'newest' ? db - da : da - db;
  });

  return (
    <Screen
      title="Audit / History"
      nav={nav}
      onBack={nav.pop}
      error={err}
      toolbar={(
        <Toolbar trailing={<ClearFilters onPress={clearFilters} />}>
          <ToolInput value={q} onChangeText={setQ} placeholder="Search history" />
          <DateField value={dateF} onChange={setDateF} />
          {actions.map((a) => (
            <Chip key={a} label={a === 'all' ? 'All actions' : a.replace(/_/g, ' ')}
              active={actionF === a} onPress={() => setActionF(a)} />
          ))}
          {users.length > 2 && users.map((u) => (
            <Chip key={u} label={u === 'all' ? 'All users' : u}
              active={userF === u} onPress={() => setUserF(u)} />
          ))}
          <SortToggle value={sort} onChange={setSort} />
          <ToolCount shown={filtered.length} total={(rows || []).length} />
        </Toolbar>
      )}
    >
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
});
