// Lab 2.2 · กราฟที่ซ่อมแล้ว — แต่ละกราฟรับ props { rows, products } เหมือน BadChart ที่คู่กัน
// ทุกกราฟใช้สีหลักสีเดียวจากธีม และมีข้อความสรุป 1 บรรทัดที่คำนวณจากข้อมูลจริงอยู่เหนือกราฟ
import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Cell,
} from 'recharts'
import { useChartTheme } from '../lib/chartTheme'
import { formatBaht, formatBahtCompact, formatBahtShort, formatDayShortYear, formatMonthShort, formatNumber } from '../lib/format'
import {
  branchPerformance, daysInMonth, monthlyRevenue, revenueByGender, revenueByProduct, thaiMonth, weeklyRevenue, WALK_IN,
} from './lab2Metrics.js'

const TOP_MENUS = 10
const TREND_WEEKS = 4
const PARTIAL_OPACITY = 0.4 // เดือนที่ข้อมูลไม่ครบ ใช้สีเดิมแต่จางลง
const SHORT_HISTORY = 0.9 // สาขาที่มีข้อมูลน้อยกว่า 90% ของสาขาที่นานที่สุด ถือว่าเพิ่งเปิด (ขาด 1–2 วันไม่นับ)

const pct = (n) => `${(n * 100).toFixed(1)}%`
const signedPct = (n) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ข้อความสรุปด้านบน + พื้นที่กราฟที่ยืดเต็มความสูงที่เหลือ
function Frame({ summary, children }) {
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-sm font-medium text-stone-800 dark:text-stone-100">{summary}</p>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  )
}

// tooltip ที่แสดงหลายบรรทัดจากแถวข้อมูลเดียว: lines(datum) → [[ชื่อ, ค่า], ...]
function Tip({ active, payload, title, lines }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-md ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700">
      <p className="font-semibold text-stone-900 dark:text-stone-50">{title(d)}</p>
      {lines(d).map(([k, v]) => (
        <p key={k} className="mt-0.5 flex gap-3 tabular-nums text-stone-600 dark:text-stone-300">
          <span className="text-stone-500 dark:text-stone-400">{k}</span>
          <span className="ml-auto">{v}</span>
        </p>
      ))}
    </div>
  )
}

// แท่งแนวนอนเรียงมาก→น้อย แกนเริ่มที่ 0 ชื่อยาวอ่านได้ และมีค่ากำกับปลายแท่ง
function RankedBars({ data, nameKey, valueKey, labelFormat, nameWidth, labelWidth = 72, tip }) {
  const theme = useChartTheme()
  return (
    <BarChart data={data} layout="vertical" margin={{ top: 0, right: labelWidth, bottom: 0, left: 0 }}>
      <XAxis type="number" domain={[0, 'auto']} hide />
      <YAxis
        type="category" dataKey={nameKey} width={nameWidth} tickLine={false} axisLine={false} interval={0}
        tick={{ fontSize: 12, fill: theme.labelText }}
      />
      <Tooltip cursor={{ fill: theme.barCursor }} content={tip} />
      <Bar dataKey={valueKey} fill={theme.series} radius={[0, 3, 3, 0]} isAnimationActive={false}>
        <LabelList dataKey={valueKey} position="right" formatter={labelFormat} fontSize={11} fill={theme.labelText} />
      </Bar>
    </BarChart>
  )
}

/** กราฟ 1: 10 เมนูที่ทำเงินสูงสุด เป็นแท่งแนวนอนเรียงลำดับ แทน pie 40 ชิ้น */
export function FixedChart1({ rows, products }) {
  const { data, summary } = useMemo(() => {
    const all = revenueByProduct(rows, products)
    const top = all.slice(0, TOP_MENUS)
    const [a, b, c] = top
    const topShare = top.reduce((s, d) => s + d.share, 0)
    return {
      data: top,
      summary:
        `${a.name} ทำเงินสูงสุด ${formatBahtShort(a.revenue)} (${pct(a.share)}) ตามด้วย ${b.name} และ ${c.name}` +
        ` · ${top.length} อันดับแรกรวม ${pct(topShare)} จากทั้งหมด ${all.length} เมนู`,
    }
  }, [rows, products])

  return (
    <Frame summary={summary}>
      <RankedBars
        data={data} nameKey="name" valueKey="revenue" nameWidth={130} labelFormat={formatBahtShort}
        tip={<Tip title={(d) => d.name} lines={(d) => [['ยอดขาย', formatBahtShort(d.revenue)], ['สัดส่วน', pct(d.share)]]} />}
      />
    </Frame>
  )
}

