/**
 * NIGHT ARRIVAL: create night stock, sell at predetermined price to multiple
 * customers (same stock identity - no duplicate inward), then fix the morning
 * final rate which computes the trade margin.
 */
import React, { useCallback, useState } from 'react';
import { Text, View, Alert } from 'react-native';
import { get, post } from '../api';
import { Card, Field, Btn, Screen, Row, C, lotSeq } from '../components/ui';
import LotCreatedModal from '../components/LotCreatedModal';
import VehiclePicker from '../components/VehiclePicker';

export default function NightArrivalScreen({ nav }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);

  // form
  const [partyName, setPartyName] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState(null);
  const [quality, setQuality] = useState('');
  const [quantity, setQuantity] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const load = useCallback(async () => {
    try {
      const all = await get('/inwards?source=night_arrival');
      setList(all);
      setErr('');
    } catch (e) { setErr(e.message); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  // Vehicle Master list for the searchable Vehicle dropdown.
  React.useEffect(() => {
    get('/vehicles').then(setVehicles).catch((e) => setErr(e.message));
  }, []);

  // The selected vehicle auto-fills its number & driver (from the master).
  const selectedVehicle = vehicles.find((v) => String(v.id) === String(vehicleId)) || null;

  async function save() {
    setSaving(true); setErr('');
    try {
      const r = await post('/inwards/night-arrival', {
        party_name: partyName,
        vehicle_number: selectedVehicle ? selectedVehicle.vehicle_number : null,
        driver_name: selectedVehicle ? selectedVehicle.driver_name : null,
        quality, quantity: Number(quantity), selling_price: Number(sellingPrice),
      });
      setCreated({
        lotId: r.lot.id, lotNumber: r.lot.lot_number, boxes: r.lot.total_quantity,
        amount: Number(sellingPrice) * Number(quantity),
      });
      setShowForm(false);
      setPartyName(''); setVehicleId(null); setQuality(''); setQuantity(''); setSellingPrice('');
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function fixRate(inward) {
    // Prompt via alert is limited; use a simple approach - ask in Alert with text field not available,
    // so we navigate to lot detail where the rate-fix action lives.
    nav.push('lotDetail', { lotId: inward.lot_id, fixRate: true });
  }

  const valid = partyName.trim() && vehicleId && Number(quantity) > 0 && Number(sellingPrice) >= 0;

  return (
    <Screen title="Night Arrivals" nav={nav} onBack={nav.pop} error={err}>
      <Btn title={showForm ? 'Close form' : '＋ New Night Arrival'} kind="accent" onPress={() => setShowForm(!showForm)} />
      {showForm && (
        <Card>
          <Field label="Supplier / Party" value={partyName} onChangeText={setPartyName} placeholder="e.g. Night Supplier" />
          <VehiclePicker vehicles={vehicles} selectedId={vehicleId} onSelect={setVehicleId}
            onAddNew={() => nav.push('vehicleMaster')} />
          <Field label="Quality" value={quality} onChangeText={setQuality} />
          <Field label="Quantity (boxes)" value={quantity} onChangeText={setQuantity} keyboard="numeric" />
          <Field label="Predetermined selling price (₹/box)" value={sellingPrice} onChangeText={setSellingPrice} keyboard="numeric" />
          <Btn title={saving ? 'Saving…' : 'SAVE Night Stock'} onPress={save} disabled={!valid || saving} />
        </Card>
      )}

      {(list || []).map((i) => (
        <Card key={i.id}>
          <Row label="Lot" value={lotSeq(i.lot_number)} strong />
          <Row label="Vehicle" value={i.vehicle_number} />
          <Row label="Party" value={i.party_name} />
          <Row label="Quantity" value={`${Number(i.quantity)} boxes`} />
          <Row label="Selling @ (predetermined)" value={i.selling_price ? `₹${Number(i.selling_price)}` : '-'} />
          <Row label="Final rate" value={i.final_rate ? `₹${Number(i.final_rate)}` : 'not fixed'} />
          {i.trade_margin != null && <Row label="Trade margin" value={`₹${Number(i.trade_margin)}`} strong />}
          {!i.final_rate && (
            <Btn title="Fix Morning Final Rate →" kind="accent" onPress={() => fixRate(i)} />
          )}
          {!i.final_rate && (
            <Btn title="Sell to Customer (predetermined price)" onPress={() => nav.push('lotDetail', { lotId: i.lot_id, sellNight: true })} />
          )}
        </Card>
      ))}
      {list && list.length === 0 && !showForm && (
        <View style={s.emptyWrap}>
          <Text style={s.muted}>No night arrivals recorded yet.{'\n'}Tap ＋ New Night Arrival to add one.</Text>
        </View>
      )}

      <LotCreatedModal
        visible={!!created}
        onClose={() => setCreated(null)}
        lotId={created?.lotId}
        lotNumber={created?.lotNumber}
        boxes={created?.boxes}
        amount={created?.amount}
        extraRows={[['Selling / box', `₹${Number(created?.amount || 0) / Number(created?.boxes || 1)}`]]}
        actions={[{ title: 'Done', onPress: () => setCreated(null) }]}
      />
    </Screen>
  );
}

const s = {
  muted: { color: C.muted, textAlign: 'center', marginTop: 12, lineHeight: 20 },
  emptyWrap: {
    borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12,
    padding: 22, marginTop: 4, backgroundColor: '#fafbfa',
  },
};
