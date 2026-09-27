import Papa from 'papaparse'

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

// แปลงข้อความตัวเลข เช่น "1,250.50" → 1250.5 (อ่านไม่ได้ → NaN)
function toNumber(value) {
  if (value === null || value === undefined) return NaN
  const cleaned = String(value).replace(/,/g, '').trim()
  return cleaned === '' ? NaN : Number(cleaned)
}

// ปัดเศษทศนิยม 2 ตำแหน่ง กันปัญหา floating point (เช่น 0.1 + 0.2)
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// วันที่ตามเวลาไทย (YYYY-MM-DD) จาก ISO datetime ที่มี offset ใด ๆ ก็ได้
export function toBangkokDate(datetime) {
  const ms = Date.parse(datetime)
  if (Number.isNaN(ms)) return null
  return new Date(ms + BANGKOK_OFFSET_MS).toISOString().slice(0, 10)
}

// ยอดขายของหนึ่งแถว = qty × unit_price
export function lineTotal(row) {
  return row.qty * row.unit_price
}

// อ่าน CSV → แถวที่ทำความสะอาดแล้ว + จำนวนแถวที่ข้ามเพราะข้อมูลเสีย
export function parseSales(csvText) {
  const { data } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === 'string' ? v.trim() : v),
  })

  const rows = []
  let skipped = 0
  for (const raw of data) {
    const row = {
      order_id: raw.order_id,
      datetime: raw.datetime,
      date: toBangkokDate(raw.datetime),
      branch: raw.branch || 'ไม่ระบุสาขา',
      product_id: raw.product_id,
      qty: toNumber(raw.qty),
      unit_price: toNumber(raw.unit_price),
      customer_id: raw.customer_id || null, // ว่าง = ลูกค้าทั่วไป
      payment_method: raw.payment_method,
      channel: raw.channel,
    }
    row.revenue = lineTotal(row) // ใช้ร่วมกับฟังก์ชันใน src/lab2/lab2Metrics.js
    const valid =
      row.order_id && row.date && Number.isFinite(row.qty) && Number.isFinite(row.unit_price)
    if (valid) rows.push(row)
    else skipped++
  }
  return { rows, skipped }
}

// KPI หลัก 4 ตัว
export function computeKpis(rows) {
  let totalSales = 0
  const orders = new Set()
  const members = new Set()

  for (const row of rows) {
    totalSales += lineTotal(row)
    orders.add(row.order_id)
    if (row.customer_id) members.add(row.customer_id)
  }

  const orderCount = orders.size
  return {
    totalSales: round2(totalSales),
    orderCount,
    avgPerOrder: orderCount ? round2(totalSales / orderCount) : 0,
    uniqueMembers: members.size,
  }
}

