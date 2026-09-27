/** Purchase Source Selection - one tap opens that source's inward flow. */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Screen, C, Loading } from '../components/ui';
import { useReference } from '../reference';

/** Inward screen for each purchase source code (sources themselves come from the database). */
const SCREEN_OF_SOURCE = {
  local_farmer: 'localFarmer',
  local_trader: 'localTrader',
  outside_trader: 'outsideTrader',
  night_arrival: 'nightArrival',
};

export default function SourceSelectScreen({ nav }) {
  const sources = useReference('purchase_source')
    .filter((r) => r.selectable && SCREEN_OF_SOURCE[r.code])
    .map((r) => ({ key: SCREEN_OF_SOURCE[r.code], title: r.label, desc: r.description, icon: r.icon }));
  return (
    <Screen title="New Inward" nav={nav} onBack={nav.pop}>
      <Text style={s.intro}>Tap the purchase source to start the inward entry.</Text>
      {sources.length === 0 && <Loading label="Loading purchase sources…" />}
      {sources.map((src) => (
        <TouchableOpacity
          key={src.key}
          activeOpacity={0.7}
          style={s.srcBtn}
          onPress={() => nav.push(src.key)}
          accessibilityRole="button"
          accessibilityLabel={src.title}
          accessibilityHint={`Opens the ${src.title} inward screen`}
        >
          <View style={s.iconWrap}><Text style={s.icon}>{src.icon || '📦'}</Text></View>
          <View style={s.body}>
            <Text style={s.srcTitle}>{src.title}</Text>
            {src.desc ? <Text style={s.srcDesc} numberOfLines={1}>{src.desc}</Text> : null}
          </View>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 18 },
  srcBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
    borderLeftColor: C.primary,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 1,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: C.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  body: { flex: 1 },
  srcTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  srcDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  arrow: { color: C.accentDark, fontSize: 26, fontWeight: '800' },
});
