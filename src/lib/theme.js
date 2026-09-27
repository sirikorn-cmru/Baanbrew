import { useSyncExternalStore } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'

// ค่าที่ผู้ใช้เลือก: 'light' | 'dark' | 'system' (ตามการตั้งค่าเครื่อง) — จำไว้ในเบราว์เซอร์นี้
const STORAGE_KEY = 'baanbrew-theme'
const listeners = new Set()

function readPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system' // โหมดส่วนตัว / ปิด storage → ใช้ค่าตามเครื่อง
  }
}

let preference = readPreference()

export function setThemePreference(next) {
  preference = next
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // บันทึกไม่ได้ก็ยังเปลี่ยนธีมได้ แค่ไม่จำหลังรีเฟรช
  }
  listeners.forEach((l) => l())
}

const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))

// ใส่/ถอด class "dark" ที่ <html> — Tailwind ใช้ class นี้กับ dark: ทุกตัว
export function applyTheme(resolved) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

// { preference, resolved: 'light' | 'dark', setPreference }
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, () => preference)
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
  return { preference: pref, resolved, setPreference: setThemePreference }
}
