/**
 * SUCCESS / SAVED modal - the standard confirmation popup across the ERP.
 * Clean professional design (Sri Varahi palette):
 *   ✓ green header band · sections with gold underlined titles ·
 *   aligned label/value rows · clearly aligned action buttons.
 * Information is shown as separate rows/fields - never a long sentence.
 *
 * Props:
 *   visible, onClose        - modal visibility
 *   title                   - e.g. "Saved ✓"
 *   subtitle                - small line under the title (optional)
 *   sections: [{ title, rows: [[label, value], …] }]
 *   actionSectionTitle      - heading shown above the action buttons (optional)
 *   actions: [{ title, onPress, kind: 'primary'|'secondary'|'accent' }]
 */
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { C } from './ui';

export default function SuccessModal({ visible, onClose, title, subtitle, sections = [], actionSectionTitle, actions = [] }) {
  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          {/* header band */}
          <View style={s.head}>
            <View style={s.checkCircle}>
              <Text style={s.check}>✓</Text>
            </View>
            <View style={s.headText}>
              <Text style={s.headTitle}>{title || 'Saved ✓'}</Text>
              {subtitle ? <Text style={s.headSub}>{subtitle}</Text> : null}
            </View>
          </View>

          {/* sections of aligned rows */}
          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={s.body}>
            {sections.filter((sec) => sec.rows && sec.rows.length > 0).map((sec) => (
              <View key={sec.title}>
                <Text style={s.sectionTitle}>{sec.title}</Text>
                {sec.rows.map(([label, value]) => (
                  <View key={label} style={s.row}>
                    <Text style={s.label} numberOfLines={2}>{label}</Text>
                    <Text style={s.value} numberOfLines={2}>{value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          {/* action buttons (optionally under a section heading) */}
          {actions.length > 0 && (
            <View style={s.actions}>
              {actionSectionTitle ? (
                <Text style={s.actionSectionTitle}>{actionSectionTitle}</Text>
              ) : null}
              <View style={s.actionRow}>
                {actions.map((a) => (
                  <TouchableOpacity
                    key={a.title}
                    style={[s.actionBtn, a.kind === 'primary' && s.actionPrimary, a.kind === 'accent' && s.actionAccent]}
                    onPress={a.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={a.title}
                  >
                    <Text style={[s.actionText, (a.kind === 'primary' || a.kind === 'accent') && s.actionTextFill]}>
                      {a.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden', elevation: 6,
  },
  head: {
    backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderLeftWidth: 6, borderLeftColor: C.accent, gap: 12,
  },
  checkCircle: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff2b',
    alignItems: 'center', justifyContent: 'center',
  },
  check: { color: '#fff', fontSize: 22, fontWeight: '900' },
  headText: { flex: 1 },
  headTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headSub: { color: '#ffffffcc', fontSize: 12, marginTop: 2 },
  body: { paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: C.accentDark, letterSpacing: 1,
    textTransform: 'uppercase', alignSelf: 'flex-start',
    borderBottomWidth: 1.5, borderBottomColor: C.accent, paddingBottom: 3,
    marginTop: 12,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7, gap: 16,
  },
  label: { fontSize: 14, color: C.muted, flexShrink: 1 },
  value: {
    fontSize: 14, color: C.text, fontWeight: '800', textAlign: 'right',
    fontVariant: ['tabular-nums'], flexShrink: 1,
  },
  actions: { padding: 16, paddingTop: 10 },
  actionSectionTitle: {
    fontSize: 11, fontWeight: '800', color: C.accentDark, letterSpacing: 1,
    textTransform: 'uppercase', alignSelf: 'flex-start',
    borderBottomWidth: 1.5, borderBottomColor: C.accent, paddingBottom: 3,
    marginBottom: 10, width: '100%',
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  actionBtn: {
    flexBasis: '47%', flexGrow: 1, borderRadius: 10, borderWidth: 1.5,
    borderColor: C.primary, paddingVertical: 12, alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: { backgroundColor: C.primary, borderColor: C.primary, elevation: 2 },
  actionAccent: { backgroundColor: C.accent, borderColor: C.accent, elevation: 2 },
  actionText: { color: C.primary, fontWeight: '700', fontSize: 13.5, textAlign: 'center' },
  actionTextFill: { color: '#fff' },
});
