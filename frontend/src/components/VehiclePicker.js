/**
 * VEHICLE PICKER - the ONE global way a vehicle is selected anywhere in the
 * ERP. Searchable dropdown over the Vehicle Master (number / name / driver);
 * after selection the vehicle's related data (name, driver, phone) is shown
 * in an auto-populated read-only card and updates whenever the selection
 * changes. No free-text vehicle entry, no hardcoded drivers.
 *
 * Props:
 *   vehicles      - vehicle list from GET /vehicles (Vehicle Master)
 *   selectedId    - currently selected vehicle id (or null)
 *   onSelect(id)  - called with the vehicle id (or null when cleared)
 *   onAddNew      - optional callback when "vehicle not listed" is tapped
 *                   (usually navigates to the Vehicle Master screen)
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { C } from './ui';

function vehicleLabel(v) {
  return `${v.vehicle_number}${v.driver_name ? ' · ' + v.driver_name : ''}`;
}

export default function VehiclePicker({ label = 'Vehicle (from Vehicle Master)', vehicles = [], selectedId, onSelect, onAddNew, placeholder = 'Type to search vehicle…' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const selected = vehicles.find((v) => String(v.id) === String(selectedId));
  const text = q.trim().toLowerCase();
  const matches = (text
    ? vehicles.filter((v) => [v.vehicle_number, v.vehicle_name, v.driver_name]
        .filter(Boolean).some((f) => String(f).toLowerCase().includes(text)))
    : vehicles
  ).slice(0, 30);

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
            onPress={() => { onSelect(null); setQ(''); setOpen(true); }}
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
            value={q}
            onChangeText={setQ}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            placeholderTextColor="#9aa096"
            autoCorrect={false}
            autoCapitalize="characters"
            underlineColorAndroid="transparent"
            accessibilityLabel={label}
          />
          {open && (
            <View style={s.list}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                {matches.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={s.item}
                    onPress={() => { onSelect(v.id); setOpen(false); setQ(''); }}
                    accessibilityRole="button"
                    accessibilityLabel={vehicleLabel(v)}
                  >
                    <Text style={s.itemNumber} numberOfLines={1}>{v.vehicle_number}</Text>
                    <Text style={s.itemSub} numberOfLines={1}>
                      {v.driver_name || 'No driver'}{v.vehicle_name ? ' · ' + v.vehicle_name : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
                {matches.length === 0 && (
                  <Text style={s.none}>
                    No vehicle matches “{q.trim()}”.{'\n'}
                    {onAddNew ? 'Tap below to add it in the Vehicle Master first.' : 'Add it in the Vehicle Master first.'}
                  </Text>
                )}
                {onAddNew && (
                  <TouchableOpacity style={s.addNew} onPress={onAddNew} accessibilityRole="button" accessibilityLabel="Add vehicle in Vehicle Master">
                    <Text style={s.addNewText}>＋ Add / manage vehicles in Vehicle Master</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {/* Auto-populated from the Vehicle Master - never typed by the user. */}
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
  none: { padding: 12, color: C.muted, fontSize: 12.5, lineHeight: 17 },
  addNew: { padding: 13, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f0f2ee' },
  addNewText: { color: C.accentDark, fontWeight: '700', fontSize: 13 },
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
});
