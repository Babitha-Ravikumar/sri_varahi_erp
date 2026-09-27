/** Audit / History - full trail of controlled corrections. */
import React, { useState } from 'react';
import { Text } from 'react-native';
import { get } from '../api';
import { Card, Screen, Row, C } from '../components/ui';

export default function AuditScreen({ nav }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  React.useEffect(() => { get('/audit?limit=100').then(setRows).catch((e) => setErr(e.message)); }, []);

  return (
    <Screen title="Audit / History" onBack={nav.pop} error={err}>
      {(rows || []).map((a) => (
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
      {rows && rows.length === 0 && <Text style={{ textAlign: 'center', color: C.muted }}>No audit entries yet.</Text>}
    </Screen>
  );
}

const s = {
  diff: { fontSize: 11, color: C.muted, marginTop: 6, backgroundColor: '#fafafa', padding: 6, borderRadius: 4 },
};
