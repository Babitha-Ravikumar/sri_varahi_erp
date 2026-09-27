/** Verifies the Vehicle/Source drill-down opens as its own page with records. */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

const ROWS = [
  { id: 1, lot_id: 11, lot_number: 'L-20260925-001', party_name: 'Koteswara Rao', vehicle_number: 'AP21 CD 7788', driver_name: 'Mahesh', purchase_source: 'local_farmer', quality: 'A', quantity: 10, purchase_rate: 100 },
  { id: 2, lot_id: 12, lot_number: 'L-20260925-010', party_name: 'Srinu Traders', vehicle_number: 'AP21 CD 7788', driver_name: 'Mahesh', purchase_source: 'local_trader', quality: 'B', quantity: 5, purchase_rate: 90 },
];

jest.mock('../../api', () => ({
  get: jest.fn((p) => {
    if (String(p).startsWith('/inwards?vehicle=')) return Promise.resolve(ROWS);
    return Promise.resolve([]);
  }),
}));

import DrillDownScreen from '../DrillDownScreen';

const flush = () => new Promise((r) => setTimeout(r, 0));
const flatten = (c) => {
  if (Array.isArray(c)) return c.flatMap(flatten);
  if (typeof c === 'string') return [c];
  if (c && c.props && c.props.children !== undefined) return flatten(c.props.children);
  return [];
};
const allText = (root) => root.findAll((n) => n.type === Text).flatMap((n) => flatten(n.children));

describe('DrillDownScreen (separate page)', () => {
  const nav = { push: jest.fn(), pop: jest.fn() };
  let tree;
  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => {
      tree = create(<DrillDownScreen nav={nav} params={{ type: 'vehicle', key: 'AP21 CD 7788' }} />);
      await flush();
    });
  });
  afterEach(() => act(() => tree.unmount()));

  test('renders as its own page: header title, summary, and record cards', () => {
    const text = allText(tree.root).join(' | ');
    expect(text).toContain('Vehicle AP21 CD 7788');
    expect(text).toContain('Records');
    expect(text).toContain('Total boxes');
    expect(text).toContain('15'); // 10 + 5
    expect(text).toContain('Lot 001');
    expect(text).toContain('Lot 010');
    expect(text).not.toContain('L-20260925');
  });

  test('tapping a record pushes the Lot Detail page', () => {
    const cards = tree.root.findAll((n) =>
      n.type === TouchableOpacity && n.props.onPress &&
      String(n.props.accessibilityLabel || '').startsWith('Open lot'));
    expect(cards.length).toBe(2);
    act(() => { cards[0].props.onPress(); });
    expect(nav.push).toHaveBeenCalledWith('lotDetail', { lotId: 11 });
  });
});
