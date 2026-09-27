/** LOCAL TRADER purchase: Trader → Quantity → Purchase Rate → SAVE. Simple. */
import React, { useState } from 'react';
import { Text, Alert } from 'react-native';
import { get, post } from '../api';
import { Card, Field, Picker, Btn, Screen, C } from '../components/ui';
import LotCreatedModal from '../components/LotCreatedModal';

export default function LocalTraderScreen({ nav }) {
  const [traders, setTraders] = useState(null);
  const [traderId, setTraderId] = useState(null);
  const [traderName, setTraderName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState(null);

  React.useEffect(() => {
    get('/parties?type=local_trader').then(setTraders).catch((e) => setErr(e.message));
  }, []);

  function anotherEntry() {
    setCreated(null);
    setQuantity(''); setRate('');
  }

  async function save() {
    setSaving(true); setErr('');
    try {
      const r = await post('/inwards/local-trader', {
        party_id: traderId || undefined,
        party_name: traderId ? undefined : traderName,
        quantity: Number(quantity), purchase_rate: Number(rate),
      });
      setCreated({
        lotId: r.lot.id, lotNumber: r.lot.lot_number, boxes: r.lot.total_quantity,
        amount: Number(rate) * Number(quantity),
      });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const valid = (traderId || traderName.trim()) && Number(quantity) > 0 && Number(rate) >= 0;

  return (
    <Screen title="Local Trader Purchase" nav={nav} onBack={nav.pop} error={err}>
      <Card>
        <Picker label="Local Trader" items={traders || []} selectedId={traderId} onSelect={setTraderId}
          placeholder="Select trader…" />
        {!traderId && (
          <Field label="…or type trader name (creates if new)" value={traderName} onChangeText={setTraderName} placeholder="e.g. Srinu Traders" />
        )}
        <Field label="Quantity (boxes)" value={quantity} onChangeText={setQuantity} keyboard="numeric" placeholder="e.g. 20" />
        <Field label="Purchase Rate (₹/box)" value={rate} onChangeText={setRate} keyboard="numeric" placeholder="e.g. 90" />
        <Btn title={saving ? 'Saving…' : 'SAVE Purchase'} onPress={save} disabled={!valid || saving} kind="accent" />
        <Text style={s.hint}>Only these fields - kept intentionally simple.</Text>
      </Card>

      <LotCreatedModal
        visible={!!created}
        onClose={anotherEntry}
        lotId={created?.lotId}
        lotNumber={created?.lotNumber}
        boxes={created?.boxes}
        amount={created?.amount}
        extraRows={[['Rate / box', `₹${Number(rate)}`]]}
        actions={[
          { title: 'Another Entry', onPress: anotherEntry },
          { title: 'Done', onPress: nav.home },
        ]}
      />
    </Screen>
  );
}

const s = { hint: { color: C.muted, fontSize: 12, marginTop: 8, textAlign: 'center' } };
