/**
 * DASHBOARD - premium mobile ERP dashboard (Sri Varahi design system).
 * Structure: HERO header (brand + date) → floating FILTER grid (2 rows)
 *   → 3-column KPI grid (6 cards, prev-day change) → Purchase Source DONUT
 *   → Arrival Trend (bars + line) → Grade bars → Vehicle table (Top 5)
 *   → Top Customers table → Stock Position (3 statuses) → Business summary.
 * ALL values come live from /dashboard/summary (real database data only).
 */
import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Circle,
  Rect,
  Polyline,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import {get} from '../api';
import {
  Screen,
  C,
  Loading,
  DatePickerModal,
  localDateKey,
} from '../components/ui';
import {useReference, refLabel} from '../reference';
import {useQualityGrades} from '../qualityGrades';

const SRC_COLORS = [C.primary, C.accent, C.tomato, C.accentDark, C.danger];
const todayISO = () => localDateKey(new Date());
const TOP_CUSTOMERS_SHOWN = 5;
const FILTER_CARD_PAD = 0;
const FILTER_GAP = 10;

const inr = n => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const inr2 = n => `₹${(Number(n) || 0).toFixed(2)}`;
const qty = n => (Number(n) || 0).toLocaleString('en-IN');
const pct = (part, whole) =>
  Number(whole) > 0
    ? Math.min(100, Math.round((Number(part) / Number(whole)) * 100))
    : 0;
/** signed change indicator between current and reference values */
const change = (cur, prev) => {
  if (!prev || prev <= 0) return null;
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return null;
  return `${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%`;
};

