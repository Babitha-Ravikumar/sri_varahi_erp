/** LOCAL FARMER inward: Vehicle → Farmer → Quality → Quantity → SAVE → Lot + Lot Card. */
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { get, post } from '../api';
import { Card, Field, Picker, Btn, Screen, C } from '../components/ui';
import LotCreatedModal from '../components/LotCreatedModal';

export default function LocalFarmerScreen({ nav }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState(null);
  const [partyName, setPartyName] = useState('');
  const [quality, setQuality] = useState('');
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // "Lot Created" popup state
  const [created, setCreated] = useState(null); // { lotId, lotNumber, boxes }

  async function load() {
    try {
      setVehicles(await get('/vehicles'));
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  function anotherEntry() {
    setCreated(null);
    setPartyName(''); setQuality(''); setQuantity('');
  }

  async function save() {
    setSaving(true); setErr('');
    try {
      const r = await post('/inwards/local-farmer', {
        vehicle_id: vehicleId, party_name: partyName, quality, quantity: Number(quantity),
      });
      setCreated({ lotId: r.lot.id, lotNumber: r.lot.lot_number, boxes: r.lot.total_quantity });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const valid = vehicleId && partyName.trim() && Number(quantity) > 0;

  return (
    <Screen title="Local Farmer Inward" onBack={nav.pop} error={err}>
      <Card>
        <Picker label="Vehicle (from Vehicle Master)" items={vehicles} selectedId={vehicleId}
          onSelect={setVehicleId} placeholder="Select vehicle…"
          renderLabel={(v) => `${v.vehicle_number}${v.driver_name ? ' · ' + v.driver_name : ''}`} />
        <Field label="Farmer / Party name" value={partyName} onChangeText={setPartyName} placeholder="e.g. Koteswara Rao" />
        <Field label="Quality" value={quality} onChangeText={setQuality} placeholder="e.g. A Grade" />
        <Field label="Quantity (boxes)" value={quantity} onChangeText={setQuantity} keyboard="numeric" placeholder="e.g. 10" />
        <Btn title={saving ? 'Saving…' : 'SAVE — Create Lot'} onPress={save} disabled={!valid || saving} kind="accent" />
        <Text style={s.hint}>Lot number & Lot Card are generated automatically on save.</Text>
      </Card>

      <LotCreatedModal
        visible={!!created}
        onClose={anotherEntry}
        lotId={created?.lotId}
        lotNumber={created?.lotNumber}
        boxes={created?.boxes}
        amount={null}
        extraRows={[['Vehicle', (vehicles.find((v) => String(v.id) === String(vehicleId)) || {}).vehicle_number || '-'],
                    ['Party', partyName]]}
        actions={[
          { title: 'Open Auction', onPress: () => nav.replace('liveAuction', { lotId: created.lotId }) },
          { title: 'Another Entry', onPress: anotherEntry },
          { title: 'Done', onPress: nav.home },
        ]}
      />
    </Screen>
  );
}

const s = {
  hint: { color: C.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },
};
