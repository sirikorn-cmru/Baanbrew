import { useState } from 'react'

// กรอบการ์ดกราฟ + ตารางข้อมูลแบบพับได้ (ให้อ่านตัวเลขได้โดยไม่ต้องดูกราฟ)
// table = { columns, getRows } — getRows ถูกเรียกเฉพาะตอนเปิดตาราง เพื่อไม่ต้องสร้างหลายร้อยแถวทุกครั้งที่กรอง
// actions (ไม่บังคับ) = ปุ่มตัวเลือกการแสดงผลของกราฟนี้ วางไว้มุมขวาบน
function ChartCard({ title, subtitle, actions, children, table }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 sm:p-5 dark:bg-stone-900 dark:shadow-none dark:ring-stone-800">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-50">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
      {table && (
        <details className="mt-3 text-sm" onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className="cursor-pointer text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100">ดูเป็นตาราง</summary>
          {open && (
            <div className="mt-2 max-h-72 overflow-auto">
              <table className="w-full tabular-nums">
                <thead className="sticky top-0 bg-white text-left text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                  <tr>
                    {table.columns.map((c, i) => (
                      <th key={c} className={`py-1.5 font-medium ${i > 0 ? 'text-right' : ''}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700 dark:divide-stone-800 dark:text-stone-300">
                  {table.getRows().map((r) => (
                    <tr key={r[0]}>
                      {r.map((cell, i) => (
                        <td key={i} className={`py-1.5 ${i > 0 ? 'text-right' : ''}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}
    </section>
  )
}

export default ChartCard
