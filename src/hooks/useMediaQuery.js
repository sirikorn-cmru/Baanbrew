import { useSyncExternalStore } from 'react'

// true เมื่อ media query ตรง และอัปเดตเองเมื่อหมุนจอหรือปรับขนาดหน้าต่าง
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

// ตรงกับ breakpoint `sm` ของ Tailwind (640px): ต่ำกว่านี้ถือเป็นมือถือ
export const useIsMobile = () => useMediaQuery('(max-width: 639px)')