/** กราฟ 2: ยอดขายแยกสาขา แกนเริ่มที่ 0 เรียงมาก→น้อย สีเดียว */
export function FixedChart2({ rows }) {
  const { data, summary } = useMemo(() => {
    const data = branchPerformance(rows).sort((a, b) => b.revenue - a.revenue)
    const max = data[0]
    const min = data[data.length - 1]
    const maxDays = Math.max(...data.map((d) => d.days))
    const caveat = min.days < maxDays * SHORT_HISTORY ? ` · แต่${min.branch}มีข้อมูลเพียง ${formatNumber(min.days)} จาก ${formatNumber(maxDays)} วัน` : ''
    return {
      data,
      summary: `${max.branch}ขายได้ ${(max.revenue / min.revenue).toFixed(1)} เท่าของ${min.branch} (${formatBahtShort(max.revenue)} เทียบ ${formatBahtShort(min.revenue)})${caveat}`,
    }
  }, [rows])

  return (
    <Frame summary={summary}>
      <RankedBars
        data={data} nameKey="branch" valueKey="revenue" nameWidth={90} labelFormat={formatBahtShort}
        tip={<Tip title={(d) => d.branch} lines={(d) => [['ยอดขายรวม', formatBahtShort(d.revenue)], ['วันที่มีข้อมูล', `${formatNumber(d.days)} วัน`]]} />}
      />
    </Frame>
  )
}

/** กราฟ 3: รวมยอดเป็นรายสัปดาห์ (เฉพาะสัปดาห์ครบ 7 วัน) ให้เห็นแนวโน้มแทนความผันผวนรายวัน */
export function FixedChart3({ rows }) {
  const theme = useChartTheme()
  const { data, ticks, summary } = useMemo(() => {
    const data = weeklyRevenue(rows)
    // ขีดแกน X ทุก 3 เดือน ที่สัปดาห์แรกของเดือนนั้น
    const monthStarts = data.filter((w, i) => i === 0 || w.week.slice(0, 7) !== data[i - 1].week.slice(0, 7))
    const ticks = monthStarts.filter((_, i) => i % 3 === 0).map((w) => w.week)
    const first = mean(data.slice(0, TREND_WEEKS).map((w) => w.revenue))
    const last = mean(data.slice(-TREND_WEEKS).map((w) => w.revenue))
    const change = last / first - 1
    return {
      data,
      ticks,
      summary:
        `${TREND_WEEKS} สัปดาห์ล่าสุดขายเฉลี่ย ${formatBahtShort(last)}/สัปดาห์ ` +
        `${change >= 0 ? 'โตขึ้น' : 'ลดลง'} ${pct(Math.abs(change))} จาก ${TREND_WEEKS} สัปดาห์แรก (${formatBahtShort(first)}/สัปดาห์)`,
    }
  }, [rows])

  return (
    <Frame summary={summary}>
      <LineChart data={data} margin={{ top: 5, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="week" ticks={ticks} tickFormatter={formatMonthShort} tick={{ fontSize: 12, fill: theme.axisText }} tickLine={false} />
        <YAxis domain={[0, 'auto']} tickFormatter={formatBahtCompact} width={56} tick={{ fontSize: 12, fill: theme.axisText }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ stroke: theme.cursor }}
          content={<Tip title={(d) => `สัปดาห์เริ่ม ${formatDayShortYear(d.week)}`} lines={(d) => [['ยอดขาย', formatBahtShort(d.revenue)]]} />}
        />
        <Line dataKey="revenue" stroke={theme.series} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: theme.surface }} isAnimationActive={false} />
      </LineChart>
    </Frame>
  )
}

/** กราฟ 4: ยอดเฉลี่ยต่อวันรายเดือน เดือนที่ข้อมูลไม่ครบแสดงจางและบอกจำนวนวัน */
export function FixedChart4({ rows }) {
  const theme = useChartTheme()
  const { data, summary } = useMemo(() => {
    const data = monthlyRevenue(rows).map((m) => {
      const calendarDays = daysInMonth(m.month)
      return { ...m, calendarDays, partial: m.days < calendarDays }
    })
    const last = data[data.length - 1]
    const prev = data[data.length - 2]
    const change = last.perDay / prev.perDay - 1
    const coverage = last.partial ? `มีข้อมูลแค่ ${last.days}/${last.calendarDays} วัน` : 'ข้อมูลครบเดือน'
    const projection = last.partial ? ` · ถ้าครบเดือนคาดราว ${formatBahtShort(last.perDay * last.calendarDays)}` : ''
    return {
      data,
      summary:
        `${thaiMonth(last.month)} ${coverage} · เฉลี่ย ${formatBahtShort(last.perDay)}/วัน ` +
        `(${signedPct(change)} จาก${thaiMonth(prev.month)})${projection}`,
    }
  }, [rows])

  return (
    <Frame summary={summary}>
      <BarChart data={data} margin={{ top: 18, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="month" tickFormatter={thaiMonth} interval="preserveStartEnd" minTickGap={8} tick={{ fontSize: 11, fill: theme.axisText }} tickLine={false} />
        <YAxis tickFormatter={formatBahtCompact} width={56} tick={{ fontSize: 12, fill: theme.axisText }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: theme.barCursor }}
          content={
            <Tip
              title={(d) => thaiMonth(d.month)}
              lines={(d) => [
                ['เฉลี่ยต่อวัน', formatBahtShort(d.perDay)],
                ['ยอดรวม', formatBahtShort(d.revenue)],
                ['วันที่มีข้อมูล', `${d.days}/${d.calendarDays} วัน`],
              ]}
            />
          }
        />
        <Bar dataKey="perDay" fill={theme.series} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.month} fillOpacity={d.partial ? PARTIAL_OPACITY : 1} />)}
          <LabelList
            dataKey="perDay"
            content={({ x, y, width, index }) =>
              data[index].partial ? (
                <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill={theme.labelText}>
                  {data[index].days}/{data[index].calendarDays} วัน
                </text>
              ) : null
            }
          />
        </Bar>
      </BarChart>
    </Frame>
  )
}