// ยอดขายรายวัน (เวลาไทย) เรียงตามวันที่ วันที่ไม่มียอดขายเติมเป็น 0
// range (ไม่บังคับ) = { from, to } กำหนดช่วงวันที่ต้องมีครบ แม้วันต้น/ท้ายช่วงจะไม่มียอดขาย
export function dailySales(rows, range) {
  const byDate = new Map()
  for (const row of rows) {
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + lineTotal(row))
  }
  const dates = [...byDate.keys()].sort()
  const first = range?.from ?? dates[0]
  const last = range?.to ?? dates[dates.length - 1]
  if (!first || !last) return []

  const result = []
  const end = new Date(`${last}T00:00:00Z`)
  for (let d = new Date(`${first}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    result.push({ date: key, sales: round2(byDate.get(key) ?? 0) })
  }
  return result
}

// ยอดขายรายวันในรูป { date, revenue } สำหรับกราฟใน src/lab2
export function dailyRevenue(rows) {
  return dailySales(rows).map(({ date, sales }) => ({ date, revenue: sales }))
}

// เพิ่มค่าเฉลี่ยเคลื่อนที่ย้อนหลัง `window` วัน (รวมวันนั้นเอง) ลงใน field `avg`
// ใช้กับผลของ dailySales ซึ่งมีครบทุกวันแล้ว 1 แถว = 1 วันเสมอ
// วันแรก ๆ ที่ข้อมูลยังไม่ครบ window จะเป็น null (ไม่วาดเส้น) แทนการเฉลี่ยจากข้อมูลไม่ครบ
export function movingAverage(daily, window = 7) {
  let sum = 0
  return daily.map((day, i) => {
    sum += day.sales
    if (i >= window) sum -= daily[i - window].sales
    return { ...day, avg: i >= window - 1 ? round2(sum / window) : null }
  })
}

// ยอดขายแยกสาขา เรียงจากมากไปน้อย
export function salesByBranch(rows) {
  const byBranch = new Map()
  for (const row of rows) {
    byBranch.set(row.branch, (byBranch.get(row.branch) ?? 0) + lineTotal(row))
  }
  return [...byBranch]
    .map(([branch, sales]) => ({ branch, sales: round2(sales) }))
    .sort((a, b) => b.sales - a.sales)
}

// ---------- การกระจายยอดต่อบิล ----------

// ยอดรวมของแต่ละบิล (1 บิล = ทุกแถวของ order_id เดียวกัน)
export function billTotals(rows) {
  const byOrder = new Map()
  for (const row of rows) {
    byOrder.set(row.order_id, (byOrder.get(row.order_id) ?? 0) + lineTotal(row))
  }
  return [...byOrder.values()]
}

// quantile แบบ linear interpolation (วิธีเดียวกับ pandas) ของ array ที่เรียงแล้ว
function quantileSorted(sorted, q) {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

// ฮิสโตแกรมยอดต่อบิล ช่องละ binSize บาท + ค่าสรุป
// บิลที่ใหญ่กว่า percentile 99 รวมไว้ในช่องสุดท้าย (tailFrom ขึ้นไป) เพื่อไม่ให้หางยาวบีบกราฟ
// คืน { bins: [{ from, to, bills, share }], tailFrom, count, mean, median, p90, belowMean }
export function billDistribution(rows, binSize = 20) {
  const totals = billTotals(rows).sort((a, b) => a - b)
  const count = totals.length
  if (!count) return { bins: [], tailFrom: null, count: 0, mean: 0, median: 0, p90: 0, belowMean: 0 }

  const mean = totals.reduce((sum, t) => sum + t, 0) / count
  const tailFrom = Math.ceil(quantileSorted(totals, 0.99) / binSize) * binSize
  const lastBin = Math.min(Math.floor(totals[count - 1] / binSize), tailFrom / binSize)
  const bins = Array.from({ length: lastBin + 1 }, (_, i) => ({
    from: i * binSize,
    to: i * binSize + binSize - 1,
    bills: 0,
  }))
  for (const t of totals) bins[Math.min(Math.floor(t / binSize), lastBin)].bills++
  if (bins[lastBin].from === tailFrom) bins[lastBin].to = null // null = ช่อง "tailFrom ขึ้นไป"
  for (const b of bins) b.share = b.bills / count

  return {
    bins,
    tailFrom,
    count,
    mean: round2(mean),
    median: round2(quantileSorted(totals, 0.5)),
    p90: round2(quantileSorted(totals, 0.9)),
    belowMean: totals.filter((t) => t < mean).length / count,
  }
}

// ---------- ตัวกรอง ----------

// วันแรกและวันสุดท้ายที่มีข้อมูล (YYYY-MM-DD) — วันที่รูปแบบนี้เทียบเป็น string ได้เลย
export function getDateBounds(rows) {
  let min = null
  let max = null
  for (const { date } of rows) {
    if (min === null || date < min) min = date
    if (max === null || date > max) max = date
  }
  return { min, max }
}

// รายชื่อสาขาทั้งหมด เรียงตามยอดขายรวมมาก→น้อย (ลำดับเดียวกับกราฟแท่ง)
export function listBranches(rows) {
  return salesByBranch(rows).map((b) => b.branch)
}

// เลื่อนวันที่ YYYY-MM-DD ไป n วัน (ติดลบ = ย้อนหลัง)
export function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ช่วง "ย้อนหลัง n วัน" นับจากวันสุดท้ายที่มีข้อมูล (รวมวันนั้น) ไม่ให้เกินวันแรกของข้อมูล
// days = null → ทั้งหมด
export function presetRange(bounds, days) {
  if (!days) return { from: bounds.min, to: bounds.max }
  const from = addDays(bounds.max, -(days - 1))
  return { from: from < bounds.min ? bounds.min : from, to: bounds.max }
}

// ---------- ยอดขายรายสาขาตามเวลา ----------

// จำนวนวันจาก a ถึง b (รวมทั้งสองวัน)
export function daysInRange(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1
}

// เลือกหน่วยเวลาให้จำนวนจุดบนกราฟพอดี: ≤ 31 วัน → รายวัน, ≤ 26 สัปดาห์ → รายสัปดาห์, มากกว่านั้น → รายเดือน
export function pickGranularity(from, to) {
  const days = daysInRange(from, to)
  if (days <= 31) return 'day'
  if (days <= 182) return 'week'
  return 'month'
}

// วันแรกของช่วงที่ date อยู่ (สัปดาห์เริ่มวันจันทร์)
export function periodStart(date, granularity) {
  if (granularity === 'month') return `${date.slice(0, 7)}-01`
  if (granularity === 'week') {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = อาทิตย์
    return addDays(date, -((dow + 6) % 7))
  }
  return date
}

// วันสุดท้ายของช่วงที่เริ่มต้นที่ start
export function periodEnd(start, granularity) {
  if (granularity === 'month') {
    const d = new Date(`${start}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + 1, 0) // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้
    return d.toISOString().slice(0, 10)
  }
  if (granularity === 'week') return addDays(start, 6)
  return start
}

