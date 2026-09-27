import { memo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsMobile } from '../hooks/useMediaQuery'
import { CONTEXT_OPACITY, useChartTheme } from '../lib/chartTheme'
import {
  formatBaht,
  formatBahtCompact,
  formatBahtShort,
  formatDayLong,
  formatDayShort,
  formatDayShortYear,
} from '../lib/format'
import ChartCard from './ChartCard'
import ChartTooltip from './ChartTooltip'

const SERIES = [
  { key: 'avg', name: 'ค่าเฉลี่ย 7 วัน', opacity: 1, width: 2 },
  { key: 'sales', name: 'ยอดรายวัน', opacity: CONTEXT_OPACITY, width: 1.5 },
]

function Legend({ color }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600 dark:text-stone-400">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: color, opacity: s.opacity }} />
          {s.name}
        </li>
      ))}
    </ul>
  )
}

// data: ผลจาก movingAverage(dailySales(rows)) → [{ date, sales, avg }]
function DailySalesChart({ data }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const axisText = { fill: theme.axisText, fontSize: 12 }
  const multiYear = data.length > 0 && data[0].date.slice(0, 4) !== data[data.length - 1].date.slice(0, 4)
  return (
    <ChartCard
      title="ยอดขายรายวัน"
      subtitle="รวมทุกสาขา (บาท) ตามวันที่เวลาไทย"
      table={{
        columns: ['วันที่', 'ยอดขาย', 'ค่าเฉลี่ย 7 วัน'],
        getRows: () =>
          data.map((d) => [formatDayLong(d.date), formatBaht(d.sales), d.avg === null ? '–' : formatBaht(d.avg)]),
      }}
    >
      <Legend color={theme.series} />
      <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
        <LineChart data={data} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={multiYear ? formatDayShortYear : formatDayShort}
            tick={axisText}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            minTickGap={isMobile ? 40 : 24}
          />
          <YAxis
            tickFormatter={isMobile ? formatBahtCompact : formatBahtShort}
            tick={axisText}
            tickLine={false}
            axisLine={false}
            width={isMobile ? 48 : 80}
          />
          <Tooltip
            content={<ChartTooltip formatLabel={formatDayLong} series={SERIES} />}
            cursor={{ stroke: theme.cursor, strokeWidth: 1 }}
          />
          {/* วาดเส้นรายวันก่อน เพื่อให้เส้นค่าเฉลี่ยอยู่ด้านบน */}
          {[...SERIES].reverse().map((s) => (
            <Line
              key={s.key}
              type="linear"
              dataKey={s.key}
              name={s.name}
              stroke={theme.series}
              strokeOpacity={s.opacity}
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={
                s.key === 'avg'
                  ? { r: 5, fill: theme.series, stroke: theme.surface, strokeWidth: 2 }
                  : { r: 3, fill: theme.series, fillOpacity: 0.5, stroke: 'none' }
              }
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// memo: ไม่วาดกราฟใหม่ถ้า data ยังเป็นชุดเดิม (เช่น ระหว่างรอคำนวณตัวกรองใหม่) — เปลี่ยนธีมยังวาดใหม่ตาม
export default memo(DailySalesChart)
