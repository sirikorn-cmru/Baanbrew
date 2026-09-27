import { memo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useChartTheme } from '../lib/chartTheme'
import {
  formatBaht,
  formatBahtCompact,
  formatBahtShort,
  formatDayLong,
  formatDayShort,
  formatDayShortYear,
  formatMonthLong,
  formatMonthShort,
} from '../lib/format'
import ChartCard from './ChartCard'

const GRANULARITIES = [
  { value: 'day', label: 'วัน' },
  { value: 'week', label: 'สัปดาห์' },
  { value: 'month', label: 'เดือน' },
]
const NOUN = { day: 'รายวัน', week: 'รายสัปดาห์', month: 'รายเดือน' }
const MAX_DOTS = 40 // จุดมากกว่านี้จะรกเกินไป — แสดงเฉพาะเส้น

// ป้ายของแต่ละช่วงเวลา
function periodLabel(p, granularity, long) {
  if (granularity === 'month') return long ? formatMonthLong(p.start) : formatMonthShort(p.start)
  if (granularity === 'week') {
    return long ? `${formatDayShort(p.start)} – ${formatDayLong(p.end)}` : formatDayShort(p.start)
  }
  return long ? formatDayLong(p.start) : formatDayShort(p.start)
}

const isPartial = (p) => p.coveredDays < p.days

function GranularityToggle({ value, auto, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="หน่วยเวลา"
      className="inline-flex rounded-full bg-stone-100 p-0.5 text-xs sm:text-sm dark:bg-stone-800"
    >
      {GRANULARITIES.map((g) => (
        <button
          key={g.value}
          type="button"
          role="radio"
          aria-checked={value === g.value}
          title={g.value === auto ? 'ค่าที่เหมาะกับช่วงวันที่นี้' : undefined}
          onClick={() => onChange(g.value === auto ? null : g.value)}
          className={`rounded-full px-3 py-1 transition-colors ${
            value === g.value
              ? 'bg-white font-medium text-stone-900 shadow-sm dark:bg-stone-600 dark:text-stone-50'
              : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
          }`}
        >
          {g.label}
        </button>
      ))}
    </div>
  )
}

function TrendTooltip({ active, payload, granularity, branches, colorOf }) {
  if (!active || !payload?.length) return null
  const period = payload[0].payload
  const items = branches
    .map((b) => ({ branch: b, value: period[b] }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
  return (
    <div className="min-w-48 rounded-lg bg-white px-3 py-2 text-sm shadow-md ring-1 ring-stone-200 dark:bg-stone-800 dark:shadow-black/40 dark:ring-stone-700">
      <p className="text-stone-500 dark:text-stone-400">{periodLabel(period, granularity, true)}</p>
      {isPartial(period) && (
        <p className="text-xs text-stone-400 dark:text-stone-500">
          มีข้อมูล {period.coveredDays} จาก {period.days} วัน
        </p>
      )}
      <ul className="mt-1 space-y-0.5">
        {items.map(({ branch, value }) => (
          <li key={branch} className="flex items-center gap-2 tabular-nums">
            <span className="size-2 shrink-0 rounded-full" style={{ background: colorOf(branch) }} />
            <span className="text-stone-600 dark:text-stone-300">{branch}</span>
            <span className="ml-auto pl-3 font-medium text-stone-900 dark:text-stone-50">
              {value === null ? <span className="font-normal text-stone-400">ยังไม่เปิด</span> : formatBaht(value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// data: ผลจาก branchSalesOverTime · branches: สาขาที่แสดง · allBranches: รายชื่อทั้งหมด (ใช้กำหนดสีให้คงที่)
function BranchTrendChart({ data, branches, allBranches, granularity, autoGranularity, onGranularityChange }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const [highlight, setHighlight] = useState(null) // สาขาที่ชี้ใน legend → เน้นเส้นนั้น
  const colorOf = (b) => theme.categorical(allBranches.indexOf(b))
  const axisText = { fill: theme.axisText, fontSize: isMobile ? 11 : 12 }
  const showDots = data.length <= MAX_DOTS
  const hasPartial = showDots && data.some(isPartial)
  const multiYear = data.length > 0 && data[0].start.slice(0, 4) !== data[data.length - 1].end.slice(0, 4)

  const tickFormatter = (start) => {
    if (granularity === 'month') return formatMonthShort(start)
    return multiYear ? formatDayShortYear(start) : formatDayShort(start)
  }

  // จุดทึบ = ช่วงข้อมูลครบ, จุดกลวง = ช่วงที่ถูกตัดโดยตัวกรองวันที่ (ยอดต่ำกว่าปกติเพราะนับไม่ครบวัน)
  const renderDot = (color) =>
    function Dot({ cx, cy, payload, index }) {
      if (cx == null || cy == null || payload == null) return null
      const partial = isPartial(payload)
      return (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r={4}
          fill={partial ? theme.surface : color}
          stroke={partial ? color : theme.surface}
          strokeWidth={2}
        />
      )
    }

  return (
    <ChartCard
      title="ยอดขายรายสาขาตามเวลา"
      subtitle={`ยอดขาย${NOUN[granularity]} (บาท)`}
      actions={<GranularityToggle value={granularity} auto={autoGranularity} onChange={onGranularityChange} />}
      table={{
        columns: ['ช่วงเวลา', ...branches],
        getRows: () =>
          data.map((p) => [
            `${periodLabel(p, granularity, true)}${isPartial(p) ? ` (${p.coveredDays}/${p.days} วัน)` : ''}`,
            ...branches.map((b) => (p[b] === null ? '–' : formatBaht(p[b]))),
          ]),
      }}
    >
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600 dark:text-stone-400">
        {branches.map((b) => (
          <li
            key={b}
            tabIndex={0}
            onMouseEnter={() => setHighlight(b)}
            onMouseLeave={() => setHighlight(null)}
            onFocus={() => setHighlight(b)}
            onBlur={() => setHighlight(null)}
            className={`flex cursor-default items-center gap-2 rounded outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-amber-600 ${
              highlight && highlight !== b ? 'opacity-40' : ''
            }`}
          >
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: colorOf(b) }} />
            {b}
          </li>
        ))}
      </ul>

      <ResponsiveContainer width="100%" height={isMobile ? 260 : 320}>
        <LineChart data={data} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="start"
            tickFormatter={tickFormatter}
            tick={axisText}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            minTickGap={isMobile ? 32 : 20}
          />
          <YAxis
            tickFormatter={isMobile ? formatBahtCompact : formatBahtShort}
            tick={axisText}
            tickLine={false}
            axisLine={false}
            width={isMobile ? 48 : 80}
          />
          <Tooltip
            content={<TrendTooltip granularity={granularity} branches={branches} colorOf={colorOf} />}
            cursor={{ stroke: theme.cursor, strokeWidth: 1 }}
          />
          {branches.map((b) => {
            const color = colorOf(b)
            const dim = highlight && highlight !== b
            return (
              <Line
                key={b}
                type="linear"
                dataKey={b}
                name={b}
                stroke={color}
                strokeOpacity={dim ? 0.15 : 1}
                strokeWidth={highlight === b ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={showDots && !dim ? renderDot(color) : false}
                activeDot={dim ? false : { r: 5, fill: color, stroke: theme.surface, strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>

      {hasPartial && (
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          จุดกลวง = ช่วงที่มีข้อมูลไม่ครบ (ตัดโดยช่วงวันที่ที่เลือก) ยอดจึงต่ำกว่าช่วงเต็ม
        </p>
      )}
    </ChartCard>
  )
}

export default memo(BranchTrendChart)
