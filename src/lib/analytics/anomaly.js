// Lab 4.5 · หาวันที่ยอดขายผิดปกติ
// เทียบกับ "ค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน" ไม่ใช่ค่าเฉลี่ย 28 วัน
// เพราะสาขาออฟฟิศกับห้างขายวันธรรมดาและเสาร์-อาทิตย์ต่างกันมาก
import { addDays } from "../../lab3/time.js";

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/**
 * คะแนนความผิดปกติ = ln((จริง + SMOOTH) / (คาดหวัง + SMOOTH))
 * SMOOTH กันไม่ให้วันยอดน้อย ๆ (เช่น 50 บาท เทียบ 100 บาท) ดูผิดปกติเกินจริง
 * @param daily    [{ date, branch, revenue }] จาก dailyByBranch()
 * @param holidays { "YYYY-MM-DD": "ชื่อวันหยุด" } วันหยุดจะไม่ถูกจัดอันดับ แต่ติดป้ายไว้
 * @returns ทุกวันที่คำนวณได้ เรียงจากผิดปกติมากไปน้อย:
 *   { date, branch, actual, expected, change (สัดส่วน เช่น -0.9 = ต่ำกว่าปกติ 90%), score, holiday }
 */
export function scoreAnomalies(daily, holidays = {}, { weeks = 8, minWeeks = 4, smooth = 1000 } = {}) {
  const byBranch = new Map(); // branch → Map(date → revenue)
  for (const d of daily) {
    if (!byBranch.has(d.branch)) byBranch.set(d.branch, new Map());
    const m = byBranch.get(d.branch);
    m.set(d.date, (m.get(d.date) ?? 0) + d.revenue);
  }
  const out = [];
  for (const [branch, sales] of byBranch) {
    const dates = [...sales.keys()].sort();
    const first = dates[0];
    const last = dates[dates.length - 1];
    // วันที่ร้านเปิดแต่ไม่มียอดเลยนับเป็น 0 · ก่อนวันแรกของสาขาไม่นับ
    const revenueOn = (d) => (d < first ? undefined : sales.get(d) ?? 0);
    for (let date = first; date <= last; date = addDays(date, 1)) {
      const past = [];
      for (let w = 1; w <= weeks; w++) {
        const v = revenueOn(addDays(date, -7 * w));
        if (v !== undefined) past.push(v);
      }
      if (past.length < minWeeks) continue;
      const actual = revenueOn(date);
      const expected = median(past);
      out.push({
        date,
        branch,
        actual,
        expected,
        change: expected ? actual / expected - 1 : 0,
        score: Math.log((actual + smooth) / (expected + smooth)),
        holiday: holidays[date] ?? null,
      });
    }
  }
  return out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || a.date.localeCompare(b.date));
}

/** อันดับวันผิดปกติที่ควรตรวจสอบ (ไม่รวมวันหยุด) */
export function topAnomalies(daily, holidays = {}, n = 15, opts) {
  return scoreAnomalies(daily, holidays, opts).filter((a) => !a.holiday).slice(0, n);
}
