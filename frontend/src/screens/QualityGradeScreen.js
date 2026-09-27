/**
 * Quality Grade master (Admin / Super Admin).
 *  - every grade in an aligned table: Grade Name · Status · Created · Updated
 *  - header "+" adds a grade; tapping a row edits its name and Active status
 * Inward screens, filters and reports read the active grades from this table.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Modal, ScrollView } from 'react-native';
import { post, put } from '../api';
import { Btn, Field, Screen, C, Badge, Empty, localDateKey } from '../components/ui';
import { useQualityGrades } from '../qualityGrades';

const COLUMNS = [
  { title: 'Grade Name', flex: 1.6, minWidth: 130 },
  { title: 'Status', flex: 1, minWidth: 90 },
  { title: 'Created', flex: 1, minWidth: 96 },
  { title: 'Updated', flex: 1, minWidth: 96 },
];
const TABLE_MIN_WIDTH = COLUMNS.reduce((a, c) => a + c.minWidth, 0) + 24;
const col = (i) => ({ flex: COLUMNS[i].flex, minWidth: COLUMNS[i].minWidth });

export default function QualityGradeScreen({ nav }) {
  const { grades, reload, error } = useQualityGrades({ all: true });
  const [editing, setEditing] = useState(null); // null = closed, {} = new grade, grade = edit
  const [okMsg, setOkMsg] = useState('');

  async function onSaved(msg) {
    setEditing(null);
    setOkMsg(msg);
    await reload();
  }

  return (
    <Screen
      title="Quality Grades"
      nav={nav}
      onBack={nav.pop}
      error={error}
      headerAction={{ label: 'Add Grade', onPress: () => setEditing({}), testID: 'header-add-grade' }}
    >
      {!!okMsg && (
        <TouchableOpacity style={s.okBox} onPress={() => setOkMsg('')} accessibilityRole="button" accessibilityLabel="Dismiss message">
          <Text style={s.okText}>✓ {okMsg}</Text>
          <Text style={s.okClose}>✕</Text>
        </TouchableOpacity>
      )}

      <View style={s.tableCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
          <View style={[s.table, { minWidth: TABLE_MIN_WIDTH }]}>
            <View style={[s.tr, s.thead]}>
              {COLUMNS.map((c, i) => <Text key={c.title} style={[s.th, col(i)]} numberOfLines={1}>{c.title}</Text>)}
            </View>
            {grades.length === 0 && <Empty>No quality grades yet. Tap + to add one.</Empty>}
            {grades.map((g, i) => (
              <TouchableOpacity
                key={g.id}
                style={[s.tr, i % 2 === 1 && s.trAlt]}
                onPress={() => setEditing(g)}
                accessibilityRole="button"
                accessibilityLabel={`${g.grade_name}, ${g.status}`}
              >
                <Text style={[s.td, s.tdName, col(0)]} numberOfLines={1}>{g.grade_name}</Text>
                <View style={[s.tdCell, col(1)]}>
                  <Badge tone={g.status === 'active' ? 'success' : 'danger'}>{g.status === 'active' ? 'Active' : 'Inactive'}</Badge>
                </View>
                <Text style={[s.td, col(2)]}>{localDateKey(g.created_at)}</Text>
                <Text style={[s.td, col(3)]}>{localDateKey(g.updated_at)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
      {grades.length > 0 && <Text style={s.hint}>Tap a grade to rename it or change its status. Only active grades can be chosen on inward entries.</Text>}

      <GradeModal grade={editing} onClose={() => setEditing(null)} onSaved={onSaved} />
    </Screen>
  );
}

function GradeModal({ grade, onClose, onSaved }) {
  const isNew = !!grade && !grade.id;
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  React.useEffect(() => {
    if (!grade) return;
    setName(grade.grade_name || '');
    setActive(grade.id ? grade.status === 'active' : true);
    setErr('');
  }, [grade]);

  async function save() {
    setErr('');
    if (!name.trim()) { setErr('Grade name is required.'); return; }
    setBusy(true);
    try {
      const body = { grade_name: name.trim(), status: active ? 'active' : 'inactive' };
      if (isNew) {
        await post('/quality-grades', body);
        await onSaved(`Grade "${body.grade_name}" added.`);
      } else {
        await put(`/quality-grades/${grade.id}`, body);
        await onSaved(`Grade "${body.grade_name}" updated.`);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={!!grade} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.popup}>
          <View style={s.popHead}>
            <Text style={s.popTitle}>{isNew ? 'Add Quality Grade' : 'Edit Quality Grade'}</Text>
            <TouchableOpacity onPress={onClose} style={s.popClose} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={s.popCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={s.popBody}>
            {!!err && <Text style={s.popErr}>⚠ {err}</Text>}
            <Field label="Grade name" value={name} onChangeText={setName} placeholder="e.g. Premium" autoCapitalize="words" required />
            <View style={s.switchRow}>
              <View style={s.switchTexts}>
                <Text style={s.switchLabel}>{active ? 'Active' : 'Inactive'}</Text>
                <Text style={[s.switchSub, { color: active ? C.primary : C.tomato }]}>
                  {active ? 'Shown in quality grade dropdowns' : 'Hidden from new entries'}
                </Text>
              </View>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: '#e6c4bd', true: '#a9cf9b' }}
                thumbColor={active ? C.primary : C.tomato}
                accessibilityLabel="Active status"
              />
            </View>
          </View>
          <View style={s.popFoot}>
            <Btn title="Cancel" kind="secondary" onPress={onClose} style={s.footBtn} />
            <Btn title={busy ? 'Saving…' : isNew ? 'Add Grade' : 'Save Changes'} onPress={save} disabled={busy} style={s.footBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  okBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: C.primaryLight, borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#cfe4d1',
  },
  okText: { flex: 1, color: C.primary, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  okClose: { color: C.primary, fontSize: 14, fontWeight: '800' },
  hint: { color: C.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },

  tableCard: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  hScroll: { flexGrow: 1 },
  table: { flex: 1 },
  tr: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 48,
    borderBottomWidth: 1, borderBottomColor: '#eef0ec',
  },
  trAlt: { backgroundColor: '#fafbfa' },
  thead: { backgroundColor: C.primaryLight, minHeight: 40, borderBottomColor: '#cfe4d1' },
  th: { fontSize: 11, fontWeight: '800', color: C.primaryDark, letterSpacing: 0.6, textTransform: 'uppercase', paddingRight: 10 },
  td: { fontSize: 13.5, color: C.text, paddingRight: 10 },
  tdName: { fontWeight: '700' },
  tdCell: { paddingRight: 10, alignItems: 'flex-start' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  popup: { width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', elevation: 8 },
  popHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 12 },
  popTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '800' },
  popClose: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  popCloseText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  popBody: { padding: 16 },
  popFoot: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: '#fafbfa' },
  footBtn: { flex: 1, marginTop: 0 },
  popErr: {
    color: C.danger, backgroundColor: C.dangerBg, borderRadius: 8, padding: 10,
    fontSize: 13, fontWeight: '600', marginBottom: 12,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  switchTexts: { flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  switchSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
