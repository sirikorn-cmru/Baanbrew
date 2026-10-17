import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logOut, onAuth, signIn } from '../lab3/useAuth'

// เอกสารสรุปที่ scripts/build-analytics.mjs เขียนไว้ — หน้าเว็บอ่าน 5 ครั้ง แทนยอดขายดิบหลายหมื่นเอกสาร
export const ANALYTICS_DOCS = ['meta', 'daily', 'rfm', 'cohort', 'abc']

export const firestoreSource = {
  mode: 'firebase',
  onAuth,
  signIn,
  signOut: logOut,

  async loadAnalytics() {
    const snaps = await Promise.all(ANALYTICS_DOCS.map((k) => getDoc(doc(db, 'analytics', k))))
    if (!snaps[0].exists()) {
      const err = new Error('ยังไม่มีผลวิเคราะห์ใน Firestore — รัน npm run analytics ก่อน')
      err.code = 'not-built'
      throw err
    }
    const out = { reads: snaps.length }
    snaps.forEach((s, i) => {
      out[ANALYTICS_DOCS[i]] = s.exists() ? s.data() : { error: `ไม่พบเอกสาร analytics/${ANALYTICS_DOCS[i]}` }
    })
    out.meta = { ...out.meta, builtAt: out.meta.builtAt?.toDate?.() ?? null }
    return out
  },
}
