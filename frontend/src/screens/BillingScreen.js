/** Billing - bills generated from allocations; pay screen available inline. */
import React, { useCallback, useState } from 'react';
import { View, Text, Alert, Linking } from 'react-native';
import { get, post, billPdfUrl } from '../api';
import { Card, Btn, Screen, Row, C, Badge, Empty, lotSeq } from '../components/ui';

export default function BillingScreen({ nav }) {
  const [bills, setBills] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try { setBills(await get('/bills')); setErr(''); } catch (e) { setErr(e.message); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function pay(bill) {
    const detail = await get(`/bills/${bill.id}`);
    try {
      await post(`/bills/${bill.id}/payments`, { amount: detail.balance, method: 'cash' });
      Alert.alert('Paid ✓', `${bill.bill_number} settled at cashier.`);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
  }

  return (
    <Screen title="Billing" onBack={nav.pop} error={err}>
      {(bills || []).map((b) => (
        <Card key={b.id}>
          <View style={s.head}>
            <Text style={s.billNo}>{b.bill_number}</Text>
            <Badge tone={b.status === 'paid' ? 'success' : b.status === 'part_paid' ? 'warning' : 'danger'}>
              {b.status.replace(/_/g, ' ')}
            </Badge>
          </View>
          <Row label="Customer" value={b.customer_name} />
          <Row label="Lot" value={lotSeq(b.lot_number)} />
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
      {bills && bills.length === 0 && (
        <Empty>No bills yet. Bills are generated from Live Auction allocations.</Empty>
      )}
    </Screen>
  );
}

const s = {
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  billNo: { fontSize: 15, fontWeight: '800', color: C.text, flexShrink: 1 },
};
