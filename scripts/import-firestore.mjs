// Lab 3.1 · นำข้อมูลบ้านบรูเข้า Cloud Firestore
//
// วิธีใช้:  npm run import:firestore            (เขียนจริง)
//          npm run import:firestore -- --dry-run (ดูจำนวนเอกสารโดยไม่เขียน)
//
// ต้องมี .env.local (ดู .env.example) และ Firestore ต้องอยู่ใน test mode ชั่วคราว
// เพราะสคริปต์นี้ใช้ Web SDK ตัวเดียวกับหน้าเว็บ (ไม่ใช่ Admin SDK) — Lab 3.3 จะปิดสิทธิ์ด้วย Security Rules
//
// ทำไมไม่อัปโหลด sales.csv ทั้ง 53,057 แถว: แพ็กเกจฟรี (Spark) เขียนได้ 20,000 ครั้ง/วัน
// จึงรวมเป็นยอดรายวันต่อสาขา (~2,700 เอกสาร) ซึ่งพอสำหรับ dashboard และเหลือโควตาให้ฟอร์มบันทึกยอดขายใน Lab 3.2

import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { parseSales } from '../src/lib/metrics.js'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 500 // ขีดจำกัดของ writeBatch

const readCsv = (path) =>
  Papa.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  }).data

// ---------- เตรียมข้อมูล ----------
const branches = readCsv('public/branches.csv').map((b) => ({
  id: b.branch_id,
  data: { branch_id: b.branch_id, name: b.branch, type: b.branch_type, lat: Number(b.lat), lng: Number(b.lng), opened_date: b.opened_date },
}))
const branchIdByName = new Map(branches.map((b) => [b.data.name, b.id]))

const products = readCsv('public/products.csv').map((p) => ({
  id: p.product_id,
  data: { product_id: p.product_id, name: p.product_name, category: p.category, price: Number(p.price), cost: Number(p.cost), launched_date: p.launched_date },
}))

const { rows, skipped } = parseSales(readFileSync('public/sales.csv', 'utf8'))
const daily = new Map() // key = YYYY-MM-DD_Bxx
for (const row of rows) {
  const branchId = branchIdByName.get(row.branch) ?? 'UNKNOWN'
  const key = `${row.date}_${branchId}`
  let d = daily.get(key)
  if (!d) {
    d = { date: row.date, branch_id: branchId, branch: row.branch, revenue: 0, items: 0, orders: new Set() }
    daily.set(key, d)
  }
  d.revenue += row.revenue
  d.items += row.qty
  d.orders.add(row.order_id)
}
const dailySales = [...daily].map(([id, d]) => ({
  id,
  data: { date: d.date, branch_id: d.branch_id, branch: d.branch, revenue: Math.round(d.revenue * 100) / 100, items: d.items, bills: d.orders.size, source: 'csv' },
}))

const collections = [
  ['branches', branches],
  ['products', products],
  ['daily_sales', dailySales],
]

console.log(`อ่าน sales.csv ได้ ${rows.length.toLocaleString()} แถว (ข้าม ${skipped})`)
for (const [name, docs] of collections) console.log(`  ${name}: ${docs.length.toLocaleString()} เอกสาร`)
const total = collections.reduce((n, [, docs]) => n + docs.length, 0)
console.log(`รวม ${total.toLocaleString()} ครั้งที่เขียน`)

if (DRY_RUN) {
  console.log('\n--dry-run: ไม่ได้เขียนอะไรลง Firestore')
  process.exit(0)
}

// ---------- เขียนลง Firestore ----------
try {
  process.loadEnvFile('.env.local')
} catch {
  console.error('ไม่พบ .env.local — คัดลอก .env.example เป็น .env.local แล้วใส่ค่า config ก่อน')
  process.exit(1)
}
// import หลังโหลด .env.local เพื่อให้ firebase.js อ่านค่า config ได้
const { db } = await import('../src/lib/firebase.js')
const { doc, writeBatch } = await import('firebase/firestore')

for (const [name, docs] of collections) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const { id, data } of docs.slice(i, i + BATCH_SIZE)) batch.set(doc(db, name, id), data)
    await batch.commit()
    console.log(`  ${name}: ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`)
  }
}
console.log('นำเข้าเสร็จแล้ว')
process.exit(0)
