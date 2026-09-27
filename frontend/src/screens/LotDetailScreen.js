/**
 * Lot / Lot Card screen: everything linked to the lot identity.
 * LIST MODE: filterable lot list (lot-number search incl. 3-digit form,
 * date filter, newest/oldest sort).
 * Night-arrival actions open DEDICATED workflows:
 *   - params.fixRate  → "Fix Morning Final Rate" screen (rate fix only)
 *   - params.sellNight → "Sell to Customer" screen (night sale only)
 */
import React, { useCallback, useState } from 'react';
import { Text, Alert, View, StyleSheet } from 'react-native';
import { get, post } from '../api';
import { Card, Field, Btn, Screen, Row, C, Chip, SectionTitle, lotSeq } from '../components/ui';
import SuccessModal from '../components/SuccessModal';

export default function LotDetailScreen({ nav, params }) {
  const [lot, setLot] = useState(null);
  const [err, setErr] = useState('');
  const [rate, setRate] = useState('');
  // night-sale form
  const [custName, setCustName] = useState('');
  const [custQty, setCustQty] = useState('');
  // success popups
  const [sold, setSold] = useState(null);
  const [rateFixed, setRateFixed] = useState(null);

  const listMode = params.list;

  /* ---------- list mode (Lots page with filters) ---------- */
  const [lots, setLots] = useState(null);
  // filters
  const [q, setQ] = useState('');
  const [dateF, setDateF] = useState('');
  const [sort, setSort] = useState('newest'); // newest | oldest

  const loadList = useCallback(async () => {
    try { setLots(await get('/lots')); setErr(''); } catch (e) { setErr(e.message); }
  }, []);

  const load = useCallback(async (id) => {
    try { setLot(await get(`/lots/${id}`)); setErr(''); }
    catch (e) { setErr(e.message); }
  }, []);

  React.useEffect(() => {
    if (listMode) loadList();
    else if (params.lotId) load(params.lotId);
  }, [params.lotId]);

  if (listMode) {
    const text = q.trim().toLowerCase();
    const filtered = (lots || [])
      .filter((l) => {
        // Lot-number search: matches the 3-digit form (001) or the full number.
        if (text && !lotSeq(l.lot_number).toLowerCase().includes(text)
                  && !String(l.lot_number).toLowerCase().includes(text)) return false;
        if (dateF) {
          const d = (l.created_at || '').slice(0, 10);
          if (d !== dateF) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = new Date(a.created_at || 0), db = new Date(b.created_at || 0);
        return sort === 'newest' ? db - da : da - db;
      });

    return (
      <Screen title="Lots" nav={nav} onBack={nav.pop} error={err}>
        <Card>
          <SectionTitle>Filter Lots</SectionTitle>
          <Field label="Search by Lot Number" value={q} onChangeText={setQ} placeholder="e.g. 001 / 010" />
          <Field label="Date (YYYY-MM-DD)" value={dateF} onChangeText={setDateF} placeholder="e.g. 2026-09-27" />
          <View style={s.chipRow}>
            <Chip label="Newest First" active={sort === 'newest'} onPress={() => setSort('newest')} />
            <Chip label="Oldest First" active={sort === 'oldest'} onPress={() => setSort('oldest')} />
          </View>
          <Text style={s.filterInfo}>{filtered.length} of {(lots || []).length} lots shown</Text>
        </Card>

        {filtered.map((l) => (
          <Card key={l.id}>
            <Row label={lotSeq(l.lot_number)} value={l.status} strong />
            <Row label="Vehicle / Party" value={`${l.vehicle_number || '-'} · ${l.party_name || '-'}`} />
            <Row label="Quality" value={l.quality || '-'} />
            <Row label="Total / Remaining" value={`${Number(l.total_quantity)} / ${Number(l.remaining_quantity)}`} />
            <Btn title="Open" kind="secondary" onPress={() => nav.push('lotDetail', { lotId: l.id })} />
          </Card>
        ))}
        {lots && filtered.length === 0 && (
          <Text style={s.empty}>No lots match the current filters.</Text>
        )}
        {lots && lots.length === 0 && <Text style={s.empty}>No lots yet.</Text>}
      </Screen>
    );
  }

  if (!lot) return <Screen title="Lot" nav={nav} onBack={nav.pop} error={err} />;

  const isNight = lot.purchase_source === 'night_arrival';
  // Dedicated night-arrival workflows (clearly different screens).
  const fixRateMode = isNight && params.fixRate && !lot.final_rate;
  const sellMode = isNight && params.sellNight && !lot.final_rate;

  async function sellNight() {
    try {
      const r = await post(`/lots/${lot.id}/pre-auction`, {
        customer_name: custName, quantity: Number(custQty), rate: Number(lot.selling_price),
      });
      setSold({
        customer: r.customer.name,
        quantity: Number(custQty),
        rate: Number(lot.selling_price),
        remaining: Number(r.lot.remaining_quantity),
      });
      setCustName(''); setCustQty('');
      load(lot.id);
    } catch (e) { setErr(e.message); }
  }

  async function fixFinalRate() {
    try {
      const r = await post(`/inwards/${lot.inward_id || lot.id}/final-rate`, { final_rate: Number(rate) });
      setRateFixed({ finalRate: Number(rate), margin: Number(r.trade_margin) });
      setRate('');
      load(lot.id);
    } catch (e) { setErr(e.message); }
  }

  // ---- WORKFLOW 1: Fix Morning Final Rate (dedicated screen) ----
  if (fixRateMode) {
    return (
      <Screen title="Fix Morning Final Rate" nav={nav} onBack={nav.pop} error={err}>
        <Card style={s.workflowCard}>
          <Text style={s.workflowTitle}>FIX MORNING FINAL RATE</Text>
          <Text style={s.workflowSub}>
            Set the final purchase rate for night-arrival Lot {lotSeq(lot.lot_number)}. The trade
            margin is computed automatically from all predetermined-price sales.
          </Text>
          <Row label="Lot" value={lotSeq(lot.lot_number)} strong />
          <Row label="Party" value={lot.party_name || '-'} />
          <Row label="Vehicle" value={lot.vehicle_number || '-'} />
          <Row label="Quantity" value={`${Number(lot.total_quantity)} boxes`} />
          <Row label="Selling price (fixed)" value={`₹${Number(lot.selling_price)}/box`} />
          <Field label="Morning final rate (₹/box) *" value={rate} onChangeText={setRate} keyboard="numeric" placeholder="e.g. 85" />
          <Btn title="FIX FINAL RATE" onPress={fixFinalRate} disabled={!(Number(rate) >= 0)} />
          <Text style={s.hint}>Applies to the SAME inward - no duplicate entry. Supervisor/Admin only.</Text>
        </Card>
        <RateFixedModal lot={lot} rateFixed={rateFixed} setRateFixed={setRateFixed} />
      </Screen>
    );
  }

  // ---- WORKFLOW 2: Sell to Customer at predetermined price (dedicated screen) ----
  if (sellMode) {
    return (
      <Screen title="Sell to Customer" nav={nav} onBack={nav.pop} error={err}>
        <Card style={s.workflowCard}>
          <Text style={s.workflowTitle}>SELL NIGHT STOCK TO CUSTOMER</Text>
          <Text style={s.workflowSub}>
            Sell Lot {lotSeq(lot.lot_number)} at the predetermined price of ₹{Number(lot.selling_price)}/box.
            The customer name and quantity are all you enter.
          </Text>
          <Row label="Lot" value={lotSeq(lot.lot_number)} strong />
          <Row label="Party" value={lot.party_name || '-'} />
          <Row label="Remaining" value={`${Number(lot.remaining_quantity)} boxes`} strong />
          <Row label="Price (predetermined)" value={`₹${Number(lot.selling_price)}/box`} />
          <Field label="Customer name *" value={custName} onChangeText={setCustName} placeholder="e.g. Ramesh" />
          <Field label="Quantity (boxes) *" value={custQty} onChangeText={setCustQty} keyboard="numeric" placeholder="e.g. 5" />
          <Btn title="SELL TO CUSTOMER" kind="accent" onPress={sellNight} disabled={!custName.trim() || !(Number(custQty) > 0)} />
        </Card>

        <SuccessModal
          visible={!!sold}
          onClose={() => setSold(null)}
          title="Night Sale Recorded ✓"
          subtitle={`Lot ${lotSeq(lot.lot_number)} · predetermined price`}
          sections={[{
            title: 'SALE DETAILS',
            rows: [
              ['Customer', sold?.customer || '-'],
              ['Quantity', `${sold?.quantity} boxes`],
              ['Rate (predetermined)', `₹${sold?.rate}`],
              ['Amount', `₹${((sold?.quantity || 0) * (sold?.rate || 0)).toFixed(2)}`],
              ['Remaining in lot', `${sold?.remaining} boxes`],
            ],
          }]}
          actions={[
            { title: 'Sell Another', onPress: () => setSold(null) },
            { title: 'Done', kind: 'primary', onPress: () => nav.pop() },
          ]}
        />
      </Screen>
    );
  }

  // ---- default lot detail ----
  return (
    <Screen title={`Lot ${lotSeq(lot.lot_number)}`} nav={nav} onBack={nav.pop} error={err}>
      <Card>
        <Text style={s.t}>LOT CARD {lotSeq(lot.card_code)}</Text>
        <Row label="Vehicle" value={lot.vehicle_number || '-'} />
        {lot.vehicle_number && lot.driver_name ? <Row label="Driver" value={lot.driver_name} /> : null}
        <Row label="Supplier / Party" value={lot.party_name || '-'} />
        <Row label="Source" value={lot.purchase_source.replace(/_/g, ' ')} />
        <Row label="Quality" value={lot.quality || '-'} />
        <Row label="Total Quantity" value={`${Number(lot.total_quantity)} boxes`} strong />
        <Row label="Pre-Auction" value={`${Number(lot.pre_auction_quantity)} boxes`} />
        <Row label="Allocated" value={`${Number(lot.allocated_quantity)} boxes`} />
        <Row label="REMAINING" value={`${Number(lot.remaining_quantity)} boxes`} strong />
      </Card>

      {isNight && !lot.final_rate && (
        <Card>
          <Text style={s.t}>Night sale (predetermined ₹{Number(lot.selling_price)}/box)</Text>
          <Field label="Customer name" value={custName} onChangeText={setCustName} placeholder="e.g. Ramesh" />
          <Field label="Quantity" value={custQty} onChangeText={setCustQty} keyboard="numeric" />
          <Btn title="Sell" kind="accent" onPress={sellNight} disabled={!custName.trim() || !(Number(custQty) > 0)} />
        </Card>
      )}

      {isNight && !lot.final_rate && (
        <Card>
          <Text style={s.t}>Morning: fix final purchase rate</Text>
          <Field label="Final rate (₹/box)" value={rate} onChangeText={setRate} keyboard="numeric" />
          <Btn title="Fix Final Rate & Compute Margin" onPress={fixFinalRate} disabled={!(Number(rate) >= 0)} />
          <Text style={s.hint}>Applies to the SAME inward - no duplicate entry. Supervisor/Admin only.</Text>
        </Card>
      )}
      {isNight && lot.final_rate != null && (
        <Card>
          <Row label="Final rate" value={`₹${Number(lot.final_rate)}`} />
          <Row label="Trade margin" value={`₹${Number(lot.trade_margin)}`} strong />
        </Card>
      )}

      {lot.pre_auction_sales.length > 0 && (
        <Card>
          <Text style={s.t}>Pre-auction sales</Text>
          {lot.pre_auction_sales.map((p) => (
            <Row key={p.id} label={`${p.customer_name} · ${Number(p.quantity)} boxes`} value={`₹${Number(p.rate)} = ₹${Number(p.quantity) * Number(p.rate)}`} />
          ))}
        </Card>
      )}

      {lot.allocations.length > 0 && (
        <Card>
          <Text style={s.t}>Auction allocations</Text>
          {lot.allocations.map((a) => (
            <Row key={a.id} label={`${a.customer_name} · ${Number(a.quantity)} boxes`} value={`₹${Number(a.rate)} · ${a.status}`} />
          ))}
        </Card>
      )}

      {Number(lot.remaining_quantity) > 0 && !isNight && (
        <Btn title="🔨 Take to Auction" kind="accent" onPress={() => nav.push('liveAuction', { lotId: lot.id })} />
      )}
      <Btn title="Mark Lot Card Printed" kind="secondary" onPress={async () => {
        try { await post(`/lots/${lot.id}/card-printed`); Alert.alert('Marked printed'); } catch (e) { setErr(e.message); }
      }} />

      <SuccessModal
        visible={!!sold}
        onClose={() => setSold(null)}
        title="Night Sale Recorded ✓"
        subtitle={`Lot ${lotSeq(lot.lot_number)} · predetermined price`}
        sections={[{
          title: 'SALE DETAILS',
          rows: [
            ['Customer', sold?.customer || '-'],
            ['Quantity', `${sold?.quantity} boxes`],
            ['Rate (predetermined)', `₹${sold?.rate}`],
            ['Amount', `₹${((sold?.quantity || 0) * (sold?.rate || 0)).toFixed(2)}`],
            ['Remaining in lot', `${sold?.remaining} boxes`],
          ],
        }]}
        actions={[{ title: 'Done', kind: 'primary', onPress: () => setSold(null) }]}
      />

      <RateFixedModal lot={lot} rateFixed={rateFixed} setRateFixed={setRateFixed} />
    </Screen>
  );
}

/** Shared "Final Rate Fixed" success popup. */
function RateFixedModal({ lot, rateFixed, setRateFixed }) {
  return (
    <SuccessModal
      visible={!!rateFixed}
      onClose={() => setRateFixed(null)}
      title="Final Rate Fixed ✓"
      subtitle={`Lot ${lotSeq(lot.lot_number)}`}
      sections={[{
        title: 'NIGHT ARRIVAL RESULT',
        rows: [
          ['Final purchase rate', `₹${rateFixed?.finalRate} / box`],
          ['Trade margin', `₹${rateFixed?.margin}`],
        ],
      }]}
      actions={[{ title: 'Done', kind: 'primary', onPress: () => setRateFixed(null) }]}
    />
  );
}

const s = StyleSheet.create({
  t: { fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 12, color: C.muted, marginTop: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  filterInfo: { fontSize: 12, color: C.muted, marginTop: 8 },
  empty: { textAlign: 'center', color: C.muted, marginTop: 10 },
  workflowCard: { borderLeftWidth: 4, borderLeftColor: C.accent },
  workflowTitle: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: 0.5, marginBottom: 4 },
  workflowSub: { fontSize: 12.5, color: C.muted, lineHeight: 18, marginBottom: 10 },
});
