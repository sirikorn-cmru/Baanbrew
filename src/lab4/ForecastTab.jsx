// Lab 4.4–4.5 · พยากรณ์และวันผิดปกติ
// คำนวณในเบราว์เซอร์จาก analytics/daily (ยอดรายวันแยกสาขา ~2,500 แถว) จึงเปลี่ยนสาขาได้ทันทีโดยไม่อ่าน Firestore เพิ่ม
import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from '../components/ChartCard'
import KpiCard from '../components/KpiCard'
import { useIsMobile } from '../hooks/useMediaQuery'
import { addDays } from '../lab3/time'
import { useChartTheme } from '../lib/chartTheme'
import { scoreAnomalies } from '../lib/analytics/anomaly'
import { toSeries } from '../lib/analytics/daily'
import { backtest, mape, seasonalForecast } from '../lib/analytics/forecast'
import { formatBaht, formatBahtCompact, formatBahtShort, formatDayLong, formatDayShort } from '../lib/format'
import { AnalyticsShell, Insight, Notice, Pending } from './ui'
import { useAnalytics } from './useAnalytics'

const BRANCHES = ['สยาม', 'สีลม', 'อารีย์', 'บางนา', 'มหาวิทยาลัย']
const HORIZON = 28
const ZOOM_DAYS = 28
const LOSS_COLOR = '#dc2626' // red-600: ต่ำกว่าปกติ
const GAIN_COLOR = '#ea580c' // orange-600: สูงกว่าปกติ

const tryRun = (f) => {
  try {
    return { value: f() }
  } catch (e) {
    return { error: e.message }
  }
}

// รวมเป็นรายสัปดาห์ (7 วันติดกันนับจากวันแรกของช่วงทดสอบ) แล้ววัด MAPE รายสัปดาห์
function weeklyMape(test) {
  const weeks = []
  for (let i = 0; i + 7 <= test.length; i += 7) {
    const w = test.slice(i, i + 7)
    weeks.push({ actual: w.reduce((s, t) => s + t.actual, 0), forecast: w.reduce((s, t) => s + t.forecast, 0) })
  }
  return mape(weeks.map((w) => w.actual), weeks.map((w) => w.forecast))
}

function SeriesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const rows = [
    p.actual !== undefined && ['ยอดจริง', formatBaht(p.actual)],
    p.forecast !== undefined && !p.joint && ['คาดการณ์', formatBaht(p.forecast)],
    p.band && ['ช่วงคาดการณ์', `${formatBaht(p.band[0])} – ${formatBaht(p.band[1])}`],
    p.expected !== undefined && ['ค่าปกติ', formatBaht(p.expected)],
  ].filter(Boolean)
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-md ring-1 ring-stone-200 dark:bg-stone-800 dark:shadow-black/40 dark:ring-stone-700">
      <p className="text-stone-500 dark:text-stone-400">{formatDayLong(label)}</p>
      {rows.map(([k, v]) => (
        <p key={k} className="mt-0.5 flex gap-4 tabular-nums text-stone-900 dark:text-stone-50">
          <span className="text-stone-500 dark:text-stone-400">{k}</span>
          <span className="ml-auto font-semibold">{v}</span>
        </p>
      ))}
    </div>
  )
}

function Legend({ items }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600 dark:text-stone-400">
      {items.map(({ label, color, dashed, area, opacity = 1 }) => (
        <li key={label} className="flex items-center gap-2">
          {area ? (
            <span className="h-2.5 w-4 rounded-sm" style={{ background: color, opacity }} />
          ) : (
            <span className="w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid', opacity }} />
          )}
          {label}
        </li>
      ))}
    </ul>
  )
}

