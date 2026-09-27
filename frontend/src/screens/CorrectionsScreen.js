/**
 * Post-Auction Corrections (supervisor/admin only).
 * Change customer / quantity / rate, transfer boxes between customers,
 * or split an allocation. Every action needs a reason (audit trail).
 */
import React, { useCallback, useState } from 'react';
import { Text, Alert, View, StyleSheet } from 'react-native';
import { get, patch, post } from '../api';
import { Card, Field, Picker, Btn, Screen, Row, C, lotSeq } from '../components/ui';

export default function CorrectionsScreen({ nav, params }) {
  const [lots, setLots] = useState(null);
  const [lotId, setLotId] = useState(null);
  const [lot, setLot] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [err, setErr] = useState('');

  const [sel, setSel] = useState(null); // selected allocation
  const [newQty, setNewQty] = useState('');
  const [newRate, setNewRate] = useState('');
  const [newCust, setNewCust] = useState(null);
  const [moveQty, setMoveQty] = useState('');
  const [moveCust, setMoveCust] = useState(null);
  const [reason, setReason] = useState('');

  const loadLots = useCallback(async () => {
    try { setLots(await get('/lots')); setErr(''); } catch (e) { setErr(e.message); }
  }, []);
  const loadLot = useCallback(async (id) => {
    try { setLot(await get(`/lots/${id}`)); setErr(''); } catch (e) { setErr(e.message); }
  }, []);

  React.useEffect(() => {
    loadLots();
    get('/customers').then(setCustomers).catch((e) => setErr('Customers could not be loaded: ' + e.message));
  }, []);
  React.useEffect(() => { if (lotId) loadLot(lotId); }, [lotId]);

  function pickAlloc(a) {
    setSel(a);
    setNewQty(String(Number(a.quantity)));
    setNewRate(String(Number(a.rate)));
    setNewCust(a.customer_id);
    setMoveQty(''); setMoveCust(null); setReason('');
  }

  async function applyCorrection() {
    if (!reason.trim()) { Alert.alert('Reason required', 'Every correction needs a reason for the audit trail.'); return; }
    try {
      const body = { reason };
      if (newCust !== sel.customer_id) body.customer_id = newCust;
      if (Number(newQty) !== Number(sel.quantity)) body.quantity = Number(newQty);
      if (Number(newRate) !== Number(sel.rate)) body.rate = Number(newRate);
      if (Object.keys(body).length === 1) { Alert.alert('No change', 'Nothing to correct.'); return; }
      await patch(`/allocations/${sel.id}`, body);
      Alert.alert('Corrected ✓', 'Totals, Billing and Cashier updated automatically.');
      setSel(null); loadLot(lotId); loadLots();
    } catch (e) { Alert.alert('Rejected', e.message); }
  }

  async function applyTransfer() {
    if (!reason.trim()) { Alert.alert('Reason required', 'Every correction needs a reason for the audit trail.'); return; }
    try {
      await post(`/allocations/${sel.id}/transfer`, {
        to_customer_id: moveCust, quantity: Number(moveQty), reason,
      });
      Alert.alert('Transferred ✓', 'Billing and Cashier updated automatically.');
      setSel(null); loadLot(lotId); loadLots();
    } catch (e) { Alert.alert('Rejected', e.message); }
  }

  async function applySplit() {
    if (!reason.trim()) { Alert.alert('Reason required', 'Every correction needs a reason for the audit trail.'); return; }
    try {
      await post(`/allocations/${sel.id}/split`, {
        to_customer_id: moveCust, quantity: Number(moveQty), reason,
      });
      Alert.alert('Split ✓', 'New allocation created; Billing and Cashier updated.');
      setSel(null); loadLot(lotId); loadLots();
    } catch (e) { Alert.alert('Rejected', e.message); }
  }

  return (
    <Screen title="Post-Auction Corrections" onBack={nav.pop} error={err}>
      <Card>
        <Picker label="Lot" items={lots || []} selectedId={lotId} onSelect={setLotId}
          placeholder="Select lot…" renderLabel={(l) => `${lotSeq(l.lot_number)} · ${l.party_name || ''}`} />
      </Card>

      {lot && (
        <>
          <Card>
            <Row label="Total / Pre-Auc / Alloc" value={`${Number(lot.total_quantity)} / ${Number(lot.pre_auction_quantity)} / ${Number(lot.allocated_quantity)}`} />
            <Row label="Remaining" value={Number(lot.remaining_quantity)} strong />
          </Card>

          {lot.allocations.map((a) => (
            <Card key={a.id} style={sel && sel.id === a.id ? { borderWidth: 2, borderColor: C.accent } : {}}>
              <Row label={`${a.customer_name} · ${a.status}`} value={`${Number(a.quantity)} @ ₹${Number(a.rate)} = ₹${Number(a.quantity) * Number(a.rate)}`} strong />
              <Btn title="Correct this allocation" onPress={() => pickAlloc(a)} kind={sel && sel.id === a.id ? 'accent' : 'secondary'} />
            </Card>
          ))}
          {lot.allocations.length === 0 && <Text style={s.muted}>No allocations on this lot.</Text>}

          {sel && (
            <Card>
              <Text style={s.t}>Correct · {sel.customer_name}</Text>
              <Field label="New quantity (damage etc.)" value={newQty} onChangeText={setNewQty} keyboard="numeric" />
              <Field label="New rate (₹)" value={newRate} onChangeText={setNewRate} keyboard="numeric" />
              <Picker label="Change customer to" items={customers} selectedId={newCust} onSelect={setNewCust} />

              <Text style={s.t2}>Move boxes to another customer</Text>
              <Field label="Quantity to move / split" value={moveQty} onChangeText={setMoveQty} keyboard="numeric" />
              <Picker label="Target customer" items={customers} selectedId={moveCust} onSelect={setMoveCust} />

              <Field label="Reason (required - audit trail) *" value={reason} onChangeText={setReason} placeholder="e.g. damage after auction" />

              <Btn title="✓ Apply Correction (qty / rate / customer)" onPress={applyCorrection}
                disabled={!(Number(newQty) > 0) || !(Number(newRate) >= 0) || !reason.trim()} />
              <Btn title="⇄ Transfer boxes (same rate)" onPress={applyTransfer}
                disabled={!(Number(moveQty) > 0) || !moveCust || !reason.trim()} />
              <Btn title="⑃ Split to new customer (same rate)" onPress={applySplit}
                disabled={!(Number(moveQty) > 0) || !moveCust || !reason.trim()} />
              <Btn title="Cancel" kind="danger" onPress={() => setSel(null)} />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  t: { fontWeight: '700', marginBottom: 6 },
  t2: { fontWeight: '700', marginTop: 10, marginBottom: 4, fontSize: 14 },
  muted: { color: C.muted, textAlign: 'center' },
});
