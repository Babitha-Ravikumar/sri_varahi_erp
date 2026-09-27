/** Vehicle Master - regular vehicles stored once, selected during inward. */
import React, { useCallback, useState } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { get, post, put, del } from '../api';
import { Card, Field, Btn, Screen, Row, C } from '../components/ui';

export default function VehicleMasterScreen({ nav }) {
  const [vehicles, setVehicles] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [driver, setDriver] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    try { setVehicles(await get('/vehicles')); setErr(''); }
    catch (e) { setErr(e.message); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  function startEdit(v) {
    setEditing(v);
    setNumber(v.vehicle_number); setName(v.vehicle_name || '');
    setDriver(v.driver_name || ''); setPhone(v.driver_phone || '');
  }

  async function save() {
    try {
      if (editing) await put(`/vehicles/${editing.id}`, { vehicle_number: number, vehicle_name: name, driver_name: driver, driver_phone: phone });
      else await post('/vehicles', { vehicle_number: number, vehicle_name: name, driver_name: driver, driver_phone: phone });
      setEditing(null); setNumber(''); setName(''); setDriver(''); setPhone('');
      load();
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function remove(v) {
    Alert.alert(
      'Remove vehicle',
      `Remove ${v.vehicle_number} from the active list? Existing lots keep their history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await del(`/vehicles/${v.id}`);
              if (editing && editing.id === v.id) {
                setEditing(null); setNumber(''); setName(''); setDriver(''); setPhone('');
              }
              load(); // refresh list from DB
            } catch (e) { setErr(e.message); }
          },
        },
      ]
    );
  }

  return (
    <Screen title="Vehicle Master" onBack={nav.pop} error={err}>
      <Card>
        <Text style={s.t}>{editing ? 'Edit vehicle' : 'Add regular vehicle'}</Text>
        <Field label="Vehicle number *" value={number} onChangeText={setNumber} placeholder="e.g. AP36 AB 1234" />
        <Field label="Vehicle name" value={name} onChangeText={setName} placeholder="e.g. Tata Ace" />
        <Field label="Driver name" value={driver} onChangeText={setDriver} />
        <Field label="Driver phone" value={phone} onChangeText={setPhone} keyboard="phone-pad" />
        <Btn title={editing ? 'Update' : 'Add Vehicle'} onPress={save} disabled={!number.trim()} kind="accent" />
        {editing && <Btn title="Cancel edit" kind="secondary" onPress={() => { setEditing(null); setNumber(''); setName(''); setDriver(''); setPhone(''); }} />}
      </Card>

      {(vehicles || []).map((v) => (
        <TouchableOpacity key={v.id} onPress={() => startEdit(v)} activeOpacity={0.8}>
          <Card>
            <Row label={v.vehicle_number} value={v.vehicle_name || ''} strong />
            {v.driver_name ? <Row label="Driver" value={`${v.driver_name}${v.driver_phone ? ' · ' + v.driver_phone : ''}`} /> : null}
            <Row label="Today's lots" value={String(v.lot_count)} />
            <View style={s.itemActions}>
              <Btn title="Edit" kind="secondary" style={s.itemBtn}
                onPress={() => startEdit(v)} />
              <Btn title="Remove" kind="danger" style={s.itemBtn}
                onPress={() => remove(v)} />
            </View>
          </Card>
        </TouchableOpacity>
      ))}
      {vehicles && vehicles.length === 0 && (
        <Text style={s.empty}>No vehicles yet. Add one above - it will be available in every inward flow.</Text>
      )}
    </Screen>
  );
}

const s = {
  t: { fontWeight: '700', marginBottom: 6 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  itemBtn: { flex: 1, marginTop: 8, paddingHorizontal: 4 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 16, lineHeight: 20 },
};
