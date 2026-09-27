/**
 * LIVE AUCTION - the mandi's core screen. Optimized for minimum taps:
 *   pick lot → details auto-appear → type rate/qty → pick or type customer → SAVE
 * All on one screen; totals update in real time after every save.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking } from 'react-native';
import { get, post, billPdfUrl } from '../api';
import {
  Card, Field, SearchSelect, ComboPicker, Btn, Screen, Row, C, lotSeq,
  Toolbar, DateField, ToolCount, ClearFilters,
} from '../components/ui';
import SuccessModal from '../components/SuccessModal';

export default function LiveAuctionScreen({ nav, params }) {
  const [lots, setLots] = useState(null);
  const [lotId, setLotId] = useState(params.lotId || null);
  const [auction, setAuction] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [err, setErr] = useState('');

  // single customer field: search existing OR type new (one control)
  const [customerText, setCustomerText] = useState('');
  const [customerId, setCustomerId] = useState(null);

  // single-line entry: rate, quantity
  const [rate, setRate] = useState('');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  // success popups
  const [saved, setSaved] = useState(null);      // allocation saved
  const [billsDone, setBillsDone] = useState(null); // bills generated

  // Lot date filter: none = today's open lots (default), YYYY-MM-DD = that day.
  const [dateF, setDateF] = useState('');
  const lotsPath = dateF ? `/lots?date=${encodeURIComponent(dateF)}` : '/lots';

  const loadLots = useCallback(async () => {
    try {
      const all = await get(lotsPath);
      setLots(all);
      setLotId((cur) => (cur && all.some((l) => String(l.id) === String(cur)) ? cur : (all[0] ? all[0].id : null)));
      setErr('');
    } catch (e) { setErr(e.message); }
  }, [lotsPath]);

  const loadAuction = useCallback(async () => {
    if (!lotId) { setAuction(null); return; }
    try {
      const auc = await post('/auctions', { lot_id: lotId });
      setAuction(auc);
      setErr('');
    } catch (e) { setAuction(null); setErr(e.message); }
  }, [lotId]);

  useEffect(() => { get('/customers').then(setCustomers).catch((e) => setErr('Customers could not be loaded: ' + e.message)); }, []);
  useEffect(() => { loadLots(); }, [lotsPath]);
  useEffect(() => { loadAuction(); }, [loadAuction]);

  async function saveAllocation() {
    setSaving(true); setErr('');
    try {
      const r = await post(`/auctions/${auction.id}/allocations`, {
        customer_id: customerId || undefined,
        customer_name: customerId ? undefined : customerText.trim(),
        quantity: Number(qty), rate: Number(rate),
      });
      // keep rate & customer for the next rapid allocation - minimum taps
      setQty('');
      setAuction(await get(`/auctions/${auction.id}`));
      setLots(await get(lotsPath));
      setSaved({
        customer: r.customer.name,
        quantity: Number(r.allocation.quantity),
        rate: Number(rate),
        remaining: Number(r.lot.remaining_quantity),
      });
    } catch (e) { setErr(e.message); Alert.alert('Rejected', e.message); }
    finally { setSaving(false); }
  }

  async function generateBills() {
    try {
      const bills = await post(`/billing/auction/${auction.id}`);
      // Auto-download every generated bill as a PDF (browser/download manager
      // saves it via Content-Disposition: attachment).
      for (const b of bills) {
        try { await Linking.openURL(billPdfUrl(b.id)); } catch (_) { /* download optional */ }
      }
      setBillsDone(bills.map((b) => ({ number: b.bill_number, customer: b.customer_name, amount: Number(b.total_amount) })));
      setAuction(await get(`/auctions/${auction.id}`));
    } catch (e) { Alert.alert('Error', e.message); }
  }

  const totalAllocated = auction ? auction.allocations.reduce((s, a) => s + Number(a.quantity), 0) : 0;
  const valid = auction && Number(qty) > 0 && Number(rate) >= 0 && (customerId || customerText.trim());
  const selectedLot = (lots || []).find((l) => String(l.id) === String(lotId));
  // searchable lot list: lots with stock, always including the selected lot
  const lotItems = (lots || []).filter((l) => Number(l.remaining_quantity) > 0 || String(l.id) === String(lotId));

  return (
    <Screen
      title="Live Auction"
      nav={nav}
      onBack={nav.pop}
      error={err}
      toolbar={(
        <Toolbar trailing={<ClearFilters onPress={() => setDateF('')} />}>
          <DateField value={dateF} onChange={setDateF} allLabel="Today's lots" />
          <ToolCount shown={lotItems.length} total={(lots || []).length} />
        </Toolbar>
      )}
    >
      {/* Select Lot - live searchable dropdown (type lot number / party / vehicle) */}
      <Card>
        <SearchSelect label="Select Lot" items={lotItems} selectedId={lotId ? Number(lotId) : null}
          onSelect={setLotId} placeholder="Type to search lot…"
          renderLabel={(l) => `${lotSeq(l.lot_number)} · ${l.party_name || '-'} · ${l.vehicle_number || '-'} · ${Number(l.remaining_quantity)} left`} />
      </Card>

      {/* Lot details auto-appear */}
      {selectedLot && (
        <Card>
          <Text style={s.t}>Lot Details (auto)</Text>
          <Row label="Vehicle" value={selectedLot.vehicle_number || '-'} />
          <Row label="Supplier / Party" value={selectedLot.party_name || '-'} />
          <Row label="Quality Grade" value={selectedLot.quality || '-'} />
          <Row label="Total Quantity" value={`${Number(selectedLot.total_quantity)}`} />
          <Row label="Pre-Auction" value={`${Number(selectedLot.pre_auction_quantity)}`} />
          <Row label="REMAINING" value={`${Number(selectedLot.remaining_quantity)}`} strong />
        </Card>
      )}

      {/* Rate + Customer + Quantity - the allocation entry */}
      {auction && (
        <Card>
          <Text style={s.t}>Rate · Customer · Quantity</Text>
          <Field label="Rate (₹/box)" value={rate} onChangeText={setRate} keyboard="numeric" placeholder="e.g. 100" />
          <ComboPicker label="Customer" items={customers} value={customerText} onChangeText={setCustomerText}
            selectedId={customerId} onSelect={setCustomerId}
            placeholder="Search customer or type new name…" />
          <Field label="Quantity (boxes)" value={qty} onChangeText={setQty} keyboard="numeric" placeholder="e.g. 5" />
          <Btn title={saving ? 'Saving…' : 'SAVE ALLOCATION'} onPress={saveAllocation} disabled={!valid || saving} />
          {rate && qty ? <Text style={s.calc}>{qty} × ₹{rate} = ₹{(Number(qty) * Number(rate)).toFixed(2)}</Text> : null}
        </Card>
      )}

      {/* live allocation list */}
      {auction && (
        <Card>
          <View style={s.allocHeader}>
            <Text style={s.t}>Allocations</Text>
            <Text style={s.totalBadge}>{totalAllocated} / {Number(auction.total_quantity)} allocated · {Number(auction.remaining_quantity)} left</Text>
          </View>
          {auction.allocations.map((a) => (
            <View key={a.id} style={s.allocRow}>
              <Text style={s.allocCust}>{a.customer_name}</Text>
              <Text style={s.allocQty}>{Number(a.quantity)} @ ₹{Number(a.rate)} = ₹{(Number(a.quantity) * Number(a.rate)).toFixed(0)}</Text>
              <Text style={[s.allocStatus, a.status === 'paid' && { color: C.ok }]}>{a.status}</Text>
            </View>
          ))}
          {auction.allocations.length === 0 && <Text style={s.muted}>No allocations yet.</Text>}
        </Card>
      )}

      <SuccessModal
        visible={!!saved}
        onClose={() => setSaved(null)}
        title="Allocation Successful ✓"
        sections={[{
          title: 'ALLOCATION DETAILS',
          rows: [
            ['Lot Number', selectedLot ? lotSeq(selectedLot.lot_number) : '-'],
            ['Customer', saved?.customer || '-'],
            ['Quantity', `${saved?.quantity} boxes`],
            ['Rate', `₹${saved?.rate}`],
            ['Amount', `₹${((saved?.quantity || 0) * (saved?.rate || 0)).toFixed(2)}`],
            ['Remaining in lot', `${saved?.remaining} boxes`],
          ],
        }]}
        actionSectionTitle="NEXT ALLOCATION"
        actions={[
          { title: 'Generate Bill', kind: 'accent', onPress: () => { setSaved(null); generateBills(); } },
          { title: 'Correction', onPress: () => { setSaved(null); nav.push('corrections', { auctionId: auction.id }); } },
          { title: 'Done', kind: 'primary', onPress: () => setSaved(null) },
        ]}
      />

      <SuccessModal
        visible={!!billsDone}
        onClose={() => setBillsDone(null)}
        title="Bills Generated ✓"
        subtitle="Billing & Cashier updated automatically · PDFs downloading"
        sections={[{
          title: 'GENERATED BILLS',
          rows: (billsDone || []).map((b) => [b.number, `₹${b.amount}`]),
        }]}
        actions={[{ title: 'Done', kind: 'primary', onPress: () => setBillsDone(null) }]}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  t: { fontWeight: '800', marginBottom: 8, fontSize: 14, color: C.text, letterSpacing: 0.3 },
  calc: { textAlign: 'center', marginTop: 8, fontSize: 15, fontWeight: '700', color: C.primary },
  allocHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  totalBadge: { backgroundColor: C.primary, color: '#fff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: '700' },
  allocRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  allocCust: { fontWeight: '700', flex: 1 },
  allocQty: { color: '#444', fontSize: 13 },
  allocStatus: { color: C.accent, fontSize: 11, marginLeft: 6, textTransform: 'uppercase' },
  muted: { color: C.muted },
});
