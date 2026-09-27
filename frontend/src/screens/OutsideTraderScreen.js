/** OUTSIDE TRADER inward: Supplier → Vehicle (from Vehicle Master) → Quality → Quantity → SAVE. */
import React, { useState } from 'react';
import { Text } from 'react-native';
import { get, post } from '../api';
import { Card, Field, Picker, Btn, Screen } from '../components/ui';
import LotCreatedModal from '../components/LotCreatedModal';
import VehiclePicker from '../components/VehiclePicker';

export default function OutsideTraderScreen({ nav }) {
  const [suppliers, setSuppliers] = useState(null);
  const [supplierId, setSupplierId] = useState(null);
  const [supplierName, setSupplierName] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState(null);
  const [quality, setQuality] = useState('');
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState(null);

  React.useEffect(() => {
    get('/parties?type=outside_trader').then(setSuppliers).catch((e) => setErr(e.message));
    get('/vehicles').then(setVehicles).catch((e) => setErr(e.message));
  }, []);

  // The selected vehicle auto-fills number, name, driver & phone (from the master).
  const vehicle = vehicles.find((v) => String(v.id) === String(vehicleId)) || null;

  async function save() {
    setSaving(true); setErr('');
    try {
      const r = await post('/inwards/outside-trader', {
        party_id: supplierId || undefined,
        party_name: supplierId ? undefined : supplierName,
        vehicle_number: vehicle ? vehicle.vehicle_number : null,
        vehicle_name: vehicle ? vehicle.vehicle_name : null,
        driver_name: vehicle ? vehicle.driver_name : null,
        driver_phone: vehicle ? vehicle.driver_phone : null,
        quality, quantity: Number(quantity),
      });
      setCreated({ lotId: r.lot.id, lotNumber: r.lot.lot_number, boxes: r.lot.total_quantity, amount: null });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const valid = (supplierId || supplierName.trim()) && vehicleId && Number(quantity) > 0;

  return (
    <Screen title="Outside Trader Inward" nav={nav} onBack={nav.pop} error={err}>
      <Card>
        <Picker label="Supplier (purchase party)" items={suppliers || []} selectedId={supplierId} onSelect={setSupplierId}
          placeholder="Select supplier…" />
        {!supplierId && (
          <Field label="…or supplier name" value={supplierName} onChangeText={setSupplierName} placeholder="e.g. Vijaya Fruits, Bangalore" />
        )}
      </Card>
      <Card>
        <Text style={s.t}>This arrival's vehicle</Text>
        <VehiclePicker vehicles={vehicles} selectedId={vehicleId} onSelect={setVehicleId}
          onAddNew={() => nav.push('vehicleMaster')} />
        <Text style={s.hint}>Vehicle & driver details come from the Vehicle Master — select the vehicle and they fill in automatically.</Text>
      </Card>
      <Card>
        <Field label="Quality" value={quality} onChangeText={setQuality} placeholder="e.g. B Grade" />
        <Field label="Quantity (boxes)" value={quantity} onChangeText={setQuantity} keyboard="numeric" placeholder="e.g. 50" />
        <Btn title={saving ? 'Saving…' : 'SAVE Inward'} onPress={save} disabled={!valid || saving} kind="accent" />
      </Card>

      <LotCreatedModal
        visible={!!created}
        onClose={() => setCreated(null)}
        lotId={created?.lotId}
        lotNumber={created?.lotNumber}
        boxes={created?.boxes}
        amount={null}
        extraRows={[
          ['Vehicle', vehicle?.vehicle_number || '-'],
          ['Driver', vehicle?.driver_name || '-'],
        ]}
        actions={[
          { title: 'Open Auction', onPress: () => nav.replace('liveAuction', { lotId: created.lotId }) },
          { title: 'Done', onPress: nav.home },
        ]}
      />
    </Screen>
  );
}

const s = {
  t: { fontWeight: '700', marginBottom: 6 },
  hint: { fontSize: 12, color: '#777', marginTop: 4 },
};