// ---------------- 4.4 · พยากรณ์ ----------------
function ForecastCard({ daily }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const [branch, setBranch] = useState(null)
  const result = useMemo(
    () =>
      tryRun(() => {
        const series = toSeries(daily, branch)
        const bt = backtest(series, HORIZON)
        const fc = seasonalForecast(series, HORIZON)
        const recent = series.slice(-56)
        const last = recent[recent.length - 1]
        const chart = [
          ...recent.map((s) => ({ date: s.date, actual: s.revenue })),
          ...fc.map((f) => ({
            date: f.date,
            forecast: f.forecast,
            band: [Math.max(0, f.forecast * (1 - bt.band)), f.forecast * (1 + bt.band)],
          })),
        ]
        // ต่อเส้นคาดการณ์จากจุดสุดท้ายของยอดจริง ให้เส้นไม่ขาด
        chart[recent.length - 1] = { ...chart[recent.length - 1], forecast: last.revenue, joint: true }
        return { bt, chart, next7: fc.slice(0, 7).reduce((s, f) => s + f.forecast, 0), lastDate: last.date, weekly: weeklyMape(bt.test) }
      }),
    [daily, branch],
  )
  const r = result.value
  const name = branch ?? 'ภาพรวม'
  const axisText = { fill: theme.axisText, fontSize: 12 }

  return (
    <ChartCard
      title="พยากรณ์ยอดขาย 28 วัน"
      subtitle="ยอดวันข้างหน้า ≈ ค่าเฉลี่ยวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ล่าสุด · แถบ = ช่วงที่คาดว่าครอบคลุมราว 80% ของวัน"
      actions={
        <div className="flex flex-wrap gap-1" role="group" aria-label="เลือกสาขา">
          {[null, ...BRANCHES].map((b) => (
            <button
              key={b ?? 'all'}
              type="button"
              onClick={() => setBranch(b)}
              aria-pressed={branch === b}
              className={`rounded-lg px-2.5 py-1 text-sm ${
                branch === b
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100 dark:text-stone-400 dark:ring-stone-700 dark:hover:bg-stone-800'
              }`}
            >
              {b ?? 'รวม'}
            </button>
          ))}
        </div>
      }
      table={
        r && {
          columns: ['วันที่', 'ยอดจริง (ย้อนทดสอบ)', 'คาดแบบวันในสัปดาห์', 'คาดแบบเส้นตรง'],
          getRows: () => r.bt.test.map((t) => [formatDayLong(t.date), formatBaht(t.actual), formatBaht(t.forecast), formatBaht(t.flat)]),
        }
      }
    >
      {result.error ? (
        <Pending>{result.error}</Pending>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <KpiCard label="คาดการณ์ 7 วันข้างหน้า" value={formatBaht(r.next7)} hint={name} />
            <KpiCard label="ย้อนทดสอบ 28 วัน: พลาดเฉลี่ยต่อวัน" value={`${r.bt.mapeSeasonal.toFixed(1)}%`} hint="วิธีดูวันในสัปดาห์" />
            <KpiCard label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง" value={`${r.bt.mapeFlat.toFixed(1)}%`} hint="ตัวเปรียบเทียบ" />
            <KpiCard label="รวมเป็นรายสัปดาห์ พลาดเฉลี่ย" value={`${r.weekly.toFixed(1)}%`} hint="Lab 4.4B · 4 สัปดาห์ที่ซ่อนไว้" />
          </div>
          <div className="mt-4">
            <Legend
              items={[
                { label: 'ยอดจริง', color: theme.labelText },
                { label: 'คาดการณ์', color: theme.series, dashed: true },
                { label: 'ช่วงคาดการณ์ ~80%', color: theme.series, area: true, opacity: 0.2 },
              ]}
            />
            <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
              <ComposedChart data={r.chart} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDayShort} minTickGap={isMobile ? 40 : 28} tick={axisText} tickLine={false} axisLine={{ stroke: theme.grid }} />
                <YAxis tickFormatter={isMobile ? formatBahtCompact : formatBahtShort} width={isMobile ? 48 : 72} domain={[0, 'auto']} tick={axisText} tickLine={false} axisLine={false} />
                <Tooltip content={<SeriesTooltip />} cursor={{ stroke: theme.cursor, strokeWidth: 1 }} />
                <ReferenceLine x={r.lastDate} stroke={theme.cursor} strokeDasharray="3 3" label={{ value: 'ข้อมูลถึง', position: 'insideTopLeft', fontSize: 11, fill: theme.axisText }} />
                <Area dataKey="band" stroke="none" fill={theme.series} fillOpacity={0.2} isAnimationActive={false} />
                <Line dataKey="actual" stroke={theme.labelText} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="forecast" stroke={theme.series} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Insight>
            {r.bt.mapeFlat > r.bt.mapeSeasonal * 1.5
              ? `${name}: การดูวันในสัปดาห์ลดความคลาดเคลื่อนจาก ${r.bt.mapeFlat.toFixed(0)}% เหลือ ${r.bt.mapeSeasonal.toFixed(0)}% เพราะยอดวันธรรมดากับเสาร์-อาทิตย์ต่างกันมาก`
              : `${name}: สองวิธีแม่นพอ ๆ กัน (${r.bt.mapeSeasonal.toFixed(0)}% กับ ${r.bt.mapeFlat.toFixed(0)}%)${branch ? '' : ' เพราะสาขาออฟฟิศกับห้างขายดีคนละวัน พอรวมกันรูปแบบรายสัปดาห์จึงหักล้างกัน'}`}{' '}
            รวมเป็นรายสัปดาห์พลาดเหลือ {r.weekly.toFixed(0)}% จึงใช้วางแผนสต็อกและกะพนักงานรายสัปดาห์ได้ แต่ไม่ควรใช้ตัดสินยอดรายวันของสาขาเดียว
          </Insight>
        </>
      )}
    </ChartCard>
  )
}

