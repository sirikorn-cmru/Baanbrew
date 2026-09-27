import { memo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsMobile } from '../hooks/useMediaQuery'
import { CONTEXT_OPACITY, useChartTheme } from '../lib/chartTheme'
import { formatBaht, formatMonthLong, formatMonthShort, formatNumber } from '../lib/format'
import { LAPSED_AFTER_DAYS } from '../lib/metrics'
import ChartCard from './ChartCard'
import ChartTooltip from './ChartTooltip'
import KpiCard from './KpiCard'

const pct = new Intl.NumberFormat('th-TH', { style: 'percent', maximumFractionDigits: 0 })
const pct1 = new Intl.NumberFormat('th-TH', { style: 'percent', maximumFractionDigits: 1 })
const people = (n) => `${formatNumber(n)} คน`

// สมาชิกแยกตามวันที่ซื้อล่าสุด — แท่งที่เกิน 90 วัน (หายไป) สีทึบ ที่เหลือสีจาง ให้เห็นกลุ่มที่ต้องตามก่อน
function RecencyChart({ data }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const fontSize = isMobile ? 11 : 12
  const lapsedShare = data.buyers ? data.lapsed / data.buyers : 0
  const rows = data.recency.map((b) => ({ ...b, lapsed: b.maxDays > LAPSED_AFTER_DAYS }))
  return (
    <ChartCard
      title={`สมาชิก ${pct.format(lapsedShare)} ไม่ได้ซื้อเกิน ${LAPSED_AFTER_DAYS} วัน`}
      subtitle={`สมาชิกที่เคยซื้อ ${people(data.buyers)} แยกตามวันที่ซื้อล่าสุด นับถึงวันสุดท้ายของช่วงที่เลือก`}
      table={{
        columns: ['ซื้อล่าสุด', 'สมาชิก', 'สัดส่วน'],
        getRows: () => rows.map((b) => [b.label, formatNumber(b.members), pct1.format(b.share)]),
      }}
    >
      <ResponsiveContainer width="100%" height={rows.length * 44 + 40}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: isMobile ? 64 : 88, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={theme.grid} horizontal={false} />
          <XAxis type="number" tickFormatter={formatNumber} tick={{ fill: theme.axisText, fontSize }} tickLine={false} axisLine={false} tickCount={isMobile ? 3 : 5} />
          <YAxis type="category" dataKey="label" tick={{ fill: theme.labelText, fontSize }} tickLine={false} axisLine={{ stroke: theme.grid }} width={isMobile ? 84 : 100} />
          <Tooltip content={<ChartTooltip formatValue={people} />} cursor={{ fill: theme.barCursor }} />
          <Bar dataKey="members" name="สมาชิก" barSize={22} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {rows.map((b) => (
              <Cell key={b.key} fill={theme.series} fillOpacity={b.lapsed ? 1 : 0.45} />
            ))}
            <LabelList
              dataKey="members"
              position="right"
              formatter={(n) => `${formatNumber(n)} (${pct.format(n / (data.buyers || 1))})`}
              style={{ fill: theme.labelText, fontSize }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
        สีทึบ = ไม่ได้ซื้อเกิน {LAPSED_AFTER_DAYS} วัน ({people(data.lapsed)}) · ยังไม่นับสมาชิกที่ไม่เคยซื้อ {people(data.neverBought)}
      </p>
    </ChartCard>
  )
}

// สมัครสมาชิกรายเดือน — เดือนที่ถูกตัดโดยช่วงวันที่ (ข้อมูลไม่ครบเดือน) สีจาง
function SignupChart({ data }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const axisText = { fill: theme.axisText, fontSize: 12 }
  const rows = data.signups.map((s) => ({ ...s, partial: s.coveredDays < s.days }))
  const full = rows.filter((s) => !s.partial)
  const perMonth = full.length ? full.reduce((sum, s) => sum + s.members, 0) / full.length : 0
  return (
    <ChartCard
      title={`สมัครสมาชิกเฉลี่ยเดือนละ ${formatNumber(Math.round(perMonth))} คน`}
      subtitle="จำนวนสมาชิกใหม่รายเดือน ตามสาขาประจำ (ไม่นับเดือนที่ข้อมูลไม่ครบในค่าเฉลี่ย)"
      table={{
        columns: ['เดือน', 'สมัครใหม่'],
        getRows: () =>
          rows.map((s) => [
            `${formatMonthLong(s.start)}${s.partial ? ` (${s.coveredDays}/${s.days} วัน)` : ''}`,
            formatNumber(s.members),
          ]),
      }}
    >
      <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
        <BarChart data={rows} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis dataKey="start" tickFormatter={formatMonthShort} tick={axisText} tickLine={false} axisLine={{ stroke: theme.grid }} minTickGap={isMobile ? 16 : 8} />
          <YAxis tickFormatter={formatNumber} tick={axisText} tickLine={false} axisLine={false} width={isMobile ? 36 : 48} />
          <Tooltip
            content={<ChartTooltip formatLabel={formatMonthLong} formatValue={people} />}
            cursor={{ fill: theme.barCursor }}
          />
          <Bar dataKey="members" name="สมัครใหม่" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {rows.map((s) => (
              <Cell key={s.start} fill={theme.series} fillOpacity={s.partial ? CONTEXT_OPACITY : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {rows.some((s) => s.partial) && (
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">แท่งจาง = เดือนที่ข้อมูลไม่ครบ (ตัดโดยช่วงวันที่ที่เลือก)</p>
      )}
    </ChartCard>
  )
}

// data: ผลจาก memberInsights(...)
function MemberSection({ data }) {
  const { member, walkIn } = data
  return (
    <section className="space-y-4 sm:space-y-6" aria-labelledby="members-heading">
      <h2 id="members-heading" className="pt-2 text-lg font-semibold text-stone-900 dark:text-stone-50">
        สมาชิก
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="บิลของสมาชิก" value={pct1.format(member.share)} hint={`${formatNumber(member.bills)} บิล · ที่เหลือเป็นลูกค้าทั่วไป`} />
        <KpiCard
          label="ค่ากลางต่อบิล สมาชิก"
          value={formatBaht(member.median)}
          hint={`ลูกค้าทั่วไป ${formatBaht(walkIn.median)} · เฉลี่ย ${formatBaht(member.mean)} / ${formatBaht(walkIn.mean)}`}
        />
        <KpiCard label={`ไม่ได้ซื้อเกิน ${LAPSED_AFTER_DAYS} วัน`} value={people(data.lapsed)} hint={`จากสมาชิกที่เคยซื้อ ${people(data.buyers)}`} />
        <KpiCard
          label="สมัครแล้วยังไม่เคยซื้อ"
          value={people(data.neverBought)}
          hint={`${formatNumber(data.neverBoughtRecent)} คนสมัครใน 60 วันล่าสุด`}
        />
      </div>
      <RecencyChart data={data} />
      <SignupChart data={data} />
    </section>
  )
}

// memo: ไม่วาดใหม่ถ้า data ยังเป็นชุดเดิม (เช่น ระหว่างรอคำนวณตัวกรองใหม่)
export default memo(MemberSection)
