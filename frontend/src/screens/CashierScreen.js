/**
 * Cashier - collect payments, daily collection summary.
 * CASH: direct record.
 * UPI: opens the device's UPI apps (Google Pay / PhonePe / Paytm …) via a
 *      standard upi:// deep link; the user completes payment in their chosen
 *      app, then confirms here to record it.
 * BANK: bank detail fields (bank name, UTR/reference) appear ONLY when Bank
 *      is selected, and are stored with the payment.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, Alert, Linking } from 'react-native';
import { get, post } from '../api';
import { Card, Field, Btn, Screen, Row, C, Badge, Chip, SectionTitle } from '../components/ui';
import SuccessModal from '../components/SuccessModal';

/** Market's UPI ID (VPA) shown in the payment apps. Change here when needed. */
const UPI_VPA = 'srivarahimarket@upi';
const UPI_PAYEE_NAME = 'Sri Varahi Market';

function upiIntentUrl({ vpa, name, amount, note }) {
  const q = [
    `pa=${encodeURIComponent(vpa)}`,
    `pn=${encodeURIComponent(name)}`,
    `am=${encodeURIComponent(Number(amount).toFixed(2))}`,
    'cu=INR',
    `tn=${encodeURIComponent(note)}`,
  ].join('&');
  return `upi://pay?${q}`;
}