// ---------------- 4.5B · คลิกแล้วซูม ----------------
function AnomalyZoom({ focus, all, daily, onClose }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const data = useMemo(() => {
    const from = addDays(focus.date, -ZOOM_DAYS)
    const to = addDays(focus.date, ZOOM_DAYS)
    const expected = new Map(all.filter((a) => a.branch === focus.branch).map((a) => [a.date, a.expected]))
    return toSeries(daily, focus.branch)
      .filter((s) => s.date >= from && s.date <= to)
      .map((s) => ({ date: s.date, actual: s.revenue, expected: expected.get(s.date) }))
  }, [focus, all, daily])
  const color = focus.change < 0 ? LOSS_COLOR : GAIN_COLOR
  const axisText = { fill: theme.axisText, fontSize: 12 }

  return (
    <div className="mt-4 rounded-xl p-4 ring-1 ring-amber-300 dark:ring-amber-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-50">
            {focus.branch} · {formatDayLong(focus.date)}
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            ยอดจริง {formatBaht(focus.actual)} เทียบค่าปกติ {formatBaht(focus.expected)} · ±{ZOOM_DAYS} วันรอบวันนั้น
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดกราฟ"
          className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800"
        >
          ปิด
        </button>
      </div>
      <div className="mt-3">
        <Legend
          items={[
            { label: 'ยอดจริง', color: theme.labelText },
            { label: 'ค่าปกติ (ค่ากลางวันเดียวกันของสัปดาห์ 8 สัปดาห์ก่อน)', color: theme.series, dashed: true },
          ]}
        />
        <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
          <ComposedChart data={data} margin={{ top: 12, right: isMobile ? 8 : 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDayShort} minTickGap={isMobile ? 40 : 24} tick={axisText} tickLine={false} axisLine={{ stroke: theme.grid }} />
            <YAxis tickFormatter={isMobile ? formatBahtCompact : formatBahtShort} width={isMobile ? 48 : 72} domain={[0, 'auto']} tick={axisText} tickLine={false} axisLine={false} />
            <Tooltip content={<SeriesTooltip />} cursor={{ stroke: theme.cursor, strokeWidth: 1 }} />
            <Line dataKey="expected" stroke={theme.series} strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.8} dot={false} connectNulls isAnimationActive={false} />
            <Line dataKey="actual" stroke={theme.labelText} strokeWidth={2} dot={false} isAnimationActive={false} />
            <ReferenceDot x={focus.date} y={focus.actual} r={6} fill={color} stroke={theme.surface} strokeWidth={2} ifOverflow="extendDomain" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------- 4.5 · วันผิดปกติ ----------------
const weekdayFmt = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short' })

function AnomalyCard({ daily, holidays }) {
  const [focus, setFocus] = useState(null)
  const result = useMemo(() => tryRun(() => scoreAnomalies(daily, holidays)), [daily, holidays])
  if (result.error) {
    return (
      <ChartCard title="วันที่ยอดขายผิดปกติ">
        <Pending>{result.error}</Pending>
      </ChartCard>
    )
  }
  const all = result.value
  const top = all.filter((a) => !a.holiday).slice(0, 15)
  // วันหยุดหลายวันติดกัน (เช่น สงกรานต์) นับเป็นรายการเดียวต่อสาขา
  const holidayHits = [...new Set(all.filter((a) => a.holiday).map((a) => `${a.holiday} (${a.branch})`))].slice(0, 3)
  const isFocus = (a) => focus && focus.date === a.date && focus.branch === a.branch

  return (
    <ChartCard
      title="วันที่ยอดขายผิดปกติ 15 อันดับ"
      subtitle="เทียบกับค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน · ไม่นับวันหยุดราชการ · คลิกแถวเพื่อซูมกราฟ"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm tabular-nums">
          <thead className="text-left text-stone-500 dark:text-stone-400">
            <tr>
              <th className="py-1.5 font-medium">#</th>
              <th className="py-1.5 font-medium">วันที่</th>
              <th className="py-1.5 font-medium">สาขา</th>
              <th className="py-1.5 text-right font-medium">ยอดจริง</th>
              <th className="py-1.5 text-right font-medium">ปกติ</th>
              <th className="py-1.5 pl-4 font-medium">ต่างจากปกติ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-stone-700 dark:divide-stone-800 dark:text-stone-300">
            {top.map((a, i) => (
              <tr
                key={a.date + a.branch}
                onClick={() => setFocus(isFocus(a) ? null : a)}
                aria-selected={Boolean(isFocus(a))}
                className={`cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800 ${isFocus(a) ? 'bg-amber-50 dark:bg-amber-950/40' : ''}`}
              >
                <td className="py-1.5 text-stone-400 dark:text-stone-500">{i + 1}</td>
                <td className="py-1.5">
                  {formatDayLong(a.date).replace(/^\S+ /, '')}{' '}
                  <span className="text-stone-400 dark:text-stone-500">{weekdayFmt.format(new Date(`${a.date}T00:00:00+07:00`))}</span>
                </td>
                <td className="py-1.5">{a.branch}</td>
                <td className="py-1.5 text-right">{formatBaht(a.actual)}</td>
                <td className="py-1.5 text-right text-stone-500 dark:text-stone-400">{formatBaht(a.expected)}</td>
                <td className="py-1.5 pl-4">
                  {a.change < 0 ? (
                    <span className="font-medium text-red-700 dark:text-red-400">▼ ต่ำกว่าปกติ {Math.round(-a.change * 100)}%</span>
                  ) : (
                    <span className="font-medium text-orange-700 dark:text-orange-400">▲ สูงกว่าปกติ {Math.round(a.change * 100)}%</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {focus && <AnomalyZoom focus={focus} all={all} daily={daily} onClose={() => setFocus(null)} />}
      <Insight>
        อันดับต้น ๆ คือวันที่ควรโทรถามผู้จัดการสาขาว่าเกิดอะไรขึ้น · ระบบบอกได้ว่า “ผิดปกติ” แต่บอกไม่ได้ว่า “เพราะอะไร”
        {holidayHits.length > 0 && <> · วันหยุดที่ยอดเปลี่ยนมากแต่ไม่นับ เช่น {holidayHits.join(', ')}</>}
      </Insight>
    </ChartCard>
  )
}

function ForecastTab({ demo, rows, products }) {
  const state = useAnalytics({ demo, rows, products })
  return (
    <AnalyticsShell state={state}>
      {(d) =>
        d.daily.error ? (
          <Pending>{d.daily.error}</Pending>
        ) : (
          <>
            {d.meta.alerts?.length > 0 && (
              <Notice tone="error">
                🚨 ยอดวันล่าสุดผิดปกติ: {d.meta.alerts.map((a) => `${a.branch} ${formatBaht(a.actual)} (ปกติ ${formatBaht(a.expected)})`).join(', ')}
              </Notice>
            )}
            <ForecastCard daily={d.daily.rows} />
            <AnomalyCard daily={d.daily.rows} holidays={d.meta.holidays ?? {}} />
          </>
        )
      }
    </AnalyticsShell>
  )
}

export default ForecastTab
