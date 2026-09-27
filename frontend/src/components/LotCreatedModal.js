/**
 * LOT CREATED modal - properly aligned two-column layout:
 *   LEFT: field labels (Lot Number / Total Boxes / Amount)
 *   RIGHT: values, right-aligned under a "LOT DETAILS" heading
 * Big PRINT BILL action generates & opens the lot PDF on the device.
 * The Lot Number shown here is ONLY the 3-digit number (001).
 */
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { C, lotSeq } from './ui';
import { lotPdfUrl } from '../api';

export default function LotCreatedModal({ visible, onClose, lotId, lotNumber, boxes, amount, extraRows = [], actions = [] }) {
  if (!visible) return null;
  const seq = lotSeq(lotNumber);

  function printBill() {
    Linking.openURL(lotPdfUrl(lotId)).catch((e) =>
      Alert.alert('Print failed', e.message || 'Could not open the PDF.'));
  }

  const rows = [
    ['Lot Number', seq],
    ['Total Boxes', String(boxes)],
    ['Amount', amount != null ? `₹${Number(amount).toFixed(2)}` : '—'],
    ...extraRows,
  ];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          {/* header band: ONLY title left + date right */}
          <View style={s.head}>
            <Text style={s.headTitle}>Lot Created ✓</Text>
            <Text style={s.headSub}>{new Date().toLocaleDateString('en-IN')}</Text>
          </View>

          {/* LOT DETAILS: left-aligned section heading BELOW the header */}
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>LOT DETAILS</Text>
          </View>

          {/* aligned rows: label left column, value right-aligned column */}
          <View style={s.body}>
            {rows.map(([label, value]) => (
              <View key={label} style={s.row}>
                <Text style={s.label}>{label}</Text>
                <Text style={s.value}>{value}</Text>
              </View>
            ))}
          </View>

          {/* print */}
          <TouchableOpacity style={s.printBtn} onPress={printBill} accessibilityRole="button" accessibilityLabel="Print bill">
            <Text style={s.printText}>🖨 PRINT BILL</Text>
          </TouchableOpacity>

          {/* optional flow actions (Open Auction / Another Entry / Done…) */}
          {actions.length > 0 && (
            <View style={s.actions}>
              {actions.map((a) => (
                <TouchableOpacity key={a.title} style={s.actionBtn} onPress={a.onPress} accessibilityRole="button">
                  <Text style={s.actionText}>{a.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden', elevation: 6,
  },
  head: {
    backgroundColor: C.primary, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderLeftWidth: 6, borderLeftColor: C.accent,
  },
  headTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headSub: { color: C.accent, fontSize: 12, fontWeight: '600' },
  sectionHead: { marginTop: 14, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: C.accentDark,
    letterSpacing: 1, textTransform: 'uppercase',
    alignSelf: 'flex-start',                       // LEFT-aligned
    borderBottomWidth: 1.5, borderBottomColor: C.accent, paddingBottom: 3,
  },
  body: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7,                            // consistent spacing per row
  },
  label: { fontSize: 14, color: C.muted, textAlign: 'left', flexShrink: 1 },
  value: {
    fontSize: 14, color: C.text, fontWeight: '800',
    textAlign: 'right', fontVariant: ['tabular-nums'], flexShrink: 1, marginLeft: 16,
  },
  printBtn: {
    backgroundColor: C.accent, marginHorizontal: 16, marginTop: 8, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', elevation: 2,
  },
  printText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingTop: 10 },
  actionBtn: {
    flexBasis: '48%', flexGrow: 1, borderRadius: 10, borderWidth: 1.5,
    borderColor: C.primary, paddingVertical: 11, alignItems: 'center',
  },
  actionText: { color: C.primary, fontWeight: '700', fontSize: 13.5 },
});
