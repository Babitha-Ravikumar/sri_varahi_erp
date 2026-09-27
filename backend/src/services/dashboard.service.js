const { query } = require('../database/db');

/**
 * DASHBOARD SUMMARY - the day's (or any filtered scope's) business at a glance.
 * EVERY number is computed live from the database - no hardcoded values.
 *
 * Filters (all optional, combinable):
 *   date     YYYY-MM-DD (default today)
 *   source   purchase_source
 *   vehicle  vehicle number (Vehicle Master or captured on the inward)
 *   party    farmer/party name (partial match)
 *   quality_grade_id  Quality Grade master id (exact)
 *   customer customer name (partial match - filters sales metrics)
 */
async function summary(f = {}) {
  const d = f.date || null;
  const source = f.source || null;
  const vehicle = f.vehicle || null;
  const party = f.party || null;
  const quality = f.quality_grade_id ? Number(f.quality_grade_id) : null;
  const customer = f.customer || null;
  const trendDays = Math.max(1, Math.min(parseInt(f.trend_days || 7, 10) || 7, 30));

  // Lot scope: date + source + vehicle + party + quality ($1..$5).
  const scope = `
    FROM lots l
    JOIN inwards i ON i.id = l.inward_id
    LEFT JOIN vehicles v ON v.id = l.vehicle_id
    LEFT JOIN parties p ON p.id = l.party_id
    WHERE ($1::date IS NULL OR i.inward_date = $1)
      AND ($2::text IS NULL OR i.purchase_source = $2)
      AND ($3::text IS NULL OR COALESCE(v.vehicle_number, i.vehicle_number) = $3)
      AND ($4::text IS NULL OR p.name ILIKE '%' || $4 || '%')
      AND ($5::bigint IS NULL OR l.quality_grade_id = $5::bigint)`;
  const P = [d, source, vehicle, party, quality];

  const [stock, arrivedVehicles, salesAuction, salesPre, rateSold, damage, bills, collected,
    outstanding, vehiclesMaster, purchaseValue, prevDay, trend, bySource, byQuality,
    byVehicle, topCustomers, stockLots, stockByStatus] = await Promise.all([

    query(`
      SELECT count(*) AS lots,
             COALESCE(SUM(i.quantity), 0) AS total_boxes,
             COALESCE(SUM(l.total_quantity), 0) AS total_qty,
             COALESCE(SUM(l.pre_auction_quantity + l.allocated_quantity), 0) AS sold_qty,
             COALESCE(SUM(l.remaining_quantity), 0) AS remaining_qty,
             count(*) FILTER (WHERE l.remaining_quantity > 0) AS open_lots
      ${scope}`, P),

    // distinct vehicles that actually arrived in scope
    query(`
      SELECT COUNT(DISTINCT COALESCE(v.vehicle_number, i.vehicle_number)) AS n
      ${scope}`, P),

    query(`
      SELECT COALESCE(SUM(a.quantity * a.rate), 0) AS value, COALESCE(SUM(a.quantity), 0) AS qty
      FROM allocations a
      JOIN lots l ON l.id = a.lot_id
      JOIN inwards i ON i.id = l.inward_id
      LEFT JOIN vehicles v ON v.id = l.vehicle_id
      LEFT JOIN parties pp ON pp.id = l.party_id
      WHERE a.status <> 'cancelled'
        AND ($1::date IS NULL OR i.inward_date = $1)
        AND ($2::text IS NULL OR i.purchase_source = $2)
        AND ($3::text IS NULL OR COALESCE(v.vehicle_number, i.vehicle_number) = $3)
        AND ($4::text IS NULL OR pp.name ILIKE '%' || $4 || '%')
        AND ($5::bigint IS NULL OR l.quality_grade_id = $5::bigint)
        AND ($6::text IS NULL OR NOT EXISTS (
          SELECT 1 FROM customers c WHERE c.id = a.customer_id AND c.name NOT ILIKE '%' || $6 || '%'))`,
      [d, source, vehicle, party, quality, customer]),

    query(`
      SELECT COALESCE(SUM(s.quantity * s.rate), 0) AS value, COALESCE(SUM(s.quantity), 0) AS qty
      FROM pre_auction_sales s
      JOIN lots l ON l.id = s.lot_id
      JOIN inwards i ON i.id = l.inward_id
      LEFT JOIN vehicles v ON v.id = l.vehicle_id
      LEFT JOIN parties pp ON pp.id = l.party_id
      WHERE ($1::date IS NULL OR i.inward_date = $1)
        AND ($2::text IS NULL OR i.purchase_source = $2)
        AND ($3::text IS NULL OR COALESCE(v.vehicle_number, i.vehicle_number) = $3)
        AND ($4::text IS NULL OR pp.name ILIKE '%' || $4 || '%')
        AND ($5::bigint IS NULL OR l.quality_grade_id = $5::bigint)
        AND ($6::text IS NULL OR NOT EXISTS (
          SELECT 1 FROM customers c WHERE c.id = s.customer_id AND c.name NOT ILIKE '%' || $6 || '%'))`,
      [d, source, vehicle, party, quality, customer]),

    // sold quantity+value (for average selling rate) - same scope as sales
    query(`
      SELECT COALESCE(SUM(u.qty), 0) AS qty, COALESCE(SUM(u.value), 0) AS value FROM (
        SELECT a.quantity AS qty, a.quantity * a.rate AS value
        FROM allocations a
        JOIN lots l ON l.id = a.lot_id
        JOIN inwards i ON i.id = l.inward_id
        LEFT JOIN vehicles v ON v.id = l.vehicle_id
        LEFT JOIN parties pp ON pp.id = l.party_id
        WHERE a.status <> 'cancelled'
          AND ($1::date IS NULL OR i.inward_date = $1)
          AND ($2::text IS NULL OR i.purchase_source = $2)
          AND ($3::text IS NULL OR COALESCE(v.vehicle_number, i.vehicle_number) = $3)
          AND ($4::text IS NULL OR pp.name ILIKE '%' || $4 || '%')
          AND ($5::bigint IS NULL OR l.quality_grade_id = $5::bigint)
        UNION ALL
        SELECT s.quantity AS qty, s.quantity * s.rate AS value
        FROM pre_auction_sales s
        JOIN lots l ON l.id = s.lot_id
        JOIN inwards i ON i.id = l.inward_id
        LEFT JOIN vehicles v ON v.id = l.vehicle_id
        LEFT JOIN parties pp ON pp.id = l.party_id
        WHERE ($1::date IS NULL OR i.inward_date = $1)
          AND ($2::text IS NULL OR i.purchase_source = $2)
          AND ($3::text IS NULL OR COALESCE(v.vehicle_number, i.vehicle_number) = $3)
          AND ($4::text IS NULL OR pp.name ILIKE '%' || $4 || '%')
          AND ($5::bigint IS NULL OR l.quality_grade_id = $5::bigint)
      ) u`, P),

    // damage: quantity reduced through post-auction corrections
    query(
      `SELECT COALESCE(SUM((old_data->>'quantity')::numeric - (new_data->>'quantity')::numeric), 0) AS qty
         FROM audit_log
        WHERE entity = 'allocation' AND action = 'correct'
          AND ($1::date IS NULL OR created_at::date = $1)
          AND (old_data->>'quantity') IS NOT NULL AND (new_data->>'quantity') IS NOT NULL
          AND (new_data->>'quantity')::numeric < (old_data->>'quantity')::numeric`,
      [d]
    ),

    query(`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE b.status = 'paid') AS paid,
             count(*) FILTER (WHERE b.status = 'part_paid') AS part_paid,
             count(*) FILTER (WHERE b.status = 'unpaid') AS unpaid,
             COALESCE(SUM(b.total_amount), 0) AS billed,
             COALESCE(SUM(b.paid_amount), 0) AS paid_amount
      FROM bills b
      JOIN lots l ON l.id = b.lot_id
      JOIN inwards i ON i.id = l.inward_id
      LEFT JOIN vehicles v ON v.id = l.vehicle_id
      LEFT JOIN parties p2 ON p2.id = l.party_id
      JOIN customers c ON c.id = b.customer_id
      WHERE b.status <> 'void'
        AND ($1::date IS NULL OR i.inward_date = $1)
        AND ($2::text IS NULL OR i.purchase_source = $2)
        AND ($3::text IS NULL OR COALESCE(v.vehicle_number, i.vehicle_number) = $3)
        AND ($4::text IS NULL OR p2.name ILIKE '%' || $4 || '%')
        AND ($5::bigint IS NULL OR l.quality_grade_id = $5::bigint)
        AND ($6::text IS NULL OR c.name ILIKE '%' || $6 || '%')`,
      [d, source, vehicle, party, quality, customer]),

    query(
      `SELECT COALESCE(SUM(amount), 0) AS amount, count(*) AS count
         FROM payments WHERE ($1::date IS NULL OR received_at::date = $1)`,
      [d]
    ),

    query(
      `SELECT count(*) AS bills, COALESCE(SUM(total_amount - paid_amount), 0) AS amount
        FROM bills WHERE status IN ('unpaid', 'part_paid')`
    ),

    query(`SELECT count(*) AS n FROM vehicles WHERE active`),

    // purchase value & rated quantity (for average purchase rate)
    query(`
      SELECT COALESCE(SUM(i.quantity * COALESCE(i.purchase_rate, i.final_rate)), 0) AS value,
             COALESCE(SUM(i.quantity) FILTER (WHERE COALESCE(i.purchase_rate, i.final_rate) IS NOT NULL), 0) AS qty
      ${scope}`, P),

    // previous-day reference (single-day view only): lots, boxes, vehicles
    query(`
      SELECT count(DISTINCT l.id) AS lots, COALESCE(SUM(i.quantity), 0) AS boxes,
             COUNT(DISTINCT COALESCE(v.vehicle_number, i.vehicle_number)) AS vehicles
      FROM lots l
      JOIN inwards i ON i.id = l.inward_id
      LEFT JOIN vehicles v ON v.id = l.vehicle_id
      LEFT JOIN parties p ON p.id = l.party_id
      WHERE i.inward_date = COALESCE($1::date, current_date) - 1
        AND ($2::text IS NULL OR i.purchase_source = $2)
        AND ($3::text IS NULL OR COALESCE(v.vehicle_number, i.vehicle_number) = $3)
        AND ($4::text IS NULL OR p.name ILIKE '%' || $4 || '%')
        AND ($5::bigint IS NULL OR l.quality_grade_id = $5::bigint)`, P),

    // arrival trend - last N days: inwards, boxes, lots, vehicles per day
    query(`
      SELECT i.inward_date AS day, COALESCE(SUM(i.quantity), 0) AS boxes, count(*) AS inwards,
             COUNT(DISTINCT l.id) AS lots,
             COUNT(DISTINCT COALESCE(v.vehicle_number, i.vehicle_number)) AS vehicles
      FROM inwards i
      LEFT JOIN lots l ON l.inward_id = i.id
      LEFT JOIN vehicles v ON v.id = i.vehicle_id
      LEFT JOIN parties p ON p.id = i.party_id
      WHERE i.inward_date >= current_date - ($4::int - 1)
        AND ($1::text IS NULL OR i.purchase_source = $1)
        AND ($2::text IS NULL OR COALESCE(v.vehicle_number, i.vehicle_number) = $2)
        AND ($3::text IS NULL OR p.name ILIKE '%' || $3 || '%')
      GROUP BY 1 ORDER BY 1`, [source, vehicle, party, trendDays]),

    query(`
      SELECT i.purchase_source AS source, count(DISTINCT l.id) AS lots, COALESCE(SUM(i.quantity), 0) AS boxes
      ${scope} GROUP BY 1 ORDER BY boxes DESC`, P),

    query(`
      SELECT l.quality_grade_id AS grade_id, COALESCE(NULLIF(l.quality, ''), 'Unspecified') AS quality,
             count(DISTINCT l.id) AS lots, COALESCE(SUM(i.quantity), 0) AS boxes
      ${scope} GROUP BY 1, 2 ORDER BY boxes DESC`, P),

    query(`
      SELECT COALESCE(v.vehicle_number, i.vehicle_number, 'No vehicle') AS vehicle,
             count(DISTINCT l.id) AS lots, COALESCE(SUM(i.quantity), 0) AS boxes,
             COALESCE(SUM(l.total_quantity), 0) AS quantity
      ${scope} GROUP BY 1 ORDER BY boxes DESC LIMIT 5`, P),

    customerSales(f, TOP_CUSTOMERS_ON_DASHBOARD),

    // stock position: lots that still have boxes to sell
    query(`
      SELECT l.id, l.lot_number, COALESCE(v.vehicle_number, i.vehicle_number) AS vehicle,
             p.name AS party, l.quality, l.remaining_quantity AS remaining
      ${scope} AND l.remaining_quantity > 0
      ORDER BY l.id DESC LIMIT 12`, P),

    // stock by status: unauctioned / partially sold / fully sold
    query(`
      SELECT
        count(*) FILTER (WHERE l.pre_auction_quantity + l.allocated_quantity = 0 AND l.remaining_quantity > 0) AS unauctioned,
        COALESCE(SUM(l.total_quantity) FILTER (WHERE l.pre_auction_quantity + l.allocated_quantity = 0 AND l.remaining_quantity > 0), 0) AS unauctioned_boxes,
        count(*) FILTER (WHERE l.pre_auction_quantity + l.allocated_quantity > 0 AND l.remaining_quantity > 0) AS partial,
        COALESCE(SUM(l.total_quantity) FILTER (WHERE l.pre_auction_quantity + l.allocated_quantity > 0 AND l.remaining_quantity > 0), 0) AS partial_boxes,
        count(*) FILTER (WHERE l.remaining_quantity = 0) AS sold,
        COALESCE(SUM(l.total_quantity) FILTER (WHERE l.remaining_quantity = 0), 0) AS sold_boxes
      ${scope}`, P),
  ]);

  const s = stock.rows[0];
  const b = bills.rows[0];
  const soldQty = Number(rateSold.rows[0].qty);
  const soldVal = Number(rateSold.rows[0].value);
  const ratedQty = Number(purchaseValue.rows[0].qty);
  const ratedVal = Number(purchaseValue.rows[0].value);
  const st = stockByStatus.rows[0];

  return {
    // headline numbers
    total_lots: Number(s.lots),
    open_lots: Number(s.open_lots),
    total_boxes: Number(s.total_boxes),
    total_quantity: Number(s.total_qty),
    sold_quantity: Number(s.sold_qty),
    remaining_quantity: Number(s.remaining_qty),
    total_sales: Number(salesAuction.rows[0].value) + Number(salesPre.rows[0].value),
    damage_quantity: Number(damage.rows[0].qty),
    arrived_vehicles: Number(arrivedVehicles.rows[0].n),
    avg_purchase_rate: ratedQty > 0 ? ratedVal / ratedQty : 0,
    avg_selling_rate: soldQty > 0 ? soldVal / soldQty : 0,
    purchase_value: ratedVal,
    total_vehicles: Number(vehiclesMaster.rows[0].n),

    // previous-day reference (for KPI change indicators)
    prev_day: {
      lots: Number(prevDay.rows[0].lots),
      boxes: Number(prevDay.rows[0].boxes),
      vehicles: Number(prevDay.rows[0].vehicles),
    },

    bills: {
      total: Number(b.total),
      paid: Number(b.paid),
      part_paid: Number(b.part_paid),
      unpaid: Number(b.unpaid),
      billed_amount: Number(b.billed),
      paid_amount: Number(b.paid_amount),
    },
    collected_amount: Number(collected.rows[0].amount),
    payment_count: Number(collected.rows[0].count),
    outstanding_bills: Number(outstanding.rows[0].bills),
    outstanding_amount: Number(outstanding.rows[0].amount),

    // charts & tables
    trend: trend.rows.map((r) => ({
      day: r.day, boxes: Number(r.boxes), inwards: Number(r.inwards),
      lots: Number(r.lots), vehicles: Number(r.vehicles),
    })),
    by_source: bySource.rows.map((r) => ({ source: r.source, lots: Number(r.lots), boxes: Number(r.boxes) })),
    by_quality: byQuality.rows.map((r) => ({
      grade_id: r.grade_id == null ? null : Number(r.grade_id), quality: r.quality,
      lots: Number(r.lots), boxes: Number(r.boxes),
    })),
    by_vehicle: byVehicle.rows.map((r) => ({
      vehicle: r.vehicle, lots: Number(r.lots), boxes: Number(r.boxes), quantity: Number(r.quantity),
    })),
    top_customers: topCustomers.rows,
    top_customers_total: topCustomers.total,
    stock_lots: stockLots.rows.map((r) => ({
      id: Number(r.id), lot_number: r.lot_number, vehicle: r.vehicle, party: r.party,
      quality: r.quality, remaining: Number(r.remaining),
    })),
    stock_status: {
      unauctioned: Number(st.unauctioned), unauctioned_boxes: Number(st.unauctioned_boxes),
      partial: Number(st.partial), partial_boxes: Number(st.partial_boxes),
      sold: Number(st.sold), sold_boxes: Number(st.sold_boxes),
    },
  };
}

