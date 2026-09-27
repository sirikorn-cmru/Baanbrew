// ถ่ายภาพหน้าจอ dashboard สำหรับ README (docs/screenshots/*.png)
//
// ใช้ Chrome/Edge แบบ headless ผ่าน Chrome DevTools Protocol เพื่อจำลองขนาดจอจริง
// (Chrome headless บน Windows เปิดหน้าต่างแคบกว่า ~500px ไม่ได้ ภาพมือถือจึงต้องจำลองแบบนี้)
//
// วิธีใช้: เปิด dev server ก่อน (npm run dev) แล้วรัน
//   npm run screenshots
//   npm run screenshots -- http://localhost:4173/ out/     ← กำหนด URL และโฟลเดอร์เองได้
// ถ้าหา Chrome ไม่เจอ ให้ตั้ง CHROME_PATH=<path ของ chrome หรือ msedge>
//
// ต้องใช้ Node.js 22 ขึ้นไป (มี WebSocket ในตัว)

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const PAGE_URL = process.argv[2] ?? 'http://localhost:5173/'
const OUT_DIR = resolve(process.argv[3] ?? 'docs/screenshots')
const PORT = 9333

// หน้าภาพรวม: มี 3 กราฟ, ทุกเส้นมีข้อมูลเส้นจริง (ยอดรายวัน 2 + รายสาขา 5 = 7 เส้น), กราฟแท่งมีครบ 5 สาขา
const OVERVIEW_DRAWN = `(() => {
  const lines = [...document.querySelectorAll('.recharts-line-curve')]
  return document.querySelectorAll('svg.recharts-surface').length >= 3 &&
    lines.length >= 7 && lines.every((p) => (p.getAttribute('d') || '').length > 20) &&
    document.querySelectorAll('.recharts-bar-rectangle path').length >= 5
})()`

// หน้าเจาะลึกยอดขาย: ฮิสโตแกรมยอดต่อบิลมีแท่ง + เส้นค่ากลาง/ค่าเฉลี่ย, heatmap ครบ 7 วัน × 14 ชั่วโมง
const INSIGHTS_DRAWN = `(() =>
  document.querySelectorAll('.recharts-bar-rectangle path').length >= 10 &&
  document.querySelectorAll('.recharts-reference-line').length >= 2 &&
  document.querySelectorAll('button[aria-label$="บิลต่อวัน"]').length >= 98
)()`

// หน้า Lab 2.2: กราฟก่อน/หลังซ่อม 5 คู่ = 10 กราฟ, เส้นรายวัน + รายสัปดาห์มีข้อมูลจริง
const LAB2_DRAWN = `(() => {
  const lines = [...document.querySelectorAll('.recharts-line-curve')]
  return document.querySelectorAll('svg.recharts-surface').length >= 10 &&
    lines.length >= 2 && lines.every((p) => (p.getAttribute('d') || '').length > 20)
})()`

const SHOTS = [
  { name: 'dashboard-light', width: 1280, height: 900, scale: 1, mobile: false, dark: false, drawn: OVERVIEW_DRAWN },
  { name: 'dashboard-dark', width: 1280, height: 900, scale: 1, mobile: false, dark: true, drawn: OVERVIEW_DRAWN },
  { name: 'dashboard-mobile', width: 390, height: 844, scale: 2, mobile: true, dark: false, drawn: OVERVIEW_DRAWN },
  { name: 'insights-light', width: 1280, height: 900, scale: 1, mobile: false, dark: false, hash: '#insights', drawn: INSIGHTS_DRAWN },
  { name: 'lab2-light', width: 1280, height: 900, scale: 1, mobile: false, dark: false, hash: '#lab2', drawn: LAB2_DRAWN },
]
const PAGE_HEIGHT = `Math.ceil(document.querySelector('main').getBoundingClientRect().bottom)`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  const found = candidates.find((p) => p && existsSync(p))
  if (!found) throw new Error('ไม่พบ Chrome หรือ Edge — ตั้งค่า CHROME_PATH ให้ชี้ไปที่ไฟล์โปรแกรม')
  return found
}

async function assertServerUp() {
  try {
    const res = await fetch(PAGE_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    throw new Error(`เปิด ${PAGE_URL} ไม่ได้ (${err.message}) — รัน npm run dev ก่อน`, { cause: err })
  }
}

// เชื่อมต่อ DevTools Protocol ของแท็บแรก คืนฟังก์ชัน send(method, params)
async function connect() {
  let wsUrl
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl
    } catch {
      // เบราว์เซอร์ยังเปิดไม่เสร็จ
    }
    if (!wsUrl) await sleep(200)
  }
  if (!wsUrl) throw new Error('เบราว์เซอร์ไม่เปิด DevTools port')

  const ws = new WebSocket(wsUrl)
  await new Promise((r, reject) => {
    ws.addEventListener('open', r, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let nextId = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data)
    const p = msg.id && pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.error) p.reject(new Error(msg.error.message))
    else p.resolve(msg.result)
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  return { send, close: () => ws.close() }
}

async function main() {
  await assertServerUp()
  mkdirSync(OUT_DIR, { recursive: true })

  const profile = mkdtempSync(join(tmpdir(), 'baanbrew-shots-')) // โปรไฟล์ชั่วคราว ไม่ยุ่งกับเบราว์เซอร์ของผู้ใช้
  const browser = spawn(
    findBrowser(),
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
      `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' },
  )

  let cdp
  try {
    cdp = await connect()
    const { send } = cdp
    const evaluate = async (expression) =>
      (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
    const waitDrawn = async (drawn) => {
      for (let i = 0; i < 150; i++) {
        if (await evaluate(drawn)) return true
        await sleep(200)
      }
      return false
    }
    const setViewport = (s, height) =>
      send('Emulation.setDeviceMetricsOverride', {
        width: s.width, height, deviceScaleFactor: s.scale, mobile: s.mobile,
      })

    await send('Page.enable')
    await send('Runtime.enable')

    for (const s of SHOTS) {
      await setViewport(s, s.height)
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: s.dark ? 'dark' : 'light' }],
      })
      // ไปหน้าว่างก่อน — ถ้าต่างกันแค่ hash เบราว์เซอร์จะไม่โหลดหน้าใหม่ แท็บจึงไม่เปลี่ยน
      await send('Page.navigate', { url: 'about:blank' })
      await send('Page.navigate', { url: `${PAGE_URL}${s.hash ?? ''}` })
      if (!(await waitDrawn(s.drawn))) throw new Error(`${s.name}: กราฟวาดไม่เสร็จ`)

      // ขยาย viewport ให้สูงเท่าหน้าเว็บ แล้วรอกราฟวาดใหม่ตามขนาด — ถ่ายตอน resize อาจได้กราฟว่าง
      const height = await evaluate(PAGE_HEIGHT)
      await setViewport(s, height)
      await sleep(500)
      if (!(await waitDrawn(s.drawn))) throw new Error(`${s.name}: กราฟว่างหลังปรับขนาด`)
      await sleep(1000)

      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: s.width, height: await evaluate(PAGE_HEIGHT), scale: 1 },
      })
      const file = join(OUT_DIR, `${s.name}.png`)
      writeFileSync(file, Buffer.from(data, 'base64'))
      console.log(`✓ ${s.name}.png  ${s.width}×${height}${s.scale > 1 ? ` @${s.scale}x` : ''}`)
    }
  } finally {
    cdp?.close()
    browser.kill()
    await sleep(300) // ให้เบราว์เซอร์ปิดไฟล์ในโปรไฟล์ก่อนลบ
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

main().catch((err) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
