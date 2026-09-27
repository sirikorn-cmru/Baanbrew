import { useChartTheme } from '../lib/chartTheme'
import { formatBaht } from '../lib/format'

// series (ไม่บังคับ): [{ key, name, opacity }] กำหนดลำดับ ชื่อ และความจางของจุดสีในแต่ละแถว
// formatValue (ไม่บังคับ): รูปแบบตัวเลข ค่าตั้งต้นเป็นบาท
function ChartTooltip({ active, payload, label, formatLabel = (l) => l, formatValue = formatBaht, series }) {
  const theme = useChartTheme()
  if (!active || !payload?.length) return null

  const items = series
    ? series
        .map((s) => ({ ...s, value: payload.find((p) => p.dataKey === s.key)?.value }))
        .filter((s) => s.value !== null && s.value !== undefined)
    : [{ key: payload[0].dataKey, value: payload[0].value, opacity: 1 }]

  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-md ring-1 ring-stone-200 dark:bg-stone-800 dark:shadow-black/40 dark:ring-stone-700">
      <p className="text-stone-500 dark:text-stone-400">{formatLabel(label)}</p>
      {items.map((item, i) => (
        <p
          key={item.key}
          className={`mt-0.5 flex items-center gap-2 tabular-nums ${
            i === 0 ? 'font-semibold text-stone-900 dark:text-stone-50' : 'text-stone-600 dark:text-stone-300'
          }`}
        >
          <span className="size-2 rounded-full" style={{ background: theme.series, opacity: item.opacity }} />
          {item.name && <span className="font-normal text-stone-500 dark:text-stone-400">{item.name}</span>}
          <span className="ml-auto pl-3">{formatValue(item.value)}</span>
        </p>
      ))}
    </div>
  )
}

export default ChartTooltip
