/**
 * DRILL-DOWN detail page: the records behind one Vehicle-wise or Source-wise
 * dashboard total. Opened via nav.push('drillDown', { type: 'vehicle'|'source', key }).
 * Each record taps through to the Lot Detail screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { get } from '../api';
import { Card, Row, Screen, C, Loading, Empty, Badge, lotSeq } from '../components/ui';

export default function DrillDownScreen({ nav, params }) {
  const { type, key } = params;
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  const title = type === 'vehicle' ? `Vehicle ${key}` : `${String(key || '').replace(/_/g, ' ')} — source details`;

  const load = useCallback(async () => {
    try {
      const q = type === 'vehicle'
        ? `/inwards?vehicle=${encodeURIComponent(key)}`
        : `/inwards?source=${encodeURIComponent(key)}`;
      setRows(await get(q));
      setErr('');
    } catch (e) { setErr(e.message); }
  }, [type, key]);

  useEffect(() => { load(); }, [load]);

  const totalBoxes = (rows || []).reduce((s, r) => s + Number(r.quantity || 0), 0);

  return (
    <Screen title={title} onBack={nav.pop} error={err}>
      {!rows && <Loading label="Loading details…" />}
      {rows && (
        <>
          <Card style={s.summary}>
            <Row label="Records" value={`${rows.length}`} />
            <Row label="Total boxes" value={`${totalBoxes}`} strong />
            <Badge tone="neutral">{type === 'vehicle' ? 'Vehicle-wise (today)' : 'Source-wise (today)'}</Badge>
          </Card>

          {rows.map((i) => (
            <Card key={i.id}>
              <TouchableOpacity activeOpacity={0.7}
                onPress={() => nav.push('lotDetail', { lotId: i.lot_id || i.id })}
                accessibilityRole="button" accessibilityLabel={`Open lot ${lotSeq(i.lot_number)}`}>
                <Row label={`Lot ${lotSeq(i.lot_number)}`} value={`${Number(i.quantity)} boxes`} strong />
                <Row label="Party" value={i.party_name || '-'} />
                <Row label="Vehicle" value={i.vehicle_number || '-'} />
                <Row label="Driver" value={i.driver_name || '-'} />
                {type === 'vehicle' && <Row label="Source" value={String(i.purchase_source || '-').replace(/_/g, ' ')} />}
                {type === 'source' && <Row label="Quality" value={i.quality || '-'} />}
                {i.purchase_rate != null && <Row label="Purchase rate" value={`₹${Number(i.purchase_rate)}`} />}
                {i.final_rate != null && <Row label="Final rate" value={`₹${Number(i.final_rate)}`} />}
                <Text style={s.tapHint}>Tap to open lot ›</Text>
              </TouchableOpacity>
            </Card>
          ))}

          {rows.length === 0 && <Empty>No records found for this {type === 'vehicle' ? 'vehicle' : 'source'} today.</Empty>}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  summary: { borderLeftWidth: 4, borderLeftColor: C.accent },
  tapHint: { color: C.accentDark, fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'right' },
});
