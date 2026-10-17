import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// ค่า config อยู่ใน .env.local (ดูตัวอย่างที่ .env.example) — Vite อ่านเฉพาะตัวแปรที่ขึ้นต้นด้วย VITE_
// ใช้ได้ทั้งในเบราว์เซอร์ (import.meta.env) และใน Node สคริปต์ (process.env)
const env = import.meta.env ?? process.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
