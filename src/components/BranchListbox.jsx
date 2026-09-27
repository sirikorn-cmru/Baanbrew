import { useEffect, useId, useRef, useState } from 'react'
import { useChartTheme } from '../lib/chartTheme'

// ตัวเลือกสาขาแบบ listbox เลือกได้หลายสาขา (ตามแบบ ARIA listbox + aria-multiselectable)
// - ปุ่มแสดงสิ่งที่เลือกอยู่ กดแล้วเปิดรายการ
// - แป้นพิมพ์: ↑/↓ เลื่อน, Space/Enter เลือก/ยกเลิก, Home/End ไปต้น/ท้าย, Esc หรือ Tab ปิด
// - selected ว่าง = ทุกสาขา
function BranchListbox({ branches, selected, onChange }) {
  const id = useId()
  const theme = useChartTheme()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0) // index ใน options (0 = ทุกสาขา)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)

  const selectedSet = new Set(selected)
  const options = [{ value: null, label: 'ทุกสาขา' }, ...branches.map((b) => ({ value: b, label: b }))]
  const isSelected = (opt) => (opt.value === null ? selected.length === 0 : selectedSet.has(opt.value))
  const optionId = (i) => `${id}-opt-${i}`

  const summary =
    selected.length === 0 ? 'ทุกสาขา' : selected.length <= 2 ? selected.join(', ') : `${selected.length} สาขา`

  const toggle = (opt) => {
    if (opt.value === null) return onChange([])
    const next = new Set(selectedSet)
    if (next.has(opt.value)) next.delete(opt.value)
    else next.add(opt.value)
    // เลือกครบทุกสาขา = เท่ากับ "ทุกสาขา"; เรียงตามลำดับรายชื่อเสมอ
    onChange(next.size === branches.length ? [] : branches.filter((b) => next.has(b)))
  }

  const openList = (startAt = 0) => {
    setActive(startAt)
    setOpen(true)
  }
  const closeList = ({ focusButton = true } = {}) => {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }

  // เปิดแล้วย้ายโฟกัสไปที่รายการ
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  // ให้ตัวเลือกที่ active มองเห็นเสมอ (กรณีรายการยาวจนต้องเลื่อน)
  useEffect(() => {
    if (open) document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, id])

  // คลิกนอกกล่อง → ปิด
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) closeList({ focusButton: false })
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onButtonKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openList(e.key === 'ArrowUp' ? options.length - 1 : 0)
    }
  }

  const onListKeyDown = (e) => {
    const last = options.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => Math.min(i + 1, last))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(last)
        break
      case ' ':
      case 'Enter':
        e.preventDefault()
        toggle(options[active])
        break
      case 'Escape':
        e.preventDefault()
        closeList()
        break
      case 'Tab':
        closeList({ focusButton: false })
        break
    }
  }

  return (
    <div ref={rootRef} className="relative w-full sm:w-64">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`สาขา: ${summary}`}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onButtonKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-left text-sm text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800 dark:focus-visible:ring-amber-600"
      >
        <span className="truncate">{summary}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label="เลือกสาขา"
          aria-multiselectable="true"
          aria-activedescendant={optionId(active)}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-stone-200 focus:outline-none dark:bg-stone-800 dark:shadow-black/40 dark:ring-stone-700"
        >
          {options.map((opt, i) => {
            const checked = isSelected(opt)
            return (
              <li
                key={opt.label}
                id={optionId(i)}
                role="option"
                aria-selected={checked}
                onPointerMove={() => setActive(i)}
                onClick={() => {
                  setActive(i)
                  toggle(opt)
                }}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${
                  i === active ? 'bg-stone-100 dark:bg-stone-700' : ''
                } ${i === 0 ? 'border-b border-stone-100 dark:border-stone-700' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? 'border-amber-800 bg-amber-800 text-white dark:border-amber-600 dark:bg-amber-600 dark:text-stone-950'
                      : 'border-stone-300 dark:border-stone-500'
                  }`}
                >
                  {checked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="M5 12.5 10 17.5 19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {opt.value !== null && (
                  // สีเดียวกับเส้นของสาขานี้ในกราฟ "ยอดขายรายสาขาตามเวลา"
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: theme.categorical(i - 1) }}
                  />
                )}
                <span className="text-stone-800 dark:text-stone-100">{opt.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default BranchListbox
