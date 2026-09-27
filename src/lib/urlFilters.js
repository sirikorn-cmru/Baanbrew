import { pickGranularity } from './metrics'

// แปลงตัวกรอง ⇄ query string เช่น ?from=2026-08-22&to=2026-09-20&branch=สยาม&branch=สีลม&g=week
// ค่าที่เป็นค่าเริ่มต้น (ทั้งช่วง / ทุกสาขา / หน่วยเวลาอัตโนมัติ) จะไม่ใส่ลง URL เพื่อให้ลิงก์สั้น
//
// filters = { from, to, branches: string[], granularity: 'day' | 'week' | 'month' | null }
// granularity = null → ใช้หน่วยเวลาอัตโนมัติตามช่วงวันที่ (pickGranularity)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const GRANULARITIES = new Set(['day', 'week', 'month'])
const KEYS = ['from', 'to', 'branch', 'g']

const clamp = (d, { min, max }) => (d < min ? min : d > max ? max : d)

// อ่านตัวกรองจาก URL — ค่าที่ผิดรูปแบบหรือไม่มีในข้อมูลจะถูกข้าม ไม่ทำให้หน้าพัง
// base = { bounds: { min, max }, branches: string[] }
export function filtersFromSearch(search, { bounds, branches }) {
  const params = new URLSearchParams(search)
  const readDate = (key, fallback) => {
    const v = params.get(key)
    return v && DATE_RE.test(v) && !Number.isNaN(Date.parse(v)) ? clamp(v, bounds) : fallback
  }

  let from = readDate('from', bounds.min)
  let to = readDate('to', bounds.max)
  if (from > to) [from, to] = [to, from]

  // เรียงตามลำดับเดียวกับปุ่ม และตัดชื่อซ้ำ/ชื่อที่ไม่มีจริงออก
  const wanted = new Set(params.getAll('branch'))
  const selected = branches.filter((b) => wanted.has(b))

  // หน่วยเวลาที่ไม่รู้จัก หรือเท่ากับค่าอัตโนมัติอยู่แล้ว → null (URL จะถูกทำให้สั้นลง)
  const g = params.get('g')
  const granularity = GRANULARITIES.has(g) && g !== pickGranularity(from, to) ? g : null

  return { from, to, branches: selected.length === branches.length ? [] : selected, granularity }
}

// เขียนตัวกรองเป็น query string (รวม "?" ข้างหน้า หรือ "" ถ้าเป็นค่าเริ่มต้นทั้งหมด)
// คง query อื่นที่ไม่เกี่ยวกับตัวกรองไว้ตามเดิม
export function filtersToSearch({ from, to, branches, granularity }, { bounds }, currentSearch = '') {
  const params = new URLSearchParams(currentSearch)
  for (const key of KEYS) params.delete(key)

  if (from !== bounds.min) params.set('from', from)
  if (to !== bounds.max) params.set('to', to)
  for (const b of branches) params.append('branch', b)
  if (granularity) params.set('g', granularity)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
