import { memo } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useChartTheme } from '../lib/chartTheme'
import { formatBaht, formatBahtShort, formatNumber } from '../lib/format'
import ChartCard from './ChartCard'
import ChartTooltip from './ChartTooltip'

const BIN_SIZE = 20
const pctFmt = new Intl.NumberFormat('th-TH', { style: 'percent', maximumFractionDigits: 0 })
const pctFmt1 = new Intl.NumberFormat('th-TH', { style: 'percent', maximumFractionDigits: 1 })
const countCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }) // 10000 → "10K"

// ช่วงของช่อง เช่น "฿80–99" หรือ "฿400 ขึ้นไป"
const binLabel = (b) => (b.to === null ? `${formatBahtShort(b.from)} ขึ้นไป` : `${formatBahtShort(b.from)}–${formatBahtShort(b.to)}`)

// เส้นอ้างอิง: ค่ากลางเส้นทึบ ค่าเฉลี่ยเส้นประ (ใช้สีเดียวกัน แยกด้วยลายเส้น)
const MARKERS = [
  { key: 'median', name: 'ค่ากลาง', dash: undefined },
  { key: 'mean', name: 'ค่าเฉลี่ย', dash: '5 4' },
]

function Legend({ color, dist }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600 dark:text-stone-400">
      {MARKERS.map((m) => (
        <li key={m.key} className="flex items-center gap-2">
          <svg width="16" height="2" aria-hidden="true">
            <line x1="0" y1="1" x2="16" y2="1" stroke={color} strokeWidth="2" strokeDasharray={m.dash ? '4 3' : undefined} />
          </svg>
          {m.name} <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-50">{formatBaht(dist[m.key])}</span>
        </li>
      ))}
    </ul>
  )
}

// data: ผลจาก billDistribution(rows, BIN_SIZE)
function BillDistributionChart({ data: dist }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const axisText = { fill: theme.axisText, fontSize: 12 }
  const bins = dist.bins.map((b) => ({ ...b, x: b.from + BIN_SIZE / 2, label: binLabel(b) }))
  const xMax = bins.length * BIN_SIZE
  const labelOf = new Map(bins.map((b) => [b.x, b.label]))

  return (
    <ChartCard
      title="ยอดต่อบิล"
      subtitle={`${pctFmt.format(dist.belowMean)} ของบิลจ่ายน้อยกว่าค่าเฉลี่ย · ค่ากลางบอกยอดของลูกค้าทั่วไปได้ดีกว่า`}
      table={{
        columns: ['ยอดต่อบิล', 'จำนวนบิล', 'สัดส่วน'],
        getRows: () => bins.map((b) => [b.label, formatNumber(b.bills), pctFmt1.format(b.share)]),
      }}
    >
      <Legend color={theme.labelText} dist={dist} />
      <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
        <BarChart data={bins} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 0, left: 0 }} barCategoryGap={1}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, xMax]}
            ticks={Array.from({ length: Math.floor(xMax / 100) + 1 }, (_, i) => i * 100)}
            tickFormatter={formatBahtShort}
            tick={axisText}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
          />
          <YAxis
            tickFormatter={isMobile ? countCompact.format : formatNumber}
            tick={axisText}
            tickLine={false}
            axisLine={false}
            width={isMobile ? 40 : 56}
          />
          <Tooltip
            content={
              <ChartTooltip
                formatLabel={(x) => labelOf.get(x)}
                formatValue={(n) => `${formatNumber(n)} บิล`}
              />
            }
            cursor={{ fill: theme.barCursor }}
          />
          <Bar dataKey="bills" name="จำนวนบิล" fill={theme.series} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          {MARKERS.map((m) => (
            <ReferenceLine
              key={m.key}
              x={dist[m.key]}
              stroke={theme.labelText}
              strokeWidth={2}
              strokeDasharray={m.dash}
              ifOverflow="extendDomain"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
        {formatNumber(dist.count)} บิล · ช่องละ {formatBahtShort(BIN_SIZE)} · 90% ของบิลไม่เกิน {formatBahtShort(dist.p90)}
        {bins.at(-1)?.to === null && ` · ช่องสุดท้ายรวมบิลตั้งแต่ ${formatBahtShort(dist.tailFrom)} ขึ้นไป (ราว 1% ที่ใหญ่ที่สุด)`}
      </p>
    </ChartCard>
  )
}

// memo: ไม่วาดกราฟใหม่ถ้า data ยังเป็นชุดเดิม (เช่น ระหว่างรอคำนวณตัวกรองใหม่)
export default memo(BillDistributionChart)
