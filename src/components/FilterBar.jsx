import { presetRange } from '../lib/metrics'

const PRESETS = [
  { days: 7, label: '7 วัน' },
  { days: 30, label: '30 วัน' },
  { days: 90, label: '90 วัน' },
  { days: null, label: 'ทั้งหมด' },
]

const chip = (active) =>
  `rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
    active
      ? 'bg-amber-800 font-medium text-white dark:bg-amber-600 dark:text-stone-950'
      : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50 hover:text-stone-900 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-50'
  }`

const dateInput =
  'min-w-0 flex-1 rounded-lg bg-white px-2.5 py-1.5 text-sm text-stone-800 ring-1 ring-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 sm:flex-none dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700 dark:focus:ring-amber-600'

function Group({ label, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</span>
      {children}
    </div>
  )
}

// filters = { from, to, branches: string[], granularity } — branches ว่าง = ทุกสาขา
// onChange(patch) รับเฉพาะค่าที่เปลี่ยน
function FilterBar({ bounds, branches, filters, onChange }) {
  const { from, to } = filters
  const selected = new Set(filters.branches)
  const set = onChange

  const activePreset = PRESETS.find((p) => {
    const r = presetRange(bounds, p.days)
    return r.from === from && r.to === to
  })

  const toggleBranch = (b) => {
    const next = new Set(selected)
    if (next.has(b)) next.delete(b)
    else next.add(b)
    // เลือกครบทุกสาขา = เท่ากับ "ทุกสาขา"
    set({ branches: next.size === branches.length ? [] : branches.filter((x) => next.has(x)) })
  }

  // ถ้าผู้ใช้เลือกวันเริ่มหลังวันสิ้นสุด (หรือกลับกัน) ให้ขยับอีกฝั่งตาม ช่วงจะได้ไม่ว่าง
  const setFrom = (v) => v && set({ from: v, to: v > to ? v : to })
  const setTo = (v) => v && set({ to: v, from: v < from ? v : from })

  const isDefault =
    !activePreset?.days && activePreset && filters.branches.length === 0 && !filters.granularity

  return (
    <section
      aria-label="ตัวกรอง"
      className="flex flex-col gap-4 rounded-2xl bg-white/60 p-4 ring-1 ring-stone-200 sm:p-5 lg:flex-row lg:items-end lg:gap-8 dark:bg-stone-900/60 dark:ring-stone-800"
    >
      <Group label="ช่วงวันที่">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={activePreset === p}
              className={chip(activePreset === p)}
              onClick={() => set(presetRange(bounds, p.days))}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="วันเริ่มต้น"
            className={dateInput}
            value={from}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-stone-400 dark:text-stone-500">–</span>
          <input
            type="date"
            aria-label="วันสิ้นสุด"
            className={dateInput}
            value={to}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </Group>

      <Group label="สาขา">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={selected.size === 0}
            className={chip(selected.size === 0)}
            onClick={() => set({ branches: [] })}
          >
            ทุกสาขา
          </button>
          {branches.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={selected.has(b)}
              className={chip(selected.has(b))}
              onClick={() => toggleBranch(b)}
            >
              {b}
            </button>
          ))}
        </div>
      </Group>

      {!isDefault && (
        <button
          type="button"
          className="self-start text-sm text-amber-800 underline-offset-2 dark:text-amber-500 hover:underline lg:ml-auto lg:self-end lg:pb-1.5"
          onClick={() => onChange({ ...presetRange(bounds, null), branches: [], granularity: null })}
        >
          ล้างตัวกรอง
        </button>
      )}
    </section>
  )
}

export default FilterBar
