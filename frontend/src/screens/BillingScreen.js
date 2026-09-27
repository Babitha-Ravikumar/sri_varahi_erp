/**
 * Billing - bills generated from allocations; pay screen available inline.
 * FILTERS: status (Paid / Unpaid / Part-paid), date, and lot-number search
 * (3-digit form supported) - all filters combine.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, Alert, Linking, StyleSheet } from 'react-native';
import { get, post, billPdfUrl } from '../api';
import { Card, Btn, Screen, Row, Field, Chip, SectionTitle, C, Badge, Empty, lotSeq } from '../components/ui';
import SuccessModal from '../components/SuccessModal';

const STATUS_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'part_paid', label: 'Partially Paid' },
];

export default function BillingScreen({ nav }) {
  const [bills, setBills] = useState(null);
  const [err, setErr] = useState('');
  const [paid, setPaid] = useState(null);

  // filters (kept in state; list is refetched only when the date changes)
  const [statusF, setStatusF] = useState('all');
  const [dateF, setDateF] = useState('all'); // 'all' or YYYY-MM-DD
  const [lotQ, setLotQ] = useState('');

  const load = useCallback(async (date) => {
    try {
      setBills(await get(`/bills?date=${encodeURIComponent(date || 'all')}`)); setErr('');
    } catch (e) { setErr(e.message); }
  }, []);
  React.useEffect(() => { load(dateF); }, [dateF, load]);

  async function pay(bill) {
    const detail = await get(`/bills/${bill.id}`);
    try {
      await post(`/bills/${bill.id}/payments`, { amount: detail.balance, method: 'cash' });
      setPaid({ bill: bill.bill_number, customer: bill.customer_name, amount: Number(detail.balance) });
      load(dateF);
    } catch (e) { Alert.alert('Error', e.message); }
  }

  const text = lotQ.trim().toLowerCase();
  const filtered = (bills || []).filter((b) => {
    if (statusF !== 'all' && b.status !== statusF) return false;
    if (text && !lotSeq(b.lot_number).toLowerCase().includes(text)
              && !String(b.lot_number).toLowerCase().includes(text)) return false;
    return true;
  });

  return (
    <Screen title="Billing" nav={nav} onBack={nav.pop} error={err}>
      <Card>
        <SectionTitle>Filter Bills</SectionTitle>
        <Field label="Search by Lot Number" value={lotQ} onChangeText={setLotQ} placeholder="e.g. 001 / 010" />
        <Field label="Date (YYYY-MM-DD, blank = all dates)" value={dateF === 'all' ? '' : dateF}
          onChangeText={(t) => setDateF(t.trim() || 'all')} placeholder="e.g. 2026-09-27" />
        <View style={s.chipRow}>
          {STATUS_CHIPS.map((sc) => (
            <Chip key={sc.key} label={sc.label} active={statusF === sc.key} onPress={() => setStatusF(sc.key)} />
          ))}
        </View>
        <Text style={s.filterInfo}>{filtered.length} of {(bills || []).length} bills shown</Text>
      </Card>

      {filtered.map((b) => (
        <Card key={b.id}>
          <View style={s.head}>
            <Text style={s.billNo}>{b.bill_number}</Text>
            <Badge tone={b.status === 'paid' ? 'success' : b.status === 'part_paid' ? 'warning' : 'danger'}>
              {b.status.replace(/_/g, ' ')}
            </Badge>
          </View>
          <Row label="Customer" value={b.customer_name} />
          <Row label="Lot" value={lotSeq(b.lot_number)} />
          <Row label="Date" value={(b.created_at || '').slice(0, 10)} />
          <Row label="Amount" value={`₹${Number(b.total_amount)}`} strong />
          <Row label="Paid" value={`₹${Number(b.paid_amount)}`} />
          <Row label="Balance" value={`₹${Number(b.total_amount) - Number(b.paid_amount)}`} />
          {Number(b.total_amount) > Number(b.paid_amount) && (
            <Btn title="💰 Take Payment (Cashier)" kind="accent" onPress={() => pay(b)} />
          )}
          <Btn title="⬇ Download PDF" onPress={() => Linking.openURL(billPdfUrl(b.id)).catch((e) => Alert.alert('Download failed', e.message))} />
          <Btn title="View items" onPress={() => nav.push('cashier', { billId: b.id })} />
        </Card>
      ))}
      {bills && filtered.length === 0 && (
        <Empty>No bills match the current filters.</Empty>
      )}

      <SuccessModal
        visible={!!paid}
        onClose={() => setPaid(null)}
        title="Bill Settled ✓"
        sections={[{
          title: 'PAYMENT DETAILS',
          rows: [
            ['Bill', paid?.bill || '-'],
            ['Customer', paid?.customer || '-'],
            ['Amount', `₹${paid?.amount}`],
            ['Method', 'CASH'],
            ['Status', 'Paid in full'],
          ],
        }]}
        actions={[{ title: 'Done', kind: 'primary', onPress: () => setPaid(null) }]}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  billNo: { fontSize: 15, fontWeight: '800', color: C.text, flexShrink: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  filterInfo: { fontSize: 12, color: C.muted, marginTop: 8 },
});