// ยอดขายของแต่ละสาขาในแต่ละช่วงเวลา (วัน/สัปดาห์/เดือน) ภายใน from–to
// คืน [{ start, end, days, coveredDays, [ชื่อสาขา]: ยอดขาย, ... }] เรียงตามเวลา มีครบทุกช่วงและทุกสาขา
// ไม่มียอดในช่วงนั้น = 0, สาขายังไม่เปิด (ก่อนยอดขายครั้งแรก) = null
// coveredDays < days แปลว่าช่วงนั้นถูกตัดโดยตัวกรองวันที่ (เช่น เดือนแรก/เดือนสุดท้าย) ยอดจึงต่ำกว่าเดือนเต็ม
export function branchSalesOverTime(rows, { from, to, granularity, branches }) {
  const periods = []
  const index = new Map()
  for (let start = periodStart(from, granularity); start <= to; start = addDays(periodEnd(start, granularity), 1)) {
    const end = periodEnd(start, granularity)
    const period = {
      start,
      end,
      days: daysInRange(start, end),
      coveredDays: daysInRange(start < from ? from : start, end > to ? to : end),
    }
    for (const b of branches) period[b] = 0
    index.set(start, periods.length)
    periods.push(period)
  }

  const wanted = new Set(branches)
  const firstSale = new Map() // วันแรกที่สาขามียอดขาย (ดูจากทุกแถวที่ส่งมา ไม่ใช่แค่ในช่วงที่เลือก)
  const startOf = new Map() // cache: วันที่ → วันแรกของช่วง (ข้อมูลหลายหมื่นแถวแต่มีไม่กี่ร้อยวัน)
  for (const row of rows) {
    if (!wanted.has(row.branch)) continue
    const first = firstSale.get(row.branch)
    if (first === undefined || row.date < first) firstSale.set(row.branch, row.date)
    if (row.date < from || row.date > to) continue
    let start = startOf.get(row.date)
    if (start === undefined) startOf.set(row.date, (start = periodStart(row.date, granularity)))
    periods[index.get(start)][row.branch] += lineTotal(row)
  }

  // ช่วงที่จบก่อนสาขาเปิด (ยังไม่มียอดขายครั้งแรก) = null → กราฟไม่ลากเส้นที่ 0 ให้ดูเหมือนขายไม่ได้
  for (const p of periods) {
    for (const b of branches) {
      const first = firstSale.get(b)
      p[b] = first === undefined || p.end < first ? null : round2(p[b])
    }
  }
  return periods
}

// กรองแถวตามสาขาและช่วงวันที่ (รวมวัน from และ to)
// branches ว่างหรือ null = ทุกสาขา; from/to ว่าง = ไม่จำกัดด้านนั้น
export function filterRows(rows, { branches, from, to } = {}) {
  const branchSet = branches?.length ? new Set(branches) : null
  return rows.filter(
    (r) =>
      (!branchSet || branchSet.has(r.branch)) && (!from || r.date >= from) && (!to || r.date <= to),
  )
}
