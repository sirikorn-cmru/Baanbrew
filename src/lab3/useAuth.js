import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { app } from '../lib/firebase'

// แยกจาก src/lib/firebase.js เพราะสคริปต์นำเข้าข้อมูล (Node) ไม่ต้องใช้ Auth
const auth = getAuth(app)
const provider = new GoogleAuthProvider()

export const signIn = () => signInWithPopup(auth, provider)
export const logOut = () => signOut(auth)

// user: undefined = กำลังตรวจสถานะ, null = ยังไม่ล็อกอิน, object = ล็อกอินแล้ว
export function useAuth() {
  const [user, setUser] = useState(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  return user
}
