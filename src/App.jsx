import Papa from 'papaparse'
import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import BillDistributionChart from './components/BillDistributionChart'
import BranchSalesChart from './components/BranchSalesChart'
import BranchTrendChart from './components/BranchTrendChart'
import DailySalesChart from './components/DailySalesChart'
import FilterBar from './components/FilterBar'
import KpiCard from './components/KpiCard'
import MemberSection from './components/MemberSection'
import MenuSection from './components/MenuSection'
import ThemeToggle from './components/ThemeToggle'
import WeekdayHourHeatmap from './components/WeekdayHourHeatmap'
import Lab2Page from './lab2/Lab2Page'
import { formatBaht, formatDayLong, formatNumber } from './lib/format'
import {
  billDistribution,
  branchSalesOverTime,
  computeKpis,
  dailySales,
  filterRows,
  getDateBounds,
  listBranches,
  memberInsights,
  menuSales,
  movingAverage,
  parseMembers,
  parseSales,
  pickGranularity,
  salesByBranch,
  weekdayHourHeatmap,
} from './lib/metrics'
import { applyTheme, useTheme } from './lib/theme'
import { filtersFromSearch, filtersToSearch } from './lib/urlFilters'

// โหลด Firebase SDK เฉพาะตอนเปิดแท็บ Lab 3 — แท็บอื่นไม่ต้องดาวน์โหลด
const Lab3Page = lazy(() => import('./lab3/Lab3Page'))

const CSV_URL = '/sales.csv'
const PRODUCTS_URL = '/products.csv'
const MEMBERS_URL = '/members.csv' // customer_id, joined_date, home_branch_id, gender (ไม่มีชื่อเล่น เบอร์โทร อายุ)
const BRANCHES_URL = '/branches.csv' // ใช้แปลง home_branch_id → ชื่อสาขา

// อ่านไฟล์เสริมแบบไม่บังคับ: ไม่มีไฟล์ (Vite ส่ง index.html กลับมา) = ข้อความว่าง
const fetchOptional = (url) =>
  fetch(url).then((res) => (res.ok && !(res.headers.get('content-type') ?? '').includes('text/html') ? res.text() : ''))

// hash ว่าง = แท็บแรก · แท็บที่ใช้ตัวกรอง (filtered) แสดงแถบตัวกรองและคำนวณตามช่วงที่เลือก
const TABS = [
  { id: 'overview', label: 'ภาพรวม', hash: '', filtered: true },
  { id: 'insights', label: 'เจาะลึกยอดขาย', hash: '#insights', filtered: true },
  { id: 'lab2', label: 'Lab 2.2 · ซ่อมกราฟ', hash: '#lab2', filtered: false },
  { id: 'lab3', label: 'Lab 3.2 · Real-time', hash: '#lab3', filtered: false, scope: 'ข้อมูลสดจาก Cloud Firestore' },
]
const tabFromHash = (hash) => (TABS.find((t) => t.hash && t.hash === hash) ?? TABS[0]).id
const MERGE_WINDOW_MS = 400