export default function CashierScreen({ nav, params }) {
  const [summary, setSummary] = useState(null);
  const [bills, setBills] = useState(null);
  const [err, setErr] = useState('');
  const [bill, setBill] = useState(params.billId ? null : null);
  // collected-payment success popup
  const [collected, setCollected] = useState(null);

  // filters: date for the day's summary + bill list; status & search for the list
  const [dateF, setDateF] = useState('');
  const [statusF, setStatusF] = useState('due'); // due = unpaid + part_paid
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const d = dateF.trim() || '';
      setSummary(await get(`/cashier/summary${d ? `?date=${encodeURIComponent(d)}` : ''}`));
      // bills: the selected date, or ALL dates when no date is set
      setBills(await get(`/bills?date=${d ? encodeURIComponent(d) : 'all'}`));
      if (params.billId) setBill(await get(`/bills/${params.billId}`));
      setErr('');
    } catch (e) { setErr(e.message); }
  }, [params.billId, dateF]);
  React.useEffect(() => { load(); }, [load]);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  // bank payment details (shown only when method === 'bank')
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [utr, setUtr] = useState('');

  function resetEntry() {
    setAmount(''); setBankName(''); setAccountHolder(''); setUtr('');
  }

  async function record(reference) {
    const r = await post(`/bills/${bill.id}/payments`, {
      amount: Number(amount), method, ...(reference ? { reference } : {}),
    });
    setCollected({
      bill: bill.bill_number,
      customer: bill.customer_name,
      amount: Number(amount),
      method: method.toUpperCase(),
      reference: reference || null,
      billStatus: String(r.bill_status).replace(/_/g, ' '),
      balance: Number(r.balance),
    });
    resetEntry();
    load();
  }

  async function collect() {
    try {
      if (method === 'cash') return void await record();

      if (method === 'upi') {
        // Open the UPI app chooser (Google Pay / PhonePe / Paytm / BHIM …)
        const url = upiIntentUrl({
          vpa: UPI_VPA, name: UPI_PAYEE_NAME, amount: Number(amount),
          note: `Bill ${bill.bill_number}`,
        });
        try {
          await Linking.openURL(url);
        } catch (e) {
          Alert.alert('No UPI app', 'No UPI payment app found on this device. Install Google Pay, PhonePe or Paytm to pay by UPI.');
          return;
        }
        // The user finishes in the UPI app; confirm here to record it.
        Alert.alert(
          'Complete UPI payment',
          `Complete the payment of ₹${amount} in your UPI app, then confirm here.`,
          [
            { text: 'Not paid', style: 'cancel' },
            { text: 'Payment done ✓', onPress: () => record(`UPI ${UPI_VPA}`) },
          ]
        );
        return;
      }

      if (method === 'bank') {
        if (!bankName.trim() || !utr.trim()) {
          Alert.alert('Bank details required', 'Enter the bank name and the UTR / reference number of the transfer.');
          return;
        }
        const reference = [bankName.trim(), accountHolder.trim() && `A/C ${accountHolder.trim()}`, `UTR ${utr.trim()}`]
          .filter(Boolean).join(' · ');
        await record(reference);
      }
    } catch (e) { Alert.alert('Error', e.message); }
  }

  const bankValid = method !== 'bank' || (bankName.trim() && utr.trim());
  const mainTitle =
    method === 'cash' ? '💵 Collect Cash Payment'
    : method === 'upi' ? `📱 Open UPI Apps & Pay ₹${amount || '…'}`
    : '🏦 Record Bank Payment';

  const text = q.trim().toLowerCase();
  const filteredBills = (bills || []).filter((b) => {
    if (statusF === 'due' && b.status !== 'unpaid' && b.status !== 'part_paid') return false;
    if (statusF !== 'due' && statusF !== 'all' && b.status !== statusF) return false;
    if (text
      && !String(b.bill_number).toLowerCase().includes(text)
      && !String(b.customer_name || '').toLowerCase().includes(text)
      && !String(b.lot_number || '').toLowerCase().includes(text)
      && !String(b.lot_number || '').split('-').pop().startsWith(text)) return false;
    return true;
  });

  return (
    <Screen title="Cashier" nav={nav} onBack={nav.pop} error={err}>
      <Card>
        <SectionTitle>Filter</SectionTitle>
        <Field label="Date (YYYY-MM-DD, blank = all dates)" value={dateF} onChangeText={setDateF} placeholder="e.g. 2026-09-27" />
        <Field label="Search bill / customer / lot" value={q} onChangeText={setQ} placeholder="e.g. B-2026… / Ramesh / 001" />
        <View style={s.chipRow}>
          <Chip label="Due" active={statusF === 'due'} onPress={() => setStatusF('due')} />
          <Chip label="Unpaid" active={statusF === 'unpaid'} onPress={() => setStatusF('unpaid')} />
          <Chip label="Partially Paid" active={statusF === 'part_paid'} onPress={() => setStatusF('part_paid')} />
          <Chip label="Paid" active={statusF === 'paid'} onPress={() => setStatusF('paid')} />
          <Chip label="All" active={statusF === 'all'} onPress={() => setStatusF('all')} />
        </View>
        <Text style={s.filterInfo}>{filteredBills.length} of {(bills || []).length} bills shown</Text>
      </Card>

      {summary && (
        <Card>
          <Row label={dateF.trim() ? `Collected (${dateF.trim()})` : 'Collected (all dates)'} value={`₹${summary.collected}`} strong />
          <Row label="Payments" value={String(summary.payment_count)} />
          {summary.by_method.map((m) => (
            <Row key={m.method} label={m.method.toUpperCase()} value={`₹${Number(m.amount)} (${m.count})`} />
          ))}
          <Row label="Outstanding" value={`${summary.outstanding_bills} bills · ₹${summary.outstanding_amount}`} />
        </Card>
      )}

      {bill && (
        <Card style={{ borderWidth: 2, borderColor: C.accent }}>
          <Text style={s.t}>{bill.bill_number} · {bill.customer_name}</Text>
          <Row label="Total" value={`₹${Number(bill.total_amount)}`} />
          <Row label="Paid" value={`₹${Number(bill.paid_amount)}`} />
          <Row label="Balance" value={`₹${bill.balance}`} strong />
          {bill.items && bill.items.map((it) => (
            <Row key={it.id} label={`${Number(it.quantity)} boxes @ ₹${Number(it.rate)}`} value={`₹${Number(it.amount)}`} />
          ))}
          <Field label="Amount received" value={amount} onChangeText={setAmount} keyboard="numeric"
            placeholder={String(bill.balance)} />
          <View style={s.methodRow}>
            {['cash', 'upi', 'bank'].map((m) => (
              <Btn key={m} title={{ cash: '💵 CASH', upi: '📱 UPI', bank: '🏦 BANK' }[m]}
                kind={method === m ? 'accent' : 'secondary'}
                onPress={() => setMethod(m)} style={s.methodBtn} />
            ))}
          </View>

          {/* BANK details fields - ONLY when Bank is selected */}
          {method === 'bank' && (
            <View style={s.bankBox}>
              <Text style={s.bankHead}>Bank transfer details</Text>
              <Field label="Bank name *" value={bankName} onChangeText={setBankName} placeholder="e.g. State Bank of India" />
              <Field label="Account holder (from whom)" value={accountHolder} onChangeText={setAccountHolder} placeholder="e.g. Ramesh Kumar" />
              <Field label="UTR / Reference number *" value={utr} onChangeText={setUtr} placeholder="e.g. UTR 123456789012" />
            </View>
          )}
          {method === 'upi' && (
            <Text style={s.hint}>Opens Google Pay / PhonePe / Paytm — pay ₹{amount || bill.balance} to {UPI_VPA}, then confirm.</Text>
          )}

          <Btn title={mainTitle} onPress={collect} disabled={!(Number(amount) > 0) || !bankValid} />
        </Card>
      )}

      <SectionTitle>{statusF === 'due' ? 'Unpaid / part-paid bills' : 'Bills'}</SectionTitle>
      {filteredBills.map((b) => (
        <Card key={b.id}>
          <View style={s.head}>
            <Text style={s.billNo}>{b.bill_number}</Text>
            <Badge tone={b.status === 'paid' ? 'success' : b.status === 'part_paid' ? 'warning' : 'danger'}>
              {b.status.replace(/_/g, ' ')}
            </Badge>
          </View>
          <Row label="Customer" value={b.customer_name} />
          <Row label="Lot" value={String(b.lot_number || '').split('-').pop()} />
          <Row label="Balance" value={`₹${Number(b.total_amount) - Number(b.paid_amount)}`} />
          <Btn title="Collect" kind="accent" onPress={async () => setBill(await get(`/bills/${b.id}`))} />
        </Card>
      ))}

      <SuccessModal
        visible={!!collected}
        onClose={() => setCollected(null)}
        title="Payment Collected ✓"
        sections={[{
          title: 'PAYMENT DETAILS',
          rows: [
            ['Bill', collected?.bill || '-'],
            ['Customer', collected?.customer || '-'],
            ['Amount', `₹${collected?.amount}`],
            ['Method', collected?.method],
            ...(collected?.reference ? [['Reference', collected.reference]] : []),
            ['Bill status', collected?.billStatus],
            ['Balance due', `₹${collected?.balance}`],
          ],
        }]}
        actions={[{ title: 'Done', kind: 'primary', onPress: () => setCollected(null) }]}
      />
    </Screen>
  );
}

const s = {
  t: { fontWeight: '700', marginBottom: 4, fontSize: 15, color: C.text },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  billNo: { fontSize: 15, fontWeight: '800', color: C.text, flexShrink: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  filterInfo: { fontSize: 12, color: C.muted, marginTop: 8 },
  methodRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  methodBtn: { flex: 1, marginTop: 0, paddingHorizontal: 4 },
  bankBox: {
    marginTop: 10, padding: 10, borderRadius: 10,
    backgroundColor: '#fffaf0', borderWidth: 1, borderColor: '#e8d9b8',
  },
  bankHead: { fontWeight: '800', fontSize: 12, color: C.accentDark, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  hint: { color: C.muted, fontSize: 12, marginTop: 8, textAlign: 'center', lineHeight: 17 },
};
