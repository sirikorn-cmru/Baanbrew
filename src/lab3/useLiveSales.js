import { collection, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/firebase'

// อ่านยอดรายวันล่าสุดจำกัดจำนวน เพื่อประหยัดโควตาอ่าน (แพ็กเกจฟรี 50,000 ครั้ง/วัน)
// 5 สาขา × 30 วัน = 150 เอกสาร ต่อการเปิดหน้า 1 ครั้ง — หลังจากนั้นจ่ายเฉพาะเอกสารที่เปลี่ยน
const DAILY_LIMIT = 150
const ENTRY_LIMIT = 10

// สถานะการเชื่อมต่อ: loading → live (ข้อมูลจากเซิร์ฟเวอร์) / cache (ออฟไลน์ ใช้ข้อมูลในเครื่อง) / error
// q = null → ไม่ฟัง (เช่น ยังไม่ล็อกอิน จึงไม่มีสิทธิ์อ่าน)
const IDLE = { status: 'idle', docs: [], pending: false }
const LOADING = { status: 'loading', docs: [], pending: false }
function useSnapshot(q) {
  const [state, setState] = useState({ q: null, ...IDLE }) // จำไว้ว่าผลนี้มาจาก query ไหน
  useEffect(() => {
    if (!q) return undefined
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) =>
        setState({
          q,
          status: snap.metadata.fromCache ? 'cache' : 'live',
          docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          pending: snap.metadata.hasPendingWrites, // เขียนแล้วแต่เซิร์ฟเวอร์ยังไม่ยืนยัน
        }),
      (err) => setState({ q, status: 'error', docs: [], pending: false, message: err.message }),
    )
  }, [q])
  if (!q) return IDLE
  return state.q === q ? state : LOADING
}

const dailyQuery = query(collection(db, 'daily_sales'), orderBy('date', 'desc'), limit(DAILY_LIMIT))
const entryQuery = query(collection(db, 'sales_entries'), orderBy('createdAt', 'desc'), limit(ENTRY_LIMIT))

// signedIn: รายการที่บันทึก (มีชื่อคนบันทึก) อ่านได้เฉพาะคนที่ล็อกอิน — ดู firestore.rules
export function useLiveSales({ signedIn }) {
  const daily = useSnapshot(dailyQuery)
  const entries = useSnapshot(signedIn ? entryQuery : null)
  const [catalog, setCatalog] = useState({ branches: [], products: [] })

  // สาขาและเมนูแทบไม่เปลี่ยน อ่านครั้งเดียวพอ ไม่ต้องฟังแบบ real-time
  useEffect(() => {
    let cancelled = false
    Promise.all([getDocs(collection(db, 'branches')), getDocs(collection(db, 'products'))])
      .then(([b, p]) => {
        if (cancelled) return
        setCatalog({
          branches: b.docs.map((d) => d.data()).sort((x, y) => x.branch_id.localeCompare(y.branch_id)),
          products: p.docs.map((d) => d.data()).sort((x, y) => x.product_id.localeCompare(y.product_id)),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // รวมยอดทุกสาขาเป็นรายวัน (เก่า → ใหม่) และยอดแยกสาขาของวันล่าสุด
  const summary = useMemo(() => {
    const byDate = new Map()
    for (const d of daily.docs) {
      const day = byDate.get(d.date) ?? { date: d.date, sales: 0, bills: 0, items: 0, branches: [] }
      day.sales += d.revenue ?? 0
      day.bills += d.bills ?? 0
      day.items += d.items ?? 0
      day.branches.push({ branch: d.branch, sales: d.revenue ?? 0 })
      byDate.set(d.date, day)
    }
    // limit ตัดกลางวันได้ — ทิ้งวันที่เก่าสุดซึ่งอาจมีไม่ครบทุกสาขา
    const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
    if (daily.docs.length === DAILY_LIMIT) days.shift()
    const latest = days.at(-1) ?? null
    return {
      days,
      latest,
      latestBranches: latest ? [...latest.branches].sort((a, b) => b.sales - a.sales) : [],
      totalSales: days.reduce((n, d) => n + d.sales, 0),
      totalBills: days.reduce((n, d) => n + d.bills, 0),
    }
  }, [daily.docs])

  return { daily, entries, catalog, summary }
}
