import { useTheme } from '../lib/theme'

const OPTIONS = [
  { value: 'light', label: 'สว่าง', icon: SunIcon },
  { value: 'dark', label: 'มืด', icon: MoonIcon },
  { value: 'system', label: 'อัตโนมัติ', icon: AutoIcon },
]

function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  return (
    <div
      role="radiogroup"
      aria-label="ธีม"
      className="inline-flex shrink-0 rounded-full bg-white p-0.5 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={value === 'system' ? 'ตามการตั้งค่าของเครื่อง' : label}
            onClick={() => setPreference(value)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-colors sm:text-sm ${
              active
                ? 'bg-amber-800 font-medium text-white dark:bg-amber-600 dark:text-stone-950'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
          >
            <Icon />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function AutoIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  )
}

export default ThemeToggle
