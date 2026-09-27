/** Verifies the redesigned LOT CREATED popup: aligned rows, 3-digit lot number, PRINT BILL. */
import React from 'react';
import { create } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('../../api', () => ({ lotPdfUrl: (id) => `http://test/lots/${id}/pdf` }));

import LotCreatedModal from '../../components/LotCreatedModal';

const flatten = (c) => {
  if (Array.isArray(c)) return c.flatMap(flatten);
  if (typeof c === 'string') return [c];
  if (c && c.props && c.props.children !== undefined) return flatten(c.props.children);
  return [];
};
const allText = (root) => root.findAll((n) => n.type === Text).flatMap((n) => flatten(n.children));

describe('LotCreatedModal rendered UI', () => {
  const tree = create(
    <LotCreatedModal
      visible
      onClose={jest.fn()}
      lotId={42}
      lotNumber="L-20260925-007"
      boxes={10}
      amount={1050}
    />
  );
  const texts = allText(tree.root);
  const joined = texts.join(' | ');

  test('shows aligned field rows: Lot Number / Total Boxes / Amount', () => {
    expect(texts).toContain('Lot Number');
    expect(texts).toContain('Total Boxes');
    expect(texts).toContain('Amount');
    expect(texts).toContain('10');
    expect(joined).toContain('₹1050.00');
  });

  test('header contains ONLY "Lot Created ✓" (left) + date (right); LOT DETAILS is a section heading BELOW it, left-aligned', () => {
    const titleIdx = texts.indexOf('Lot Created ✓');
    const detailsIdx = texts.indexOf('LOT DETAILS');
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    // LOT DETAILS comes AFTER the header title & date, not beside them
    expect(detailsIdx).toBeGreaterThan(titleIdx + 1);
    // heading is left-aligned (alignSelf flex-start)
    const heading = tree.root.findAll((n) => n.type === Text)
      .find((n) => flatten(n.children).join('') === 'LOT DETAILS');
    expect(heading.props.style.alignSelf).toBe('flex-start');
  });

  test('each row pairs its label (left) and value (right-aligned) in the same row container', () => {
    const rows = tree.root.findAll((n) => n.props && n.props.style && n.props.style.flexDirection === 'row'
      && n.props.style.justifyContent === 'space-between');
    const lotRow = rows.find((r) => flatten(r.children).join('').includes('Lot Number'));
    expect(lotRow).toBeTruthy();
    const rowTexts = lotRow.findAll((n) => n.type === Text);
    expect(rowTexts.map((t) => flatten(t.children).join(''))).toEqual(['Lot Number', '007']);
    expect(rowTexts[0].props.style.textAlign !== 'right').toBe(true);
    expect(rowTexts[1].props.style.textAlign).toBe('right');
  });

  test('lot number shows ONLY the 3 digits', () => {
    expect(texts).toContain('007');
    expect(joined).not.toContain('L-20260925');
    expect(joined).not.toContain('Lot 007');
    expect(joined).not.toContain('Lot Card');
  });

  test('has a visible PRINT BILL button', () => {
    const btn = tree.root.find((n) => n.props && n.props.accessibilityLabel === 'Print bill');
    expect(btn).toBeTruthy();
    expect(joined).toContain('PRINT BILL');
  });
});
