import { lazy, Suspense } from 'react'
import { formatDayLong, formatNumber } from '../lib/format'

// AuthBar นำเข้า Firebase Auth จึงโหลดเฉพาะโหมดจริง (โหมดสาธิตไม่ต้องมี config)
const AuthBar = lazy(() => import('../lab3/AuthBar'))

const builtAtFmt = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })

// แสดงแทนส่วนที่ยังคำนวณไม่ได้
export function Pending({ children }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">
      {children}
    </div>
  )
}

export function Insight({ children }) {
  return (
    <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300">
      {children}
    </p>
  )
}

export function Notice({ tone = 'info', children }) {
  const cls =
    tone === 'error'
      ? 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900'
      : 'bg-white text-stone-600 ring-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:ring-stone-800'
  return <p className={`rounded-2xl p-4 text-sm ring-1 ${cls}`}>{children}</p>
}

function Freshness({ meta, reads }) {
  return (
    <p className="text-sm text-stone-500 dark:text-stone-400">
      ข้อมูลถึง {formatDayLong(meta.asOf)} · {formatNumber(meta.rows)} รายการ ·{' '}
      {meta.builtBy === 'demo' ? (
        <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          โหมดสาธิต คำนวณในเบราว์เซอร์
        </span>
      ) : (
        <>
          อัปเดต {meta.builtAt ? builtAtFmt.format(meta.builtAt) : '–'} โดย{' '}
          {meta.builtBy === 'github-actions' ? 'GitHub Actions' : 'สคริปต์บนเครื่อง'} · อ่าน {reads} เอกสาร
        </>
      )}
    </p>
  )
}

// ส่วนหัวร่วมของแท็บ Lab 4: ล็อกอิน · ความสดของข้อมูล · จำนวนเอกสารที่อ่าน
export function AnalyticsShell({ state, children }) {
  const { user, data, error, demo } = state
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {data?.meta ? <Freshness meta={data.meta} reads={data.reads} /> : <span />}
        {!demo && (
          <Suspense fallback={null}>
            <AuthBar user={user} hint="ผลวิเคราะห์มีข้อมูลลูกค้า จึงต้องล็อกอินก่อน" />
          </Suspense>
        )}
      </div>
      {user === undefined && <p className="text-stone-500 dark:text-stone-400">กำลังตรวจสอบการเข้าสู่ระบบ…</p>}
      {user === null && (
        <Notice>
          ล็อกอินด้วย Google เพื่อดูผลวิเคราะห์ หรือเปิด <a className="underline" href="?demo#customers">โหมดสาธิต</a> ที่คำนวณจาก sales.csv ในเบราว์เซอร์
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {user && !data && !error && <p className="text-stone-500 dark:text-stone-400">กำลังโหลดผลวิเคราะห์…</p>}
      {data && children(data)}
    </div>
  )
}
