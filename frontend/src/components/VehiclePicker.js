/**
 * VEHICLE FIELD - the ONE vehicle control used everywhere in the ERP.
 * A single input that both
 *   - searches the Vehicle Master (number / name / driver) - tapping a match
 *     selects it and auto-fills its related details (name, driver, phone), and
 *   - accepts a NEW vehicle number typed manually; driver details for the new
 *     vehicle are captured right below the same field.
 *
 * Screens hold the state with useVehicleField() and render
 * <VehiclePicker {...vehicle.fieldProps} />.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { get, post } from '../api';
import { C } from './ui';

const norm = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

/**
 * Vehicle field state: loads the Vehicle Master and tracks either the
 * selected vehicle or a newly typed one.
 *   vehicle      - selected/matching master vehicle, or null
 *   isNew        - a new vehicle number has been typed
 *   valid        - a vehicle (existing or new) is present
 *   details()    - { vehicle_number, vehicle_name, driver_name, driver_phone }
 *   ensureInMaster() - returns the master vehicle, adding a new one first
 */
export function useVehicleField({ onError } = {}) {
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [text, setText] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');

  useEffect(() => {
    get('/vehicles').then(setVehicles).catch((e) => onError && onError(e.message));
  }, []);

  const selected = vehicles.find((v) => String(v.id) === String(selectedId)) || null;
  const exact = !selected && text.trim()
    ? vehicles.find((v) => norm(v.vehicle_number) === norm(text)) || null
    : null;
  const vehicle = selected || exact;
  const isNew = !vehicle && !!text.trim();

  function details() {
    if (vehicle) {
      return {
        vehicle_number: vehicle.vehicle_number,
        vehicle_name: vehicle.vehicle_name || null,
        driver_name: vehicle.driver_name || null,
        driver_phone: vehicle.driver_phone || null,
      };
    }
    return {
      vehicle_number: text.trim().toUpperCase() || null,
      vehicle_name: null,
      driver_name: driverName.trim() || null,
      driver_phone: driverPhone.trim() || null,
    };
  }

  async function ensureInMaster() {
    if (vehicle) return vehicle;
    const created = await post('/vehicles', {
      vehicle_number: text.trim().toUpperCase(),
      driver_name: driverName.trim() || undefined,
      driver_phone: driverPhone.trim() || undefined,
    });
    setVehicles((list) => [...list, created]);
    setSelectedId(created.id);
    setText('');
    return created;
  }

  function reset() {
    setSelectedId(null); setText(''); setDriverName(''); setDriverPhone('');
  }

  return {
    vehicle,
    isNew,
    valid: !!(vehicle || isNew),
    details,
    ensureInMaster,
    reset,
    fieldProps: {
      vehicles,
      selectedId: vehicle ? vehicle.id : null,
      text,
      onTextChange: (t) => { setText(t); setSelectedId(null); },
      onSelect: (id) => { setSelectedId(id); if (id == null) setText(''); },
      driverName,
      onDriverNameChange: setDriverName,
      driverPhone,
      onDriverPhoneChange: setDriverPhone,
    },
  };
}

