// Lab 4.1–4.2 · ลูกค้าและเมนู: RFM, Cohort, ABC
import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartCard from '../components/ChartCard'
import { useIsMobile } from '../hooks/useMediaQuery'
import { CONTEXT_OPACITY, useChartTheme } from '../lib/chartTheme'
import { SEGMENTS } from '../lib/analytics/rfm'
import { formatBaht, formatMonthShort, formatNumber, formatPct as pct } from '../lib/format'
import { AnalyticsShell, Insight, Pending } from './ui'
import { useAnalytics } from './useAnalytics'

const SEG = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]))
const PREVIEW_ROWS = 15

function TooltipBox({ title, rows }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-md ring-1 ring-stone-200 dark:bg-stone-800 dark:shadow-black/40 dark:ring-stone-700">
      <p className="text-stone-500 dark:text-stone-400">{title}</p>
      {rows.map(([label, value]) => (
        <p key={label} className="mt-0.5 flex gap-4 tabular-nums text-stone-900 dark:text-stone-50">
          <span className="text-stone-500 dark:text-stone-400">{label}</span>
          <span className="ml-auto font-semibold">{value}</span>
        </p>
      ))}
    </div>
  )
}

// ---------------- 4.1B · รายชื่อลูกค้าในกลุ่ม + CSV ----------------
function downloadCsv(segment, customers) {
  const header = ['customer_id', 'segment', 'days_since_last', 'bills', 'revenue', 'r', 'f', 'm']
  const lines = customers.map((c) => [c.id, segment, c.R, c.F, c.M, c.r, c.f, c.m].join(','))
  // BOM ให้ Excel อ่าน UTF-8 (ภาษาไทย) ถูก
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rfm-${segment.replace(/\s+/g, '-').toLowerCase()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function SegmentCustomers({ segment, customers, onClose }) {
  const list = customers.filter((c) => c.segment === segment).sort((a, b) => b.M - a.M)
  return (
    <div className="mt-4 rounded-xl ring-1 ring-amber-300 dark:ring-amber-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-50">
            {SEG[segment].th} · {formatNumber(list.length)} คน
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            เรียงตามยอดซื้อรวม แสดง {Math.min(PREVIEW_ROWS, list.length)} คนแรก · {SEG[segment].action}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(segment, list)}
            className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            ดาวน์โหลด CSV ({formatNumber(list.length)} แถว)
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดรายชื่อ"
            className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-stone-300 hover:bg-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800"
          >
            ปิด
          </button>
        </div>
      </div>
      <div className="overflow-x-auto px-4 py-2">
        <table className="w-full min-w-[480px] text-sm tabular-nums">
          <thead className="text-left text-stone-500 dark:text-stone-400">
            <tr>
              <th className="py-1.5 font-medium">รหัสลูกค้า</th>
              <th className="py-1.5 text-right font-medium">ไม่ได้มา (วัน)</th>
              <th className="py-1.5 text-right font-medium">บิล</th>
              <th className="py-1.5 text-right font-medium">ยอดซื้อรวม</th>
              <th className="py-1.5 text-right font-medium">R-F-M</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-stone-700 dark:divide-stone-800 dark:text-stone-300">
            {list.slice(0, PREVIEW_ROWS).map((c) => (
              <tr key={c.id}>
                <td className="py-1.5">{c.id}</td>
                <td className="py-1.5 text-right">{formatNumber(c.R)}</td>
                <td className="py-1.5 text-right">{formatNumber(c.F)}</td>
                <td className="py-1.5 text-right">{formatBaht(c.M)}</td>
                <td className="py-1.5 text-right">{`${c.r}-${c.f}-${c.m}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* PDPA: ไฟล์มีแค่รหัสลูกค้า แต่ยังเชื่อมกับข้อมูลส่วนบุคคลในระบบสมาชิกได้ */}
      <p className="border-t border-stone-200 px-4 py-2 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
        ⚠️ ข้อมูลลูกค้าตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA): ใช้เพื่อการตลาดที่ลูกค้ายินยอมไว้เท่านั้น เก็บไฟล์ในที่ปลอดภัย และลบเมื่อใช้เสร็จ
      </p>
    </div>
  )
}

// ---------------- RFM ----------------
function RfmCard({ rfm }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  const [picked, setPicked] = useState(null)
  if (rfm.error) {
    return (
      <ChartCard title="RFM · กลุ่มลูกค้าสมาชิก">
        <Pending>{rfm.error}</Pending>
      </ChartCard>
    )
  }
  const pick = (segment) => segment && setPicked((p) => (p === segment ? null : segment))
  const data = rfm.segments.map((s) => ({ ...s, label: SEG[s.segment].th }))
  const ch = rfm.segments.find((s) => s.segment === 'Champions')
  const risk = rfm.segments.find((s) => s.segment === 'At Risk')
  const axisText = { fill: theme.axisText, fontSize: 12 }
  const dim = (segment) => (picked && picked !== segment ? CONTEXT_OPACITY : 1)

  return (
    <ChartCard
      title={`ลูกค้าชั้นยอด ${pct(ch.customerShare)} ของสมาชิก ทำยอด ${pct(ch.revenueShare)}`}
      subtitle="RFM · สัดส่วนจำนวนลูกค้า (จาง) เทียบสัดส่วนยอดซื้อ (เข้ม) · คลิกแท่งหรือแถวเพื่อดูรายชื่อ"
    >
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600 dark:text-stone-400">
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: theme.series, opacity: CONTEXT_OPACITY }} />% ลูกค้า
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: theme.series }} />% ยอดซื้อ
        </li>
      </ul>
      <ResponsiveContainer width="100%" height={isMobile ? 300 : 320}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke={theme.grid} horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => pct(v)} domain={[0, 'auto']} tick={axisText} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={isMobile ? 76 : 96} tick={{ fill: theme.labelText, fontSize: 12 }} tickLine={false} axisLine={{ stroke: theme.grid }} />
          <Tooltip
            cursor={{ fill: theme.barCursor }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={payload[0].payload.label}
                  rows={[
                    ['ลูกค้า', `${formatNumber(payload[0].payload.customers)} คน (${pct(payload[0].payload.customerShare, 1)})`],
                    ['ยอดซื้อ', `${formatBaht(payload[0].payload.revenue)} (${pct(payload[0].payload.revenueShare, 1)})`],
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="customerShare" name="% ลูกค้า" radius={[0, 3, 3, 0]} isAnimationActive={false} onClick={(d) => pick(d?.segment)} cursor="pointer">
            {data.map((d) => (
              <Cell key={d.segment} fill={theme.series} fillOpacity={CONTEXT_OPACITY * dim(d.segment)} />
            ))}
          </Bar>
          <Bar dataKey="revenueShare" name="% ยอดซื้อ" radius={[0, 3, 3, 0]} isAnimationActive={false} onClick={(d) => pick(d?.segment)} cursor="pointer">
            {data.map((d) => (
              <Cell key={d.segment} fill={theme.series} fillOpacity={dim(d.segment)} />
            ))}
            <LabelList dataKey="revenueShare" position="right" formatter={(v) => pct(v)} style={{ fontSize: 12, fill: theme.labelText }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm tabular-nums">
          <thead className="text-left text-stone-500 dark:text-stone-400">
            <tr>
              <th className="py-1.5 font-medium">กลุ่ม</th>
              <th className="py-1.5 text-right font-medium">ลูกค้า</th>
              <th className="py-1.5 text-right font-medium">ยอดซื้อ</th>
              <th className="py-1.5 pl-4 font-medium">ควรทำอะไร</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-stone-700 dark:divide-stone-800 dark:text-stone-300">
            {data.map((d) => (
              <tr
                key={d.segment}
                onClick={() => pick(d.segment)}
                aria-selected={picked === d.segment}
                className={`cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800 ${picked === d.segment ? 'bg-amber-50 dark:bg-amber-950/40' : ''}`}
              >
                <td className="py-1.5">
                  {d.label} <span className="text-stone-400 dark:text-stone-500">{d.segment}</span>
                </td>
                <td className="py-1.5 text-right">{formatNumber(d.customers)}</td>
                <td className="py-1.5 text-right">{formatBaht(d.revenue)}</td>
                <td className="py-1.5 pl-4 text-stone-600 dark:text-stone-400">{SEG[d.segment].action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {picked && <SegmentCustomers segment={picked} customers={rfm.customers} onClose={() => setPicked(null)} />}

      <Insight>
        ลูกค้าชั้นยอด {formatNumber(ch.customers)} คน ทำยอด {pct(ch.revenueShare)} · กลุ่มเสี่ยงหาย {formatNumber(risk.customers)} คน
        ยังถือยอด {pct(risk.revenueShare)} เป็นเป้าหมายแรกของแคมเปญดึงกลับ (เรียงตามยอดซื้อในรายชื่อ)
      </Insight>
    </ChartCard>
  )
}

// ---------------- Cohort ----------------
const MAXK = 12
const MIN_OPACITY = 0.08

function CohortCard({ cohort }) {
  const theme = useChartTheme()
  if (cohort.error) {
    return (
      <ChartCard title="Cohort · การกลับมาซื้อซ้ำ">
        <Pending>{cohort.error}</Pending>
      </ChartCard>
    )
  }
  // ค่าเฉลี่ยเดือนถัดไป: ใช้เฉพาะ cohort ที่สังเกตได้อย่างน้อย 2 เดือนเต็ม (ไม่นับเดือนล่าสุดที่ข้อมูลไม่ครบ)
  const full = cohort.cohorts.filter((c) => c.retention.length > 2).map((c) => c.retention[1])
  const avg1 = full.reduce((a, b) => a + b, 0) / (full.length || 1)
  const max = Math.max(...cohort.cohorts.flatMap((c) => c.retention.slice(1)), 0.01)
  const cols = `4.5rem 2.75rem repeat(${MAXK}, minmax(2.25rem, 1fr))`

  return (
    <ChartCard
      title={`ลูกค้าใหม่กลับมาซื้อเดือนถัดไปเฉลี่ย ${pct(avg1)}`}
      subtitle="Cohort · แถว = เดือนแรกที่ซื้อ · คอลัมน์ = เดือนที่เท่าไรหลังจากนั้น · ตัวเลข = % ที่กลับมาซื้อ · ช่องลายขีด = เดือนล่าสุดที่ข้อมูลยังไม่ครบ"
      table={{
        columns: ['เดือนแรก', 'คน', ...Array.from({ length: MAXK }, (_, k) => `+${k + 1}`)],
        getRows: () =>
          cohort.cohorts.map((c) => [
            formatMonthShort(`${c.cohort}-01`),
            formatNumber(c.size),
            ...Array.from({ length: MAXK }, (_, k) => (c.retention[k + 1] === undefined ? '–' : pct(c.retention[k + 1]))),
          ]),
      }}
    >
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] gap-0.5 text-xs tabular-nums" style={{ gridTemplateColumns: cols }}>
          <span className="font-medium text-stone-500 dark:text-stone-400">เดือนแรก</span>
          <span className="text-right font-medium text-stone-500 dark:text-stone-400">คน</span>
          {Array.from({ length: MAXK }, (_, k) => (
            <span key={k} className="text-center font-medium text-stone-500 dark:text-stone-400">
              +{k + 1}
            </span>
          ))}
          {cohort.cohorts.map((c) => {
            const last = c.retention.length - 1
            return [
              <span key={`${c.cohort}-m`} className="py-1 text-stone-700 dark:text-stone-300">
                {formatMonthShort(`${c.cohort}-01`)}
              </span>,
              <span key={`${c.cohort}-n`} className="py-1 text-right text-stone-500 dark:text-stone-400">
                {formatNumber(c.size)}
              </span>,
              ...Array.from({ length: MAXK }, (_, i) => {
                const k = i + 1
                const v = c.retention[k]
                if (v === undefined) return <span key={`${c.cohort}-${k}`} />
                const partial = cohort.lastMonthPartial && k === last
                const alpha = MIN_OPACITY + (1 - MIN_OPACITY) * (v / max)
                return (
                  <span
                    key={`${c.cohort}-${k}`}
                    title={`${formatMonthShort(`${c.cohort}-01`)} เดือนที่ +${k}: ${pct(v, 1)}${partial ? ' (เดือนไม่ครบ)' : ''}`}
                    className="relative flex h-7 items-center justify-center overflow-hidden rounded-[3px]"
                  >
                    <span className="absolute inset-0" style={{ background: theme.series, opacity: alpha }} />
                    {partial && (
                      <span
                        className="absolute inset-0"
                        style={{ background: `repeating-linear-gradient(45deg, transparent 0 4px, ${theme.surface} 4px 6px)` }}
                      />
                    )}
                    <span className={`relative ${alpha > 0.55 ? 'text-white' : 'text-stone-700 dark:text-stone-200'}`}>{Math.round(v * 100)}</span>
                  </span>
                )
              }),
            ]
          })}
        </div>
      </div>
      <Insight>
        ช่องแนวทแยงล่างขวาดูต่ำเพราะ {formatMonthShort(`${cohort.lastMonth}-01`)} มีข้อมูลแค่ {cohort.daysInLastMonth} จาก {cohort.daysInMonth} วัน
        ไม่ใช่ลูกค้าหาย (กับดักเดียวกับกราฟเดือนล่าสุดใน Lab 2.2)
      </Insight>
    </ChartCard>
  )
}

// ---------------- ABC ----------------
function AbcCard({ abc }) {
  const isMobile = useIsMobile()
  const theme = useChartTheme()
  if (abc.error) {
    return (
      <ChartCard title="Pareto · ABC ของเมนู">
        <Pending>{abc.error}</Pending>
      </ChartCard>
    )
  }
  const items = abc.items
  const groups = ['A', 'B', 'C'].map((cls) => {
    const list = items.filter((i) => i.cls === cls)
    return { cls, count: list.length, share: list.reduce((s, i) => s + i.share, 0), names: list.map((i) => i.name) }
  })
  const [A, , C] = groups
  const opacity = { A: 1, B: 0.5, C: 0.2 }
  const axisText = { fill: theme.axisText, fontSize: 12 }

  return (
    <ChartCard
      title={`${A.count} จาก ${items.length} เมนูทำยอด ${pct(A.share, 1)}`}
      subtitle="Pareto · แท่ง = สัดส่วนยอดขายแต่ละเมนู · เส้น = ยอดสะสม · แกนเดียวกันเป็น % (ไม่ใช้แกนคู่)"
      table={{
        columns: ['อันดับ', 'เมนู', 'กลุ่ม', 'ยอดขาย', 'สัดส่วน', 'สะสม'],
        getRows: () => items.map((i) => [i.rank, i.name, i.cls, formatBaht(i.revenue), pct(i.share, 1), pct(i.cumShare, 1)]),
      }}
    >
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600 dark:text-stone-400">
        {groups.map((g) => (
          <li key={g.cls} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: theme.series, opacity: opacity[g.cls] }} />
            กลุ่ม {g.cls} · {g.count} เมนู ({pct(g.share, 1)})
          </li>
        ))}
      </ul>
      <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
        <ComposedChart data={items} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis dataKey="rank" tick={axisText} tickLine={false} axisLine={{ stroke: theme.grid }} interval={isMobile ? 9 : 4} />
          <YAxis tickFormatter={(v) => pct(v)} domain={[0, 1]} width={44} tick={axisText} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: theme.barCursor }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const it = payload[0].payload
              return (
                <TooltipBox
                  title={`#${it.rank} ${it.name} · กลุ่ม ${it.cls}`}
                  rows={[
                    ['ยอดขาย', `${formatBaht(it.revenue)} (${pct(it.share, 1)})`],
                    ['สะสม', pct(it.cumShare, 1)],
                  ]}
                />
              )
            }}
          />
          <ReferenceLine y={0.8} stroke={theme.cursor} strokeDasharray="4 4" label={{ value: '80%', position: 'insideTopRight', fontSize: 11, fill: theme.axisText }} />
          <Bar dataKey="share" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {items.map((i) => (
              <Cell key={i.product_id} fill={theme.series} fillOpacity={opacity[i.cls]} />
            ))}
          </Bar>
          <Line dataKey="cumShare" stroke={theme.labelText} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <Insight>
        กลุ่ม C {C.count} เมนู ({C.names.join(', ')}) รวมกันแค่ {pct(C.share, 1)} ของยอดขาย ควรทบทวนก่อนเพิ่มเมนูใหม่
      </Insight>
    </ChartCard>
  )
}

function CustomersTab({ demo, rows, products }) {
  const state = useAnalytics({ demo, rows, products })
  return (
    <AnalyticsShell state={state}>
      {(d) => (
        <>
          <RfmCard rfm={d.rfm} />
          <CohortCard cohort={d.cohort} />
          <AbcCard abc={d.abc} />
        </>
      )}
    </AnalyticsShell>
  )
}

export default CustomersTab