export default function DashboardScreen({nav}) {
  const [sum, setSum] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // filters
  const [dateF, setDateF] = useState(todayISO);
  const [sourceF, setSourceF] = useState('');
  const [vehicleF, setVehicleF] = useState('');
  const [partyF, setPartyF] = useState('');
  const [qualityF, setQualityF] = useState('');
  const [customerF, setCustomerF] = useState('');

  // dropdown values from the database
  const [parties, setParties] = useState([]);
  const [customers, setCustomers] = useState([]);
  const {grades} = useQualityGrades({all: true});

  const hasFilters = !!(
    dateF !== todayISO() ||
    sourceF ||
    vehicleF ||
    partyF.trim() ||
    qualityF ||
    customerF.trim()
  );
  const clearFilters = () => {
    setDateF(todayISO());
    setSourceF('');
    setVehicleF('');
    setPartyF('');
    setQualityF('');
    setCustomerF('');
  };

  const sources = useReference('purchase_source');
  const sourceOptions = sources.map(r => ({value: r.code, label: r.label}));
  const sourceLabel = code => refLabel(sources, code);

  // React Native's JS engine has no URLSearchParams - build manually.
  const queryString = useMemo(() => {
    const q = [];
    if (dateF) q.push(`date=${encodeURIComponent(dateF)}`);
    if (sourceF) q.push(`source=${encodeURIComponent(sourceF)}`);
    if (vehicleF) q.push(`vehicle=${encodeURIComponent(vehicleF)}`);
    if (partyF.trim()) q.push(`party=${encodeURIComponent(partyF.trim())}`);
    if (qualityF) q.push(`quality_grade_id=${encodeURIComponent(qualityF)}`);
    if (customerF.trim())
      q.push(`customer=${encodeURIComponent(customerF.trim())}`);
    return q.join('&');
  }, [dateF, sourceF, vehicleF, partyF, qualityF, customerF]);

  const load = useCallback(async () => {
    try {
      setSum(
        await get(`/dashboard/summary${queryString ? `?${queryString}` : ''}`),
      );
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, [queryString]);

  // two chart cards side by side; chart size follows the screen width
  const {width: winW} = useWindowDimensions();
  const chartCardW = (Math.min(winW, 900) - 28 - CHART_GAP) / 2;
  const chartW = Math.floor(chartCardW - 2 * CHART_CARD_PAD);
  const dayLabel = !dateF
    ? 'All Dates'
    : dateF === todayISO()
    ? 'Today'
    : dateF;

  React.useEffect(() => {
    load();
  }, [load]);
  React.useEffect(() => {
    get('/vehicles')
      .then(setVehicles)
      .catch(() => {});
    get('/parties')
      .then(setParties)
      .catch(() => {});
    get('/customers')
      .then(setCustomers)
      .catch(() => {});
  }, []);
  React.useEffect(() => {
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openDrill = useCallback(
    (type, key) => nav.push('drillDown', {type, key}),
    [nav],
  );
  const topSource =
    sum && sum.by_source.length ? sum.by_source[0].source : null;
  const nameOptions = rows =>
    Array.from(new Set(rows.map(r => r.name).filter(Boolean))).map(n => ({
      value: n,
      label: n,
    }));
  const vehicleOptions = vehicles.map(v => ({
    value: v.vehicle_number,
    label: v.vehicle_number,
  }));
  const gradeOptions = grades.map(g => ({
    value: String(g.id),
    label: g.status === 'active' ? g.grade_name : `${g.grade_name} (inactive)`,
  }));

  // filter grid: 2 rows × 3 equal columns; cells sized in pixels
  const filterCols = 3;
  const filterInnerW = Math.min(winW, 900) - 28 - 2 * FILTER_CARD_PAD;
  const filterCellW = Math.floor(
    (filterInnerW - FILTER_GAP * (filterCols - 1)) / filterCols,
  );

  return (
    <Screen title="Dashboard" nav={nav} error={err}>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />
      <ScrollView
        contentContainerStyle={s.content}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.primary]}
          />
        }>
        {/* 1 ── HERO HEADER */}
        <Hero date={dateF} label={dayLabel} onPickDate={setDateF} />

        {/* 2 ── FILTERS: label + value fields in a 2-column (phone) / 3-column grid */}
        <View style={s.filterCard}>
          <View style={s.filterHead}>
            <Text style={s.filterTitle}>FILTERS</Text>
            <TouchableOpacity
              onPress={clearFilters}
              disabled={!hasFilters}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              accessibilityState={{disabled: !hasFilters}}
              testID="dashboard-clear-filters">
              <Text style={[s.clearAll, !hasFilters && s.clearAllOff]}>
                Clear All
              </Text>
            </TouchableOpacity>
          </View>
          <View style={s.filterGrid}>
            <FilterDate width={filterCellW} value={dateF} onChange={setDateF} />
            <FilterSelect
              width={filterCellW}
              icon="🛒"
              label="Purchase Source"
              allLabel="All Sources"
              options={sourceOptions}
              value={sourceF}
              onChange={setSourceF}
            />
            <FilterSelect
              width={filterCellW}
              icon="🚚"
              label="Vehicle"
              allLabel="All Vehicles"
              searchable
              options={vehicleOptions}
              value={vehicleF}
              onChange={setVehicleF}
            />
            <FilterSelect
              width={filterCellW}
              icon="👥"
              label="Farmer / Party"
              allLabel="All Parties"
              searchable
              options={nameOptions(parties)}
              value={partyF}
              onChange={setPartyF}
            />
            <FilterSelect
              width={filterCellW}
              icon="🏷️"
              label="Grade / Quality"
              allLabel="All Grades"
              options={gradeOptions}
              value={qualityF}
              onChange={setQualityF}
            />
            <FilterSelect
              width={filterCellW}
              icon="👤"
              label="Customer"
              allLabel="All Customers"
              searchable
              options={nameOptions(customers)}
              value={customerF}
              onChange={setCustomerF}
            />
          </View>
        </View>

        {!sum && <Loading label="Loading dashboard…" />}
        {sum && (
          <>
            {/* 3 ── KPI GRID (3 columns × 2 rows) */}
            <View style={s.kpiGrid}>
              <Kpi
                icon="🚚"
                title="VEHICLES"
                value={qty(sum.arrived_vehicles)}
                accent={C.primary}
                delta={change(sum.arrived_vehicles, sum.prev_day.vehicles)}
                ref_={`yest ${sum.prev_day.vehicles}`}
              />
              <Kpi
                icon="📦"
                title="TOTAL LOTS"
                value={qty(sum.total_lots)}
                accent={C.accentDark}
                delta={change(sum.total_lots, sum.prev_day.lots)}
                ref_={`yest ${sum.prev_day.lots}`}
              />
              <Kpi
                icon="🧰"
                title="TOTAL BOXES"
                value={qty(sum.total_boxes)}
                accent={C.accent}
                delta={change(sum.total_quantity, sum.prev_day.boxes)}
                ref_={`yest ${qty(sum.prev_day.boxes)}`}
              />
              <Kpi
                icon="⚖"
                title="QUANTITY"
                value={qty(sum.total_quantity)}
                accent={C.primaryDark}
                sub="boxes arrived"
              />
              <Kpi
                icon="🛒"
                title="AVG PURCHASE"
                value={inr2(sum.avg_purchase_rate)}
                accent={C.danger}
                sub="per box"
              />
              <Kpi
                icon="💰"
                title="AVG SELLING"
                value={inr2(sum.avg_selling_rate)}
                accent={C.ok}
                sub="per box · sold"
              />
            </View>

            {/* 4+5 ── CHARTS SIDE BY SIDE: source donut · 7-day arrival trend */}
            <View style={s.chartRow}>
              <Card
                title="Arrival by Source"
                compact
                style={{width: chartCardW}}
                arrow
                onPress={
                  topSource ? () => openDrill('source', topSource) : null
                }>
                {sum.by_source.length === 0 ? (
                  <Text style={s.muted}>No arrivals for this view.</Text>
                ) : (
                  <Donut
                    size={chartW}
                    data={sum.by_source.map((r, i) => ({
                      key: r.source,
                      label: sourceLabel(r.source),
                      value: r.boxes,
                      lots: r.lots,
                      color: SRC_COLORS[i % SRC_COLORS.length],
                    }))}
                    centerValue={sum.total_lots}
                    centerLabel="LOTS"
                  />
                )}
              </Card>
              <Card
                title="Arrival Trend · 7 Days"
                compact
                style={{width: chartCardW}}>
                {sum.trend.length === 0 ? (
                  <Text style={s.muted}>No trend data yet.</Text>
                ) : (
                  <TrendChart width={chartW} data={sum.trend} />
                )}
              </Card>
            </View>

            {/* 6 ── GRADE / QUALITY WISE */}
            <Card title="Quality Grade Wise Arrival">
              {sum.by_quality.length === 0 ? (
                <Text style={s.muted}>No quality data for this view.</Text>
              ) : (
                <GradeBreakdown rows={sum.by_quality} />
              )}
            </Card>

            {/* 7 ── VEHICLE WISE (Top 5 table) */}
            <Card
              title="Vehicle Wise Arrival (Top 5)"
              arrow
              onPress={
                sum.by_vehicle[0]
                  ? () => openDrill('vehicle', sum.by_vehicle[0].vehicle)
                  : null
              }>
              {sum.by_vehicle.length === 0 ? (
                <Text style={s.muted}>No arrivals for this view.</Text>
              ) : (
                <View style={s.table}>
                  <View style={[s.tr, s.thead]}>
                    <Text style={[s.th, {flex: 1.5}]}>VEHICLE NO.</Text>
                    <Text style={[s.th, stylesR]}>LOTS</Text>
                    <Text style={[s.th, stylesR]}>BOXES</Text>
                    <Text style={[s.th, stylesR]}>QUANTITY</Text>
                  </View>
                  {sum.by_vehicle.map((v, i) => (
                    <TouchableOpacity
                      key={v.vehicle}
                      style={[s.tr, i % 2 === 1 && s.trAlt]}
                      onPress={() => openDrill('vehicle', v.vehicle)}
                      accessibilityRole="button"
                      accessibilityLabel={`Vehicle ${v.vehicle} details`}>
                      <Text
                        style={[s.td, {flex: 1.5, fontWeight: '700'}]}
                        numberOfLines={1}>
                        {v.vehicle}
                      </Text>
                      <Text style={[s.td, stylesR]}>{qty(v.lots)}</Text>
                      <Text style={[s.td, stylesR]}>{qty(v.boxes)}</Text>
                      <Text style={[s.td, stylesR]}>{qty(v.quantity)}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={[s.tr, s.tfoot]}>
                    <Text style={[s.tf, {flex: 1.5}]}>TOTAL</Text>
                    <Text style={[s.tf, stylesR]}>
                      {qty(sum.by_vehicle.reduce((a, v) => a + v.lots, 0))}
                    </Text>
                    <Text style={[s.tf, stylesR]}>
                      {qty(sum.by_vehicle.reduce((a, v) => a + v.boxes, 0))}
                    </Text>
                    <Text style={[s.tf, stylesR]}>
                      {qty(sum.by_vehicle.reduce((a, v) => a + v.quantity, 0))}
                    </Text>
                  </View>
                </View>
              )}
            </Card>

            {/* 8 ── TOP CUSTOMERS */}
            <Card title={`Top Customers · ${dayLabel}`}>
              {sum.top_customers.length === 0 ? (
                <Text style={s.muted}>No customer sales for this view.</Text>
              ) : (
                <View style={s.table}>
                  <View style={[s.tr, s.thead]}>
                    <Text style={[s.th, {flex: 1.7}]}>CUSTOMER</Text>
                    <Text style={[s.th, stylesR]}>LOTS</Text>
                    <Text style={[s.th, stylesR]}>BOXES</Text>
                    <Text style={[s.th, stylesR]}>AMOUNT</Text>
                  </View>
                  {sum.top_customers
                    .slice(0, TOP_CUSTOMERS_SHOWN)
                    .map((c, i) => (
                      <View
                        key={c.customer_id}
                        style={[s.tr, i % 2 === 1 && s.trAlt]}>
                        <Text
                          style={[s.td, {flex: 1.7, fontWeight: '700'}]}
                          numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={[s.td, stylesR]}>{qty(c.lots)}</Text>
                        <Text style={[s.td, stylesR]}>{qty(c.quantity)}</Text>
                        <Text
                          style={[
                            s.td,
                            stylesR,
                            {color: C.primary, fontWeight: '800'},
                          ]}>
                          {inr(c.value)}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
              {sum.top_customers_total > 0 && (
                <TouchableOpacity
                  style={s.loadMore}
                  onPress={() =>
                    nav.push('topCustomers', {
                      query: queryString,
                      scopeLabel: `${dayLabel}${
                        hasFilters ? ' · filtered view' : ''
                      }`,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Load more customers"
                  testID="top-customers-load-more">
                  <Text style={s.loadMoreText}>
                    Load More
                    {sum.top_customers_total > TOP_CUSTOMERS_SHOWN
                      ? ` · ${sum.top_customers_total} customers`
                      : ''}
                  </Text>
                  <Text style={s.loadMoreArrow}>›</Text>
                </TouchableOpacity>
              )}
            </Card>

            {/* 9 ── STOCK POSITION (3 statuses) */}
            <Card title="Stock Position">
              <View style={s.stockRow}>
                <StockBox
                  tone={C.accentDark}
                  tint="#fdf3e0"
                  label="Unauctioned"
                  count={sum.stock_status.unauctioned}
                  boxes={sum.stock_status.unauctioned_boxes}
                />
                <StockBox
                  tone={C.tomato}
                  tint={C.dangerBg}
                  label="Partially Sold"
                  count={sum.stock_status.partial}
                  boxes={sum.stock_status.partial_boxes}
                />
                <StockBox
                  tone={C.primary}
                  tint={C.primaryLight}
                  label="Sold"
                  count={sum.stock_status.sold}
                  boxes={sum.stock_status.sold_boxes}
                />
              </View>
              {sum.stock_lots.length > 0 && (
                <View style={s.stockList}>
                  {sum.stock_lots.slice(0, 5).map(l => (
                    <TouchableOpacity
                      key={l.id}
                      style={s.drillRow}
                      onPress={() => nav.push('lotDetail', {lotId: l.id})}
                      accessibilityRole="button"
                      accessibilityLabel={`Open lot ${l.lot_number}`}>
                      <Text style={s.drillLabel}>
                        {String(l.lot_number).split('-').pop()} ·{' '}
                        {l.party || '-'}
                      </Text>
                      <Text style={s.drillValue}>
                        {qty(l.remaining)} left ›
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>

            {/* 10 ── BUSINESS SUMMARY */}
            <Card title={`Business Summary · ${dayLabel}`}>
              <SumRow
                label="Sold"
                value={`${qty(sum.sold_quantity)} boxes · ${pct(
                  sum.sold_quantity,
                  sum.total_quantity,
                )}%`}
                color={C.primary}
              />
              <SumRow
                label="Remaining"
                value={`${qty(sum.remaining_quantity)} boxes`}
                color={C.accentDark}
              />
              <SumRow
                label="Damaged (corrections)"
                value={`${qty(sum.damage_quantity)} boxes`}
                color={C.danger}
              />
              <SumRow
                label="Total sales value"
                value={inr(sum.total_sales)}
                color={C.primary}
              />
              <SumRow
                label="Collected"
                value={`${inr(sum.collected_amount)} · ${
                  sum.payment_count
                } payments`}
                color={C.ok}
              />
              <SumRow
                label="Outstanding"
                value={`${inr(sum.outstanding_amount)} · ${
                  sum.outstanding_bills
                } bills`}
                color={C.tomato}
              />
              <View style={s.stack}>
                {sum.bills.paid > 0 && (
                  <View
                    style={[
                      s.stackSeg,
                      {flex: sum.bills.paid, backgroundColor: C.primary},
                    ]}
                  />
                )}
                {sum.bills.part_paid > 0 && (
                  <View
                    style={[
                      s.stackSeg,
                      {flex: sum.bills.part_paid, backgroundColor: C.accent},
                    ]}
                  />
                )}
                {sum.bills.unpaid > 0 && (
                  <View
                    style={[
                      s.stackSeg,
                      {flex: sum.bills.unpaid, backgroundColor: C.tomato},
                    ]}
                  />
                )}
              </View>
              <View style={s.legendRow}>
                <Legend color={C.primary} label="Paid" value={sum.bills.paid} />
                <Legend
                  color={C.accent}
                  label="Part paid"
                  value={sum.bills.part_paid}
                />
                <Legend
                  color={C.tomato}
                  label="Unpaid"
                  value={sum.bills.unpaid}
                />
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const stylesR = {flex: 0.75, textAlign: 'right'};

/* ══════════ 1. HERO HEADER ══════════ */

function Hero({date, label, onPickDate}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.hero}>
      {/* farm-style decorative layers */}
      <View
        style={[
          s.heroBlob,
          {width: 220, height: 220, top: -70, right: -60, opacity: 0.18},
        ]}
      />
      <View
        style={[
          s.heroBlob,
          {width: 150, height: 150, bottom: -50, left: -40, opacity: 0.14},
        ]}
      />
      <Text style={s.heroTomato}>🍅</Text>
      <View style={s.heroTop}>
        <View style={{flex: 1}}>
          <Text style={s.heroBrand}>SRI VARAHI</Text>
          <Text style={s.heroSub}>Tomato Commission Mandi, Tirupur</Text>
        </View>
        <TouchableOpacity
          style={s.heroDateBtn}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Select dashboard date">
          <Text style={s.heroDateIcon}>📅</Text>
          <Text style={s.heroDateText}>{label}</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.heroTagline}>
        🍅 Fresh arrivals · Live auction · Daily settlement
      </Text>
      <DatePickerModal
        visible={open}
        value={date || todayISO()}
        onPick={d => {
          onPickDate(d || '');
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/* ══════════ 2. FILTER FIELDS ══════════ */

/**
 * Compact icon-only filter box: icon + small dropdown arrow. The label and
 * selected value are shown in the picker it opens (and read by screen readers);
 * a green border + dot marks a box whose filter is applied.
 */
function FilterField({width, icon, label, value, active, onPress, a11y}) {
  return (
    <TouchableOpacity
      style={[s.fField, {width}, active && s.fFieldActive]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={a11y || `${label}: ${value}`}>
      <Text style={s.fIcon}>{icon}</Text>
      <View style={s.fCaret} />
      {active ? <View style={s.fDot} /> : null}
    </TouchableOpacity>
  );
}

function FilterDate({width, value, onChange}) {
  const [open, setOpen] = useState(false);
  const shown = !value
    ? 'All Dates'
    : value === todayISO()
    ? `Today · ${value.slice(8, 10)}/${value.slice(5, 7)}`
    : value;
  return (
    <>
      <FilterField
        width={width}
        icon="📅"
        label="Date"
        value={shown}
        active={!!value && value !== todayISO()}
        onPress={() => setOpen(true)}
        a11y={`Date filter: ${shown}`}
      />
      <DatePickerModal
        visible={open}
        value={value || todayISO()}
        onPick={d => {
          onChange(d || '');
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function FilterSelect({
  width,
  icon,
  label,
  allLabel,
  options,
  value,
  onChange,
  searchable,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find(o => o.value === value);
  const text = q.trim().toLowerCase();
  const list = text
    ? options.filter(o => o.label.toLowerCase().includes(text))
    : options;
  return (
    <>
      <FilterField
        width={width}
        icon={icon}
        label={label}
        value={selected ? selected.label : allLabel}
        active={!!selected}
        onPress={() => {
          setOpen(true);
          setQ('');
        }}
      />

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={s.fsOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}>
          <View style={s.fsCard}>
            <Text style={s.fsTitle}>{label}</Text>
            {searchable ? (
              <View style={s.fsSearchWrap}>
                <TextInput
                  style={s.fsSearch}
                  value={q}
                  onChangeText={setQ}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  placeholderTextColor="#9aa096"
                  autoCorrect={false}
                  underlineColorAndroid="transparent"
                />
              </View>
            ) : null}
            <ScrollView
              style={s.fsList}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={[s.fsItem, !selected && s.fsItemActive]}
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}>
                <Text style={[s.fsItemText, !selected && s.fsItemTextActive]}>
                  {allLabel}
                </Text>
              </TouchableOpacity>
              {list.map(o => {
                const on = o.value === value;
                return (
                  <TouchableOpacity
                    key={o.value}
                    style={[s.fsItem, on && s.fsItemActive]}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{selected: on}}>
                    <Text
                      style={[s.fsItemText, on && s.fsItemTextActive]}
                      numberOfLines={1}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {list.length === 0 && (
                <Text style={s.fsNone}>
                  {options.length ? 'No matches.' : 'No values yet.'}
                </Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

/* ══════════ 3. KPI CARD ══════════ */

function Kpi({icon, title, value, accent, sub, delta, ref_}) {
  return (
    <View style={[s.kpi, {borderTopColor: accent}]}>
      <View style={[s.kpiIcon, {backgroundColor: accent + '1a'}]}>
        <Text style={s.kpiIconText}>{icon}</Text>
      </View>
      <Text style={s.kpiTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text
        style={s.kpiValue}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        numberOfLines={1}>
        {value}
      </Text>
      {delta ? (
        <Text
          style={[
            s.kpiDelta,
            delta.startsWith('▲') ? {color: C.primary} : {color: C.tomato},
          ]}
          numberOfLines={1}>
          {delta}
          {ref_ ? ` · ${ref_}` : ''}
        </Text>
      ) : sub ? (
        <Text style={s.kpiSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/* ══════════ shared card shell ══════════ */

function Card({title, arrow, onPress, children, compact, style}) {
  return (
    <View style={[s.card, compact && s.cardCompact, style]}>
      <View style={s.cardHead}>
        <Text
          style={[s.cardTitle, compact && s.cardTitleCompact]}
          numberOfLines={compact ? 2 : 1}>
          {title}
        </Text>
        {arrow && onPress ? (
          <TouchableOpacity
            onPress={onPress}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityRole="button"
            accessibilityLabel={`Open ${title} details`}>
            <Text style={s.cardArrow}>›</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/* ══════════ 4. DONUT CHART (SVG) ══════════ */

function Donut({data, centerValue, centerLabel, size: width}) {
  const DONUT_SIZE = Math.max(110, Math.min(width, 190));
  const RING = Math.round(DONUT_SIZE * 0.12);
  const DONUT_R = DONUT_SIZE / 2 - RING / 2 - 2;
  const DONUT_C = 2 * Math.PI * DONUT_R;
  const total = data.reduce((a, d) => a + (Number(d.value) || 0), 0);
  const center = {x: DONUT_SIZE / 2, y: DONUT_SIZE / 2};
  return (
    <View>
      <View style={s.donutWrap}>
        <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
          <Circle
            cx={center.x}
            cy={center.y}
            r={DONUT_R}
            stroke="#eef0ec"
            strokeWidth={RING}
            fill="none"
          />
          {(() => {
            let acc = 0;
            return data.map(d => {
              const frac = total > 0 ? Number(d.value) / total : 0;
              const dash = frac * DONUT_C;
              const offset = DONUT_C * 0.25 - acc * DONUT_C; // start at 12 o'clock
              // mid-angle of this segment, for the % label inside the ring
              const mid = (acc + frac / 2) * 2 * Math.PI - Math.PI / 2;
              const lx = center.x + Math.cos(mid) * DONUT_R;
              const ly = center.y + Math.sin(mid) * DONUT_R;
              acc += frac;
              return (
                <React.Fragment key={d.key || d.label}>
                  <Circle
                    cx={center.x}
                    cy={center.y}
                    r={DONUT_R}
                    stroke={d.color}
                    strokeWidth={RING}
                    fill="none"
                    strokeDasharray={`${dash} ${DONUT_C - dash}`}
                    strokeDashoffset={offset}
                  />
                  {frac >= 0.1 && RING >= 16 ? (
                    <SvgText
                      x={lx}
                      y={ly + 3.5}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="10"
                      fontWeight="800">
                      {Math.round(frac * 100)}%
                    </SvgText>
                  ) : null}
                </React.Fragment>
              );
            });
          })()}
          <SvgText
            x={center.x}
            y={center.y + 2}
            textAnchor="middle"
            fill={C.text}
            fontSize={DONUT_SIZE >= 160 ? 24 : 19}
            fontWeight="800">
            {qty(centerValue != null ? centerValue : total)}
          </SvgText>
          <SvgText
            x={center.x}
            y={center.y + 18}
            textAnchor="middle"
            fill={C.muted}
            fontSize="10"
            fontWeight="700"
            letterSpacing="1">
            {centerLabel}
          </SvgText>
        </Svg>
      </View>
      <View style={s.donutLegend}>
        {data.map(d => (
          <View key={d.key || d.label} style={s.donutLegRow}>
            <View style={[s.legendDot, {backgroundColor: d.color}]} />
            <Text style={s.donutLegLabel} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={s.donutLegPct}>{pct(d.value, total)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ══════════ 5. TREND CHART (bars + line, SVG) ══════════ */

const CHART_GAP = 10;
const CHART_CARD_PAD = 10;

function TrendChart({data, width}) {
  const CHART_W = width;
  const CHART_H = Math.max(120, Math.min(170, Math.round(width * 0.8)));
  const maxBoxes = Math.max(1, ...data.map(d => d.boxes));
  const maxLots = Math.max(1, ...data.map(d => d.lots));
  const maxVeh = Math.max(1, ...data.map(d => d.vehicles));
  const n = data.length;
  const slot = CHART_W / n;
  const barW = Math.min(12, slot / 3.2);
  const yBoxes = v => CHART_H - (v / maxBoxes) * (CHART_H - 26) - 4;
  const yLots = v => CHART_H - (v / maxLots) * (CHART_H - 26) - 4;
  const yVeh = v => CHART_H - (v / maxVeh) * (CHART_H - 26) - 4;
  const vehPts = data
    .map((d, i) => `${slot * i + slot / 2},${yVeh(d.vehicles)}`)
    .join(' ');

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H + 22}>
        {[0.25, 0.5, 0.75].map(f => (
          <Line
            key={f}
            x1="0"
            x2={CHART_W}
            y1={CHART_H * f}
            y2={CHART_H * f}
            stroke="#eef0ec"
            strokeWidth="1"
          />
        ))}
        {data.map((d, i) => {
          const cx = slot * i + slot / 2;
          return (
            <React.Fragment key={d.day}>
              <Rect
                x={cx - barW - 1}
                y={yBoxes(d.boxes)}
                width={barW}
                height={CHART_H - yBoxes(d.boxes)}
                rx="2"
                fill={C.primary}
              />
              <Rect
                x={cx + 1}
                y={yLots(d.lots)}
                width={barW}
                height={CHART_H - yLots(d.lots)}
                rx="2"
                fill={C.accent}
              />
              <SvgText
                x={cx}
                y={CHART_H + 15}
                textAnchor="middle"
                fill={C.muted}
                fontSize="10"
                fontWeight="600">
                {slot >= 34
                  ? `${String(d.day).slice(8, 10)}/${String(d.day).slice(5, 7)}`
                  : String(d.day).slice(8, 10)}
              </SvgText>
            </React.Fragment>
          );
        })}
        <Polyline
          points={vehPts}
          fill="none"
          stroke={C.tomato}
          strokeWidth="2"
        />
        {data.map((d, i) => (
          <Circle
            key={'v' + i}
            cx={slot * i + slot / 2}
            cy={yVeh(d.vehicles)}
            r="3"
            fill={C.tomato}
          />
        ))}
      </Svg>
      <View style={[s.legendRow, s.legendWrap]}>
        <Legend color={C.primary} label="Boxes" value="" />
        <Legend color={C.accent} label="Lots" value="" />
        <Legend color={C.tomato} label="Vehicles" value="" />
      </View>
    </View>
  );
}

/* ══════════ 6. GRADE BREAKDOWN ══════════ */

const GRADE_COLORS = [
  C.primary,
  C.accentDark,
  C.tomato,
  C.accent,
  C.danger,
  C.primaryDark,
];

function GradeBreakdown({rows}) {
  const totalBoxes = rows.reduce((a, g) => a + (Number(g.boxes) || 0), 0);
  const items = rows.map((g, i) => ({
    key: g.grade_id == null ? g.quality : String(g.grade_id),
    name: g.quality || 'Ungraded',
    boxes: Number(g.boxes) || 0,
    lots: Number(g.lots) || 0,
    share: pct(g.boxes, totalBoxes),
    color: GRADE_COLORS[i % GRADE_COLORS.length],
  }));

  return (
    <View>
      {items.map((g, i) => (
        <View
          key={g.key}
          style={[s.gradeRow, i === items.length - 1 && s.gradeRowLast]}
          accessibilityLabel={`${g.name}: ${qty(g.boxes)} boxes, ${qty(
            g.lots,
          )} lots, ${g.share} percent`}>
          <View style={s.gradeHead}>
            <View style={[s.gradeDot, {backgroundColor: g.color}]} />
            <View style={s.gradeNameWrap}>
              <Text style={s.gradeName} numberOfLines={1}>
                {g.name}
              </Text>
              <Text style={s.gradeLots}>
                {qty(g.lots)} {g.lots === 1 ? 'lot' : 'lots'}
              </Text>
            </View>
            <Text style={s.gradeBoxes}>
              {qty(g.boxes)}
              <Text style={s.gradeBoxesUnit}> boxes</Text>
            </Text>
          </View>
          <View style={s.gradeBarRow}>
            <View style={s.gradeTrack}>
              <View
                style={[
                  s.gradeFill,
                  {width: `${g.share}%`, backgroundColor: g.color},
                ]}
              />
            </View>
            <Text style={[s.gradePct, {color: g.color}]}>{g.share}%</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ══════════ 9. STOCK BOX ══════════ */

function StockBox({icon, tone, tint, label, count, boxes}) {
  return (
    <View
      style={[s.stockBox, {backgroundColor: tint, borderColor: tone + '55'}]}>
      {/* <Text style={s.stockIcon}>{icon}</Text> */}
      <Text style={[s.stockLabel, {color: tone}]}>{label}</Text>
      <Text style={[s.stockCount, {color: tone}]}>{count}</Text>
      <Text style={s.stockBoxes}>{qty(boxes)} boxes</Text>
    </View>
  );
}

/* ══════════ 10. SUMMARY ROW ══════════ */

function SumRow({label, value, color}) {
  return (
    <View style={s.sumRow}>
      <View style={[s.sumDot, {backgroundColor: color}]} />
      <Text style={s.sumLabel}>{label}</Text>
      <Text style={s.sumValue}>{value}</Text>
    </View>
  );
}

function Legend({color, label, value}) {
  return (
    <View style={s.legend}>
      <View style={[s.legendDot, {backgroundColor: color}]} />
      <Text style={s.legendText}>{label}</Text>
      {value !== '' ? <Text style={s.legendValue}>{value}</Text> : null}
    </View>
  );
}

/* ══════════ styles ══════════ */

const s = StyleSheet.create({
  content: {paddingBottom: 44},

  /* hero */
  hero: {
    backgroundColor: C.primary,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 5,
  },
  heroBlob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  heroTomato: {
    position: 'absolute',
    right: 14,
    top: 44,
    fontSize: 54,
    opacity: 0.9,
  },
  heroTop: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  heroBrand: {color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 2},
  heroSub: {
    color: C.accent,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.4,
  },
  heroDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff26',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroDateIcon: {fontSize: 13},
  heroDateText: {color: '#fff', fontSize: 12.5, fontWeight: '800'},
  heroTagline: {color: '#ffffffcc', fontSize: 11, marginTop: 12},

  /* filter card */
  filterCard: {marginBottom: 14, paddingHorizontal: FILTER_CARD_PAD},
  filterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: C.primaryDark,
    letterSpacing: 1.2,
  },
  clearAll: {color: C.tomato, fontSize: 14, fontWeight: '800'},
  clearAllOff: {color: '#b9bdb5'},
  filterGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: FILTER_GAP},
  fField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9ddd5',
    elevation: 1,
  },
  fFieldActive: {
    borderColor: C.primary,
    borderWidth: 1.5,
    backgroundColor: C.primaryLight,
  },
  fIcon: {fontSize: 22},
  fCaret: {
    width: 0,
    height: 0,
    marginTop: 2,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: C.accentDark,
  },
  fDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  fsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fsCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    elevation: 6,
  },
  fsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  fsSearchWrap: {
    backgroundColor: '#f7f8f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 6,
  },
  fsSearch: {paddingHorizontal: 12, height: 46, fontSize: 15, color: C.text},
  fsList: {maxHeight: 340},
  fsItem: {paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10},
  fsItemActive: {backgroundColor: C.primaryLight},
  fsItemText: {fontSize: 15, color: C.text},
  fsItemTextActive: {color: C.primary, fontWeight: '800'},
  fsNone: {padding: 12, color: C.muted, fontSize: 14},

  /* KPI */
  kpiGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14},
  kpi: {
    width: '31.7%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderTopWidth: 3,
    elevation: 1,
    minHeight: 108,
    alignItems: 'center',
  },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  kpiIconText: {fontSize: 14},
  kpiTitle: {
    fontSize: 8.5,
    color: C.muted,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '900',
    color: C.text,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  kpiDelta: {fontSize: 9, fontWeight: '800', marginTop: 3},
  kpiSub: {fontSize: 9, color: C.muted, fontWeight: '600', marginTop: 3},

  /* cards */
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
    elevation: 2,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  cardCompact: {padding: CHART_CARD_PAD, marginBottom: 0},
  cardTitleCompact: {fontSize: 13},
  chartRow: {
    flexDirection: 'row',
    gap: CHART_GAP,
    marginBottom: 14,
    alignItems: 'stretch',
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.accent,
    backgroundColor: '#fdf6e3',
  },
  loadMoreText: {color: C.accentDark, fontSize: 14, fontWeight: '800'},
  loadMoreArrow: {
    color: C.accentDark,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  cardArrow: {
    color: C.accentDark,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 28,
  },
  muted: {color: C.muted, paddingVertical: 8},

  /* donut */
  donutWrap: {alignItems: 'center', paddingVertical: 8},
  donutLegend: {marginTop: 6},
  donutLegRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f5f2',
  },
  donutLegLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    textTransform: 'capitalize',
  },
  donutLegPct: {
    fontSize: 12,
    color: C.text,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  /* grade breakdown */
  gradeRow: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2ee',
  },
  gradeRowLast: {borderBottomWidth: 0, paddingBottom: 2},
  gradeHead: {flexDirection: 'row', alignItems: 'center', gap: 10},
  gradeDot: {width: 12, height: 12, borderRadius: 6},
  gradeNameWrap: {flex: 1},
  gradeName: {fontSize: 14.5, fontWeight: '800', color: C.text},
  gradeLots: {fontSize: 11.5, color: C.muted, fontWeight: '600', marginTop: 1},
  gradeBoxes: {
    fontSize: 16,
    fontWeight: '900',
    color: C.text,
    fontVariant: ['tabular-nums'],
  },
  gradeBoxesUnit: {fontSize: 11.5, fontWeight: '700', color: C.muted},
  gradeBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingLeft: 22,
  },
  gradeTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#eef0ec',
    overflow: 'hidden',
  },
  gradeFill: {height: 10, borderRadius: 5},
  gradePct: {
    width: 42,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  /* tables */
  table: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    minHeight: 42,
    borderBottomWidth: 1,
    borderBottomColor: '#eef0ec',
  },
  thead: {
    backgroundColor: C.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: '#cfe4d1',
    minHeight: 36,
  },
  trAlt: {backgroundColor: '#fafbfa'},
  th: {
    fontSize: 9.5,
    fontWeight: '800',
    color: C.primaryDark,
    letterSpacing: 0.5,
  },
  td: {fontSize: 12.5, color: C.text},
  tfoot: {backgroundColor: '#f4f6f2'},
  tf: {
    fontSize: 11.5,
    fontWeight: '900',
    color: C.primaryDark,
    paddingVertical: 8,
  },

  /* stock */
  stockRow: {flexDirection: 'row', gap: 8, marginTop: 6},
  stockBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    alignItems: 'center',
  },
  stockIcon: {fontSize: 18, marginBottom: 3},
  stockLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stockCount: {fontSize: 21, fontWeight: '900', fontVariant: ['tabular-nums']},
  stockBoxes: {fontSize: 10, color: C.muted, fontWeight: '600', marginTop: 1},
  stockList: {marginTop: 6},
  drillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2ee',
  },
  drillLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textTransform: 'capitalize',
  },
  drillValue: {color: C.primary, fontSize: 12.5, fontWeight: '700'},

  /* summary */
  sumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f5f2',
  },
  sumDot: {width: 9, height: 9, borderRadius: 5},
  sumLabel: {flex: 1, fontSize: 13, color: C.muted, fontWeight: '600'},
  sumValue: {
    fontSize: 13,
    color: C.text,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  stack: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#eef0ec',
    marginTop: 12,
  },
  stackSeg: {height: 14},
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 14,
  },
  legendWrap: {flexWrap: 'wrap', gap: 8},
  legend: {flexDirection: 'row', alignItems: 'center', gap: 5},
  legendDot: {width: 9, height: 9, borderRadius: 5},
  legendText: {fontSize: 11.5, color: C.muted, fontWeight: '700'},
  legendValue: {fontSize: 12.5, color: C.text, fontWeight: '800'},
});
