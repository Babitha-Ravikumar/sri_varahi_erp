/** Purchase Source Selection - each source is a different flow. */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen, Btn, C } from '../components/ui';

const SOURCES = [
  { key: 'localFarmer', title: 'Local Farmer' },
  { key: 'localTrader', title: 'Local Trader' },
  { key: 'outsideTrader', title: 'Outside Trader' },
  { key: 'nightArrival', title: 'Night Arrival' },
];

export default function SourceSelectScreen({ nav }) {
  const [selected, setSelected] = useState(null);

  return (
    <Screen title="Select Purchase Source" nav={nav} onBack={nav.pop}>
      <Text style={s.intro}>Choose the purchase source to start a new inward entry.</Text>
      {SOURCES.map((src) => {
        const on = selected === src.key;
        return (
          <TouchableOpacity
            key={src.key}
            activeOpacity={0.7}
            style={[s.srcBtn, on && s.srcBtnOn]}
            onPress={() => setSelected(src.key)}
            accessibilityRole="button"
            accessibilityLabel={src.title}
            accessibilityState={{ selected: on }}
          >
            <View style={[s.radio, on && s.radioOn]}>
              {on ? <View style={s.radioDot} /> : null}
            </View>
            <Text style={[s.srcTitle, on && s.srcTitleOn]}>{src.title}</Text>
          </TouchableOpacity>
        );
      })}
      <Btn
        title="Continue"
        kind={selected ? 'primary' : 'secondary'}
        onPress={() => selected && nav.push(selected)}
        disabled={!selected}
        style={s.continueBtn}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 13, color: '#6b7268', marginBottom: 16, lineHeight: 18 },
  srcBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
  },
  srcBtnOn: {
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
    elevation: 2,
  },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#c3c8c0',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  radioOn: { borderColor: C.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  srcTitle: { fontSize: 16, fontWeight: '700', color: C.text, flexShrink: 1 },
  srcTitleOn: { color: C.primary },
  continueBtn: { marginTop: 18 },
});