const TOP_CUSTOMERS_ON_DASHBOARD = 5;

/**
 * Customer-wise sales (auction allocations + night pre-auction sales) in the
 * dashboard's filter scope, highest value first. `limit` null = every customer.
 * Returns { rows, total } where total is the number of customers in scope.
 */
async function customerSales(f = {}, limit = null) {
  const params = [
    f.date || null, f.source || null, f.vehicle || null,
    f.party || null, f.quality_grade_id ? Number(f.quality_grade_id) : null, f.customer || null, limit,
  ];
  const r = await query(`
    SELECT customer_id, name, phone,
           SUM(qty) AS quantity, SUM(value) AS value, COUNT(DISTINCT lot_id) AS lots,
           count(*) OVER () AS total
    FROM (
      SELECT c.id AS customer_id, c.name, c.phone, a.quantity AS qty, a.quantity * a.rate AS value, a.lot_id
      FROM allocations a
      JOIN customers c ON c.id = a.customer_id
      JOIN lots l ON l.id = a.lot_id
      JOIN inwards i ON i.id = l.inward_id
      LEFT JOIN vehicles vv ON vv.id = l.vehicle_id
      LEFT JOIN parties pa ON pa.id = l.party_id
      WHERE a.status <> 'cancelled'
        AND ($1::date IS NULL OR i.inward_date = $1)
        AND ($2::text IS NULL OR i.purchase_source = $2)
        AND ($3::text IS NULL OR COALESCE(vv.vehicle_number, i.vehicle_number) = $3)
        AND ($4::text IS NULL OR pa.name ILIKE '%' || $4 || '%')
        AND ($5::bigint IS NULL OR l.quality_grade_id = $5::bigint)
        AND ($6::text IS NULL OR c.name ILIKE '%' || $6 || '%')
      UNION ALL
      SELECT c.id, c.name, c.phone, s.quantity, s.quantity * s.rate, s.lot_id
      FROM pre_auction_sales s
      JOIN customers c ON c.id = s.customer_id
      JOIN lots l ON l.id = s.lot_id
      JOIN inwards i ON i.id = l.inward_id
      LEFT JOIN vehicles vv ON vv.id = l.vehicle_id
      LEFT JOIN parties pa ON pa.id = l.party_id
      WHERE ($1::date IS NULL OR i.inward_date = $1)
        AND ($2::text IS NULL OR i.purchase_source = $2)
        AND ($3::text IS NULL OR COALESCE(vv.vehicle_number, i.vehicle_number) = $3)
        AND ($4::text IS NULL OR pa.name ILIKE '%' || $4 || '%')
        AND ($5::bigint IS NULL OR l.quality_grade_id = $5::bigint)
        AND ($6::text IS NULL OR c.name ILIKE '%' || $6 || '%')
    ) u
    GROUP BY customer_id, name, phone
    ORDER BY value DESC, name
    LIMIT $7`, params);

  const rows = r.rows.map((x) => {
    const quantity = Number(x.quantity);
    const value = Number(x.value);
    return {
      customer_id: Number(x.customer_id), name: x.name, phone: x.phone,
      quantity, value, lots: Number(x.lots),
      avg_rate: quantity > 0 ? value / quantity : 0,
    };
  });
  return { rows, total: r.rows.length ? Number(r.rows[0].total) : 0 };
}

/** Full Top Customers list for the dashboard's "Load More" page. */
async function topCustomers(f = {}) {
  const { rows, total } = await customerSales(f, null);
  const totalValue = rows.reduce((a, c) => a + c.value, 0);
  return {
    total,
    total_value: totalValue,
    total_quantity: rows.reduce((a, c) => a + c.quantity, 0),
    customers: rows.map((c, i) => ({
      rank: i + 1, ...c, share: totalValue > 0 ? (c.value / totalValue) * 100 : 0,
    })),
  };
}

module.exports = { summary, topCustomers };
