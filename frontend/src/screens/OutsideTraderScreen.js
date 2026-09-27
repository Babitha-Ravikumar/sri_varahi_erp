/** OUTSIDE TRADER inward: Supplier → Vehicle (existing or new) → Quality → Quantity → SAVE. */
import React, { useState } from 'react';
import { Text } from 'react-native';
import { get, post } from '../api';
import { Card, Field, Picker, Btn, Screen, Dropdown } from '../components/ui';
import LotCreatedModal from '../components/LotCreatedModal';
import VehiclePicker, { useVehicleField } from '../components/VehiclePicker';
import { useQualityGrades, gradeOptions } from '../qualityGrades';

export default function OutsideTraderScreen({ nav }) {
  const { grades } = useQualityGrades();
  const [suppliers, setSuppliers] = useState(null);
  const [supplierId, setSupplierId] = useState(null);
  const [supplierName, setSupplierName] = useState('');
  const [quality, setQuality] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState(null);
  const vehicle = useVehicleField({ onError: setErr });

  React.useEffect(() => {
    get('/parties?type=outside_trader').then(setSuppliers).catch((e) => setErr(e.message));
  }, []);

  async function save() {
    setSaving(true); setErr('');
    try {
      const v = vehicle.details();
      const r = await post('/inwards/outside-trader', {
        party_id: supplierId || undefined,
        party_name: supplierId ? undefined : supplierName,
        ...v,
        quality_grade_id: quality || undefined, quantity: Number(quantity),
      });
      setCreated({
        lotId: r.lot.id, lotNumber: r.lot.lot_number, boxes: r.lot.total_quantity, amount: null,
        vehicleNumber: v.vehicle_number, driverName: v.driver_name,
      });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const valid = (supplierId || supplierName.trim()) && vehicle.valid && Number(quantity) > 0;

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
        <VehiclePicker {...vehicle.fieldProps} />
        <Text style={s.hint}>Pick a saved vehicle to fill in its driver automatically, or type a new vehicle number.</Text>
      </Card>
      <Card>
        <Dropdown label="Quality Grade" options={gradeOptions(grades)} value={quality} onChange={setQuality} />
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
          ['Vehicle', created?.vehicleNumber || '-'],
          ['Driver', created?.driverName || '-'],
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
