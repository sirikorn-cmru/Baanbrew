import { memo } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useChartTheme } from '../lib/chartTheme'
import { formatBaht, formatBahtCompact, formatBahtShort, formatNumber } from '../lib/format'
import ChartCard from './ChartCard'
import ChartTooltip from './ChartTooltip'

const TOP_N = 10
const ROW_HEIGHT = 36
const pct = new Intl.NumberFormat('th-TH', { style: 'percent', maximumFractionDigits: 0 })
const pct1 = new Intl.NumberFormat('th-TH', { style: 'percent', maximumFractionDigits: 1 })
// ส่วนแบ่งต่ำกว่า 1% แสดงทศนิยม 1 ตำแหน่ง ไม่ให้ขึ้นเป็น 0%
const shareText = (s) => (s < 0.01 ? pct1 : pct).format(s)
// แกนยอดขาย: ช่องละ 1/2/2.5/5 × 10^k ให้ได้ราว `parts` ช่อง และจบที่ค่ากลม ๆ เหนือแท่งยาวที่สุด
// จอแคบใช้ 3 ช่อง จึงเพิ่ม 7.5 ด้วย ไม่งั้นช่องจะกระโดดจาก 500K เป็น 1M แล้วแกนยาวเกินแท่งไปมาก (เช่น ฿2M → แกน ฿3M)
const DESKTOP_STEPS = [1, 2, 2.5, 5, 10]
const MOBILE_STEPS = [1, 2, 2.5, 5, 7.5, 10]
function niceTicks(max, parts, multipliers) {
  if (!(max > 0)) return [0]
  const raw = max / parts
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = multipliers.map((m) => m * pow).find((s) => s >= raw)
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
}
// แกนบนจอแคบ: ทศนิยมได้ถึง 2 ตำแหน่ง เพราะช่อง 7.5 ทำให้มีค่าอย่าง ฿2.25M (formatBahtCompact ปัดเป็น ฿2.3M)
const axisCompactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })
const formatAxisCompact = (n) => `฿${axisCompactFmt.format(n)}`
const marginText = (profit, sales) => (profit === null || !sales ? '–' : pct1.format(profit / sales))

// แท่งแนวนอนเรียงมาก→น้อย ป้ายท้ายแท่ง = ยอดขาย (สัดส่วน)
function SalesBars({ data, total, labelKey, labelWidth }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const fontSize = isMobile ? 11 : 12
  const max = Math.max(...data.map((d) => d.sales))
  const ticks = isMobile ? niceTicks(max, 3, MOBILE_STEPS) : niceTicks(max, 5, DESKTOP_STEPS)
  return (
    <ResponsiveContainer width="100%" height={data.length * ROW_HEIGHT + 40}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: isMobile ? 92 : 128, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={theme.grid} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, ticks.at(-1)]}
          ticks={ticks}
          tickFormatter={isMobile ? formatAxisCompact : formatBahtShort}
          tick={{ fill: theme.axisText, fontSize }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey={labelKey}
          tick={{ fill: theme.labelText, fontSize }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          width={isMobile ? labelWidth.mobile : labelWidth.desktop}
          interval={0}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: theme.barCursor }} />
        <Bar dataKey="sales" name="ยอดขาย" fill={theme.series} barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList
            dataKey="sales"
            position="right"
            formatter={(v) => `${isMobile ? formatBahtCompact(v) : formatBahtShort(v)} (${shareText(v / total)})`}
            style={{ fill: theme.labelText, fontSize }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function CategoryChart({ data }) {
  const [first] = data.categories
  return (
    <ChartCard
      title={`หมวด${first.category}ทำยอดขาย ${pct.format(first.share)} ของร้าน`}
      subtitle={`ยอดขายแยกหมวดเมนู (บาท)${data.hasCost ? ' · กำไรขั้นต้นดูในตาราง' : ''}`}
      table={{
        columns: ['หมวด', 'เมนู', 'จำนวน', 'ยอดขาย', 'สัดส่วน', ...(data.hasCost ? ['กำไรขั้นต้น', 'อัตรากำไร'] : [])],
        getRows: () =>
          data.categories.map((c) => [
            c.category,
            formatNumber(c.items),
            formatNumber(c.qty),
            formatBaht(c.sales),
            pct1.format(c.share),
            ...(data.hasCost ? [formatBaht(c.profit), marginText(c.profit, c.sales)] : []),
          ]),
      }}
    >
      <SalesBars data={data.categories} total={data.total} labelKey="category" labelWidth={{ mobile: 72, desktop: 96 }} />
    </ChartCard>
  )
}

function TopItemsChart({ data }) {
  const top = data.items.slice(0, TOP_N)
  const topShare = top.reduce((s, it) => s + it.share, 0)
  return (
    <ChartCard
      title={`${TOP_N} เมนูแรกทำยอดขาย ${pct.format(topShare)} ของร้าน`}
      subtitle={`เมนูขายดี ${TOP_N} อันดับจากทั้งหมด ${formatNumber(data.items.length)} เมนู · ตารางแสดงครบทุกเมนู`}
      table={{
        columns: ['เมนู', 'หมวด', 'จำนวน', 'ยอดขาย', 'สัดส่วน', ...(data.hasCost ? ['อัตรากำไร'] : [])],
        getRows: () =>
          data.items.map((it) => [
            it.name,
            it.category,
            formatNumber(it.qty),
            formatBaht(it.sales),
            pct1.format(it.share),
            ...(data.hasCost ? [marginText(it.profit, it.sales)] : []),
          ]),
      }}
    >
      <SalesBars data={top} total={data.total} labelKey="name" labelWidth={{ mobile: 118, desktop: 150 }} />
    </ChartCard>
  )
}

// data: ผลจาก menuSales(rows, products)
function MenuSection({ data }) {
  return (
    <section className="space-y-4 sm:space-y-6" aria-labelledby="menu-heading">
      <h2 id="menu-heading" className="pt-2 text-lg font-semibold text-stone-900 dark:text-stone-50">
        เมนู
      </h2>
      <CategoryChart data={data} />
      <TopItemsChart data={data} />
      {data.hasCost && (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          กำไรขั้นต้นโดยประมาณ = จำนวน × (ราคาขายจริง − ต้นทุนต่อหน่วยใน products.csv) ยังไม่หักค่าแรง ค่าเช่า และค่าคอมมิชชันเดลิเวอรี
        </p>
      )}
    </section>
  )
}

// memo: ไม่วาดใหม่ถ้า data ยังเป็นชุดเดิม (เช่น ระหว่างรอคำนวณตัวกรองใหม่)
export default memo(MenuSection)
