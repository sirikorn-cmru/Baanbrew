import { memo, useState } from 'react'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useChartTheme } from '../lib/chartTheme'
import { formatBaht, formatNumber } from '../lib/format'
import ChartCard from './ChartCard'

const oneDecimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`
const hourRange = (h) => `${hourLabel(h)}–${String(h).padStart(2, '0')}:59 น.`
const DAY_SHORT = { จันทร์: 'จ.', อังคาร: 'อ.', พุธ: 'พ.', พฤหัสบดี: 'พฤ.', ศุกร์: 'ศ.', เสาร์: 'ส.', อาทิตย์: 'อา.' }

// สีเดียว ไล่ความเข้มตามจำนวนบิล (ช่องว่าง = ไม่มีบิล) — ไม่พึ่งการแยกสีหลายเฉด อ่านได้ทั้งสองธีม
const MIN_OPACITY = 0.08
const opacityOf = (value, max) => (value > 0 && max > 0 ? MIN_OPACITY + (1 - MIN_OPACITY) * (value / max) : 0)

function ScaleLegend({ color, max }) {
  return (
    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
      <span>น้อย</span>
      <span
        className="h-2.5 w-28 rounded-sm ring-1 ring-stone-200 dark:ring-stone-700"
        style={{ background: `linear-gradient(to right, transparent, ${color})` }}
        aria-hidden="true"
      />
      <span>มาก ({oneDecimal.format(max)} บิล/ชม.)</span>
    </div>
  )
}

// data: ผลจาก weekdayHourHeatmap(rows, { from, to })
function WeekdayHourHeatmap({ data }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const [hover, setHover] = useState(null) // { day, hour, bills, sales }
  const { hours, days, max, peak, quiet } = data
  const cols = `${isMobile ? '3.25rem' : '4.5rem'} repeat(${hours.length}, minmax(0, 1fr))`
  const shown = hover ?? peak

  return (
    <ChartCard
      title={`ขายดีที่สุดช่วง ${peak.day} ${hourRange(peak.hour)}`}
      subtitle={`จำนวนบิลเฉลี่ยต่อวัน แยกวันในสัปดาห์ × ชั่วโมง (เวลาไทย) · เงียบที่สุด ${quiet.day} ${hourLabel(quiet.hour)}`}
      table={{
        columns: ['วัน', ...hours.map(hourLabel)],
        getRows: () => days.map((d) => [d.label, ...d.cells.map((c) => oneDecimal.format(c.bills))]),
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm tabular-nums text-stone-600 dark:text-stone-300" aria-live="polite">
          <span className="text-stone-500 dark:text-stone-400">{hover ? '' : 'สูงสุด · '}{shown.day} {hourRange(shown.hour)}</span>{' '}
          <span className="font-semibold text-stone-900 dark:text-stone-50">{oneDecimal.format(shown.bills)} บิล</span>
          <span className="text-stone-500 dark:text-stone-400"> · {formatBaht(shown.sales)} ต่อวัน</span>
        </p>
        <ScaleLegend color={theme.series} max={max} />
      </div>

      <div role="img" aria-label={`ตารางความหนาแน่น ขายดีที่สุด ${peak.day} ${hourRange(peak.hour)}`} onMouseLeave={() => setHover(null)}>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: cols }}>
          <span />
          {hours.map((h) => (
            <span key={h} className="text-center text-[10px] tabular-nums text-stone-500 sm:text-xs dark:text-stone-400">
              {isMobile ? (h % 2 === 1 ? '' : h) : hourLabel(h).slice(0, 2)}
            </span>
          ))}
          {days.map((d) => (
            <DayRow key={d.dow} day={d} max={max} color={theme.series} isMobile={isMobile} onHover={setHover} />
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
        หารด้วยจำนวนวันนั้นในช่วงที่เลือก ({days.map((d) => `${DAY_SHORT[d.label]} ${formatNumber(d.count)}`).join(' · ')} วัน) ·
        แตะหรือชี้ที่ช่องเพื่อดูตัวเลข
      </p>
    </ChartCard>
  )
}

function DayRow({ day, max, color, isMobile, onHover }) {
  return (
    <>
      <span className="self-center pr-1 text-xs text-stone-600 sm:text-sm dark:text-stone-300">{day.label}</span>
      {day.cells.map((c) => {
        const opacity = opacityOf(c.bills, max)
        const info = { day: day.label, hour: c.hour, bills: c.bills, sales: c.sales }
        return (
          <button
            key={c.hour}
            type="button"
            className="relative h-7 rounded-[3px] ring-1 ring-stone-100 ring-inset focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-600 sm:h-9 dark:ring-stone-800"
            aria-label={`${day.label} ${hourRange(c.hour)} ${oneDecimal.format(c.bills)} บิลต่อวัน`}
            onMouseEnter={() => onHover(info)}
            onFocus={() => onHover(info)}
            onClick={() => onHover(info)}
          >
            <span className="absolute inset-0 rounded-[3px]" style={{ background: color, opacity }} aria-hidden="true" />
            {!isMobile && (
              <span
                className={`relative text-[11px] tabular-nums ${opacity > 0.55 ? 'text-white' : 'text-stone-600 dark:text-stone-300'}`}
                aria-hidden="true"
              >
                {c.bills >= 10 ? Math.round(c.bills) : oneDecimal.format(c.bills)}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}

// memo: ไม่วาดใหม่ถ้า data ยังเป็นชุดเดิม (เช่น ระหว่างรอคำนวณตัวกรองใหม่)
export default memo(WeekdayHourHeatmap)
