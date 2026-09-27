/** Verifies Cashier payment methods: UPI opens upi:// app chooser; BANK shows
 *  bank fields only when selected; references recorded with payments. */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { Text, TextInput, Linking, Alert } from 'react-native';

const BILL = {
  id: 3, bill_number: 'B-20260925-001', customer_name: 'Ramesh',
  total_amount: 1000, paid_amount: 0, balance: 1000, items: [], payments: [],
};

jest.mock('../../api', () => ({
  get: jest.fn((p) => {
    if (p === '/cashier/summary') return Promise.resolve({ collected: 0, payment_count: 0, by_method: [], outstanding_bills: 1, outstanding_amount: 1000 });
    if (p === '/bills') return Promise.resolve([]);
    if (String(p).startsWith('/bills/')) return Promise.resolve(BILL);
    return Promise.resolve([]);
  }),
  post: jest.fn(() => Promise.resolve({ payment: {}, bill_status: 'paid', balance: 0 })),
}));

import CashierScreen from '../CashierScreen';

const flush = () => new Promise((r) => setTimeout(r, 0));
const flatten = (c) => {
  if (Array.isArray(c)) return c.flatMap(flatten);
  if (typeof c === 'string') return [c];
  if (c && c.props && c.props.children !== undefined) return flatten(c.props.children);
  return [];
};
const allText = (root) => root.findAll((n) => n.type === Text).flatMap((n) => flatten(n.children)).join(' | ');
const inputByPlaceholder = (root, ph) => root.findAll((n) => n.type === 'TextInput' && n.props.placeholder === ph);

describe('Cashier payment methods', () => {
  let tree;
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await act(async () => {
      tree = create(<CashierScreen nav={{ push: jest.fn(), pop: jest.fn() }} params={{ billId: 3 }} />);
      await flush();
    });
  });
  afterEach(() => act(() => tree.unmount()));

  const setAmount = async (v) => {
    const amt = tree.root.findAll((n) => n.type === 'TextInput' && n.props.placeholder === '1000')[0];
    await act(async () => { amt.props.onChangeText(v); await flush(); });
  };
  const flattenTextOf = (n) => {
    try { return flatten(n.children).join(''); } catch (_) { return ''; }
  };
  const findBtn = (label) => tree.root
    .findAll((n) => n.props && n.props.accessibilityRole === 'button')
    .find((n) => flattenTextOf(n).includes(label));
  const pressMethod = async (label) => {
    const t = findBtn(label);
    await act(async () => { t.props.onPress(); await flush(); });
  };

  test('UPI: opens the device UPI app chooser with a upi:// deep link', async () => {
    await setAmount('500');
    await pressMethod('📱 UPI');
    const mainBtn = findBtn('Open UPI Apps');
    await act(async () => { mainBtn.props.onPress(); await flush(); });
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    const url = Linking.openURL.mock.calls[0][0];
    expect(url.startsWith('upi://pay?')).toBe(true);
    expect(url).toContain('pa=');           // payee VPA
    expect(url).toContain('am=500.00');     // amount
    expect(url).toContain('cu=INR');
  });

  test('BANK: bank detail fields appear ONLY when Bank is selected', async () => {
    // default cash: no bank fields
    expect(inputByPlaceholder(tree.root, 'e.g. State Bank of India').length).toBe(0);
    await pressMethod('🏦 BANK');
    expect(inputByPlaceholder(tree.root, 'e.g. State Bank of India').length).toBe(1);
    expect(inputByPlaceholder(tree.root, 'e.g. UTR 123456789012').length).toBe(1);
    await pressMethod('💵 CASH');
    expect(inputByPlaceholder(tree.root, 'e.g. State Bank of India').length).toBe(0);
  });

  test('BANK: recording requires bank name + UTR and sends them as reference', async () => {
    await pressMethod('🏦 BANK');
    await setAmount('500');
    const mainBtn = findBtn('Record Bank Payment');
    // missing details -> button DISABLED (no onPress) -> no API call possible
    await act(async () => { if (mainBtn.props.onPress) mainBtn.props.onPress(); await flush(); });
    expect(mainBtn.props.onPress).toBeUndefined();
    expect(require('../../api').post).not.toHaveBeenCalled();
    // fill details -> button enabled -> recorded with reference
    await act(async () => {
      inputByPlaceholder(tree.root, 'e.g. State Bank of India')[0].props.onChangeText('SBI');
      inputByPlaceholder(tree.root, 'e.g. UTR 123456789012')[0].props.onChangeText('UTR999');
      await flush();
    });
    const enabledBtn = findBtn('Record Bank Payment');
    expect(typeof enabledBtn.props.onPress).toBe('function');
    await act(async () => { enabledBtn.props.onPress(); await flush(); });
    expect(require('../../api').post).toHaveBeenCalledWith('/bills/3/payments',
      expect.objectContaining({ amount: 500, method: 'bank', reference: expect.stringContaining('UTR999') }));
  });
});
