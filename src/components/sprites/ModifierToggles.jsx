// ─── ModifierToggles.jsx ──────────────────────────────────────────────────────
// Toggle switches for optional generation permissions.
//
// All toggles are OFF by default. Identity safety is the default state.
// Each toggle, when enabled, unlocks additional prompt sections in the
// prompt compiler. Clothing and props toggles reveal optional text inputs.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { ShieldAlert, Shirt, Package, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

const TOGGLE_DEFS = [
  {
    key: 'allowPrompt',
    label: 'Custom Prompt',
    description: 'Add your own generation instructions',
    warningText: 'Instructions that conflict with the identity lock will be ignored.',
    icon: MessageSquare,
    iconColor: '#6366f1',
  },
  {
    key: 'allowClothing',
    label: 'Clothing Changes',
    description: 'Permit outfit or clothing modifications',
    warningText: 'Face, hair, eyes, and body proportions remain locked even when clothing is unlocked.',
    icon: Shirt,
    iconColor: '#f59e0b',
  },
  {
    key: 'allowProps',
    label: 'Prop Additions',
    description: 'Allow new props or accessories',
    warningText: 'Only add props plausible with the character\'s existing design.',
    icon: Package,
    iconColor: '#10b981',
  },
]

export default function ModifierToggles({ toggles, onChange, theme }) {
  const [collapsed, setCollapsed] = useState(true)

  const hasAnyOn = Object.values(toggles).some(Boolean)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${theme.fieldBorder}`, background: theme.fieldBg }}
    >
      {/* Header / collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: collapsed ? 'transparent' : `${theme.primary}08` }}
        onMouseEnter={e => { e.currentTarget.style.background = `${theme.primary}08` }}
        onMouseLeave={e => { if (collapsed) e.currentTarget.style.background = 'transparent' }}
      >
        <ShieldAlert
          className="w-4 h-4 flex-shrink-0"
          style={{ color: hasAnyOn ? '#f59e0b' : theme.textMuted }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.labelColor }}>
            Optional Permissions
          </p>
          {hasAnyOn && collapsed && (
            <p className="text-xs mt-0.5" style={{ color: '#f59e0b' }}>
              {Object.entries(toggles).filter(([, v]) => v).length} permission{Object.entries(toggles).filter(([, v]) => v).length !== 1 ? 's' : ''} enabled
            </p>
          )}
          {!hasAnyOn && collapsed && (
            <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
              All locked — identity-safe defaults
            </p>
          )}
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
          : <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
        }
      </button>

      {/* Toggle rows */}
      {!collapsed && (
        <div style={{ borderTop: `1px solid ${theme.fieldBorder}` }}>
          {TOGGLE_DEFS.map(def => {
            const Icon = def.icon
            const isOn = toggles[def.key]
            return (
              <div key={def.key} style={{ borderBottom: `1px solid ${theme.fieldBorder}` }}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isOn ? def.iconColor : theme.textMuted }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: theme.textBody }}>{def.label}</p>
                    <p className="text-xs" style={{ color: theme.textMuted }}>{def.description}</p>
                  </div>
                  {/* Toggle switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    onClick={() => onChange({ ...toggles, [def.key]: !isOn })}
                    className="relative flex-shrink-0 rounded-full transition-all duration-200 focus:outline-none"
                    style={{
                      width: '42px',
                      height: '24px',
                      background: isOn ? theme.primary : `${theme.textMuted}40`,
                    }}
                  >
                    <span
                      className="absolute top-1 rounded-full bg-white transition-all duration-200"
                      style={{
                        width: '16px',
                        height: '16px',
                        left: isOn ? '22px' : '4px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    />
                  </button>
                </div>
                {/* Warning shown when toggle is ON */}
                {isOn && (
                  <div
                    className="mx-4 mb-3 flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                    style={{ background: '#f59e0b15', border: '1px solid #f59e0b30', color: '#f59e0b' }}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {def.warningText}
                  </div>
                )}
              </div>
            )
          })}
          {/* Footer note */}
          <div className="px-4 py-3">
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Permissions apply to all sprites in this generation. The identity lock is always enforced regardless of these settings.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
