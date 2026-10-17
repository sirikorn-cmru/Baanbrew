import { useState } from 'react'
import { logOut, signIn } from './useAuth'

const buttonClass =
  'rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800'

// hint = ข้อความตอนยังไม่ล็อกอิน (แต่ละแท็บบอกว่าล็อกอินแล้วได้อะไร)
function AuthBar({ user, hint = 'ดูยอดขายได้เลย · ล็อกอินเพื่อบันทึกยอดขาย' }) {
  const [error, setError] = useState('')
  const login = () => {
    setError('')
    signIn().catch((err) => {
      // ผู้ใช้ปิดหน้าต่างเอง ไม่ใช่ข้อผิดพลาด
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') setError(err.message)
    })
  }
  if (user === undefined) return null
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600 dark:text-stone-400">
      {user ? (
        <>
          <span>
            ล็อกอินเป็น <span className="font-medium text-stone-900 dark:text-stone-100">{user.displayName ?? user.email}</span>
          </span>
          <button type="button" onClick={logOut} className={buttonClass}>ออกจากระบบ</button>
        </>
      ) : (
        <>
          <span>{hint}</span>
          <button type="button" onClick={login} className={buttonClass}>ล็อกอินด้วย Google</button>
        </>
      )}
      {error && <span className="w-full text-red-700 dark:text-red-400">ล็อกอินไม่สำเร็จ: {error}</span>}
    </div>
  )
}

export default AuthBar
