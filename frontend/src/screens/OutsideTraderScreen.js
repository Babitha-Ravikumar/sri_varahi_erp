/** OUTSIDE TRADER inward: Supplier → Vehicle + Driver (daily) → Quality → Quantity → SAVE. */
import React, { useState } from 'react';
import { Text } from 'react-native';
import { get, post } from '../api';
import { Card, Field, Picker, Btn, Screen } from '../components/ui';
import LotCreatedModal from '../components/LotCreatedModal';

export default function OutsideTraderScreen({ nav }) {
  const [suppliers, setSuppliers] = useState(null);
  const [supplierId, setSupplierId] = useState(null);
  const [supplierName, setSupplierName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [quality, setQuality] = useState('');
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState(null);

  React.useEffect(() => {
    get('/parties?type=outside_trader').then(setSuppliers).catch((e) => setErr(e.message));
  }, []);

  async function save() {
    setSaving(true); setErr('');
    try {
      const r = await post('/inwards/outside-trader', {
        party_id: supplierId || undefined,
        party_name: supplierId ? undefined : supplierName,
        vehicle_number: vehicleNumber, vehicle_name: vehicleName,
        driver_name: driverName, driver_phone: driverPhone,
        quality, quantity: Number(quantity),
      });
      setCreated({ lotId: r.lot.id, lotNumber: r.lot.lot_number, boxes: r.lot.total_quantity, amount: null });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const valid = (supplierId || supplierName.trim()) && vehicleNumber.trim() && Number(quantity) > 0;

  return (
    <Screen title="Outside Trader Inward" onBack={nav.pop} error={err}>
      <Card>
        <Picker label="Supplier (purchase party)" items={suppliers || []} selectedId={supplierId} onSelect={setSupplierId}
          placeholder="Select supplier…" />
        {!supplierId && (
          <Field label="…or supplier name" value={supplierName} onChangeText={setSupplierName} placeholder="e.g. Vijaya Fruits, Bangalore" />
        )}
      </Card>
      <Card>
        <Text style={s.t}>This arrival's vehicle & driver</Text>
        <Field label="Vehicle number *" value={vehicleNumber} onChangeText={setVehicleNumber} placeholder="e.g. KA05 AB 4321" />
        <Field label="Vehicle name" value={vehicleName} onChangeText={setVehicleName} placeholder="e.g. Eicher Truck" />
        <Field label="Driver name" value={driverName} onChangeText={setDriverName} placeholder="e.g. Mahesh" />
        <Field label="Driver phone" value={driverPhone} onChangeText={setDriverPhone} keyboard="phone-pad" placeholder="e.g. 98xxxxxxx0" />
        <Text style={s.hint}>Outside-trader vehicles/drivers change daily - captured for THIS arrival only.</Text>
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
        extraRows={[['Vehicle', vehicleNumber || '-']]}
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
