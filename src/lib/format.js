const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const moneyFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// 1234567.5 → "฿1,234,567.50"
export const formatBaht = (n) => `฿${moneyFmt.format(n)}`

// สำหรับแกนกราฟ: ไม่มีทศนิยม → "฿120,000"
export const formatBahtShort = (n) => `฿${intFmt.format(n)}`

// สำหรับแกนกราฟบนจอแคบ: 1400000 → "฿1.4M", 350000 → "฿350K"
const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
export const formatBahtCompact = (n) => `฿${compactFmt.format(n)}`

// 12345 → "12,345"
export const formatNumber = (n) => intFmt.format(n)

const toDate = (key) => new Date(`${key}T00:00:00+07:00`)

// สร้าง formatter ครั้งเดียวแล้วใช้ซ้ำ — toLocaleDateString(…, options) สร้างใหม่ทุกครั้งซึ่งช้ามาก
const dateFmt = (options) => {
  const fmt = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', ...options })
  return (key) => fmt.format(toDate(key))
}

// "2025-04-01" → "1 เม.ย."
export const formatDayShort = dateFmt({ day: 'numeric', month: 'short' })

// "2025-04-01" → "1 เม.ย. 68" (ใช้เมื่อข้อมูลคร่อมหลายปี)
export const formatDayShortYear = dateFmt({ day: 'numeric', month: 'short', year: '2-digit' })

// "2025-04-01" → "เม.ย. 68"
export const formatMonthShort = dateFmt({ month: 'short', year: '2-digit' })

// "2025-04-01" → "เมษายน 2568"
export const formatMonthLong = dateFmt({ month: 'long', year: 'numeric' })

// "2025-04-01" → "อ. 1 เม.ย. 2568"
export const formatDayLong = dateFmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

// 0.391 → "39%" (digits = ทศนิยม)
export const formatPct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`
