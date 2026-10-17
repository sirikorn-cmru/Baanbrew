import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from '../components/ChartCard'
import ChartTooltip from '../components/ChartTooltip'
import KpiCard from '../components/KpiCard'
import { useIsMobile } from '../hooks/useMediaQuery'
import { CONTEXT_OPACITY, useChartTheme } from '../lib/chartTheme'
import { formatBaht, formatBahtCompact, formatBahtShort, formatDayLong, formatDayShort, formatNumber } from '../lib/format'
import SalesForm from './SalesForm'
import AuthBar from './AuthBar'
import { useAuth } from './useAuth'
import { useLiveSales } from './useLiveSales'

const STATUS = {
  loading: { dot: 'bg-stone-400', text: 'กำลังเชื่อมต่อ Firestore…' },
  live: { dot: 'bg-emerald-500 animate-pulse', text: 'เชื่อมต่อแบบ real-time' },
  cache: { dot: 'bg-amber-500', text: 'ออฟไลน์ · แสดงข้อมูลที่เก็บในเครื่อง' },
  error: { dot: 'bg-red-500', text: 'เชื่อมต่อไม่สำเร็จ' },
}

const timeFmt = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' })

function StatusBadge({ status, pending }) {
  const s = STATUS[status]
  return (
    <p className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400" role="status">
      <span className={`inline-block size-2.5 rounded-full ${s.dot}`} />
      {s.text}
      {pending && <span className="text-stone-400 dark:text-stone-500">· กำลังส่งข้อมูลขึ้นเซิร์ฟเวอร์</span>}
    </p>
  )
}

// ยอดรวมรายวัน — วันล่าสุดสีเข้ม วันอื่นจาง ให้เห็นทันทีว่ายอดที่เพิ่งบันทึกไปเพิ่มตรงไหน
function DailyBars({ days }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const axisText = { fill: theme.axisText, fontSize: 12 }
  return (
    <ChartCard
      title="ยอดขายรายวัน (สด)"
      subtitle={`รวมทุกสาขา ${days.length} วันล่าสุดที่มียอดขาย · แท่งเข้ม = วันล่าสุด`}
      table={{
        columns: ['วันที่', 'ยอดขาย', 'บิล'],
        getRows: () => [...days].reverse().map((d) => [formatDayLong(d.date), formatBaht(d.sales), formatNumber(d.bills)]),
      }}
    >
      <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
        <BarChart data={days} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatDayShort} tick={axisText} tickLine={false} axisLine={{ stroke: theme.grid }} minTickGap={isMobile ? 32 : 16} />
          <YAxis tickFormatter={isMobile ? formatBahtCompact : formatBahtShort} tick={axisText} tickLine={false} axisLine={false} width={isMobile ? 48 : 80} />
          <Tooltip content={<ChartTooltip formatLabel={formatDayLong} />} cursor={{ fill: theme.barCursor }} />
          <Bar dataKey="sales" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {days.map((d, i) => (
              <Cell key={d.date} fill={theme.series} fillOpacity={i === days.length - 1 ? 1 : CONTEXT_OPACITY + 0.2} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function LatestBranches({ latest, rows }) {
  const theme = useChartTheme()
  const max = Math.max(...rows.map((r) => r.sales), 1)
  return (
    <ChartCard title="ยอดแยกสาขา วันล่าสุด" subtitle={formatDayLong(latest.date)}>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.branch} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3">
            <span className="text-stone-700 dark:text-stone-300">{r.branch}</span>
            <span className="h-3 rounded-sm" style={{ width: `${(r.sales / max) * 100}%`, background: theme.series }} />
            <span className="tabular-nums text-stone-900 dark:text-stone-50">{formatBaht(r.sales)}</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

function RecentEntries({ entries, signedIn }) {
  return (
    <ChartCard title="บันทึกล่าสุด" subtitle="10 รายการล่าสุดจากฟอร์ม เรียงใหม่ → เก่า">
      {!signedIn ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">ล็อกอินเพื่อดูรายการที่บันทึก</p>
      ) : entries.docs.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">ยังไม่มีรายการ ลองบันทึกยอดขายจากฟอร์มด้านบน</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-stone-500 dark:text-stone-400">
              <tr>
                <th className="py-1.5 font-medium">เวลา</th>
                <th className="py-1.5 font-medium">สาขา</th>
                <th className="py-1.5 font-medium">เมนู</th>
                <th className="py-1.5 font-medium">ผู้บันทึก</th>
                <th className="py-1.5 text-right font-medium">จำนวน</th>
                <th className="py-1.5 text-right font-medium">ยอด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700 dark:divide-stone-800 dark:text-stone-300">
              {entries.docs.map((e) => (
                <tr key={e.id}>
                  {/* createdAt เป็น null ชั่วคราวระหว่างรอเซิร์ฟเวอร์ใส่เวลา */}
                  <td className="whitespace-nowrap py-1.5 pr-3">{e.createdAt ? timeFmt.format(e.createdAt.toDate()) : 'กำลังส่ง…'}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{e.branch}</td>
                  <td className="py-1.5 pr-3">{e.product_name}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{e.recorded_by || '–'}</td>
                  <td className="py-1.5 text-right">{e.qty}</td>
                  <td className="whitespace-nowrap py-1.5 text-right">{formatBaht(e.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  )
}

// Lab 3.2 · อ่าน/เขียน Cloud Firestore แบบ real-time ด้วย onSnapshot
function Lab3Page() {
  const user = useAuth()
  const { daily, entries, catalog, summary } = useLiveSales({ signedIn: Boolean(user) })
  const { latest } = summary

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={daily.status === 'idle' ? 'loading' : daily.status} pending={daily.pending || entries.pending} />
        <AuthBar user={user} />
      </div>

      {daily.status === 'error' && (
        <div className="rounded-2xl bg-white p-5 text-sm text-stone-700 ring-1 ring-red-200 dark:bg-stone-900 dark:text-stone-300 dark:ring-red-900">
          <p className="font-semibold text-red-700 dark:text-red-400">อ่านข้อมูลจาก Firestore ไม่ได้</p>
          <p className="mt-1">{daily.message}</p>
          <p className="mt-1">ตรวจว่ามีไฟล์ .env.local และ Security Rules อนุญาตให้อ่านได้</p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="ยอดขายวันล่าสุด" value={latest ? formatBaht(latest.sales) : '–'} hint={latest && formatDayLong(latest.date)} />
        <KpiCard label="บิลวันล่าสุด" value={latest ? formatNumber(latest.bills) : '–'} hint={latest && `${formatNumber(latest.items)} แก้ว/ชิ้น`} />
        <KpiCard label={`ยอดขาย ${summary.days.length} วัน`} value={formatBaht(summary.totalSales)} hint="วันที่มียอดขายล่าสุด" />
        <KpiCard label={`บิล ${summary.days.length} วัน`} value={formatNumber(summary.totalBills)} hint="รวมทุกสาขา" />
      </section>

      <SalesForm branches={catalog.branches} products={catalog.products} user={user} />

      {summary.days.length > 0 && (
        <>
          <DailyBars days={summary.days} />
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <LatestBranches latest={latest} rows={summary.latestBranches} />
            <RecentEntries entries={entries} signedIn={Boolean(user)} />
          </div>
        </>
      )}
    </div>
  )
}

export default Lab3Page
