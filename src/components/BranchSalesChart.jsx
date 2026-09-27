import { memo } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useChartTheme } from '../lib/chartTheme'
import { formatBaht, formatBahtCompact, formatBahtShort } from '../lib/format'
import ChartCard from './ChartCard'
import ChartTooltip from './ChartTooltip'

const ROW_HEIGHT = 44

// แท่งแนวนอน: ชื่อสาขาภาษาไทยอ่านง่าย และเรียงมาก→น้อยจากบนลงล่าง
function BranchSalesChart({ data }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const fontSize = isMobile ? 11 : 12
  return (
    <ChartCard
      title="ยอดขายแยกสาขา"
      subtitle="เรียงจากมากไปน้อย (บาท)"
      table={{
        columns: ['สาขา', 'ยอดขาย'],
        getRows: () => data.map((d) => [d.branch, formatBaht(d.sales)]),
      }}
    >
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * ROW_HEIGHT + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: isMobile ? 70 : 96, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={theme.grid} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={isMobile ? formatBahtCompact : formatBahtShort}
            tick={{ fill: theme.axisText, fontSize }}
            tickLine={false}
            axisLine={false}
            tickCount={isMobile ? 3 : 5}
          />
          <YAxis
            type="category"
            dataKey="branch"
            tick={{ fill: theme.labelText, fontSize }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            width={isMobile ? 76 : 110}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: theme.barCursor }} />
          <Bar
            dataKey="sales"
            fill={theme.series}
            barSize={22}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="sales"
              position="right"
              formatter={formatBahtShort}
              style={{ fill: theme.labelText, fontSize }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// memo: ไม่วาดกราฟใหม่ถ้า data ยังเป็นชุดเดิม (เช่น ระหว่างรอคำนวณตัวกรองใหม่)
export default memo(BranchSalesChart)
