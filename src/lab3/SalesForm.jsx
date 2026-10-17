import { collection, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore'
import { useState } from 'react'
import { db } from '../lib/firebase'
import { formatBaht } from '../lib/format'
import { toBangkokDate } from '../lib/metrics'

const PAYMENT_METHODS = ['เงินสด', 'QR พร้อมเพย์', 'บัตรเครดิต']
const MAX_QTY = 50

const inputClass =
  'mt-1 w-full rounded-lg border-0 bg-stone-50 px-3 py-2 text-stone-900 ring-1 ring-stone-300 focus:ring-2 focus:ring-amber-600 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-700'

// บันทึก 1 บิล (1 เมนู) → เขียน 2 เอกสารพร้อมกันใน batch เดียว (สำเร็จทั้งคู่หรือไม่สำเร็จเลย)
//   sales_entries/{auto id}         รายการที่บันทึก ใช้แสดง "บันทึกล่าสุด"
//   daily_sales/{วันที่}_{สาขา}       เพิ่มยอดด้วย increment() — กราฟทุกจอที่เปิดอยู่อัปเดตเองทันที
function SalesForm({ branches, products, user }) {
  const [form, setForm] = useState({ date: toBangkokDate(new Date().toISOString()), branchId: '', productId: '', qty: 1, payment: PAYMENT_METHODS[1] })
  const [status, setStatus] = useState({ type: 'idle' })

  const branchId = form.branchId || branches[0]?.branch_id || ''
  const productId = form.productId || products[0]?.product_id || ''
  const branch = branches.find((b) => b.branch_id === branchId)
  const product = products.find((p) => p.product_id === productId)
  const qty = Number(form.qty)
  const validQty = Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY
  const revenue = product && validQty ? product.price * qty : 0
  const ready = user && branch && product && validQty && form.date

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!ready) return
    setStatus({ type: 'saving' })
    const batch = writeBatch(db)
    batch.set(doc(collection(db, 'sales_entries')), {
      date: form.date,
      branch_id: branch.branch_id,
      branch: branch.name,
      product_id: product.product_id,
      product_name: product.name,
      qty,
      unit_price: product.price,
      revenue,
      payment_method: form.payment,
      uid: user.uid, // Security Rules ตรวจว่าตรงกับคนที่ล็อกอินจริง
      recorded_by: user.displayName ?? '',
      createdAt: serverTimestamp(),
    })
    batch.set(
      doc(db, 'daily_sales', `${form.date}_${branch.branch_id}`),
      { date: form.date, branch_id: branch.branch_id, branch: branch.name, revenue: increment(revenue), items: increment(qty), bills: increment(1) },
      { merge: true },
    )
    try {
      await batch.commit()
      setStatus({ type: 'saved', text: `บันทึกแล้ว: ${product.name} × ${qty} ที่สาขา${branch.name} ${formatBaht(revenue)}` })
      setForm((f) => ({ ...f, qty: 1 }))
    } catch (err) {
      setStatus({ type: 'error', text: `บันทึกไม่สำเร็จ: ${err.message}` })
    }
  }

  const disabled = !user || !branches.length || !products.length

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 sm:p-5 dark:bg-stone-900 dark:shadow-none dark:ring-stone-800">
      <h2 className="text-base font-semibold text-stone-900 dark:text-stone-50">บันทึกยอดขาย</h2>
      <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">บันทึกแล้วกราฟด้านล่างอัปเดตทันที รวมถึงจอของคนอื่นที่เปิดหน้านี้อยู่</p>

      <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <label className="col-span-1 text-stone-600 dark:text-stone-400">
          วันที่
          <input type="date" required value={form.date} onChange={update('date')} className={inputClass} />
        </label>
        <label className="col-span-1 text-stone-600 dark:text-stone-400">
          สาขา
          <select value={branchId} onChange={update('branchId')} disabled={disabled} className={inputClass}>
            {branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-stone-600 dark:text-stone-400">
          เมนู
          <select value={productId} onChange={update('productId')} disabled={disabled} className={inputClass}>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>{p.name} ({formatBaht(p.price)})</option>
            ))}
          </select>
        </label>
        <label className="col-span-1 text-stone-600 dark:text-stone-400">
          จำนวน
          <input type="number" min="1" max={MAX_QTY} step="1" required value={form.qty} onChange={update('qty')} className={`${inputClass} tabular-nums`} />
        </label>
        <label className="col-span-1 text-stone-600 dark:text-stone-400">
          ชำระเงิน
          <select value={form.payment} onChange={update('payment')} className={inputClass}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>

        <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-3 lg:col-span-6">
          <button
            type="submit"
            disabled={!ready || status.type === 'saving'}
            className="rounded-lg bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            {status.type === 'saving' ? 'กำลังบันทึก…' : `บันทึก ${formatBaht(revenue)}`}
          </button>
          <p
            role="status"
            className={status.type === 'error' ? 'text-red-700 dark:text-red-400' : 'text-stone-600 dark:text-stone-400'}
          >
            {!user
              ? 'ล็อกอินด้วย Google ก่อนจึงจะบันทึกได้'
              : status.type === 'saved' || status.type === 'error'
                ? status.text
                : !validQty
                  ? `จำนวนต้องเป็นจำนวนเต็ม 1–${MAX_QTY}`
                  : ''}
          </p>
        </div>
      </form>
    </section>
  )
}

export default SalesForm