/** กราฟ 5: เทียบผลงานสาขาด้วยยอดเฉลี่ยต่อวันที่เปิดขาย แทนยอดรวม */
export function FixedChart5({ rows }) {
  const { data, summary } = useMemo(() => {
    const data = branchPerformance(rows).sort((a, b) => b.perDay - a.perDay)
    const low = data[data.length - 1]
    const mid = median(data.map((d) => d.perDay))
    const maxDays = Math.max(...data.map((d) => d.days))
    const context =
      low.days < maxDays * SHORT_HISTORY
        ? `เปิดมาแค่ ${formatNumber(low.days)} วัน ควรดูช่วงเริ่มเปิดและทำเลก่อนสรุปเรื่องผู้จัดการ`
        : 'ควรดูทำเลและประเภทสาขาก่อนสรุปเรื่องผู้จัดการ'
    return {
      data,
      summary: `เทียบต่อวัน ${low.branch}ต่ำสุด ${formatBahtShort(low.perDay)}/วัน (${signedPct(low.perDay / mid - 1)} จากค่ากลาง) · ${context}`,
    }
  }, [rows])

  return (
    <Frame summary={summary}>
      <RankedBars
        data={data} nameKey="branch" valueKey="perDay" nameWidth={90} labelWidth={92} labelFormat={(v) => `${formatBahtShort(v)}/วัน`}
        tip={
          <Tip
            title={(d) => d.branch}
            lines={(d) => [
              ['เฉลี่ยต่อวัน', formatBahtShort(d.perDay)],
              ['ยอดขายรวม', formatBahtShort(d.revenue)],
              ['วันที่มีข้อมูล', `${formatNumber(d.days)} วัน`],
            ]}
          />
        }
      />
    </Frame>
  )
}

/** กราฟ 6: เทียบยอดต่อบิลแทนยอดรวม ใส่ลูกค้าทั่วไปและ "ไม่ระบุ" ด้วย ให้เห็นว่าข้อมูลเพศครอบคลุมยอดขายแค่ไหน */
export function FixedChart6({ rows, members }) {
  const { data, summary } = useMemo(() => {
    const data = revenueByGender(rows, members)
    const women = data.find((d) => d.group === 'หญิง')
    const men = data.find((d) => d.group === 'ชาย')
    if (!women || !men) return { data, summary: 'ไม่มีข้อมูลเพศของสมาชิก (public/members.csv)' }
    const total = data.reduce((s, d) => s + d.revenue, 0)
    const known = (women.revenue + men.revenue) / total
    const gap = women.perBill / men.perBill - 1
    const sameMedian = women.medianBill === men.medianBill
    return {
      data,
      summary:
        `ต่อบิลแทบเท่ากัน: หญิง ${formatBaht(women.perBill)} ชาย ${formatBaht(men.perBill)} (${signedPct(gap)}` +
        `${sameMedian ? ` · ค่ากลาง ${formatBahtShort(women.medianBill)} ทั้งคู่` : ''}) · ` +
        `ยอดรวมผู้หญิงสูงกว่าเพราะมีสมาชิกมากกว่า ${formatNumber(women.members)} เทียบ ${formatNumber(men.members)} คน · ` +
        `รู้เพศแค่ ${pct(known)} ของยอดขาย`,
    }
  }, [rows, members])

  return (
    <Frame summary={summary}>
      <RankedBars
        data={data} nameKey="group" valueKey="perBill" nameWidth={96} labelWidth={84} labelFormat={(v) => `${formatBahtShort(v)}/บิล`}
        tip={
          <Tip
            title={(d) => (d.group === WALK_IN ? `${WALK_IN} (ไม่มีข้อมูลเพศ)` : d.group)}
            lines={(d) => [
              ['เฉลี่ยต่อบิล', formatBaht(d.perBill)],
              ['ค่ากลางต่อบิล', formatBahtShort(d.medianBill)],
              ['จำนวนบิล', formatNumber(d.bills)],
              ['ยอดขายรวม', formatBahtShort(d.revenue)],
              ...(d.members === null ? [] : [['สมาชิก', `${formatNumber(d.members)} คน`], ['ยอดต่อสมาชิก', formatBahtShort(d.perMember)]]),
            ]}
          />
        }
      />
    </Frame>
  )
}