export default function VehiclePicker({
  label = 'Vehicle', vehicles = [], selectedId, onSelect,
  text = '', onTextChange, driverName = '', onDriverNameChange, driverPhone = '', onDriverPhoneChange,
  placeholder = 'Search vehicle or type a new number…',
}) {
  const [open, setOpen] = useState(false);
  const selected = vehicles.find((v) => String(v.id) === String(selectedId));
  const q = text.trim().toLowerCase();
  const matches = (q
    ? vehicles.filter((v) => [v.vehicle_number, v.vehicle_name, v.driver_name]
        .filter(Boolean).some((f) => String(f).toLowerCase().includes(q)))
    : vehicles
  ).slice(0, 30);
  const isNew = !selected && !!q;

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>

      {selected ? (
        <View style={s.picked}>
          <View style={s.pickedTexts}>
            <Text style={s.pickedNumber} numberOfLines={1}>{selected.vehicle_number}</Text>
            {selected.vehicle_name ? <Text style={s.pickedSub} numberOfLines={1}>{selected.vehicle_name}</Text> : null}
          </View>
          <TouchableOpacity
            style={s.changeBtn}
            onPress={() => { onSelect(null); setOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel="Change vehicle"
          >
            <Text style={s.change}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TextInput
            style={[s.input, open && s.inputFocused]}
            value={text}
            onChangeText={(t) => { onTextChange(t); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            placeholderTextColor="#9aa096"
            autoCorrect={false}
            autoCapitalize="characters"
            underlineColorAndroid="transparent"
            accessibilityLabel={label}
          />
          {open && matches.length > 0 && (
            <View style={s.list}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                {matches.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={s.item}
                    onPress={() => { onSelect(v.id); setOpen(false); }}
                    accessibilityRole="button"
                    accessibilityLabel={`${v.vehicle_number}${v.driver_name ? ' · ' + v.driver_name : ''}`}
                  >
                    <Text style={s.itemNumber} numberOfLines={1}>{v.vehicle_number}</Text>
                    <Text style={s.itemSub} numberOfLines={1}>
                      {v.driver_name || 'No driver'}{v.vehicle_name ? ' · ' + v.vehicle_name : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {/* Existing vehicle: related details auto-filled from the Vehicle Master. */}
      {selected && (
        <View style={s.auto}>
          <Text style={s.autoHead}>AUTO-FILLED FROM VEHICLE MASTER</Text>
          <View style={s.autoRow}>
            <Text style={s.autoLabel}>Vehicle name</Text>
            <Text style={s.autoValue}>{selected.vehicle_name || '—'}</Text>
          </View>
          <View style={s.autoRow}>
            <Text style={s.autoLabel}>Driver</Text>
            <Text style={s.autoValue}>{selected.driver_name || '—'}</Text>
          </View>
          {selected.driver_phone ? (
            <View style={s.autoRow}>
              <Text style={s.autoLabel}>Driver phone</Text>
              <Text style={s.autoValue}>{selected.driver_phone}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* New vehicle typed manually: capture its driver in the same field block. */}
      {isNew && (
        <View style={s.newBox}>
          <Text style={s.newHead}>NEW VEHICLE · {text.trim().toUpperCase()}</Text>
          <TextInput
            style={s.newInput}
            value={driverName}
            onChangeText={onDriverNameChange}
            placeholder="Driver name"
            placeholderTextColor="#9aa096"
            autoCorrect={false}
            underlineColorAndroid="transparent"
            accessibilityLabel="Driver name"
          />
          <TextInput
            style={s.newInput}
            value={driverPhone}
            onChangeText={onDriverPhoneChange}
            placeholder="Driver phone (optional)"
            placeholderTextColor="#9aa096"
            keyboardType="phone-pad"
            underlineColorAndroid="transparent"
            accessibilityLabel="Driver phone"
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 13, color: C.text, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, height: 48, fontSize: 15, color: C.text,
  },
  inputFocused: { borderColor: C.primary, borderWidth: 1.5 },
  list: {
    marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    backgroundColor: '#fff', padding: 8, overflow: 'hidden',
  },
  item: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f2ee' },
  itemNumber: { fontSize: 15, fontWeight: '800', color: C.text },
  itemSub: { fontSize: 12.5, color: C.muted, marginTop: 1 },
  picked: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.primaryLight,
    borderRadius: 10, paddingHorizontal: 12, height: 56,
    justifyContent: 'space-between', borderWidth: 1, borderColor: '#cfe4d1',
  },
  pickedTexts: { flexShrink: 1, marginRight: 8 },
  pickedNumber: { color: C.primary, fontWeight: '800', fontSize: 15.5 },
  pickedSub: { color: C.primary, opacity: 0.75, fontSize: 12, marginTop: 1 },
  changeBtn: { paddingVertical: 8, paddingLeft: 8 },
  change: { color: C.accentDark, fontWeight: '700', fontSize: 13 },
  auto: {
    marginTop: 8, borderRadius: 10, backgroundColor: '#fffdf7',
    borderWidth: 1, borderColor: '#eadfc0', padding: 12,
  },
  autoHead: {
    fontSize: 9.5, fontWeight: '800', color: C.accentDark, letterSpacing: 1,
    marginBottom: 6,
  },
  autoRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12,
  },
  autoLabel: { color: C.muted, fontSize: 13 },
  autoValue: { color: C.text, fontSize: 13, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  newBox: {
    marginTop: 8, borderRadius: 10, backgroundColor: '#fffdf7',
    borderWidth: 1, borderColor: '#eadfc0', padding: 12, gap: 8,
  },
  newHead: { fontSize: 9.5, fontWeight: '800', color: C.accentDark, letterSpacing: 1 },
  newInput: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, height: 44, fontSize: 14.5, color: C.text,
  },
});
