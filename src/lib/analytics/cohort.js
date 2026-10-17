// Lab 4.2 · Cohort retention รายเดือน
// cohort = เดือนแรกที่ลูกค้าสมาชิกซื้อ · retention[k] = สัดส่วนลูกค้าใน cohort ที่กลับมาซื้อในเดือนที่ k (k=0 คือเดือนแรก = 100%)

/** จำนวนเดือนจาก a ถึง b เช่น monthIndex("2025-11", "2026-02") = 3 */
export function monthIndex(a, b) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

// "2026-07" + 2 เดือน → "2026-09" (คิดจากเลขเดือน ไม่ผ่าน Date จึงไม่มีปัญหา timezone)
const addMonths = (ym, k) => {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

// จำนวนวันในเดือน: วันที่ 0 ของเดือนถัดไป (Date.UTC) = วันสุดท้ายของเดือนนี้
const daysIn = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * @param rows  แถวยอดขาย (ไม่นับ customer_id ว่าง)
 * @param asOf  วันสุดท้ายของข้อมูล YYYY-MM-DD ใช้บอกว่าเดือนสุดท้ายข้อมูลไม่ครบหรือไม่
 * @returns {{ cohorts: {cohort, size, retention: number[]}[], lastMonth, lastMonthPartial, daysInLastMonth }}
 *   retention ยาวเท่าจำนวนเดือนที่สังเกตได้ของ cohort นั้น (ถึง lastMonth)
 */
export function computeCohorts(rows, asOf) {
  const months = new Map(); // customer_id → Set ของเดือนที่ซื้อ
  for (const x of rows) {
    if (!x.customer_id) continue;
    const set = months.get(x.customer_id) ?? new Set();
    set.add(x.date.slice(0, 7));
    months.set(x.customer_id, set);
  }
  const lastMonth = asOf.slice(0, 7);
  const groups = new Map(); // cohort → [Set ของเดือนที่ซื้อของลูกค้าแต่ละคน]
  for (const set of months.values()) {
    const first = [...set].sort()[0];
    if (!groups.has(first)) groups.set(first, []);
    groups.get(first).push(set);
  }
  const cohorts = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, members]) => {
      const span = monthIndex(cohort, lastMonth);
      // นับลูกค้า ไม่ใช่จำนวนครั้ง: ซื้อหลายครั้งในเดือนเดียวกันนับครั้งเดียว
      const retention = Array.from({ length: span + 1 }, (_, k) => {
        const month = addMonths(cohort, k);
        return members.filter((s) => s.has(month)).length / members.length;
      });
      return { cohort, size: members.length, retention };
    });
  const daysInLastMonth = Number(asOf.slice(8, 10));
  const daysInMonth = daysIn(lastMonth);
  return { cohorts, lastMonth, lastMonthPartial: daysInLastMonth < daysInMonth, daysInLastMonth, daysInMonth };
}
