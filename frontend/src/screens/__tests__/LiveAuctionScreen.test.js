/**
 * Verifies the RENDERED Live Auction UI:
 *  - one searchable Select Lot dropdown (type-to-filter)
 *  - lot numbers displayed as exactly 3 digits (001, 010) - never L-YYYYMMDD-NNN
 *  - no "1 ·" / "2 ·" / "3 ·" step indicators
 *  - ONE Customer field (no separate existing/new customer fields)
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { Text } from 'react-native';

const LOTS = [
  { id: 1, lot_number: 'L-20260925-001', party_name: 'Koteswara Rao', vehicle_number: 'AP21 CD 7788', quality: 'A', total_quantity: 20, pre_auction_quantity: 0, remaining_quantity: 15 },
  { id: 2, lot_number: 'L-20260925-010', party_name: 'Srinu Traders', vehicle_number: 'KA05 AB 4321', quality: 'B', total_quantity: 30, pre_auction_quantity: 5, remaining_quantity: 25 },
];
const CUSTOMERS = [{ id: 5, name: 'Ramesh' }, { id: 6, name: 'Suresh' }];
const AUCTION = { id: 9, total_quantity: 20, remaining_quantity: 15, allocations: [] };

jest.mock('../../api', () => ({
  get: jest.fn((p) => {
    if (p === '/lots') return Promise.resolve(LOTS);
    if (p === '/customers') return Promise.resolve(CUSTOMERS);
    if (String(p).startsWith('/auctions/')) return Promise.resolve(AUCTION);
    return Promise.resolve([]);
  }),
  post: jest.fn((p) => {
    if (p === '/auctions') return Promise.resolve(AUCTION);
    return Promise.resolve([]);
  }),
  billPdfUrl: () => 'http://test/bill.pdf',
}));

import LiveAuctionScreen from '../LiveAuctionScreen';

const flush = () => new Promise((r) => setTimeout(r, 0));
const flatten = (c) => {
  if (Array.isArray(c)) return c.flatMap(flatten);
  if (typeof c === 'string') return [c];
  if (c && c.props && c.props.children !== undefined) return flatten(c.props.children);
  return [];
};
const allText = (root) => root.findAll((n) => n.type === Text).flatMap((n) => flatten(n.children));
const joined = (root) => allText(root).join(' | ');
// The screen component ALSO receives the placeholder prop - select only the
// actual rendered TextInput host node so events drive the real control.
const findInputByPlaceholder = (root, ph) =>
  root.find((n) => n.type === 'TextInput' && n.props && n.props.placeholder === ph);

async function renderScreen() {
  let tree;
  await act(async () => {
    tree = create(<LiveAuctionScreen nav={{ push: jest.fn(), pop: jest.fn(), replace: jest.fn(), home: jest.fn() }} params={{}} />);
    await flush();
  });
  return tree;
}

describe('LiveAuctionScreen rendered UI', () => {
  let tree;
  beforeEach(async () => { tree = await renderScreen(); });
  afterEach(() => act(() => tree.unmount()));

  test('renders ONE "Select Lot" field and NO step-number indicators', () => {
    const texts = allText(tree.root);
    expect(texts.filter((t) => t.includes('Select Lot')).length).toBe(1);
    expect(texts.some((t) => t.startsWith('1 ·'))).toBe(false);
    expect(texts.some((t) => t.startsWith('2 ·'))).toBe(false);
    expect(texts.some((t) => t.startsWith('3 ·'))).toBe(false);
  });

  test('lot numbers display as exactly 3 digits everywhere', async () => {
    // selected lot shows 3-digit form; open the dropdown to see all lots
    const text0 = joined(tree.root);
    expect(text0).toContain('001');
    expect(text0).not.toContain('L-20260925');
    const changeBtn = tree.root.find((n) => n.props && n.props.accessibilityLabel === 'Change selection');
    await act(async () => { changeBtn.props.onPress(); await flush(); });
    const text = joined(tree.root);
    expect(text).toContain('001 · Koteswara Rao');
    expect(text).toContain('010 · Srinu Traders');
    expect(text).not.toContain('L-20260925');
  });

  test('Select Lot is a searchable dropdown: typing filters results', async () => {
    // lot 1 is auto-selected; press "Change" to reopen the search input
    const changeBtn = tree.root.find((n) => n.props && n.props.accessibilityLabel === 'Change selection');
    await act(async () => { changeBtn.props.onPress(); await flush(); });
    const input = findInputByPlaceholder(tree.root, 'Type to search lot…');
    expect(input).toBeTruthy();
    await act(async () => { input.props.onChangeText('010'); await flush(); });
    const text = joined(tree.root);
    expect(text).toContain('010 · Srinu Traders');
    expect(text).not.toContain('001 ·');
  });

  test('has ONE Customer field - no separate existing/new customer fields', () => {
    const texts = allText(tree.root);
    expect(texts.filter((t) => t.trim() === 'Customer').length).toBe(1);
    expect(texts.some((t) => t.includes('Customer (existing)'))).toBe(false);
    expect(texts.some((t) => t.includes('NEW customer'))).toBe(false);
    expect(texts.some((t) => t.includes('Existing Customer'))).toBe(false);
    expect(findInputByPlaceholder(tree.root, 'Search customer or type new name…')).toBeTruthy();
  });

  test('typing a KNOWN customer name offers the existing match', async () => {
    const input = findInputByPlaceholder(tree.root, 'Search customer or type new name…');
    await act(async () => { input.props.onFocus && input.props.onFocus(); input.props.onChangeText('Rame'); await flush(); });
    expect(joined(tree.root)).toContain('Ramesh');
  });

  test('typing an UNKNOWN customer name is treated as new', async () => {
    const input = findInputByPlaceholder(tree.root, 'Search customer or type new name…');
    await act(async () => { input.props.onFocus && input.props.onFocus(); input.props.onChangeText('Brand New Customer'); await flush(); });
    expect(joined(tree.root)).toContain('created as new');
  });

  test('Rate and Quantity fields present under "Rate · Customer · Quantity"', () => {
    const text = joined(tree.root);
    expect(text).toContain('Rate · Customer · Quantity');
    expect(text).toContain('Rate (₹/box)');
    expect(text).toContain('Quantity (boxes)');
  });
});
