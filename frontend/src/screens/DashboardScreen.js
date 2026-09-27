/** Dashboard / Today's Arrival - real-time consolidated totals from inward data. */
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { ScrollView } from 'react-native';
import { get, getSession, clearSession } from '../api';
import { Card, Row, Screen, C, Loading, SectionTitle } from '../components/ui';

const ACTIONS = [
  {
    key: 'newInward', icon: '＋', title: 'INWARD',
    desc: 'Receive & manage incoming stock', color: C.accent,
    onPress: (nav) => nav.push('sourceSelect'), hero: true,
  },
  { key: 'lots', icon: '📦', title: 'LOT', desc: 'Create & manage lot cards', color: C.primary, onPress: (nav) => nav.push('lotDetail', { list: true }) },
  { key: 'auction', icon: '🔨', title: 'AUCTION', desc: 'Live auction workflow', color: C.accentDark, onPress: (nav) => nav.push('liveAuction') },
  { key: 'billing', icon: '🧾', title: 'BILLING', desc: 'Create & manage bills', color: C.primary, onPress: (nav) => nav.push('billing') },
  { key: 'cashier', icon: '💰', title: 'CASHIER', desc: 'Payments & collections', color: C.accent, onPress: (nav) => nav.push('cashier') },
  { key: 'night', icon: '🌙', title: 'NIGHT ARRIVALS', desc: 'Overnight stock intake', color: C.muted, onPress: (nav) => nav.push('nightArrival') },
  { key: 'vehicle', icon: '🚚', title: 'VEHICLE MASTER', desc: 'Vehicles, drivers & owners', color: C.muted, onPress: (nav) => nav.push('vehicleMaster') },
  { key: 'corrections', icon: '✏️', title: 'CORRECTIONS', desc: 'Post-auction changes', color: C.danger, onPress: (nav) => nav.push('corrections') },
  { key: 'audit', icon: '📋', title: 'AUDIT / HISTORY', desc: 'Actions & change log', color: C.accentDark, onPress: (nav) => nav.push('audit') },
  { key: 'logout', icon: '↩', title: 'LOGOUT', desc: 'Sign out of the ERP', color: C.muted, onPress: (nav) => { clearSession(); nav.reset('login'); } },
];

export default function DashboardScreen({ nav }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const session = getSession();

  // User Creation is available only to the Super Admin.
  const actions = session && session.role === 'super_admin'
    ? [...ACTIONS.slice(0, -1),
       { key: 'userCreation', icon: '👥', title: 'USER CREATION', desc: 'Create & manage Admin users', color: C.tomato, onPress: (n) => n.push('userCreation') },
       ACTIONS[ACTIONS.length - 1]]
    : ACTIONS;

  const load = useCallback(async () => {
    try { setData(await get('/inwards/consolidated')); setErr(''); }
    catch (e) { setErr(e.message); }
  }, []);

  React.useEffect(() => { const t = setInterval(load, 5000); load(); return () => clearInterval(t); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /** Open the drill-down detail PAGE for one vehicle or source. */
  const openDrill = useCallback((type, key) => {
    nav.push('drillDown', { type, key });
  }, [nav]);

  return (
    <Screen title={`Today's Arrival${session ? ' · ' + session.name : ''}`} error={err}>
      <ScrollView
        contentContainerStyle={s.content}
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
      >
        {!data && <Loading label="Loading today's data…" />}
        {data && (
          <>
            <View style={s.totalsRow}>
              <View style={[s.totalBox, { backgroundColor: C.primary }]}>
                <Text style={s.totalNum} adjustsFontSizeToFit minimumFontScale={0.5}>{data.today_total_lots}</Text>
                <Text style={s.totalLbl}>TODAY'S LOTS</Text>
              </View>
              <View style={[s.totalBox, { backgroundColor: C.accent }]}>
                <Text style={s.totalNum} adjustsFontSizeToFit minimumFontScale={0.5}>{data.today_total_boxes}</Text>
                <Text style={s.totalLbl}>TODAY'S BOXES</Text>
              </View>
            </View>

            <Card>
              <SectionTitle>Vehicle-wise (today) · tap for details</SectionTitle>
              {data.vehicle_wise.length === 0 && <Text style={s.muted}>No arrivals yet.</Text>}
              {data.vehicle_wise.map((v) => (
                <TouchableOpacity key={v.vehicle_number} style={s.drillRow}
                  onPress={() => openDrill('vehicle', v.vehicle_number)}
                  accessibilityRole="button" accessibilityLabel={`Details for vehicle ${v.vehicle_number}`}>
                  <Text style={s.drillLabel}>{v.vehicle_number}</Text>
                  <Text style={s.drillValue}>{v.lot_count} lots · {Number(v.total_boxes)} boxes ›</Text>
                </TouchableOpacity>
              ))}
            </Card>

            <Card>
              <SectionTitle>Source-wise (today) · tap for details</SectionTitle>
              {data.source_wise.length === 0 && <Text style={s.muted}>No arrivals yet.</Text>}
              {data.source_wise.map((v) => (
                <TouchableOpacity key={v.purchase_source} style={s.drillRow}
                  onPress={() => openDrill('source', v.purchase_source)}
                  accessibilityRole="button" accessibilityLabel={`Details for source ${v.purchase_source}`}>
                  <Text style={s.drillLabel}>{v.purchase_source.replace(/_/g, ' ')}</Text>
                  <Text style={s.drillValue}>{v.inward_count} inwards · {Number(v.total_boxes)} boxes ›</Text>
                </TouchableOpacity>
              ))}
            </Card>

            {/* Tapping a vehicle / source opens its detail PAGE (drill-down) */}

            <SectionTitle>Workflow Actions</SectionTitle>
            <View style={s.menuGrid}>
              {actions.map((a) => (
                <ActionTile
                  key={a.key}
                  icon={a.icon}
                  title={a.title}
                  desc={a.desc}
                  color={a.color}
                  hero={a.hero}
                  onPress={() => a.onPress(nav)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function ActionTile({ icon, title, desc, color, hero, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[s.tile, hero && s.tileHero]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[s.tileIcon, { backgroundColor: color + '1f' }, hero && s.tileIconHero]}>
        <Text style={s.tileIconText}>{icon}</Text>
      </View>
      <View style={s.tileBody}>
        <Text style={[s.tileTitle, hero && { color }]} numberOfLines={1}>{title}</Text>
        <Text style={s.tileDesc} numberOfLines={2}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 44 },
  totalsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  totalBox: {
    flex: 1, borderRadius: 12, padding: 16, alignItems: 'center',
    elevation: 2, minHeight: 86, justifyContent: 'center',
  },
  totalNum: { color: '#fff', fontSize: 28, fontWeight: '800' },
  totalLbl: { color: '#ffffffcc', fontSize: 10, letterSpacing: 1, marginTop: 2, textAlign: 'center' },
  muted: { color: C.muted, paddingVertical: 6 },
  drillRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f0f2ee',
  },
  drillLabel: { color: C.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  drillValue: { color: C.primary, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48.4%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 104,
    elevation: 1,
  },
  tileHero: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#f2d9a7',
    backgroundColor: '#fffdf7',
    elevation: 2,
    minHeight: 76,
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  tileIconHero: { marginBottom: 0, marginRight: 12, width: 46, height: 46, borderRadius: 12 },
  tileIconText: { fontSize: 20 },
  tileBody: { flex: 1 },
  tileTitle: { fontSize: 13, fontWeight: '800', color: C.text, letterSpacing: 0.5, marginBottom: 3 },
  tileDesc: { fontSize: 11.5, color: C.muted, lineHeight: 15 },
});
