/**
 * TOP CUSTOMERS - the complete customer-wise sales list behind the
 * dashboard's Top 5 ("Load More"). Uses the dashboard's filters
 * (params.query) and reads GET /dashboard/top-customers.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { get } from '../api';
import { Screen, C, Loading, Empty, Toolbar, ToolInput, ToolCount, ClearFilters } from '../components/ui';

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const inr2 = (n) => `₹${(Number(n) || 0).toFixed(2)}`;
const qty = (n) => (Number(n) || 0).toLocaleString('en-IN');

const COLUMNS = [
  { key: 'rank', title: '#', flex: 0.4, minWidth: 34, right: true },
  { key: 'name', title: 'Customer', flex: 1.8, minWidth: 150 },
  { key: 'lots', title: 'Lots', flex: 0.6, minWidth: 52, right: true },
  { key: 'boxes', title: 'Boxes', flex: 0.8, minWidth: 68, right: true },
  { key: 'rate', title: 'Avg Rate', flex: 0.9, minWidth: 84, right: true },
  { key: 'amount', title: 'Amount', flex: 1.1, minWidth: 100, right: true },
  { key: 'share', title: 'Share', flex: 0.7, minWidth: 62, right: true },
];
const TABLE_MIN_WIDTH = COLUMNS.reduce((a, c) => a + c.minWidth, 0) + 20;
const col = (i) => ({ flex: COLUMNS[i].flex, minWidth: COLUMNS[i].minWidth, textAlign: COLUMNS[i].right ? 'right' : 'left' });

export default function TopCustomersScreen({ nav, params = {} }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await get(`/dashboard/top-customers${params.query ? `?${params.query}` : ''}`));
      setErr('');
    } catch (e) { setErr(e.message); }
  }, [params.query]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const list = data ? data.customers : [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q));
  }, [data, search]);

  return (
    <Screen
      title="Top Customers"
      nav={nav}
      onBack={nav.pop}
      error={err}
      toolbar={(
        <Toolbar>
          <ToolInput value={search} onChangeText={setSearch} placeholder="Search customer / phone" />
          {data ? <ToolCount shown={shown.length} total={data.customers.length} /> : null}
          {search ? <ClearFilters onPress={() => setSearch('')} /> : null}
        </Toolbar>
      )}
    >
      {params.scopeLabel ? <Text style={s.scope}>{params.scopeLabel}</Text> : null}
      {!data && <Loading label="Loading customers…" />}
      {data && (
        <>
          <View style={s.stats}>
            <Stat label="Customers" value={qty(data.total)} />
            <Stat label="Boxes sold" value={qty(data.total_quantity)} />
            <Stat label="Sales value" value={inr(data.total_value)} strong />
          </View>

          <View style={s.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
              <View style={[s.table, { minWidth: TABLE_MIN_WIDTH }]}>
                <View style={[s.tr, s.thead]}>
                  {COLUMNS.map((c, i) => (
                    <Text key={c.key} style={[s.th, col(i)]} numberOfLines={1}>{c.title}</Text>
                  ))}
                </View>
                {data.customers.length === 0 && <Empty>No customer sales for this view.</Empty>}
                {data.customers.length > 0 && shown.length === 0 && <Empty>No customers match “{search.trim()}”.</Empty>}
                {shown.map((c, i) => (
                  <View key={c.customer_id} style={[s.tr, i % 2 === 1 && s.trAlt]}>
                    <Text style={[s.td, s.rank, col(0)]}>{c.rank}</Text>
                    <View style={[s.nameCell, col(1)]}>
                      <Text style={s.name} numberOfLines={1}>{c.name}</Text>
                      {c.phone ? <Text style={s.phone} numberOfLines={1}>{c.phone}</Text> : null}
                    </View>
                    <Text style={[s.td, col(2)]}>{qty(c.lots)}</Text>
                    <Text style={[s.td, col(3)]}>{qty(c.quantity)}</Text>
                    <Text style={[s.td, col(4)]}>{inr2(c.avg_rate)}</Text>
                    <Text style={[s.td, s.amount, col(5)]}>{inr(c.value)}</Text>
                    <Text style={[s.td, col(6)]}>{c.share.toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, strong }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, strong && { color: C.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  scope: { fontSize: 12.5, color: C.muted, fontWeight: '600', marginBottom: 10 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingVertical: 10, paddingHorizontal: 10,
  },
  statLabel: { fontSize: 11, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 17, fontWeight: '900', color: C.text, marginTop: 3, fontVariant: ['tabular-nums'] },

  tableCard: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  hScroll: { flexGrow: 1 },
  table: { flex: 1 },
  tr: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, minHeight: 50,
    borderBottomWidth: 1, borderBottomColor: '#eef0ec',
  },
  trAlt: { backgroundColor: '#fafbfa' },
  thead: { backgroundColor: C.primaryLight, minHeight: 40, borderBottomColor: '#cfe4d1' },
  th: { fontSize: 11, fontWeight: '800', color: C.primaryDark, letterSpacing: 0.5, textTransform: 'uppercase' },
  td: { fontSize: 13.5, color: C.text, fontVariant: ['tabular-nums'] },
  rank: { color: C.accentDark, fontWeight: '800' },
  nameCell: { justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: C.text },
  phone: { fontSize: 12, color: C.muted, marginTop: 1 },
  amount: { color: C.primary, fontWeight: '800' },
});
