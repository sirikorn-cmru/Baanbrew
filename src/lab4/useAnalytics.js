import Papa from 'papaparse'
import { useEffect, useMemo, useState } from 'react'
import { todayBangkok } from '../lab3/time'
import { computeAbc } from '../lib/analytics/abc'
import { shiftHolidays, shiftRows, weeklyShift } from '../lib/analytics/build'
import { computeCohorts } from '../lib/analytics/cohort'
import { dailyByBranch } from '../lib/analytics/daily'
import { computeRfm } from '../lib/analytics/rfm'

const DEMO_USER = { displayName: 'โหมดสาธิต' }

// ส่วนไหนคำนวณไม่ได้ ให้ส่วนนั้นแสดง error แทน ไม่ทำให้ทั้งแท็บพัง
const safe = (f) => {
  try {
    return f()
  } catch (e) {
    return { error: e.message }
  }
}

// โหมดสาธิต (?demo): คำนวณในเบราว์เซอร์จาก sales.csv ที่โหลดไว้แล้ว ด้วยฟังก์ชันชุดเดียวกับ pipeline
// เลื่อนวันที่ทีละสัปดาห์แบบเดียวกับ pipeline ตัวเลขจึงตรงกับเอกสารใน Firestore
function buildDemo(csvRows, products, holidaysRaw) {
  const end = csvRows.reduce((m, r) => (r.date > m ? r.date : m), '')
  const shift = weeklyShift(end, todayBangkok())
  const rows = shiftRows(csvRows, shift)
  const asOf = rows.reduce((m, r) => (r.date > m ? r.date : m), '')
  return {
    reads: 0,
    meta: { asOf, shift, rows: rows.length, holidays: shiftHolidays(holidaysRaw, shift), builtAt: null, builtBy: 'demo', alerts: [] },
    daily: safe(() => ({ rows: dailyByBranch(rows) })),
    rfm: safe(() => {
      const r = computeRfm(rows, asOf)
      return { asOf, segments: r.segments, customers: r.customers }
    }),
    cohort: safe(() => computeCohorts(rows, asOf)),
    abc: safe(() => ({ items: computeAbc(rows, products) })),
  }
}

function useDemoAnalytics(enabled, rows, products) {
  const [holidays, setHolidays] = useState(null)
  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    fetch('/thai_holidays.csv')
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => {
        const { data } = Papa.parse(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true })
        if (!cancelled) setHolidays(Object.fromEntries(data.map((h) => [h.date, h.holiday])))
      })
      .catch(() => !cancelled && setHolidays({}))
    return () => {
      cancelled = true
    }
  }, [enabled])
  return useMemo(
    () => (enabled && rows && holidays ? buildDemo(rows, products, holidays) : null),
    [enabled, rows, products, holidays],
  )
}

// โหมดจริง: โหลด Firebase เฉพาะตอนใช้ (โหมดสาธิตไม่ต้องมี config) แล้วอ่าน 5 เอกสารครั้งเดียวหลังล็อกอิน
// ไม่ใช้ onSnapshot เพราะผลวิเคราะห์เปลี่ยนวันละครั้ง
function useFirestoreAnalytics(enabled) {
  const [source, setSource] = useState(null)
  const [user, setUser] = useState(undefined)
  const [result, setResult] = useState({ uid: null, data: null, error: null })

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    import('./firestoreSource').then((m) => !cancelled && setSource(m.firestoreSource))
    return () => {
      cancelled = true
    }
  }, [enabled])

  useEffect(() => (source ? source.onAuth(setUser) : undefined), [source])

  useEffect(() => {
    if (!source || !user) return undefined
    let cancelled = false
    source
      .loadAnalytics()
      .then((data) => !cancelled && setResult({ uid: user.uid, data, error: null }))
      .catch((e) => {
        if (cancelled) return
        const error =
          e.code === 'permission-denied'
            ? 'อ่านผลวิเคราะห์ไม่ได้: Security Rules ยังไม่เปิดให้อ่าน collection analytics'
            : e.message
        setResult({ uid: user.uid, data: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [source, user])

  // ผลของผู้ใช้คนก่อน (ก่อนออกจากระบบ) ไม่นำมาแสดง
  const mine = user && result.uid === user.uid
  return { user, data: mine ? result.data : null, error: mine ? result.error : null }
}

// demo = true → คำนวณจาก rows ในเบราว์เซอร์ · false → อ่านจาก Firestore
export function useAnalytics({ demo, rows, products }) {
  const demoData = useDemoAnalytics(demo, rows, products)
  const live = useFirestoreAnalytics(!demo)
  if (demo) return { user: DEMO_USER, data: demoData, error: null, demo: true }
  return { ...live, demo: false }
}