function App() {
  const [state, setState] = useState({ status: 'loading' })
  const [userFilters, setFilters] = useState(null) // null = ยังไม่ได้เลือก → ใช้ค่าจาก URL
  const [products, setProducts] = useState([]) // ไม่มีไฟล์ = แสดงรหัสเมนูแทนชื่อ
  const [members, setMembers] = useState([]) // ไม่มีไฟล์ = ไม่แสดงส่วนสมาชิก
  const [tab, setTab] = useState(() => tabFromHash(window.location.hash))
  const currentTab = TABS.find((t) => t.id === tab)
  const { resolved: theme } = useTheme()

  useEffect(() => applyTheme(theme), [theme])

  useEffect(() => {
    let cancelled = false
    fetch(CSV_URL)
      .then((res) => {
        const type = res.headers.get('content-type') ?? ''
        // Vite ส่ง index.html กลับมาถ้าไม่มีไฟล์ จึงต้องเช็ก content-type ด้วย
        if (!res.ok || type.includes('text/html')) throw new Error(`ไม่พบไฟล์ public${CSV_URL}`)
        return res.text()
      })
      .then((text) => !cancelled && setState({ status: 'ready', ...parseSales(text) }))
      .catch((err) => !cancelled && setState({ status: 'error', message: err.message }))
    fetchOptional(PRODUCTS_URL)
      .then((text) => {
        const { data } = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() })
        if (!cancelled) setProducts(data)
      })
      .catch(() => {})
    Promise.all([fetchOptional(MEMBERS_URL), fetchOptional(BRANCHES_URL)])
      .then(([membersText, branchesText]) => {
        const { data } = Papa.parse(branchesText, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() })
        const branchNames = Object.fromEntries(data.map((b) => [b.branch_id?.trim(), b.branch?.trim()]))
        if (!cancelled) setMembers(parseMembers(membersText, branchNames))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // สลับแท็บด้วย hash (#insights, #lab2) ไม่เพิ่มประวัติ และคงตัวกรองใน query string ไว้
  const chooseTab = (id) => {
    setTab(id)
    const { hash } = TABS.find((t) => t.id === id)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
  }

  // ข้อมูลที่ไม่ขึ้นกับตัวกรอง: ช่วงวันที่ทั้งหมดและรายชื่อสาขา
  const base = useMemo(() => {
    if (state.status !== 'ready') return null
    return { bounds: getDateBounds(state.rows), branches: listBranches(state.rows) }
  }, [state])

  // เปิดหน้าครั้งแรกใช้ค่าจาก URL (ไม่มี = ทั้งช่วง ทุกสาขา) หลังจากนั้นใช้ค่าที่ผู้ใช้เลือก
  const filters = useMemo(
    () => base && (userFilters ?? filtersFromSearch(window.location.search, base)),
    [base, userFilters],
  )

  // ผู้ใช้เปลี่ยนตัวกรอง → เพิ่มประวัติใหม่ (pushState) ให้ปุ่ม Back ย้อนได้ทีละขั้น
  // การเปลี่ยนที่ตามกันเร็วมาก (เช่น พิมพ์วันที่ทีละหลัก) จะรวมเป็นขั้นเดียวด้วย replaceState
  const lastPushAt = useRef(0)
  // ตัวกรองล่าสุดที่ผู้ใช้สั่ง — เขียนเฉพาะตอนผู้ใช้เปลี่ยน/กด Back เท่านั้น
  // (ไม่ sync จาก render เพราะ render เก่าที่ค้างอยู่อาจเขียนทับค่าใหม่ แล้วคลิกถัดไปจะรวมกับค่าเก่า)
  const filtersRef = useRef(null)

  const updateFilters = useCallback(
    (patch) => {
      const prev = filtersRef.current ?? filtersFromSearch(window.location.search, base)
      const next = { ...prev, ...patch }
      // หน่วยเวลาที่เลือกเองผูกกับช่วงวันที่ — เปลี่ยนช่วงวันที่แล้วกลับไปใช้ค่าอัตโนมัติ
      if (next.from !== prev.from || next.to !== prev.to) next.granularity = null
      // เลือกหน่วยที่ตรงกับค่าอัตโนมัติ = ไม่ได้เลือกเอง (URL จะได้ไม่มี g เกินมา)
      if (next.granularity === pickGranularity(next.from, next.to)) next.granularity = null
      next.granularity ??= null

      filtersRef.current = next
      setFilters(next)
      const search = filtersToSearch(next, base, window.location.search)
      if (search === window.location.search) return
      const url = `${window.location.pathname}${search}${window.location.hash}`
      const now = Date.now()
      if (now - lastPushAt.current < MERGE_WINDOW_MS) window.history.replaceState(null, '', url)
      else window.history.pushState(null, '', url)
      lastPushAt.current = now
    },
    [base],
  )

  // กด Back/Forward → อ่านตัวกรองจาก URL ของประวัตินั้น
  useEffect(() => {
    if (!base) return
    const onPopState = () => {
      lastPushAt.current = 0
      filtersRef.current = filtersFromSearch(window.location.search, base)
      setFilters(filtersRef.current)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [base])

  // ทำ URL ให้ตรงกับตัวกรองที่ใช้จริง (เช่น เปิดลิงก์ที่มีค่าผิด) — แก้ URL เดิม ไม่เพิ่มประวัติ
  useEffect(() => {
    if (!filters) return
    const search = filtersToSearch(filters, base, window.location.search)
    if (search !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`)
    }
  }, [filters, base])

  // ปุ่มตัวกรองเปลี่ยนสีทันที ส่วน KPI/กราฟคำนวณตามหลัง (ไม่บล็อกการคลิก)
  // ระหว่างรอ กราฟชุดเดิมยังแสดงอยู่แบบจางลง แทนที่จะกระพริบหรือว่าง
  const deferredFilters = useDeferredValue(filters)
  const isStale = filters !== deferredFilters

  const metrics = useMemo(() => {
    if (!base || !deferredFilters) return null
    const { from, to, branches } = deferredFilters
    const autoGranularity = pickGranularity(from, to)
    const granularity = deferredFilters.granularity ?? autoGranularity
    const shownBranches = branches.length ? branches : base.branches
    const branchRows = filterRows(state.rows, { branches })
    const rangeRows = filterRows(branchRows, { from, to })

    // คิดค่าเฉลี่ย 7 วันจากข้อมูลทั้งช่วงก่อน แล้วค่อยตัดตามวันที่ที่เลือก
    // วันแรก ๆ ของช่วงที่เลือกจึงยังมีค่าเฉลี่ย (ใช้ยอดของวันก่อนหน้าช่วงมาคิดด้วย)
    const daily = movingAverage(dailySales(branchRows, base.bounds), 7).filter(
      (d) => d.date >= from && d.date <= to,
    )

    return {
      isEmpty: rangeRows.length === 0,
      kpis: computeKpis(rangeRows),
      daily,
      bills: billDistribution(rangeRows),
      heatmap: weekdayHourHeatmap(rangeRows, { from, to }),
      menu: menuSales(rangeRows, products),
      members: members.length ? memberInsights(state.rows, rangeRows, members, { from, to, branches }) : null,
      branches: salesByBranch(rangeRows),
      trend: {
        // ส่ง branchRows (ทุกวันที่) เพื่อให้รู้วันเปิดสาขาจริง แม้วันนั้นอยู่นอกช่วงที่เลือก
        data: branchSalesOverTime(branchRows, { from, to, granularity, branches: shownBranches }),
        branches: shownBranches,
        granularity,
        autoGranularity,
      },
    }
  }, [state, base, deferredFilters, members, products])

  const chooseGranularity = useCallback((granularity) => updateFilters({ granularity }), [updateFilters])

  const scopeText =
    !currentTab.filtered
      ? (currentTab.scope ?? 'ข้อมูลทั้งหมด ทุกสาขา (ไม่ใช้ตัวกรองของหน้าภาพรวม)')
      : filters &&
    `${formatDayLong(filters.from)} – ${formatDayLong(filters.to)} · ${
      filters.branches.length ? filters.branches.join(', ') : 'ทุกสาขา'
    }`

  return (
    <div className="min-h-screen bg-amber-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-amber-800 sm:text-3xl dark:text-amber-500">บ้านบรู Dashboard</h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{scopeText ?? 'สรุปยอดขายจาก sales.csv'}</p>
          </div>
          <ThemeToggle />
        </header>

        <nav className="mb-5 flex flex-wrap gap-1 sm:mb-6" aria-label="เลือกหน้า">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => chooseTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium sm:px-4 ${
                tab === t.id
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'lab3' && (
          <Suspense fallback={<p className="text-stone-500 dark:text-stone-400">กำลังโหลด…</p>}>
            <Lab3Page />
          </Suspense>
        )}

        {tab !== 'lab3' && state.status === 'loading' && <p className="text-stone-500 dark:text-stone-400">กำลังโหลดข้อมูล…</p>}

        {tab !== 'lab3' && state.status === 'error' && (
          <div className="rounded-2xl bg-white p-5 text-stone-700 ring-1 ring-red-200 dark:bg-stone-900 dark:text-stone-300 dark:ring-red-900">
            <p className="font-semibold text-red-700 dark:text-red-400">โหลดข้อมูลไม่สำเร็จ</p>
            <p className="mt-1 text-sm">{state.message}</p>
          </div>
        )}

        {state.status === 'ready' && tab === 'lab2' && <Lab2Page rows={state.rows} products={products} members={members} />}

        {metrics && currentTab.filtered && (
          <div className="space-y-4 sm:space-y-6">
            <FilterBar bounds={base.bounds} branches={base.branches} filters={filters} onChange={updateFilters} />

            <div
              aria-busy={isStale}
              className={`space-y-4 transition-opacity duration-150 sm:space-y-6 ${isStale ? 'opacity-60' : ''}`}
            >
              {tab === 'overview' && (
                <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  <KpiCard label="ยอดขายรวม" value={formatBaht(metrics.kpis.totalSales)} />
                  <KpiCard label="จำนวนบิล" value={formatNumber(metrics.kpis.orderCount)} hint="นับ order_id ไม่ซ้ำ" />
                  <KpiCard
                    label="ยอดเฉลี่ยต่อบิล"
                    value={formatBaht(metrics.kpis.avgPerOrder)}
                    hint={`ค่ากลาง ${formatBaht(metrics.bills.median)}`}
                  />
                  <KpiCard
                    label="ลูกค้าสมาชิก (ไม่ซ้ำ)"
                    value={formatNumber(metrics.kpis.uniqueMembers)}
                    hint="ไม่นับลูกค้าทั่วไป"
                  />
                </section>
              )}

              {metrics.isEmpty ? (
                <p className="rounded-2xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:ring-stone-800">
                  ไม่มียอดขายตามตัวกรองที่เลือก
                </p>
              ) : tab === 'overview' ? (
                <>
                  <DailySalesChart data={metrics.daily} />
                  <BranchSalesChart data={metrics.branches} />
                  <BranchTrendChart
                    data={metrics.trend.data}
                    branches={metrics.trend.branches}
                    allBranches={base.branches}
                    granularity={metrics.trend.granularity}
                    autoGranularity={metrics.trend.autoGranularity}
                    onGranularityChange={chooseGranularity}
                  />
                </>
              ) : (
                <>
                  <BillDistributionChart data={metrics.bills} />
                  <WeekdayHourHeatmap data={metrics.heatmap} />
                  <MenuSection data={metrics.menu} />
                  {metrics.members && <MemberSection data={metrics.members} />}
                </>
              )}
            </div>

            {state.skipped > 0 && (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                ข้ามไป {formatNumber(state.skipped)} แถว เพราะข้อมูลไม่ครบหรืออ่านไม่ได้
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
