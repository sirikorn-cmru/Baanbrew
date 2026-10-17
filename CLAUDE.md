# บ้านบรู Dashboard · กติกาของโปรเจกต์

Claude Code อ่านไฟล์นี้อัตโนมัติทุกครั้งที่เริ่ม session

## ภาษาและวิธีทำงาน
- ตอบและเขียน comment เป็นภาษาไทย ชื่อตัวแปรเป็นภาษาอังกฤษ
- ก่อนแก้ไฟล์มากกว่า 1 ไฟล์ ให้สรุปแผนสั้น ๆ ก่อน
- เขียนโค้ดเสร็จแล้วรัน `npm test` `npm run lint` และรายงานผลทุกครั้ง

## ห้ามทำ
- ห้ามแก้ไฟล์ `*.test.js` / `*.test.mjs` เพื่อให้ test ผ่าน ถ้าคิดว่า test ผิด ให้อธิบายและหยุดรอ
- ห้ามอ่าน แสดง หรือ commit ไฟล์ใน `secrets/` และ `.env*` (ยกเว้น `.env.example`)
- ห้าม `git push --force` และห้าม commit ตรงเข้า `main` ให้ทำงานบน branch แล้วเปิด Pull Request

## โครงสร้างที่ต้องใช้ซ้ำ ไม่เขียนใหม่
- อ่าน CSV และสูตร KPI ของหน้าภาพรวม: `src/lib/metrics.js` (`parseSales`, `computeKpis`, …) · แถวสำหรับ pipeline: `prepareRows`
- รูปแบบตัวเลขและวันที่ไทยบนหน้าจอ: `src/lib/format.js`
- คำนวณวันที่: `src/lab3/time.js` (`todayBangkok`, `addDays`, `daysBetween`) ห้ามใช้ `new Date().toISOString()` กับวันที่ไทย
- สีกราฟตามธีมสว่าง/มืด: `useChartTheme()` ใน `src/lib/chartTheme.js` · กรอบกราฟ: `src/components/ChartCard.jsx`
- ฟังก์ชันวิเคราะห์: `src/lib/analytics/` ต้องเป็น pure function ไม่เรียก Firestore เอง
- แท็บ Lab 4 อ่านผลวิเคราะห์จาก collection `analytics` (5 เอกสาร) เท่านั้น ห้ามอ่านยอดขายดิบทั้งหมดจาก Firestore (โควตาอ่านฟรี 50,000 ครั้ง/วัน)

## คำสั่ง
- `npm run dev` · `npm test` · `npm run lint` · `npm run build`
- `npm run analytics:dry` คำนวณผลวิเคราะห์โดยไม่เขียน · `npm run analytics` เขียนลง Firestore (ใช้ key ใน `secrets/`)
- `npm run deploy` build แล้ว deploy Hosting + Security Rules ขึ้น Firebase
- โหมดสาธิตของแท็บ Lab 4 (ไม่ใช้ Firestore): `http://localhost:5173/?demo#customers`
