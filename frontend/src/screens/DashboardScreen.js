/**
 * DASHBOARD - one clean, information-rich overview of the day's business.
 *   KPI row (Lots · Boxes · Collected · Outstanding)
 *   → quick "New Inward" action
 *   → auction status · cashier snapshot · vehicle-wise · source-wise
 * Main module navigation lives in the SIDEBAR (☰) - not duplicated here.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { ScrollView } from 'react-native';
import { get, getSession } from '../api';
import { Card, Row, Screen, C, Loading, SectionTitle } from '../components/ui';

export default function DashboardScreen({ nav }) {
  const [data, setData] = useState(null);      // /inwards/consolidated
  const [cashier, setCashier] = useState(null); // /cashier/summary
  const [lots, setLots] = useState(null);       // /lots (auction status)
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const session = getSession();

  const load = useCallback(async () => {
    try {
      const [consolidated, summary, lotList] = await Promise.all([
        get('/inwards/consolidated'),
        get('/cashier/summary').catch(() => null), // non-fatal if unreachable
        get('/lots').catch(() => null),
      ]);
      setData(consolidated);
      setCashier(summary);
      setLots(lotList);
      setErr('');
    } catch (e) { setErr(e.message); }
  }, []);

  React.useEffect(() => { const t = setInterval(load, 5000); load(); return () => clearInterval(t); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Auction pipeline from the live lot list.
  const pendingAuction = (lots || []).filter((l) => Number(l.remaining_quantity) > 0);
  const openLots = pendingAuction.length;

  /** Open the drill-down detail PAGE for one vehicle or source. */
  const openDrill = useCallback((type, key) => {
    nav.push('drillDown', { type, key });
  }, [nav]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Screen title="Dashboard" nav={nav} error={err}>
      <ScrollView
        contentContainerStyle={s.content}
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
      >
        <View style={s.greetingRow}>
          <Text style={s.greetDate}>{today} · {session ? session.name : ''}</Text>
        </View>

        {!data && <Loading label="Loading today's data…" />}
        {data && (
          <>
            {/* KPI ROW */}
            <View style={s.kpiGrid}>
              <Kpi icon="📦" label="TODAY'S LOTS" value={data.today_total_lots} color={C.primary} />
              <Kpi icon="🧰" label="TODAY'S BOXES" value={data.today_total_boxes} color={C.accentDark} />
              <Kpi icon="💰" label="COLLECTED TODAY" value={`₹${cashier ? Number(cashier.collected).toLocaleString('en-IN') : '—'}`} color={C.ok} />
              <Kpi icon="⚠" label="OUTSTANDING" value={cashier ? `₹${Number(cashier.outstanding_amount).toLocaleString('en-IN')}` : '—'}
                color={C.tomato} sub={cashier ? `${cashier.outstanding_bills} bills` : ''} />
            </View>

            {/* PRIMARY ACTION - the one action that starts the core workflow */}
            <TouchableOpacity
              style={s.newInward}
              onPress={() => nav.push('sourceSelect')}
              accessibilityRole="button"
              accessibilityLabel="Start new inward entry"
            >
              <View style={s.newInwardIcon}><Text style={s.newInwardIconText}>＋</Text></View>
              <View style={s.newInwardBody}>
                <Text style={s.newInwardTitle}>NEW INWARD ENTRY</Text>
                <Text style={s.newInwardDesc}>Farmer · Trader · Outside Trader · Night Arrival</Text>
              </View>
              <Text style={s.newInwardArrow}>›</Text>
            </TouchableOpacity>

            {/* AUCTION PIPELINE */}
            <Card>
              <View style={s.cardHead}>
                <SectionTitle>Auction Status (today)</SectionTitle>
                {openLots > 0 && <Text style={s.chipWarn}>{openLots} awaiting auction</Text>}
              </View>
              <Row label="Lots with stock remaining" value={lots ? String(openLots) : '—'} />
              <Row label="Night arrivals pending rate fix"
                value={lots ? String((lots || []).filter((l) => l.purchase_source === 'night_arrival' && !l.final_rate).length) : '—'} />
              {openLots > 0 && (
                <TouchableOpacity onPress={() => nav.go('liveAuction')} accessibilityRole="button" accessibilityLabel="Open live auction">
                  <Text style={s.linkAction}>🔨 Go to Live Auction ›</Text>
                </TouchableOpacity>
              )}
            </Card>

            {/* CASHIER SNAPSHOT */}
            {cashier && (
              <Card>
                <View style={s.cardHead}>
                  <SectionTitle>Cashier (today)</SectionTitle>
                  <Text style={s.chipOk}>{cashier.payment_count} payments</Text>
                </View>
                {cashier.by_method.length === 0 && <Text style={s.muted}>No collections yet today.</Text>}
                {cashier.by_method.map((m) => (
                  <Row key={m.method} label={m.method.toUpperCase()} value={`₹${Number(m.amount).toLocaleString('en-IN')} · ${m.count}`} />
                ))}
                <Row label="Outstanding" value={`${cashier.outstanding_bills} bills · ₹${Number(cashier.outstanding_amount).toLocaleString('en-IN')}`} strong />
                <TouchableOpacity onPress={() => nav.go('cashier')} accessibilityRole="button" accessibilityLabel="Open cashier">
                  <Text style={s.linkAction}>💰 Open Cashier ›</Text>
                </TouchableOpacity>
              </Card>
            )}

            {/* VEHICLE-WISE */}
            <Card>
              <View style={s.cardHead}>
                <SectionTitle>Vehicle-wise (today)</SectionTitle>
                <Text style={s.chip}>{data.vehicle_wise.length} vehicles</Text>
              </View>
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

            {/* SOURCE-WISE */}
            <Card>
              <View style={s.cardHead}>
                <SectionTitle>Source-wise (today)</SectionTitle>
                <Text style={s.chip}>{data.source_wise.length} sources</Text>
              </View>
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
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Kpi({ icon, label, value, color, sub }) {
  return (
    <View style={[s.kpi, { borderLeftColor: color }]}>
      <Text style={s.kpiIcon}>{icon}</Text>
      <Text style={s.kpiValue} adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}>{value}</Text>
      <Text style={s.kpiLabel} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={s.kpiSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 44 },
  greetingRow: { marginBottom: 12 },
  greetDate: { fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  kpi: {
    width: '48.4%', backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.border, borderLeftWidth: 4, elevation: 1, minHeight: 92,
    justifyContent: 'center',
  },
  kpiIcon: { fontSize: 15, marginBottom: 2 },
  kpiValue: { fontSize: 19, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
  kpiLabel: { fontSize: 10, color: C.muted, letterSpacing: 0.8, marginTop: 2 },
  kpiSub: { fontSize: 10.5, color: C.muted, fontWeight: '700', marginTop: 1 },

  newInward: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary,
    borderRadius: 12, padding: 14, marginBottom: 12, elevation: 3, gap: 12,
  },
  newInwardIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff26',
    alignItems: 'center', justifyContent: 'center',
  },
  newInwardIconText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  newInwardBody: { flex: 1 },
  newInwardTitle: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  newInwardDesc: { color: '#ffffffcc', fontSize: 11.5, marginTop: 2 },
  newInwardArrow: { color: C.accent, fontSize: 26, fontWeight: '800' },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chip: {
    backgroundColor: '#eef0ec', color: C.muted, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2, fontSize: 10.5, fontWeight: '700',
    overflow: 'hidden',
  },
  chipWarn: {
    backgroundColor: '#fdf3e0', color: C.accentDark, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2, fontSize: 10.5, fontWeight: '700',
    overflow: 'hidden',
  },
  chipOk: {
    backgroundColor: C.primaryLight, color: C.primary, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2, fontSize: 10.5, fontWeight: '700',
    overflow: 'hidden',
  },
  linkAction: { color: C.primary, fontWeight: '800', fontSize: 13, marginTop: 8 },
  muted: { color: C.muted, paddingVertical: 6 },

  drillRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f0f2ee',
  },
  drillLabel: { color: C.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textTransform: 'capitalize' },
  drillValue: { color: C.primary, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
});
