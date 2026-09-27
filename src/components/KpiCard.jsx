function KpiCard({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-stone-200 sm:p-5 dark:bg-stone-900 dark:shadow-none dark:ring-stone-800">
      <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">{label}</p>
      <p className="mt-1.5 whitespace-nowrap text-lg font-semibold tabular-nums text-stone-900 sm:mt-2 sm:text-2xl lg:text-3xl dark:text-stone-50">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] leading-tight text-stone-400 sm:text-xs dark:text-stone-500">{hint}</p>}
    </div>
  )
}

export default KpiCard
