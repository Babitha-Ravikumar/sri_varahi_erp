/**
 * Billing - bills generated from allocations; pay screen available inline.
 * FILTERS: status (Paid / Unpaid / Part-paid), date, lot-number search,
 * newest/oldest sort - all filters combine.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, Alert, Linking, StyleSheet } from 'react-native';
import { get, post, billPdfUrl } from '../api';
import {
  Card, Btn, Screen, Row, Chip, C, Badge, Empty, lotSeq, localDateKey,
  Toolbar, ToolInput, DateField, SortToggle, ToolCount, ClearFilters,
} from '../components/ui';
import SuccessModal from '../components/SuccessModal';
import { useReference, refLabel } from '../reference';

export default function BillingScreen({ nav }) {
  const billStatuses = useReference('bill_status');
  const [bills, setBills] = useState(null);
  const [err, setErr] = useState('');
  const [paid, setPaid] = useState(null);

  const [statusF, setStatusF] = useState('all');
  const [dateF, setDateF] = useState('');
  const [lotQ, setLotQ] = useState('');
  const [sort, setSort] = useState('newest');

  function clearFilters() {
    setStatusF('all');
    setDateF('');
    setLotQ('');
    setSort('newest');
  }

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
  }).sort((a, b) => {
    const da = new Date(a.created_at || 0), db = new Date(b.created_at || 0);
    return sort === 'newest' ? db - da : da - db;
  });

  return (
    <Screen
      title="Billing"
      nav={nav}
      onBack={nav.pop}
      error={err}
      toolbar={(
        <Toolbar trailing={<ClearFilters onPress={clearFilters} />}>
          <ToolInput value={lotQ} onChangeText={setLotQ} placeholder="Lot no." />
          <DateField value={dateF} onChange={setDateF} />
          <Chip label="All" active={statusF === 'all'} onPress={() => setStatusF('all')} />
          {billStatuses.filter((st) => st.selectable).map((st) => (
            <Chip key={st.code} label={st.label} active={statusF === st.code} onPress={() => setStatusF(st.code)} />
          ))}
          <SortToggle value={sort} onChange={setSort} />
          <ToolCount shown={filtered.length} total={(bills || []).length} />
        </Toolbar>
      )}
    >
      {filtered.map((b) => (
        <Card key={b.id}>
          <View style={s.head}>
            <Text style={s.billNo}>{b.bill_number}</Text>
            <Badge tone={b.status === 'paid' ? 'success' : b.status === 'part_paid' ? 'warning' : 'danger'}>
              {refLabel(billStatuses, b.status)}
            </Badge>
          </View>
          <Row label="Customer" value={b.customer_name} />
          <Row label="Lot" value={lotSeq(b.lot_number)} />
          <Row label="Date" value={localDateKey(b.created_at)} />
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
});
