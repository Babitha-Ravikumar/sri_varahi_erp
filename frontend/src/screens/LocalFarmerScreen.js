/** LOCAL FARMER inward: Vehicle → Farmer → Quality → Quantity → SAVE → Lot + Lot Card. */
import React, { useState } from 'react';
import { Text } from 'react-native';
import { post } from '../api';
import { Card, Field, Btn, Screen, C, Dropdown } from '../components/ui';
import LotCreatedModal from '../components/LotCreatedModal';
import VehiclePicker, { useVehicleField } from '../components/VehiclePicker';
import { useQualityGrades, gradeOptions } from '../qualityGrades';

export default function LocalFarmerScreen({ nav }) {
  const { grades } = useQualityGrades();
  const [partyName, setPartyName] = useState('');
  const [quality, setQuality] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // "Lot Created" popup state
  const [created, setCreated] = useState(null); // { lotId, lotNumber, boxes }
  const vehicle = useVehicleField({ onError: setErr });

  function anotherEntry() {
    setCreated(null);
    setPartyName(''); setQuality(null); setQuantity('');
  }

  async function save() {
    setSaving(true); setErr('');
    try {
      // Local-farmer inwards reference the Vehicle Master; a newly typed
      // vehicle is added to the master first.
      const v = await vehicle.ensureInMaster();
      const r = await post('/inwards/local-farmer', {
        vehicle_id: v.id, party_name: partyName, quality_grade_id: quality || undefined, quantity: Number(quantity),
      });
      setCreated({
        lotId: r.lot.id, lotNumber: r.lot.lot_number, boxes: r.lot.total_quantity,
        vehicleNumber: v.vehicle_number, driverName: v.driver_name,
      });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const valid = vehicle.valid && partyName.trim() && Number(quantity) > 0;

  return (
    <Screen title="Local Farmer Inward" nav={nav} onBack={nav.pop} error={err}>
      <Card>
        <VehiclePicker {...vehicle.fieldProps} />
        <Field label="Farmer / Party name" value={partyName} onChangeText={setPartyName} placeholder="e.g. Koteswara Rao" />
        <Dropdown label="Quality Grade" options={gradeOptions(grades)} value={quality} onChange={setQuality} />
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
        extraRows={[
          ['Vehicle', created?.vehicleNumber || '-'],
          ['Driver', created?.driverName || '-'],
          ['Party', partyName],
        ]}
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
