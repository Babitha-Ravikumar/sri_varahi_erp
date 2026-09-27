/**
 * Lot / Lot Card screen: everything linked to the lot identity.
 * Also handles night-arrival actions: sell at predetermined price,
 * and fixing the morning final rate (supervisor/admin).
 */
import React, { useCallback, useState } from 'react';
import { Text, Alert } from 'react-native';
import { get, post } from '../api';
import { Card, Field, Btn, Screen, Row, C, lotSeq } from '../components/ui';

export default function LotDetailScreen({ nav, params }) {
  const [lot, setLot] = useState(null);
  const [err, setErr] = useState('');
  const [rate, setRate] = useState('');
  // night-sale form
  const [custName, setCustName] = useState('');
  const [custQty, setCustQty] = useState('');

  const listMode = params.list;

  const load = useCallback(async (id) => {
    try { setLot(await get(`/lots/${id}`)); setErr(''); }
    catch (e) { setErr(e.message); }
  }, []);

  const [lots, setLots] = useState(null);
  const loadList = useCallback(async () => {
    try { setLots(await get('/lots')); setErr(''); } catch (e) { setErr(e.message); }
  }, []);

  React.useEffect(() => {
    if (listMode) loadList();
    else if (params.lotId) load(params.lotId);
  }, [params.lotId]);

  if (listMode) {
    return (
      <Screen title="Lots" onBack={nav.pop} error={err}>
        {(lots || []).map((l) => (
          <Card key={l.id}>
            <Row label={lotSeq(l.lot_number)} value={l.status} strong />
            <Row label="Vehicle / Party" value={`${l.vehicle_number || '-'} · ${l.party_name || '-'}`} />
            <Row label="Quality" value={l.quality || '-'} />
            <Row label="Total / Remaining" value={`${Number(l.total_quantity)} / ${Number(l.remaining_quantity)}`} />
            <Btn title="Open" kind="secondary" onPress={() => nav.push('lotDetail', { lotId: l.id })} />
          </Card>
        ))}
        {lots && lots.length === 0 && <Text style={{ textAlign: 'center', color: C.muted }}>No lots yet.</Text>}
      </Screen>
    );
  }

  if (!lot) return <Screen title="Lot" onBack={nav.pop} error={err} />;

  const isNight = lot.purchase_source === 'night_arrival';

  async function sellNight() {
    try {
      const r = await post(`/lots/${lot.id}/pre-auction`, {
        customer_name: custName, quantity: Number(custQty), rate: Number(lot.selling_price),
      });
      Alert.alert('Sold ✓', `${custQty} boxes @ ₹${Number(lot.selling_price)} to ${r.customer.name}. Remaining ${Number(r.lot.remaining_quantity)}.`);
      setCustName(''); setCustQty('');
      load(lot.id);
    } catch (e) { setErr(e.message); }
  }

  async function fixFinalRate() {
    try {
      const r = await post(`/inwards/${lot.inward_id || lot.id}/final-rate`, { final_rate: Number(rate) });
      Alert.alert('Final rate fixed ✓', `Trade margin: ₹${Number(r.trade_margin)}`);
      setRate('');
      load(lot.id);
    } catch (e) { setErr(e.message); }
  }

  return (
    <Screen title={`Lot ${lotSeq(lot.lot_number)}`} onBack={nav.pop} error={err}>
      <Card>
        <Text style={s.t}>LOT CARD {lotSeq(lot.card_code)}</Text>
        <Row label="Vehicle" value={lot.vehicle_number || '-'} />
        {lot.vehicle_number && lot.driver_name ? <Row label="Driver" value={lot.driver_name} /> : null}
        <Row label="Supplier / Party" value={lot.party_name || '-'} />
        <Row label="Source" value={lot.purchase_source.replace(/_/g, ' ')} />
        <Row label="Quality" value={lot.quality || '-'} />
        <Row label="Total Quantity" value={`${Number(lot.total_quantity)} boxes`} strong />
        <Row label="Pre-Auction" value={`${Number(lot.pre_auction_quantity)} boxes`} />
        <Row label="Allocated" value={`${Number(lot.allocated_quantity)} boxes`} />
        <Row label="REMAINING" value={`${Number(lot.remaining_quantity)} boxes`} strong />
      </Card>

      {isNight && !lot.final_rate && (
        <Card>
          <Text style={s.t}>Night sale (predetermined ₹{Number(lot.selling_price)}/box)</Text>
          <Field label="Customer name" value={custName} onChangeText={setCustName} placeholder="e.g. Ramesh" />
          <Field label="Quantity" value={custQty} onChangeText={setCustQty} keyboard="numeric" />
          <Btn title="Sell" kind="accent" onPress={sellNight} disabled={!custName.trim() || !(Number(custQty) > 0)} />
        </Card>
      )}

      {isNight && !lot.final_rate && (
        <Card>
          <Text style={s.t}>Morning: fix final purchase rate</Text>
          <Field label="Final rate (₹/box)" value={rate} onChangeText={setRate} keyboard="numeric" />
          <Btn title="Fix Final Rate & Compute Margin" onPress={fixFinalRate} disabled={!(Number(rate) >= 0)} />
          <Text style={s.hint}>Applies to the SAME inward - no duplicate entry. Supervisor/Admin only.</Text>
        </Card>
      )}
      {isNight && lot.final_rate != null && (
        <Card>
          <Row label="Final rate" value={`₹${Number(lot.final_rate)}`} />
          <Row label="Trade margin" value={`₹${Number(lot.trade_margin)}`} strong />
        </Card>
      )}

      {lot.pre_auction_sales.length > 0 && (
        <Card>
          <Text style={s.t}>Pre-auction sales</Text>
          {lot.pre_auction_sales.map((p) => (
            <Row key={p.id} label={`${p.customer_name} · ${Number(p.quantity)} boxes`} value={`₹${Number(p.rate)} = ₹${Number(p.quantity) * Number(p.rate)}`} />
          ))}
        </Card>
      )}

      {lot.allocations.length > 0 && (
        <Card>
          <Text style={s.t}>Auction allocations</Text>
          {lot.allocations.map((a) => (
            <Row key={a.id} label={`${a.customer_name} · ${Number(a.quantity)} boxes`} value={`₹${Number(a.rate)} · ${a.status}`} />
          ))}
        </Card>
      )}

      {Number(lot.remaining_quantity) > 0 && !isNight && (
        <Btn title="🔨 Take to Auction" kind="accent" onPress={() => nav.push('liveAuction', { lotId: lot.id })} />
      )}
      <Btn title="Mark Lot Card Printed" kind="secondary" onPress={async () => {
        try { await post(`/lots/${lot.id}/card-printed`); Alert.alert('Marked printed'); } catch (e) { setErr(e.message); }
      }} />
    </Screen>
  );
}

const s = {
  t: { fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 12, color: C.muted, marginTop: 6 },
};
