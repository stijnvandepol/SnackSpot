'use client'
import { useTheme } from './theme-provider'

type ThemeChoice = 'light' | 'dark' | 'system'

const THEME_OPTIONS: Array<{ value: ThemeChoice; label: string; description: string }> = [
  { value: 'light', label: 'Light', description: 'Always use light mode' },
  { value: 'dark', label: 'Dark', description: 'Always use dark mode' },
  { value: 'system', label: 'System', description: 'Follow your device setting' },
]

export function ThemeSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <fieldset>
      <legend className="sr-only">Theme preference</legend>
      <div className="space-y-2">
        {THEME_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
              theme === option.value
                ? 'border-[var(--snack-primary)] bg-[var(--snack-surface)]'
                : 'border-[var(--snack-input-border)] hover:bg-[var(--snack-surface)]'
            }`}
          >
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={theme === option.value}
              onChange={() => setTheme(option.value)}
              className="sr-only"
            />
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                theme === option.value
                  ? 'border-[var(--snack-primary)]'
                  : 'border-[var(--snack-muted)]'
              }`}
            >
              {theme === option.value && (
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--snack-primary)' }} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium" style={{ color: 'var(--snack-text)' }}>
                {option.label}
              </span>
              <span className="block text-xs" style={{ color: 'var(--snack-muted)' }}>
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
